<?php

namespace App\Services;

use App\Enums\ActivityLogCategory;
use App\Enums\PurchaseOrderStatus;
use App\Enums\ReceivingStatus;
use App\Enums\StockMovementType;
use App\Models\Product;
use App\Models\PurchaseOrder;
use App\Models\PurchaseOrderItem;
use App\Models\PurchaseOrderReceipt;
use App\Models\StockMovement;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class GoodsReceiptService
{
    public function __construct(public FinanceService $financeService) {}

    /**
     * Memproses penerimaan barang (LPB - Partial / Full Receiving) dengan Multi-UOM,
     * barang bonus (free_qty), perhitungan Weighted Average HPP dalam satuan dasar,
     * serta pencatatan kartu stok (stock_movements).
     *
     * @param  array{
     *     supplier_delivery_note?: string|null,
     *     received_date?: string|null,
     *     notes?: string|null,
     *     items: array<int, array{
     *         purchase_order_item_id: int,
     *         receive_now_qty: int,
     *         free_qty_received?: int|null,
     *         batch_number?: string|null,
     *         expired_date?: string|null
     *     }>
     * }  $data
     */
    public function receiveGoods(PurchaseOrder $po, array $data, User $receivedBy): PurchaseOrderReceipt
    {
        return DB::transaction(function () use ($po, $data, $receivedBy): PurchaseOrderReceipt {
            /** @var PurchaseOrder $lockedPo */
            $lockedPo = PurchaseOrder::where('id', $po->id)
                ->lockForUpdate()
                ->firstOrFail();

            $lockedPo->load(['supplier', 'items.product']);

            if ($lockedPo->isLocked()) {
                throw ValidationException::withMessages([
                    'status' => "PO {$lockedPo->po_number} sudah Lunas dan Diterima Penuh sehingga terkunci permanen.",
                ]);
            }

            if ($lockedPo->status !== PurchaseOrderStatus::Approved) {
                throw ValidationException::withMessages([
                    'status' => "Penerimaan barang hanya dapat dilakukan untuk PO yang sudah disetujui (status saat ini: {$lockedPo->status->label()}).",
                ]);
            }

            if ($lockedPo->receiving_status === ReceivingStatus::Received) {
                throw ValidationException::withMessages([
                    'status' => "Seluruh barang pada PO {$lockedPo->po_number} sudah diterima penuh.",
                ]);
            }

            $itemsPayload = $data['items'] ?? [];
            $keyedItems = $lockedPo->items->keyBy('id');
            $validReceiveRows = [];

            foreach ($itemsPayload as $payload) {
                $itemId = (int) ($payload['purchase_order_item_id'] ?? 0);
                if (! $itemId || ! $keyedItems->has($itemId)) {
                    continue;
                }

                /** @var PurchaseOrderItem $item */
                $item = $keyedItems->get($itemId);
                $qtyNow = (int) ($payload['receive_now_qty'] ?? 0);
                $freeNow = (int) ($payload['free_qty_received'] ?? 0);

                if ($qtyNow < 0 || $freeNow < 0) {
                    throw ValidationException::withMessages([
                        'items' => "Jumlah terima untuk produk {$item->product?->name} tidak boleh negatif.",
                    ]);
                }

                $remainingPaid = max(0, (int) $item->quantity_ordered - (int) $item->quantity_received);
                $remainingFree = max(0, (int) $item->free_qty_ordered - (int) $item->free_qty_received);

                if ($qtyNow > $remainingPaid) {
                    throw ValidationException::withMessages([
                        'items' => "Jumlah terima ({$qtyNow} {$item->unit_name}) untuk {$item->product?->name} melebihi sisa pesanan ({$remainingPaid} {$item->unit_name}).",
                    ]);
                }

                if ($freeNow > $remainingFree) {
                    throw ValidationException::withMessages([
                        'items' => "Jumlah bonus diterima ({$freeNow} {$item->unit_name}) untuk {$item->product?->name} melebihi sisa bonus ({$remainingFree} {$item->unit_name}).",
                    ]);
                }

                if ($qtyNow > 0 || $freeNow > 0) {
                    $validReceiveRows[] = [
                        'item' => $item,
                        'qty_received' => $qtyNow,
                        'free_qty_received' => $freeNow,
                        'batch_number' => ! empty($payload['batch_number']) ? trim((string) $payload['batch_number']) : null,
                        'expired_date' => ! empty($payload['expired_date']) ? (string) $payload['expired_date'] : null,
                    ];
                }
            }

            if (empty($validReceiveRows)) {
                throw ValidationException::withMessages([
                    'items' => 'Minimal satu barang harus memiliki jumlah penerimaan atau bonus lebih dari 0.',
                ]);
            }

            $receivedDate = ! empty($data['received_date'])
                ? (string) $data['received_date']
                : now()->toDateString();

            $deliveryNote = ! empty($data['supplier_delivery_note'])
                ? trim((string) $data['supplier_delivery_note'])
                : null;

            $receipt = PurchaseOrderReceipt::create([
                'purchase_order_id' => $lockedPo->id,
                'supplier_delivery_note' => $deliveryNote,
                'received_date' => $receivedDate,
                'received_by' => $receivedBy->id,
                'notes' => ! empty($data['notes']) ? trim((string) $data['notes']) : null,
            ]);

            $receivedLogDetails = [];

            foreach ($validReceiveRows as $row) {
                /** @var PurchaseOrderItem $item */
                $item = $row['item'];
                $qtyNow = $row['qty_received'];
                $freeNow = $row['free_qty_received'];
                $conversionFactor = max(1, (int) $item->conversion_factor);
                $baseQtyReceived = ($qtyNow + $freeNow) * $conversionFactor;

                // Kunci baris produk dengan lockForUpdate() untuk mencegah race condition stok & HPP
                /** @var Product $product */
                $product = Product::where('id', $item->product_id)->lockForUpdate()->firstOrFail();

                $oldStock = max(0, (int) $product->stock);
                $oldCost = (float) $product->buy_price;

                // Harga bersih per satuan beli setelah diskon item; barang bonus (free_qty) berbiaya Rp 0
                $netUnitCost = (float) $item->net_unit_cost;
                $incomingTotalCost = round($qtyNow * $netUnitCost, 2);
                $effectiveBaseUnitCost = $baseQtyReceived > 0
                    ? round($incomingTotalCost / $baseQtyReceived, 2)
                    : 0.0;

                // Hitung Weighted Average / Moving Average HPP dalam satuan dasar
                $newStock = $oldStock + $baseQtyReceived;
                $newWeightedCost = $newStock > 0
                    ? round((($oldStock * $oldCost) + $incomingTotalCost) / $newStock, 2)
                    : $oldCost;

                $product->stock = $newStock;
                $product->buy_price = $newWeightedCost;
                $product->save();

                // Update akumulasi penerimaan pada item PO
                $item->quantity_received = (int) $item->quantity_received + $qtyNow;
                $item->free_qty_received = (int) $item->free_qty_received + $freeNow;
                $item->base_qty_received = (int) $item->base_qty_received + $baseQtyReceived;
                if ($row['expired_date'] !== null) {
                    $item->expired_date = $row['expired_date'];
                }
                $item->save();

                // Simpan detail item LPB
                $receipt->items()->create([
                    'purchase_order_item_id' => $item->id,
                    'product_id' => $product->id,
                    'unit_name' => $item->unit_name,
                    'conversion_factor' => $conversionFactor,
                    'qty_received' => $qtyNow,
                    'free_qty_received' => $freeNow,
                    'base_qty_received' => $baseQtyReceived,
                    'unit_cost' => $netUnitCost,
                    'base_unit_cost' => $effectiveBaseUnitCost,
                    'batch_number' => $row['batch_number'],
                    'expired_date' => $row['expired_date'],
                ]);

                // Catat kartu stok (stock_movements) polimorfik
                $movementNote = sprintf(
                    'Penerimaan %s (%s): %d%s %s (%d %s)',
                    $receipt->receipt_number,
                    $lockedPo->po_number,
                    $qtyNow,
                    $freeNow > 0 ? " + {$freeNow} bonus" : '',
                    $item->unit_name,
                    $baseQtyReceived,
                    $product->base_unit ?: 'pcs'
                );

                StockMovement::create([
                    'product_id' => $product->id,
                    'type' => StockMovementType::PurchaseIn,
                    'reference_type' => PurchaseOrderReceipt::class,
                    'reference_id' => $receipt->id,
                    'stock_before' => $oldStock,
                    'qty_change' => $baseQtyReceived,
                    'stock_after' => $newStock,
                    'unit_cost' => $newWeightedCost,
                    'notes' => $movementNote,
                    'created_by' => $receivedBy->id,
                ]);

                $receivedLogDetails[] = [
                    'product_name' => $product->name,
                    'unit_name' => $item->unit_name,
                    'conversion_factor' => $conversionFactor,
                    'quantity_received_now' => $qtyNow,
                    'free_qty_received' => $freeNow,
                    'base_qty_received' => $baseQtyReceived,
                    'unit_cost' => $netUnitCost,
                    'old_stock' => $oldStock,
                    'new_stock' => $newStock,
                    'old_buy_price' => $oldCost,
                    'new_weighted_buy_price' => $newWeightedCost,
                    'batch_number' => $row['batch_number'],
                    'expired_date' => $row['expired_date'],
                ];
            }

            // Hitung ulang receiving_status PO
            $lockedPo->refresh();
            $lockedPo->load('items');

            $allCompleted = $lockedPo->items->every(
                fn (PurchaseOrderItem $itm): bool => (int) $itm->quantity_received >= (int) $itm->quantity_ordered
                    && (int) $itm->free_qty_received >= (int) $itm->free_qty_ordered
            );

            $oldReceivingStatus = $lockedPo->receiving_status->value;
            $lockedPo->receiving_status = $allCompleted ? ReceivingStatus::Received : ReceivingStatus::Partial;
            $lockedPo->received_at = now();
            $lockedPo->received_by = $receivedBy->id;

            if (! $lockedPo->due_date && ($lockedPo->supplier?->payment_term_days ?? 0) > 0) {
                $baseDate = $lockedPo->order_date ? Carbon::parse($lockedPo->order_date) : now();
                $lockedPo->due_date = $baseDate->addDays((int) $lockedPo->supplier->payment_term_days)->toDateString();
            }

            $lockedPo->save();

            // Pastikan hutang dagang tersinkron (termasuk due_date / no faktur supplier bila ada)
            $this->financeService->syncPayableForPurchaseOrder($lockedPo, $receivedBy, $deliveryNote);

            activity(ActivityLogCategory::PurchaseOrder->value)
                ->event('updated')
                ->performedOn($lockedPo)
                ->causedBy($receivedBy)
                ->withProperties([
                    'event' => 'goods_received',
                    'po_number' => $lockedPo->po_number,
                    'receipt_number' => $receipt->receipt_number,
                    'supplier_delivery_note' => $deliveryNote,
                    'old_receiving_status' => $oldReceivingStatus,
                    'new_receiving_status' => $lockedPo->receiving_status->value,
                    'received_date' => $receivedDate,
                    'received_by' => $receivedBy->name,
                    'received_items' => $receivedLogDetails,
                ])
                ->log(sprintf(
                    'Penerimaan barang %s untuk PO %s (%s) oleh %s.',
                    $receipt->receipt_number,
                    $lockedPo->po_number,
                    $lockedPo->receiving_status->label(),
                    $receivedBy->name
                ));

            return $receipt->load(['purchaseOrder.supplier', 'items.product', 'receivedBy']);
        });
    }
}

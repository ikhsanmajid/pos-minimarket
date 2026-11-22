<?php

namespace App\Services;

use App\Enums\ActivityLogCategory;
use App\Enums\PaymentStatus;
use App\Enums\PurchaseOrderStatus;
use App\Models\Product;
use App\Models\PurchaseOrder;
use App\Models\PurchaseOrderItem;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class PurchaseOrderService
{
    /**
     * Menghitung diskon, pajak (dari DPP), dan grand total PO.
     * Urutan: Subtotal -> Diskon -> DPP (Subtotal - Diskon) -> Pajak (DPP x %) -> Total (DPP + Pajak).
     *
     * @param  array{discount_type?: string|null, discount_value?: float|int|string|null, tax_percentage?: float|int|string|null}  $data
     * @return array{discount_type: string, discount_value: float, discount_amount: float, tax_percentage: float, tax_amount: float, total_amount: float}
     */
    public function calculateTotals(float $subtotal, array $data): array
    {
        $discountType = ($data['discount_type'] ?? 'fixed') === 'percent' ? 'percent' : 'fixed';
        $discountValue = max(0, (float) ($data['discount_value'] ?? 0));
        $taxPercentage = min(100, max(0, (float) ($data['tax_percentage'] ?? 0)));

        if ($discountType === 'percent') {
            $discountValue = min(100, $discountValue);
            $discountAmount = round($subtotal * ($discountValue / 100), 2);
        } else {
            $discountAmount = round(min($subtotal, $discountValue), 2);
        }

        $taxableAmount = max(0, round($subtotal - $discountAmount, 2));
        $taxAmount = round($taxableAmount * ($taxPercentage / 100), 2);

        return [
            'discount_type' => $discountType,
            'discount_value' => $discountValue,
            'discount_amount' => $discountAmount,
            'tax_percentage' => $taxPercentage,
            'tax_amount' => $taxAmount,
            'total_amount' => round($taxableAmount + $taxAmount, 2),
        ];
    }
    /**
     * Membuat PO baru beserta item-itemnya.
     */
    public function create(array $data, User $creator): PurchaseOrder
    {
        return DB::transaction(function () use ($data, $creator) {
            $itemsData = $data['items'] ?? [];
            if (empty($itemsData)) {
                throw ValidationException::withMessages([
                    'items' => 'Minimal satu produk harus ditambahkan dalam pesanan.',
                ]);
            }

            // Hitung subtotal tiap item dan subtotal PO
            $subtotal = 0;
            $preparedItems = [];
            foreach ($itemsData as $row) {
                $qty = (int) ($row['quantity_ordered'] ?? 0);
                $unitCost = (float) ($row['unit_cost'] ?? 0);
                $itemSubtotal = round($qty * $unitCost, 2);
                $subtotal += $itemSubtotal;

                $preparedItems[] = [
                    'product_id' => $row['product_id'],
                    'quantity_ordered' => $qty,
                    'quantity_received' => 0,
                    'unit_cost' => $unitCost,
                    'subtotal' => $itemSubtotal,
                    'expired_date' => $row['expired_date'] ?? null,
                ];
            }

            $totals = $this->calculateTotals($subtotal, $data);

            $status = isset($data['status'])
                ? PurchaseOrderStatus::from($data['status'])
                : PurchaseOrderStatus::Draft;

            $po = PurchaseOrder::create([
                'po_number' => $data['po_number'] ?? null,
                'supplier_id' => $data['supplier_id'],
                'user_id' => $creator->id,
                'order_date' => $data['order_date'] ?? now()->toDateString(),
                'expected_date' => $data['expected_date'] ?? null,
                'due_date' => $data['due_date'] ?? null,
                'status' => $status,
                'payment_status' => PaymentStatus::Unpaid,
                'subtotal' => $subtotal,
                ...$totals,
                'notes' => $data['notes'] ?? null,
            ]);

            foreach ($preparedItems as $item) {
                $po->items()->create($item);
            }

            activity(ActivityLogCategory::PurchaseOrder->value)
                ->event('created')
                ->performedOn($po)
                ->causedBy($creator)
                ->withProperties([
                    'event' => 'created',
                    'po_number' => $po->po_number,
                    'status' => $po->status->value,
                    'total_amount' => $po->total_amount,
                    'items_count' => count($preparedItems),
                ])
                ->log("Purchase Order {$po->po_number} berhasil dibuat (Status: {$po->status->label()}).");

            return $po->load(['supplier', 'items.product', 'user']);
        });
    }

    /**
     * Memperbarui data dan item PO (hanya jika belum ada barang diterima).
     */
    public function update(PurchaseOrder $po, array $data, User $updater): PurchaseOrder
    {
        return DB::transaction(function () use ($po, $data, $updater) {
            $itemsData = $data['items'] ?? [];
            if (empty($itemsData)) {
                throw ValidationException::withMessages([
                    'items' => 'Minimal satu produk harus ada dalam pesanan.',
                ]);
            }

            $subtotal = 0;
            $preparedItems = [];
            foreach ($itemsData as $row) {
                $qty = (int) ($row['quantity_ordered'] ?? 0);
                $unitCost = (float) ($row['unit_cost'] ?? 0);
                $itemSubtotal = round($qty * $unitCost, 2);
                $subtotal += $itemSubtotal;

                $preparedItems[] = [
                    'product_id' => $row['product_id'],
                    'quantity_ordered' => $qty,
                    'quantity_received' => 0,
                    'unit_cost' => $unitCost,
                    'subtotal' => $itemSubtotal,
                    'expired_date' => $row['expired_date'] ?? null,
                ];
            }

            $totals = $this->calculateTotals($subtotal, $data);

            $status = isset($data['status'])
                ? PurchaseOrderStatus::from($data['status'])
                : $po->status;

            $po->update([
                'supplier_id' => $data['supplier_id'],
                'order_date' => $data['order_date'] ?? $po->order_date,
                'expected_date' => $data['expected_date'] ?? $po->expected_date,
                'due_date' => $data['due_date'] ?? $po->due_date,
                'status' => $status,
                'subtotal' => $subtotal,
                ...$totals,
                'notes' => $data['notes'] ?? $po->notes,
            ]);

            // Hapus dan simpan ulang items
            $po->items()->delete();
            foreach ($preparedItems as $item) {
                $po->items()->create($item);
            }

            activity(ActivityLogCategory::PurchaseOrder->value)
                ->event('updated')
                ->performedOn($po)
                ->causedBy($updater)
                ->withProperties([
                    'event' => 'updated',
                    'po_number' => $po->po_number,
                    'status' => $po->status->value,
                    'total_amount' => $po->total_amount,
                ])
                ->log("Purchase Order {$po->po_number} diperbarui.");

            return $po->load(['supplier', 'items.product', 'user']);
        });
    }

    /**
     * Memproses penerimaan barang (Partial / Full Receiving) & Weighted Average Buy Price.
     */
    public function receiveGoods(PurchaseOrder $po, array $itemsPayload, User $receivedBy): PurchaseOrder
    {
        return DB::transaction(function () use ($po, $itemsPayload, $receivedBy) {
            $po->load(['supplier', 'items.product']);

            // Validasi status PO
            if (in_array($po->status, [PurchaseOrderStatus::Received, PurchaseOrderStatus::Cancelled], true)) {
                throw ValidationException::withMessages([
                    'status' => "PO {$po->po_number} sudah selesai atau dibatalkan.",
                ]);
            }

            $keyedItems = $po->items->keyBy('id');
            $hasAnyReceived = false;
            $receivedLogDetails = [];

            foreach ($itemsPayload as $payload) {
                $itemId = $payload['purchase_order_item_id'] ?? null;
                $receiveNowQty = (int) ($payload['receive_now_qty'] ?? 0);
                $expiredDate = $payload['expired_date'] ?? null;

                if (! $itemId || ! $keyedItems->has($itemId)) {
                    continue;
                }

                /** @var PurchaseOrderItem $item */
                $item = $keyedItems->get($itemId);
                $currentReceived = (int) $item->quantity_received;
                $ordered = (int) $item->quantity_ordered;
                $remaining = max(0, $ordered - $currentReceived);

                if ($receiveNowQty < 0) {
                    throw ValidationException::withMessages([
                        'items' => "Jumlah terima untuk produk {$item->product?->name} tidak boleh negatif.",
                    ]);
                }

                if ($receiveNowQty > $remaining) {
                    throw ValidationException::withMessages([
                        'items' => "Jumlah terima ({$receiveNowQty}) untuk produk {$item->product?->name} melebihi sisa pesanan ({$remaining}).",
                    ]);
                }

                if ($receiveNowQty > 0) {
                    $hasAnyReceived = true;

                    // Kunci baris produk dengan lockForUpdate() untuk mencegah race condition
                    /** @var Product $product */
                    $product = Product::where('id', $item->product_id)->lockForUpdate()->firstOrFail();

                    $oldStock = max(0, (int) $product->stock);
                    $oldCost = (float) $product->buy_price;
                    $incomingQty = $receiveNowQty;
                    $incomingCost = (float) $item->unit_cost;

                    // Hitung Weighted Average Buy Price
                    $totalQty = $oldStock + $incomingQty;
                    $newWeightedCost = $totalQty > 0
                        ? round((($oldStock * $oldCost) + ($incomingQty * $incomingCost)) / $totalQty, 2)
                        : $incomingCost;

                    // Update produk
                    $product->stock = $oldStock + $incomingQty;
                    $product->buy_price = $newWeightedCost;
                    $product->save();

                    // Update item PO
                    $item->quantity_received = $currentReceived + $incomingQty;
                    if (! empty($expiredDate)) {
                        $item->expired_date = $expiredDate;
                    }
                    $item->save();

                    $receivedLogDetails[] = [
                        'item_id' => $item->id,
                        'product_id' => $product->id,
                        'product_name' => $product->name,
                        'barcode' => $product->barcode,
                        'quantity_received_now' => $incomingQty,
                        'total_quantity_received' => $item->quantity_received,
                        'quantity_ordered' => $item->quantity_ordered,
                        'unit_cost' => $incomingCost,
                        'old_stock' => $oldStock,
                        'new_stock' => $product->stock,
                        'old_buy_price' => $oldCost,
                        'new_weighted_buy_price' => $newWeightedCost,
                        'expired_date' => $expiredDate,
                    ];
                }
            }

            if (! $hasAnyReceived) {
                throw ValidationException::withMessages([
                    'items' => 'Minimal ada satu barang dengan jumlah penerimaan lebih dari 0.',
                ]);
            }

            // Refresh items untuk kalkulasi status PO secara akurat
            $po->refresh();
            $po->load('items');

            $allCompleted = true;
            foreach ($po->items as $itm) {
                if ((int) $itm->quantity_received < (int) $itm->quantity_ordered) {
                    $allCompleted = false;
                    break;
                }
            }

            $newStatus = $allCompleted
                ? PurchaseOrderStatus::Received
                : PurchaseOrderStatus::PartiallyReceived;

            $po->status = $newStatus;
            $po->received_at = now();
            $po->received_by = $receivedBy->id;

            // Hitung due_date jika masih kosong dan supplier memiliki tempo
            if (! $po->due_date && $po->supplier?->payment_term_days > 0) {
                $baseDate = $po->order_date ? Carbon::parse($po->order_date) : now();
                $po->due_date = $baseDate->addDays((int) $po->supplier->payment_term_days)->toDateString();
            }

            $po->save();

            // Catat log penerimaan barang secara detail ke activity_log
            activity(ActivityLogCategory::PurchaseOrder->value)
                ->event('updated')
                ->performedOn($po)
                ->causedBy($receivedBy)
                ->withProperties([
                    'event' => 'goods_received',
                    'po_number' => $po->po_number,
                    'status' => $po->status->value,
                    'received_at' => $po->received_at?->format('d M Y H:i:s'),
                    'received_by' => $receivedBy->name,
                    'received_items' => $receivedLogDetails,
                ])
                ->log("Penerimaan barang PO {$po->po_number} (" . ($allCompleted ? 'Selesai / Diterima Penuh' : 'Diterima Sebagian') . ') oleh ' . $receivedBy->name);

            return $po->load(['supplier', 'items.product', 'user', 'receivedBy']);
        });
    }

    /**
     * Menutup sisa pesanan PO yang berstatus partially_received.
     */
    public function closeRemaining(PurchaseOrder $po, User $actor, ?string $reason = null): PurchaseOrder
    {
        return DB::transaction(function () use ($po, $actor, $reason) {
            if ($po->status !== PurchaseOrderStatus::PartiallyReceived) {
                throw ValidationException::withMessages([
                    'status' => 'Hanya PO berstatus Diterima Sebagian yang dapat ditutup sisa pesanannya.',
                ]);
            }

            // Hitung ulang total berdasarkan quantity_received aktual dengan aturan diskon & pajak yang sama
            $newSubtotal = 0;
            foreach ($po->items as $item) {
                $newSubtotal += round((int) $item->quantity_received * (float) $item->unit_cost, 2);
            }

            $totals = $this->calculateTotals($newSubtotal, [
                'discount_type' => $po->discount_type,
                'discount_value' => $po->discount_value,
                'tax_percentage' => $po->tax_percentage,
            ]);
            $newTotal = $totals['total_amount'];

            $oldStatus = $po->status->label();
            $po->status = PurchaseOrderStatus::Received;
            $po->subtotal = $newSubtotal;
            $po->discount_amount = $totals['discount_amount'];
            $po->tax_amount = $totals['tax_amount'];
            $po->total_amount = $newTotal;
            if ($reason) {
                $po->notes = trim(($po->notes ?? '') . "\n[Ditutup: {$reason}]");
            }
            $po->save();

            activity(ActivityLogCategory::PurchaseOrder->value)
                ->event('updated')
                ->performedOn($po)
                ->causedBy($actor)
                ->withProperties([
                    'event' => 'closed_remaining',
                    'po_number' => $po->po_number,
                    'previous_status' => $oldStatus,
                    'new_status' => $po->status->label(),
                    'adjusted_total_amount' => $newTotal,
                    'reason' => $reason,
                ])
                ->log("Sisa pesanan PO {$po->po_number} telah ditutup dan ditandai selesai.");

            return $po->load(['supplier', 'items.product', 'user', 'receivedBy']);
        });
    }

    /**
     * Mengubah status PO dari Draft menjadi Ordered (Dipesan).
     */
    public function markAsOrdered(PurchaseOrder $po, User $actor): PurchaseOrder
    {
        if ($po->status !== PurchaseOrderStatus::Draft) {
            throw ValidationException::withMessages([
                'status' => "PO {$po->po_number} hanya dapat ditandai sebagai Dipesan jika berstatus Draft.",
            ]);
        }

        if (! $po->items()->exists()) {
            throw ValidationException::withMessages([
                'items' => "PO {$po->po_number} belum memiliki item produk.",
            ]);
        }

        $oldStatus = $po->status->label();
        $po->status = PurchaseOrderStatus::Ordered;
        $po->save();

        activity(ActivityLogCategory::PurchaseOrder->value)
            ->event('updated')
            ->performedOn($po)
            ->causedBy($actor)
            ->withProperties([
                'event' => 'status_updated',
                'po_number' => $po->po_number,
                'old_status' => $oldStatus,
                'new_status' => $po->status->label(),
            ])
            ->log("Purchase Order {$po->po_number} ditandai sebagai Dipesan (Ordered).");

        return $po;
    }

    /**
     * Update status pembayaran PO.
     */
    public function updatePaymentStatus(PurchaseOrder $po, PaymentStatus $newPaymentStatus, User $actor): PurchaseOrder
    {
        $oldPaymentStatus = $po->payment_status?->label() ?? 'Belum Dibayar';
        $po->payment_status = $newPaymentStatus;
        $po->save();

        activity(ActivityLogCategory::PurchaseOrder->value)
            ->event('updated')
            ->performedOn($po)
            ->causedBy($actor)
            ->withProperties([
                'event' => 'payment_status_updated',
                'po_number' => $po->po_number,
                'old_payment_status' => $oldPaymentStatus,
                'new_payment_status' => $newPaymentStatus->label(),
            ])
            ->log("Status pembayaran PO {$po->po_number} diubah menjadi {$newPaymentStatus->label()}.");

        return $po;
    }

    /**
     * Membatalkan PO (hanya jika belum ada barang diterima).
     */
    public function cancel(PurchaseOrder $po, User $actor, ?string $reason = null): PurchaseOrder
    {
        if (in_array($po->status, [PurchaseOrderStatus::Received, PurchaseOrderStatus::Cancelled], true)) {
            throw ValidationException::withMessages([
                'status' => "PO {$po->po_number} tidak dapat dibatalkan.",
            ]);
        }

        if ($po->items()->where('quantity_received', '>', 0)->exists()) {
            throw ValidationException::withMessages([
                'status' => "PO {$po->po_number} sudah memiliki barang yang diterima sehingga tidak dapat dibatalkan.",
            ]);
        }

        $po->status = PurchaseOrderStatus::Cancelled;
        if ($reason) {
            $po->notes = trim(($po->notes ?? '') . "\n[Dibatalkan: {$reason}]");
        }
        $po->save();

        activity(ActivityLogCategory::PurchaseOrder->value)
            ->event('updated')
            ->performedOn($po)
            ->causedBy($actor)
            ->withProperties([
                'event' => 'cancelled',
                'po_number' => $po->po_number,
                'reason' => $reason,
            ])
            ->log("Purchase Order {$po->po_number} dibatalkan.");

        return $po;
    }
}

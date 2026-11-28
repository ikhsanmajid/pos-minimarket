<?php

namespace App\Services;

use App\Enums\ActivityLogCategory;
use App\Enums\PaymentMethod;
use App\Enums\SalesReturnStatus;
use App\Enums\StockMovementType;
use App\Enums\TransactionStatus;
use App\Models\CashierShift;
use App\Models\Product;
use App\Models\SalesReturn;
use App\Models\SalesReturnItem;
use App\Models\StockMovement;
use App\Models\Transaction;
use App\Models\TransactionDetail;
use App\Models\User;
use Illuminate\Database\Eloquent\Collection as EloquentCollection;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class SalesReturnService
{
    public function __construct(
        public CashierShiftService $cashierShiftService,
        public FinanceService $financeService,
        public SupervisorPinService $supervisorPinService,
    ) {}

    /**
     * Memproses retur penjualan (parsial atau penuh) dengan otorisasi PIN Supervisor/Admin.
     *
     * @param  array{
     *     refund_method: string,
     *     financial_account_id: int,
     *     reason: string,
     *     supervisor_pin: string,
     *     items: array<int, array{transaction_detail_id: int, qty: int, is_restockable: bool}>
     * }  $data
     */
    public function processReturn(Transaction $transaction, array $data, User $actor): SalesReturn
    {
        $approver = $this->supervisorPinService->verify(
            $data['supervisor_pin'],
            'PIN Supervisor / Admin wajib diisi untuk memproses retur penjualan.'
        );

        return DB::transaction(function () use ($transaction, $data, $actor, $approver): SalesReturn {
            /** @var Transaction $lockedTx */
            $lockedTx = Transaction::query()
                ->where('id', $transaction->id)
                ->lockForUpdate()
                ->firstOrFail();

            if (! in_array($lockedTx->status, [TransactionStatus::Completed, TransactionStatus::PartiallyRefunded], true)) {
                throw ValidationException::withMessages([
                    'status' => "Transaksi {$lockedTx->invoice_number} berstatus {$lockedTx->status->label()} sehingga tidak dapat diretur.",
                ]);
            }

            $lockedTx->load(['details.product:id,name,barcode,base_unit']);
            $detailsMap = $lockedTx->details->keyBy('id');

            // Hitung total qty yang sudah pernah diretur per transaction_detail_id
            $alreadyReturnedMap = SalesReturnItem::query()
                ->whereIn('transaction_detail_id', $lockedTx->details->pluck('id')->all())
                ->selectRaw('transaction_detail_id, COALESCE(SUM(qty), 0) as total_returned')
                ->groupBy('transaction_detail_id')
                ->pluck('total_returned', 'transaction_detail_id')
                ->map(fn ($v): int => (int) $v)
                ->all();

            // Validasi item retur (gabungkan jika detail_id sama muncul lebih dari sekali)
            $requestedQtyByDetail = [];
            $resolvedItems = [];
            $totalRefundAmount = 0.0;

            foreach ($data['items'] as $index => $row) {
                $detailId = (int) $row['transaction_detail_id'];
                /** @var TransactionDetail|null $detail */
                $detail = $detailsMap->get($detailId);

                if (! $detail instanceof TransactionDetail) {
                    throw ValidationException::withMessages([
                        "items.{$index}.transaction_detail_id" => 'Item transaksi tidak ditemukan pada invoice ini.',
                    ]);
                }

                $returnQty = (int) $row['qty'];
                if ($returnQty < 1) {
                    throw ValidationException::withMessages([
                        "items.{$index}.qty" => 'Jumlah retur minimal 1.',
                    ]);
                }

                $purchasedQty = $detail->qty > 0 ? $detail->qty : max(1, (int) $detail->quantity);
                $alreadyReturned = $alreadyReturnedMap[$detailId] ?? 0;
                $newCumulative = $alreadyReturned + ($requestedQtyByDetail[$detailId] ?? 0) + $returnQty;

                if ($newCumulative > $purchasedQty) {
                    $remaining = max(0, $purchasedQty - $alreadyReturned);
                    throw ValidationException::withMessages([
                        "items.{$index}.qty" => sprintf(
                            'Jumlah retur untuk %s melebihi sisa yang dapat diretur (sisa: %d %s).',
                            $detail->product->name ?? 'produk',
                            $remaining,
                            $detail->unit_name_snapshot ?: 'pcs'
                        ),
                    ]);
                }

                $requestedQtyByDetail[$detailId] = ($requestedQtyByDetail[$detailId] ?? 0) + $returnQty;

                $conversionFactor = max(1, (int) $detail->conversion_factor);
                $baseQty = $returnQty * $conversionFactor;
                $effectiveUnitPrice = round((float) $detail->subtotal / $purchasedQty, 2);
                $subtotalRefund = round($effectiveUnitPrice * $returnQty, 2);
                $totalRefundAmount = round($totalRefundAmount + $subtotalRefund, 2);

                $resolvedItems[] = [
                    'detail' => $detail,
                    'qty' => $returnQty,
                    'base_qty' => $baseQty,
                    'conversion_factor' => $conversionFactor,
                    'unit_price_snapshot' => $effectiveUnitPrice,
                    'subtotal_refund' => $subtotalRefund,
                    'is_restockable' => (bool) $row['is_restockable'],
                ];
            }

            // Kunci baris produk secara terurut sebelum update stok
            $productIds = array_values(array_unique(array_map(
                fn (array $item): int => (int) $item['detail']->product_id,
                $resolvedItems
            )));
            sort($productIds);

            /** @var EloquentCollection<int, Product> $lockedProducts */
            $lockedProducts = Product::query()
                ->whereIn('id', $productIds)
                ->orderBy('id')
                ->lockForUpdate()
                ->get()
                ->keyBy('id');

            $activeShift = $this->cashierShiftService->getActiveShiftForUser($actor);
            $shiftId = $activeShift instanceof CashierShift ? $activeShift->id : $lockedTx->cashier_shift_id;
            $returnNumber = $this->generateReturnNumber();
            $refundMethod = PaymentMethod::from((string) $data['refund_method']);
            $reason = trim($data['reason']);

            $salesReturn = SalesReturn::create([
                'return_number' => $returnNumber,
                'transaction_id' => $lockedTx->id,
                'cashier_shift_id' => $shiftId,
                'processed_by' => $actor->id,
                'approved_by' => $approver->id,
                'status' => SalesReturnStatus::Completed,
                'refund_method' => $refundMethod,
                'financial_account_id' => (int) $data['financial_account_id'],
                'total_refund_amount' => $totalRefundAmount,
                'reason' => $reason,
            ]);

            $logItems = [];

            foreach ($resolvedItems as $item) {
                /** @var TransactionDetail $detail */
                $detail = $item['detail'];

                SalesReturnItem::create([
                    'sales_return_id' => $salesReturn->id,
                    'transaction_detail_id' => $detail->id,
                    'product_id' => $detail->product_id,
                    'product_unit_id' => $detail->product_unit_id,
                    'unit_name_snapshot' => $detail->unit_name_snapshot ?: 'pcs',
                    'conversion_factor' => $item['conversion_factor'],
                    'qty' => $item['qty'],
                    'base_qty' => $item['base_qty'],
                    'unit_price_snapshot' => $item['unit_price_snapshot'],
                    'subtotal_refund' => $item['subtotal_refund'],
                    'is_restockable' => $item['is_restockable'],
                ]);

                /** @var Product|null $product */
                $product = $lockedProducts->get($detail->product_id);
                if ($item['is_restockable'] && $product instanceof Product) {
                    $stockBefore = (int) $product->stock;
                    $stockAfter = $stockBefore + $item['base_qty'];

                    $product->stock = $stockAfter;
                    $product->save();

                    StockMovement::create([
                        'product_id' => $product->id,
                        'type' => StockMovementType::SaleReturn,
                        'reference_type' => SalesReturn::class,
                        'reference_id' => $salesReturn->id,
                        'stock_before' => $stockBefore,
                        'qty_change' => $item['base_qty'],
                        'stock_after' => $stockAfter,
                        'unit_cost' => (float) $detail->cost_price_snapshot > 0 ? $detail->cost_price_snapshot : $detail->buy_price,
                        'notes' => "Retur Penjualan {$returnNumber} ({$lockedTx->invoice_number}): {$reason}",
                        'created_by' => $actor->id,
                    ]);
                }

                $logItems[] = [
                    'product_name' => $detail->product->name ?? "Produk #{$detail->product_id}",
                    'unit_name' => $detail->unit_name_snapshot ?: 'pcs',
                    'qty' => $item['qty'],
                    'base_qty' => $item['base_qty'],
                    'subtotal_refund' => $item['subtotal_refund'],
                    'is_restockable' => $item['is_restockable'] ? 'Layak Jual (Restock)' : 'Rusak (Tidak Masuk Stok)',
                ];
            }

            // Catat pengeluaran refund melalui FinanceService
            $this->financeService->recordSalesReturnRefund($salesReturn, $lockedTx, $actor);

            // Tentukan status terbaru transaksi: refunded jika seluruh item sudah habis diretur, selain itu partially_refunded
            $allFullyReturned = true;
            foreach ($lockedTx->details as $detail) {
                $purchasedQty = $detail->qty > 0 ? $detail->qty : max(1, (int) $detail->quantity);
                $totalReturnedForDetail = ($alreadyReturnedMap[$detail->id] ?? 0) + ($requestedQtyByDetail[$detail->id] ?? 0);
                if ($totalReturnedForDetail < $purchasedQty) {
                    $allFullyReturned = false;
                    break;
                }
            }

            $oldStatus = $lockedTx->status->value;
            $newStatus = $allFullyReturned ? TransactionStatus::Refunded : TransactionStatus::PartiallyRefunded;
            $lockedTx->update(['status' => $newStatus]);

            // Catat Activity Log pada transaksi terkait
            activity(ActivityLogCategory::Transaction->value)
                ->event('returned')
                ->performedOn($lockedTx)
                ->causedBy($actor)
                ->withProperties([
                    'return_number' => $returnNumber,
                    'invoice_number' => $lockedTx->invoice_number,
                    'old_status' => $oldStatus,
                    'new_status' => $newStatus->value,
                    'refund_method' => $refundMethod->label(),
                    'total_refund_amount' => $totalRefundAmount,
                    'reason' => $reason,
                    'approved_by' => $approver->name,
                    'returned_items' => $logItems,
                ])
                ->log(sprintf(
                    'Retur %s untuk transaksi %s sebesar Rp %s diproses oleh %s (Disetujui: %s).',
                    $returnNumber,
                    $lockedTx->invoice_number,
                    number_format($totalRefundAmount, 0, ',', '.'),
                    $actor->name,
                    $approver->name
                ));

            return $salesReturn->load([
                'items.product:id,name,barcode,base_unit',
                'processor:id,name',
                'approver:id,name',
                'financialAccount:id,code,name,type',
            ]);
        });
    }

    private function generateReturnNumber(): string
    {
        $dateStr = now()->format('Ymd');
        $prefix = "RET-{$dateStr}-";

        $latest = SalesReturn::query()
            ->where('return_number', 'like', "{$prefix}%")
            ->orderByDesc('return_number')
            ->lockForUpdate()
            ->value('return_number');

        $nextNumber = $latest ? ((int) substr((string) $latest, strlen($prefix)) + 1) : 1;

        return sprintf('%s%04d', $prefix, $nextNumber);
    }
}

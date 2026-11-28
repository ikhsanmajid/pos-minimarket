<?php

namespace App\Services;

use App\Enums\ActivityLogCategory;
use App\Enums\PaymentMethod;
use App\Enums\PromotionType;
use App\Enums\SalesReturnStatus;
use App\Enums\StockMovementType;
use App\Enums\TransactionStatus;
use App\Models\AppliedPromotion;
use App\Models\CashierShift;
use App\Models\Product;
use App\Models\SalesReturn;
use App\Models\SalesReturnItem;
use App\Models\StockMovement;
use App\Models\Transaction;
use App\Models\TransactionDetail;
use App\Models\User;
use App\Support\PricingMath;
use Illuminate\Database\Eloquent\Collection as EloquentCollection;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class SalesReturnService
{
    public function __construct(
        public CashierShiftService $cashierShiftService,
        public FinanceService $financeService,
        public SupervisorPinService $supervisorPinService,
        public LoyaltyService $loyaltyService,
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

            $lockedTx->load(['details.product:id,name,barcode,base_unit,category_id', 'appliedPromotions']);
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

                if ($detail->is_donation) {
                    throw ValidationException::withMessages([
                        "items.{$index}.transaction_detail_id" => 'Item donasi tidak dapat diretur.',
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

                // Hitung nilai bayar efektif baris (setelah alokasi diskon header) dan hormati free_qty BxGy
                $netLinePaid = max(0, PricingMath::toRupiah($detail->subtotal) - PricingMath::toRupiah($detail->allocated_header_discount));
                $freeQty = max(0, (int) ($detail->free_qty ?? 0));
                $paidQty = max(0, $purchasedQty - $freeQty);

                if ($paidQty === 0) {
                    $effectiveUnitPrice = 0.0;
                    $subtotalRefund = 0.0;
                } else {
                    $paidAlreadyReturned = min($alreadyReturned, $paidQty);
                    $remainingPaidQty = max(0, $paidQty - $paidAlreadyReturned);
                    $refundableQty = min($returnQty, $remainingPaidQty);
                    $effectiveUnitPrice = round($netLinePaid / $paidQty, 2);
                    $subtotalRefund = $refundableQty > 0
                        ? (float) PricingMath::floorRupiah(($netLinePaid * $refundableQty) / $paidQty)
                        : 0.0;
                }

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

            // Hitung apakah seluruh item non-donasi sudah habis diretur (retur penuh vs parsial)
            $allFullyReturned = true;
            foreach ($lockedTx->details as $detail) {
                if ($detail->is_donation) {
                    continue;
                }
                $purchasedQty = $detail->qty > 0 ? $detail->qty : max(1, (int) $detail->quantity);
                $totalReturnedForDetail = ($alreadyReturnedMap[$detail->id] ?? 0) + ($requestedQtyByDetail[$detail->id] ?? 0);
                if ($totalReturnedForDetail < $purchasedQty) {
                    $allFullyReturned = false;
                    break;
                }
            }

            // Potong refund sebesar manfaat voucher & promo (bundle/mix-match/min_spend/tebus_murah) yang hilang pada retur parsial
            $voucherClawbackAmount = 0.0;
            $promoClawbackAmount = 0.0;
            if (! $allFullyReturned) {
                $voucherClawbackAmount = $this->applyVoucherClawbackForPartialReturn(
                    $lockedTx,
                    $alreadyReturnedMap,
                    $requestedQtyByDetail,
                    $totalRefundAmount
                );

                if ($voucherClawbackAmount > 0.0) {
                    $totalRefundAmount = round(max(0.0, $totalRefundAmount - $voucherClawbackAmount), 2);
                }

                $promoClawbackAmount = $this->applyPromotionClawbackForPartialReturn(
                    $lockedTx,
                    $alreadyReturnedMap,
                    $requestedQtyByDetail,
                    $totalRefundAmount
                );

                if ($promoClawbackAmount > 0.0) {
                    $totalRefundAmount = round(max(0.0, $totalRefundAmount - $promoClawbackAmount), 2);
                }
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

            // Catat pengeluaran refund melalui FinanceService (hanya jika nominal refund > 0)
            if ($totalRefundAmount > 0.0) {
                $this->financeService->recordSalesReturnRefund($salesReturn, $lockedTx, $actor);
            }

            $oldStatus = $lockedTx->status->value;
            $newStatus = $allFullyReturned ? TransactionStatus::Refunded : TransactionStatus::PartiallyRefunded;
            $lockedTx->update(['status' => $newStatus]);

            // Tarik kembali poin perolehan secara proporsional terhadap nilai item eligible yang diretur
            $pointsReversed = $this->loyaltyService->reverseForSalesReturn(
                $lockedTx,
                $salesReturn,
                $resolvedItems,
                $allFullyReturned,
                $actor
            );

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
                    'voucher_clawback_amount' => $voucherClawbackAmount,
                    'promo_clawback_amount' => $promoClawbackAmount,
                    'points_reversed' => $pointsReversed,
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

    /**
     * Jika retur parsial menyebabkan sisa belanja eligible tidak lagi memenuhi syarat voucher
     * (berdasarkan snapshot applied_promotions), potong refund sebesar manfaat voucher yang tersisa pada item lain.
     *
     * @param  array<int, int>  $alreadyReturnedMap
     * @param  array<int, int>  $requestedQtyByDetail
     */
    private function applyVoucherClawbackForPartialReturn(
        Transaction $transaction,
        array $alreadyReturnedMap,
        array $requestedQtyByDetail,
        float $currentTotalRefund
    ): float {
        $totalClawback = 0;

        foreach ($transaction->appliedPromotions as $appliedPromo) {
            if (! $appliedPromo instanceof AppliedPromotion || $appliedPromo->voucher_id === null) {
                continue;
            }

            $meta = is_array($appliedPromo->meta) ? $appliedPromo->meta : [];
            if (! empty($meta['voucher_clawback_applied'])) {
                continue;
            }

            $minSpend = (int) ($meta['min_spend'] ?? 0);
            $voucherType = (string) ($meta['voucher_type'] ?? '');
            $freeProductId = isset($meta['free_product_id']) ? (int) $meta['free_product_id'] : null;
            $applicableSkus = is_array($meta['applicable_skus'] ?? null)
                ? array_map(fn (mixed $v): string => strtoupper(trim((string) $v)), $meta['applicable_skus'])
                : [];
            $applicableCategories = is_array($meta['applicable_categories'] ?? null)
                ? array_map(fn (mixed $v): int => (int) $v, $meta['applicable_categories'])
                : [];
            $excludedSkus = is_array($meta['excluded_skus'] ?? null)
                ? array_map(fn (mixed $v): string => strtoupper(trim((string) $v)), $meta['excluded_skus'])
                : [];
            $excludedCategories = is_array($meta['excluded_categories'] ?? null)
                ? array_map(fn (mixed $v): int => (int) $v, $meta['excluded_categories'])
                : [];
            $voucherAllocations = is_array($meta['voucher_allocations'] ?? null)
                ? $meta['voucher_allocations']
                : [];

            $remainingEligibleSpend = 0;
            $remainingFreeProductQty = 0;
            $remainingVoucherBenefit = 0;

            foreach ($transaction->details as $detail) {
                if ($detail->is_donation) {
                    continue;
                }

                $purchasedQty = $detail->qty > 0 ? $detail->qty : max(1, (int) $detail->quantity);
                $returnedAfterThis = ($alreadyReturnedMap[$detail->id] ?? 0) + ($requestedQtyByDetail[$detail->id] ?? 0);
                $remainingQty = max(0, $purchasedQty - $returnedAfterThis);

                if ($remainingQty <= 0) {
                    continue;
                }

                $allocatedForDetail = (int) ($voucherAllocations[(string) $detail->id] ?? $voucherAllocations[$detail->id] ?? 0);
                if ($allocatedForDetail > 0) {
                    $remainingVoucherBenefit += PricingMath::floorRupiah(($allocatedForDetail * $remainingQty) / $purchasedQty);
                }

                if ($detail->is_promo_excluded) {
                    continue;
                }

                if ($freeProductId !== null && $detail->product_id === $freeProductId) {
                    $remainingFreeProductQty += $remainingQty;
                }

                $barcode = strtoupper(trim((string) ($detail->product->barcode ?? '')));
                $productIdStr = (string) $detail->product_id;
                $categoryId = $detail->product?->category_id !== null ? (int) $detail->product->category_id : null;

                if (! empty($excludedSkus) && (in_array($barcode, $excludedSkus, true) || in_array($productIdStr, $excludedSkus, true))) {
                    continue;
                }
                if ($categoryId !== null && ! empty($excludedCategories) && in_array($categoryId, $excludedCategories, true)) {
                    continue;
                }
                if (! empty($applicableSkus) && ! in_array($barcode, $applicableSkus, true) && ! in_array($productIdStr, $applicableSkus, true)) {
                    continue;
                }
                if (! empty($applicableCategories) && ($categoryId === null || ! in_array($categoryId, $applicableCategories, true))) {
                    continue;
                }

                $lineSubtotal = PricingMath::toRupiah($detail->subtotal);
                $remainingEligibleSpend += PricingMath::floorRupiah(($lineSubtotal * $remainingQty) / $purchasedQty);
            }

            $violatesMinSpend = $minSpend > 0 && $remainingEligibleSpend < $minSpend;
            $violatesFreeItem = $voucherType === 'free_item' && $freeProductId !== null && $remainingFreeProductQty <= 0;

            if (($violatesMinSpend || $violatesFreeItem) && $remainingVoucherBenefit > 0) {
                $availableRefund = max(0, PricingMath::toRupiah($currentTotalRefund) - $totalClawback);
                $clawback = min($availableRefund, $remainingVoucherBenefit);
                $totalClawback += $clawback;

                $meta['voucher_clawback_applied'] = true;
                $meta['voucher_clawback_amount'] = $clawback;
                $appliedPromo->update(['meta' => $meta]);
            }
        }

        return (float) $totalClawback;
    }

    /**
     * Hitung ulang manfaat promo bundel/mix-match serta syarat min_spend/tebus_murah pada retur parsial
     * berdasarkan snapshot applied_promotions; potong refund sesuai selisih manfaat yang hilang.
     *
     * @param  array<int, int>  $alreadyReturnedMap
     * @param  array<int, int>  $requestedQtyByDetail
     */
    private function applyPromotionClawbackForPartialReturn(
        Transaction $transaction,
        array $alreadyReturnedMap,
        array $requestedQtyByDetail,
        float $currentTotalRefund
    ): float {
        $totalClawback = 0;

        foreach ($transaction->appliedPromotions as $appliedPromo) {
            if (! $appliedPromo instanceof AppliedPromotion || $appliedPromo->promotion_id === null) {
                continue;
            }

            $meta = is_array($appliedPromo->meta) ? $appliedPromo->meta : [];

            // 1. Retur item Bundel / Mix & Match
            if (in_array($appliedPromo->type, [PromotionType::Bundle->value, PromotionType::MixMatch->value], true)) {
                $snapshot = is_array($meta['snapshot'] ?? null) ? $meta['snapshot'] : [];
                $detailAllocations = is_array($meta['detail_allocations'] ?? null) ? $meta['detail_allocations'] : [];
                $detailProducts = is_array($meta['detail_products'] ?? null) ? $meta['detail_products'] : [];
                $alreadyClawedBack = (int) ($meta['clawback_applied_amount'] ?? 0);

                if (empty($snapshot) || empty($detailAllocations)) {
                    continue;
                }

                // Hitung sisa qty per detail & per product_id serta diskon bundel yang masih melekat pada item tersisa
                $remainingQtyByProduct = [];
                $remainingUnitPrices = [];
                $retainedDiscountOnRemaining = 0;
                $totalRemainingParticipatingQty = 0;

                foreach ($transaction->details as $detail) {
                    $detKey = (string) $detail->id;
                    if (! isset($detailAllocations[$detKey]) && ! isset($detailAllocations[$detail->id])) {
                        continue;
                    }

                    $purchasedQty = $detail->qty > 0 ? $detail->qty : max(1, (int) $detail->quantity);
                    $returnedAfterThis = ($alreadyReturnedMap[$detail->id] ?? 0) + ($requestedQtyByDetail[$detail->id] ?? 0);
                    $remainingQty = max(0, $purchasedQty - $returnedAfterThis);

                    if ($remainingQty <= 0) {
                        continue;
                    }

                    $origAlloc = (int) ($detailAllocations[$detKey] ?? $detailAllocations[$detail->id] ?? 0);
                    $retainedDiscountOnRemaining += PricingMath::floorRupiah(($origAlloc * $remainingQty) / $purchasedQty);

                    $pid = (int) ($detailProducts[$detKey]['product_id'] ?? $detail->product_id);
                    $unitPrice = (int) ($detailProducts[$detKey]['unit_price'] ?? PricingMath::toRupiah($detail->unit_price));
                    $remainingQtyByProduct[$pid] = ($remainingQtyByProduct[$pid] ?? 0) + $remainingQty;
                    $totalRemainingParticipatingQty += $remainingQty;

                    for ($i = 0; $i < $remainingQty; $i++) {
                        $remainingUnitPrices[] = $unitPrice;
                    }
                }

                $entitledRemainingDiscount = 0;
                if (($snapshot['kind'] ?? '') === 'bundle') {
                    $bundleItems = is_array($snapshot['bundle_items'] ?? null) ? $snapshot['bundle_items'] : [];
                    $discountPerSet = (int) ($snapshot['discount_per_set'] ?? 0);
                    $intactSets = PHP_INT_MAX;

                    foreach ($bundleItems as $bItem) {
                        $pid = (int) ($bItem['product_id'] ?? 0);
                        $reqQty = max(1, (int) ($bItem['required_qty'] ?? 1));
                        $avail = $remainingQtyByProduct[$pid] ?? 0;
                        $intactSets = min($intactSets, intdiv($avail, $reqQty));
                    }

                    if ($intactSets === PHP_INT_MAX || $intactSets < 0) {
                        $intactSets = 0;
                    }

                    $entitledRemainingDiscount = $intactSets * $discountPerSet;
                } elseif (($snapshot['kind'] ?? '') === 'mix_match') {
                    $packQty = max(2, (int) ($snapshot['buy_qty'] ?? 2));
                    $intactSets = intdiv($totalRemainingParticipatingQty, $packQty);

                    if ($intactSets > 0) {
                        rsort($remainingUnitPrices);
                        $bundledUnits = array_slice($remainingUnitPrices, 0, $intactSets * $packQty);
                        $normalCost = array_sum($bundledUnits);
                        $bundlePrice = (int) ($snapshot['bundle_price'] ?? 0);
                        $discVal = (float) ($snapshot['discount_value'] ?? 0);
                        $maxDisc = isset($snapshot['max_discount_amount']) && $snapshot['max_discount_amount'] !== null
                            ? (int) $snapshot['max_discount_amount']
                            : null;

                        if ($bundlePrice > 0) {
                            $entitledRemainingDiscount = max(0, $normalCost - ($intactSets * $bundlePrice));
                        } elseif ($discVal <= 100.0) {
                            $entitledRemainingDiscount = PricingMath::percentageDiscount($normalCost, $discVal, $maxDisc);
                        } else {
                            $entitledRemainingDiscount = min($normalCost, $intactSets * PricingMath::toRupiah($discVal));
                        }
                    }
                }

                $lostBenefit = max(0, $retainedDiscountOnRemaining - $entitledRemainingDiscount - $alreadyClawedBack);
                if ($lostBenefit > 0) {
                    $availableRefund = max(0, PricingMath::toRupiah($currentTotalRefund) - $totalClawback);
                    $clawback = min($availableRefund, $lostBenefit);
                    $totalClawback += $clawback;

                    $meta['clawback_applied_amount'] = $alreadyClawedBack + $clawback;
                    $appliedPromo->update(['meta' => $meta]);
                }

                continue;
            }

            // 2. Retur yang membuat min_spend_* atau tebus_murah tidak lagi memenuhi syarat
            if (in_array($appliedPromo->type, [
                PromotionType::MinSpendDiscount->value,
                PromotionType::MinSpendPercent->value,
                PromotionType::TebusMurah->value,
            ], true)) {
                if (! empty($meta['clawback_applied'])) {
                    continue;
                }

                $minSpend = (int) ($meta['min_purchase_amount'] ?? 0);
                if ($minSpend <= 0) {
                    continue;
                }

                $rewardDetailId = isset($meta['reward_detail_id']) ? (int) $meta['reward_detail_id'] : null;
                $detailAllocations = is_array($meta['detail_allocations'] ?? null) ? $meta['detail_allocations'] : [];

                $remainingEligibleSpend = 0;
                $retainedBenefit = 0;

                foreach ($transaction->details as $detail) {
                    if ($detail->is_donation) {
                        continue;
                    }

                    $purchasedQty = $detail->qty > 0 ? $detail->qty : max(1, (int) $detail->quantity);
                    $returnedAfterThis = ($alreadyReturnedMap[$detail->id] ?? 0) + ($requestedQtyByDetail[$detail->id] ?? 0);
                    $remainingQty = max(0, $purchasedQty - $returnedAfterThis);

                    if ($remainingQty <= 0) {
                        continue;
                    }

                    if ($appliedPromo->type === PromotionType::TebusMurah->value) {
                        if ($rewardDetailId !== null && $detail->id === $rewardDetailId) {
                            // Item tebus murah tidak dihitung ke min_spend, dan manfaatnya masih dipegang pembeli jika tidak diretur
                            $retainedBenefit = PricingMath::toRupiah($appliedPromo->discount_amount);

                            continue;
                        }
                    } else {
                        $alloc = (int) ($detailAllocations[(string) $detail->id] ?? $detailAllocations[$detail->id] ?? 0);
                        if ($alloc > 0) {
                            $retainedBenefit += PricingMath::floorRupiah(($alloc * $remainingQty) / $purchasedQty);
                        }
                    }

                    if ($detail->is_promo_excluded) {
                        continue;
                    }

                    $lineSub = PricingMath::toRupiah($detail->subtotal);
                    $remainingEligibleSpend += PricingMath::floorRupiah(($lineSub * $remainingQty) / $purchasedQty);
                }

                if ($remainingEligibleSpend < $minSpend && $retainedBenefit > 0) {
                    $availableRefund = max(0, PricingMath::toRupiah($currentTotalRefund) - $totalClawback);
                    $clawback = min($availableRefund, $retainedBenefit);
                    $totalClawback += $clawback;

                    $meta['clawback_applied'] = true;
                    $meta['clawback_amount'] = $clawback;
                    $appliedPromo->update(['meta' => $meta]);
                }
            }
        }

        return (float) $totalClawback;
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

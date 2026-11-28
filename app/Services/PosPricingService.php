<?php

namespace App\Services;

use App\Enums\PaymentMethod;
use App\Enums\ProductTaxMode;
use App\Enums\PromotionFunding;
use App\Enums\PromotionScope;
use App\Enums\PromotionType;
use App\Models\Customer;
use App\Models\Product;
use App\Models\ProductPriceTier;
use App\Models\ProductUnit;
use App\Models\Promotion;
use App\Models\PromotionDailyUsage;
use App\Models\PurchaseOrderReceiptItem;
use App\Support\PricingMath;
use Carbon\CarbonInterface;
use Illuminate\Database\Eloquent\Collection as EloquentCollection;
use Illuminate\Support\Carbon;

class PosPricingService
{
    public function __construct(
        public StoreSettingService $storeSettingService,
        public VoucherService $voucherService,
        public LoyaltyService $loyaltyService,
    ) {}

    /**
     * Evaluasi keranjang belanja POS secara deterministik di server mengikuti urutan 12 langkah:
     * 1. Harga dasar -> 2. Harga member (hook F4) -> 3. Item-level (Best Price grosir vs promo + bundle/mix-match/nth/near-expiry)
     * -> 4. Diskon manual item -> 5. Promo transaksi (min_spend, tebus_murah, GWP, cashback) -> 6. Voucher
     * -> 7. Diskon nota manual -> 8. Promo metode bayar (payment_promo + BIN + split payment + kuota harian)
     * -> 9. Redeem poin (hook F4) -> 10. PPN per produk -> 11. Pembulatan khusus tunai -> 12. Poin diperoleh (hook F4).
     *
     * Konvensi prioritas promo: penghematan terbesar menang; jika seri, priority tertinggi lalu id terkecil.
     *
     * @param  array<int, array{
     *     product_id: int,
     *     product_unit_id?: int|null,
     *     qty: int|float,
     *     discount_amount?: float|int|string|null,
     *     expired_date?: string|null
     * }>  $items
     * @param  array<int, array{
     *     payment_method: string,
     *     amount?: float|int|string|null,
     *     card_bin?: string|null,
     *     reference_number?: string|null
     * }>  $payments
     * @return array<string, mixed>
     */
    public function evaluateCart(
        array $items,
        ?int $customerId = null,
        ?CarbonInterface $at = null,
        int|float $transactionDiscount = 0,
        bool $hasCashPayment = true,
        ?string $voucherCode = null,
        ?string $reservationToken = null,
        ?int $storeId = null,
        string $channel = 'pos',
        array $payments = [],
        ?int $selectedTebusMurahPromotionId = null,
        array $vouchers = [],
        int $redeemPoints = 0
    ): array {
        $referenceAt = ($at ?? now())->copy();
        $tz = (string) config('pos_promotions.timezone', 'Asia/Jakarta');
        $usageDate = $referenceAt->copy()->timezone($tz)->toDateString();

        $voucherEntries = [];
        if (! empty($vouchers)) {
            foreach ($vouchers as $vRow) {
                $vCode = trim((string) ($vRow['code'] ?? ''));
                if ($vCode !== '') {
                    $voucherEntries[] = [
                        'code' => $vCode,
                        'reservation_token' => isset($vRow['reservation_token']) && trim((string) $vRow['reservation_token']) !== ''
                            ? trim((string) $vRow['reservation_token'])
                            : null,
                    ];
                }
            }
        } elseif ($voucherCode !== null && trim($voucherCode) !== '') {
            $voucherEntries[] = [
                'code' => trim($voucherCode),
                'reservation_token' => $reservationToken !== null && trim($reservationToken) !== ''
                    ? trim($reservationToken)
                    : null,
            ];
        }

        if (empty($items)) {
            $emptyVouchers = array_map(fn (array $entry): array => [
                'applied' => false,
                'auto_removed' => true,
                'voucher_id' => null,
                'code' => $this->voucherService->normalizeCode($entry['code']),
                'reservation_token' => $entry['reservation_token'],
                'name' => null,
                'type' => null,
                'type_label' => null,
                'funding' => null,
                'min_spend' => 0,
                'discount_amount' => 0,
                'error_code' => 'VOUCHER_NO_ELIGIBLE_ITEM',
                'message' => 'Keranjang belanja kosong sehingga voucher dilepas otomatis.',
                'applicable_skus' => null,
                'applicable_categories' => null,
                'excluded_skus' => null,
                'excluded_categories' => null,
                'free_product_id' => null,
            ], $voucherEntries);
            $emptyVoucher = $emptyVouchers[0] ?? null;

            /** @var Customer|null $emptyCustomer */
            $emptyCustomer = $customerId !== null
                ? Customer::query()->where('id', $customerId)->where('is_active', true)->first()
                : null;
            $emptyBalance = $emptyCustomer instanceof Customer
                ? $this->loyaltyService->getActivePointBalance($emptyCustomer, $referenceAt)
                : 0;

            return [
                'evaluated_at' => $referenceAt->toIso8601String(),
                'items' => [],
                'summary' => [
                    'gross_subtotal' => 0,
                    'member_discount_total' => 0,
                    'auto_discount_total' => 0,
                    'manual_item_discount_total' => 0,
                    'item_discount_total' => 0,
                    'transaction_promo_discount_total' => 0,
                    'voucher_discount_total' => 0,
                    'transaction_discount' => 0,
                    'payment_promo_discount_total' => 0,
                    'cashback_total' => 0,
                    'manual_discount_total' => 0,
                    'total_discount' => 0,
                    'eligible_subtotal_after_item_auto' => 0,
                    'net_subtotal' => 0,
                    'taxable_amount' => 0,
                    'tax_exempt_amount' => 0,
                    'tax_amount' => 0,
                    'rounding_amount' => 0,
                    'grand_total' => 0,
                    'points_redeemed' => 0,
                    'points_redeem_amount' => 0,
                    'net_payable_after_points' => 0,
                    'estimated_points_earned' => 0,
                    'total_items_qty' => 0,
                    'has_tax_exempt_items' => false,
                ],
                'loyalty' => [
                    'customer_id' => $emptyCustomer?->id,
                    'tier' => $emptyCustomer?->tier?->value,
                    'tier_label' => $emptyCustomer?->tier?->label(),
                    'tier_multiplier' => $emptyCustomer?->tier?->multiplier() ?? 1.0,
                    'active_point_balance' => $emptyBalance,
                    'max_redeemable_points' => 0,
                    'max_redeemable_amount' => 0,
                    'points_redeemed' => 0,
                    'points_redeem_amount' => 0,
                    'net_payable_after_points' => 0,
                    'estimated_points_earned' => 0,
                    'is_birthday' => $this->loyaltyService->isCustomerBirthday($emptyCustomer, $referenceAt),
                    'is_first_purchase' => $this->loyaltyService->isCustomerFirstPurchase($emptyCustomer),
                ],
                'voucher' => $emptyVoucher,
                'vouchers' => $emptyVouchers,
                'voucher_line_allocations' => [],
                'bundle_promotions' => [],
                'transaction_promotion' => null,
                'transaction_promo_line_allocations' => [],
                'tebus_murah_offers' => [],
                'applied_tebus_murah' => null,
                'gift_with_purchase_offers' => [],
                'applied_gifts' => [],
                'cashback_promotions' => [],
                'payment_promotion' => null,
                'payment_promo_line_allocations' => [],
                'promotion_quota_usage' => [],
                'promotion_daily_usage_plan' => [],
            ];
        }

        // Jika payments dikirim, turunkan hasCashPayment dari metode pembayaran yang aktif
        if (! empty($payments)) {
            $hasCashPayment = false;
            foreach ($payments as $pRow) {
                if ((string) ($pRow['payment_method'] ?? '') === PaymentMethod::Cash->value) {
                    $hasCashPayment = true;
                    break;
                }
            }
        }

        $productIds = array_values(array_unique(array_map(
            fn (array $item): int => (int) $item['product_id'],
            $items
        )));

        /** @var EloquentCollection<int, Product> $productsMap */
        $productsMap = Product::query()
            ->whereIn('id', $productIds)
            ->with([
                'category:id,name,slug,is_promo_excluded',
                'activePriceTiers',
                'activeMemberPrices',
            ])
            ->get()
            ->keyBy('id');

        $unitIds = array_values(array_unique(array_filter(array_map(
            fn (array $item): ?int => isset($item['product_unit_id']) ? (int) $item['product_unit_id'] : null,
            $items
        ))));

        /** @var EloquentCollection<int, ProductUnit> $unitsMap */
        $unitsMap = ! empty($unitIds)
            ? ProductUnit::query()->whereIn('id', $unitIds)->get()->keyBy('id')
            : new EloquentCollection;

        // Batch query tanggal kedaluwarsa terdekat (belum expired) untuk promo near_expiry
        $nearestExpiryByProduct = PurchaseOrderReceiptItem::query()
            ->whereIn('product_id', $productIds)
            ->whereNotNull('expired_date')
            ->whereDate('expired_date', '>=', $usageDate)
            ->selectRaw('product_id, MIN(expired_date) as nearest_expiry')
            ->groupBy('product_id')
            ->pluck('nearest_expiry', 'product_id')
            ->map(fn (mixed $v): string => (string) $v)
            ->all();

        /** @var Customer|null $activeCustomer */
        $activeCustomer = $customerId !== null
            ? Customer::query()->where('id', $customerId)->where('is_active', true)->first()
            : null;
        $isValidMember = $activeCustomer instanceof Customer;
        $isCustomerBirthday = $this->loyaltyService->isCustomerBirthday($activeCustomer, $referenceAt);
        $isCustomerFirstPurchase = $this->loyaltyService->isCustomerFirstPurchase($activeCustomer);

        // Muat seluruh promo aktif (item-level, transaction-level, payment-level) dalam 1 query
        /** @var EloquentCollection<int, Promotion> $allActivePromotions */
        $allActivePromotions = Promotion::query()
            ->currentlyActive($referenceAt)
            ->with([
                'products:id',
                'categories:id',
                'bundleItems',
                'rewardProduct:id,name,barcode,base_unit,sell_price,stock,active,is_promo_excluded,is_donation',
            ])
            ->orderByDesc('priority')
            ->orderBy('id')
            ->get()
            ->filter(function (Promotion $promo) use ($referenceAt, $isValidMember, $isCustomerBirthday, $isCustomerFirstPurchase): bool {
                if ($promo->member_only && ! $isValidMember) {
                    return false;
                }

                if ($promo->type === PromotionType::Birthday && ! $isCustomerBirthday) {
                    return false;
                }

                if ($promo->type === PromotionType::FirstPurchase && ! $isCustomerFirstPurchase) {
                    return false;
                }

                if (! $promo->isWithinSchedule($referenceAt)) {
                    return false;
                }

                $remaining = $promo->remainingQuota();

                return $remaining === null || $remaining > 0;
            })
            ->values();

        // Batch query daily usages untuk tanggal WIB saat ini (PG & SQLite compatible)
        $activePromoIds = $allActivePromotions->pluck('id')->all();
        $dailyUsedQtyMap = [];
        $dailyUsedCountMap = [];

        if (! empty($activePromoIds)) {
            $dailyQuery = PromotionDailyUsage::query()
                ->whereIn('promotion_id', $activePromoIds)
                ->whereDate('usage_date', $usageDate);

            if ($customerId !== null) {
                $dailyQuery->where('customer_id', $customerId);
            } else {
                $dailyQuery->whereNull('customer_id');
            }

            foreach ($dailyQuery->get() as $usageRow) {
                $dailyUsedQtyMap[$usageRow->promotion_id] = (int) $usageRow->used_qty;
                $dailyUsedCountMap[$usageRow->promotion_id] = (int) $usageRow->used_count;
            }
        }

        /** @var EloquentCollection<int, Promotion> $candidateItemPromotions */
        $candidateItemPromotions = $allActivePromotions
            ->filter(fn (Promotion $p): bool => $p->type->isItemLevel())
            ->values();

        /** @var EloquentCollection<int, Promotion> $candidateTxPromotions */
        $candidateTxPromotions = $allActivePromotions
            ->filter(fn (Promotion $p): bool => $p->type->isTransactionLevel())
            ->values();

        /** @var EloquentCollection<int, Promotion> $candidatePaymentPromotions */
        $candidatePaymentPromotions = $allActivePromotions
            ->filter(fn (Promotion $p): bool => $p->type->isPaymentLevel())
            ->values();

        // Langkah 1: Persiapkan baris dasar & identifikasi item excluded + nearest expiry
        $todayCarbon = Carbon::parse($usageDate, $tz)->startOfDay();
        $preparedLines = [];

        foreach ($items as $index => $rawItem) {
            $productId = (int) $rawItem['product_id'];
            /** @var Product|null $product */
            $product = $productsMap->get($productId);

            if (! $product instanceof Product) {
                continue;
            }

            $productUnitId = isset($rawItem['product_unit_id']) ? (int) $rawItem['product_unit_id'] : null;
            /** @var ProductUnit|null $unit */
            $unit = $productUnitId !== null ? $unitsMap->get($productUnitId) : null;
            if ($unit instanceof ProductUnit && $unit->product_id !== $product->id) {
                $unit = null;
                $productUnitId = null;
            }

            $qty = is_float($rawItem['qty']) ? $rawItem['qty'] : (float) $rawItem['qty'];
            if (floor($qty) === $qty) {
                $qty = (int) $qty;
            }

            $baseUnitPrice = PricingMath::toRupiah($unit instanceof ProductUnit && $unit->sell_price !== null
                ? $unit->sell_price
                : $product->sell_price);
            $lineGross = PricingMath::floorRupiah($baseUnitPrice * $qty);
            $isPromoExcluded = $product->isExcludedFromPromotions();
            $taxMode = $product->effectiveTaxMode();

            $expiryRaw = isset($rawItem['expired_date']) && trim((string) $rawItem['expired_date']) !== ''
                ? trim((string) $rawItem['expired_date'])
                : ($nearestExpiryByProduct[$product->id] ?? null);

            $daysUntilExpiry = null;
            if ($expiryRaw !== null) {
                $expiryCarbon = Carbon::parse($expiryRaw, $tz)->startOfDay();
                $diffDays = (int) $todayCarbon->diffInDays($expiryCarbon, false);
                if ($diffDays >= 0) {
                    $daysUntilExpiry = $diffDays;
                }
            }

            // Langkah 2: Harga Member (product_member_prices) sesuai tier pelanggan sebelum grosir/promo
            $memberPriceInfo = ! $isPromoExcluded
                ? $this->loyaltyService->resolveMemberPrice($product, $productUnitId, $activeCustomer, $baseUnitPrice)
                : null;
            $workingUnitPrice = $memberPriceInfo !== null ? $memberPriceInfo['member_price'] : $baseUnitPrice;
            $workingLineGross = PricingMath::floorRupiah($workingUnitPrice * $qty);
            $memberDiscountAmount = max(0, $lineGross - $workingLineGross);

            $preparedLines[$index] = [
                'index' => $index,
                'product' => $product,
                'product_id' => $product->id,
                'product_unit_id' => $productUnitId,
                'qty' => $qty,
                'is_integral_qty' => is_int($qty) || floor((float) $qty) === (float) $qty,
                'catalog_unit_price' => $baseUnitPrice,
                'catalog_line_gross' => $lineGross,
                'base_unit_price' => $workingUnitPrice,
                'line_gross' => $workingLineGross,
                'member_discount_amount' => $memberDiscountAmount,
                'member_price_tier_label' => $memberPriceInfo['tier_label'] ?? null,
                'manual_discount_requested' => PricingMath::floorRupiah($rawItem['discount_amount'] ?? 0),
                'is_promo_excluded' => $isPromoExcluded,
                'days_until_expiry' => $daysUntilExpiry,
                'tax_mode' => $taxMode,
                'is_tax_exempt' => $taxMode === ProductTaxMode::Exempt,
                'is_donation' => (bool) $product->is_donation,
            ];
        }

        // Langkah 3A: Hitung kandidat Harga Grosir per baris
        $wholesaleByLine = [];
        foreach ($preparedLines as $index => $line) {
            $wholesaleByLine[$index] = $line['is_promo_excluded']
                ? null
                : $this->evaluateWholesaleTier($line['product'], $line['product_unit_id'], $line['qty'], $line['line_gross']);
        }

        // Pisahkan promo single-line vs multi-line (bundle & mix_match)
        $singleLinePromos = $candidateItemPromotions->filter(
            fn (Promotion $p): bool => ! in_array($p->type, [PromotionType::Bundle, PromotionType::MixMatch], true)
        )->values();

        $multiLinePromos = $candidateItemPromotions->filter(
            fn (Promotion $p): bool => in_array($p->type, [PromotionType::Bundle, PromotionType::MixMatch], true)
        )->values();

        // Langkah 3B: Pass 1 (promo item tanpa min_purchase_amount) untuk menghitung subtotal eligible
        $noMinSinglePromos = $singleLinePromos->filter(
            fn (Promotion $p): bool => PricingMath::toRupiah($p->min_purchase_amount) <= 0
        )->values();

        $pass1Winners = $this->resolveItemPromotions($preparedLines, $wholesaleByLine, $noMinSinglePromos, $dailyUsedQtyMap);

        $eligibleSubtotalAfterItemAuto = 0;
        foreach ($preparedLines as $index => $line) {
            if ($line['is_promo_excluded']) {
                continue;
            }

            $autoDisc = $pass1Winners[$index]['auto_discount_amount'];
            $eligibleSubtotalAfterItemAuto += max(0, $line['line_gross'] - $autoDisc);
        }

        // Langkah 3C: Pass 2 — gabungkan promo single-line yang lolos min_purchase_amount + filter exclusive_group
        $eligibleSinglePromos = $singleLinePromos->filter(function (Promotion $p) use ($eligibleSubtotalAfterItemAuto): bool {
            $minPurchase = PricingMath::toRupiah($p->min_purchase_amount);

            return $minPurchase <= 0 || $eligibleSubtotalAfterItemAuto >= $minPurchase;
        })->values();

        $filteredSinglePromos = $this->filterExclusiveGroups($preparedLines, $eligibleSinglePromos, $dailyUsedQtyMap);
        $finalItemWinners = $this->resolveItemPromotions($preparedLines, $wholesaleByLine, $filteredSinglePromos, $dailyUsedQtyMap);

        // Langkah 3D: Evaluasi promo multi-SKU (Bundle & Mix & Match) vs pemenang single-line (Best Price)
        $eligibleMultiPromos = $multiLinePromos->filter(function (Promotion $p) use ($eligibleSubtotalAfterItemAuto): bool {
            $minPurchase = PricingMath::toRupiah($p->min_purchase_amount);

            return $minPurchase <= 0 || $eligibleSubtotalAfterItemAuto >= $minPurchase;
        })->values();

        $bundlePromotions = [];
        if ($eligibleMultiPromos->isNotEmpty()) {
            $multiResult = $this->resolveMultiLinePromotions(
                $preparedLines,
                $finalItemWinners,
                $eligibleMultiPromos,
                $dailyUsedQtyMap
            );
            $finalItemWinners = $multiResult['winners'];
            $bundlePromotions = $multiResult['applied_multi_promos'];
        }

        // Langkah 4: Terapkan diskon manual item & hitung ringkasan setelah harga member & promo item
        $grossSubtotal = 0;
        $memberDiscountTotal = 0;
        $autoDiscountTotal = 0;
        $manualItemDiscountTotal = 0;
        $finalEligibleSubtotal = 0;
        $totalItemsQty = 0;
        $hasTaxExemptItems = false;
        $promotionQuotaUsage = [];
        $dailyUsagePlan = [];

        $lineSubtotalsBeforeHeader = [];
        $evaluatedItems = [];

        // Catat kuota promo multi-line
        foreach ($bundlePromotions as $bp) {
            $pid = (int) $bp['promotion_id'];
            $consumed = (int) $bp['quota_consumed'];
            if ($consumed > 0) {
                $promotionQuotaUsage[$pid] = ($promotionQuotaUsage[$pid] ?? 0) + $consumed;
            }
            if ($bp['max_daily'] !== null && $consumed > 0) {
                $this->accumulateDailyUsagePlan($dailyUsagePlan, $pid, $usageDate, $customerId, $consumed, 1, (int) $bp['max_daily']);
            }
        }

        $multiLinePromoIds = array_column($bundlePromotions, 'promotion_id');

        foreach ($preparedLines as $index => $line) {
            $winner = $finalItemWinners[$index];
            $catalogLineGross = (int) $line['catalog_line_gross'];
            $memberDiscount = (int) $line['member_discount_amount'];
            $step3AutoDiscount = min($winner['auto_discount_amount'], $line['line_gross']);
            $autoDiscount = min($memberDiscount + $step3AutoDiscount, $catalogLineGross);
            $remainingLineAfterAuto = max(0, $catalogLineGross - $autoDiscount);
            $manualItemDiscount = min($line['manual_discount_requested'], $remainingLineAfterAuto);
            $totalLineDiscount = $autoDiscount + $manualItemDiscount;
            $lineSubtotal = max(0, $catalogLineGross - $totalLineDiscount);

            $effectiveUnitPrice = $line['qty'] > 0
                ? round(($catalogLineGross - $autoDiscount) / (float) $line['qty'], 2)
                : (float) $line['catalog_unit_price'];

            $pricingSource = $winner['pricing_source'];
            $badgeLabel = $winner['badge_label'];
            if ($memberDiscount > 0 && $step3AutoDiscount === 0) {
                $pricingSource = 'member_price';
                $badgeLabel = $line['member_price_tier_label'] !== null
                    ? "Harga Member ({$line['member_price_tier_label']})"
                    : 'Harga Member';
            }

            if ($winner['applied_promotion_id'] !== null && $winner['quota_consumed'] > 0 && ! in_array($winner['applied_promotion_id'], $multiLinePromoIds, true)) {
                $pid = (int) $winner['applied_promotion_id'];
                $promotionQuotaUsage[$pid] = ($promotionQuotaUsage[$pid] ?? 0) + $winner['quota_consumed'];

                /** @var Promotion|null $wonPromo */
                $wonPromo = $candidateItemPromotions->firstWhere('id', $pid);
                if ($wonPromo instanceof Promotion && $wonPromo->max_qty_per_customer_per_day !== null) {
                    $this->accumulateDailyUsagePlan(
                        $dailyUsagePlan,
                        $pid,
                        $usageDate,
                        $customerId,
                        (int) $winner['quota_consumed'],
                        1,
                        (int) $wonPromo->max_qty_per_customer_per_day
                    );
                }
            }

            $grossSubtotal += $catalogLineGross;
            $memberDiscountTotal += $memberDiscount;
            $autoDiscountTotal += $autoDiscount;
            $manualItemDiscountTotal += $manualItemDiscount;
            $totalItemsQty += $line['qty'];

            if (! $line['is_promo_excluded']) {
                $finalEligibleSubtotal += $remainingLineAfterAuto;
            }

            if ($line['is_tax_exempt']) {
                $hasTaxExemptItems = true;
            }

            $lineSubtotalsBeforeHeader[$index] = $lineSubtotal;

            $evaluatedItems[$index] = [
                'index' => $index,
                'product_id' => $line['product_id'],
                'product_unit_id' => $line['product_unit_id'],
                'qty' => $line['qty'],
                'base_unit_price' => $line['catalog_unit_price'],
                'member_unit_price' => $memberDiscount > 0 ? $line['base_unit_price'] : null,
                'member_discount_amount' => $memberDiscount,
                'effective_unit_price' => $effectiveUnitPrice,
                'line_gross' => $catalogLineGross,
                'auto_discount_amount' => $autoDiscount,
                'manual_discount_amount' => $manualItemDiscount,
                'discount_amount' => $totalLineDiscount,
                'allocated_header_discount' => 0,
                'line_subtotal' => $lineSubtotal,
                'line_net_after_header' => $lineSubtotal,
                'free_qty' => $winner['free_qty'],
                'pricing_source' => $pricingSource,
                'applied_promotion_id' => $winner['applied_promotion_id'],
                'applied_promotion_name' => $winner['applied_promotion_name'],
                'applied_promotion_type' => $winner['applied_promotion_type'],
                'applied_promotion_funding' => $winner['applied_promotion_funding'],
                'applied_tier_min_qty' => $winner['applied_tier_min_qty'],
                'quota_consumed' => $winner['quota_consumed'],
                'badge_label' => $badgeLabel,
                'is_near_expiry_promo' => $winner['applied_promotion_type'] === PromotionType::NearExpiry->value,
                'is_promo_excluded' => $line['is_promo_excluded'],
                'tax_mode' => $line['tax_mode']->value,
                'is_tax_exempt' => $line['is_tax_exempt'],
                'is_donation' => $line['is_donation'],
            ];
        }

        // Langkah 5: Promo Level Transaksi (min_spend_*, tebus_murah, gift_with_purchase, cashback)
        $hasAutoItemPromo = $autoDiscountTotal > 0;
        $transactionPromoDiscountTotal = 0;
        $transactionPromoLineAllocations = [];
        $transactionPromotionPayload = null;
        $tebusMurahOffers = [];
        $appliedTebusMurah = null;
        $giftWithPurchaseOffers = [];
        $appliedGifts = [];
        $cashbackPromotions = [];
        $cashbackTotal = 0;

        // 5A. Min-Spend Discount, Min-Spend Percent, Birthday, & First Purchase
        $eligibleLinesForTxPromo = [];
        foreach ($evaluatedItems as $index => $evalLine) {
            if (! $evalLine['is_promo_excluded'] && $evalLine['line_subtotal'] > 0) {
                $eligibleLinesForTxPromo[$index] = $evalLine['line_subtotal'];
            }
        }
        $eligibleRemainingForTxPromo = array_sum($eligibleLinesForTxPromo);

        $bestTxPromo = null;
        $bestTxDiscount = 0;

        foreach ($candidateTxPromotions as $promo) {
            if (! in_array($promo->type, [
                PromotionType::MinSpendDiscount,
                PromotionType::MinSpendPercent,
                PromotionType::Birthday,
                PromotionType::FirstPurchase,
            ], true)) {
                continue;
            }

            // Boleh digabung dengan promo item kecuali stackable = false
            if (! $promo->stackable && $hasAutoItemPromo) {
                continue;
            }

            if ($promo->max_qty_per_customer_per_day !== null && ($dailyUsedCountMap[$promo->id] ?? 0) >= $promo->max_qty_per_customer_per_day) {
                continue;
            }

            $minSpend = PricingMath::toRupiah($promo->min_purchase_amount);
            if ($finalEligibleSubtotal < $minSpend) {
                continue;
            }

            $rawDiscVal = (float) ($promo->discount_value ?? 0);
            if ($promo->type === PromotionType::MinSpendPercent) {
                $disc = PricingMath::percentageDiscount(
                    $finalEligibleSubtotal,
                    $rawDiscVal,
                    $promo->max_discount_amount !== null ? PricingMath::toRupiah($promo->max_discount_amount) : null
                );
            } elseif ($promo->type === PromotionType::MinSpendDiscount) {
                $disc = PricingMath::toRupiah($rawDiscVal);
            } else {
                // Birthday & FirstPurchase: <= 100 dianggap persentase, > 100 dianggap nominal Rupiah
                $disc = $rawDiscVal <= 100.0
                    ? PricingMath::percentageDiscount(
                        $finalEligibleSubtotal,
                        $rawDiscVal,
                        $promo->max_discount_amount !== null ? PricingMath::toRupiah($promo->max_discount_amount) : null
                    )
                    : PricingMath::toRupiah($rawDiscVal);
            }

            $disc = min($disc, $eligibleRemainingForTxPromo);
            if ($disc <= 0) {
                continue;
            }

            if ($bestTxPromo === null || $this->isBetterPromotionCandidate($disc, $promo, $bestTxDiscount, $bestTxPromo)) {
                $bestTxPromo = $promo;
                $bestTxDiscount = $disc;
            }
        }

        if ($bestTxPromo instanceof Promotion && $bestTxDiscount > 0) {
            $transactionPromoDiscountTotal = $bestTxDiscount;
            $transactionPromoLineAllocations = PricingMath::allocateProportionally($bestTxDiscount, $eligibleLinesForTxPromo);
            $promotionQuotaUsage[$bestTxPromo->id] = ($promotionQuotaUsage[$bestTxPromo->id] ?? 0) + 1;

            if ($bestTxPromo->max_qty_per_customer_per_day !== null) {
                $this->accumulateDailyUsagePlan(
                    $dailyUsagePlan,
                    $bestTxPromo->id,
                    $usageDate,
                    $customerId,
                    1,
                    1,
                    (int) $bestTxPromo->max_qty_per_customer_per_day
                );
            }

            $transactionPromotionPayload = [
                'promotion_id' => $bestTxPromo->id,
                'code' => $bestTxPromo->code,
                'name' => $bestTxPromo->name,
                'type' => $bestTxPromo->type->value,
                'type_label' => $bestTxPromo->type->label(),
                'funding' => $bestTxPromo->funding->value,
                'min_purchase_amount' => PricingMath::toRupiah($bestTxPromo->min_purchase_amount),
                'discount_amount' => $bestTxDiscount,
                'stackable' => (bool) $bestTxPromo->stackable,
                'quota_consumed' => 1,
            ];
        }

        // 5B. Tebus Murah (maksimal 1 per struk)
        $tebusMurahCandidates = [];
        foreach ($candidateTxPromotions as $promo) {
            if ($promo->type !== PromotionType::TebusMurah || $promo->reward_product_id === null) {
                continue;
            }

            if ($promo->max_qty_per_customer_per_day !== null && ($dailyUsedCountMap[$promo->id] ?? 0) >= $promo->max_qty_per_customer_per_day) {
                continue;
            }

            $rewardProduct = $promo->rewardProduct;
            if (! $rewardProduct instanceof Product || ! $rewardProduct->active || (int) $rewardProduct->stock < 1) {
                continue;
            }

            $minSpend = PricingMath::toRupiah($promo->min_purchase_amount);
            $normalPrice = PricingMath::toRupiah($rewardProduct->sell_price);
            $specialPrice = PricingMath::toRupiah($promo->special_price);
            $savings = max(0, $normalPrice - $specialPrice);

            if ($savings <= 0) {
                continue;
            }

            // Cek apakah produk reward ada di keranjang; jika ada, hitung spend di luar 1 unit reward tersebut
            $rewardLineIndex = null;
            foreach ($evaluatedItems as $idx => $evalLine) {
                if ($evalLine['product_id'] === $rewardProduct->id && $evalLine['product_unit_id'] === null && ! $evalLine['is_promo_excluded']) {
                    $rewardLineIndex = $idx;
                    break;
                }
            }

            $spendBasisForTebus = $finalEligibleSubtotal;
            if ($rewardLineIndex !== null) {
                $rewardLine = $evaluatedItems[$rewardLineIndex];
                $unitNetAfterAuto = $rewardLine['qty'] > 0
                    ? PricingMath::floorRupiah(($rewardLine['line_gross'] - $rewardLine['auto_discount_amount']) / (float) $rewardLine['qty'])
                    : $normalPrice;
                $spendBasisForTebus = max(0, $finalEligibleSubtotal - $unitNetAfterAuto);
            }

            if ($spendBasisForTebus < $minSpend) {
                continue;
            }

            $tebusMurahCandidates[] = [
                'promo' => $promo,
                'reward_product' => $rewardProduct,
                'reward_line_index' => $rewardLineIndex,
                'normal_price' => $normalPrice,
                'special_price' => $specialPrice,
                'savings' => $savings,
                'min_purchase_amount' => $minSpend,
            ];
        }

        // Pilih maksimal 1 Tebus Murah yang benar-benar diterapkan (jika reward product ada di keranjang)
        $chosenTebus = null;
        if ($selectedTebusMurahPromotionId !== null) {
            foreach ($tebusMurahCandidates as $cand) {
                if ($cand['promo']->id === $selectedTebusMurahPromotionId && $cand['reward_line_index'] !== null) {
                    $chosenTebus = $cand;
                    break;
                }
            }
        }
        if ($chosenTebus === null) {
            foreach ($tebusMurahCandidates as $cand) {
                if ($cand['reward_line_index'] === null) {
                    continue;
                }
                if (
                    $chosenTebus === null
                    || $this->isBetterPromotionCandidate($cand['savings'], $cand['promo'], $chosenTebus['savings'], $chosenTebus['promo'])
                ) {
                    $chosenTebus = $cand;
                }
            }
        }

        if ($chosenTebus !== null && $chosenTebus['reward_line_index'] !== null) {
            /** @var Promotion $tmPromo */
            $tmPromo = $chosenTebus['promo'];
            $lineIdx = (int) $chosenTebus['reward_line_index'];
            $alreadyAllocatedOnLine = $transactionPromoLineAllocations[$lineIdx] ?? 0;
            $availableOnLine = max(0, $evaluatedItems[$lineIdx]['line_subtotal'] - $alreadyAllocatedOnLine);
            $tmDiscount = min($chosenTebus['savings'], $availableOnLine);

            if ($tmDiscount > 0) {
                $transactionPromoDiscountTotal += $tmDiscount;
                $transactionPromoLineAllocations[$lineIdx] = ($transactionPromoLineAllocations[$lineIdx] ?? 0) + $tmDiscount;
                $promotionQuotaUsage[$tmPromo->id] = ($promotionQuotaUsage[$tmPromo->id] ?? 0) + 1;

                if ($tmPromo->max_qty_per_customer_per_day !== null) {
                    $this->accumulateDailyUsagePlan(
                        $dailyUsagePlan,
                        $tmPromo->id,
                        $usageDate,
                        $customerId,
                        1,
                        1,
                        (int) $tmPromo->max_qty_per_customer_per_day
                    );
                }

                $appliedTebusMurah = [
                    'promotion_id' => $tmPromo->id,
                    'name' => $tmPromo->name,
                    'funding' => $tmPromo->funding->value,
                    'min_purchase_amount' => $chosenTebus['min_purchase_amount'],
                    'reward_product_id' => $chosenTebus['reward_product']->id,
                    'reward_product_name' => $chosenTebus['reward_product']->name,
                    'line_index' => $lineIdx,
                    'normal_price' => $chosenTebus['normal_price'],
                    'special_price' => $chosenTebus['special_price'],
                    'discount_amount' => $tmDiscount,
                    'max_qty' => 1,
                    'quota_consumed' => 1,
                ];
            }
        }

        foreach ($tebusMurahCandidates as $cand) {
            /** @var Promotion $tmPromo */
            $tmPromo = $cand['promo'];
            /** @var Product $rp */
            $rp = $cand['reward_product'];

            $tebusMurahOffers[] = [
                'promotion_id' => $tmPromo->id,
                'name' => $tmPromo->name,
                'funding' => $tmPromo->funding->value,
                'min_purchase_amount' => $cand['min_purchase_amount'],
                'reward_product_id' => $rp->id,
                'reward_product_name' => $rp->name,
                'reward_product_barcode' => $rp->barcode,
                'reward_product_unit' => $rp->base_unit ?: 'pcs',
                'normal_price' => $cand['normal_price'],
                'special_price' => $cand['special_price'],
                'savings' => $cand['savings'],
                'stock' => (int) $rp->stock,
                'is_applied' => $appliedTebusMurah !== null && $appliedTebusMurah['promotion_id'] === $tmPromo->id,
            ];
        }

        // 5C. Gift With Purchase (GWP)
        foreach ($candidateTxPromotions as $promo) {
            if ($promo->type !== PromotionType::GiftWithPurchase || $promo->reward_product_id === null) {
                continue;
            }

            if ($promo->max_qty_per_customer_per_day !== null && ($dailyUsedCountMap[$promo->id] ?? 0) >= $promo->max_qty_per_customer_per_day) {
                continue;
            }

            $rewardProduct = $promo->rewardProduct;
            if (! $rewardProduct instanceof Product || ! $rewardProduct->active) {
                continue;
            }

            $minSpend = PricingMath::toRupiah($promo->min_purchase_amount);
            $giftQty = max(1, (int) ($promo->get_qty ?? 1));
            $normalPrice = PricingMath::toRupiah($rewardProduct->sell_price);

            $giftLineIndex = null;
            foreach ($evaluatedItems as $idx => $evalLine) {
                if ($evalLine['product_id'] === $rewardProduct->id && $evalLine['product_unit_id'] === null) {
                    $giftLineIndex = $idx;
                    break;
                }
            }

            $spendForGift = $finalEligibleSubtotal;
            if ($giftLineIndex !== null) {
                $deductQty = min((int) $evaluatedItems[$giftLineIndex]['qty'], $giftQty);
                $spendForGift = max(0, $finalEligibleSubtotal - ($deductQty * $normalPrice));
            }

            if ($spendForGift < $minSpend) {
                continue;
            }

            $giftApplied = false;
            if ($giftLineIndex !== null) {
                $freeCount = min((int) $evaluatedItems[$giftLineIndex]['qty'], $giftQty);
                $alreadyAlloc = $transactionPromoLineAllocations[$giftLineIndex] ?? 0;
                $avail = max(0, $evaluatedItems[$giftLineIndex]['line_subtotal'] - $alreadyAlloc);
                $giftDiscount = min($freeCount * $normalPrice, $avail);

                if ($giftDiscount > 0) {
                    $transactionPromoDiscountTotal += $giftDiscount;
                    $transactionPromoLineAllocations[$giftLineIndex] = $alreadyAlloc + $giftDiscount;
                    $evaluatedItems[$giftLineIndex]['free_qty'] = max($evaluatedItems[$giftLineIndex]['free_qty'], $freeCount);
                    $promotionQuotaUsage[$promo->id] = ($promotionQuotaUsage[$promo->id] ?? 0) + 1;

                    if ($promo->max_qty_per_customer_per_day !== null) {
                        $this->accumulateDailyUsagePlan(
                            $dailyUsagePlan,
                            $promo->id,
                            $usageDate,
                            $customerId,
                            $freeCount,
                            1,
                            (int) $promo->max_qty_per_customer_per_day
                        );
                    }

                    $appliedGifts[] = [
                        'promotion_id' => $promo->id,
                        'name' => $promo->name,
                        'funding' => $promo->funding->value,
                        'min_purchase_amount' => $minSpend,
                        'reward_product_id' => $rewardProduct->id,
                        'reward_product_name' => $rewardProduct->name,
                        'line_index' => $giftLineIndex,
                        'free_qty' => $freeCount,
                        'discount_amount' => $giftDiscount,
                        'quota_consumed' => 1,
                    ];
                    $giftApplied = true;
                }
            }

            $giftWithPurchaseOffers[] = [
                'promotion_id' => $promo->id,
                'name' => $promo->name,
                'funding' => $promo->funding->value,
                'min_purchase_amount' => $minSpend,
                'reward_product_id' => $rewardProduct->id,
                'reward_product_name' => $rewardProduct->name,
                'reward_product_barcode' => $rewardProduct->barcode,
                'free_qty' => $giftQty,
                'is_applied' => $giftApplied,
            ];
        }

        // 5D. Cashback (dicatat sebagai metadata manfaat pada applied_promotions)
        foreach ($candidateTxPromotions as $promo) {
            if ($promo->type !== PromotionType::Cashback) {
                continue;
            }

            if ($promo->max_qty_per_customer_per_day !== null && ($dailyUsedCountMap[$promo->id] ?? 0) >= $promo->max_qty_per_customer_per_day) {
                continue;
            }

            $minSpend = PricingMath::toRupiah($promo->min_purchase_amount);
            if ($finalEligibleSubtotal < $minSpend) {
                continue;
            }

            $val = (float) ($promo->discount_value ?? 0);
            $cbAmount = $val <= 100.0
                ? PricingMath::percentageDiscount(
                    $finalEligibleSubtotal,
                    $val,
                    $promo->max_discount_amount !== null ? PricingMath::toRupiah($promo->max_discount_amount) : null
                )
                : PricingMath::toRupiah($val);

            if ($cbAmount <= 0) {
                continue;
            }

            $cashbackTotal += $cbAmount;
            $cashbackPromotions[] = [
                'promotion_id' => $promo->id,
                'name' => $promo->name,
                'funding' => $promo->funding->value,
                'min_purchase_amount' => $minSpend,
                'cashback_amount' => $cbAmount,
                'quota_consumed' => 1,
            ];
            $promotionQuotaUsage[$promo->id] = ($promotionQuotaUsage[$promo->id] ?? 0) + 1;

            if ($promo->max_qty_per_customer_per_day !== null) {
                $this->accumulateDailyUsagePlan(
                    $dailyUsagePlan,
                    $promo->id,
                    $usageDate,
                    $customerId,
                    1,
                    1,
                    (int) $promo->max_qty_per_customer_per_day
                );
            }
        }

        // Langkah 6: Evaluasi & terapkan Voucher / Kode Promo (mendukung > 1 voucher, alokasi proporsional ke baris eligible)
        $subtotalAfterItemDiscounts = max(0, $grossSubtotal - ($autoDiscountTotal + $manualItemDiscountTotal));
        $subtotalAfterTxPromo = max(0, $subtotalAfterItemDiscounts - $transactionPromoDiscountTotal);
        $voucherDiscountTotal = 0;
        $voucherLineAllocations = [];
        $vouchersPayload = [];
        $seenVoucherCodes = [];

        foreach ($voucherEntries as $entry) {
            $entryCode = $entry['code'];
            $entryToken = $entry['reservation_token'];
            $normalizedEntryCode = $this->voucherService->normalizeCode($entryCode);

            if (isset($seenVoucherCodes[$normalizedEntryCode])) {
                continue;
            }
            $seenVoucherCodes[$normalizedEntryCode] = true;

            $voucherEvalLines = [];
            foreach ($evaluatedItems as $index => $evalLine) {
                $remainingAfterPrevVouchers = max(
                    0,
                    $evalLine['line_subtotal']
                        - ($transactionPromoLineAllocations[$index] ?? 0)
                        - ($voucherLineAllocations[$index] ?? 0)
                );
                $voucherEvalLines[$index] = [
                    'index' => $index,
                    'product' => $preparedLines[$index]['product'],
                    'product_id' => $evalLine['product_id'],
                    'qty' => $evalLine['qty'],
                    'base_unit_price' => $evalLine['base_unit_price'],
                    'line_gross' => $evalLine['line_gross'],
                    'auto_discount_amount' => $evalLine['auto_discount_amount'],
                    'line_subtotal' => $remainingAfterPrevVouchers,
                    'is_promo_excluded' => $evalLine['is_promo_excluded'],
                    'is_near_expiry_promo' => $evalLine['is_near_expiry_promo'],
                ];
            }

            $voucherEval = $this->voucherService->evaluateVoucherForLines(
                $entryCode,
                $voucherEvalLines,
                $customerId,
                $referenceAt,
                $entryToken,
                $storeId,
                $channel
            );

            if ($voucherEval['valid'] && $voucherEval['voucher'] !== null) {
                $voucher = $voucherEval['voucher'];
                $remainingPool = max(0, $subtotalAfterTxPromo - $voucherDiscountTotal);
                $entryDiscount = min($voucherEval['discount_amount'], $remainingPool);
                $entryAllocations = PricingMath::allocateProportionally(
                    $entryDiscount,
                    $voucherEval['eligible_line_amounts']
                );

                foreach ($entryAllocations as $lineIdx => $allocAmt) {
                    $voucherLineAllocations[$lineIdx] = ($voucherLineAllocations[$lineIdx] ?? 0) + $allocAmt;
                }
                $voucherDiscountTotal += $entryDiscount;

                $vouchersPayload[] = [
                    'applied' => true,
                    'auto_removed' => false,
                    'voucher_id' => $voucher->id,
                    'code' => $voucher->code,
                    'reservation_token' => $entryToken,
                    'name' => $voucher->name,
                    'type' => $voucher->type->value,
                    'type_label' => $voucher->type->label(),
                    'funding' => $voucher->funding->value,
                    'min_spend' => PricingMath::toRupiah($voucher->min_spend),
                    'discount_amount' => $entryDiscount,
                    'error_code' => null,
                    'message' => null,
                    'applicable_skus' => $voucher->applicable_skus,
                    'applicable_categories' => $voucher->applicable_categories,
                    'excluded_skus' => $voucher->excluded_skus,
                    'excluded_categories' => $voucher->excluded_categories,
                    'free_product_id' => $voucher->free_product_id,
                ];
            } else {
                $vouchersPayload[] = [
                    'applied' => false,
                    'auto_removed' => true,
                    'voucher_id' => null,
                    'code' => $voucherEval['normalized_code'],
                    'reservation_token' => $entryToken,
                    'name' => null,
                    'type' => null,
                    'type_label' => null,
                    'funding' => null,
                    'min_spend' => 0,
                    'discount_amount' => 0,
                    'error_code' => $voucherEval['error_code']?->value,
                    'message' => $voucherEval['message'],
                    'applicable_skus' => null,
                    'applicable_categories' => null,
                    'excluded_skus' => null,
                    'excluded_categories' => null,
                    'free_product_id' => null,
                ];
            }
        }

        $voucherPayload = $vouchersPayload[0] ?? null;

        // Langkah 7: Diskon nota manual + alokasi proporsional ke sisa nilai baris setelah tx promo & voucher
        $lineSubtotalsAfterVoucher = [];
        foreach ($lineSubtotalsBeforeHeader as $index => $lineSub) {
            $lineSubtotalsAfterVoucher[$index] = max(
                0,
                $lineSub - ($transactionPromoLineAllocations[$index] ?? 0) - ($voucherLineAllocations[$index] ?? 0)
            );
        }

        $subtotalAfterItemTxAndVoucher = max(0, $subtotalAfterTxPromo - $voucherDiscountTotal);
        $safeTransactionDiscount = min(
            max(0, PricingMath::floorRupiah($transactionDiscount)),
            $subtotalAfterItemTxAndVoucher
        );

        $txHeaderAllocations = PricingMath::allocateProportionally($safeTransactionDiscount, $lineSubtotalsAfterVoucher);

        // Langkah 8: Promo Metode Bayar (payment_promo + BIN prefix + split payment + kuota harian)
        $lineSubtotalsBeforePaymentPromo = [];
        foreach ($lineSubtotalsAfterVoucher as $index => $subAfterV) {
            $lineSubtotalsBeforePaymentPromo[$index] = max(0, $subAfterV - ($txHeaderAllocations[$index] ?? 0));
        }

        $payableBeforePaymentPromo = array_sum($lineSubtotalsBeforePaymentPromo);
        $paymentPromoDiscountTotal = 0;
        $paymentPromoLineAllocations = [];
        $paymentPromotionPayload = null;

        if (! empty($payments) && $payableBeforePaymentPromo > 0 && $candidatePaymentPromotions->isNotEmpty()) {
            $bestPayPromo = null;
            $bestPayDiscount = 0;
            $bestPayEligibleAmount = 0;
            $bestPayMatchedBin = null;

            $isSinglePayment = count($payments) === 1;

            foreach ($candidatePaymentPromotions as $promo) {
                // Boleh digabung dengan voucher bila stackable = true
                if ($voucherDiscountTotal > 0 && ! $promo->stackable) {
                    continue;
                }

                // Cek kuota harian via promotion_daily_usages
                if ($promo->max_qty_per_customer_per_day !== null && ($dailyUsedCountMap[$promo->id] ?? 0) >= $promo->max_qty_per_customer_per_day) {
                    continue;
                }

                $minSpend = PricingMath::toRupiah($promo->min_purchase_amount);
                if ($finalEligibleSubtotal < $minSpend) {
                    continue;
                }

                $targetMethod = $promo->payment_method !== null ? trim($promo->payment_method) : '';
                if ($targetMethod === '') {
                    continue;
                }

                $binPrefix = $promo->payment_bin_prefix !== null ? preg_replace('/\D+/', '', $promo->payment_bin_prefix) : '';
                $eligiblePayPortion = 0;
                $matchedBin = null;

                foreach ($payments as $pRow) {
                    $pMethod = trim((string) ($pRow['payment_method'] ?? ''));
                    if ($pMethod !== $targetMethod) {
                        continue;
                    }

                    if ($binPrefix !== '' && $binPrefix !== null) {
                        $rawBin = (string) ($pRow['card_bin'] ?? $pRow['reference_number'] ?? '');
                        $digits = preg_replace('/\D+/', '', $rawBin) ?? '';
                        if ($digits === '' || ! str_starts_with($digits, $binPrefix)) {
                            continue;
                        }
                        $matchedBin = substr($digits, 0, min(8, strlen($digits)));
                    }

                    if ($isSinglePayment) {
                        // Pada pembayaran tunggal, porsi eligible adalah seluruh sisa tagihan
                        $eligiblePayPortion = $payableBeforePaymentPromo;
                    } else {
                        // Pada split payment, hanya porsi nominal metode bayar yang memenuhi syarat
                        $eligiblePayPortion += PricingMath::floorRupiah($pRow['amount'] ?? 0);
                    }
                }

                $eligiblePayPortion = min($eligiblePayPortion, $payableBeforePaymentPromo);
                if ($eligiblePayPortion <= 0) {
                    continue;
                }

                $val = (float) ($promo->discount_value ?? 0);
                $payDisc = $val <= 100.0
                    ? PricingMath::percentageDiscount(
                        $eligiblePayPortion,
                        $val,
                        $promo->max_discount_amount !== null ? PricingMath::toRupiah($promo->max_discount_amount) : null
                    )
                    : min(PricingMath::toRupiah($val), $eligiblePayPortion);

                if ($payDisc <= 0) {
                    continue;
                }

                if ($bestPayPromo === null || $this->isBetterPromotionCandidate($payDisc, $promo, $bestPayDiscount, $bestPayPromo)) {
                    $bestPayPromo = $promo;
                    $bestPayDiscount = $payDisc;
                    $bestPayEligibleAmount = $eligiblePayPortion;
                    $bestPayMatchedBin = $matchedBin;
                }
            }

            if ($bestPayPromo instanceof Promotion && $bestPayDiscount > 0) {
                $paymentPromoDiscountTotal = $bestPayDiscount;
                $paymentPromoLineAllocations = PricingMath::allocateProportionally($bestPayDiscount, $lineSubtotalsBeforePaymentPromo);
                $promotionQuotaUsage[$bestPayPromo->id] = ($promotionQuotaUsage[$bestPayPromo->id] ?? 0) + 1;

                if ($bestPayPromo->max_qty_per_customer_per_day !== null) {
                    $this->accumulateDailyUsagePlan(
                        $dailyUsagePlan,
                        $bestPayPromo->id,
                        $usageDate,
                        $customerId,
                        1,
                        1,
                        (int) $bestPayPromo->max_qty_per_customer_per_day
                    );
                }

                $paymentPromotionPayload = [
                    'promotion_id' => $bestPayPromo->id,
                    'code' => $bestPayPromo->code,
                    'name' => $bestPayPromo->name,
                    'funding' => $bestPayPromo->funding->value,
                    'payment_method' => $bestPayPromo->payment_method,
                    'payment_bin_prefix' => $bestPayPromo->payment_bin_prefix,
                    'matched_bin' => $bestPayMatchedBin,
                    'eligible_payment_amount' => $bestPayEligibleAmount,
                    'discount_amount' => $bestPayDiscount,
                    'stackable' => (bool) $bestPayPromo->stackable,
                    'quota_consumed' => 1,
                ];
            }
        }

        // Langkah 10: PPN per produk (exclusive / inclusive / exempt)
        $storeSetting = $this->storeSettingService->get();
        $taxRate = max(0.0, (float) $storeSetting->default_tax_rate);

        $exclusiveDpp = 0;
        $inclusiveDpp = 0;
        $inclusiveTax = 0;
        $taxExemptAmount = 0;

        foreach ($evaluatedItems as $index => &$evalLine) {
            $allocated = ($transactionPromoLineAllocations[$index] ?? 0)
                + ($voucherLineAllocations[$index] ?? 0)
                + ($txHeaderAllocations[$index] ?? 0)
                + ($paymentPromoLineAllocations[$index] ?? 0);
            $evalLine['allocated_header_discount'] = $allocated;
            $netLine = max(0, $evalLine['line_subtotal'] - $allocated);
            $evalLine['line_net_after_header'] = $netLine;

            $taxMode = ProductTaxMode::from($evalLine['tax_mode']);
            if ($taxMode === ProductTaxMode::Exempt) {
                $taxExemptAmount += $netLine;
            } elseif ($taxMode === ProductTaxMode::Inclusive && $taxRate > 0.0) {
                $lineDpp = PricingMath::floorRupiah($netLine / (1.0 + ($taxRate / 100.0)));
                $inclusiveDpp += $lineDpp;
                $inclusiveTax += max(0, $netLine - $lineDpp);
            } else {
                $exclusiveDpp += $netLine;
            }
        }
        unset($evalLine);

        $exclusiveTax = $taxRate > 0.0
            ? PricingMath::floorRupiah($exclusiveDpp * ($taxRate / 100.0))
            : 0;

        $taxableAmount = $exclusiveDpp + $inclusiveDpp;
        $taxAmount = $exclusiveTax + $inclusiveTax;

        $itemDiscountTotal = $autoDiscountTotal + $manualItemDiscountTotal;
        $manualDiscountTotal = $manualItemDiscountTotal + $safeTransactionDiscount;
        $totalDiscount = $itemDiscountTotal
            + $transactionPromoDiscountTotal
            + $voucherDiscountTotal
            + $safeTransactionDiscount
            + $paymentPromoDiscountTotal;
        $netSubtotal = max(0, $grossSubtotal - $totalDiscount);

        $beforeRounding = max(0, $netSubtotal + $exclusiveTax);

        // Langkah 11: Pembulatan Rp100 khusus pembayaran tunai
        $roundingResult = PricingMath::applyCashRounding(
            $beforeRounding,
            $storeSetting->rounding_mode,
            $hasCashPayment
        );
        $grandTotal = $roundingResult['rounded'];

        // Langkah 9: Pratinjau Redeem Poin sebagai alat pembayaran (tidak mengurangi DPP PPN, maks 50% tagihan)
        $redeemPreview = $this->loyaltyService->calculateRedeemPreview(
            $activeCustomer,
            max(0, $redeemPoints),
            $grandTotal,
            $referenceAt
        );

        // Langkah 12: Estimasi perolehan poin dari nilai bayar bersih non-excluded tanpa porsi redeem poin
        $estimatedPointsEarned = $this->loyaltyService->calculateEarnedPoints(
            $activeCustomer,
            $evaluatedItems,
            $redeemPreview['points_redeem_amount']
        );

        return [
            'evaluated_at' => $referenceAt->toIso8601String(),
            'items' => array_values($evaluatedItems),
            'summary' => [
                'gross_subtotal' => $grossSubtotal,
                'member_discount_total' => $memberDiscountTotal,
                'auto_discount_total' => $autoDiscountTotal,
                'manual_item_discount_total' => $manualItemDiscountTotal,
                'item_discount_total' => $itemDiscountTotal,
                'transaction_promo_discount_total' => $transactionPromoDiscountTotal,
                'voucher_discount_total' => $voucherDiscountTotal,
                'transaction_discount' => $safeTransactionDiscount,
                'payment_promo_discount_total' => $paymentPromoDiscountTotal,
                'cashback_total' => $cashbackTotal,
                'manual_discount_total' => $manualDiscountTotal,
                'total_discount' => $totalDiscount,
                'eligible_subtotal_after_item_auto' => $finalEligibleSubtotal,
                'net_subtotal' => $netSubtotal,
                'taxable_amount' => $taxableAmount,
                'tax_exempt_amount' => $taxExemptAmount,
                'tax_amount' => $taxAmount,
                'rounding_amount' => $roundingResult['rounding_amount'],
                'grand_total' => $grandTotal,
                'points_redeemed' => $redeemPreview['points_redeemed'],
                'points_redeem_amount' => $redeemPreview['points_redeem_amount'],
                'net_payable_after_points' => $redeemPreview['net_payable_after_redeem'],
                'estimated_points_earned' => $estimatedPointsEarned,
                'total_items_qty' => $totalItemsQty,
                'has_tax_exempt_items' => $hasTaxExemptItems,
            ],
            'loyalty' => [
                'customer_id' => $activeCustomer?->id,
                'tier' => $activeCustomer?->tier?->value,
                'tier_label' => $activeCustomer?->tier?->label(),
                'tier_multiplier' => $activeCustomer?->tier?->multiplier() ?? 1.0,
                'active_point_balance' => $redeemPreview['active_balance'],
                'max_redeemable_points' => $redeemPreview['max_redeemable_points'],
                'max_redeemable_amount' => $redeemPreview['max_redeemable_amount'],
                'points_redeemed' => $redeemPreview['points_redeemed'],
                'points_redeem_amount' => $redeemPreview['points_redeem_amount'],
                'net_payable_after_points' => $redeemPreview['net_payable_after_redeem'],
                'estimated_points_earned' => $estimatedPointsEarned,
                'is_birthday' => $isCustomerBirthday,
                'is_first_purchase' => $isCustomerFirstPurchase,
            ],
            'voucher' => $voucherPayload,
            'vouchers' => $vouchersPayload,
            'voucher_line_allocations' => $voucherLineAllocations,
            'bundle_promotions' => $bundlePromotions,
            'transaction_promotion' => $transactionPromotionPayload,
            'transaction_promo_line_allocations' => $transactionPromoLineAllocations,
            'tebus_murah_offers' => $tebusMurahOffers,
            'applied_tebus_murah' => $appliedTebusMurah,
            'gift_with_purchase_offers' => $giftWithPurchaseOffers,
            'applied_gifts' => $appliedGifts,
            'cashback_promotions' => $cashbackPromotions,
            'payment_promotion' => $paymentPromotionPayload,
            'payment_promo_line_allocations' => $paymentPromoLineAllocations,
            'promotion_quota_usage' => $promotionQuotaUsage,
            'promotion_daily_usage_plan' => array_values($dailyUsagePlan),
        ];
    }

    /**
     * @param  array<int, array{promotion_id: int, usage_date: string, customer_id: int|null, qty: int, count: int, max_daily: int}>  $plan
     */
    private function accumulateDailyUsagePlan(
        array &$plan,
        int $promotionId,
        string $usageDate,
        ?int $customerId,
        int $qty,
        int $count,
        int $maxDaily
    ): void {
        if (! isset($plan[$promotionId])) {
            $plan[$promotionId] = [
                'promotion_id' => $promotionId,
                'usage_date' => $usageDate,
                'customer_id' => $customerId,
                'qty' => $qty,
                'count' => $count,
                'max_daily' => $maxDaily,
            ];

            return;
        }

        $plan[$promotionId]['qty'] += $qty;
        $plan[$promotionId]['count'] = max($plan[$promotionId]['count'], $count);
    }

    /**
     * Evaluasi tier harga grosir aktif untuk (product, product_unit_id, qty).
     *
     * @return array{discount: int, tier_unit_price: int, min_qty: int}|null
     */
    private function evaluateWholesaleTier(
        Product $product,
        ?int $productUnitId,
        int|float $qty,
        int $lineGross
    ): ?array {
        /** @var ProductPriceTier|null $matchedTier */
        $matchedTier = $product->activePriceTiers
            ->filter(fn (ProductPriceTier $tier): bool => $tier->product_unit_id === $productUnitId && $qty >= $tier->min_qty)
            ->sort(function (ProductPriceTier $a, ProductPriceTier $b): int {
                if ($a->min_qty !== $b->min_qty) {
                    return $b->min_qty <=> $a->min_qty;
                }

                return PricingMath::toRupiah($a->unit_price) <=> PricingMath::toRupiah($b->unit_price);
            })
            ->first();

        if (! $matchedTier instanceof ProductPriceTier) {
            return null;
        }

        $tierUnitPrice = PricingMath::toRupiah($matchedTier->unit_price);
        $tierTotal = PricingMath::floorRupiah($tierUnitPrice * $qty);
        $discount = max(0, $lineGross - $tierTotal);

        if ($discount <= 0) {
            return null;
        }

        return [
            'discount' => $discount,
            'tier_unit_price' => $tierUnitPrice,
            'min_qty' => (int) $matchedTier->min_qty,
        ];
    }

    /**
     * Dalam satu exclusive_group, hanya satu promo dengan potensi penghematan terbesar
     * (tie-breaker: priority tertinggi, lalu id terkecil) yang diperbolehkan aktif.
     *
     * @param  array<int, array<string, mixed>>  $preparedLines
     * @param  EloquentCollection<int, Promotion>  $promotions
     * @param  array<int, int>  $dailyUsedQtyMap
     * @return EloquentCollection<int, Promotion>
     */
    private function filterExclusiveGroups(
        array $preparedLines,
        EloquentCollection $promotions,
        array $dailyUsedQtyMap
    ): EloquentCollection {
        $grouped = [];
        $ungrouped = [];

        foreach ($promotions as $promo) {
            $group = $promo->exclusive_group !== null ? trim($promo->exclusive_group) : '';
            if ($group === '') {
                $ungrouped[] = $promo;
            } else {
                $grouped[$group][] = $promo;
            }
        }

        $selected = $ungrouped;

        foreach ($grouped as $groupPromos) {
            $bestPromo = null;
            $bestScore = -1;

            foreach ($groupPromos as $promo) {
                $score = 0;
                $remainingQuota = $promo->remainingQuota();
                $remainingTxQty = $promo->max_qty_per_transaction;
                $remainingDailyQty = $promo->max_qty_per_customer_per_day !== null
                    ? max(0, (int) $promo->max_qty_per_customer_per_day - ($dailyUsedQtyMap[$promo->id] ?? 0))
                    : null;

                foreach ($preparedLines as $line) {
                    if ($line['is_promo_excluded'] || ! $this->promotionAppliesToProduct($promo, $line['product'])) {
                        continue;
                    }

                    $calc = $this->calculateLinePromotionDiscount($promo, $line, $remainingQuota, $remainingTxQty, $remainingDailyQty);
                    $score += $calc['discount'];

                    if ($remainingQuota !== null) {
                        $remainingQuota = max(0, $remainingQuota - $calc['quota_consumed']);
                    }
                    if ($remainingTxQty !== null) {
                        $remainingTxQty = max(0, $remainingTxQty - $calc['quota_consumed']);
                    }
                    if ($remainingDailyQty !== null) {
                        $remainingDailyQty = max(0, $remainingDailyQty - $calc['quota_consumed']);
                    }
                }

                if ($bestPromo === null || $this->isBetterPromotionCandidate($score, $promo, $bestScore, $bestPromo)) {
                    $bestPromo = $promo;
                    $bestScore = $score;
                }
            }

            if ($bestPromo !== null) {
                $selected[] = $bestPromo;
            }
        }

        return new EloquentCollection($selected);
    }

    /**
     * Selesaikan pemenang Best Price (Harga Grosir vs Promo Item single-line) per baris dengan pelacakan kuota & batas harian.
     *
     * @param  array<int, array<string, mixed>>  $preparedLines
     * @param  array<int, array{discount: int, tier_unit_price: int, min_qty: int}|null>  $wholesaleByLine
     * @param  EloquentCollection<int, Promotion>  $promotions
     * @param  array<int, int>  $dailyUsedQtyMap
     * @return array<int, array{
     *     pricing_source: string,
     *     auto_discount_amount: int,
     *     free_qty: int,
     *     applied_promotion_id: int|null,
     *     applied_promotion_name: string|null,
     *     applied_promotion_type: string|null,
     *     applied_promotion_funding: string|null,
     *     applied_tier_min_qty: int|null,
     *     quota_consumed: int,
     *     badge_label: string|null
     * }>
     */
    private function resolveItemPromotions(
        array $preparedLines,
        array $wholesaleByLine,
        EloquentCollection $promotions,
        array $dailyUsedQtyMap
    ): array {
        $remainingQuotaByPromo = [];
        $remainingTxQtyByPromo = [];
        $remainingDailyQtyByPromo = [];

        foreach ($promotions as $promo) {
            $remainingQuotaByPromo[$promo->id] = $promo->remainingQuota();
            $remainingTxQtyByPromo[$promo->id] = $promo->max_qty_per_transaction;
            $remainingDailyQtyByPromo[$promo->id] = $promo->max_qty_per_customer_per_day !== null
                ? max(0, (int) $promo->max_qty_per_customer_per_day - ($dailyUsedQtyMap[$promo->id] ?? 0))
                : null;
        }

        $results = [];

        foreach ($preparedLines as $index => $line) {
            if ($line['is_promo_excluded']) {
                $results[$index] = [
                    'pricing_source' => 'regular',
                    'auto_discount_amount' => 0,
                    'free_qty' => 0,
                    'applied_promotion_id' => null,
                    'applied_promotion_name' => null,
                    'applied_promotion_type' => null,
                    'applied_promotion_funding' => null,
                    'applied_tier_min_qty' => null,
                    'quota_consumed' => 0,
                    'badge_label' => null,
                ];

                continue;
            }

            $wholesale = $wholesaleByLine[$index] ?? null;
            $wholesaleSavings = $wholesale !== null ? $wholesale['discount'] : 0;

            $bestPromo = null;
            $bestCalc = ['discount' => 0, 'free_qty' => 0, 'quota_consumed' => 0];

            foreach ($promotions as $promo) {
                if (! $this->promotionAppliesToProduct($promo, $line['product'])) {
                    continue;
                }

                $calc = $this->calculateLinePromotionDiscount(
                    $promo,
                    $line,
                    $remainingQuotaByPromo[$promo->id],
                    $remainingTxQtyByPromo[$promo->id],
                    $remainingDailyQtyByPromo[$promo->id]
                );

                if ($calc['discount'] <= 0) {
                    continue;
                }

                if ($bestPromo === null || $this->isBetterPromotionCandidate($calc['discount'], $promo, $bestCalc['discount'], $bestPromo)) {
                    $bestPromo = $promo;
                    $bestCalc = $calc;
                }
            }

            // Non-Stacking Default (Best Price): bandingkan Harga Grosir vs Promo Terbaik
            if ($wholesaleSavings >= $bestCalc['discount'] && $wholesaleSavings > 0 && $wholesale !== null) {
                $results[$index] = [
                    'pricing_source' => 'wholesale_tier',
                    'auto_discount_amount' => $wholesaleSavings,
                    'free_qty' => 0,
                    'applied_promotion_id' => null,
                    'applied_promotion_name' => null,
                    'applied_promotion_type' => 'wholesale_tier',
                    'applied_promotion_funding' => PromotionFunding::Store->value,
                    'applied_tier_min_qty' => $wholesale['min_qty'],
                    'quota_consumed' => 0,
                    'badge_label' => "Harga Grosir (≥{$wholesale['min_qty']})",
                ];
            } elseif ($bestPromo instanceof Promotion && $bestCalc['discount'] > 0) {
                if ($remainingQuotaByPromo[$bestPromo->id] !== null) {
                    $remainingQuotaByPromo[$bestPromo->id] = max(0, $remainingQuotaByPromo[$bestPromo->id] - $bestCalc['quota_consumed']);
                }
                if ($remainingTxQtyByPromo[$bestPromo->id] !== null) {
                    $remainingTxQtyByPromo[$bestPromo->id] = max(0, $remainingTxQtyByPromo[$bestPromo->id] - $bestCalc['quota_consumed']);
                }
                if ($remainingDailyQtyByPromo[$bestPromo->id] !== null) {
                    $remainingDailyQtyByPromo[$bestPromo->id] = max(0, $remainingDailyQtyByPromo[$bestPromo->id] - $bestCalc['quota_consumed']);
                }

                $results[$index] = [
                    'pricing_source' => 'promotion',
                    'auto_discount_amount' => $bestCalc['discount'],
                    'free_qty' => $bestCalc['free_qty'],
                    'applied_promotion_id' => $bestPromo->id,
                    'applied_promotion_name' => $bestPromo->name,
                    'applied_promotion_type' => $bestPromo->type->value,
                    'applied_promotion_funding' => $bestPromo->funding->value,
                    'applied_tier_min_qty' => null,
                    'quota_consumed' => $bestCalc['quota_consumed'],
                    'badge_label' => $bestPromo->name,
                ];
            } else {
                $results[$index] = [
                    'pricing_source' => 'regular',
                    'auto_discount_amount' => 0,
                    'free_qty' => 0,
                    'applied_promotion_id' => null,
                    'applied_promotion_name' => null,
                    'applied_promotion_type' => null,
                    'applied_promotion_funding' => null,
                    'applied_tier_min_qty' => null,
                    'quota_consumed' => 0,
                    'badge_label' => null,
                ];
            }
        }

        return $results;
    }

    /**
     * Evaluasi promo multi-SKU (`bundle` dan `mix_match`) terhadap pemenang single-line (Best Price).
     *
     * @param  array<int, array<string, mixed>>  $preparedLines
     * @param  array<int, array<string, mixed>>  $currentWinners
     * @param  EloquentCollection<int, Promotion>  $multiPromotions
     * @param  array<int, int>  $dailyUsedQtyMap
     * @return array{winners: array<int, array<string, mixed>>, applied_multi_promos: array<int, array<string, mixed>>}
     */
    private function resolveMultiLinePromotions(
        array $preparedLines,
        array $currentWinners,
        EloquentCollection $multiPromotions,
        array $dailyUsedQtyMap
    ): array {
        $lockedLineIndices = [];
        $appliedMultiPromos = [];

        // Evaluasi kandidat dan urutkan berdasarkan penghematan tertinggi -> priority tertinggi -> id terkecil
        $evaluatedCandidates = [];

        foreach ($multiPromotions as $promo) {
            $remainingQuota = $promo->remainingQuota();
            $remainingTxQty = $promo->max_qty_per_transaction;
            $remainingDailyQty = $promo->max_qty_per_customer_per_day !== null
                ? max(0, (int) $promo->max_qty_per_customer_per_day - ($dailyUsedQtyMap[$promo->id] ?? 0))
                : null;

            if ($promo->type === PromotionType::Bundle) {
                $eval = $this->evaluateBundleCandidate($promo, $preparedLines, $lockedLineIndices, $remainingQuota, $remainingTxQty, $remainingDailyQty);
            } else {
                $eval = $this->evaluateMixMatchCandidate($promo, $preparedLines, $lockedLineIndices, $remainingQuota, $remainingTxQty, $remainingDailyQty);
            }

            if ($eval !== null && $eval['total_discount'] > 0) {
                $evaluatedCandidates[] = [
                    'promo' => $promo,
                    'eval' => $eval,
                ];
            }
        }

        usort($evaluatedCandidates, function (array $a, array $b): int {
            if ($a['eval']['total_discount'] !== $b['eval']['total_discount']) {
                return $b['eval']['total_discount'] <=> $a['eval']['total_discount'];
            }
            if ($a['promo']->priority !== $b['promo']->priority) {
                return $b['promo']->priority <=> $a['promo']->priority;
            }

            return $a['promo']->id <=> $b['promo']->id;
        });

        foreach ($evaluatedCandidates as $candidate) {
            /** @var Promotion $promo */
            $promo = $candidate['promo'];
            $eval = $candidate['eval'];
            $participatingIndices = array_keys($eval['line_allocations']);

            // Pastikan belum ada baris yang dipakai promo multi-line lain
            $hasOverlap = false;
            foreach ($participatingIndices as $idx) {
                if (isset($lockedLineIndices[$idx])) {
                    $hasOverlap = true;
                    break;
                }
            }
            if ($hasOverlap) {
                continue;
            }

            // Bandingkan total penghematan multi-line vs jumlah penghematan single-line saat ini
            $existingSavings = 0;
            foreach ($participatingIndices as $idx) {
                $existingSavings += (int) ($currentWinners[$idx]['auto_discount_amount'] ?? 0);
            }

            if ($eval['total_discount'] <= $existingSavings) {
                continue;
            }

            foreach ($eval['line_allocations'] as $idx => $allocDiscount) {
                $lockedLineIndices[$idx] = true;
                $currentWinners[$idx] = [
                    'pricing_source' => 'promotion',
                    'auto_discount_amount' => $allocDiscount,
                    'free_qty' => 0,
                    'applied_promotion_id' => $promo->id,
                    'applied_promotion_name' => $promo->name,
                    'applied_promotion_type' => $promo->type->value,
                    'applied_promotion_funding' => $promo->funding->value,
                    'applied_tier_min_qty' => null,
                    'quota_consumed' => 0,
                    'badge_label' => $promo->name,
                ];
            }

            $appliedMultiPromos[] = [
                'promotion_id' => $promo->id,
                'name' => $promo->name,
                'type' => $promo->type->value,
                'funding' => $promo->funding->value,
                'sets' => $eval['sets'],
                'total_discount' => $eval['total_discount'],
                'discount_per_set' => $eval['discount_per_set'],
                'quota_consumed' => $eval['quota_consumed'],
                'max_daily' => $promo->max_qty_per_customer_per_day,
                'line_allocations' => $eval['line_allocations'],
                'snapshot' => $eval['snapshot'],
            ];
        }

        return [
            'winners' => $currentWinners,
            'applied_multi_promos' => $appliedMultiPromos,
        ];
    }

    /**
     * @param  array<int, array<string, mixed>>  $preparedLines
     * @param  array<int, bool>  $lockedLineIndices
     * @return array<string, mixed>|null
     */
    private function evaluateBundleCandidate(
        Promotion $promo,
        array $preparedLines,
        array $lockedLineIndices,
        ?int $remainingQuota,
        ?int $remainingTxQty,
        ?int $remainingDailyQty
    ): ?array {
        $bundleItems = $promo->bundleItems;
        $bundlePrice = PricingMath::toRupiah($promo->bundle_price);

        if ($bundleItems->isEmpty() || $bundlePrice <= 0) {
            return null;
        }

        // Kumpulkan baris integral non-excluded per product_id
        $linesByProduct = [];
        $qtyByProduct = [];
        foreach ($preparedLines as $idx => $line) {
            if (isset($lockedLineIndices[$idx]) || $line['is_promo_excluded'] || ! $line['is_integral_qty']) {
                continue;
            }
            $pid = (int) $line['product_id'];
            $linesByProduct[$pid][] = $idx;
            $qtyByProduct[$pid] = ($qtyByProduct[$pid] ?? 0) + (int) $line['qty'];
        }

        $maxSets = PHP_INT_MAX;
        $normalSetCost = 0;
        $bundleItemsSnapshot = [];

        foreach ($bundleItems as $bItem) {
            $pid = (int) $bItem->product_id;
            $reqQty = max(1, (int) $bItem->required_qty);
            $availQty = $qtyByProduct[$pid] ?? 0;

            $possibleSets = intdiv($availQty, $reqQty);
            if ($possibleSets < 1) {
                return null;
            }

            $maxSets = min($maxSets, $possibleSets);
            $firstLineIdx = $linesByProduct[$pid][0];
            $unitPrice = (int) $preparedLines[$firstLineIdx]['base_unit_price'];
            $normalSetCost += $reqQty * $unitPrice;

            $bundleItemsSnapshot[] = [
                'product_id' => $pid,
                'required_qty' => $reqQty,
                'unit_price' => $unitPrice,
            ];
        }

        if ($remainingQuota !== null) {
            $maxSets = min($maxSets, $remainingQuota);
        }
        if ($remainingTxQty !== null) {
            $maxSets = min($maxSets, $remainingTxQty);
        }
        if ($remainingDailyQty !== null) {
            $maxSets = min($maxSets, $remainingDailyQty);
        }

        if ($maxSets < 1) {
            return null;
        }

        $discountPerSet = max(0, $normalSetCost - $bundlePrice);
        if ($discountPerSet <= 0) {
            return null;
        }

        $totalDiscount = $maxSets * $discountPerSet;

        // Hitung bobot biaya normal setiap baris yang berpartisipasi untuk alokasi proporsional
        $lineWeights = [];
        foreach ($bundleItems as $bItem) {
            $pid = (int) $bItem->product_id;
            $needed = $maxSets * max(1, (int) $bItem->required_qty);
            foreach ($linesByProduct[$pid] as $idx) {
                if ($needed <= 0) {
                    break;
                }
                $take = min($needed, (int) $preparedLines[$idx]['qty']);
                $lineWeights[$idx] = ($lineWeights[$idx] ?? 0) + ($take * (int) $preparedLines[$idx]['base_unit_price']);
                $needed -= $take;
            }
        }

        $allocations = PricingMath::allocateProportionally($totalDiscount, $lineWeights);

        return [
            'sets' => $maxSets,
            'total_discount' => $totalDiscount,
            'discount_per_set' => $discountPerSet,
            'quota_consumed' => $maxSets,
            'line_allocations' => $allocations,
            'snapshot' => [
                'kind' => 'bundle',
                'bundle_price' => $bundlePrice,
                'normal_set_cost' => $normalSetCost,
                'discount_per_set' => $discountPerSet,
                'sets' => $maxSets,
                'bundle_items' => $bundleItemsSnapshot,
            ],
        ];
    }

    /**
     * @param  array<int, array<string, mixed>>  $preparedLines
     * @param  array<int, bool>  $lockedLineIndices
     * @return array<string, mixed>|null
     */
    private function evaluateMixMatchCandidate(
        Promotion $promo,
        array $preparedLines,
        array $lockedLineIndices,
        ?int $remainingQuota,
        ?int $remainingTxQty,
        ?int $remainingDailyQty
    ): ?array {
        $packQty = (int) ($promo->buy_qty ?? 0);
        if ($packQty < 2) {
            return null;
        }

        $bundlePrice = PricingMath::toRupiah($promo->bundle_price);
        $discountValue = (float) ($promo->discount_value ?? 0);
        if ($bundlePrice <= 0 && $discountValue <= 0.0) {
            return null;
        }

        $matchingLines = [];
        $totalMatchingQty = 0;

        foreach ($preparedLines as $idx => $line) {
            if (isset($lockedLineIndices[$idx]) || $line['is_promo_excluded'] || ! $line['is_integral_qty']) {
                continue;
            }
            if (! $this->promotionAppliesToProduct($promo, $line['product'])) {
                continue;
            }

            $matchingLines[$idx] = $line;
            $totalMatchingQty += (int) $line['qty'];
        }

        $capQty = $totalMatchingQty;
        if ($remainingQuota !== null) {
            $capQty = min($capQty, $remainingQuota);
        }
        if ($remainingTxQty !== null) {
            $capQty = min($capQty, $remainingTxQty);
        }
        if ($remainingDailyQty !== null) {
            $capQty = min($capQty, $remainingDailyQty);
        }

        $sets = intdiv($capQty, $packQty);
        if ($sets < 1) {
            return null;
        }

        $unitsToBundle = $sets * $packQty;

        // Urutkan baris berdasarkan harga satuan tertinggi agar penghematan maksimal & deterministik
        $sortedIndices = array_keys($matchingLines);
        usort($sortedIndices, function (int $a, int $b) use ($matchingLines): int {
            if ($matchingLines[$a]['base_unit_price'] !== $matchingLines[$b]['base_unit_price']) {
                return $matchingLines[$b]['base_unit_price'] <=> $matchingLines[$a]['base_unit_price'];
            }

            return $a <=> $b;
        });

        $normalBundledCost = 0;
        $lineWeights = [];
        $remainingToTake = $unitsToBundle;

        foreach ($sortedIndices as $idx) {
            if ($remainingToTake <= 0) {
                break;
            }
            $take = min($remainingToTake, (int) $matchingLines[$idx]['qty']);
            $cost = $take * (int) $matchingLines[$idx]['base_unit_price'];
            $normalBundledCost += $cost;
            $lineWeights[$idx] = $cost;
            $remainingToTake -= $take;
        }

        if ($bundlePrice > 0) {
            $totalDiscount = max(0, $normalBundledCost - ($sets * $bundlePrice));
        } elseif ($discountValue <= 100.0) {
            $totalDiscount = PricingMath::percentageDiscount(
                $normalBundledCost,
                $discountValue,
                $promo->max_discount_amount !== null ? PricingMath::toRupiah($promo->max_discount_amount) : null
            );
        } else {
            $totalDiscount = min($normalBundledCost, $sets * PricingMath::toRupiah($discountValue));
        }

        if ($totalDiscount <= 0) {
            return null;
        }

        $allocations = PricingMath::allocateProportionally($totalDiscount, $lineWeights);

        return [
            'sets' => $sets,
            'total_discount' => $totalDiscount,
            'discount_per_set' => intdiv($totalDiscount, $sets),
            'quota_consumed' => $unitsToBundle,
            'line_allocations' => $allocations,
            'snapshot' => [
                'kind' => 'mix_match',
                'buy_qty' => $packQty,
                'bundle_price' => $bundlePrice,
                'discount_value' => $discountValue,
                'max_discount_amount' => $promo->max_discount_amount !== null ? PricingMath::toRupiah($promo->max_discount_amount) : null,
                'sets' => $sets,
            ],
        ];
    }

    /**
     * Cek apakah promo berlaku untuk produk tertentu sesuai scope.
     */
    private function promotionAppliesToProduct(Promotion $promo, Product $product): bool
    {
        return match ($promo->scope) {
            PromotionScope::AllProducts => true,
            PromotionScope::Product => $promo->products->contains('id', $product->id),
            PromotionScope::Category => $product->category_id !== null
                && $promo->categories->contains('id', $product->category_id),
        };
    }

    /**
     * Hitung potongan promo item-level single-line (integer Rupiah floor) dengan memperhitungkan kuota & batas harian.
     *
     * @param  array<string, mixed>  $line
     * @return array{discount: int, free_qty: int, quota_consumed: int}
     */
    private function calculateLinePromotionDiscount(
        Promotion $promo,
        array $line,
        ?int $remainingQuota,
        ?int $remainingTxQty,
        ?int $remainingDailyQty = null
    ): array {
        $qty = $line['qty'];
        $isIntegralQty = (bool) $line['is_integral_qty'];
        $baseUnitPrice = (int) $line['base_unit_price'];

        // Terapkan batas kuota / max_qty_per_transaction / max_qty_per_customer_per_day
        $capQuota = null;
        foreach ([$remainingQuota, $remainingTxQty, $remainingDailyQty] as $limit) {
            if ($limit !== null) {
                $capQuota = $capQuota === null ? $limit : min($capQuota, $limit);
            }
        }

        if ($capQuota !== null && $capQuota <= 0) {
            return ['discount' => 0, 'free_qty' => 0, 'quota_consumed' => 0];
        }

        $eligibleQty = (float) $qty;
        if ($capQuota !== null) {
            $eligibleQty = min($eligibleQty, (float) $capQuota);
        }

        if ($eligibleQty <= 0.0) {
            return ['discount' => 0, 'free_qty' => 0, 'quota_consumed' => 0];
        }

        $eligibleGross = PricingMath::floorRupiah($baseUnitPrice * $eligibleQty);
        $quotaUnits = (int) floor($eligibleQty + 1e-9);
        $totalCartUnits = (int) floor((float) $qty + 1e-9);

        return match ($promo->type) {
            PromotionType::PercentageDiscount => [
                'discount' => PricingMath::percentageDiscount(
                    $eligibleGross,
                    (float) ($promo->discount_value ?? 0),
                    $promo->max_discount_amount !== null ? PricingMath::toRupiah($promo->max_discount_amount) : null
                ),
                'free_qty' => 0,
                'quota_consumed' => max(1, $quotaUnits),
            ],

            PromotionType::FixedDiscount => [
                'discount' => min(
                    PricingMath::floorRupiah(PricingMath::toRupiah($promo->discount_value) * $eligibleQty),
                    $eligibleGross
                ),
                'free_qty' => 0,
                'quota_consumed' => max(1, $quotaUnits),
            ],

            PromotionType::BuyXGetY => (function () use ($promo, $isIntegralQty, $totalCartUnits, $capQuota, $baseUnitPrice): array {
                if (! $isIntegralQty) {
                    return ['discount' => 0, 'free_qty' => 0, 'quota_consumed' => 0];
                }

                $buyQty = (int) ($promo->buy_qty ?? 0);
                $getQty = (int) ($promo->get_qty ?? 0);
                if ($buyQty < 1 || $getQty < 1) {
                    return ['discount' => 0, 'free_qty' => 0, 'quota_consumed' => 0];
                }

                $bundleSize = $buyQty + $getQty;
                $sets = intdiv($totalCartUnits, $bundleSize);
                if ($sets < 1) {
                    return ['discount' => 0, 'free_qty' => 0, 'quota_consumed' => 0];
                }

                // Kuota dihitung hanya dari jumlah item bonus/gratis yang didiskon, bukan seluruh item di struk
                $bonusUnits = $sets * $getQty;
                if ($capQuota !== null) {
                    $bonusUnits = min($bonusUnits, $capQuota);
                }
                if ($bonusUnits < 1) {
                    return ['discount' => 0, 'free_qty' => 0, 'quota_consumed' => 0];
                }

                $discountPercent = (float) ($promo->get_discount_percent ?? 100.0);
                $discount = PricingMath::percentageDiscount($bonusUnits * $baseUnitPrice, $discountPercent);

                return [
                    'discount' => $discount,
                    'free_qty' => $discountPercent >= 100.0 ? $bonusUnits : 0,
                    'quota_consumed' => $bonusUnits,
                ];
            })(),

            PromotionType::MultibuyPrice => (function () use ($promo, $isIntegralQty, $quotaUnits, $baseUnitPrice): array {
                if (! $isIntegralQty) {
                    return ['discount' => 0, 'free_qty' => 0, 'quota_consumed' => 0];
                }

                $packQty = (int) ($promo->buy_qty ?? 0);
                $packPrice = PricingMath::toRupiah($promo->bundle_price ?? $promo->discount_value);
                if ($packQty < 2 || $packPrice <= 0) {
                    return ['discount' => 0, 'free_qty' => 0, 'quota_consumed' => 0];
                }

                $sets = intdiv($quotaUnits, $packQty);
                if ($sets < 1) {
                    return ['discount' => 0, 'free_qty' => 0, 'quota_consumed' => 0];
                }

                $normalCost = $sets * $packQty * $baseUnitPrice;
                $promoCost = $sets * $packPrice;
                $discount = max(0, $normalCost - $promoCost);

                return [
                    'discount' => $discount,
                    'free_qty' => 0,
                    'quota_consumed' => $sets * $packQty,
                ];
            })(),

            PromotionType::NthItemDiscount => (function () use ($promo, $isIntegralQty, $totalCartUnits, $capQuota, $baseUnitPrice): array {
                if (! $isIntegralQty) {
                    return ['discount' => 0, 'free_qty' => 0, 'quota_consumed' => 0];
                }

                $nth = (int) ($promo->nth_item ?? 0);
                if ($nth < 2) {
                    return ['discount' => 0, 'free_qty' => 0, 'quota_consumed' => 0];
                }

                // Kuota dihitung hanya dari item ke-N yang mendapat diskon, bukan seluruh item di struk
                $discountedUnits = intdiv($totalCartUnits, $nth);
                if ($capQuota !== null) {
                    $discountedUnits = min($discountedUnits, $capQuota);
                }
                if ($discountedUnits < 1) {
                    return ['discount' => 0, 'free_qty' => 0, 'quota_consumed' => 0];
                }

                $rawVal = $promo->discount_value !== null ? (float) $promo->discount_value : 0.0;
                if ($rawVal > 100.0) {
                    $perUnitDiscount = min(PricingMath::toRupiah($rawVal), $baseUnitPrice);
                } elseif ($rawVal > 0.0) {
                    $perUnitDiscount = PricingMath::percentageDiscount($baseUnitPrice, $rawVal);
                } else {
                    $pct = (float) ($promo->get_discount_percent ?? 100.0);
                    $perUnitDiscount = PricingMath::percentageDiscount($baseUnitPrice, $pct);
                }

                $discount = $discountedUnits * $perUnitDiscount;
                if ($promo->max_discount_amount !== null) {
                    $discount = min($discount, PricingMath::toRupiah($promo->max_discount_amount));
                }

                return [
                    'discount' => max(0, $discount),
                    'free_qty' => $perUnitDiscount >= $baseUnitPrice ? $discountedUnits : 0,
                    'quota_consumed' => $discountedUnits,
                ];
            })(),

            PromotionType::NearExpiry => (function () use ($promo, $line, $eligibleGross, $quotaUnits): array {
                $thresholdDays = (int) ($promo->near_expiry_days ?? 0);
                $daysUntilExpiry = $line['days_until_expiry'] ?? null;

                if ($thresholdDays < 1 || $daysUntilExpiry === null || $daysUntilExpiry > $thresholdDays) {
                    return ['discount' => 0, 'free_qty' => 0, 'quota_consumed' => 0];
                }

                $discount = PricingMath::percentageDiscount(
                    $eligibleGross,
                    (float) ($promo->discount_value ?? 0),
                    $promo->max_discount_amount !== null ? PricingMath::toRupiah($promo->max_discount_amount) : null
                );

                return [
                    'discount' => $discount,
                    'free_qty' => 0,
                    'quota_consumed' => max(1, $quotaUnits),
                ];
            })(),

            default => ['discount' => 0, 'free_qty' => 0, 'quota_consumed' => 0],
        };
    }

    /**
     * Tie-breaker deterministik: penghematan terbesar menang; jika seri, priority tertinggi lalu id terkecil.
     */
    private function isBetterPromotionCandidate(
        int $candidateDiscount,
        Promotion $candidate,
        int $currentDiscount,
        Promotion $current
    ): bool {
        if ($candidateDiscount !== $currentDiscount) {
            return $candidateDiscount > $currentDiscount;
        }

        if ($candidate->priority !== $current->priority) {
            return $candidate->priority > $current->priority;
        }

        return $candidate->id < $current->id;
    }
}

<?php

namespace App\Services;

use App\Enums\ActivityLogCategory;
use App\Enums\PaymentMethod;
use App\Enums\PromotionType;
use App\Enums\RoundingMode;
use App\Enums\StockMovementType;
use App\Enums\TransactionStatus;
use App\Enums\UserRoles;
use App\Models\AppliedPromotion;
use App\Models\CashierShift;
use App\Models\HeldTransaction;
use App\Models\Product;
use App\Models\ProductUnit;
use App\Models\Promotion;
use App\Models\PromotionDailyUsage;
use App\Models\StockMovement;
use App\Models\Transaction;
use App\Models\TransactionDetail;
use App\Models\TransactionPayment;
use App\Models\User;
use App\Models\Voucher;
use App\Support\PricingMath;
use Illuminate\Database\Eloquent\Collection as EloquentCollection;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class PosTransactionService
{
    /**
     * Batas nominal diskon manual untuk kasir sebelum wajib otorisasi PIN Supervisor/Admin.
     */
    public const float MANUAL_DISCOUNT_PIN_THRESHOLD = 0.0;

    public function __construct(
        public CashierShiftService $cashierShiftService,
        public FinanceService $financeService,
        public StoreSettingService $storeSettingService,
        public SupervisorPinService $supervisorPinService,
        public PosPricingService $posPricingService,
        public VoucherService $voucherService,
    ) {}

    /**
     * Pencarian cepat produk aktif berdasarkan barcode produk, barcode unit (multi-UOM), atau nama produk.
     *
     * @return array<int, array{
     *     id: int,
     *     barcode: string,
     *     name: string,
     *     base_unit: string,
     *     sell_price: float,
     *     stock: int,
     *     image: string|null,
     *     is_tax_exempt: bool,
     *     is_donation: bool,
     *     matched_unit_id: int|null,
     *     units: array<int, array{id: int, unit_name: string, conversion_factor: int, barcode: string|null, sell_price: float}>
     * }>
     */
    public function lookupProducts(string $query, int $limit = 15): array
    {
        $term = trim($query);
        if ($term === '') {
            return [];
        }

        // 1. Cek kecocokan persis barcode unit (multi-UOM) terlebih dahulu
        /** @var ProductUnit|null $exactUnit */
        $exactUnit = ProductUnit::query()
            ->where('barcode', $term)
            ->where('is_active', true)
            ->whereHas('product', fn ($q) => $q->where('active', true))
            ->with(['product.units' => fn ($q) => $q->where('is_active', true)->orderBy('conversion_factor')])
            ->first();

        if ($exactUnit !== null && $exactUnit->product !== null) {
            return [$this->formatProductLookupRow($exactUnit->product, $exactUnit->id)];
        }

        // 2. Cek kecocokan persis barcode produk
        /** @var Product|null $exactProduct */
        $exactProduct = Product::query()
            ->where('active', true)
            ->where('barcode', $term)
            ->with(['units' => fn ($q) => $q->where('is_active', true)->orderBy('conversion_factor')])
            ->first();

        if ($exactProduct !== null) {
            return [$this->formatProductLookupRow($exactProduct, null)];
        }

        // 3. Pencarian parsial berdasarkan nama / barcode produk / barcode unit
        $likeOperator = DB::connection()->getDriverName() === 'pgsql' ? 'ilike' : 'like';

        /** @var EloquentCollection<int, Product> $products */
        $products = Product::query()
            ->where('active', true)
            ->where(function ($q) use ($term, $likeOperator): void {
                $q->where('name', $likeOperator, "%{$term}%")
                    ->orWhere('barcode', $likeOperator, "%{$term}%")
                    ->orWhereHas('units', function ($uq) use ($term, $likeOperator): void {
                        $uq->where('is_active', true)
                            ->where('barcode', $likeOperator, "%{$term}%");
                    });
            })
            ->with(['units' => fn ($q) => $q->where('is_active', true)->orderBy('conversion_factor')])
            ->orderBy('name')
            ->limit(max(1, min($limit, 50)))
            ->get();

        return $products
            ->map(fn (Product $product): array => $this->formatProductLookupRow($product, null))
            ->values()
            ->all();
    }

    /**
     * Menghitung pembulatan sesuai konfigurasi RoundingMode toko.
     *
     * @return array{rounded: float, rounding_amount: float}
     */
    public function applyRounding(float $amount, RoundingMode $mode): array
    {
        $cleanAmount = round($amount, 2);

        $rounded = match ($mode) {
            RoundingMode::None => $cleanAmount,
            RoundingMode::Nearest100 => round($cleanAmount / 100) * 100,
            RoundingMode::Down100 => floor($cleanAmount / 100) * 100,
            RoundingMode::Up100 => ceil($cleanAmount / 100) * 100,
            RoundingMode::Nearest500 => round($cleanAmount / 500) * 500,
        };

        $rounded = round($rounded, 2);
        $roundingAmount = round($rounded - $cleanAmount, 2);

        return [
            'rounded' => $rounded,
            'rounding_amount' => $roundingAmount,
        ];
    }

    /**
     * Memproses checkout POS secara atomik dengan pessimistic locking stok & sinkronisasi keuangan.
     *
     * @param  array{
     *     customer_id?: int|null,
     *     held_transaction_id?: int|null,
     *     discount_amount?: float|int|string|null,
     *     donation_product_id?: int|null,
     *     donation_amount?: float|int|string|null,
     *     supervisor_pin?: string|null,
     *     items: array<int, array{product_id: int, product_unit_id?: int|null, qty: int, discount_amount?: float|int|string|null}>,
     *     payments: array<int, array{payment_method: string, financial_account_id: int, amount: float|int|string, reference_number?: string|null}>
     * }  $data
     */
    public function checkout(User $actor, array $data): Transaction
    {
        $activeShift = $this->cashierShiftService->getActiveShiftForUser($actor);

        if (! $activeShift instanceof CashierShift) {
            throw ValidationException::withMessages([
                'shift' => 'Anda belum memiliki sesi shift aktif. Buka shift terlebih dahulu sebelum melakukan checkout.',
            ]);
        }

        return DB::transaction(function () use ($actor, $activeShift, $data): Transaction {
            /** @var CashierShift $lockedShift */
            $lockedShift = CashierShift::query()
                ->where('id', $activeShift->id)
                ->lockForUpdate()
                ->firstOrFail();

            if (! $lockedShift->isOpen()) {
                throw ValidationException::withMessages([
                    'shift' => 'Sesi shift Anda sudah ditutup.',
                ]);
            }

            // 1. Urutkan product_id dan lakukan lockForUpdate() untuk mencegah race condition & deadlock PostgreSQL
            $productIds = array_values(array_unique(array_map(
                fn (array $item): int => (int) $item['product_id'],
                $data['items']
            )));
            sort($productIds);

            /** @var EloquentCollection<int, Product> $lockedProducts */
            $lockedProducts = Product::query()
                ->whereIn('id', $productIds)
                ->orderBy('id')
                ->lockForUpdate()
                ->get()
                ->keyBy('id');

            $unitIds = array_values(array_unique(array_filter(array_map(
                fn (array $item): ?int => isset($item['product_unit_id']) ? (int) $item['product_unit_id'] : null,
                $data['items']
            ))));

            /** @var EloquentCollection<int, ProductUnit> $unitsMap */
            $unitsMap = ! empty($unitIds)
                ? ProductUnit::query()->whereIn('id', $unitIds)->get()->keyBy('id')
                : new EloquentCollection;

            // 2. Validasi produk, satuan multi-UOM, dan akumulasi base_qty
            $validatedRawLines = [];
            $pricingInputItems = [];
            $accumulatedBaseQty = [];
            $referenceAt = now();

            foreach ($data['items'] as $index => $line) {
                $productId = (int) $line['product_id'];
                /** @var Product|null $product */
                $product = $lockedProducts->get($productId);

                if (! $product instanceof Product || ! $product->active) {
                    throw ValidationException::withMessages([
                        "items.{$index}.product_id" => 'Produk tidak ditemukan atau sedang nonaktif.',
                    ]);
                }

                $qty = (int) $line['qty'];
                if ($qty < 1) {
                    throw ValidationException::withMessages([
                        "items.{$index}.qty" => "Jumlah produk {$product->name} minimal 1.",
                    ]);
                }

                $productUnitId = isset($line['product_unit_id']) ? (int) $line['product_unit_id'] : null;
                $unitName = $product->base_unit ?: 'pcs';
                $conversionFactor = 1;

                if ($productUnitId !== null) {
                    /** @var ProductUnit|null $unit */
                    $unit = $unitsMap->get($productUnitId);
                    if (! $unit instanceof ProductUnit || $unit->product_id !== $product->id || ! $unit->is_active) {
                        throw ValidationException::withMessages([
                            "items.{$index}.product_unit_id" => "Satuan unit untuk produk {$product->name} tidak valid atau nonaktif.",
                        ]);
                    }

                    $unitName = $unit->unit_name;
                    $conversionFactor = max(1, (int) $unit->conversion_factor);
                }

                $baseQty = $qty * $conversionFactor;
                $isDonation = (bool) $product->is_donation;
                if (! $isDonation) {
                    $accumulatedBaseQty[$productId] = ($accumulatedBaseQty[$productId] ?? 0) + $baseQty;
                }

                $requestedManualItemDiscount = PricingMath::floorRupiah($line['discount_amount'] ?? 0);

                $validatedRawLines[$index] = [
                    'product' => $product,
                    'product_unit_id' => $productUnitId,
                    'unit_name_snapshot' => $unitName,
                    'conversion_factor' => $conversionFactor,
                    'qty' => $qty,
                    'base_qty' => $baseQty,
                    'requested_manual_discount' => $requestedManualItemDiscount,
                    'is_donation' => $isDonation,
                ];

                $pricingInputItems[$index] = [
                    'product_id' => $product->id,
                    'product_unit_id' => $productUnitId,
                    'qty' => $qty,
                    'discount_amount' => $requestedManualItemDiscount,
                ];
            }

            // 3. Validasi kecukupan stok berdasarkan akumulasi base_qty per product_id
            foreach ($accumulatedBaseQty as $productId => $totalNeeded) {
                /** @var Product $product */
                $product = $lockedProducts->get($productId);
                if ((int) $product->stock < $totalNeeded) {
                    throw ValidationException::withMessages([
                        'items' => sprintf(
                            'Stok %s tidak mencukupi (tersedia: %d %s, dibutuhkan: %d %s).',
                            $product->name,
                            (int) $product->stock,
                            $product->base_unit ?: 'pcs',
                            $totalNeeded,
                            $product->base_unit ?: 'pcs'
                        ),
                    ]);
                }
            }

            // 3B. Identifikasi apakah transaksi memiliki komponen pembayaran tunai (pembulatan khusus tunai)
            $hasCashPayment = false;
            foreach ($data['payments'] as $paymentRow) {
                if ((string) $paymentRow['payment_method'] === PaymentMethod::Cash->value) {
                    $hasCashPayment = true;
                    break;
                }
            }

            $customerId = isset($data['customer_id']) ? (int) $data['customer_id'] : null;
            $requestedTxDiscount = PricingMath::floorRupiah($data['discount_amount'] ?? 0);
            $voucherCode = isset($data['voucher_code']) && trim((string) $data['voucher_code']) !== ''
                ? trim((string) $data['voucher_code'])
                : null;
            $voucherReservationToken = isset($data['voucher_reservation_token']) && trim((string) $data['voucher_reservation_token']) !== ''
                ? trim((string) $data['voucher_reservation_token'])
                : null;
            $vouchersInput = is_array($data['vouchers'] ?? null) ? $data['vouchers'] : [];
            $selectedTebusMurahPromoId = isset($data['selected_tebus_murah_promotion_id']) && $data['selected_tebus_murah_promotion_id'] !== null
                ? (int) $data['selected_tebus_murah_promotion_id']
                : null;

            $pricingPayments = array_map(fn (array $pRow): array => [
                'payment_method' => (string) $pRow['payment_method'],
                'amount' => $pRow['amount'] ?? 0,
                'card_bin' => isset($pRow['card_bin']) ? (string) $pRow['card_bin'] : null,
                'reference_number' => isset($pRow['reference_number']) ? (string) $pRow['reference_number'] : null,
            ], $data['payments']);

            // 4. Evaluasi harga grosir, promo otomatis, promo transaksi, voucher, promo bayar, PPN & pembulatan via PosPricingService
            $pricing = $this->posPricingService->evaluateCart(
                $pricingInputItems,
                $customerId,
                $referenceAt,
                $requestedTxDiscount,
                $hasCashPayment,
                $voucherCode,
                $voucherReservationToken,
                null,
                'pos',
                $pricingPayments,
                $selectedTebusMurahPromoId,
                $vouchersInput
            );

            $evaluatedVouchers = is_array($pricing['vouchers'] ?? null) ? $pricing['vouchers'] : [];
            if (! empty($vouchersInput)) {
                foreach ($evaluatedVouchers as $vInfo) {
                    if (! is_array($vInfo) || ! ($vInfo['applied'] ?? false)) {
                        throw ValidationException::withMessages([
                            'voucher_code' => is_array($vInfo) && ! empty($vInfo['message'])
                                ? (string) $vInfo['message']
                                : 'Voucher tidak valid atau tidak memenuhi syarat.',
                        ]);
                    }
                }
            } elseif ($voucherCode !== null) {
                $voucherInfo = $pricing['voucher'] ?? null;
                if (! is_array($voucherInfo) || ! ($voucherInfo['applied'] ?? false)) {
                    throw ValidationException::withMessages([
                        'voucher_code' => is_array($voucherInfo) && ! empty($voucherInfo['message'])
                            ? (string) $voucherInfo['message']
                            : 'Voucher tidak valid atau tidak memenuhi syarat.',
                    ]);
                }
            }

            $evaluatedByIndex = [];
            foreach ($pricing['items'] as $evalRow) {
                $evaluatedByIndex[$evalRow['index']] = $evalRow;
            }

            $resolvedLines = [];
            $cartDonationTotal = 0.0;

            foreach ($validatedRawLines as $index => $raw) {
                $eval = $evaluatedByIndex[$index];
                /** @var Product $product */
                $product = $raw['product'];

                $maxAllowedManualItem = max(0, $eval['line_gross'] - $eval['auto_discount_amount']);
                if ($raw['requested_manual_discount'] > $maxAllowedManualItem) {
                    throw ValidationException::withMessages([
                        "items.{$index}.discount_amount" => "Diskon manual item {$product->name} tidak boleh melebihi sisa subtotal item.",
                    ]);
                }

                if ($raw['is_donation']) {
                    $cartDonationTotal += $eval['line_subtotal'];
                }

                $resolvedLines[] = [
                    'source_index' => $index,
                    'product' => $product,
                    'product_unit_id' => $raw['product_unit_id'],
                    'unit_name_snapshot' => $raw['unit_name_snapshot'],
                    'conversion_factor' => $raw['conversion_factor'],
                    'qty' => $raw['qty'],
                    'base_qty' => $raw['base_qty'],
                    'unit_price' => (float) $eval['base_unit_price'],
                    'cost_price_snapshot' => $raw['is_donation'] ? 0.0 : round((float) $product->buy_price, 2),
                    'auto_discount_amount' => (float) $eval['auto_discount_amount'],
                    'discount_amount' => (float) $eval['discount_amount'],
                    'applied_promotion_id' => $eval['applied_promotion_id'],
                    'applied_promotion_name' => $eval['applied_promotion_name'],
                    'applied_promotion_type' => $eval['applied_promotion_type'],
                    'applied_promotion_funding' => $eval['applied_promotion_funding'],
                    'applied_tier_min_qty' => $eval['applied_tier_min_qty'],
                    'quota_consumed' => $eval['quota_consumed'],
                    'pricing_source' => $eval['pricing_source'],
                    'allocated_header_discount' => (float) $eval['allocated_header_discount'],
                    'voucher_allocated_discount' => (int) ($pricing['voucher_line_allocations'][$index] ?? 0),
                    'free_qty' => $eval['free_qty'],
                    'is_promo_excluded' => $eval['is_promo_excluded'],
                    'is_tax_exempt' => $eval['is_tax_exempt'],
                    'is_donation' => $raw['is_donation'],
                    'subtotal' => (float) $eval['line_subtotal'],
                ];
            }

            $summary = $pricing['summary'];
            $grossSubtotal = (float) $summary['gross_subtotal'];
            $totalDiscount = (float) $summary['total_discount'];
            $manualDiscountTotal = (float) $summary['manual_discount_total'];
            $taxableAmount = (float) $summary['taxable_amount'];
            $taxExemptAmount = (float) $summary['tax_exempt_amount'];
            $taxAmount = (float) $summary['tax_amount'];
            $roundingAmount = (float) $summary['rounding_amount'];
            $grandTotal = (float) $summary['grand_total'];

            $subtotalAfterItemDiscounts = max(0, $summary['gross_subtotal'] - $summary['item_discount_total']);
            if ($requestedTxDiscount > $subtotalAfterItemDiscounts) {
                throw ValidationException::withMessages([
                    'discount_amount' => 'Total diskon tidak boleh melebihi subtotal belanja.',
                ]);
            }

            // 5. Validasi PIN Supervisor HANYA untuk diskon manual (promo & harga grosir otomatis tidak butuh PIN)
            $discountApprovedBy = null;
            if ($manualDiscountTotal > self::MANUAL_DISCOUNT_PIN_THRESHOLD) {
                if ($actor->hasRoles([UserRoles::Admin, UserRoles::Supervisor]) && empty($data['supervisor_pin'])) {
                    $discountApprovedBy = $actor->id;
                } else {
                    $approver = $this->supervisorPinService->verify(
                        $data['supervisor_pin'] ?? null,
                        'Diskon manual melebihi batas kasir. Masukkan PIN Supervisor / Admin untuk melanjutkan.'
                    );
                    $discountApprovedBy = $approver->id;
                }
            }

            // 5B. Update kuota promo secara atomik (aman untuk PostgreSQL & SQLite)
            foreach ($pricing['promotion_quota_usage'] as $promoId => $consumed) {
                if ($consumed <= 0) {
                    continue;
                }

                $updatedRows = Promotion::query()
                    ->where('id', $promoId)
                    ->where(function ($q) use ($consumed): void {
                        $q->whereNull('quota_total')
                            ->orWhereRaw('(quota_used + ?) <= quota_total', [$consumed]);
                    })
                    ->increment('quota_used', $consumed);

                if ($updatedRows === 0) {
                    throw ValidationException::withMessages([
                        'items' => 'Kuota promo telah habis saat transaksi diproses. Silakan muat ulang keranjang.',
                    ]);
                }
            }

            // 5C. Update kuota harian promo secara atomik (promotion_daily_usages)
            $dailyUsageByPromoId = [];
            $dailyUsagePlan = is_array($pricing['promotion_daily_usage_plan'] ?? null)
                ? $pricing['promotion_daily_usage_plan']
                : [];
            if (! empty($dailyUsagePlan)) {
                $planPromoIds = array_values(array_unique(array_map(
                    fn (array $row): int => (int) $row['promotion_id'],
                    $dailyUsagePlan
                )));
                /** @var EloquentCollection<int, Promotion> $planPromosMap */
                $planPromosMap = Promotion::query()->whereIn('id', $planPromoIds)->get()->keyBy('id');

                foreach ($dailyUsagePlan as $planRow) {
                    $pid = (int) $planRow['promotion_id'];
                    /** @var Promotion|null $promoModel */
                    $promoModel = $planPromosMap->get($pid);
                    $limitByCount = $promoModel instanceof Promotion && ! $promoModel->type->isItemLevel();

                    $this->consumeDailyUsage(
                        $pid,
                        (string) $planRow['usage_date'],
                        $planRow['customer_id'] !== null ? (int) $planRow['customer_id'] : null,
                        (int) $planRow['qty'],
                        (int) $planRow['count'],
                        (int) $planRow['max_daily'],
                        $limitByCount
                    );

                    $dailyUsageByPromoId[$pid] = $planRow;
                }
            }

            // 6. Validasi pembayaran (single & split payment)
            $paidAmount = 0.0;
            $nonCashAmount = 0.0;
            $normalizedPayments = [];

            foreach ($data['payments'] as $pIndex => $paymentRow) {
                $method = PaymentMethod::from((string) $paymentRow['payment_method']);
                $amount = round((float) $paymentRow['amount'], 2);
                if ($grandTotal > 0 && $amount <= 0) {
                    throw ValidationException::withMessages([
                        "payments.{$pIndex}.amount" => 'Nominal pembayaran harus lebih besar dari 0.',
                    ]);
                }
                if ($amount < 0) {
                    throw ValidationException::withMessages([
                        "payments.{$pIndex}.amount" => 'Nominal pembayaran tidak boleh negatif.',
                    ]);
                }

                $paidAmount = round($paidAmount + $amount, 2);
                if ($method !== PaymentMethod::Cash) {
                    $nonCashAmount = round($nonCashAmount + $amount, 2);
                }

                $normalizedPayments[] = [
                    'payment_method' => $method,
                    'financial_account_id' => (int) $paymentRow['financial_account_id'],
                    'amount' => $amount,
                    'reference_number' => isset($paymentRow['reference_number']) && trim((string) $paymentRow['reference_number']) !== ''
                        ? trim((string) $paymentRow['reference_number'])
                        : null,
                ];
            }

            if ($paidAmount < $grandTotal) {
                throw ValidationException::withMessages([
                    'payments' => sprintf(
                        'Total pembayaran (Rp %s) kurang dari total tagihan (Rp %s).',
                        number_format($paidAmount, 0, ',', '.'),
                        number_format($grandTotal, 0, ',', '.')
                    ),
                ]);
            }

            if ($nonCashAmount > $grandTotal) {
                throw ValidationException::withMessages([
                    'payments' => 'Pembayaran non-tunai tidak boleh melebihi total tagihan (kembalian hanya berlaku untuk pembayaran tunai).',
                ]);
            }

            $rawChangeAmount = round(max(0.0, $paidAmount - $grandTotal), 2);
            $changeDonationAmount = round(max(0.0, (float) ($data['donation_amount'] ?? 0)), 2);

            if ($changeDonationAmount > 0.0) {
                if ($changeDonationAmount > $rawChangeAmount) {
                    throw ValidationException::withMessages([
                        'donation_amount' => sprintf(
                            'Nominal donasi kembalian (Rp %s) tidak boleh melebihi uang kembalian (Rp %s).',
                            number_format($changeDonationAmount, 0, ',', '.'),
                            number_format($rawChangeAmount, 0, ',', '.')
                        ),
                    ]);
                }

                $donationProductId = isset($data['donation_product_id']) ? (int) $data['donation_product_id'] : null;
                /** @var Product|null $donationProduct */
                $donationProduct = $donationProductId !== null
                    ? Product::query()
                        ->where('id', $donationProductId)
                        ->where('active', true)
                        ->where('is_donation', true)
                        ->first()
                    : null;

                if (! $donationProduct instanceof Product) {
                    throw ValidationException::withMessages([
                        'donation_product_id' => 'Pilih produk donasi aktif yang valid untuk menyalurkan kembalian.',
                    ]);
                }

                $resolvedLines[] = [
                    'product' => $donationProduct,
                    'product_unit_id' => null,
                    'unit_name_snapshot' => $donationProduct->base_unit ?: 'pcs',
                    'conversion_factor' => 1,
                    'qty' => 1,
                    'base_qty' => 1,
                    'unit_price' => $changeDonationAmount,
                    'cost_price_snapshot' => 0.0,
                    'auto_discount_amount' => 0.0,
                    'discount_amount' => 0.0,
                    'applied_promotion_id' => null,
                    'applied_promotion_name' => null,
                    'applied_promotion_type' => null,
                    'applied_promotion_funding' => null,
                    'applied_tier_min_qty' => null,
                    'quota_consumed' => 0,
                    'pricing_source' => 'regular',
                    'allocated_header_discount' => 0.0,
                    'free_qty' => 0,
                    'is_promo_excluded' => true,
                    'is_tax_exempt' => true,
                    'is_donation' => true,
                    'subtotal' => $changeDonationAmount,
                ];

                $grandTotal = round($grandTotal + $changeDonationAmount, 2);
            }

            $totalDonationAmount = round($cartDonationTotal + $changeDonationAmount, 2);
            $changeAmount = round(max(0.0, $paidAmount - $grandTotal), 2);

            $uniqueMethods = array_values(array_unique(array_map(
                fn (array $p): string => $p['payment_method']->value,
                $normalizedPayments
            )));
            $legacyPaymentMethod = count($uniqueMethods) === 1 ? $uniqueMethods[0] : 'split';

            // 7. Generate invoice_number unik aman konkurensi
            $invoiceNumber = $this->generateInvoiceNumber();

            // 8. Simpan Transaction
            $transaction = Transaction::create([
                'invoice_number' => $invoiceNumber,
                'user_id' => $actor->id,
                'cashier_shift_id' => $lockedShift->id,
                'customer_id' => $data['customer_id'] ?? null,
                'subtotal' => $grossSubtotal,
                'discount_amount' => $totalDiscount,
                'tax_amount' => $taxAmount,
                'rounding_amount' => $roundingAmount,
                'donation_amount' => $totalDonationAmount,
                'total_amount' => $grossSubtotal,
                'discount' => $totalDiscount,
                'grand_total' => $grandTotal,
                'paid_amount' => $paidAmount,
                'pay_amount' => $paidAmount,
                'change_amount' => $changeAmount,
                'payment_method' => $legacyPaymentMethod,
                'status' => TransactionStatus::Completed,
                'discount_approved_by' => $discountApprovedBy,
            ]);

            // 9. Simpan TransactionDetail, potong stok produk, dan buat StockMovement
            $voucherAllocationsByDetailId = [];
            $detailBySourceIndex = [];
            $bundlePromotions = is_array($pricing['bundle_promotions'] ?? null) ? $pricing['bundle_promotions'] : [];
            $bundlePromoIds = array_map(fn (array $bp): int => (int) $bp['promotion_id'], $bundlePromotions);

            foreach ($resolvedLines as $line) {
                /** @var Product $product */
                $product = $line['product'];
                $stockBefore = (int) $product->stock;
                $stockAfter = $stockBefore - $line['base_qty'];

                $detail = TransactionDetail::create([
                    'transaction_id' => $transaction->id,
                    'product_id' => $product->id,
                    'product_unit_id' => $line['product_unit_id'],
                    'unit_name_snapshot' => $line['unit_name_snapshot'],
                    'conversion_factor' => $line['conversion_factor'],
                    'qty' => $line['qty'],
                    'base_qty' => $line['base_qty'],
                    'unit_price' => $line['unit_price'],
                    'cost_price_snapshot' => $line['cost_price_snapshot'],
                    'discount_amount' => $line['discount_amount'],
                    'applied_promotion_id' => $line['applied_promotion_id'],
                    'applied_promotion_name' => $line['applied_promotion_name'],
                    'pricing_source' => $line['pricing_source'],
                    'allocated_header_discount' => $line['allocated_header_discount'],
                    'free_qty' => $line['free_qty'],
                    'is_promo_excluded' => $line['is_promo_excluded'],
                    'is_tax_exempt' => $line['is_tax_exempt'],
                    'is_donation' => $line['is_donation'],
                    'quantity' => (string) $line['base_qty'],
                    'buy_price' => $line['cost_price_snapshot'],
                    'sell_price' => $line['unit_price'],
                    'subtotal' => $line['subtotal'],
                ]);

                if (isset($line['source_index'])) {
                    $detailBySourceIndex[(int) $line['source_index']] = $detail;
                }

                if (($line['voucher_allocated_discount'] ?? 0) > 0) {
                    $voucherAllocationsByDetailId[(string) $detail->id] = (int) $line['voucher_allocated_discount'];
                }

                $isMultiLineBundle = $line['applied_promotion_id'] !== null
                    && in_array((int) $line['applied_promotion_id'], $bundlePromoIds, true);

                if (! $isMultiLineBundle && $line['auto_discount_amount'] > 0 && in_array($line['pricing_source'], ['wholesale_tier', 'promotion'], true)) {
                    $desc = $line['pricing_source'] === 'wholesale_tier'
                        ? sprintf('Harga Grosir (min. %d %s) - %s', (int) ($line['applied_tier_min_qty'] ?? 0), $line['unit_name_snapshot'], $product->name)
                        : ($line['applied_promotion_name'] ?? 'Promo Otomatis');

                    $dailyMeta = [];
                    if ($line['applied_promotion_id'] !== null && isset($dailyUsageByPromoId[(int) $line['applied_promotion_id']])) {
                        $du = $dailyUsageByPromoId[(int) $line['applied_promotion_id']];
                        $dailyMeta = [
                            'daily_usage_date' => $du['usage_date'],
                            'daily_usage_customer_id' => $du['customer_id'],
                            'daily_usage_qty' => (int) $line['quota_consumed'],
                            'daily_usage_count' => 1,
                        ];
                    }

                    AppliedPromotion::create([
                        'transaction_id' => $transaction->id,
                        'transaction_detail_id' => $detail->id,
                        'promotion_id' => $line['applied_promotion_id'],
                        'voucher_id' => null,
                        'type' => (string) ($line['applied_promotion_type'] ?? $line['pricing_source']),
                        'funding' => (string) ($line['applied_promotion_funding'] ?? 'store'),
                        'discount_amount' => $line['auto_discount_amount'],
                        'description_snapshot' => $desc,
                        'meta' => [
                            'pricing_source' => $line['pricing_source'],
                            'free_qty' => $line['free_qty'],
                            'quota_consumed' => $line['quota_consumed'],
                            'tier_min_qty' => $line['applied_tier_min_qty'],
                            ...$dailyMeta,
                        ],
                    ]);
                }

                if (! $line['is_donation']) {
                    $product->stock = $stockAfter;
                    $product->save();

                    StockMovement::create([
                        'product_id' => $product->id,
                        'type' => StockMovementType::Sale,
                        'reference_type' => Transaction::class,
                        'reference_id' => $transaction->id,
                        'stock_before' => $stockBefore,
                        'qty_change' => -$line['base_qty'],
                        'stock_after' => $stockAfter,
                        'unit_cost' => $line['cost_price_snapshot'],
                        'notes' => "Penjualan POS {$invoiceNumber} ({$line['qty']} {$line['unit_name_snapshot']})",
                        'created_by' => $actor->id,
                    ]);
                }
            }

            // 9A. Simpan snapshot applied_promotions untuk Bundle / Mix-Match, Promo Transaksi, Tebus Murah, GWP, Cashback & Promo Bayar
            foreach ($bundlePromotions as $bp) {
                $detailAllocations = [];
                $detailProducts = [];
                foreach ($bp['line_allocations'] as $srcIdx => $allocAmt) {
                    if (! isset($detailBySourceIndex[(int) $srcIdx])) {
                        continue;
                    }
                    /** @var TransactionDetail $det */
                    $det = $detailBySourceIndex[(int) $srcIdx];
                    $detailAllocations[(string) $det->id] = (int) $allocAmt;
                    $detailProducts[(string) $det->id] = [
                        'product_id' => $det->product_id,
                        'unit_price' => PricingMath::toRupiah($det->unit_price),
                        'qty' => (int) $det->qty,
                    ];
                }

                $pid = (int) $bp['promotion_id'];
                $dailyMeta = isset($dailyUsageByPromoId[$pid]) ? [
                    'daily_usage_date' => $dailyUsageByPromoId[$pid]['usage_date'],
                    'daily_usage_customer_id' => $dailyUsageByPromoId[$pid]['customer_id'],
                    'daily_usage_qty' => (int) $dailyUsageByPromoId[$pid]['qty'],
                    'daily_usage_count' => (int) $dailyUsageByPromoId[$pid]['count'],
                ] : [];

                AppliedPromotion::create([
                    'transaction_id' => $transaction->id,
                    'transaction_detail_id' => null,
                    'promotion_id' => $pid,
                    'voucher_id' => null,
                    'type' => (string) $bp['type'],
                    'funding' => (string) $bp['funding'],
                    'discount_amount' => (int) $bp['total_discount'],
                    'description_snapshot' => (string) $bp['name'],
                    'meta' => [
                        'snapshot' => $bp['snapshot'],
                        'detail_allocations' => $detailAllocations,
                        'detail_products' => $detailProducts,
                        'quota_consumed' => (int) $bp['quota_consumed'],
                        'clawback_applied_amount' => 0,
                        ...$dailyMeta,
                    ],
                ]);
            }

            $txPromoInfo = $pricing['transaction_promotion'] ?? null;
            if (is_array($txPromoInfo) && (int) ($txPromoInfo['discount_amount'] ?? 0) > 0) {
                $pid = (int) $txPromoInfo['promotion_id'];
                $txAllocByDetailId = [];
                foreach ($pricing['transaction_promo_line_allocations'] ?? [] as $srcIdx => $allocAmt) {
                    if (isset($detailBySourceIndex[(int) $srcIdx]) && (int) $allocAmt > 0) {
                        $txAllocByDetailId[(string) $detailBySourceIndex[(int) $srcIdx]->id] = (int) $allocAmt;
                    }
                }
                // Kurangi porsi tebus murah / gift jika berada pada baris yang sama
                $appliedTm = $pricing['applied_tebus_murah'] ?? null;
                if (is_array($appliedTm) && isset($detailBySourceIndex[(int) $appliedTm['line_index']])) {
                    $tmDetId = (string) $detailBySourceIndex[(int) $appliedTm['line_index']]->id;
                    if (isset($txAllocByDetailId[$tmDetId])) {
                        $txAllocByDetailId[$tmDetId] = max(0, $txAllocByDetailId[$tmDetId] - (int) $appliedTm['discount_amount']);
                    }
                }

                $dailyMeta = isset($dailyUsageByPromoId[$pid]) ? [
                    'daily_usage_date' => $dailyUsageByPromoId[$pid]['usage_date'],
                    'daily_usage_customer_id' => $dailyUsageByPromoId[$pid]['customer_id'],
                    'daily_usage_qty' => (int) $dailyUsageByPromoId[$pid]['qty'],
                    'daily_usage_count' => (int) $dailyUsageByPromoId[$pid]['count'],
                ] : [];

                AppliedPromotion::create([
                    'transaction_id' => $transaction->id,
                    'transaction_detail_id' => null,
                    'promotion_id' => $pid,
                    'voucher_id' => null,
                    'type' => (string) $txPromoInfo['type'],
                    'funding' => (string) $txPromoInfo['funding'],
                    'discount_amount' => (int) $txPromoInfo['discount_amount'],
                    'description_snapshot' => (string) $txPromoInfo['name'],
                    'meta' => [
                        'min_purchase_amount' => (int) $txPromoInfo['min_purchase_amount'],
                        'detail_allocations' => $txAllocByDetailId,
                        'quota_consumed' => (int) ($txPromoInfo['quota_consumed'] ?? 1),
                        'clawback_applied' => false,
                        ...$dailyMeta,
                    ],
                ]);
            }

            $appliedTebusMurah = $pricing['applied_tebus_murah'] ?? null;
            if (is_array($appliedTebusMurah) && (int) ($appliedTebusMurah['discount_amount'] ?? 0) > 0) {
                $pid = (int) $appliedTebusMurah['promotion_id'];
                $tmDetail = $detailBySourceIndex[(int) $appliedTebusMurah['line_index']] ?? null;
                $dailyMeta = isset($dailyUsageByPromoId[$pid]) ? [
                    'daily_usage_date' => $dailyUsageByPromoId[$pid]['usage_date'],
                    'daily_usage_customer_id' => $dailyUsageByPromoId[$pid]['customer_id'],
                    'daily_usage_qty' => (int) $dailyUsageByPromoId[$pid]['qty'],
                    'daily_usage_count' => (int) $dailyUsageByPromoId[$pid]['count'],
                ] : [];

                AppliedPromotion::create([
                    'transaction_id' => $transaction->id,
                    'transaction_detail_id' => $tmDetail?->id,
                    'promotion_id' => $pid,
                    'voucher_id' => null,
                    'type' => PromotionType::TebusMurah->value,
                    'funding' => (string) $appliedTebusMurah['funding'],
                    'discount_amount' => (int) $appliedTebusMurah['discount_amount'],
                    'description_snapshot' => "Tebus Murah: {$appliedTebusMurah['name']} ({$appliedTebusMurah['reward_product_name']})",
                    'meta' => [
                        'min_purchase_amount' => (int) $appliedTebusMurah['min_purchase_amount'],
                        'reward_product_id' => (int) $appliedTebusMurah['reward_product_id'],
                        'reward_detail_id' => $tmDetail?->id,
                        'normal_price' => (int) $appliedTebusMurah['normal_price'],
                        'special_price' => (int) $appliedTebusMurah['special_price'],
                        'quota_consumed' => (int) ($appliedTebusMurah['quota_consumed'] ?? 1),
                        'clawback_applied' => false,
                        ...$dailyMeta,
                    ],
                ]);
            }

            foreach ($pricing['applied_gifts'] ?? [] as $giftRow) {
                $pid = (int) $giftRow['promotion_id'];
                $giftDetail = $detailBySourceIndex[(int) $giftRow['line_index']] ?? null;
                $dailyMeta = isset($dailyUsageByPromoId[$pid]) ? [
                    'daily_usage_date' => $dailyUsageByPromoId[$pid]['usage_date'],
                    'daily_usage_customer_id' => $dailyUsageByPromoId[$pid]['customer_id'],
                    'daily_usage_qty' => (int) $dailyUsageByPromoId[$pid]['qty'],
                    'daily_usage_count' => (int) $dailyUsageByPromoId[$pid]['count'],
                ] : [];

                AppliedPromotion::create([
                    'transaction_id' => $transaction->id,
                    'transaction_detail_id' => $giftDetail?->id,
                    'promotion_id' => $pid,
                    'voucher_id' => null,
                    'type' => PromotionType::GiftWithPurchase->value,
                    'funding' => (string) $giftRow['funding'],
                    'discount_amount' => (int) $giftRow['discount_amount'],
                    'description_snapshot' => "Hadiah: {$giftRow['name']} ({$giftRow['reward_product_name']})",
                    'meta' => [
                        'min_purchase_amount' => (int) $giftRow['min_purchase_amount'],
                        'reward_product_id' => (int) $giftRow['reward_product_id'],
                        'reward_detail_id' => $giftDetail?->id,
                        'free_qty' => (int) $giftRow['free_qty'],
                        'quota_consumed' => (int) ($giftRow['quota_consumed'] ?? 1),
                        ...$dailyMeta,
                    ],
                ]);
            }

            foreach ($pricing['cashback_promotions'] ?? [] as $cbRow) {
                $pid = (int) $cbRow['promotion_id'];
                $dailyMeta = isset($dailyUsageByPromoId[$pid]) ? [
                    'daily_usage_date' => $dailyUsageByPromoId[$pid]['usage_date'],
                    'daily_usage_customer_id' => $dailyUsageByPromoId[$pid]['customer_id'],
                    'daily_usage_qty' => (int) $dailyUsageByPromoId[$pid]['qty'],
                    'daily_usage_count' => (int) $dailyUsageByPromoId[$pid]['count'],
                ] : [];

                AppliedPromotion::create([
                    'transaction_id' => $transaction->id,
                    'transaction_detail_id' => null,
                    'promotion_id' => $pid,
                    'voucher_id' => null,
                    'type' => PromotionType::Cashback->value,
                    'funding' => (string) $cbRow['funding'],
                    'discount_amount' => 0,
                    'description_snapshot' => "Cashback: {$cbRow['name']}",
                    'meta' => [
                        'cashback_amount' => (int) $cbRow['cashback_amount'],
                        'min_purchase_amount' => (int) $cbRow['min_purchase_amount'],
                        'quota_consumed' => (int) ($cbRow['quota_consumed'] ?? 1),
                        ...$dailyMeta,
                    ],
                ]);
            }

            $payPromoInfo = $pricing['payment_promotion'] ?? null;
            if (is_array($payPromoInfo) && (int) ($payPromoInfo['discount_amount'] ?? 0) > 0) {
                $pid = (int) $payPromoInfo['promotion_id'];
                $payAllocByDetailId = [];
                foreach ($pricing['payment_promo_line_allocations'] ?? [] as $srcIdx => $allocAmt) {
                    if (isset($detailBySourceIndex[(int) $srcIdx]) && (int) $allocAmt > 0) {
                        $payAllocByDetailId[(string) $detailBySourceIndex[(int) $srcIdx]->id] = (int) $allocAmt;
                    }
                }
                $dailyMeta = isset($dailyUsageByPromoId[$pid]) ? [
                    'daily_usage_date' => $dailyUsageByPromoId[$pid]['usage_date'],
                    'daily_usage_customer_id' => $dailyUsageByPromoId[$pid]['customer_id'],
                    'daily_usage_qty' => (int) $dailyUsageByPromoId[$pid]['qty'],
                    'daily_usage_count' => (int) $dailyUsageByPromoId[$pid]['count'],
                ] : [];

                AppliedPromotion::create([
                    'transaction_id' => $transaction->id,
                    'transaction_detail_id' => null,
                    'promotion_id' => $pid,
                    'voucher_id' => null,
                    'type' => PromotionType::PaymentPromo->value,
                    'funding' => (string) $payPromoInfo['funding'],
                    'discount_amount' => (int) $payPromoInfo['discount_amount'],
                    'description_snapshot' => (string) $payPromoInfo['name'],
                    'meta' => [
                        'payment_method' => $payPromoInfo['payment_method'],
                        'payment_bin_prefix' => $payPromoInfo['payment_bin_prefix'],
                        'eligible_payment_amount' => (int) $payPromoInfo['eligible_payment_amount'],
                        'detail_allocations' => $payAllocByDetailId,
                        'quota_consumed' => (int) ($payPromoInfo['quota_consumed'] ?? 1),
                        ...$dailyMeta,
                    ],
                ]);
            }

            // 9B. Redeem voucher secara atomik & simpan snapshot applied_promotions (mendukung > 1 voucher)
            foreach ($evaluatedVouchers as $vInfo) {
                if (! is_array($vInfo) || ! ($vInfo['applied'] ?? false) || $vInfo['voucher_id'] === null) {
                    continue;
                }

                /** @var Voucher $voucherModel */
                $voucherModel = Voucher::query()->findOrFail((int) $vInfo['voucher_id']);
                $entryToken = isset($vInfo['reservation_token']) && trim((string) $vInfo['reservation_token']) !== ''
                    ? trim((string) $vInfo['reservation_token'])
                    : $voucherReservationToken;

                $this->voucherService->redeem(
                    $voucherModel,
                    $transaction,
                    $actor,
                    $customerId,
                    (int) $vInfo['discount_amount'],
                    $entryToken,
                    $referenceAt
                );

                AppliedPromotion::create([
                    'transaction_id' => $transaction->id,
                    'transaction_detail_id' => null,
                    'promotion_id' => null,
                    'voucher_id' => $voucherModel->id,
                    'type' => 'voucher:'.$voucherModel->type->value,
                    'funding' => $voucherModel->funding->value,
                    'discount_amount' => (int) $vInfo['discount_amount'],
                    'description_snapshot' => "Voucher {$voucherModel->code} - {$voucherModel->name}",
                    'meta' => [
                        'voucher_code' => $voucherModel->code,
                        'voucher_name' => $voucherModel->name,
                        'voucher_type' => $voucherModel->type->value,
                        'min_spend' => (int) $vInfo['min_spend'],
                        'applicable_skus' => $vInfo['applicable_skus'],
                        'applicable_categories' => $vInfo['applicable_categories'],
                        'excluded_skus' => $vInfo['excluded_skus'],
                        'excluded_categories' => $vInfo['excluded_categories'],
                        'free_product_id' => $vInfo['free_product_id'],
                        'voucher_allocations' => $voucherAllocationsByDetailId,
                        'voucher_clawback_applied' => false,
                    ],
                ]);
            }

            // 10. Simpan TransactionPayment & posting ke FinanceService (netto tunai dikurangi change_amount)
            $remainingChange = $changeAmount;
            foreach ($normalizedPayments as $paymentRow) {
                $payment = TransactionPayment::create([
                    'transaction_id' => $transaction->id,
                    'payment_method' => $paymentRow['payment_method'],
                    'financial_account_id' => $paymentRow['financial_account_id'],
                    'amount' => $paymentRow['amount'],
                    'reference_number' => $paymentRow['reference_number'],
                ]);

                $netAmount = $paymentRow['amount'];
                if ($paymentRow['payment_method'] === PaymentMethod::Cash && $remainingChange > 0) {
                    $deduct = min($netAmount, $remainingChange);
                    $netAmount = round($netAmount - $deduct, 2);
                    $remainingChange = round($remainingChange - $deduct, 2);
                }

                if ($netAmount > 0) {
                    $this->financeService->recordPosSalePayment($transaction, $payment, $netAmount, $actor);
                }
            }

            // 11. Hapus HeldTransaction jika checkout berasal dari hold bill
            if (! empty($data['held_transaction_id'])) {
                HeldTransaction::query()
                    ->where('id', (int) $data['held_transaction_id'])
                    ->where('cashier_shift_id', $lockedShift->id)
                    ->delete();
            }

            // 12. Catat Spatie Activity Log
            activity(ActivityLogCategory::Transaction->value)
                ->event('created')
                ->performedOn($transaction)
                ->causedBy($actor)
                ->withProperties([
                    'invoice_number' => $transaction->invoice_number,
                    'shift_number' => $lockedShift->shift_number,
                    'items_count' => count($resolvedLines),
                    'subtotal' => $grossSubtotal,
                    'discount_amount' => $totalDiscount,
                    'taxable_amount' => $taxableAmount,
                    'tax_exempt_amount' => $taxExemptAmount,
                    'tax_amount' => $taxAmount,
                    'rounding_amount' => $roundingAmount,
                    'donation_amount' => $totalDonationAmount,
                    'grand_total' => $grandTotal,
                    'paid_amount' => $paidAmount,
                    'change_amount' => $changeAmount,
                    'payment_method' => $legacyPaymentMethod,
                    'discount_approved_by' => $discountApprovedBy,
                    'voucher_code' => implode(', ', array_filter(array_map(
                        fn (mixed $v): ?string => is_array($v) && ($v['applied'] ?? false) ? (string) ($v['code'] ?? '') : null,
                        $evaluatedVouchers
                    ))) ?: null,
                    'voucher_discount_amount' => array_sum(array_map(
                        fn (mixed $v): int => is_array($v) && ($v['applied'] ?? false) ? (int) ($v['discount_amount'] ?? 0) : 0,
                        $evaluatedVouchers
                    )),
                ])
                ->log(sprintf(
                    'Transaksi %s berhasil diproses sebesar Rp %s (%d item).',
                    $transaction->invoice_number,
                    number_format($grandTotal, 0, ',', '.'),
                    count($resolvedLines)
                ));

            return $transaction->load([
                'user:id,name,role',
                'cashierShift:id,shift_number,register_name',
                'customer:id,name,phone',
                'details.product:id,name,barcode,base_unit',
                'payments.financialAccount:id,code,name,type',
                'appliedPromotions',
            ]);
        });
    }

    /**
     * Membatalkan (Void) transaksi yang berstatus completed dengan PIN Supervisor/Admin.
     *
     * @param  array{reason: string, supervisor_pin: string}  $data
     */
    public function void(Transaction $transaction, array $data, User $actor): Transaction
    {
        $approver = $this->supervisorPinService->verify(
            $data['supervisor_pin'],
            'PIN Supervisor / Admin wajib diisi untuk melakukan Void transaksi.'
        );

        return DB::transaction(function () use ($transaction, $data, $actor, $approver): Transaction {
            /** @var Transaction $lockedTx */
            $lockedTx = Transaction::query()
                ->where('id', $transaction->id)
                ->lockForUpdate()
                ->firstOrFail();

            if ($lockedTx->status !== TransactionStatus::Completed) {
                throw ValidationException::withMessages([
                    'status' => "Transaksi {$lockedTx->invoice_number} berstatus {$lockedTx->status->label()} sehingga tidak dapat di-void.",
                ]);
            }

            $lockedTx->load(['details', 'payments', 'appliedPromotions']);

            // 0. Kembalikan kuota promo, kuota harian (promotion_daily_usages), & voucher yang dikonsumsi
            $restoredDailyCountByKey = [];
            foreach ($lockedTx->appliedPromotions as $appliedPromo) {
                $meta = is_array($appliedPromo->meta) ? $appliedPromo->meta : [];
                $consumed = (int) ($meta['quota_consumed'] ?? 0);
                if ($appliedPromo->promotion_id !== null && $consumed > 0) {
                    Promotion::query()
                        ->where('id', $appliedPromo->promotion_id)
                        ->update([
                            'quota_used' => DB::raw('CASE WHEN quota_used >= '.$consumed.' THEN quota_used - '.$consumed.' ELSE 0 END'),
                        ]);
                }

                if ($appliedPromo->promotion_id !== null && ! empty($meta['daily_usage_date'])) {
                    $duDate = (string) $meta['daily_usage_date'];
                    $duCustomerId = isset($meta['daily_usage_customer_id']) && $meta['daily_usage_customer_id'] !== null
                        ? (int) $meta['daily_usage_customer_id']
                        : null;
                    $duQty = max(0, (int) ($meta['daily_usage_qty'] ?? 0));
                    $duKey = "{$appliedPromo->promotion_id}|{$duDate}|".($duCustomerId ?? 'null');
                    $duCount = isset($restoredDailyCountByKey[$duKey])
                        ? 0
                        : max(0, (int) ($meta['daily_usage_count'] ?? 1));
                    $restoredDailyCountByKey[$duKey] = true;

                    $usageQuery = PromotionDailyUsage::query()
                        ->where('promotion_id', $appliedPromo->promotion_id)
                        ->whereDate('usage_date', $duDate);

                    if ($duCustomerId !== null) {
                        $usageQuery->where('customer_id', $duCustomerId);
                    } else {
                        $usageQuery->whereNull('customer_id');
                    }

                    $usageQuery->update([
                        'used_qty' => DB::raw('CASE WHEN used_qty >= '.$duQty.' THEN used_qty - '.$duQty.' ELSE 0 END'),
                        'used_count' => DB::raw('CASE WHEN used_count >= '.$duCount.' THEN used_count - '.$duCount.' ELSE 0 END'),
                    ]);
                }
            }

            $this->voucherService->refundForTransaction($lockedTx);

            // 1. Kunci produk secara terurut & kembalikan stok
            $productIds = $lockedTx->details->pluck('product_id')->unique()->sort()->values()->all();
            /** @var EloquentCollection<int, Product> $lockedProducts */
            $lockedProducts = Product::query()
                ->whereIn('id', $productIds)
                ->orderBy('id')
                ->lockForUpdate()
                ->get()
                ->keyBy('id');

            foreach ($lockedTx->details as $detail) {
                if ($detail->is_donation) {
                    continue;
                }

                /** @var Product|null $product */
                $product = $lockedProducts->get($detail->product_id);
                if (! $product instanceof Product || $product->is_donation) {
                    continue;
                }

                $restoreBaseQty = $detail->base_qty > 0 ? $detail->base_qty : max(1, (int) $detail->quantity);
                $stockBefore = (int) $product->stock;
                $stockAfter = $stockBefore + $restoreBaseQty;

                $product->stock = $stockAfter;
                $product->save();

                StockMovement::create([
                    'product_id' => $product->id,
                    'type' => StockMovementType::SaleVoid,
                    'reference_type' => Transaction::class,
                    'reference_id' => $lockedTx->id,
                    'stock_before' => $stockBefore,
                    'qty_change' => $restoreBaseQty,
                    'stock_after' => $stockAfter,
                    'unit_cost' => (float) $detail->cost_price_snapshot > 0 ? $detail->cost_price_snapshot : $detail->buy_price,
                    'notes' => "Void Transaksi {$lockedTx->invoice_number}: ".trim($data['reason']),
                    'created_by' => $actor->id,
                ]);
            }

            // 2. Balikkan dana pada masing-masing akun pembayaran asal
            $remainingChange = round((float) ($lockedTx->change_amount ?? 0), 2);
            foreach ($lockedTx->payments as $payment) {
                $netAmount = round((float) $payment->amount, 2);
                if ($payment->payment_method === PaymentMethod::Cash && $remainingChange > 0) {
                    $deduct = min($netAmount, $remainingChange);
                    $netAmount = round($netAmount - $deduct, 2);
                    $remainingChange = round($remainingChange - $deduct, 2);
                }

                if ($netAmount > 0) {
                    $this->financeService->recordPosVoidReversal($lockedTx, $payment, $netAmount, $actor);
                }
            }

            // 3. Perbarui status transaksi menjadi voided
            $reason = trim($data['reason']);
            $lockedTx->update([
                'status' => TransactionStatus::Voided,
                'voided_by' => $approver->id,
                'voided_at' => now(),
                'void_reason' => $reason,
            ]);

            // 4. Catat Activity Log
            activity(ActivityLogCategory::Transaction->value)
                ->event('voided')
                ->performedOn($lockedTx)
                ->causedBy($actor)
                ->withProperties([
                    'invoice_number' => $lockedTx->invoice_number,
                    'old_status' => TransactionStatus::Completed->value,
                    'new_status' => TransactionStatus::Voided->value,
                    'grand_total' => (float) $lockedTx->grand_total,
                    'void_reason' => $reason,
                    'approved_by' => $approver->name,
                ])
                ->log(sprintf(
                    'Transaksi %s sebesar Rp %s dibatalkan (Void) oleh %s (Disetujui: %s). Alasan: %s',
                    $lockedTx->invoice_number,
                    number_format((float) $lockedTx->grand_total, 0, ',', '.'),
                    $actor->name,
                    $approver->name,
                    $reason
                ));

            return $lockedTx->fresh([
                'user:id,name,role',
                'voidedByUser:id,name,role',
                'details.product:id,name,barcode,base_unit',
                'payments.financialAccount:id,code,name,type',
            ]) ?? $lockedTx;
        });
    }

    /**
     * Menahan keranjang sementara (Hold Bill) tanpa membentuk nomor invoice resmi.
     *
     * @param  array{
     *     label?: string|null,
     *     customer_id?: int|null,
     *     discount_amount?: float|int|string|null,
     *     notes?: string|null,
     *     items: array<int, array{product_id: int, product_unit_id?: int|null, qty: int, discount_amount?: float|int|string|null}>
     * }  $data
     */
    public function hold(User $actor, array $data): HeldTransaction
    {
        $activeShift = $this->cashierShiftService->getActiveShiftForUser($actor);

        if (! $activeShift instanceof CashierShift) {
            throw ValidationException::withMessages([
                'shift' => 'Anda harus memiliki sesi shift aktif untuk menahan transaksi.',
            ]);
        }

        return DB::transaction(function () use ($actor, $activeShift, $data): HeldTransaction {
            $holdCode = $this->generateHoldCode();

            $payload = [
                'items' => array_values(array_map(fn (array $item): array => [
                    'product_id' => (int) $item['product_id'],
                    'product_unit_id' => isset($item['product_unit_id']) ? (int) $item['product_unit_id'] : null,
                    'qty' => (int) $item['qty'],
                    'discount_amount' => round(max(0.0, (float) ($item['discount_amount'] ?? 0)), 2),
                ], $data['items'])),
                'discount_amount' => round(max(0.0, (float) ($data['discount_amount'] ?? 0)), 2),
                'notes' => isset($data['notes']) ? trim((string) $data['notes']) : null,
            ];

            return HeldTransaction::create([
                'hold_code' => $holdCode,
                'label' => isset($data['label']) && trim((string) $data['label']) !== ''
                    ? trim((string) $data['label'])
                    : null,
                'user_id' => $actor->id,
                'cashier_shift_id' => $activeShift->id,
                'customer_id' => $data['customer_id'] ?? null,
                'payload' => $payload,
            ]);
        });
    }

    /**
     * Daftar Hold Bill pada shift aktif pengguna, diperkaya data produk terkini agar siap di-resume.
     *
     * @return array<int, array<string, mixed>>
     */
    public function listHeld(User $actor): array
    {
        $activeShift = $this->cashierShiftService->getActiveShiftForUser($actor);
        if (! $activeShift instanceof CashierShift) {
            return [];
        }

        /** @var EloquentCollection<int, HeldTransaction> $heldRows */
        $heldRows = HeldTransaction::query()
            ->where('cashier_shift_id', $activeShift->id)
            ->with(['customer:id,name,phone'])
            ->latest('id')
            ->get();

        $allProductIds = [];
        foreach ($heldRows as $row) {
            $items = is_array($row->payload['items'] ?? null) ? $row->payload['items'] : [];
            foreach ($items as $item) {
                if (isset($item['product_id'])) {
                    $allProductIds[] = (int) $item['product_id'];
                }
            }
        }
        $allProductIds = array_values(array_unique($allProductIds));

        /** @var EloquentCollection<int, Product> $productsMap */
        $productsMap = ! empty($allProductIds)
            ? Product::query()
                ->whereIn('id', $allProductIds)
                ->with(['units' => fn ($q) => $q->where('is_active', true)->orderBy('conversion_factor')])
                ->get()
                ->keyBy('id')
            : new EloquentCollection;

        return $heldRows->map(function (HeldTransaction $held) use ($productsMap): array {
            $rawItems = is_array($held->payload['items'] ?? null) ? $held->payload['items'] : [];
            $enrichedItems = [];
            $estimatedTotal = 0.0;

            foreach ($rawItems as $item) {
                $pid = (int) ($item['product_id'] ?? 0);
                /** @var Product|null $product */
                $product = $productsMap->get($pid);
                if (! $product instanceof Product) {
                    continue;
                }

                $unitId = isset($item['product_unit_id']) ? (int) $item['product_unit_id'] : null;
                $qty = max(1, (int) ($item['qty'] ?? 1));
                $discount = round(max(0.0, (float) ($item['discount_amount'] ?? 0)), 2);

                /** @var ProductUnit|null $matchedUnit */
                $matchedUnit = $unitId !== null ? $product->units->firstWhere('id', $unitId) : null;
                $unitPrice = $matchedUnit instanceof ProductUnit
                    ? round((float) $matchedUnit->sell_price, 2)
                    : round((float) $product->sell_price, 2);

                $estimatedTotal += max(0.0, ($unitPrice * $qty) - $discount);

                $enrichedItems[] = [
                    'product' => $this->formatProductLookupRow($product, $unitId),
                    'product_unit_id' => $matchedUnit instanceof ProductUnit ? $matchedUnit->id : null,
                    'qty' => $qty,
                    'discount_amount' => $discount,
                ];
            }

            return [
                'id' => $held->id,
                'hold_code' => $held->hold_code,
                'label' => $held->label,
                'customer_id' => $held->customer_id,
                'customer_name' => $held->customer?->name,
                'discount_amount' => round((float) ($held->payload['discount_amount'] ?? 0), 2),
                'notes' => $held->payload['notes'] ?? null,
                'items_count' => count($enrichedItems),
                'estimated_total' => round(max(0.0, $estimatedTotal - (float) ($held->payload['discount_amount'] ?? 0)), 2),
                'items' => $enrichedItems,
                'created_at' => $held->created_at?->format('d M Y H:i') ?? '-',
                'created_at_human' => $held->created_at?->diffForHumans() ?? '-',
            ];
        })->values()->all();
    }

    public function deleteHeld(User $actor, HeldTransaction $heldTransaction): void
    {
        $activeShift = $this->cashierShiftService->getActiveShiftForUser($actor);

        if (
            ! $actor->hasRoles([UserRoles::Admin, UserRoles::Supervisor])
            && ($activeShift === null || $heldTransaction->cashier_shift_id !== $activeShift->id)
        ) {
            throw ValidationException::withMessages([
                'held' => 'Anda tidak memiliki izin untuk menghapus transaksi tertahan ini.',
            ]);
        }

        $heldTransaction->delete();
    }

    /**
     * @return array{
     *     id: int,
     *     barcode: string,
     *     name: string,
     *     base_unit: string,
     *     sell_price: float,
     *     stock: int,
     *     image: string|null,
     *     is_tax_exempt: bool,
     *     is_donation: bool,
     *     matched_unit_id: int|null,
     *     units: array<int, array{id: int, unit_name: string, conversion_factor: int, barcode: string|null, sell_price: float}>
     * }
     */
    private function formatProductLookupRow(Product $product, ?int $matchedUnitId): array
    {
        return [
            'id' => $product->id,
            'barcode' => $product->barcode,
            'name' => $product->name,
            'base_unit' => $product->base_unit ?: 'pcs',
            'sell_price' => round((float) $product->sell_price, 2),
            'stock' => (int) $product->stock,
            'image' => $product->image,
            'is_tax_exempt' => (bool) $product->is_tax_exempt,
            'is_donation' => (bool) $product->is_donation,
            'matched_unit_id' => $matchedUnitId,
            'units' => $product->units->map(fn (ProductUnit $unit): array => [
                'id' => $unit->id,
                'unit_name' => $unit->unit_name,
                'conversion_factor' => (int) $unit->conversion_factor,
                'barcode' => $unit->barcode,
                'sell_price' => round((float) $unit->sell_price, 2),
            ])->values()->all(),
        ];
    }

    /**
     * Konsumsi kuota harian promo secara atomik (kompatibel PostgreSQL & SQLite).
     */
    private function consumeDailyUsage(
        int $promotionId,
        string $usageDate,
        ?int $customerId,
        int $qty,
        int $count,
        int $maxDaily,
        bool $limitByCount
    ): void {
        $nowStr = now()->toDateTimeString();

        $existingQuery = PromotionDailyUsage::query()
            ->where('promotion_id', $promotionId)
            ->whereDate('usage_date', $usageDate);

        if ($customerId !== null) {
            $existingQuery->where('customer_id', $customerId);
        } else {
            $existingQuery->whereNull('customer_id');
        }

        /** @var PromotionDailyUsage|null $usage */
        $usage = $existingQuery->first();

        if (! $usage instanceof PromotionDailyUsage) {
            $usage = PromotionDailyUsage::create([
                'promotion_id' => $promotionId,
                'usage_date' => $usageDate,
                'customer_id' => $customerId,
                'used_qty' => 0,
                'used_count' => 0,
            ]);
        }

        if ($limitByCount) {
            $affected = DB::update(
                'UPDATE promotion_daily_usages SET used_qty = used_qty + ?, used_count = used_count + ?, updated_at = ? WHERE id = ? AND (used_count + ?) <= ?',
                [$qty, $count, $nowStr, $usage->id, $count, $maxDaily]
            );
        } else {
            $affected = DB::update(
                'UPDATE promotion_daily_usages SET used_qty = used_qty + ?, used_count = used_count + ?, updated_at = ? WHERE id = ? AND (used_qty + ?) <= ?',
                [$qty, $count, $nowStr, $usage->id, $qty, $maxDaily]
            );
        }

        if ($affected === 0) {
            throw ValidationException::withMessages([
                'items' => 'Kuota harian promo telah habis saat transaksi diproses. Silakan muat ulang keranjang.',
            ]);
        }
    }

    private function generateInvoiceNumber(): string
    {
        $dateStr = now()->format('Ymd');
        $prefix = "INV-{$dateStr}-";

        $latest = Transaction::query()
            ->where('invoice_number', 'like', "{$prefix}%")
            ->orderByDesc('invoice_number')
            ->lockForUpdate()
            ->value('invoice_number');

        $nextNumber = $latest ? ((int) substr((string) $latest, strlen($prefix)) + 1) : 1;

        return sprintf('%s%04d', $prefix, $nextNumber);
    }

    private function generateHoldCode(): string
    {
        $prefix = 'HOLD-';
        $latest = HeldTransaction::query()
            ->where('hold_code', 'like', "{$prefix}%")
            ->orderByDesc('id')
            ->lockForUpdate()
            ->value('hold_code');

        $nextNumber = $latest ? ((int) substr((string) $latest, strlen($prefix)) + 1) : 1;

        return sprintf('%s%04d', $prefix, $nextNumber);
    }
}

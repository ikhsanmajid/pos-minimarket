<?php

namespace App\Http\Controllers;

use App\Enums\PaymentMethod;
use App\Enums\PromotionType;
use App\Enums\UserRoles;
use App\Http\Requests\CalculatePosCartRequest;
use App\Http\Requests\CheckoutPosRequest;
use App\Http\Requests\HoldTransactionRequest;
use App\Http\Requests\ValidatePosVoucherRequest;
use App\Models\AppliedPromotion;
use App\Models\Customer;
use App\Models\FinancialAccount;
use App\Models\HeldTransaction;
use App\Models\Product;
use App\Models\Promotion;
use App\Models\Transaction;
use App\Models\TransactionDetail;
use App\Models\TransactionPayment;
use App\Models\User;
use App\Models\Voucher;
use App\Services\CashierShiftService;
use App\Services\PosPricingService;
use App\Services\PosTransactionService;
use App\Services\VoucherService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;
use Inertia\Response;

class PosController extends Controller
{
    public function __construct(
        public PosTransactionService $posTransactionService,
        public CashierShiftService $cashierShiftService,
        public PosPricingService $posPricingService,
        public VoucherService $voucherService,
    ) {}

    public function index(Request $request): Response
    {
        Gate::authorize('create', Transaction::class);

        /** @var User $user */
        $user = $request->user();
        $activeShift = $this->cashierShiftService->getActiveShiftForUser($user);

        $financialAccounts = FinancialAccount::query()
            ->where('is_active', true)
            ->orderByDesc('is_default')
            ->orderBy('name')
            ->get(['id', 'code', 'name', 'type', 'is_default'])
            ->map(fn (FinancialAccount $acc): array => [
                'id' => $acc->id,
                'code' => $acc->code,
                'name' => $acc->name,
                'type' => $acc->type->value,
                'type_label' => $acc->type->label(),
                'is_default' => (bool) $acc->is_default,
            ])
            ->values()
            ->all();

        $paymentMethods = array_map(
            fn (PaymentMethod $method): array => [
                'value' => $method->value,
                'label' => $method->label(),
            ],
            [
                PaymentMethod::Cash,
                PaymentMethod::Qris,
                PaymentMethod::Debit,
                PaymentMethod::Transfer,
            ]
        );

        $customers = Customer::query()
            ->active()
            ->orderBy('name')
            ->limit(50)
            ->get(['id', 'member_code', 'name', 'phone', 'points', 'tier', 'birth_date'])
            ->map(fn (Customer $c): array => [
                'id' => $c->id,
                'member_code' => $c->member_code,
                'name' => $c->name,
                'phone' => $c->phone,
                'points' => (int) $c->points,
                'tier' => $c->effectiveTier()->value,
                'tier_label' => $c->effectiveTier()->label(),
                'tier_multiplier' => $c->effectiveTier()->multiplier(),
                'birth_date' => $c->birth_date?->format('Y-m-d'),
            ])
            ->values()
            ->all();

        $donationProducts = Product::query()
            ->where('active', true)
            ->where('is_donation', true)
            ->orderBy('name')
            ->get(['id', 'barcode', 'name', 'base_unit', 'sell_price'])
            ->map(fn (Product $p): array => [
                'id' => $p->id,
                'barcode' => $p->barcode,
                'name' => $p->name,
                'base_unit' => $p->base_unit ?: 'pcs',
                'sell_price' => (float) $p->sell_price,
            ])
            ->values()
            ->all();

        return Inertia::render('POS/Cashier/Terminal', [
            'shiftSummary' => $activeShift ? [
                'id' => $activeShift->id,
                'shift_number' => $activeShift->shift_number,
                'register_name' => $activeShift->register_name,
                'opened_at' => $activeShift->opened_at->format('d M Y H:i'),
                'starting_cash' => (float) $activeShift->starting_cash,
                'transactions_count' => $activeShift->transactions()
                    ->whereIn('status', CashierShiftService::COMPLETED_TRANSACTION_STATUSES)
                    ->count(),
            ] : null,
            'financialAccounts' => $financialAccounts,
            'paymentMethods' => $paymentMethods,
            'customers' => $customers,
            'donationProducts' => $donationProducts,
            'heldTransactions' => $this->posTransactionService->listHeld($user),
            'policyRules' => [
                'manual_discount_pin_threshold' => PosTransactionService::MANUAL_DISCOUNT_PIN_THRESHOLD,
                'is_privileged' => $user->hasRoles([UserRoles::Admin, UserRoles::Supervisor]),
            ],
        ]);
    }

    public function lookup(Request $request): JsonResponse
    {
        Gate::authorize('create', Transaction::class);

        $query = (string) $request->query('q', '');
        $limit = $request->integer('limit', 15);

        return response()->json([
            'products' => $this->posTransactionService->lookupProducts($query, $limit),
        ]);
    }

    public function checkProductPromo(Request $request): JsonResponse
    {
        Gate::authorize('create', Transaction::class);

        $query = trim((string) $request->query('q', ''));
        if ($query === '') {
            return response()->json(['products' => []]);
        }

        $matchedProducts = $this->posTransactionService->lookupProducts($query, 10);
        if (empty($matchedProducts)) {
            return response()->json(['products' => []]);
        }

        $productIds = array_map(fn (array $p): int => (int) $p['id'], $matchedProducts);
        $now = now();

        $productModels = Product::query()
            ->whereIn('id', $productIds)
            ->with([
                'category:id,name,is_promo_excluded',
                'activePriceTiers.productUnit:id,unit_name',
            ])
            ->get()
            ->keyBy('id');

        $activePromotions = Promotion::query()
            ->currentlyActive($now)
            ->with(['products:id', 'categories:id', 'bundleItems'])
            ->orderByDesc('priority')
            ->orderBy('id')
            ->get();

        $results = [];
        foreach ($matchedProducts as $item) {
            /** @var Product|null $product */
            $product = $productModels->get((int) $item['id']);
            if (! $product instanceof Product) {
                continue;
            }

            $isExcluded = $product->isExcludedFromPromotions();
            $applicablePromos = [];

            if (! $isExcluded) {
                foreach ($activePromotions as $promo) {
                    $matches = false;
                    $type = $promo->type;

                    if ($type->isItemLevel()) {
                        if ($promo->scope->value === 'all') {
                            $matches = true;
                        } elseif ($promo->scope->value === 'product') {
                            $matches = $promo->products->contains('id', $product->id);
                        } elseif ($promo->scope->value === 'category' && $product->category_id !== null) {
                            $matches = $promo->categories->contains('id', $product->category_id);
                        } elseif ($type === PromotionType::Bundle || $type === PromotionType::MixMatch) {
                            $matches = $promo->bundleItems->contains('product_id', $product->id)
                                || $promo->products->contains('id', $product->id);
                        }
                    } elseif (
                        in_array($type, [PromotionType::TebusMurah, PromotionType::GiftWithPurchase], true)
                        && (int) $promo->reward_product_id === $product->id
                    ) {
                        $matches = true;
                    }

                    if ($matches) {
                        $applicablePromos[] = [
                            'id' => $promo->id,
                            'name' => $promo->name,
                            'code' => $promo->code,
                            'type' => $type->value,
                            'type_label' => $type->label(),
                            'discount_value' => $promo->discount_value !== null ? (float) $promo->discount_value : null,
                            'max_discount_amount' => $promo->max_discount_amount !== null ? (float) $promo->max_discount_amount : null,
                            'min_purchase_amount' => (float) $promo->min_purchase_amount,
                            'buy_qty' => $promo->buy_qty,
                            'get_qty' => $promo->get_qty,
                            'get_discount_percent' => (float) $promo->get_discount_percent,
                            'bundle_price' => $promo->bundle_price !== null ? (float) $promo->bundle_price : null,
                            'member_only' => (bool) $promo->member_only,
                            'start_date' => $promo->start_date?->format('d M Y H:i'),
                            'end_date' => $promo->end_date?->format('d M Y H:i'),
                        ];
                    }
                }
            }

            $priceTiers = $product->activePriceTiers->map(fn ($tier): array => [
                'id' => $tier->id,
                'min_qty' => (int) $tier->min_qty,
                'unit_price' => (float) $tier->unit_price,
                'unit_name' => $tier->productUnit?->unit_name ?? ($product->base_unit ?: 'pcs'),
            ])->values()->all();

            $results[] = [
                'product' => $item,
                'category_name' => $product->category?->name,
                'is_promo_excluded' => $isExcluded,
                'price_tiers' => $priceTiers,
                'promotions' => $applicablePromos,
            ];
        }

        return response()->json([
            'products' => $results,
        ]);
    }

    public function calculateCart(CalculatePosCartRequest $request): JsonResponse
    {
        Gate::authorize('create', Transaction::class);

        /** @var array{
         *     customer_id?: int|null,
         *     discount_amount?: float|int|string|null,
         *     has_cash_payment?: bool|null,
         *     voucher_code?: string|null,
         *     voucher_reservation_token?: string|null,
         *     evaluated_at?: string|null,
         *     items: array<int, array{product_id: int, product_unit_id?: int|null, qty: int|float, discount_amount?: float|int|string|null}>
         * } $validated */
        $validated = $request->validated();

        $at = ! empty($validated['evaluated_at']) ? Carbon::parse((string) $validated['evaluated_at']) : now();
        $voucherCode = isset($validated['voucher_code']) && trim((string) $validated['voucher_code']) !== ''
            ? trim((string) $validated['voucher_code'])
            : null;
        $reservationToken = isset($validated['voucher_reservation_token']) && trim((string) $validated['voucher_reservation_token']) !== ''
            ? trim((string) $validated['voucher_reservation_token'])
            : null;

        $selectedTebusMurahId = isset($validated['selected_tebus_murah_promotion_id']) && $validated['selected_tebus_murah_promotion_id'] !== null
            ? (int) $validated['selected_tebus_murah_promotion_id']
            : null;
        $payments = is_array($validated['payments'] ?? null) ? $validated['payments'] : [];
        $vouchers = is_array($validated['vouchers'] ?? null) ? $validated['vouchers'] : [];
        $redeemPoints = max(0, (int) ($validated['redeem_points'] ?? 0));

        $result = $this->posPricingService->evaluateCart(
            $validated['items'],
            isset($validated['customer_id']) ? (int) $validated['customer_id'] : null,
            $at,
            (float) ($validated['discount_amount'] ?? 0),
            (bool) ($validated['has_cash_payment'] ?? true),
            $voucherCode,
            $reservationToken,
            null,
            'pos',
            $payments,
            $selectedTebusMurahId,
            $vouchers,
            $redeemPoints
        );

        // Jika perubahan keranjang membuat voucher tidak lagi valid, lepas reservasi otomatis
        if (! empty($result['vouchers']) && is_array($result['vouchers'])) {
            foreach ($result['vouchers'] as $vRes) {
                $vToken = isset($vRes['reservation_token']) ? trim((string) $vRes['reservation_token']) : '';
                if ($vToken !== '' && ($vRes['auto_removed'] ?? false)) {
                    $this->voucherService->release($vToken, $at);
                }
            }
        } elseif ($reservationToken !== null && is_array($result['voucher']) && ($result['voucher']['auto_removed'] ?? false)) {
            $this->voucherService->release($reservationToken, $at);
        }

        return response()->json($result);
    }

    public function validateVoucher(ValidatePosVoucherRequest $request): JsonResponse
    {
        Gate::authorize('create', Transaction::class);

        /** @var User $user */
        $user = $request->user();
        $validated = $request->validated();
        $deviceId = isset($validated['device_id']) ? (string) $validated['device_id'] : null;

        if ($this->voucherService->isRateLimited($user->id, $deviceId)) {
            $retryAfter = $this->voucherService->rateLimitAvailableIn($user->id, $deviceId);

            return response()->json([
                'valid' => false,
                'error_code' => 'VOUCHER_RATE_LIMITED',
                'message' => "Terlalu banyak percobaan kode voucher gagal. Coba lagi dalam {$retryAfter} detik.",
                'retry_after' => $retryAfter,
            ], 429);
        }

        $at = ! empty($validated['evaluated_at']) ? Carbon::parse((string) $validated['evaluated_at']) : now();
        $pricing = $this->posPricingService->evaluateCart(
            $validated['items'],
            isset($validated['customer_id']) ? (int) $validated['customer_id'] : null,
            $at,
            (float) ($validated['discount_amount'] ?? 0),
            (bool) ($validated['has_cash_payment'] ?? true),
            (string) $validated['code'],
            isset($validated['reservation_token']) ? (string) $validated['reservation_token'] : null
        );

        $voucher = $pricing['voucher'];
        if (! is_array($voucher) || ! ($voucher['applied'] ?? false)) {
            $this->voucherService->recordFailedAttempt($user->id, $deviceId);

            return response()->json([
                'valid' => false,
                'error_code' => $voucher['error_code'] ?? 'VOUCHER_NOT_FOUND',
                'message' => $voucher['message'] ?? 'Kode voucher tidak valid.',
            ], 422);
        }

        return response()->json([
            'valid' => true,
            'voucher' => $voucher,
            'pricing' => $pricing,
        ]);
    }

    public function reserveVoucher(ValidatePosVoucherRequest $request): JsonResponse
    {
        Gate::authorize('create', Transaction::class);

        /** @var User $user */
        $user = $request->user();
        $validated = $request->validated();
        $deviceId = isset($validated['device_id']) ? (string) $validated['device_id'] : null;

        if ($this->voucherService->isRateLimited($user->id, $deviceId)) {
            $retryAfter = $this->voucherService->rateLimitAvailableIn($user->id, $deviceId);

            return response()->json([
                'valid' => false,
                'error_code' => 'VOUCHER_RATE_LIMITED',
                'message' => "Terlalu banyak percobaan kode voucher gagal. Coba lagi dalam {$retryAfter} detik.",
                'retry_after' => $retryAfter,
            ], 429);
        }

        $at = ! empty($validated['evaluated_at']) ? Carbon::parse((string) $validated['evaluated_at']) : now();
        $existingToken = isset($validated['reservation_token']) ? (string) $validated['reservation_token'] : null;
        $existingVouchers = is_array($validated['existing_vouchers'] ?? null) ? $validated['existing_vouchers'] : [];
        $customerId = isset($validated['customer_id']) ? (int) $validated['customer_id'] : null;
        $normalizedNewCode = $this->voucherService->normalizeCode((string) $validated['code']);

        // Cek duplikat di existing_vouchers
        foreach ($existingVouchers as $ev) {
            if ($this->voucherService->normalizeCode((string) ($ev['code'] ?? '')) === $normalizedNewCode) {
                return response()->json([
                    'valid' => false,
                    'error_code' => 'VOUCHER_DUPLICATE',
                    'message' => "Voucher {$normalizedNewCode} sudah terpasang di keranjang.",
                ], 422);
            }
        }

        $vouchersToEvaluate = [];
        if (! empty($existingVouchers)) {
            $vouchersToEvaluate = $existingVouchers;
            $vouchersToEvaluate[] = [
                'code' => (string) $validated['code'],
                'reservation_token' => null,
            ];
        }

        $pricing = $this->posPricingService->evaluateCart(
            $validated['items'],
            $customerId,
            $at,
            (float) ($validated['discount_amount'] ?? 0),
            (bool) ($validated['has_cash_payment'] ?? true),
            empty($vouchersToEvaluate) ? (string) $validated['code'] : null,
            empty($vouchersToEvaluate) ? $existingToken : null,
            null,
            'pos',
            [],
            null,
            $vouchersToEvaluate
        );

        $voucherInfo = ! empty($vouchersToEvaluate)
            ? collect($pricing['vouchers'] ?? [])->first(
                fn (array $v): bool => $this->voucherService->normalizeCode((string) ($v['code'] ?? '')) === $normalizedNewCode
            )
            : $pricing['voucher'];

        if (! is_array($voucherInfo) || ! ($voucherInfo['applied'] ?? false) || $voucherInfo['voucher_id'] === null) {
            $this->voucherService->recordFailedAttempt($user->id, $deviceId);

            return response()->json([
                'valid' => false,
                'error_code' => $voucherInfo['error_code'] ?? 'VOUCHER_NOT_FOUND',
                'message' => $voucherInfo['message'] ?? 'Kode voucher tidak valid.',
            ], 422);
        }

        if (empty($existingVouchers) && $existingToken !== null && trim($existingToken) !== '') {
            $this->voucherService->release($existingToken, $at);
        }

        /** @var Voucher $voucherModel */
        $voucherModel = Voucher::query()->findOrFail((int) $voucherInfo['voucher_id']);
        $redemption = $this->voucherService->reserve(
            $voucherModel,
            $user,
            $customerId,
            (int) $voucherInfo['discount_amount'],
            $at
        );

        return response()->json([
            'valid' => true,
            'reservation_token' => $redemption->reservation_token,
            'reserved_until' => $redemption->reserved_until?->toIso8601String(),
            'voucher' => $voucherInfo,
            'pricing' => $pricing,
        ]);
    }

    public function releaseVoucher(Request $request): JsonResponse
    {
        Gate::authorize('create', Transaction::class);

        $token = trim((string) $request->input('reservation_token', ''));
        $released = $token !== '' && $this->voucherService->release($token);

        return response()->json([
            'released' => $released,
            'message' => $released ? 'Reservasi voucher dilepas.' : 'Tidak ada reservasi aktif yang perlu dilepas.',
        ]);
    }

    public function checkout(CheckoutPosRequest $request): JsonResponse|RedirectResponse
    {
        Gate::authorize('create', Transaction::class);

        /** @var User $user */
        $user = $request->user();

        /** @var array{
         *     customer_id?: int|null,
         *     held_transaction_id?: int|null,
         *     discount_amount?: float|int|string|null,
         *     supervisor_pin?: string|null,
         *     items: array<int, array{product_id: int, product_unit_id?: int|null, qty: int, discount_amount?: float|int|string|null}>,
         *     payments: array<int, array{payment_method: string, financial_account_id: int, amount: float|int|string, reference_number?: string|null}>
         * } $validated */
        $validated = $request->validated();

        $transaction = $this->posTransactionService->checkout($user, $validated);
        $receiptPayload = self::formatReceiptPayload($transaction);

        if ($request->expectsJson() && ! $request->hasHeader('X-Inertia')) {
            return response()->json([
                'message' => "Transaksi {$transaction->invoice_number} berhasil diproses.",
                'transaction' => $receiptPayload,
            ], 201);
        }

        return redirect()->route('pos.cashier.index')
            ->with('success', "Transaksi {$transaction->invoice_number} berhasil diproses.")
            ->with('lastReceipt', $receiptPayload);
    }

    public function hold(HoldTransactionRequest $request): JsonResponse|RedirectResponse
    {
        Gate::authorize('create', Transaction::class);

        /** @var User $user */
        $user = $request->user();

        /** @var array{
         *     label?: string|null,
         *     customer_id?: int|null,
         *     discount_amount?: float|int|string|null,
         *     notes?: string|null,
         *     items: array<int, array{product_id: int, product_unit_id?: int|null, qty: int, discount_amount?: float|int|string|null}>
         * } $validated */
        $validated = $request->validated();

        $held = $this->posTransactionService->hold($user, $validated);

        if ($request->expectsJson() && ! $request->hasHeader('X-Inertia')) {
            return response()->json([
                'message' => "Transaksi berhasil ditahan ({$held->hold_code}).",
                'held' => $held,
                'heldTransactions' => $this->posTransactionService->listHeld($user),
            ], 201);
        }

        return back()->with('success', "Keranjang berhasil ditahan dengan kode {$held->hold_code}.");
    }

    public function heldList(Request $request): JsonResponse
    {
        Gate::authorize('create', Transaction::class);

        /** @var User $user */
        $user = $request->user();

        return response()->json([
            'heldTransactions' => $this->posTransactionService->listHeld($user),
        ]);
    }

    public function deleteHeld(Request $request, HeldTransaction $heldTransaction): JsonResponse|RedirectResponse
    {
        Gate::authorize('create', Transaction::class);

        /** @var User $user */
        $user = $request->user();
        $code = $heldTransaction->hold_code;

        $this->posTransactionService->deleteHeld($user, $heldTransaction);

        if ($request->expectsJson() && ! $request->hasHeader('X-Inertia')) {
            return response()->json([
                'message' => "Transaksi tertahan {$code} dihapus.",
                'heldTransactions' => $this->posTransactionService->listHeld($user),
            ]);
        }

        return back()->with('success', "Transaksi tertahan {$code} berhasil dihapus.");
    }

    /**
     * Format data transaksi menjadi payload struk thermal siap cetak.
     *
     * @return array<string, mixed>
     */
    public static function formatReceiptPayload(Transaction $transaction): array
    {
        $transaction->loadMissing([
            'user:id,name',
            'cashierShift:id,shift_number,register_name',
            'customer:id,member_code,name,phone,tier,points',
            'details.product:id,name,barcode,base_unit',
            'payments.financialAccount:id,code,name,type',
            'appliedPromotions',
        ]);

        $appliedVouchers = $transaction->appliedPromotions->filter(fn (AppliedPromotion $ap): bool => $ap->voucher_id !== null)->values();
        /** @var AppliedPromotion|null $appliedVoucher */
        $appliedVoucher = $appliedVouchers->first();
        $voucherMeta = is_array($appliedVoucher?->meta) ? $appliedVoucher->meta : [];
        $allVoucherCodes = $appliedVouchers
            ->map(fn (AppliedPromotion $ap): ?string => is_array($ap->meta) ? ($ap->meta['voucher_code'] ?? null) : null)
            ->filter()
            ->values()
            ->all();
        $totalVoucherDiscount = (float) $appliedVouchers->sum('discount_amount');

        $transactionPromotions = $transaction->appliedPromotions
            ->filter(fn (AppliedPromotion $ap): bool => in_array($ap->type, [
                PromotionType::MinSpendDiscount->value,
                PromotionType::MinSpendPercent->value,
                PromotionType::TebusMurah->value,
                PromotionType::GiftWithPurchase->value,
                PromotionType::Birthday->value,
                PromotionType::FirstPurchase->value,
            ], true))
            ->map(fn (AppliedPromotion $ap): array => [
                'type' => $ap->type,
                'name' => $ap->description_snapshot,
                'discount_amount' => (float) $ap->discount_amount,
            ])
            ->values()
            ->all();

        /** @var AppliedPromotion|null $appliedPaymentPromo */
        $appliedPaymentPromo = $transaction->appliedPromotions->first(
            fn (AppliedPromotion $ap): bool => $ap->type === PromotionType::PaymentPromo->value
        );

        $cashbackPromotions = $transaction->appliedPromotions
            ->filter(fn (AppliedPromotion $ap): bool => $ap->type === PromotionType::Cashback->value)
            ->map(fn (AppliedPromotion $ap): array => [
                'name' => $ap->description_snapshot,
                'cashback_amount' => (float) ($ap->meta['cashback_amount'] ?? 0),
            ])
            ->values()
            ->all();

        return [
            'id' => $transaction->id,
            'invoice_number' => $transaction->invoice_number,
            'status' => $transaction->status->value,
            'status_label' => $transaction->status->label(),
            'created_at' => $transaction->created_at?->format('d/m/Y H:i:s') ?? '-',
            'cashier_name' => $transaction->user?->name ?? '-',
            'register_name' => $transaction->cashierShift?->register_name ?? 'Kasir',
            'shift_number' => $transaction->cashierShift?->shift_number ?? '-',
            'customer_name' => $transaction->customer?->name,
            'customer_tier' => $transaction->customer?->tier?->value,
            'customer_tier_label' => $transaction->customer?->tier?->label(),
            'customer_points_balance' => $transaction->customer !== null ? (int) $transaction->customer->points : null,
            'points_redeemed' => (int) ($transaction->points_redeemed ?? 0),
            'points_redeem_amount' => (float) ($transaction->points_redeem_amount ?? 0),
            'points_earned' => (int) ($transaction->points_earned ?? 0),
            'subtotal' => (float) $transaction->subtotal,
            'discount_amount' => (float) $transaction->discount_amount,
            'voucher_code' => ! empty($allVoucherCodes) ? implode(', ', $allVoucherCodes) : null,
            'voucher_name' => $appliedVouchers->count() > 1
                ? "{$appliedVouchers->count()} Voucher"
                : ($appliedVoucher !== null ? ($voucherMeta['voucher_name'] ?? null) : null),
            'voucher_discount_amount' => $totalVoucherDiscount,
            'transaction_promotions' => $transactionPromotions,
            'payment_promotion' => $appliedPaymentPromo !== null ? [
                'name' => $appliedPaymentPromo->description_snapshot,
                'discount_amount' => (float) $appliedPaymentPromo->discount_amount,
                'payment_method' => $appliedPaymentPromo->meta['payment_method'] ?? null,
            ] : null,
            'cashback_promotions' => $cashbackPromotions,
            'tax_amount' => (float) $transaction->tax_amount,
            'rounding_amount' => (float) $transaction->rounding_amount,
            'donation_amount' => (float) $transaction->donation_amount,
            'grand_total' => (float) $transaction->grand_total,
            'paid_amount' => (float) $transaction->paid_amount,
            'change_amount' => (float) ($transaction->change_amount ?? 0),
            'items' => $transaction->details->map(function (TransactionDetail $d): array {
                $qty = $d->qty > 0 ? $d->qty : max(1, (int) $d->quantity);
                $baseUnitPrice = (float) ((float) $d->unit_price > 0 ? $d->unit_price : $d->sell_price);
                $effectiveUnitPrice = $qty > 0 ? round((float) $d->subtotal / $qty, 2) : $baseUnitPrice;

                return [
                    'id' => $d->id,
                    'product_name' => $d->product?->name ?? "Produk #{$d->product_id}",
                    'unit_name' => $d->unit_name_snapshot ?: 'pcs',
                    'qty' => $qty,
                    'unit_price' => $baseUnitPrice,
                    'effective_unit_price' => $effectiveUnitPrice,
                    'discount_amount' => (float) $d->discount_amount,
                    'pricing_source' => $d->pricing_source ?: 'regular',
                    'applied_promotion_name' => $d->applied_promotion_name,
                    'free_qty' => (int) ($d->free_qty ?? 0),
                    'is_tax_exempt' => (bool) $d->is_tax_exempt,
                    'is_donation' => (bool) $d->is_donation,
                    'subtotal' => (float) $d->subtotal,
                ];
            })->values()->all(),
            'payments' => $transaction->payments->map(fn (TransactionPayment $p): array => [
                'id' => $p->id,
                'payment_method' => $p->payment_method->value,
                'payment_method_label' => $p->payment_method->label(),
                'account_name' => $p->financialAccount?->name ?? '-',
                'amount' => (float) $p->amount,
                'reference_number' => $p->reference_number,
            ])->values()->all(),
        ];
    }
}

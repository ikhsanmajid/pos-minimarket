<?php

use App\Enums\ActivityLogCategory;
use App\Enums\CashierShiftStatus;
use App\Enums\FinancialAccountType;
use App\Enums\PaymentMethod;
use App\Enums\ProductTaxMode;
use App\Enums\PromotionFunding;
use App\Enums\PromotionScope;
use App\Enums\PromotionType;
use App\Enums\RoundingMode;
use App\Enums\UserRoles;
use App\Enums\VoucherErrorCode;
use App\Enums\VoucherRedemptionStatus;
use App\Enums\VoucherStatus;
use App\Enums\VoucherType;
use App\Models\AppliedPromotion;
use App\Models\CashierShift;
use App\Models\Category;
use App\Models\Customer;
use App\Models\FinancialAccount;
use App\Models\Product;
use App\Models\Promotion;
use App\Models\Transaction;
use App\Models\User;
use App\Models\Voucher;
use App\Models\VoucherRedemption;
use App\Services\PosPricingService;
use App\Services\PosTransactionService;
use App\Services\SalesReturnService;
use App\Services\StoreSettingService;
use App\Services\VoucherService;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Validation\ValidationException;
use Spatie\Activitylog\Models\Activity;

function seedVoucherFixtures(): array
{
    app(StoreSettingService::class)->update([
        'store_name' => 'Minimarket Voucher Test',
        'default_tax_rate' => 0,
        'rounding_mode' => RoundingMode::None->value,
        'shift_variance_tolerance' => 0,
    ]);

    $normalCategory = Category::create([
        'name' => 'Makanan & Minuman',
        'slug' => 'makanan-minuman-vch',
        'code' => 'CAT-VCH-01',
        'is_active' => true,
        'is_promo_excluded' => false,
    ]);

    $snackCategory = Category::create([
        'name' => 'Snack Ringan',
        'slug' => 'snack-ringan-vch',
        'code' => 'CAT-VCH-02',
        'is_active' => true,
        'is_promo_excluded' => false,
    ]);

    $excludedCategory = Category::create([
        'name' => 'Rokok & Tembakau',
        'slug' => 'rokok-tembakau-vch',
        'code' => 'CAT-VCH-EX',
        'is_active' => true,
        'is_promo_excluded' => false, // excluded by keyword
    ]);

    $productA = Product::create([
        'category_id' => $normalCategory->id,
        'barcode' => 'VCH-SKU-001',
        'name' => 'Kopi Kaleng 250ml',
        'base_unit' => 'pcs',
        'buy_price' => 4000,
        'sell_price' => 10000,
        'stock' => 200,
        'min_stock' => 5,
        'active' => true,
        'tax_mode' => ProductTaxMode::Exclusive,
    ]);

    $productB = Product::create([
        'category_id' => $snackCategory->id,
        'barcode' => 'VCH-SKU-002',
        'name' => 'Keripik Kentang 100g',
        'base_unit' => 'pcs',
        'buy_price' => 10000,
        'sell_price' => 25000,
        'stock' => 200,
        'min_stock' => 5,
        'active' => true,
        'tax_mode' => ProductTaxMode::Exclusive,
    ]);

    $excludedProduct = Product::create([
        'category_id' => $excludedCategory->id,
        'barcode' => 'VCH-SKU-EX1',
        'name' => 'Rokok Kretek 12',
        'base_unit' => 'bungkus',
        'buy_price' => 20000,
        'sell_price' => 50000,
        'stock' => 100,
        'min_stock' => 5,
        'active' => true,
        'tax_mode' => ProductTaxMode::Exclusive,
    ]);

    $admin = User::factory()->create([
        'role' => UserRoles::Admin,
        'pin' => Hash::make('123456'),
    ]);

    $supervisor = User::factory()->create([
        'role' => UserRoles::Supervisor,
        'pin' => Hash::make('654321'),
    ]);

    $cashier = User::factory()->create([
        'role' => UserRoles::Cashier,
    ]);

    $warehouse = User::factory()->create([
        'role' => UserRoles::Warehouse,
    ]);

    $cashAccount = FinancialAccount::create([
        'code' => 'KAS-VCH-01',
        'name' => 'Kas Laci Voucher',
        'type' => FinancialAccountType::Cash,
        'opening_balance' => 500000,
        'current_balance' => 500000,
        'is_default' => true,
        'is_active' => true,
    ]);

    $shift = CashierShift::create([
        'shift_number' => 'SHF-VCH-001',
        'user_id' => $cashier->id,
        'register_name' => 'Kasir 1',
        'opened_at' => now()->subHour(),
        'starting_cash' => 200000,
        'status' => CashierShiftStatus::Open,
    ]);

    $member = Customer::create([
        'member_code' => 'MBR-VCH-001',
        'name' => 'Budi Member',
        'phone' => '081234567890',
        'points' => 100,
        'is_active' => true,
    ]);

    return compact(
        'normalCategory',
        'snackCategory',
        'excludedCategory',
        'productA',
        'productB',
        'excludedProduct',
        'admin',
        'supervisor',
        'cashier',
        'warehouse',
        'cashAccount',
        'shift',
        'member'
    );
}

function makeActiveVoucher(array $overrides = []): Voucher
{
    return Voucher::create(array_merge([
        'code' => 'HEMAT10K',
        'name' => 'Potongan Rp 10.000',
        'type' => VoucherType::FixedAmount,
        'value' => 10000,
        'max_discount' => null,
        'min_spend' => 0,
        'valid_from' => now()->subDay(),
        'valid_until' => now()->addDays(7),
        'allowed_days' => 127,
        'allowed_hours_start' => null,
        'allowed_hours_end' => null,
        'total_quota' => null,
        'used_count' => 0,
        'per_customer_limit' => null,
        'per_day_limit' => null,
        'store_ids' => null,
        'channel' => 'pos',
        'member_only' => false,
        'member_tiers' => null,
        'applicable_skus' => null,
        'applicable_categories' => null,
        'excluded_skus' => null,
        'excluded_categories' => null,
        'free_product_id' => null,
        'stackable_with_promo' => true,
        'stackable_with_voucher' => false,
        'funding' => PromotionFunding::Store,
        'status' => VoucherStatus::Active,
    ], $overrides));
}

test('seluruh 11 kode error validasi voucher berhenti sesuai urutan ketat', function () {
    $fx = seedVoucherFixtures();
    $pricing = app(PosPricingService::class);
    $voucherService = app(VoucherService::class);
    $cartItems = [
        ['product_id' => $fx['productA']->id, 'qty' => 2], // Rp 20.000
    ];

    // 1. VOUCHER_INVALID_FORMAT
    $res1 = $pricing->evaluateCart($cartItems, null, now(), 0, true, '@@');
    expect($res1['voucher']['applied'])->toBeFalse()
        ->and($res1['voucher']['error_code'])->toBe(VoucherErrorCode::VoucherInvalidFormat->value);

    // 2. VOUCHER_NOT_FOUND
    $res2 = $pricing->evaluateCart($cartItems, null, now(), 0, true, 'TIDAKADA99');
    expect($res2['voucher']['applied'])->toBeFalse()
        ->and($res2['voucher']['error_code'])->toBe(VoucherErrorCode::VoucherNotFound->value);

    // 3. VOUCHER_INACTIVE (draft / paused)
    makeActiveVoucher(['code' => 'DRAFTVCH', 'status' => VoucherStatus::Draft]);
    $res3 = $pricing->evaluateCart($cartItems, null, now(), 0, true, 'draftvch');
    expect($res3['voucher']['error_code'])->toBe(VoucherErrorCode::VoucherInactive->value);

    // 4a. VOUCHER_NOT_YET_VALID
    makeActiveVoucher([
        'code' => 'FUTUREVCH',
        'valid_from' => now()->addHours(2),
        'valid_until' => now()->addDays(2),
    ]);
    $res4a = $pricing->evaluateCart($cartItems, null, now(), 0, true, 'FUTUREVCH');
    expect($res4a['voucher']['error_code'])->toBe(VoucherErrorCode::VoucherNotYetValid->value);

    // 4b. VOUCHER_EXPIRED (tanggal lewat & jam WIB di luar jadwal)
    makeActiveVoucher([
        'code' => 'EXPIREDVCH',
        'valid_from' => now()->subDays(5),
        'valid_until' => now()->subHour(),
    ]);
    $res4b = $pricing->evaluateCart($cartItems, null, now(), 0, true, 'EXPIREDVCH');
    expect($res4b['voucher']['error_code'])->toBe(VoucherErrorCode::VoucherExpired->value);

    // Jam WIB (mis. hanya 08:00 - 10:00 WIB, dievaluasi pukul 15:00 WIB)
    makeActiveVoucher([
        'code' => 'PAGI2JAM',
        'allowed_hours_start' => '08:00',
        'allowed_hours_end' => '10:00',
    ]);
    $afternoonWib = Carbon::parse('2026-11-28 15:00:00', 'Asia/Jakarta')->utc();
    $res4c = $pricing->evaluateCart($cartItems, null, $afternoonWib, 0, true, 'PAGI2JAM');
    expect($res4c['voucher']['error_code'])->toBe(VoucherErrorCode::VoucherExpired->value);

    // 5. VOUCHER_STORE_NOT_ALLOWED
    makeActiveVoucher(['code' => 'STORE99', 'store_ids' => [99]]);
    $res5 = $pricing->evaluateCart($cartItems, null, now(), 0, true, 'STORE99', null, 1, 'pos');
    expect($res5['voucher']['error_code'])->toBe(VoucherErrorCode::VoucherStoreNotAllowed->value);

    // 6. VOUCHER_QUOTA_EXHAUSTED
    makeActiveVoucher(['code' => 'KUOTA1', 'total_quota' => 1, 'used_count' => 1]);
    $res6 = $pricing->evaluateCart($cartItems, null, now(), 0, true, 'KUOTA1');
    expect($res6['voucher']['error_code'])->toBe(VoucherErrorCode::VoucherQuotaExhausted->value);

    // 7. VOUCHER_CUSTOMER_LIMIT
    $custLimitVoucher = makeActiveVoucher(['code' => 'ONCEUSER', 'per_customer_limit' => 1]);
    VoucherRedemption::create([
        'voucher_id' => $custLimitVoucher->id,
        'customer_id' => $fx['member']->id,
        'cashier_id' => $fx['cashier']->id,
        'status' => VoucherRedemptionStatus::Redeemed,
        'discount_amount' => 10000,
        'redeemed_at' => now()->subMinute(),
    ]);
    $res7 = $pricing->evaluateCart($cartItems, $fx['member']->id, now(), 0, true, 'ONCEUSER');
    expect($res7['voucher']['error_code'])->toBe(VoucherErrorCode::VoucherCustomerLimit->value);

    // 8. VOUCHER_MEMBER_ONLY
    makeActiveVoucher(['code' => 'ONLYMEMBER', 'member_only' => true]);
    $res8 = $pricing->evaluateCart($cartItems, null, now(), 0, true, 'ONLYMEMBER');
    expect($res8['voucher']['error_code'])->toBe(VoucherErrorCode::VoucherMemberOnly->value);

    // 9. VOUCHER_MIN_SPEND_NOT_MET
    makeActiveVoucher(['code' => 'MIN100K', 'min_spend' => 100000]);
    $res9 = $pricing->evaluateCart($cartItems, null, now(), 0, true, 'MIN100K');
    expect($res9['voucher']['error_code'])->toBe(VoucherErrorCode::VoucherMinSpendNotMet->value);

    // 10. VOUCHER_NO_ELIGIBLE_ITEM
    makeActiveVoucher([
        'code' => 'SNACKONLY',
        'applicable_categories' => [$fx['snackCategory']->id],
    ]);
    $res10 = $pricing->evaluateCart($cartItems, null, now(), 0, true, 'SNACKONLY');
    expect($res10['voucher']['error_code'])->toBe(VoucherErrorCode::VoucherNoEligibleItem->value);

    // 11. VOUCHER_NOT_STACKABLE (promo otomatis aktif & stackable_with_promo = false)
    Promotion::create([
        'name' => 'Promo Kopi 10%',
        'type' => PromotionType::PercentageDiscount,
        'scope' => PromotionScope::AllProducts,
        'funding' => PromotionFunding::Store,
        'discount_value' => 10,
        'starts_at' => now()->subDay(),
        'ends_at' => now()->addDay(),
        'is_active' => true,
    ]);
    makeActiveVoucher(['code' => 'NOSTACK', 'stackable_with_promo' => false]);
    $res11 = $pricing->evaluateCart($cartItems, null, now(), 0, true, 'NOSTACK');
    expect($res11['voucher']['error_code'])->toBe(VoucherErrorCode::VoucherNotStackable->value);

    // Non-stackable dengan voucher lain (hasOtherVoucher = true)
    $evalNoOther = $voucherService->evaluateVoucherForLines(
        'HEMAT10K',
        [[
            'index' => 0,
            'product' => $fx['productA'],
            'product_id' => $fx['productA']->id,
            'qty' => 2,
            'base_unit_price' => 10000,
            'line_gross' => 20000,
            'auto_discount_amount' => 0,
            'line_subtotal' => 20000,
            'is_promo_excluded' => false,
        ]],
        null,
        now(),
        null,
        null,
        'pos',
        true
    );
    expect($evalNoOther['valid'])->toBeFalse()
        ->and($evalNoOther['error_code'])->toBe(VoucherErrorCode::VoucherNotStackable);
});

test('voucher persentase melebihi max_discount dibatasi plafon max_discount', function () {
    $fx = seedVoucherFixtures();
    makeActiveVoucher([
        'code' => 'PERSEN50',
        'type' => VoucherType::Percentage,
        'value' => 50,
        'max_discount' => 15000,
    ]);

    $pricing = app(PosPricingService::class);
    // 4 x 25.000 = 100.000 -> 50% = 50.000, plafon 15.000
    $res = $pricing->evaluateCart([
        ['product_id' => $fx['productB']->id, 'qty' => 4],
    ], null, now(), 0, true, 'PERSEN50');

    expect($res['voucher']['applied'])->toBeTrue()
        ->and($res['summary']['voucher_discount_total'])->toBe(15000)
        ->and($res['summary']['grand_total'])->toBe(85000);
});

test('minimal belanja terpenuhi hanya karena item excluded ditolak', function () {
    $fx = seedVoucherFixtures();
    makeActiveVoucher([
        'code' => 'MIN50K',
        'value' => 10000,
        'min_spend' => 50000,
    ]);

    $pricing = app(PosPricingService::class);
    // Kopi Rp 10.000 (eligible) + Rokok Rp 50.000 (excluded) = total Rp 60.000, tapi eligible hanya Rp 10.000 < Rp 50.000
    $res = $pricing->evaluateCart([
        ['product_id' => $fx['productA']->id, 'qty' => 1],
        ['product_id' => $fx['excludedProduct']->id, 'qty' => 1],
    ], null, now(), 0, true, 'MIN50K');

    expect($res['voucher']['applied'])->toBeFalse()
        ->and($res['voucher']['error_code'])->toBe(VoucherErrorCode::VoucherMinSpendNotMet->value)
        ->and($res['summary']['voucher_discount_total'])->toBe(0);
});

test('voucher lebih besar dari total belanja menghasilkan grand total Rp0 tanpa PIN Supervisor', function () {
    $fx = seedVoucherFixtures();
    makeActiveVoucher([
        'code' => 'GIFT50K',
        'type' => VoucherType::CashVoucher,
        'value' => 50000,
    ]);

    $txService = app(PosTransactionService::class);
    $transaction = $txService->checkout($fx['cashier'], [
        'voucher_code' => 'gift50k',
        'items' => [
            ['product_id' => $fx['productA']->id, 'qty' => 2], // Rp 20.000
        ],
        'payments' => [
            [
                'payment_method' => PaymentMethod::Cash->value,
                'financial_account_id' => $fx['cashAccount']->id,
                'amount' => 0,
            ],
        ],
    ]);

    expect((float) $transaction->grand_total)->toBe(0.0)
        ->and((float) $transaction->discount_amount)->toBe(20000.0)
        ->and((float) $transaction->change_amount)->toBe(0.0)
        ->and($transaction->discount_approved_by)->toBeNull();

    $redemption = VoucherRedemption::query()->where('transaction_id', $transaction->id)->first();
    expect($redemption)->not->toBeNull()
        ->and($redemption->status)->toBe(VoucherRedemptionStatus::Redeemed)
        ->and((float) $redemption->discount_amount)->toBe(20000.0);
});

test('dua checkout memakai voucher kuota 1 hanya 1 yang sukses', function () {
    $fx = seedVoucherFixtures();
    $voucher = makeActiveVoucher([
        'code' => 'SATUJA',
        'total_quota' => 1,
        'value' => 5000,
    ]);

    $txService = app(PosTransactionService::class);
    $payload = [
        'voucher_code' => 'SATUJA',
        'items' => [
            ['product_id' => $fx['productA']->id, 'qty' => 2],
        ],
        'payments' => [
            [
                'payment_method' => PaymentMethod::Cash->value,
                'financial_account_id' => $fx['cashAccount']->id,
                'amount' => 15000,
            ],
        ],
    ];

    $firstTx = $txService->checkout($fx['cashier'], $payload);
    expect($firstTx)->toBeInstanceOf(Transaction::class);

    $voucher->refresh();
    expect($voucher->used_count)->toBe(1)
        ->and($voucher->status)->toBe(VoucherStatus::Exhausted);

    expect(fn () => $txService->checkout($fx['cashier'], $payload))
        ->toThrow(ValidationException::class);

    expect(VoucherRedemption::query()->where('voucher_id', $voucher->id)->where('status', VoucherRedemptionStatus::Redeemed->value)->count())->toBe(1);
});

test('item dihapus setelah voucher terpasang memicu revalidasi lepas voucher dan release reservasi', function () {
    $fx = seedVoucherFixtures();
    makeActiveVoucher([
        'code' => 'MIN30K',
        'value' => 5000,
        'min_spend' => 30000,
    ]);

    // 1. Reserve voucher saat keranjang Rp 35.000
    $reserveRes = $this->actingAs($fx['cashier'])
        ->postJson(route('pos.cashier.voucher.reserve'), [
            'code' => 'MIN30K',
            'items' => [
                ['product_id' => $fx['productA']->id, 'qty' => 1], // 10.000
                ['product_id' => $fx['productB']->id, 'qty' => 1], // 25.000
            ],
        ]);

    $reserveRes->assertOk()
        ->assertJsonPath('valid', true)
        ->assertJsonPath('voucher.discount_amount', 5000);

    $token = (string) $reserveRes->json('reservation_token');
    expect($token)->not->toBeEmpty();

    // 2. Hapus productB sehingga keranjang tinggal Rp 10.000 (< min_spend Rp 30.000)
    $calcRes = $this->actingAs($fx['cashier'])
        ->postJson(route('pos.cashier.calculate-cart'), [
            'voucher_code' => 'MIN30K',
            'voucher_reservation_token' => $token,
            'items' => [
                ['product_id' => $fx['productA']->id, 'qty' => 1],
            ],
        ]);

    $calcRes->assertOk()
        ->assertJsonPath('voucher.applied', false)
        ->assertJsonPath('voucher.auto_removed', true)
        ->assertJsonPath('voucher.error_code', VoucherErrorCode::VoucherMinSpendNotMet->value)
        ->assertJsonPath('summary.voucher_discount_total', 0);

    $redemption = VoucherRedemption::query()->where('reservation_token', $token)->firstOrFail();
    expect($redemption->status)->toBe(VoucherRedemptionStatus::Released)
        ->and($redemption->released_at)->not->toBeNull();
});

test('rate limit percobaan kode voucher gagal 5x per menit mengembalikan HTTP 429', function () {
    $fx = seedVoucherFixtures();
    $voucherService = app(VoucherService::class);
    RateLimiter::clear($voucherService->rateLimitKey($fx['cashier']->id, 'POS-DEV-1'));

    for ($i = 1; $i <= 5; $i++) {
        $this->actingAs($fx['cashier'])
            ->postJson(route('pos.cashier.voucher.validate'), [
                'code' => 'SALAH'.$i,
                'device_id' => 'POS-DEV-1',
                'items' => [
                    ['product_id' => $fx['productA']->id, 'qty' => 1],
                ],
            ])
            ->assertStatus(422)
            ->assertJsonPath('error_code', VoucherErrorCode::VoucherNotFound->value);
    }

    // Percobaan ke-6 dalam 1 menit diblokir HTTP 429
    $this->actingAs($fx['cashier'])
        ->postJson(route('pos.cashier.voucher.validate'), [
            'code' => 'SALAH6',
            'device_id' => 'POS-DEV-1',
            'items' => [
                ['product_id' => $fx['productA']->id, 'qty' => 1],
            ],
        ])
        ->assertStatus(429)
        ->assertJsonPath('error_code', 'VOUCHER_RATE_LIMITED');
});

test('retur parsial yang membuat voucher tidak lagi valid memotong refund sebesar manfaat voucher yang hilang', function () {
    $fx = seedVoucherFixtures();
    makeActiveVoucher([
        'code' => 'PROMO20K',
        'value' => 20000,
        'min_spend' => 100000,
    ]);

    $txService = app(PosTransactionService::class);
    // Item A: 6 x 10.000 = 60.000; Item B: 2 x 25.000 = 50.000 -> Total 110.000 - Voucher 20.000 = 90.000
    $transaction = $txService->checkout($fx['cashier'], [
        'voucher_code' => 'PROMO20K',
        'items' => [
            ['product_id' => $fx['productA']->id, 'qty' => 6],
            ['product_id' => $fx['productB']->id, 'qty' => 2],
        ],
        'payments' => [
            [
                'payment_method' => PaymentMethod::Cash->value,
                'financial_account_id' => $fx['cashAccount']->id,
                'amount' => 90000,
            ],
        ],
    ]);

    expect((float) $transaction->grand_total)->toBe(90000.0);

    $detailA = $transaction->details->firstWhere('product_id', $fx['productA']->id);
    expect($detailA)->not->toBeNull();

    // Retur seluruh Item A (Rp 60.000) -> sisa belanja Item B hanya Rp 50.000 (< min_spend Rp 100.000)
    // Pelanggan bayar 90.000; item yang tetap disimpan bernilai penuh 50.000 -> refund tepat 40.000
    $returnService = app(SalesReturnService::class);
    $salesReturn = $returnService->processReturn($transaction, [
        'refund_method' => PaymentMethod::Cash->value,
        'financial_account_id' => $fx['cashAccount']->id,
        'reason' => 'Berubah pikiran',
        'supervisor_pin' => '123456',
        'items' => [
            [
                'transaction_detail_id' => $detailA->id,
                'qty' => 6,
                'is_restockable' => true,
            ],
        ],
    ], $fx['cashier']);

    expect((float) $salesReturn->total_refund_amount)->toBe(40000.0);

    $appliedVoucher = AppliedPromotion::query()
        ->where('transaction_id', $transaction->id)
        ->whereNotNull('voucher_id')
        ->firstOrFail();
    expect($appliedVoucher->meta['voucher_clawback_applied'] ?? false)->toBeTrue();
});

test('void transaksi mengembalikan kuota voucher dan mengubah redemption menjadi refunded', function () {
    $fx = seedVoucherFixtures();
    $voucher = makeActiveVoucher([
        'code' => 'VOIDTEST',
        'total_quota' => 1,
        'value' => 5000,
    ]);

    $txService = app(PosTransactionService::class);
    $transaction = $txService->checkout($fx['cashier'], [
        'voucher_code' => 'VOIDTEST',
        'items' => [
            ['product_id' => $fx['productA']->id, 'qty' => 2],
        ],
        'payments' => [
            [
                'payment_method' => PaymentMethod::Cash->value,
                'financial_account_id' => $fx['cashAccount']->id,
                'amount' => 15000,
            ],
        ],
    ]);

    $voucher->refresh();
    expect($voucher->used_count)->toBe(1)
        ->and($voucher->status)->toBe(VoucherStatus::Exhausted);

    $txService->void($transaction, [
        'reason' => 'Salah input kasir',
        'supervisor_pin' => '123456',
    ], $fx['cashier']);

    $voucher->refresh();
    expect($voucher->used_count)->toBe(0)
        ->and($voucher->status)->toBe(VoucherStatus::Active);

    $redemption = VoucherRedemption::query()->where('transaction_id', $transaction->id)->firstOrFail();
    expect($redemption->status)->toBe(VoucherRedemptionStatus::Refunded);
});

test('policy voucher mengizinkan Admin & Supervisor dan menolak Kasir & Gudang dengan 403 serta mencatat Activity Log', function () {
    $fx = seedVoucherFixtures();

    // Admin & Supervisor boleh akses
    $this->actingAs($fx['admin'])->get(route('pos.vouchers.index'))->assertOk();
    $this->actingAs($fx['supervisor'])->get(route('pos.vouchers.index'))->assertOk();

    // Kasir & Gudang ditolak 403
    $this->actingAs($fx['cashier'])->get(route('pos.vouchers.index'))->assertForbidden();
    $this->actingAs($fx['warehouse'])->get(route('pos.vouchers.index'))->assertForbidden();

    $this->actingAs($fx['cashier'])->post(route('pos.vouchers.store'), [
        'code' => 'FORBID10',
        'name' => 'Tidak Boleh',
        'type' => VoucherType::FixedAmount->value,
        'value' => 10000,
        'valid_from' => now()->toDateTimeString(),
        'valid_until' => now()->addDay()->toDateTimeString(),
    ])->assertForbidden();

    // Admin buat voucher tunggal & massal -> tercatat di Activity Log kategori Promotion
    $this->actingAs($fx['admin'])->post(route('pos.vouchers.store'), [
        'code' => 'audit10k',
        'name' => 'Voucher Audit',
        'type' => VoucherType::FixedAmount->value,
        'value' => 10000,
        'min_spend' => 25000,
        'valid_from' => now()->subHour()->format('Y-m-d\TH:i'),
        'valid_until' => now()->addDays(7)->format('Y-m-d\TH:i'),
        'status' => VoucherStatus::Active->value,
    ])->assertRedirect();

    $voucher = Voucher::query()->where('code', 'AUDIT10K')->firstOrFail();
    $log = Activity::query()
        ->where('subject_type', Voucher::class)
        ->where('subject_id', $voucher->id)
        ->latest('id')
        ->first();

    expect($log)->not->toBeNull()
        ->and($log->log_name)->toBe(ActivityLogCategory::Promotion->value)
        ->and($log->description)->toContain('AUDIT10K')
        ->and(ActivityLogCategory::fromSubjectType(Voucher::class))->toBe(ActivityLogCategory::Promotion)
        ->and(ActivityLogCategory::fromSubjectType(VoucherRedemption::class))->toBe(ActivityLogCategory::Promotion);

    // Generator massal PREFIX-XXXX-XXXX dengan checksum valid & tanpa karakter ambigu 0/O/1/I/L
    $this->actingAs($fx['admin'])->post(route('pos.vouchers.bulk'), [
        'prefix' => 'GAJIAN',
        'count' => 5,
        'name' => 'Voucher Gajian Massal',
        'type' => VoucherType::FixedAmount->value,
        'value' => 15000,
        'min_spend' => 50000,
        'total_quota' => 1,
        'valid_from' => now()->subHour()->format('Y-m-d\TH:i'),
        'valid_until' => now()->addDays(7)->format('Y-m-d\TH:i'),
        'status' => VoucherStatus::Active->value,
    ])->assertRedirect();

    $bulkVouchers = Voucher::query()->where('code', 'like', 'GAJIAN-%')->get();
    $voucherService = app(VoucherService::class);
    expect($bulkVouchers)->toHaveCount(5);

    foreach ($bulkVouchers as $bv) {
        expect($bv->code)->toMatch('/^GAJIAN-[A-Z2-9]{4}-[A-Z2-9]{4}$/')
            ->and($voucherService->verifyBulkChecksum($bv->code))->toBeTrue();

        $randomSuffix = substr($bv->code, strlen('GAJIAN-'));
        expect(preg_match('/[0O1IL]/', $randomSuffix))->toBe(0);
    }
});

<?php

use App\Enums\CashierShiftStatus;
use App\Enums\CustomerTier;
use App\Enums\FinancialAccountType;
use App\Enums\PaymentMethod;
use App\Enums\PointLedgerType;
use App\Enums\ProductTaxMode;
use App\Enums\PromotionFunding;
use App\Enums\PromotionScope;
use App\Enums\PromotionType;
use App\Enums\RoundingMode;
use App\Enums\UserRoles;
use App\Models\CashierShift;
use App\Models\Category;
use App\Models\Customer;
use App\Models\CustomerPointLedger;
use App\Models\FinancialAccount;
use App\Models\Product;
use App\Models\ProductMemberPrice;
use App\Models\Promotion;
use App\Models\User;
use App\Services\LoyaltyService;
use App\Services\PosPricingService;
use App\Services\PosTransactionService;
use App\Services\SalesReturnService;
use App\Services\StoreSettingService;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Hash;

/**
 * @return array{
 *     admin: User,
 *     shift: CashierShift,
 *     cashAccount: FinancialAccount,
 *     prodRegular: Product,
 *     prodSnack: Product,
 *     prodRokok: Product,
 *     prodPulsa: Product,
 *     prodDonation: Product
 * }
 */
function seedLoyaltyFixtures(float $taxRate = 0.0): array
{
    app(StoreSettingService::class)->update([
        'default_tax_rate' => $taxRate,
        'rounding_mode' => RoundingMode::None->value,
    ]);

    $catNormal = Category::create([
        'name' => 'Minuman',
        'slug' => 'minuman-f4',
        'code' => 'CAT-F4-01',
        'is_active' => true,
        'is_promo_excluded' => false,
    ]);

    $catRokok = Category::create([
        'name' => 'Rokok',
        'slug' => 'rokok-f4',
        'code' => 'CAT-F4-02',
        'is_active' => true,
        'is_promo_excluded' => true,
    ]);

    $catPulsa = Category::create([
        'name' => 'Pulsa & PPOB',
        'slug' => 'pulsa-ppob-f4',
        'code' => 'CAT-F4-03',
        'is_active' => true,
        'is_promo_excluded' => true,
    ]);

    $prodRegular = Product::create([
        'category_id' => $catNormal->id,
        'barcode' => '8994000001',
        'name' => 'Susu UHT 1L',
        'base_unit' => 'pcs',
        'buy_price' => 12000,
        'sell_price' => 20000,
        'stock' => 200,
        'min_stock' => 5,
        'active' => true,
        'tax_mode' => ProductTaxMode::Exclusive,
    ]);

    $prodSnack = Product::create([
        'category_id' => $catNormal->id,
        'barcode' => '8994000002',
        'name' => 'Biskuit Kaleng',
        'base_unit' => 'pcs',
        'buy_price' => 10000,
        'sell_price' => 15000,
        'stock' => 200,
        'min_stock' => 5,
        'active' => true,
        'tax_mode' => ProductTaxMode::Exclusive,
    ]);

    $prodRokok = Product::create([
        'category_id' => $catRokok->id,
        'barcode' => '8994000003',
        'name' => 'Rokok Filter 12',
        'base_unit' => 'pcs',
        'buy_price' => 25000,
        'sell_price' => 30000,
        'stock' => 100,
        'min_stock' => 5,
        'active' => true,
        'is_promo_excluded' => true,
        'tax_mode' => ProductTaxMode::Exclusive,
    ]);

    $prodPulsa = Product::create([
        'category_id' => $catPulsa->id,
        'barcode' => '8994000004',
        'name' => 'Voucher Pulsa 50rb',
        'base_unit' => 'pcs',
        'buy_price' => 48000,
        'sell_price' => 50000,
        'stock' => 100,
        'min_stock' => 5,
        'active' => true,
        'is_promo_excluded' => true,
        'tax_mode' => ProductTaxMode::Exempt,
        'is_tax_exempt' => true,
    ]);

    $prodDonation = Product::create([
        'category_id' => $catNormal->id,
        'barcode' => '8994000005',
        'name' => 'Donasi Pendidikan',
        'base_unit' => 'pcs',
        'buy_price' => 0,
        'sell_price' => 10000,
        'stock' => 0,
        'min_stock' => 0,
        'active' => true,
        'is_donation' => true,
        'is_tax_exempt' => true,
        'tax_mode' => ProductTaxMode::Exempt,
    ]);

    $cashAccount = FinancialAccount::create([
        'code' => 'KAS-F4',
        'name' => 'Kas Kasir F4',
        'type' => FinancialAccountType::Cash,
        'opening_balance' => 1000000,
        'current_balance' => 1000000,
        'is_default' => true,
        'is_active' => true,
    ]);

    $admin = User::factory()->create([
        'role' => UserRoles::Admin,
        'pin' => Hash::make('123456'),
    ]);

    $shift = CashierShift::create([
        'shift_number' => 'SHF-F4-0001',
        'user_id' => $admin->id,
        'register_name' => 'Kasir 1',
        'opened_at' => now()->subHour(),
        'starting_cash' => 500000,
        'status' => CashierShiftStatus::Open,
    ]);

    return [
        'admin' => $admin,
        'shift' => $shift,
        'cashAccount' => $cashAccount,
        'prodRegular' => $prodRegular,
        'prodSnack' => $prodSnack,
        'prodRokok' => $prodRokok,
        'prodPulsa' => $prodPulsa,
        'prodDonation' => $prodDonation,
    ];
}

test('earn points calculates 1 point per Rp10.000 floored and multiplied by Silver/Gold/Platinum tier', function (): void {
    $fx = seedLoyaltyFixtures();
    $pricing = app(PosPricingService::class);

    // 2 * 20.000 + 1 * 15.000 = Rp 55.000 -> floor(55000/10000) = 5 base points
    $items = [
        ['product_id' => $fx['prodRegular']->id, 'qty' => 2],
        ['product_id' => $fx['prodSnack']->id, 'qty' => 1],
    ];

    $silver = Customer::factory()->create(['tier' => CustomerTier::Silver, 'points' => 0]);
    $gold = Customer::factory()->create(['tier' => CustomerTier::Gold, 'points' => 0]);
    $platinum = Customer::factory()->create(['tier' => CustomerTier::Platinum, 'points' => 0]);

    $resSilver = $pricing->evaluateCart($items, $silver->id);
    $resGold = $pricing->evaluateCart($items, $gold->id);
    $resPlatinum = $pricing->evaluateCart($items, $platinum->id);

    // Silver: floor(5 * 1.0) = 5; Gold: floor(5 * 1.5) = 7; Platinum: floor(5 * 2.0) = 10
    expect($resSilver['summary']['estimated_points_earned'])->toBe(5)
        ->and($resGold['summary']['estimated_points_earned'])->toBe(7)
        ->and($resPlatinum['summary']['estimated_points_earned'])->toBe(10);

    // Checkout untuk Gold dan pastikan ledger earn dibuat dengan expires_at +12 bulan & cache customers.points sinkron
    $tx = app(PosTransactionService::class)->checkout($fx['admin'], [
        'customer_id' => $gold->id,
        'items' => $items,
        'payments' => [
            [
                'payment_method' => PaymentMethod::Cash->value,
                'financial_account_id' => $fx['cashAccount']->id,
                'amount' => 55000,
            ],
        ],
    ]);

    expect((int) $tx->points_earned)->toBe(7)
        ->and((int) $gold->fresh()->points)->toBe(7);

    $ledger = CustomerPointLedger::query()->where('transaction_id', $tx->id)->where('type', PointLedgerType::Earn)->first();
    expect($ledger)->not->toBeNull()
        ->and($ledger->points)->toBe(7)
        ->and($ledger->remaining_points)->toBe(7)
        ->and($ledger->expires_at)->not->toBeNull()
        ->and($ledger->expires_at->greaterThan(now()->addMonths(11)))->toBeTrue();
});

test('excluded items (pulsa/PPOB, rokok, donasi) do not earn loyalty points', function (): void {
    $fx = seedLoyaltyFixtures();
    $pricing = app(PosPricingService::class);

    $customer = Customer::factory()->create(['tier' => CustomerTier::Platinum, 'points' => 0]);

    // Hanya item excluded: Rokok (30.000) + Pulsa (50.000) + Donasi (10.000) = 90.000 -> 0 poin
    $excludedOnly = $pricing->evaluateCart([
        ['product_id' => $fx['prodRokok']->id, 'qty' => 1],
        ['product_id' => $fx['prodPulsa']->id, 'qty' => 1],
        ['product_id' => $fx['prodDonation']->id, 'qty' => 1],
    ], $customer->id);

    expect($excludedOnly['summary']['estimated_points_earned'])->toBe(0);

    // Campuran: Susu (20.000 eligible) + Pulsa (50.000 excluded) + Rokok (30.000 excluded)
    // Eligible = 20.000 -> base 2 * Platinum 2.0 = 4 poin
    $mixed = $pricing->evaluateCart([
        ['product_id' => $fx['prodRegular']->id, 'qty' => 1],
        ['product_id' => $fx['prodPulsa']->id, 'qty' => 1],
        ['product_id' => $fx['prodRokok']->id, 'qty' => 1],
    ], $customer->id);

    expect($mixed['summary']['estimated_points_earned'])->toBe(4);
});

test('redeem points values 1 point = Rp100, caps at 50% of bill, does not reduce PPN DPP, and redeemed portion earns no points', function (): void {
    $fx = seedLoyaltyFixtures(11.0); // PPN 11%
    $pricing = app(PosPricingService::class);
    $txService = app(PosTransactionService::class);

    $customer = Customer::factory()->create(['tier' => CustomerTier::Silver, 'points' => 0]);

    // Beri saldo 1000 poin (Rp 100.000)
    CustomerPointLedger::create([
        'customer_id' => $customer->id,
        'type' => PointLedgerType::Earn,
        'points' => 1000,
        'remaining_points' => 1000,
        'expires_at' => now()->addMonths(6),
        'description' => 'Saldo awal uji redeem',
    ]);
    app(LoyaltyService::class)->syncCustomerPointsCache($customer);

    // 5 * 20.000 = 100.000 net_subtotal -> PPN 11% = 11.000 -> grand_total = 111.000
    // Maks redeem 50% dari 111.000 = 55.500 -> floor / 100 = 555 poin (Rp 55.500)
    $evalMax = $pricing->evaluateCart(
        [['product_id' => $fx['prodRegular']->id, 'qty' => 5]],
        $customer->id,
        now(),
        0,
        true,
        null,
        null,
        null,
        'pos',
        [],
        null,
        [],
        900 // minta melebihi 50% -> di-clamp ke 555 pada preview
    );

    expect($evalMax['summary']['taxable_amount'])->toBe(100000)
        ->and($evalMax['summary']['tax_amount'])->toBe(11000)
        ->and($evalMax['summary']['grand_total'])->toBe(111000)
        ->and($evalMax['loyalty']['max_redeemable_points'])->toBe(555)
        ->and($evalMax['summary']['points_redeemed'])->toBe(555)
        ->and($evalMax['summary']['points_redeem_amount'])->toBe(55500)
        ->and($evalMax['summary']['net_payable_after_points'])->toBe(55500)
        // Earn base = eligible net (100.000) - redeem amount (55.500) = 44.500 -> floor(44500/10000) = 4 poin
        ->and($evalMax['summary']['estimated_points_earned'])->toBe(4);

    // Checkout dengan redeem 300 poin (Rp 30.000) -> sisa bayar kasir = 111.000 - 30.000 = 81.000
    // Earn base = 100.000 - 30.000 = 70.000 -> 7 poin
    $tx = $txService->checkout($fx['admin'], [
        'customer_id' => $customer->id,
        'redeem_points' => 300,
        'items' => [['product_id' => $fx['prodRegular']->id, 'qty' => 5]],
        'payments' => [
            [
                'payment_method' => PaymentMethod::Cash->value,
                'financial_account_id' => $fx['cashAccount']->id,
                'amount' => 81000,
            ],
        ],
    ]);

    expect((float) $tx->tax_amount)->toBe(11000.0)
        ->and((float) $tx->grand_total)->toBe(111000.0)
        ->and((int) $tx->points_redeemed)->toBe(300)
        ->and((float) $tx->points_redeem_amount)->toBe(30000.0)
        ->and((int) $tx->points_earned)->toBe(7)
        ->and((float) $tx->paid_amount)->toBe(81000.0)
        ->and((float) $tx->change_amount)->toBe(0.0)
        // Saldo akhir: 1000 - 300 + 7 = 707
        ->and((int) $customer->fresh()->points)->toBe(707);
});

test('FIFO consumption spends earliest expiring lots first and ignores expired points (>12 months)', function (): void {
    $fx = seedLoyaltyFixtures();
    $loyalty = app(LoyaltyService::class);
    $txService = app(PosTransactionService::class);

    $customer = Customer::factory()->create(['tier' => CustomerTier::Silver, 'points' => 0]);

    // Lot 1: sudah expired 1 hari lalu (200 poin) -> WAJIB diabaikan
    $lotExpired = CustomerPointLedger::create([
        'customer_id' => $customer->id,
        'type' => PointLedgerType::Earn,
        'points' => 200,
        'remaining_points' => 200,
        'expires_at' => now()->subDay(),
        'description' => 'Lot kedaluwarsa',
    ]);

    // Lot 2: akan expired dalam 2 bulan (120 poin) -> WAJIB dikonsumsi pertama
    $lotEarly = CustomerPointLedger::create([
        'customer_id' => $customer->id,
        'type' => PointLedgerType::Earn,
        'points' => 120,
        'remaining_points' => 120,
        'expires_at' => now()->addMonths(2),
        'description' => 'Lot awal FIFO',
    ]);

    // Lot 3: akan expired dalam 10 bulan (300 poin) -> dikonsumsi setelah Lot 2 habis
    $lotLate = CustomerPointLedger::create([
        'customer_id' => $customer->id,
        'type' => PointLedgerType::Earn,
        'points' => 300,
        'remaining_points' => 300,
        'expires_at' => now()->addMonths(10),
        'description' => 'Lot akhir FIFO',
    ]);

    expect($loyalty->getActivePointBalance($customer))->toBe(420);

    // Transaksi Rp 40.000 (maks redeem 50% = Rp 20.000 = 200 poin)
    // Redeem 180 poin -> Lot 2 habis (0), Lot 3 berkurang 60 (sisa 240), Lot 1 tetap tak tersentuh
    // Earn: (40.000 - 18.000) = 22.000 -> 2 poin baru
    $tx = $txService->checkout($fx['admin'], [
        'customer_id' => $customer->id,
        'redeem_points' => 180,
        'items' => [['product_id' => $fx['prodRegular']->id, 'qty' => 2]],
        'payments' => [
            [
                'payment_method' => PaymentMethod::Cash->value,
                'financial_account_id' => $fx['cashAccount']->id,
                'amount' => 22000,
            ],
        ],
    ]);

    expect((int) $lotExpired->fresh()->remaining_points)->toBe(200)
        ->and((int) $lotEarly->fresh()->remaining_points)->toBe(0)
        ->and((int) $lotLate->fresh()->remaining_points)->toBe(240)
        ->and((int) $tx->points_earned)->toBe(2)
        // Saldo aktif akhir: 0 + 240 + 2 = 242
        ->and($loyalty->getActivePointBalance($customer))->toBe(242)
        ->and((int) $customer->fresh()->points)->toBe(242);
});

test('MEMBER_PRICE applies tier-specific or general member price in Step 2 before wholesale/promo', function (): void {
    $fx = seedLoyaltyFixtures();
    $pricing = app(PosPricingService::class);

    // Harga reguler Susu = 20.000; Harga Semua Member = 18.000; Harga Gold = 16.000
    ProductMemberPrice::create([
        'product_id' => $fx['prodRegular']->id,
        'product_unit_id' => null,
        'tier' => null,
        'member_price' => 18000,
        'is_active' => true,
    ]);
    ProductMemberPrice::create([
        'product_id' => $fx['prodRegular']->id,
        'product_unit_id' => null,
        'tier' => CustomerTier::Gold,
        'member_price' => 16000,
        'is_active' => true,
    ]);

    $silver = Customer::factory()->create(['tier' => CustomerTier::Silver]);
    $gold = Customer::factory()->create(['tier' => CustomerTier::Gold]);

    $guestRes = $pricing->evaluateCart([['product_id' => $fx['prodRegular']->id, 'qty' => 2]], null);
    $silverRes = $pricing->evaluateCart([['product_id' => $fx['prodRegular']->id, 'qty' => 2]], $silver->id);
    $goldRes = $pricing->evaluateCart([['product_id' => $fx['prodRegular']->id, 'qty' => 2]], $gold->id);

    expect($guestRes['summary']['grand_total'])->toBe(40000)
        ->and($guestRes['items'][0]['pricing_source'])->toBe('regular')
        ->and($silverRes['summary']['grand_total'])->toBe(36000)
        ->and($silverRes['items'][0]['pricing_source'])->toBe('member_price')
        ->and($goldRes['summary']['grand_total'])->toBe(32000)
        ->and($goldRes['items'][0]['pricing_source'])->toBe('member_price');
});

test('BIRTHDAY promo applies only on customer birth month/day in WIB', function (): void {
    $fx = seedLoyaltyFixtures();
    $pricing = app(PosPricingService::class);

    Promotion::create([
        'name' => 'Diskon Ulang Tahun 20%',
        'type' => PromotionType::Birthday,
        'scope' => PromotionScope::AllProducts,
        'funding' => PromotionFunding::Store,
        'discount_value' => 20,
        'max_discount_amount' => 50000,
        'min_purchase_amount' => 0,
        'starts_at' => now()->subMonth(),
        'ends_at' => now()->addMonth(),
        'member_only' => true,
        'stackable' => true,
        'is_active' => true,
    ]);

    $customer = Customer::factory()->create([
        'birth_date' => '1995-08-17',
    ]);

    $onBirthday = Carbon::create(2026, 8, 17, 10, 0, 0, 'Asia/Jakarta');
    $otherDay = Carbon::create(2026, 8, 18, 10, 0, 0, 'Asia/Jakarta');

    // Update promo window to cover August 2026
    Promotion::query()->update([
        'starts_at' => Carbon::create(2026, 8, 1, 0, 0, 0, 'Asia/Jakarta')->utc(),
        'ends_at' => Carbon::create(2026, 8, 31, 23, 59, 59, 'Asia/Jakarta')->utc(),
    ]);

    $resMatch = $pricing->evaluateCart([['product_id' => $fx['prodRegular']->id, 'qty' => 2]], $customer->id, $onBirthday);
    $resOther = $pricing->evaluateCart([['product_id' => $fx['prodRegular']->id, 'qty' => 2]], $customer->id, $otherDay);

    expect($resMatch['loyalty']['is_birthday'])->toBeTrue()
        ->and($resMatch['summary']['transaction_promo_discount_total'])->toBe(8000)
        ->and($resMatch['summary']['grand_total'])->toBe(32000)
        ->and($resOther['loyalty']['is_birthday'])->toBeFalse()
        ->and($resOther['summary']['transaction_promo_discount_total'])->toBe(0)
        ->and($resOther['summary']['grand_total'])->toBe(40000);
});

test('FIRST_PURCHASE promo applies only when customer has no prior completed transactions', function (): void {
    $fx = seedLoyaltyFixtures();
    $pricing = app(PosPricingService::class);
    $txService = app(PosTransactionService::class);

    Promotion::create([
        'name' => 'Potongan Member Baru Rp 10.000',
        'type' => PromotionType::FirstPurchase,
        'scope' => PromotionScope::AllProducts,
        'funding' => PromotionFunding::Store,
        'discount_value' => 10000,
        'min_purchase_amount' => 20000,
        'starts_at' => now()->subDay(),
        'ends_at' => now()->addDay(),
        'member_only' => true,
        'stackable' => true,
        'is_active' => true,
    ]);

    $customer = Customer::factory()->create();

    // Sebelum transaksi pertama -> dapat potongan Rp 10.000
    $before = $pricing->evaluateCart([['product_id' => $fx['prodRegular']->id, 'qty' => 2]], $customer->id);
    expect($before['loyalty']['is_first_purchase'])->toBeTrue()
        ->and($before['summary']['transaction_promo_discount_total'])->toBe(10000)
        ->and($before['summary']['grand_total'])->toBe(30000);

    // Selesaikan transaksi pertama
    $txService->checkout($fx['admin'], [
        'customer_id' => $customer->id,
        'items' => [['product_id' => $fx['prodRegular']->id, 'qty' => 2]],
        'payments' => [
            [
                'payment_method' => PaymentMethod::Cash->value,
                'financial_account_id' => $fx['cashAccount']->id,
                'amount' => 30000,
            ],
        ],
    ]);

    // Transaksi kedua -> promo FIRST_PURCHASE tidak lagi berlaku
    $after = $pricing->evaluateCart([['product_id' => $fx['prodRegular']->id, 'qty' => 2]], $customer->id);
    expect($after['loyalty']['is_first_purchase'])->toBeFalse()
        ->and($after['summary']['transaction_promo_discount_total'])->toBe(0)
        ->and($after['summary']['grand_total'])->toBe(40000);
});

test('void transaction reverses earned points and restores redeemed points to customer ledger', function (): void {
    $fx = seedLoyaltyFixtures();
    $txService = app(PosTransactionService::class);
    $loyalty = app(LoyaltyService::class);

    $customer = Customer::factory()->create(['tier' => CustomerTier::Silver, 'points' => 0]);
    CustomerPointLedger::create([
        'customer_id' => $customer->id,
        'type' => PointLedgerType::Earn,
        'points' => 500,
        'remaining_points' => 500,
        'expires_at' => now()->addMonths(8),
        'description' => 'Saldo awal sebelum transaksi',
    ]);
    $loyalty->syncCustomerPointsCache($customer);

    // Beli 5 * 20.000 = 100.000; redeem 200 poin (Rp 20.000) -> bayar tunai 80.000 -> earn 8 poin
    // Saldo setelah checkout = 500 - 200 + 8 = 308
    $tx = $txService->checkout($fx['admin'], [
        'customer_id' => $customer->id,
        'redeem_points' => 200,
        'items' => [['product_id' => $fx['prodRegular']->id, 'qty' => 5]],
        'payments' => [
            [
                'payment_method' => PaymentMethod::Cash->value,
                'financial_account_id' => $fx['cashAccount']->id,
                'amount' => 80000,
            ],
        ],
    ]);

    expect((int) $customer->fresh()->points)->toBe(308);

    // Void transaksi -> tarik 8 poin earned & kembalikan 200 poin redeemed -> saldo kembali 500
    $txService->void($tx, [
        'reason' => 'Salah input kasir',
        'supervisor_pin' => '123456',
    ], $fx['admin']);

    expect((int) $customer->fresh()->points)->toBe(500)
        ->and($loyalty->getActivePointBalance($customer))->toBe(500);

    $voidReversals = CustomerPointLedger::query()
        ->where('transaction_id', $tx->id)
        ->where('type', PointLedgerType::VoidReversal)
        ->pluck('points')
        ->all();

    expect($voidReversals)->toContain(-8)
        ->and($voidReversals)->toContain(200);
});

test('partial sales return reverses earned points proportionally to returned eligible item value', function (): void {
    $fx = seedLoyaltyFixtures();
    $txService = app(PosTransactionService::class);
    $returnService = app(SalesReturnService::class);

    $customer = Customer::factory()->create(['tier' => CustomerTier::Platinum, 'points' => 0]);

    // Beli 4 * 20.000 = 80.000 (eligible) -> base 8 * Platinum 2.0 = 16 poin earned
    $tx = $txService->checkout($fx['admin'], [
        'customer_id' => $customer->id,
        'items' => [['product_id' => $fx['prodRegular']->id, 'qty' => 4]],
        'payments' => [
            [
                'payment_method' => PaymentMethod::Cash->value,
                'financial_account_id' => $fx['cashAccount']->id,
                'amount' => 80000,
            ],
        ],
    ]);

    expect((int) $tx->points_earned)->toBe(16)
        ->and((int) $customer->fresh()->points)->toBe(16);

    $detail = $tx->details()->firstOrFail();

    // Retur parsial 1 dari 4 unit (25% nilai eligible) -> tarik 25% dari 16 = 4 poin -> sisa 12 poin
    $salesReturn = $returnService->processReturn($tx, [
        'refund_method' => PaymentMethod::Cash->value,
        'financial_account_id' => $fx['cashAccount']->id,
        'reason' => 'Kemasan penyok',
        'supervisor_pin' => '123456',
        'items' => [
            [
                'transaction_detail_id' => $detail->id,
                'qty' => 1,
                'is_restockable' => false,
            ],
        ],
    ], $fx['admin']);

    expect((int) $customer->fresh()->points)->toBe(12);

    $returnLedger = CustomerPointLedger::query()
        ->where('sales_return_id', $salesReturn->id)
        ->where('type', PointLedgerType::ReturnReversal)
        ->first();

    expect($returnLedger)->not->toBeNull()
        ->and($returnLedger->points)->toBe(-4);
});

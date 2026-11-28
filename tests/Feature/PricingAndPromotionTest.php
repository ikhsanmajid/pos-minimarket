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
use App\Models\AppliedPromotion;
use App\Models\CashierShift;
use App\Models\Category;
use App\Models\Customer;
use App\Models\FinancialAccount;
use App\Models\Product;
use App\Models\ProductPriceTier;
use App\Models\ProductUnit;
use App\Models\Promotion;
use App\Models\Transaction;
use App\Models\User;
use App\Services\PosPricingService;
use App\Services\SalesReturnService;
use App\Services\StoreSettingService;
use App\Support\PricingMath;
use Illuminate\Support\Carbon;
use Spatie\Activitylog\Models\Activity;

function seedPricingFixtures(): array
{
    $category = Category::create([
        'name' => 'Minuman Ringan',
        'slug' => 'minuman-ringan',
        'code' => 'CAT-PR-01',
        'is_active' => true,
        'is_promo_excluded' => false,
    ]);

    $cigaretteCategory = Category::create([
        'name' => 'Rokok & Tembakau',
        'slug' => 'rokok-tembakau',
        'code' => 'CAT-PR-EX',
        'is_active' => true,
        'is_promo_excluded' => false, // tetap excluded via config pos_promotions.excluded_category_keywords
    ]);

    $product = Product::create([
        'category_id' => $category->id,
        'barcode' => '8995550001',
        'name' => 'Teh Botol 500ml',
        'base_unit' => 'pcs',
        'buy_price' => 3000,
        'sell_price' => 5000,
        'stock' => 200,
        'min_stock' => 10,
        'active' => true,
        'tax_mode' => ProductTaxMode::Exclusive,
    ]);

    $packUnit = ProductUnit::create([
        'product_id' => $product->id,
        'unit_name' => 'Dus',
        'conversion_factor' => 12,
        'barcode' => '8995550001-DUS',
        'buy_price' => 34000,
        'sell_price' => 55000,
        'is_default_purchase' => true,
        'is_active' => true,
    ]);

    $excludedProduct = Product::create([
        'category_id' => $cigaretteCategory->id,
        'barcode' => '8995550002',
        'name' => 'Rokok Filter 12',
        'base_unit' => 'bungkus',
        'buy_price' => 22000,
        'sell_price' => 30000,
        'stock' => 100,
        'min_stock' => 5,
        'active' => true,
    ]);

    $donationProduct = Product::create([
        'category_id' => $category->id,
        'barcode' => 'DONASI-01',
        'name' => 'Donasi Kemanusiaan',
        'base_unit' => 'pcs',
        'buy_price' => 0,
        'sell_price' => 5000,
        'stock' => 0,
        'min_stock' => 0,
        'active' => true,
        'is_tax_exempt' => true,
        'tax_mode' => ProductTaxMode::Exempt,
        'is_donation' => true,
    ]);

    $cashAccount = FinancialAccount::create([
        'code' => 'KAS-001',
        'name' => 'Kas Kasir',
        'type' => FinancialAccountType::Cash,
        'opening_balance' => 500000,
        'current_balance' => 500000,
        'is_default' => true,
        'is_active' => true,
    ]);

    $qrisAccount = FinancialAccount::create([
        'code' => 'EW-001',
        'name' => 'QRIS Toko',
        'type' => FinancialAccountType::Ewallet,
        'opening_balance' => 500000,
        'current_balance' => 500000,
        'is_default' => false,
        'is_active' => true,
    ]);

    $admin = User::factory()->create(['role' => UserRoles::Admin, 'pin' => '111111', 'is_active' => true]);
    $supervisor = User::factory()->create(['role' => UserRoles::Supervisor, 'pin' => '123456', 'is_active' => true]);
    $cashier = User::factory()->create(['role' => UserRoles::Cashier, 'is_active' => true]);
    $warehouse = User::factory()->create(['role' => UserRoles::Warehouse, 'is_active' => true]);

    $shift = CashierShift::factory()->create([
        'user_id' => $cashier->id,
        'status' => CashierShiftStatus::Open,
        'starting_cash' => 500000,
    ]);

    $member = Customer::create([
        'member_code' => 'MBR-0001',
        'name' => 'Budi Santoso',
        'phone' => '08123456789',
        'points' => 100,
        'is_active' => true,
    ]);

    return compact(
        'category',
        'cigaretteCategory',
        'product',
        'packUnit',
        'excludedProduct',
        'donationProduct',
        'cashAccount',
        'qrisAccount',
        'admin',
        'supervisor',
        'cashier',
        'warehouse',
        'shift',
        'member'
    );
}

it('applies wholesale tiered pricing for base unit and multi-UOM and reverts when qty drops', function () {
    $fx = seedPricingFixtures();

    ProductPriceTier::create([
        'product_id' => $fx['product']->id,
        'product_unit_id' => null,
        'min_qty' => 3,
        'unit_price' => 4500,
        'is_active' => true,
    ]);

    ProductPriceTier::create([
        'product_id' => $fx['product']->id,
        'product_unit_id' => null,
        'min_qty' => 12,
        'unit_price' => 4000,
        'is_active' => true,
    ]);

    ProductPriceTier::create([
        'product_id' => $fx['product']->id,
        'product_unit_id' => $fx['packUnit']->id,
        'min_qty' => 2,
        'unit_price' => 50000,
        'is_active' => true,
    ]);

    /** @var PosPricingService $pricing */
    $pricing = app(PosPricingService::class);

    // Qty 2 pcs -> reguler (5.000)
    $below = $pricing->evaluateCart([
        ['product_id' => $fx['product']->id, 'product_unit_id' => null, 'qty' => 2],
    ]);
    expect($below['items'][0]['pricing_source'])->toBe('regular');
    expect($below['items'][0]['auto_discount_amount'])->toBe(0);
    expect($below['items'][0]['line_subtotal'])->toBe(10000);

    // Qty 3 pcs -> tier 3 (4.500 -> hemat 1.500)
    $tier1 = $pricing->evaluateCart([
        ['product_id' => $fx['product']->id, 'product_unit_id' => null, 'qty' => 3],
    ]);
    expect($tier1['items'][0]['pricing_source'])->toBe('wholesale_tier');
    expect($tier1['items'][0]['auto_discount_amount'])->toBe(1500);
    expect($tier1['items'][0]['line_subtotal'])->toBe(13500);

    // Qty 12 pcs -> tier 12 (4.000 -> hemat 12.000)
    $tier2 = $pricing->evaluateCart([
        ['product_id' => $fx['product']->id, 'product_unit_id' => null, 'qty' => 12],
    ]);
    expect($tier2['items'][0]['pricing_source'])->toBe('wholesale_tier');
    expect($tier2['items'][0]['auto_discount_amount'])->toBe(12000);
    expect($tier2['items'][0]['line_subtotal'])->toBe(48000);

    // Multi-UOM 2 Dus -> tier 2 Dus (50.000/dus -> hemat 10.000)
    $uomTier = $pricing->evaluateCart([
        ['product_id' => $fx['product']->id, 'product_unit_id' => $fx['packUnit']->id, 'qty' => 2],
    ]);
    expect($uomTier['items'][0]['pricing_source'])->toBe('wholesale_tier');
    expect($uomTier['items'][0]['auto_discount_amount'])->toBe(10000);
    expect($uomTier['items'][0]['line_subtotal'])->toBe(100000);
});

it('calculates percentage discount with max cap, fixed discount, buy X get Y with remainder, and multibuy price accurately at checkout without supervisor PIN', function () {
    $fx = seedPricingFixtures();

    // 1. Diskon % dengan plafon max_discount_amount (25% dari 20.000 = 5.000, plafon 3.500 -> 3.500)
    $pctPromo = Promotion::create([
        'code' => 'PCT25',
        'name' => 'Diskon 25% Maks 3.500',
        'type' => PromotionType::PercentageDiscount,
        'scope' => PromotionScope::Product,
        'funding' => PromotionFunding::Supplier,
        'discount_value' => 25,
        'max_discount_amount' => 3500,
        'starts_at' => now()->subDay(),
        'ends_at' => now()->addDay(),
        'is_active' => true,
        'created_by' => $fx['admin']->id,
    ]);
    $pctPromo->products()->attach($fx['product']->id);

    // Checkout oleh Kasir TANPA PIN Supervisor harus berhasil (201) karena promo otomatis tidak butuh PIN
    $res = $this->actingAs($fx['cashier'])->postJson(route('pos.cashier.checkout'), [
        'items' => [
            ['product_id' => $fx['product']->id, 'product_unit_id' => null, 'qty' => 4],
        ],
        'payments' => [
            [
                'payment_method' => PaymentMethod::Cash->value,
                'financial_account_id' => $fx['cashAccount']->id,
                'amount' => 20000,
            ],
        ],
    ]);

    $res->assertCreated();
    /** @var Transaction $tx */
    $tx = Transaction::latest('id')->firstOrFail();
    expect((float) $tx->discount_amount)->toBe(3500.0);
    expect((float) $tx->grand_total)->toBe(16500.0);
    expect($tx->discount_approved_by)->toBeNull();

    $detail = $tx->details()->firstOrFail();
    expect($detail->pricing_source)->toBe('promotion');
    expect($detail->applied_promotion_id)->toBe($pctPromo->id);
    expect($detail->applied_promotion_name)->toBe('Diskon 25% Maks 3.500');

    $applied = AppliedPromotion::where('transaction_id', $tx->id)->first();
    expect($applied)->not->toBeNull();
    expect((float) $applied->discount_amount)->toBe(3500.0);
    expect($applied->funding)->toBe(PromotionFunding::Supplier);

    // Nonaktifkan promo % dan uji Buy 2 Get 1 dengan qty 5 (1 set = 3 unit, 1 gratis, sisa 2 normal -> hemat 5.000)
    $pctPromo->update(['is_active' => false]);
    $bxgy = Promotion::create([
        'code' => 'B2G1',
        'name' => 'Beli 2 Gratis 1',
        'type' => PromotionType::BuyXGetY,
        'scope' => PromotionScope::Product,
        'buy_qty' => 2,
        'get_qty' => 1,
        'get_discount_percent' => 100,
        'starts_at' => now()->subDay(),
        'ends_at' => now()->addDay(),
        'is_active' => true,
        'created_by' => $fx['admin']->id,
    ]);
    $bxgy->products()->attach($fx['product']->id);

    $pricing = app(PosPricingService::class);
    $bxgyEval = $pricing->evaluateCart([
        ['product_id' => $fx['product']->id, 'product_unit_id' => null, 'qty' => 5],
    ]);
    expect($bxgyEval['items'][0]['auto_discount_amount'])->toBe(5000);
    expect($bxgyEval['items'][0]['free_qty'])->toBe(1);
    expect($bxgyEval['items'][0]['line_subtotal'])->toBe(20000);

    // Nonaktifkan BxGy dan uji Multibuy: 3 pcs = Rp 10.000; qty 7 -> 2 paket (20.000) + 1 normal (5.000) = 25.000 (hemat 10.000)
    $bxgy->update(['is_active' => false]);
    $multibuy = Promotion::create([
        'code' => 'MB3',
        'name' => 'Paket 3 Cuma 10rb',
        'type' => PromotionType::MultibuyPrice,
        'scope' => PromotionScope::Product,
        'buy_qty' => 3,
        'bundle_price' => 10000,
        'starts_at' => now()->subDay(),
        'ends_at' => now()->addDay(),
        'is_active' => true,
        'created_by' => $fx['admin']->id,
    ]);
    $multibuy->products()->attach($fx['product']->id);

    $mbEval = $pricing->evaluateCart([
        ['product_id' => $fx['product']->id, 'product_unit_id' => null, 'qty' => 7],
    ]);
    expect($mbEval['items'][0]['auto_discount_amount'])->toBe(10000);
    expect($mbEval['items'][0]['line_subtotal'])->toBe(25000);

    // Qty desimal (produk timbang) tidak boleh ikut multibuy
    $decimalEval = $pricing->evaluateCart([
        ['product_id' => $fx['product']->id, 'product_unit_id' => null, 'qty' => 3.5],
    ]);
    expect($decimalEval['items'][0]['pricing_source'])->toBe('regular');
    expect($decimalEval['items'][0]['auto_discount_amount'])->toBe(0);
});

it('resolves best price without stacking wholesale vs promo, and breaks ties by priority then lowest id', function () {
    $fx = seedPricingFixtures();

    // Grosir min 3 -> 4.500 (hemat 1.500 untuk qty 3)
    ProductPriceTier::create([
        'product_id' => $fx['product']->id,
        'product_unit_id' => null,
        'min_qty' => 3,
        'unit_price' => 4500,
        'is_active' => true,
    ]);

    // Promo A: fixed 1.000/pcs (hemat 3.000 untuk qty 3), priority 5
    $promoA = Promotion::create([
        'name' => 'Promo A',
        'type' => PromotionType::FixedDiscount,
        'scope' => PromotionScope::AllProducts,
        'discount_value' => 1000,
        'priority' => 5,
        'starts_at' => now()->subDay(),
        'ends_at' => now()->addDay(),
        'is_active' => true,
        'created_by' => $fx['admin']->id,
    ]);

    // Promo B: fixed 1.000/pcs (hemat 3.000 seri), priority 10 -> harus menang atas Promo A dan Grosir
    $promoB = Promotion::create([
        'name' => 'Promo B Prioritas Tinggi',
        'type' => PromotionType::FixedDiscount,
        'scope' => PromotionScope::AllProducts,
        'discount_value' => 1000,
        'priority' => 10,
        'starts_at' => now()->subDay(),
        'ends_at' => now()->addDay(),
        'is_active' => true,
        'created_by' => $fx['admin']->id,
    ]);

    $pricing = app(PosPricingService::class);
    $eval = $pricing->evaluateCart([
        ['product_id' => $fx['product']->id, 'product_unit_id' => null, 'qty' => 3],
    ]);

    // Tidak menumpuk (bukan 3.000 + 1.500), melainkan Best Price = 3.000 dari Promo B
    expect($eval['items'][0]['pricing_source'])->toBe('promotion');
    expect($eval['items'][0]['applied_promotion_id'])->toBe($promoB->id);
    expect($eval['items'][0]['auto_discount_amount'])->toBe(3000);

    // Jika priority sama, id terkecil (Promo A) menang
    $promoB->update(['priority' => 5]);
    $evalTie = $pricing->evaluateCart([
        ['product_id' => $fx['product']->id, 'product_unit_id' => null, 'qty' => 3],
    ]);
    expect($evalTie['items'][0]['applied_promotion_id'])->toBe($promoA->id);
});

it('ignores expired/inactive promos, enforces member_only, consistent $at timestamp, and rejects min_purchase met only by excluded items', function () {
    $fx = seedPricingFixtures();

    // Promo berakhir tepat 23:59:59 WIB
    $tz = config('pos_promotions.timezone', 'Asia/Jakarta');
    $starts = Carbon::create(2026, 5, 1, 0, 0, 0, $tz)->utc();
    $ends = Carbon::create(2026, 5, 1, 23, 59, 59, $tz)->utc();

    $memberPromo = Promotion::create([
        'name' => 'Promo Member Min 20rb',
        'type' => PromotionType::PercentageDiscount,
        'scope' => PromotionScope::AllProducts,
        'discount_value' => 10,
        'min_purchase_amount' => 20000,
        'starts_at' => $starts,
        'ends_at' => $ends,
        'member_only' => true,
        'is_active' => true,
        'created_by' => $fx['admin']->id,
    ]);

    $pricing = app(PosPricingService::class);
    $beforeEnd = Carbon::create(2026, 5, 1, 23, 59, 50, $tz);
    $afterEnd = Carbon::create(2026, 5, 2, 0, 0, 1, $tz);

    // 1. Guest (tanpa customer_id) -> tidak aktif
    $guestEval = $pricing->evaluateCart([
        ['product_id' => $fx['product']->id, 'product_unit_id' => null, 'qty' => 5], // 25.000
    ], null, $beforeEnd);
    expect($guestEval['items'][0]['auto_discount_amount'])->toBe(0);

    // 2. Member, tetapi min_purchase 20.000 hanya terpenuhi karena Rokok (excluded 30.000) + 1 Teh (5.000) -> DITOLAK
    $excludedMinEval = $pricing->evaluateCart([
        ['product_id' => $fx['excludedProduct']->id, 'product_unit_id' => null, 'qty' => 1], // 30.000 excluded
        ['product_id' => $fx['product']->id, 'product_unit_id' => null, 'qty' => 1], // 5.000 eligible (< 20.000)
        ['product_id' => $fx['donationProduct']->id, 'product_unit_id' => null, 'qty' => 1], // 5.000 donasi excluded
    ], $fx['member']->id, $beforeEnd);
    expect($excludedMinEval['items'][0]['is_promo_excluded'])->toBeTrue();
    expect($excludedMinEval['items'][0]['auto_discount_amount'])->toBe(0);
    expect($excludedMinEval['items'][1]['auto_discount_amount'])->toBe(0);
    expect($excludedMinEval['items'][2]['is_promo_excluded'])->toBeTrue();
    expect($excludedMinEval['items'][2]['auto_discount_amount'])->toBe(0);

    // 3. Member dengan item eligible >= 20.000 pada $beforeEnd -> AKTIF (10% dari 25.000 = 2.500)
    $validEval = $pricing->evaluateCart([
        ['product_id' => $fx['product']->id, 'product_unit_id' => null, 'qty' => 5],
    ], $fx['member']->id, $beforeEnd);
    expect($validEval['items'][0]['applied_promotion_id'])->toBe($memberPromo->id);
    expect($validEval['items'][0]['auto_discount_amount'])->toBe(2500);

    // 4. Setelah $ends ($afterEnd) -> tidak aktif
    $expiredEval = $pricing->evaluateCart([
        ['product_id' => $fx['product']->id, 'product_unit_id' => null, 'qty' => 5],
    ], $fx['member']->id, $afterEnd);
    expect($expiredEval['items'][0]['auto_discount_amount'])->toBe(0);
});

it('handles partial flash sale quota cleanly and restores quota on void', function () {
    $fx = seedPricingFixtures();

    $flashSale = Promotion::create([
        'name' => 'Flash Sale Kuota 2',
        'type' => PromotionType::FixedDiscount,
        'scope' => PromotionScope::Product,
        'discount_value' => 2000,
        'quota_total' => 2,
        'quota_used' => 0,
        'starts_at' => now()->subHour(),
        'ends_at' => now()->addHour(),
        'is_active' => true,
        'created_by' => $fx['admin']->id,
    ]);
    $flashSale->products()->attach($fx['product']->id);

    // Beli qty 5 -> hanya 2 unit dapat diskon (2 * 2.000 = 4.000), 3 unit sisanya harga normal
    $res = $this->actingAs($fx['cashier'])->postJson(route('pos.cashier.checkout'), [
        'items' => [
            ['product_id' => $fx['product']->id, 'product_unit_id' => null, 'qty' => 5], // gross 25.000 - 4.000 = 21.000
        ],
        'payments' => [
            [
                'payment_method' => PaymentMethod::Cash->value,
                'financial_account_id' => $fx['cashAccount']->id,
                'amount' => 25000,
            ],
        ],
    ]);

    $res->assertCreated();
    $flashSale->refresh();
    expect($flashSale->quota_used)->toBe(2);

    /** @var Transaction $tx */
    $tx = Transaction::latest('id')->firstOrFail();
    expect((float) $tx->discount_amount)->toBe(4000.0);
    expect((float) $tx->grand_total)->toBe(21000.0);

    // Void transaksi -> kuota kembali 0
    $voidRes = $this->actingAs($fx['supervisor'])->postJson(route('pos.transactions.void', $tx), [
        'reason' => 'Salah input kasir',
        'supervisor_pin' => '123456',
    ]);
    $voidRes->assertOk();
    $flashSale->refresh();
    expect($flashSale->quota_used)->toBe(0);
});

it('allocates header discount proportionally with exact sum and applies rounding only to cash payments', function () {
    $fx = seedPricingFixtures();

    // Aktifkan pembulatan Nearest100 dan PPN 11%
    app(StoreSettingService::class)->update([
        'store_name' => 'Minimarket Test',
        'default_tax_rate' => 11,
        'rounding_mode' => RoundingMode::Nearest100->value,
        'shift_variance_tolerance' => 5000,
    ]);

    // Uji alokasi proporsional exact sum (3 baris sama rata, diskon 100 -> 34 + 33 + 33 = 100)
    $alloc = PricingMath::allocateProportionally(100, [0 => 10000, 1 => 10000, 2 => 10000]);
    expect(array_sum($alloc))->toBe(100);
    expect($alloc[0])->toBe(34);
    expect($alloc[1])->toBe(33);
    expect($alloc[2])->toBe(33);

    /** @var PosPricingService $pricing */
    $pricing = app(PosPricingService::class);

    // 1 pcs @ 5.000 + PPN 11% (550) = 5.550 -> Tunai dibulatkan Nearest100 jadi 5.600 (+50), Non-Tunai tetap 5.550 (0)
    $cashEval = $pricing->evaluateCart(
        [['product_id' => $fx['product']->id, 'product_unit_id' => null, 'qty' => 1]],
        null,
        now(),
        0,
        true
    );
    expect($cashEval['summary']['tax_amount'])->toBe(550);
    expect($cashEval['summary']['rounding_amount'])->toBe(50);
    expect($cashEval['summary']['grand_total'])->toBe(5600);

    $qrisEval = $pricing->evaluateCart(
        [['product_id' => $fx['product']->id, 'product_unit_id' => null, 'qty' => 1]],
        null,
        now(),
        0,
        false
    );
    expect($qrisEval['summary']['rounding_amount'])->toBe(0);
    expect($qrisEval['summary']['grand_total'])->toBe(5550);

    // Diskon tidak pernah membuat total negatif
    $zeroFloor = $pricing->evaluateCart(
        [['product_id' => $fx['product']->id, 'product_unit_id' => null, 'qty' => 1, 'discount_amount' => 999999]],
        null,
        now(),
        999999,
        true
    );
    expect($zeroFloor['summary']['grand_total'])->toBe(0);
});

it('does not refund free BxGy bonus units during partial return', function () {
    $fx = seedPricingFixtures();

    $bxgy = Promotion::create([
        'name' => 'Beli 2 Gratis 1',
        'type' => PromotionType::BuyXGetY,
        'scope' => PromotionScope::Product,
        'buy_qty' => 2,
        'get_qty' => 1,
        'get_discount_percent' => 100,
        'starts_at' => now()->subDay(),
        'ends_at' => now()->addDay(),
        'is_active' => true,
        'created_by' => $fx['admin']->id,
    ]);
    $bxgy->products()->attach($fx['product']->id);

    // Beli 3 pcs (bayar 2 = 10.000, gratis 1)
    $this->actingAs($fx['cashier'])->postJson(route('pos.cashier.checkout'), [
        'items' => [
            ['product_id' => $fx['product']->id, 'product_unit_id' => null, 'qty' => 3],
        ],
        'payments' => [
            [
                'payment_method' => PaymentMethod::Cash->value,
                'financial_account_id' => $fx['cashAccount']->id,
                'amount' => 10000,
            ],
        ],
    ])->assertCreated();

    /** @var Transaction $tx */
    $tx = Transaction::latest('id')->firstOrFail();
    $detail = $tx->details()->firstOrFail();
    expect($detail->free_qty)->toBe(1);

    // Retur penuh 3 pcs -> total refund tetap maksimal nilai bayar Rp 10.000 (unit gratis tidak di-refund)
    $return = app(SalesReturnService::class)->processReturn($tx, [
        'refund_method' => PaymentMethod::Cash->value,
        'financial_account_id' => $fx['cashAccount']->id,
        'reason' => 'Barang rusak',
        'supervisor_pin' => '123456',
        'items' => [
            [
                'transaction_detail_id' => $detail->id,
                'qty' => 3,
                'is_restockable' => true,
            ],
        ],
    ], $fx['supervisor']);

    expect((float) $return->total_refund_amount)->toBe(10000.0);
});

it('enforces PromotionPolicy access control and logs activity for promotions and price tiers', function () {
    $fx = seedPricingFixtures();

    $payload = [
        'code' => 'HEMAT10',
        'name' => 'Promo Hemat 10%',
        'type' => PromotionType::PercentageDiscount->value,
        'scope' => PromotionScope::AllProducts->value,
        'funding' => PromotionFunding::Store->value,
        'discount_value' => 10,
        'starts_at' => now()->subHour()->format('Y-m-d\TH:i'),
        'ends_at' => now()->addDays(3)->format('Y-m-d\TH:i'),
        'is_active' => true,
    ];

    // Kasir & Gudang -> 403
    $this->actingAs($fx['cashier'])->post(route('pos.promotions.store'), $payload)->assertForbidden();
    $this->actingAs($fx['warehouse'])->post(route('pos.promotions.store'), $payload)->assertForbidden();

    // Supervisor -> boleh membuat promo
    $this->actingAs($fx['supervisor'])->post(route('pos.promotions.store'), $payload)->assertRedirect();

    $promo = Promotion::where('code', 'HEMAT10')->first();
    expect($promo)->not->toBeNull();

    // Activity Log tercatat dengan kategori Promotion dan deskripsi Bahasa Indonesia
    $promoLog = Activity::query()
        ->where('log_name', ActivityLogCategory::Promotion->value)
        ->where('subject_id', $promo->id)
        ->first();
    expect($promoLog)->not->toBeNull();
    expect($promoLog->description)->toContain('Promo Promo Hemat 10% berhasil dibuat.');

    // Admin menambah tier harga grosir -> Activity Log tercatat
    $this->actingAs($fx['admin'])->post(route('pos.products.price-tiers.store', $fx['product']), [
        'product_unit_id' => null,
        'min_qty' => 5,
        'unit_price' => 4200,
        'is_active' => true,
    ])->assertRedirect();

    $tier = ProductPriceTier::where('product_id', $fx['product']->id)->where('min_qty', 5)->first();
    expect($tier)->not->toBeNull();

    $tierLog = Activity::query()
        ->where('log_name', ActivityLogCategory::Promotion->value)
        ->where('subject_type', ProductPriceTier::class)
        ->where('subject_id', $tier->id)
        ->first();
    expect($tierLog)->not->toBeNull();
    expect($tierLog->description)->toContain('Harga grosir');
});

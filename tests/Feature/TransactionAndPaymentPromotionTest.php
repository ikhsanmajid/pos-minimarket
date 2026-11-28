<?php

use App\Enums\CashierShiftStatus;
use App\Enums\FinancialAccountType;
use App\Enums\PaymentMethod;
use App\Enums\ProductTaxMode;
use App\Enums\PromotionFunding;
use App\Enums\PromotionScope;
use App\Enums\PromotionType;
use App\Enums\RoundingMode;
use App\Enums\VoucherStatus;
use App\Enums\VoucherType;
use App\Models\AppliedPromotion;
use App\Models\CashierShift;
use App\Models\Category;
use App\Models\Customer;
use App\Models\FinancialAccount;
use App\Models\Product;
use App\Models\Promotion;
use App\Models\PromotionBundleItem;
use App\Models\PromotionDailyUsage;
use App\Models\PurchaseOrder;
use App\Models\PurchaseOrderItem;
use App\Models\PurchaseOrderReceipt;
use App\Models\PurchaseOrderReceiptItem;
use App\Models\Supplier;
use App\Models\Transaction;
use App\Models\User;
use App\Models\Voucher;
use App\Services\PosPricingService;
use App\Services\PosTransactionService;
use App\Services\Reports\SalesReportService;
use App\Services\SalesReturnService;
use App\Services\StoreSettingService;
use App\Enums\UserRoles;

function seedPhase3Fixtures(): array
{
    app(StoreSettingService::class)->update([
        'default_tax_rate' => 0,
        'rounding_mode' => RoundingMode::None->value,
    ]);

    $catBeverage = Category::create([
        'name' => 'Minuman',
        'slug' => 'minuman',
        'code' => 'CAT-F3-01',
        'is_active' => true,
        'is_promo_excluded' => false,
    ]);

    $catSnack = Category::create([
        'name' => 'Makanan Ringan',
        'slug' => 'makanan-ringan',
        'code' => 'CAT-F3-02',
        'is_active' => true,
        'is_promo_excluded' => false,
    ]);

    $prodA = Product::create([
        'category_id' => $catBeverage->id,
        'barcode' => '8993000001',
        'name' => 'Kopi Kaleng 240ml',
        'base_unit' => 'pcs',
        'buy_price' => 6000,
        'sell_price' => 10000,
        'stock' => 200,
        'min_stock' => 5,
        'active' => true,
        'tax_mode' => ProductTaxMode::Exclusive,
    ]);

    $prodB = Product::create([
        'category_id' => $catSnack->id,
        'barcode' => '8993000002',
        'name' => 'Roti Coklat',
        'base_unit' => 'pcs',
        'buy_price' => 6000,
        'sell_price' => 10000,
        'stock' => 200,
        'min_stock' => 5,
        'active' => true,
        'tax_mode' => ProductTaxMode::Exclusive,
    ]);

    $prodC = Product::create([
        'category_id' => $catSnack->id,
        'barcode' => '8993000003',
        'name' => 'Keripik Kentang',
        'base_unit' => 'pcs',
        'buy_price' => 9000,
        'sell_price' => 15000,
        'stock' => 200,
        'min_stock' => 5,
        'active' => true,
        'tax_mode' => ProductTaxMode::Exclusive,
    ]);

    $prodReward = Product::create([
        'category_id' => $catBeverage->id,
        'barcode' => '8993000004',
        'name' => 'Minyak Goreng 1L',
        'base_unit' => 'pcs',
        'buy_price' => 12000,
        'sell_price' => 20000,
        'stock' => 50,
        'min_stock' => 5,
        'active' => true,
        'tax_mode' => ProductTaxMode::Exclusive,
    ]);

    $cashAccount = FinancialAccount::create([
        'code' => 'KAS-F3',
        'name' => 'Kas Kasir F3',
        'type' => FinancialAccountType::Cash,
        'opening_balance' => 500000,
        'current_balance' => 500000,
        'is_default' => true,
        'is_active' => true,
    ]);

    $bankAccount = FinancialAccount::create([
        'code' => 'BNK-F3',
        'name' => 'EDC Bank F3',
        'type' => FinancialAccountType::Bank,
        'opening_balance' => 500000,
        'current_balance' => 500000,
        'is_default' => false,
        'is_active' => true,
    ]);

    $admin = User::factory()->create(['role' => UserRoles::Admin, 'pin' => '111111', 'is_active' => true]);
    $supervisor = User::factory()->create(['role' => UserRoles::Supervisor, 'pin' => '123456', 'is_active' => true]);
    $cashier = User::factory()->create(['role' => UserRoles::Cashier, 'is_active' => true]);

    $shift = CashierShift::factory()->create([
        'user_id' => $cashier->id,
        'status' => CashierShiftStatus::Open,
        'starting_cash' => 500000,
    ]);

    $member = Customer::create([
        'member_code' => 'MBR-F301',
        'name' => 'Siti Aminah',
        'phone' => '081299988877',
        'points' => 50,
        'is_active' => true,
    ]);

    return compact(
        'catBeverage',
        'catSnack',
        'prodA',
        'prodB',
        'prodC',
        'prodReward',
        'cashAccount',
        'bankAccount',
        'admin',
        'supervisor',
        'cashier',
        'shift',
        'member'
    );
}

it('applies payment_promo only to eligible split payment portion with BIN prefix, enforces daily quota, and restores quota on void', function () {
    $fx = seedPhase3Fixtures();

    $payPromo = Promotion::create([
        'code' => 'DEBITBIN10',
        'name' => 'Diskon 10% Kartu Debit BIN 411111',
        'type' => PromotionType::PaymentPromo,
        'scope' => PromotionScope::AllProducts,
        'funding' => PromotionFunding::Shared,
        'payment_method' => PaymentMethod::Debit->value,
        'payment_bin_prefix' => '411111',
        'discount_value' => 10,
        'max_discount_amount' => 15000,
        'max_qty_per_customer_per_day' => 1,
        'stackable' => true,
        'starts_at' => now()->subDay(),
        'ends_at' => now()->addDay(),
        'is_active' => true,
        'created_by' => $fx['admin']->id,
    ]);

    // Total belanja: 10 x 10.000 = 100.000
    // Split payment: Tunai 40.000 + Debit BIN 411111 sebesar 60.000
    // Diskon metode bayar hanya dihitung dari porsi Debit 60.000 -> 10% = 6.000 -> Grand Total = 94.000
    $res = $this->actingAs($fx['cashier'])->postJson(route('pos.cashier.checkout'), [
        'customer_id' => $fx['member']->id,
        'items' => [
            ['product_id' => $fx['prodA']->id, 'product_unit_id' => null, 'qty' => 10],
        ],
        'payments' => [
            [
                'payment_method' => PaymentMethod::Cash->value,
                'financial_account_id' => $fx['cashAccount']->id,
                'amount' => 34000,
            ],
            [
                'payment_method' => PaymentMethod::Debit->value,
                'financial_account_id' => $fx['bankAccount']->id,
                'amount' => 60000,
                'card_bin' => '41111122',
            ],
        ],
    ]);

    $res->assertCreated();
    /** @var Transaction $tx1 */
    $tx1 = Transaction::query()->latest('id')->firstOrFail();

    expect((float) $tx1->subtotal)->toBe(100000.0);
    expect((float) $tx1->discount_amount)->toBe(6000.0);
    expect((float) $tx1->grand_total)->toBe(94000.0);

    // Pastikan promotion_daily_usages tercatat = 1
    $dailyUsage = PromotionDailyUsage::query()
        ->where('promotion_id', $payPromo->id)
        ->where('customer_id', $fx['member']->id)
        ->first();
    expect($dailyUsage)->not->toBeNull();
    expect($dailyUsage?->used_count)->toBe(1);

    // Transaksi kedua di hari yang sama oleh customer yang sama -> kuota harian habis, promo bayar tidak berlaku
    $res2 = $this->actingAs($fx['cashier'])->postJson(route('pos.cashier.checkout'), [
        'customer_id' => $fx['member']->id,
        'items' => [
            ['product_id' => $fx['prodA']->id, 'product_unit_id' => null, 'qty' => 5],
        ],
        'payments' => [
            [
                'payment_method' => PaymentMethod::Debit->value,
                'financial_account_id' => $fx['bankAccount']->id,
                'amount' => 50000,
                'card_bin' => '41111122',
            ],
        ],
    ]);
    $res2->assertCreated();
    /** @var Transaction $tx2 */
    $tx2 = Transaction::query()->latest('id')->firstOrFail();
    expect((float) $tx2->discount_amount)->toBe(0.0);
    expect((float) $tx2->grand_total)->toBe(50000.0);

    // Void transaksi pertama harus mengembalikan promotion_daily_usages menjadi 0
    app(PosTransactionService::class)->void($tx1, [
        'reason' => 'Salah input kartu',
        'supervisor_pin' => '123456',
    ], $fx['cashier']);

    $dailyUsage->refresh();
    expect($dailyUsage->used_count)->toBe(0);
});

it('limits tebus_murah to maximum 1 per receipt even when buying multiple qty or multiple offers exist', function () {
    $fx = seedPhase3Fixtures();

    $tm1 = Promotion::create([
        'code' => 'TEBUS1',
        'name' => 'Tebus Murah Minyak 1L Rp 12.000',
        'type' => PromotionType::TebusMurah,
        'scope' => PromotionScope::AllProducts,
        'funding' => PromotionFunding::Supplier,
        'min_purchase_amount' => 50000,
        'reward_product_id' => $fx['prodReward']->id,
        'special_price' => 12000,
        'starts_at' => now()->subDay(),
        'ends_at' => now()->addDay(),
        'is_active' => true,
        'created_by' => $fx['admin']->id,
    ]);

    Promotion::create([
        'code' => 'TEBUS2',
        'name' => 'Tebus Murah Roti Rp 5.000',
        'type' => PromotionType::TebusMurah,
        'scope' => PromotionScope::AllProducts,
        'funding' => PromotionFunding::Store,
        'min_purchase_amount' => 50000,
        'reward_product_id' => $fx['prodB']->id,
        'special_price' => 5000,
        'starts_at' => now()->subDay(),
        'ends_at' => now()->addDay(),
        'is_active' => true,
        'created_by' => $fx['admin']->id,
    ]);

    /** @var PosPricingService $pricing */
    $pricing = app(PosPricingService::class);

    // Beli 5x prodA (50.000) + 2x prodReward (40.000) + 1x prodB (10.000) = 100.000
    // Hanya 1 unit dari 1 tebus_murah terbaik (hemat 8.000 untuk Minyak Goreng 1L) yang berlaku!
    $eval = $pricing->evaluateCart([
        ['product_id' => $fx['prodA']->id, 'product_unit_id' => null, 'qty' => 5],
        ['product_id' => $fx['prodReward']->id, 'product_unit_id' => null, 'qty' => 2],
        ['product_id' => $fx['prodB']->id, 'product_unit_id' => null, 'qty' => 1],
    ]);

    expect($eval['applied_tebus_murah'])->not->toBeNull();
    expect($eval['applied_tebus_murah']['promotion_id'])->toBe($tm1->id);
    expect($eval['applied_tebus_murah']['discount_amount'])->toBe(8000);
    expect($eval['summary']['transaction_promo_discount_total'])->toBe(8000);
    expect($eval['summary']['grand_total'])->toBe(92000);
    expect(count($eval['tebus_murah_offers']))->toBe(2);
});

it('evaluates min_spend_discount and min_spend_percent with stacking rules (stackable = false vs true)', function () {
    $fx = seedPhase3Fixtures();

    // Promo item 10% untuk prodA
    $itemPromo = Promotion::create([
        'code' => 'ITEM10',
        'name' => 'Diskon Kopi 10%',
        'type' => PromotionType::PercentageDiscount,
        'scope' => PromotionScope::Product,
        'funding' => PromotionFunding::Store,
        'discount_value' => 10,
        'starts_at' => now()->subDay(),
        'ends_at' => now()->addDay(),
        'is_active' => true,
        'created_by' => $fx['admin']->id,
    ]);
    $itemPromo->products()->attach($fx['prodA']->id);

    // Min spend 50.000 potongan Rp 10.000 dengan stackable = false -> TIDAK boleh gabung dengan promo item
    $nonStackableTxPromo = Promotion::create([
        'code' => 'MINSPEND-NOSTACK',
        'name' => 'Min Belanja 50rb Potongan 10rb (Non-Stack)',
        'type' => PromotionType::MinSpendDiscount,
        'scope' => PromotionScope::AllProducts,
        'funding' => PromotionFunding::Store,
        'min_purchase_amount' => 50000,
        'discount_value' => 10000,
        'stackable' => false,
        'starts_at' => now()->subDay(),
        'ends_at' => now()->addDay(),
        'is_active' => true,
        'created_by' => $fx['admin']->id,
    ]);

    /** @var PosPricingService $pricing */
    $pricing = app(PosPricingService::class);

    // 6x prodA (60.000) -> promo item 6.000 -> eligible subtotal 54.000 >= 50.000, namun stackable = false -> tidak dipakai
    $evalBlocked = $pricing->evaluateCart([
        ['product_id' => $fx['prodA']->id, 'product_unit_id' => null, 'qty' => 6],
    ]);
    expect($evalBlocked['summary']['auto_discount_total'])->toBe(6000);
    expect($evalBlocked['summary']['transaction_promo_discount_total'])->toBe(0);
    expect($evalBlocked['transaction_promotion'])->toBeNull();

    // Tambah min_spend_percent 15% maks 7.000 dengan stackable = true -> boleh gabung!
    $stackablePercent = Promotion::create([
        'code' => 'MINSPEND-PCT',
        'name' => 'Min Belanja 50rb Diskon 15% Maks 7rb',
        'type' => PromotionType::MinSpendPercent,
        'scope' => PromotionScope::AllProducts,
        'funding' => PromotionFunding::Shared,
        'min_purchase_amount' => 50000,
        'discount_value' => 15,
        'max_discount_amount' => 7000,
        'stackable' => true,
        'starts_at' => now()->subDay(),
        'ends_at' => now()->addDay(),
        'is_active' => true,
        'created_by' => $fx['admin']->id,
    ]);

    $evalStacked = $pricing->evaluateCart([
        ['product_id' => $fx['prodA']->id, 'product_unit_id' => null, 'qty' => 6],
    ]);
    // 15% x 54.000 = 8.100 -> plafon 7.000
    expect($evalStacked['transaction_promotion']['promotion_id'])->toBe($stackablePercent->id);
    expect($evalStacked['summary']['transaction_promo_discount_total'])->toBe(7000);
    expect($evalStacked['summary']['grand_total'])->toBe(47000);

    // Jika keranjang tanpa promo item (6x prodB = 60.000), nonStackableTxPromo (10.000) menang atas stackablePercent (7.000)
    $evalNoItemPromo = $pricing->evaluateCart([
        ['product_id' => $fx['prodB']->id, 'product_unit_id' => null, 'qty' => 6],
    ]);
    expect($evalNoItemPromo['transaction_promotion']['promotion_id'])->toBe($nonStackableTxPromo->id);
    expect($evalNoItemPromo['summary']['transaction_promo_discount_total'])->toBe(10000);
    expect($evalNoItemPromo['summary']['grand_total'])->toBe(50000);
});

it('calculates bundle, mix_match, nth_item_discount, and enforces max_qty_per_customer_per_day', function () {
    $fx = seedPhase3Fixtures();

    // 1. Bundle: 1x prodA (10.000) + 1x prodB (10.000) = 16.000 (hemat 4.000 per paket, sisa item normal)
    $bundlePromo = Promotion::create([
        'code' => 'BND-SARAPAN',
        'name' => 'Paket Sarapan Kopi + Roti',
        'type' => PromotionType::Bundle,
        'scope' => PromotionScope::AllProducts,
        'funding' => PromotionFunding::Store,
        'bundle_price' => 16000,
        'starts_at' => now()->subDay(),
        'ends_at' => now()->addDay(),
        'is_active' => true,
        'created_by' => $fx['admin']->id,
    ]);
    PromotionBundleItem::create(['promotion_id' => $bundlePromo->id, 'product_id' => $fx['prodA']->id, 'required_qty' => 1]);
    PromotionBundleItem::create(['promotion_id' => $bundlePromo->id, 'product_id' => $fx['prodB']->id, 'required_qty' => 1]);

    /** @var PosPricingService $pricing */
    $pricing = app(PosPricingService::class);

    // Beli 2x prodA + 1x prodB -> 1 paket bundel (16.000) + 1x prodA normal (10.000) = 26.000 (hemat 4.000)
    $bundleEval = $pricing->evaluateCart([
        ['product_id' => $fx['prodA']->id, 'product_unit_id' => null, 'qty' => 2],
        ['product_id' => $fx['prodB']->id, 'product_unit_id' => null, 'qty' => 1],
    ]);
    expect($bundleEval['summary']['auto_discount_total'])->toBe(4000);
    expect($bundleEval['summary']['grand_total'])->toBe(26000);

    $bundlePromo->update(['is_active' => false]);

    // 2. Mix & Match: beli 3 item kategori Makanan Ringan (prodB 10rb + prodC 15rb) = 28.000
    $mixPromo = Promotion::create([
        'code' => 'MIX-SNACK',
        'name' => 'Mix & Match 3 Snack Rp 28.000',
        'type' => PromotionType::MixMatch,
        'scope' => PromotionScope::Category,
        'funding' => PromotionFunding::Supplier,
        'buy_qty' => 3,
        'bundle_price' => 28000,
        'starts_at' => now()->subDay(),
        'ends_at' => now()->addDay(),
        'is_active' => true,
        'created_by' => $fx['admin']->id,
    ]);
    $mixPromo->categories()->attach($fx['catSnack']->id);

    // 2x prodB (20.000) + 1x prodC (15.000) = 35.000 -> Mix & Match 28.000 (hemat 7.000)
    $mixEval = $pricing->evaluateCart([
        ['product_id' => $fx['prodB']->id, 'product_unit_id' => null, 'qty' => 2],
        ['product_id' => $fx['prodC']->id, 'product_unit_id' => null, 'qty' => 1],
    ]);
    expect($mixEval['summary']['auto_discount_total'])->toBe(7000);
    expect($mixEval['summary']['grand_total'])->toBe(28000);

    $mixPromo->update(['is_active' => false]);

    // 3. Nth Item Discount: beli 2 item ke-2 diskon 50%, max_qty_per_customer_per_day = 2
    $nthPromo = Promotion::create([
        'code' => 'NTH2-50',
        'name' => 'Item Ke-2 Diskon 50%',
        'type' => PromotionType::NthItemDiscount,
        'scope' => PromotionScope::Product,
        'funding' => PromotionFunding::Store,
        'nth_item' => 2,
        'discount_value' => 50,
        'max_qty_per_customer_per_day' => 2,
        'starts_at' => now()->subDay(),
        'ends_at' => now()->addDay(),
        'is_active' => true,
        'created_by' => $fx['admin']->id,
    ]);
    $nthPromo->products()->attach($fx['prodA']->id);

    // Beli 4x prodA -> dibatasi max_qty_per_customer_per_day = 2 -> hanya 1 unit ke-2 yg dapat diskon 50% (5.000)
    $nthEval = $pricing->evaluateCart([
        ['product_id' => $fx['prodA']->id, 'product_unit_id' => null, 'qty' => 4],
    ], $fx['member']->id);
    expect($nthEval['summary']['auto_discount_total'])->toBe(5000);
    expect($nthEval['summary']['grand_total'])->toBe(35000);
});

it('applies near_expiry discount and excludes near_expiry items from product vouchers', function () {
    $fx = seedPhase3Fixtures();

    // Buat penerimaan PO dengan tanggal kedaluwarsa 3 hari dari sekarang
    $supplier = Supplier::create([
        'code' => 'SUP-F3',
        'name' => 'Supplier F3',
        'is_active' => true,
    ]);
    $po = PurchaseOrder::create([
        'po_number' => 'PO-F3-001',
        'supplier_id' => $supplier->id,
        'created_by' => $fx['admin']->id,
        'order_date' => now()->toDateString(),
        'status' => 'ordered',
    ]);
    $poItem = PurchaseOrderItem::create([
        'purchase_order_id' => $po->id,
        'product_id' => $fx['prodA']->id,
        'quantity_ordered' => 10,
        'unit_cost' => 6000,
        'subtotal' => 60000,
        'expired_date' => now()->addDays(3)->toDateString(),
    ]);
    $receipt = PurchaseOrderReceipt::create([
        'receipt_number' => 'LPB-F3-001',
        'purchase_order_id' => $po->id,
        'received_by' => $fx['admin']->id,
        'received_date' => now()->toDateString(),
    ]);
    PurchaseOrderReceiptItem::create([
        'purchase_order_receipt_id' => $receipt->id,
        'purchase_order_item_id' => $poItem->id,
        'product_id' => $fx['prodA']->id,
        'unit_name' => 'pcs',
        'conversion_factor' => 1,
        'qty_received' => 10,
        'free_qty_received' => 0,
        'base_qty_received' => 10,
        'unit_cost' => 6000,
        'base_unit_cost' => 6000,
        'expired_date' => now()->addDays(3)->toDateString(),
    ]);

    Promotion::create([
        'code' => 'NEAREXP30',
        'name' => 'Cuci Gudang Near Expiry 30%',
        'type' => PromotionType::NearExpiry,
        'scope' => PromotionScope::AllProducts,
        'funding' => PromotionFunding::Store,
        'near_expiry_days' => 7,
        'discount_value' => 30,
        'starts_at' => now()->subDay(),
        'ends_at' => now()->addDay(),
        'is_active' => true,
        'created_by' => $fx['admin']->id,
    ]);

    Voucher::create([
        'code' => 'VCH-KOPI',
        'name' => 'Voucher Khusus Kopi',
        'type' => VoucherType::ProductSpecific,
        'value' => 2000,
        'min_spend' => 0,
        'valid_from' => now()->subDay(),
        'valid_until' => now()->addDay(),
        'applicable_skus' => [$fx['prodA']->barcode],
        'stackable_with_promo' => true,
        'funding' => PromotionFunding::Store,
        'status' => VoucherStatus::Active,
        'created_by' => $fx['admin']->id,
    ]);

    /** @var PosPricingService $pricing */
    $pricing = app(PosPricingService::class);

    $eval = $pricing->evaluateCart(
        [['product_id' => $fx['prodA']->id, 'product_unit_id' => null, 'qty' => 2]],
        null,
        now(),
        0,
        true,
        'VCH-KOPI'
    );

    // Near expiry 30% dari 20.000 = 6.000
    expect($eval['items'][0]['applied_promotion_type'])->toBe(PromotionType::NearExpiry->value);
    expect($eval['items'][0]['is_near_expiry_promo'])->toBeTrue();
    expect($eval['summary']['auto_discount_total'])->toBe(6000);
    // Item near_expiry tidak boleh diikutkan dalam voucher produk -> voucher gagal / tidak berlaku
    expect($eval['voucher']['applied'])->toBeFalse();
    expect($eval['summary']['voucher_discount_total'])->toBe(0);
    expect($eval['summary']['grand_total'])->toBe(14000);
});

it('claws back lost bundle benefit and min_spend benefit on partial sales return', function () {
    $fx = seedPhase3Fixtures();

    // 1. Test retur bundel: prodA (10rb) + prodB (10rb) = 15rb (hemat 5rb)
    $bundlePromo = Promotion::create([
        'code' => 'BND-RET',
        'name' => 'Paket Hemat 15rb',
        'type' => PromotionType::Bundle,
        'scope' => PromotionScope::AllProducts,
        'funding' => PromotionFunding::Store,
        'bundle_price' => 15000,
        'starts_at' => now()->subDay(),
        'ends_at' => now()->addDay(),
        'is_active' => true,
        'created_by' => $fx['admin']->id,
    ]);
    PromotionBundleItem::create(['promotion_id' => $bundlePromo->id, 'product_id' => $fx['prodA']->id, 'required_qty' => 1]);
    PromotionBundleItem::create(['promotion_id' => $bundlePromo->id, 'product_id' => $fx['prodB']->id, 'required_qty' => 1]);

    $checkoutRes = $this->actingAs($fx['cashier'])->postJson(route('pos.cashier.checkout'), [
        'items' => [
            ['product_id' => $fx['prodA']->id, 'product_unit_id' => null, 'qty' => 1],
            ['product_id' => $fx['prodB']->id, 'product_unit_id' => null, 'qty' => 1],
        ],
        'payments' => [
            [
                'payment_method' => PaymentMethod::Cash->value,
                'financial_account_id' => $fx['cashAccount']->id,
                'amount' => 15000,
            ],
        ],
    ]);
    $checkoutRes->assertCreated();
    /** @var Transaction $bundleTx */
    $bundleTx = Transaction::query()->with('details')->latest('id')->firstOrFail();
    expect((float) $bundleTx->grand_total)->toBe(15000.0);

    $detailA = $bundleTx->details->firstWhere('product_id', $fx['prodA']->id);
    // Retur prodA (dibayar 7.500), prodB tersisa kembali ke harga normal 10.000 -> potong manfaat hilang 2.500 -> refund = 5.000
    $salesReturn = app(SalesReturnService::class)->processReturn($bundleTx, [
        'refund_method' => PaymentMethod::Cash->value,
        'financial_account_id' => $fx['cashAccount']->id,
        'reason' => 'Retur sebagian bundel',
        'supervisor_pin' => '123456',
        'items' => [
            ['transaction_detail_id' => $detailA->id, 'qty' => 1, 'is_restockable' => true],
        ],
    ], $fx['cashier']);

    expect((float) $salesReturn->total_refund_amount)->toBe(5000.0);

    $bundlePromo->update(['is_active' => false]);

    // 2. Test retur membatalkan min_spend_discount: min 50rb potongan 10rb
    Promotion::create([
        'code' => 'MS-RET',
        'name' => 'Min Belanja 50rb Potongan 10rb',
        'type' => PromotionType::MinSpendDiscount,
        'scope' => PromotionScope::AllProducts,
        'funding' => PromotionFunding::Store,
        'min_purchase_amount' => 50000,
        'discount_value' => 10000,
        'stackable' => true,
        'starts_at' => now()->subDay(),
        'ends_at' => now()->addDay(),
        'is_active' => true,
        'created_by' => $fx['admin']->id,
    ]);

    // Beli 3x prodA (30rb) + 2x prodB (20rb) = 50rb -> diskon 10rb -> bayar 40rb (alokasi: prodA 6rb, prodB 4rb)
    $checkoutRes2 = $this->actingAs($fx['cashier'])->postJson(route('pos.cashier.checkout'), [
        'items' => [
            ['product_id' => $fx['prodA']->id, 'product_unit_id' => null, 'qty' => 3],
            ['product_id' => $fx['prodB']->id, 'product_unit_id' => null, 'qty' => 2],
        ],
        'payments' => [
            [
                'payment_method' => PaymentMethod::Cash->value,
                'financial_account_id' => $fx['cashAccount']->id,
                'amount' => 40000,
            ],
        ],
    ]);
    $checkoutRes2->assertCreated();
    /** @var Transaction $msTx */
    $msTx = Transaction::query()->with('details')->latest('id')->firstOrFail();
    expect((float) $msTx->grand_total)->toBe(40000.0);

    // Retur 3x prodA (bayar efektif 24.000); sisa belanja prodB 20.000 < 50.000 -> potong manfaat min_spend yg melekat di prodB (4.000) -> refund = 20.000
    $msDetailA = $msTx->details->firstWhere('product_id', $fx['prodA']->id);
    $msReturn = app(SalesReturnService::class)->processReturn($msTx, [
        'refund_method' => PaymentMethod::Cash->value,
        'financial_account_id' => $fx['cashAccount']->id,
        'reason' => 'Retur membatalkan min spend',
        'supervisor_pin' => '123456',
        'items' => [
            ['transaction_detail_id' => $msDetailA->id, 'qty' => 3, 'is_restockable' => true],
        ],
    ], $fx['cashier']);

    expect((float) $msReturn->total_refund_amount)->toBe(20000.0);
});

it('aggregates applied_promotions by funding (STORE / SUPPLIER / SHARED) in SalesReportService and records cashback metadata', function () {
    $fx = seedPhase3Fixtures();

    // Promo item ditanggung SUPPLIER (potongan 2.000/unit pada prodA)
    $supPromo = Promotion::create([
        'code' => 'SUP-2000',
        'name' => 'Subsidi Supplier Kopi',
        'type' => PromotionType::FixedDiscount,
        'scope' => PromotionScope::Product,
        'funding' => PromotionFunding::Supplier,
        'discount_value' => 2000,
        'starts_at' => now()->subDay(),
        'ends_at' => now()->addDay(),
        'is_active' => true,
        'created_by' => $fx['admin']->id,
    ]);
    $supPromo->products()->attach($fx['prodA']->id);

    // Promo min_spend ditanggung STORE (potongan 5.000, stackable = true)
    Promotion::create([
        'code' => 'STR-5000',
        'name' => 'Promo Toko Min 20rb',
        'type' => PromotionType::MinSpendDiscount,
        'scope' => PromotionScope::AllProducts,
        'funding' => PromotionFunding::Store,
        'min_purchase_amount' => 20000,
        'discount_value' => 5000,
        'stackable' => true,
        'starts_at' => now()->subDay(),
        'ends_at' => now()->addDay(),
        'is_active' => true,
        'created_by' => $fx['admin']->id,
    ]);

    // Promo metode bayar ditanggung SHARED (potongan 3.000 untuk Debit)
    Promotion::create([
        'code' => 'SHR-3000',
        'name' => 'Promo Patungan Bank',
        'type' => PromotionType::PaymentPromo,
        'scope' => PromotionScope::AllProducts,
        'funding' => PromotionFunding::Shared,
        'payment_method' => PaymentMethod::Debit->value,
        'discount_value' => 3000,
        'stackable' => true,
        'starts_at' => now()->subDay(),
        'ends_at' => now()->addDay(),
        'is_active' => true,
        'created_by' => $fx['admin']->id,
    ]);

    // Cashback metadata (tidak mengurangi grand_total)
    Promotion::create([
        'code' => 'CB-1000',
        'name' => 'Cashback Belanja Rp 1.000',
        'type' => PromotionType::Cashback,
        'scope' => PromotionScope::AllProducts,
        'funding' => PromotionFunding::Shared,
        'min_purchase_amount' => 20000,
        'discount_value' => 1000,
        'starts_at' => now()->subDay(),
        'ends_at' => now()->addDay(),
        'is_active' => true,
        'created_by' => $fx['admin']->id,
    ]);

    // Beli 3x prodA (30.000): Supplier -6.000 (sisa 24.000) -> Store -5.000 (sisa 19.000) -> Shared -3.000 -> Grand Total 16.000
    $res = $this->actingAs($fx['cashier'])->postJson(route('pos.cashier.checkout'), [
        'items' => [
            ['product_id' => $fx['prodA']->id, 'product_unit_id' => null, 'qty' => 3],
        ],
        'payments' => [
            [
                'payment_method' => PaymentMethod::Debit->value,
                'financial_account_id' => $fx['bankAccount']->id,
                'amount' => 16000,
            ],
        ],
    ]);
    $res->assertCreated();

    $cashbackRow = AppliedPromotion::query()->where('type', PromotionType::Cashback->value)->first();
    expect($cashbackRow)->not->toBeNull();
    expect((float) $cashbackRow?->discount_amount)->toBe(0.0);
    expect((int) ($cashbackRow?->meta['cashback_amount'] ?? 0))->toBe(1000);

    $report = app(SalesReportService::class)->getReportData([
        'preset' => 'today',
    ]);

    $byFunding = collect($report['promotionFundingBreakdown'])->keyBy('funding');
    expect($byFunding->get('supplier')['total_discount'])->toBe(6000.0);
    expect($byFunding->get('store')['total_discount'])->toBe(5000.0);
    expect($byFunding->get('shared')['total_discount'])->toBe(3000.0);
});

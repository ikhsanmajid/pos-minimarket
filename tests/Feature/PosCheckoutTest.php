<?php

use App\Enums\CashierShiftStatus;
use App\Enums\FinancialAccountType;
use App\Enums\PaymentMethod;
use App\Enums\RoundingMode;
use App\Enums\StockMovementType;
use App\Enums\TransactionStatus;
use App\Enums\UserRoles;
use App\Models\CashierShift;
use App\Models\Category;
use App\Models\FinancialAccount;
use App\Models\FinancialTransaction;
use App\Models\HeldTransaction;
use App\Models\Product;
use App\Models\ProductUnit;
use App\Models\StockMovement;
use App\Models\Transaction;
use App\Models\TransactionPayment;
use App\Models\User;
use App\Services\CashierShiftService;
use App\Services\StoreSettingService;
use Spatie\Activitylog\Models\Activity;

function seedPosTestFixtures(): array
{
    $category = Category::create([
        'name' => 'Minuman',
        'slug' => 'minuman',
        'code' => 'CAT-POS-01',
        'is_active' => true,
    ]);

    $product = Product::create([
        'category_id' => $category->id,
        'barcode' => '8991001001',
        'name' => 'Air Mineral 600ml',
        'base_unit' => 'pcs',
        'buy_price' => 2000,
        'sell_price' => 3500,
        'stock' => 50,
        'min_stock' => 10,
        'active' => true,
    ]);

    $packUnit = ProductUnit::create([
        'product_id' => $product->id,
        'unit_name' => 'Dus',
        'conversion_factor' => 12,
        'barcode' => '8991001001-DUS',
        'buy_price' => 24000,
        'sell_price' => 40000,
        'is_default_purchase' => true,
        'is_active' => true,
    ]);

    $cashAccount = FinancialAccount::create([
        'code' => 'KAS-001',
        'name' => 'Kas Kasir (Laci POS)',
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
        'opening_balance' => 1000000,
        'current_balance' => 1000000,
        'is_default' => false,
        'is_active' => true,
    ]);

    $cashier = User::factory()->create([
        'role' => UserRoles::Cashier,
        'is_active' => true,
    ]);

    $supervisor = User::factory()->create([
        'role' => UserRoles::Supervisor,
        'pin' => '123456',
        'is_active' => true,
    ]);

    $shift = CashierShift::factory()->create([
        'user_id' => $cashier->id,
        'status' => CashierShiftStatus::Open,
        'starting_cash' => 500000,
    ]);

    return compact('category', 'product', 'packUnit', 'cashAccount', 'qrisAccount', 'cashier', 'supervisor', 'shift');
}

it('processes single-UOM and multi-UOM checkout, deducts base_qty stock, snapshots HPP, syncs finance and shift', function () {
    $fx = seedPosTestFixtures();

    // 2 pcs (2 * 3.500 = 7.000) + 1 Dus (12 pcs, 40.000) => subtotal 47.000, total base_qty = 14
    $response = $this->actingAs($fx['cashier'])
        ->postJson(route('pos.cashier.checkout'), [
            'items' => [
                [
                    'product_id' => $fx['product']->id,
                    'product_unit_id' => null,
                    'qty' => 2,
                ],
                [
                    'product_id' => $fx['product']->id,
                    'product_unit_id' => $fx['packUnit']->id,
                    'qty' => 1,
                ],
            ],
            'payments' => [
                [
                    'payment_method' => PaymentMethod::Cash->value,
                    'financial_account_id' => $fx['cashAccount']->id,
                    'amount' => 50000,
                ],
            ],
        ]);

    $response->assertCreated()
        ->assertJsonPath('transaction.grand_total', 47000)
        ->assertJsonPath('transaction.paid_amount', 50000)
        ->assertJsonPath('transaction.change_amount', 3000);

    $tx = Transaction::with(['details', 'payments'])->firstOrFail();
    $fx['product']->refresh();
    $fx['cashAccount']->refresh();

    expect($tx->invoice_number)->toStartWith('INV-')
        ->and($tx->status)->toBe(TransactionStatus::Completed)
        ->and((float) $tx->grand_total)->toBe(47000.0)
        ->and((float) $tx->change_amount)->toBe(3000.0)
        ->and($tx->details)->toHaveCount(2)
        ->and((float) $tx->details[0]->cost_price_snapshot)->toBe(2000.0)
        ->and($tx->details[1]->base_qty)->toBe(12)
        ->and($fx['product']->stock)->toBe(36)
        ->and(StockMovement::where('type', StockMovementType::Sale->value)->sum('qty_change'))->toBe(-14)
        ->and((float) $fx['cashAccount']->current_balance)->toBe(547000.0)
        ->and(FinancialTransaction::where('reference_type', Transaction::class)->where('reference_id', $tx->id)->count())->toBe(1)
        ->and(Activity::where('log_name', 'transaction')->where('event', 'created')->exists())->toBeTrue();

    $shiftTotals = app(CashierShiftService::class)->calculateShiftTotals($fx['shift']);
    expect($shiftTotals['total_cash_sales'])->toBe(47000.0)
        ->and($shiftTotals['total_transactions'])->toBe(1)
        ->and($shiftTotals['expected_cash'])->toBe(547000.0);
});

it('recalculates PPN tax and rounding server-side according to StoreSetting', function () {
    $fx = seedPosTestFixtures();

    app(StoreSettingService::class)->update([
        'store_name' => 'Toko Uji PPN',
        'default_tax_rate' => 11.00,
        'rounding_mode' => RoundingMode::Nearest100->value,
        'shift_variance_tolerance' => 0,
    ]);

    // 1 pcs = 3.500; PPN 11% = 385; before rounding = 3.885; nearest_100 = 3.900 (+15 rounding)
    $this->actingAs($fx['cashier'])
        ->postJson(route('pos.cashier.checkout'), [
            'items' => [
                [
                    'product_id' => $fx['product']->id,
                    'qty' => 1,
                ],
            ],
            'payments' => [
                [
                    'payment_method' => PaymentMethod::Cash->value,
                    'financial_account_id' => $fx['cashAccount']->id,
                    'amount' => 5000,
                ],
            ],
        ])
        ->assertCreated()
        ->assertJsonPath('transaction.subtotal', 3500)
        ->assertJsonPath('transaction.tax_amount', 385)
        ->assertJsonPath('transaction.rounding_amount', 15)
        ->assertJsonPath('transaction.grand_total', 3900)
        ->assertJsonPath('transaction.change_amount', 1100);
});

it('supports split payment across Cash and QRIS and rejects underpayment or non-cash overpayment', function () {
    $fx = seedPosTestFixtures();

    // Underpayment should fail (grand total = 40.000, paid = 35.000)
    $this->actingAs($fx['cashier'])
        ->postJson(route('pos.cashier.checkout'), [
            'items' => [
                ['product_id' => $fx['product']->id, 'product_unit_id' => $fx['packUnit']->id, 'qty' => 1],
            ],
            'payments' => [
                ['payment_method' => PaymentMethod::Cash->value, 'financial_account_id' => $fx['cashAccount']->id, 'amount' => 20000],
                ['payment_method' => PaymentMethod::Qris->value, 'financial_account_id' => $fx['qrisAccount']->id, 'amount' => 15000],
            ],
        ])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('payments');

    // Non-cash overpayment should fail (QRIS 45.000 > grand total 40.000)
    $this->actingAs($fx['cashier'])
        ->postJson(route('pos.cashier.checkout'), [
            'items' => [
                ['product_id' => $fx['product']->id, 'product_unit_id' => $fx['packUnit']->id, 'qty' => 1],
            ],
            'payments' => [
                ['payment_method' => PaymentMethod::Qris->value, 'financial_account_id' => $fx['qrisAccount']->id, 'amount' => 45000],
            ],
        ])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('payments');

    // Valid split: Cash 20.000 (5.000 change -> net 15.000) + QRIS 25.000 = 45.000 paid for 40.000 bill
    $this->actingAs($fx['cashier'])
        ->postJson(route('pos.cashier.checkout'), [
            'items' => [
                ['product_id' => $fx['product']->id, 'product_unit_id' => $fx['packUnit']->id, 'qty' => 1],
            ],
            'payments' => [
                ['payment_method' => PaymentMethod::Cash->value, 'financial_account_id' => $fx['cashAccount']->id, 'amount' => 20000],
                ['payment_method' => PaymentMethod::Qris->value, 'financial_account_id' => $fx['qrisAccount']->id, 'amount' => 25000, 'reference_number' => 'QR-8899'],
            ],
        ])
        ->assertCreated()
        ->assertJsonPath('transaction.change_amount', 5000);

    $fx['cashAccount']->refresh();
    $fx['qrisAccount']->refresh();

    expect(TransactionPayment::count())->toBe(2)
        ->and((float) $fx['cashAccount']->current_balance)->toBe(515000.0)
        ->and((float) $fx['qrisAccount']->current_balance)->toBe(1025000.0);
});

it('blocks checkout and hold bill when user has no open shift', function () {
    $fx = seedPosTestFixtures();
    $otherCashier = User::factory()->create(['role' => UserRoles::Cashier]);

    $this->actingAs($otherCashier)
        ->postJson(route('pos.cashier.checkout'), [
            'items' => [['product_id' => $fx['product']->id, 'qty' => 1]],
            'payments' => [['payment_method' => PaymentMethod::Cash->value, 'financial_account_id' => $fx['cashAccount']->id, 'amount' => 5000]],
        ])
        ->assertUnprocessable();

    $this->actingAs($otherCashier)
        ->postJson(route('pos.cashier.hold'), [
            'items' => [['product_id' => $fx['product']->id, 'qty' => 1]],
        ])
        ->assertUnprocessable();
});

it('rejects checkout when combined multi-UOM base_qty exceeds available stock', function () {
    $fx = seedPosTestFixtures();
    // Stock is 50 pcs. 4 Dus (48 pcs) + 5 pcs = 53 pcs > 50 pcs
    $this->actingAs($fx['cashier'])
        ->postJson(route('pos.cashier.checkout'), [
            'items' => [
                ['product_id' => $fx['product']->id, 'product_unit_id' => $fx['packUnit']->id, 'qty' => 4],
                ['product_id' => $fx['product']->id, 'product_unit_id' => null, 'qty' => 5],
            ],
            'payments' => [
                ['payment_method' => PaymentMethod::Cash->value, 'financial_account_id' => $fx['cashAccount']->id, 'amount' => 200000],
            ],
        ])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('items');

    expect($fx['product']->fresh()->stock)->toBe(50);
});

it('holds a bill without creating an invoice, lists it, and deletes it automatically upon checkout', function () {
    $fx = seedPosTestFixtures();

    $holdRes = $this->actingAs($fx['cashier'])
        ->postJson(route('pos.cashier.hold'), [
            'label' => 'Ibu Budi',
            'items' => [
                ['product_id' => $fx['product']->id, 'qty' => 2],
            ],
        ]);

    $holdRes->assertCreated();
    $held = HeldTransaction::firstOrFail();

    expect($held->hold_code)->toStartWith('HOLD-')
        ->and(Transaction::count())->toBe(0);

    $this->actingAs($fx['cashier'])
        ->getJson(route('pos.cashier.held.index'))
        ->assertOk()
        ->assertJsonCount(1, 'heldTransactions');

    // Checkout using held_transaction_id
    $this->actingAs($fx['cashier'])
        ->postJson(route('pos.cashier.checkout'), [
            'held_transaction_id' => $held->id,
            'items' => [
                ['product_id' => $fx['product']->id, 'qty' => 2],
            ],
            'payments' => [
                ['payment_method' => PaymentMethod::Cash->value, 'financial_account_id' => $fx['cashAccount']->id, 'amount' => 10000],
            ],
        ])
        ->assertCreated();

    expect(HeldTransaction::count())->toBe(0)
        ->and(Transaction::count())->toBe(1);
});

it('requires valid supervisor PIN for cashier manual discount above threshold', function () {
    $fx = seedPosTestFixtures();

    // Without PIN -> rejected
    $this->actingAs($fx['cashier'])
        ->postJson(route('pos.cashier.checkout'), [
            'discount_amount' => 1000,
            'items' => [
                ['product_id' => $fx['product']->id, 'qty' => 2],
            ],
            'payments' => [
                ['payment_method' => PaymentMethod::Cash->value, 'financial_account_id' => $fx['cashAccount']->id, 'amount' => 10000],
            ],
        ])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('supervisor_pin');

    // With valid Supervisor PIN -> succeeds
    $this->actingAs($fx['cashier'])
        ->postJson(route('pos.cashier.checkout'), [
            'discount_amount' => 1000,
            'supervisor_pin' => '123456',
            'items' => [
                ['product_id' => $fx['product']->id, 'qty' => 2],
            ],
            'payments' => [
                ['payment_method' => PaymentMethod::Cash->value, 'financial_account_id' => $fx['cashAccount']->id, 'amount' => 10000],
            ],
        ])
        ->assertCreated()
        ->assertJsonPath('transaction.grand_total', 6000);

    $tx = Transaction::firstOrFail();
    expect($tx->discount_approved_by)->toBe($fx['supervisor']->id);
});

it('charges zero PPN for tax-exempt products and exposes is_tax_exempt in lookup and receipt', function () {
    $fx = seedPosTestFixtures();

    app(StoreSettingService::class)->update([
        'store_name' => 'Toko Sembako Bebas PPN',
        'default_tax_rate' => 11.00,
        'rounding_mode' => RoundingMode::None->value,
        'shift_variance_tolerance' => 0,
    ]);

    $exemptProduct = Product::create([
        'category_id' => $fx['category']->id,
        'barcode' => '8999990001',
        'name' => 'Beras Premium 5kg',
        'base_unit' => 'sak',
        'buy_price' => 60000,
        'sell_price' => 70000,
        'stock' => 20,
        'min_stock' => 5,
        'active' => true,
        'is_tax_exempt' => true,
    ]);

    $this->actingAs($fx['cashier'])
        ->getJson(route('pos.cashier.lookup', ['q' => '8999990001']))
        ->assertOk()
        ->assertJsonPath('products.0.is_tax_exempt', true);

    $this->actingAs($fx['cashier'])
        ->postJson(route('pos.cashier.checkout'), [
            'items' => [
                ['product_id' => $exemptProduct->id, 'qty' => 2],
            ],
            'payments' => [
                [
                    'payment_method' => PaymentMethod::Cash->value,
                    'financial_account_id' => $fx['cashAccount']->id,
                    'amount' => 150000,
                ],
            ],
        ])
        ->assertCreated()
        ->assertJsonPath('transaction.subtotal', 140000)
        ->assertJsonPath('transaction.tax_amount', 0)
        ->assertJsonPath('transaction.grand_total', 140000)
        ->assertJsonPath('transaction.change_amount', 10000)
        ->assertJsonPath('transaction.items.0.is_tax_exempt', true);

    $tx = Transaction::with('details')->firstOrFail();
    expect((float) $tx->tax_amount)->toBe(0.0)
        ->and((float) $tx->grand_total)->toBe(140000.0)
        ->and($tx->details->first()->is_tax_exempt)->toBeTrue();
});

it('calculates PPN only on taxable items in mixed carts including proportional transaction discount', function () {
    $fx = seedPosTestFixtures();

    app(StoreSettingService::class)->update([
        'store_name' => 'Toko Uji Campuran PPN',
        'default_tax_rate' => 10.00,
        'rounding_mode' => RoundingMode::None->value,
        'shift_variance_tolerance' => 0,
    ]);

    // Taxable product: Rp 60.000
    $taxableProduct = Product::create([
        'category_id' => $fx['category']->id,
        'barcode' => '8999990002',
        'name' => 'Biskuit Kaleng',
        'base_unit' => 'kaleng',
        'buy_price' => 45000,
        'sell_price' => 60000,
        'stock' => 20,
        'min_stock' => 5,
        'active' => true,
        'is_tax_exempt' => false,
    ]);

    // Tax-exempt product: Rp 40.000
    $exemptProduct = Product::create([
        'category_id' => $fx['category']->id,
        'barcode' => '8999990003',
        'name' => 'Telur Ayam 1kg',
        'base_unit' => 'kg',
        'buy_price' => 30000,
        'sell_price' => 40000,
        'stock' => 20,
        'min_stock' => 5,
        'active' => true,
        'is_tax_exempt' => true,
    ]);

    // Gross subtotal = 100.000 (60% taxable, 40% tax-exempt)
    // Transaction discount = 10.000 -> 6.000 applied to taxable (taxableAmount = 54.000), 4.000 to exempt (36.000)
    // Net subtotal = 90.000; PPN 10% of 54.000 = 5.400; Grand total = 95.400
    $this->actingAs($fx['cashier'])
        ->postJson(route('pos.cashier.checkout'), [
            'discount_amount' => 10000,
            'supervisor_pin' => '123456',
            'items' => [
                ['product_id' => $taxableProduct->id, 'qty' => 1],
                ['product_id' => $exemptProduct->id, 'qty' => 1],
            ],
            'payments' => [
                [
                    'payment_method' => PaymentMethod::Cash->value,
                    'financial_account_id' => $fx['cashAccount']->id,
                    'amount' => 100000,
                ],
            ],
        ])
        ->assertCreated()
        ->assertJsonPath('transaction.subtotal', 100000)
        ->assertJsonPath('transaction.discount_amount', 10000)
        ->assertJsonPath('transaction.tax_amount', 5400)
        ->assertJsonPath('transaction.grand_total', 95400)
        ->assertJsonPath('transaction.change_amount', 4600);

    $tx = Transaction::with('details')->firstOrFail();
    $detailsByProduct = $tx->details->keyBy('product_id');

    expect($detailsByProduct[$taxableProduct->id]->is_tax_exempt)->toBeFalse()
        ->and($detailsByProduct[$exemptProduct->id]->is_tax_exempt)->toBeTrue();
});

it('allows creating, updating, and filtering tax-exempt products via ProductController', function () {
    $fx = seedPosTestFixtures();
    $admin = User::factory()->create([
        'role' => UserRoles::Admin,
        'is_active' => true,
    ]);

    $this->actingAs($admin)
        ->post(route('pos.products.store'), [
            'category_id' => $fx['category']->id,
            'barcode' => '8998887771',
            'name' => 'Gula Pasir Curah 1kg',
            'base_unit' => 'kg',
            'buy_price' => 14000,
            'sell_price' => 17000,
            'stock' => 30,
            'min_stock' => 5,
            'active' => true,
            'is_tax_exempt' => true,
        ])
        ->assertRedirect(route('pos.products.index'));

    $created = Product::where('barcode', '8998887771')->firstOrFail();
    expect($created->is_tax_exempt)->toBeTrue();

    // Filter tax_status=exempt should only return the exempt product
    $this->actingAs($admin)
        ->get(route('pos.products.index', ['tax_status' => 'exempt']))
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->component('POS/Product/Product')
            ->has('products.data', 1)
            ->where('products.data.0.id', $created->id)
            ->where('products.data.0.is_tax_exempt', true)
        );

    // Toggle back to taxable via update
    $this->actingAs($admin)
        ->patch(route('pos.products.update', $created), [
            'category_id' => $fx['category']->id,
            'barcode' => $created->barcode,
            'name' => $created->name,
            'base_unit' => $created->base_unit,
            'buy_price' => 14000,
            'sell_price' => 17500,
            'stock' => 30,
            'min_stock' => 5,
            'active' => true,
            'is_tax_exempt' => false,
        ])
        ->assertRedirect(route('pos.products.index'));

    expect($created->fresh()->is_tax_exempt)->toBeFalse();
});

it('allocates cash change into a donation product without affecting stock and keeps cash drawer balanced', function () {
    $fx = seedPosTestFixtures();

    $donationProduct = Product::create([
        'category_id' => $fx['category']->id,
        'barcode' => '8990000DONASI',
        'name' => 'Donasi Kemanusiaan',
        'base_unit' => 'pcs',
        'buy_price' => 0,
        'sell_price' => 0,
        'stock' => 0,
        'min_stock' => 0,
        'active' => true,
        'is_tax_exempt' => true,
        'is_donation' => true,
    ]);

    // 1 pcs = 3.500; paid Cash = 5.000 (raw change = 1.500); donate 500 -> grand_total = 4.000, net change = 1.000
    $this->actingAs($fx['cashier'])
        ->postJson(route('pos.cashier.checkout'), [
            'donation_product_id' => $donationProduct->id,
            'donation_amount' => 500,
            'items' => [
                ['product_id' => $fx['product']->id, 'qty' => 1],
            ],
            'payments' => [
                [
                    'payment_method' => PaymentMethod::Cash->value,
                    'financial_account_id' => $fx['cashAccount']->id,
                    'amount' => 5000,
                ],
            ],
        ])
        ->assertCreated()
        ->assertJsonPath('transaction.subtotal', 3500)
        ->assertJsonPath('transaction.donation_amount', 500)
        ->assertJsonPath('transaction.grand_total', 4000)
        ->assertJsonPath('transaction.paid_amount', 5000)
        ->assertJsonPath('transaction.change_amount', 1000);

    $tx = Transaction::with('details')->firstOrFail();
    $donationDetail = $tx->details->firstWhere('product_id', $donationProduct->id);

    expect($donationDetail)->not->toBeNull()
        ->and($donationDetail->is_donation)->toBeTrue()
        ->and($donationDetail->is_tax_exempt)->toBeTrue()
        ->and((float) $donationDetail->subtotal)->toBe(500.0)
        ->and($donationProduct->fresh()->stock)->toBe(0)
        ->and(StockMovement::where('product_id', $donationProduct->id)->exists())->toBeFalse()
        ->and((float) $fx['cashAccount']->fresh()->current_balance)->toBe(504000.0);

    $shiftTotals = app(CashierShiftService::class)->calculateShiftTotals($fx['shift']);
    expect($shiftTotals['total_cash_sales'])->toBe(4000.0)
        ->and($shiftTotals['expected_cash'])->toBe(504000.0);
});

it('rejects change donation exceeding cash change or using a non-donation product', function () {
    $fx = seedPosTestFixtures();

    $donationProduct = Product::create([
        'category_id' => $fx['category']->id,
        'barcode' => '8990000DONASI2',
        'name' => 'Donasi Pendidikan',
        'base_unit' => 'pcs',
        'buy_price' => 0,
        'sell_price' => 0,
        'stock' => 0,
        'min_stock' => 0,
        'active' => true,
        'is_tax_exempt' => true,
        'is_donation' => true,
    ]);

    // Raw change is 1.500; donating 2.000 must fail
    $this->actingAs($fx['cashier'])
        ->postJson(route('pos.cashier.checkout'), [
            'donation_product_id' => $donationProduct->id,
            'donation_amount' => 2000,
            'items' => [
                ['product_id' => $fx['product']->id, 'qty' => 1],
            ],
            'payments' => [
                [
                    'payment_method' => PaymentMethod::Cash->value,
                    'financial_account_id' => $fx['cashAccount']->id,
                    'amount' => 5000,
                ],
            ],
        ])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('donation_amount');

    // Using regular product as donation_product_id must fail
    $this->actingAs($fx['cashier'])
        ->postJson(route('pos.cashier.checkout'), [
            'donation_product_id' => $fx['product']->id,
            'donation_amount' => 500,
            'items' => [
                ['product_id' => $fx['product']->id, 'qty' => 1],
            ],
            'payments' => [
                [
                    'payment_method' => PaymentMethod::Cash->value,
                    'financial_account_id' => $fx['cashAccount']->id,
                    'amount' => 5000,
                ],
            ],
        ])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('donation_product_id');
});

it('automatically marks donation products as tax-exempt when created via ProductController', function () {
    $fx = seedPosTestFixtures();
    $admin = User::factory()->create([
        'role' => UserRoles::Admin,
        'is_active' => true,
    ]);

    $this->actingAs($admin)
        ->post(route('pos.products.store'), [
            'category_id' => $fx['category']->id,
            'barcode' => '8990000DONASI3',
            'name' => 'Donasi Sosial Minimarket',
            'base_unit' => 'pcs',
            'buy_price' => 0,
            'sell_price' => 0,
            'stock' => 0,
            'min_stock' => 0,
            'active' => true,
            'is_tax_exempt' => false,
            'is_donation' => true,
        ])
        ->assertRedirect(route('pos.products.index'));

    $created = Product::where('barcode', '8990000DONASI3')->firstOrFail();
    expect($created->is_donation)->toBeTrue()
        ->and($created->is_tax_exempt)->toBeTrue();
});

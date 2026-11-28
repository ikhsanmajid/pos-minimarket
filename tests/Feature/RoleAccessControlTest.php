<?php

use App\Enums\FinancialAccountType;
use App\Enums\PaymentMethod;
use App\Enums\PaymentStatus;
use App\Enums\PurchaseOrderStatus;
use App\Enums\ReceivingStatus;
use App\Enums\StockAdjustmentReason;
use App\Enums\StockAdjustmentStatus;
use App\Enums\StockAdjustmentType;
use App\Enums\UserRoles;
use App\Models\AccountPayable;
use App\Models\Category;
use App\Models\FinancialAccount;
use App\Models\Product;
use App\Models\PurchaseOrder;
use App\Models\StockAdjustment;
use App\Models\Supplier;
use App\Models\User;
use Inertia\Testing\AssertableInertia as Assert;

function createRoleUser(UserRoles $role, string $prefix): User
{
    return User::create([
        'name' => ucfirst($prefix),
        'email' => $prefix.'_'.uniqid().'@test.local',
        'password' => bcrypt('password'),
        'role' => $role,
        'is_active' => true,
    ]);
}

test('supervisor cannot access finance module and cannot record payable or purchase order payments', function () {
    $admin = createRoleUser(UserRoles::Admin, 'admin_fin');
    $supervisor = createRoleUser(UserRoles::Supervisor, 'sup_fin');

    $account = FinancialAccount::create([
        'code' => 'KAS-RBAC-1',
        'name' => 'Kas Utama',
        'type' => FinancialAccountType::Cash,
        'opening_balance' => 5000000,
        'current_balance' => 5000000,
        'is_default' => true,
        'is_active' => true,
    ]);

    $supplier = Supplier::create([
        'code' => 'SUP-RBAC-1',
        'name' => 'PT Sumber Makmur',
        'phone' => '08123456789',
        'is_active' => true,
    ]);

    $po = PurchaseOrder::create([
        'supplier_id' => $supplier->id,
        'user_id' => $admin->id,
        'order_date' => now()->toDateString(),
        'due_date' => now()->addDays(7)->toDateString(),
        'status' => PurchaseOrderStatus::Approved,
        'receiving_status' => ReceivingStatus::Unreceived,
        'payment_status' => PaymentStatus::Unpaid,
        'subtotal' => 200000,
        'total_amount' => 200000,
    ]);

    $payable = AccountPayable::create([
        'purchase_order_id' => $po->id,
        'supplier_id' => $supplier->id,
        'total_amount' => 200000,
        'paid_amount' => 0,
        'remaining_amount' => 200000,
        'due_date' => now()->addDays(7)->toDateString(),
        'status' => PaymentStatus::Unpaid,
    ]);

    // Supervisor is forbidden from all finance module pages
    $this->actingAs($supervisor)
        ->get(route('pos.finance.accounts.index'))
        ->assertForbidden();

    $this->actingAs($supervisor)
        ->get(route('pos.finance.categories.index'))
        ->assertForbidden();

    $this->actingAs($supervisor)
        ->get(route('pos.finance.transactions.index'))
        ->assertForbidden();

    $this->actingAs($supervisor)
        ->get(route('pos.finance.payables.index'))
        ->assertForbidden();

    $this->actingAs($supervisor)
        ->get(route('pos.purchase-orders.show', $po))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->where('permissions.canRecordPayment', false)
        );

    // Supervisor is forbidden from recording payments on AP or PO
    $payload = [
        'financial_account_id' => $account->id,
        'amount' => 50000,
        'payment_date' => now()->toDateString(),
        'payment_method' => PaymentMethod::Cash->value,
        'notes' => 'Percobaan bayar oleh supervisor',
    ];

    $this->actingAs($supervisor)
        ->post(route('pos.finance.payables.payments.store', $payable), $payload)
        ->assertForbidden();

    $this->actingAs($supervisor)
        ->post(route('pos.purchase-orders.payments.store', $po), $payload)
        ->assertForbidden();

    // Admin still has full payment access
    $this->actingAs($admin)
        ->get(route('pos.finance.payables.index'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->where('payables.data.0.can_pay', true)
        );
});

test('activity logs page is restricted to admin only', function () {
    $admin = createRoleUser(UserRoles::Admin, 'admin_log');
    $supervisor = createRoleUser(UserRoles::Supervisor, 'sup_log');
    $warehouse = createRoleUser(UserRoles::Warehouse, 'wh_log');
    $cashier = createRoleUser(UserRoles::Cashier, 'cas_log');

    $this->actingAs($admin)
        ->get(route('pos.activity-logs.index'))
        ->assertOk();

    $this->actingAs($supervisor)
        ->get(route('pos.activity-logs.index'))
        ->assertForbidden();

    $this->actingAs($warehouse)
        ->get(route('pos.activity-logs.index'))
        ->assertForbidden();

    $this->actingAs($cashier)
        ->get(route('pos.activity-logs.index'))
        ->assertForbidden();
});

test('cashier cannot see product stock on product index, detail, search, or stock adjustment list while warehouse can', function () {
    $cashier = createRoleUser(UserRoles::Cashier, 'cas_stock');
    $warehouse = createRoleUser(UserRoles::Warehouse, 'wh_stock');

    $category = Category::create([
        'code' => 'CAT-RBAC',
        'name' => 'Minuman',
        'is_active' => true,
    ]);

    $product = Product::create([
        'category_id' => $category->id,
        'barcode' => '899000111222',
        'name' => 'Teh Botol 350ml',
        'base_unit' => 'pcs',
        'buy_price' => 3000,
        'sell_price' => 4500,
        'stock' => 42,
        'min_stock' => 10,
        'active' => true,
    ]);

    StockAdjustment::create([
        'adjustment_number' => 'ADJ-RBAC-0001',
        'product_id' => $product->id,
        'type' => StockAdjustmentType::Out,
        'reason' => StockAdjustmentReason::Damaged,
        'status' => StockAdjustmentStatus::Pending,
        'qty_before' => 42,
        'qty_change' => 2,
        'qty_after' => 40,
        'unit_cost_snapshot' => 3000,
        'total_cost_impact' => -6000,
        'notes' => 'Botol pecah',
        'created_by' => $cashier->id,
    ]);

    // Cashier: product index hides stock & stock summary
    $this->actingAs($cashier)
        ->get(route('pos.products.index'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->where('canViewStock', false)
            ->where('products.data.0.stock', null)
            ->where('products.data.0.min_stock', null)
            ->where('summary.safe_stock_count', null)
            ->where('summary.low_stock_count', null)
            ->where('summary.out_of_stock_count', null)
        );

    // Cashier: product detail hides stock & stockMovements
    $this->actingAs($cashier)
        ->get(route('pos.products.show', $product))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->where('canViewStock', false)
            ->where('product.stock', null)
            ->where('product.min_stock', null)
            ->reloadOnly('stockMovements', fn (Assert $reload) => $reload
                ->where('stockMovements', null)
            )
        );

    // Cashier: product search omits stock fields and stock text from label
    $searchResponse = $this->actingAs($cashier)
        ->getJson(route('pos.products.search', ['search' => 'Teh Botol']))
        ->assertOk();

    $firstItem = $searchResponse->json('0');
    expect($firstItem)->not->toHaveKey('stock')
        ->and($firstItem)->not->toHaveKey('min_stock')
        ->and($firstItem['label'])->not->toContain('Stok:');

    // Cashier: stock adjustment list hides qty_before/qty_after/current_product_stock
    $this->actingAs($cashier)
        ->get(route('pos.inventory.adjustments.index'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->where('canViewStock', false)
            ->where('adjustments.data.0.qty_before', null)
            ->where('adjustments.data.0.qty_after', null)
            ->where('adjustments.data.0.current_product_stock', null)
        );

    // Warehouse: still sees stock everywhere
    $this->actingAs($warehouse)
        ->get(route('pos.products.index'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->where('canViewStock', true)
            ->where('products.data.0.stock', 42)
            ->where('products.data.0.min_stock', 10)
            ->where('summary.safe_stock_count', 1)
        );

    $whSearch = $this->actingAs($warehouse)
        ->getJson(route('pos.products.search', ['search' => 'Teh Botol']))
        ->assertOk();

    expect($whSearch->json('0.stock'))->toBe(42);
});

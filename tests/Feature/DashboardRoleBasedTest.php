<?php

use App\Enums\CashierShiftStatus;
use App\Enums\FinancialAccountType;
use App\Enums\PaymentMethod;
use App\Enums\PaymentStatus;
use App\Enums\PurchaseOrderStatus;
use App\Enums\ReceivingStatus;
use App\Enums\UserRoles;
use App\Models\AccountPayable;
use App\Models\CashierShift;
use App\Models\Category;
use App\Models\FinancialAccount;
use App\Models\Product;
use App\Models\PurchaseOrder;
use App\Models\Supplier;
use App\Models\Transaction;
use App\Models\TransactionDetail;
use App\Models\User;
use Inertia\Testing\AssertableInertia as Assert;

function seedDashboardSampleData(User $admin, User $cashier): void
{
    $category = Category::create([
        'name' => 'Minuman',
        'slug' => 'minuman',
        'code' => 'CAT-01',
        'is_active' => true,
    ]);

    $product = Product::create([
        'category_id' => $category->id,
        'barcode' => '899100001',
        'name' => 'Air Mineral 600ml',
        'base_unit' => 'pcs',
        'buy_price' => 2000,
        'sell_price' => 3500,
        'stock' => 5,
        'min_stock' => 10,
        'active' => true,
    ]);

    $supplier = Supplier::create([
        'code' => 'SUP-001',
        'name' => 'PT Sumber Segar',
        'phone' => '081234567890',
        'is_active' => true,
    ]);

    $po = PurchaseOrder::create([
        'supplier_id' => $supplier->id,
        'user_id' => $admin->id,
        'order_date' => now()->toDateString(),
        'due_date' => now()->addDays(3)->toDateString(),
        'status' => PurchaseOrderStatus::Approved,
        'receiving_status' => ReceivingStatus::Unreceived,
        'payment_status' => PaymentStatus::Unpaid,
        'subtotal' => 500000,
        'total_amount' => 500000,
    ]);

    AccountPayable::create([
        'purchase_order_id' => $po->id,
        'supplier_id' => $supplier->id,
        'total_amount' => 500000,
        'paid_amount' => 0,
        'remaining_amount' => 500000,
        'due_date' => now()->addDays(3)->toDateString(),
        'status' => PaymentStatus::Unpaid,
    ]);

    FinancialAccount::create([
        'code' => 'KAS-002',
        'name' => 'Brankas Toko',
        'type' => FinancialAccountType::Cash,
        'opening_balance' => 2000000,
        'current_balance' => 2000000,
        'is_default' => true,
        'is_active' => true,
    ]);

    $shift = CashierShift::factory()->create([
        'user_id' => $cashier->id,
        'status' => CashierShiftStatus::Open,
    ]);

    $tx = Transaction::create([
        'invoice_number' => 'INV-DASH-01',
        'user_id' => $cashier->id,
        'cashier_shift_id' => $shift->id,
        'total_amount' => 35000,
        'discount' => 0,
        'grand_total' => 35000,
        'pay_amount' => 50000,
        'change_amount' => 15000,
        'payment_method' => PaymentMethod::Cash->value,
        'status' => 'completed',
    ]);

    TransactionDetail::create([
        'transaction_id' => $tx->id,
        'product_id' => $product->id,
        'quantity' => '10',
        'buy_price' => 2000,
        'sell_price' => 3500,
        'subtotal' => 35000,
    ]);
}

it('serves full KPI and deferred analytics payload to admin role', function () {
    $admin = User::factory()->create(['role' => UserRoles::Admin]);
    $cashier = User::factory()->create(['role' => UserRoles::Cashier]);
    seedDashboardSampleData($admin, $cashier);

    $this->actingAs($admin)
        ->get(route('pos.dashboard.index', ['period' => 'today']))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('POS/Home')
            ->where('dashboardRole', 'admin')
            ->where('period.preset', 'today')
            ->where('kpis.net_sales.value', 35000)
            ->where('kpis.gross_profit.value', 15000)
            ->where('kpis.cash_bank_balance.total', 2000000)
            ->where('kpis.active_payables.total_remaining', 500000)
            ->where('alertCounts.low_stock', 1)
            ->loadDeferredProps('charts', fn (Assert $reload) => $reload
                ->has('salesTrend', 1)
                ->where('paymentComposition.total', 35000)
            )
            ->loadDeferredProps('widgets', fn (Assert $reload) => $reload
                ->where('topProducts.0.name', 'Air Mineral 600ml')
                ->where('topProducts.0.qty_sold', 10)
                ->has('actionableAlerts.low_stock_products', 1)
                ->has('actionableAlerts.due_payables', 1)
            )
        );
});

it('isolates sensitive financial data from supervisor, warehouse, and cashier roles at backend', function () {
    $admin = User::factory()->create(['role' => UserRoles::Admin]);
    $supervisor = User::factory()->create(['role' => UserRoles::Supervisor]);
    $warehouse = User::factory()->create(['role' => UserRoles::Warehouse]);
    $cashier = User::factory()->create(['role' => UserRoles::Cashier]);
    seedDashboardSampleData($admin, $cashier);

    // Supervisor: operational only, no gross_profit / cash_bank_balance / active_payables
    $this->actingAs($supervisor)
        ->get(route('pos.dashboard.index'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->where('dashboardRole', 'supervisor')
            ->has('kpis.today_sales')
            ->missing('kpis.gross_profit')
            ->missing('kpis.cash_bank_balance')
            ->missing('kpis.active_payables')
            ->missing('paymentComposition')
        );

    // Warehouse: inventory & receiving only, zero sales/finance props
    $this->actingAs($warehouse)
        ->get(route('pos.dashboard.index'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->where('dashboardRole', 'warehouse')
            ->where('kpis.active_sku_count', 1)
            ->where('kpis.low_stock_count', 1)
            ->where('kpis.po_ready_receive_count', 1)
            ->missing('kpis.net_sales')
            ->missing('kpis.gross_profit')
            ->missing('kpis.cash_bank_balance')
            ->missing('kpis.active_payables')
            ->missing('salesTrend')
            ->missing('paymentComposition')
        );

    // Cashier: strictly personal shift status & own history, zero store financial props
    $this->actingAs($cashier)
        ->get(route('pos.dashboard.index'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->where('dashboardRole', 'cashier')
            ->where('cashierData.myTodayTransactionsCount', 1)
            ->has('cashierData.myShift')
            ->has('cashierData.cashRegisters')
            ->missing('kpis')
            ->missing('salesTrend')
            ->missing('paymentComposition')
            ->missing('actionableAlerts')
            ->missing('topProducts')
            ->missing('recentActivities')
        );
});

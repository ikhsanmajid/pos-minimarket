<?php

use App\Enums\CashierShiftStatus;
use App\Enums\FinancialAccountType;
use App\Enums\FinancialCategoryType;
use App\Enums\FinancialTransactionType;
use App\Enums\PaymentMethod;
use App\Enums\PaymentStatus;
use App\Enums\PurchaseOrderStatus;
use App\Enums\ReceivingStatus;
use App\Enums\TransactionStatus;
use App\Enums\UserRoles;
use App\Models\AccountPayable;
use App\Models\CashierShift;
use App\Models\Category;
use App\Models\FinancialAccount;
use App\Models\FinancialCategory;
use App\Models\FinancialTransaction;
use App\Models\Product;
use App\Models\PurchaseOrder;
use App\Models\Supplier;
use App\Models\Transaction;
use App\Models\User;
use Inertia\Testing\AssertableInertia as Assert;

it('computes accurate product stock summary across all non-deleted products regardless of pagination or filters', function () {
    $admin = User::factory()->create(['role' => UserRoles::Admin]);
    $category = Category::create(['name' => 'Sembako', 'slug' => 'sembako', 'code' => 'CAT-01', 'is_active' => true]);

    // 1. Safe stock (stock > min_stock)
    Product::create([
        'category_id' => $category->id,
        'barcode' => 'PRD-SAFE-01',
        'name' => 'Beras 5kg',
        'buy_price' => 60000,
        'sell_price' => 70000,
        'stock' => 25,
        'min_stock' => 10,
        'active' => true,
    ]);

    // 2. Low stock (0 < stock <= min_stock)
    Product::create([
        'category_id' => $category->id,
        'barcode' => 'PRD-LOW-01',
        'name' => 'Minyak 1L',
        'buy_price' => 14000,
        'sell_price' => 17000,
        'stock' => 5,
        'min_stock' => 10,
        'active' => true,
    ]);

    // 3. Out of stock (stock <= 0) & inactive
    Product::create([
        'category_id' => $category->id,
        'barcode' => 'PRD-OUT-01',
        'name' => 'Gula 1kg',
        'buy_price' => 13000,
        'sell_price' => 16000,
        'stock' => 0,
        'min_stock' => 5,
        'active' => false,
    ]);

    // 4. Soft-deleted product (must be excluded)
    $deleted = Product::create([
        'category_id' => $category->id,
        'barcode' => 'PRD-DEL-01',
        'name' => 'Produk Dihapus',
        'buy_price' => 5000,
        'sell_price' => 7000,
        'stock' => 100,
        'min_stock' => 5,
        'active' => true,
    ]);
    $deleted->delete();

    $this->actingAs($admin)
        ->get(route('pos.products.index', ['per_page' => 1, 'stock_status' => 'low_stock']))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('POS/Product/Product')
            ->where('summary.total_products', 3)
            ->where('summary.active_products', 2)
            ->where('summary.safe_stock_count', 1)
            ->where('summary.low_stock_count', 1)
            ->where('summary.out_of_stock_count', 1)
        );
});

it('computes accurate category summary including empty and inactive categories', function () {
    $admin = User::factory()->create(['role' => UserRoles::Admin]);

    $catWithProduct = Category::create(['name' => 'Minuman', 'slug' => 'minuman', 'code' => 'MIN', 'is_active' => true]);
    Category::create(['name' => 'Snack', 'slug' => 'snack', 'code' => 'SNK', 'is_active' => true]);
    Category::create(['name' => 'Arsip', 'slug' => 'arsip', 'code' => 'ARS', 'is_active' => false]);

    Product::create([
        'category_id' => $catWithProduct->id,
        'barcode' => 'CAT-PRD-01',
        'name' => 'Teh Botol',
        'buy_price' => 3000,
        'sell_price' => 5000,
        'stock' => 20,
        'min_stock' => 5,
        'active' => true,
    ]);

    $this->actingAs($admin)
        ->get(route('pos.categories.index'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('POS/Categories/Category')
            ->where('summary.total_categories', 3)
            ->where('summary.active_categories', 2)
            ->where('summary.inactive_categories', 1)
            ->where('summary.empty_categories', 2)
            ->where('summary.categorized_products_count', 1)
        );
});

it('computes accurate user summary breakdown by status and role', function () {
    $admin = User::factory()->create(['role' => UserRoles::Admin, 'is_active' => true]);
    User::factory()->create(['role' => UserRoles::Supervisor, 'is_active' => true]);
    User::factory()->create(['role' => UserRoles::Cashier, 'is_active' => true]);
    User::factory()->create(['role' => UserRoles::Warehouse, 'is_active' => false]);

    $this->actingAs($admin)
        ->get(route('pos.users.index'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('POS/Users/Users')
            ->where('summary.total_users', 4)
            ->where('summary.active_users', 3)
            ->where('summary.inactive_users', 1)
            ->where('summary.admin_supervisor_count', 2)
            ->where('summary.cashier_count', 1)
            ->where('summary.warehouse_count', 1)
        );
});

it('computes accurate supplier and purchase order summaries', function () {
    $admin = User::factory()->create(['role' => UserRoles::Admin]);

    $supActiveWithPo = Supplier::create(['code' => 'SUP-101', 'name' => 'PT Maju', 'phone' => '0811111111', 'is_active' => true]);
    $supActiveIdle = Supplier::create(['code' => 'SUP-102', 'name' => 'PT Tenang', 'phone' => '0812222222', 'is_active' => true]);
    Supplier::create(['code' => 'SUP-103', 'name' => 'PT Nonaktif', 'phone' => '0813333333', 'is_active' => false]);

    // PO 1: Completed (approved + received)
    PurchaseOrder::create([
        'supplier_id' => $supActiveIdle->id,
        'user_id' => $admin->id,
        'order_date' => now()->toDateString(),
        'status' => PurchaseOrderStatus::Approved,
        'receiving_status' => ReceivingStatus::Received,
        'payment_status' => PaymentStatus::Paid,
        'subtotal' => 200000,
        'total_amount' => 200000,
    ]);

    // PO 2: Pending approval (in progress)
    PurchaseOrder::create([
        'supplier_id' => $supActiveWithPo->id,
        'user_id' => $admin->id,
        'order_date' => now()->toDateString(),
        'status' => PurchaseOrderStatus::PendingApproval,
        'receiving_status' => ReceivingStatus::Unreceived,
        'payment_status' => PaymentStatus::Unpaid,
        'subtotal' => 300000,
        'total_amount' => 300000,
    ]);

    // PO 3: Rejected
    PurchaseOrder::create([
        'supplier_id' => $supActiveIdle->id,
        'user_id' => $admin->id,
        'order_date' => now()->toDateString(),
        'status' => PurchaseOrderStatus::Rejected,
        'receiving_status' => ReceivingStatus::Unreceived,
        'payment_status' => PaymentStatus::Unpaid,
        'subtotal' => 100000,
        'total_amount' => 100000,
    ]);

    $this->actingAs($admin)
        ->get(route('pos.suppliers.index'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('POS/Suppliers/Supplier')
            ->where('summary.total_suppliers', 3)
            ->where('summary.active_suppliers', 2)
            ->where('summary.inactive_suppliers', 1)
            ->where('summary.with_active_po_or_debt_count', 1)
        );

    $this->actingAs($admin)
        ->get(route('pos.purchase-orders.index'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('POS/PurchaseOrders/PurchaseOrder')
            ->where('summary.total_orders', 3)
            ->where('summary.total_amount', 600000)
            ->where('summary.completed_orders', 1)
            ->where('summary.in_progress_orders', 1)
            ->where('summary.pending_approval_count', 1)
            ->where('summary.rejected_or_cancelled_orders', 1)
        );
});

it('computes accurate finance module summaries for accounts, payables, and transactions', function () {
    $admin = User::factory()->create(['role' => UserRoles::Admin]);

    $cashAcc = FinancialAccount::create([
        'code' => 'KAS-T1',
        'name' => 'Kas Utama',
        'type' => FinancialAccountType::Cash,
        'opening_balance' => 1000000,
        'current_balance' => 1000000,
        'is_active' => true,
    ]);
    FinancialAccount::create([
        'code' => 'BNK-T1',
        'name' => 'Bank BCA',
        'type' => FinancialAccountType::Bank,
        'opening_balance' => 2500000,
        'current_balance' => 2500000,
        'is_active' => true,
    ]);
    FinancialAccount::create([
        'code' => 'EWL-T1',
        'name' => 'QRIS Toko',
        'type' => FinancialAccountType::Ewallet,
        'opening_balance' => 500000,
        'current_balance' => 500000,
        'is_active' => true,
    ]);

    $supplier = Supplier::create(['code' => 'SUP-FIN', 'name' => 'PT Finance', 'phone' => '0819999999', 'is_active' => true]);
    $po1 = PurchaseOrder::create([
        'supplier_id' => $supplier->id,
        'user_id' => $admin->id,
        'order_date' => now()->subDays(10)->toDateString(),
        'status' => PurchaseOrderStatus::Approved,
        'receiving_status' => ReceivingStatus::Received,
        'payment_status' => PaymentStatus::Paid,
        'subtotal' => 400000,
        'total_amount' => 400000,
    ]);
    $po2 = PurchaseOrder::create([
        'supplier_id' => $supplier->id,
        'user_id' => $admin->id,
        'order_date' => now()->subDays(5)->toDateString(),
        'status' => PurchaseOrderStatus::Approved,
        'receiving_status' => ReceivingStatus::Received,
        'payment_status' => PaymentStatus::Partial,
        'subtotal' => 600000,
        'total_amount' => 600000,
    ]);

    AccountPayable::create([
        'purchase_order_id' => $po1->id,
        'supplier_id' => $supplier->id,
        'total_amount' => 400000,
        'paid_amount' => 400000,
        'remaining_amount' => 0,
        'due_date' => now()->subDays(2)->toDateString(),
        'status' => PaymentStatus::Paid,
    ]);
    AccountPayable::create([
        'purchase_order_id' => $po2->id,
        'supplier_id' => $supplier->id,
        'total_amount' => 600000,
        'paid_amount' => 150000,
        'remaining_amount' => 450000,
        'due_date' => now()->subDay()->toDateString(),
        'status' => PaymentStatus::Partial,
    ]);

    $finCatIn = FinancialCategory::create([
        'code' => 'INC-TEST',
        'name' => 'Penjualan Test',
        'type' => FinancialCategoryType::Income,
        'is_active' => true,
    ]);
    $finCatOut = FinancialCategory::create([
        'code' => 'EXP-TEST',
        'name' => 'Pengeluaran Test',
        'type' => FinancialCategoryType::Expense,
        'is_active' => true,
    ]);

    FinancialTransaction::create([
        'financial_account_id' => $cashAcc->id,
        'financial_category_id' => $finCatIn->id,
        'type' => FinancialTransactionType::In,
        'amount' => 750000,
        'balance_before' => 1000000,
        'balance_after' => 1750000,
        'transaction_date' => now()->toDateString(),
        'description' => 'Setoran penjualan',
        'created_by' => $admin->id,
    ]);
    FinancialTransaction::create([
        'financial_account_id' => $cashAcc->id,
        'financial_category_id' => $finCatOut->id,
        'type' => FinancialTransactionType::Out,
        'amount' => 250000,
        'balance_before' => 1750000,
        'balance_after' => 1500000,
        'transaction_date' => now()->toDateString(),
        'description' => 'Bayar listrik',
        'created_by' => $admin->id,
    ]);

    $this->actingAs($admin)
        ->get(route('pos.finance.accounts.index'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('POS/Finance/FinancialAccount')
            ->where('summary.total_balance', 4000000)
            ->where('summary.cash_balance', 1000000)
            ->where('summary.bank_balance', 2500000)
            ->where('summary.ewallet_balance', 500000)
            ->where('summary.active_accounts', 3)
        );

    $this->actingAs($admin)
        ->get(route('pos.finance.payables.index'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('POS/Finance/AccountPayable')
            ->where('summary.total_count', 2)
            ->where('summary.total_amount', 1000000)
            ->where('summary.paid_amount', 550000)
            ->where('summary.paid_count', 1)
            ->where('summary.total_outstanding', 450000)
            ->where('summary.unpaid_count', 1)
            ->where('summary.overdue_count', 1)
            ->where('summary.overdue_amount', 450000)
        );

    $this->actingAs($admin)
        ->get(route('pos.finance.transactions.index'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('POS/Finance/FinancialTransaction')
            ->where('summary.total_transactions', 2)
            ->where('summary.in_count', 1)
            ->where('summary.out_count', 1)
            ->where('summary.total_in', 750000)
            ->where('summary.total_out', 250000)
            ->where('summary.net_flow', 500000)
        );
});

it('computes accurate shift and transaction summaries', function () {
    $admin = User::factory()->create(['role' => UserRoles::Admin]);
    $cashier = User::factory()->create(['role' => UserRoles::Cashier]);

    CashierShift::factory()->create([
        'user_id' => $cashier->id,
        'status' => CashierShiftStatus::Closed,
        'total_cash_sales' => 100000,
        'total_non_cash_sales' => 50000,
        'cash_variance' => 0,
    ]);
    CashierShift::factory()->create([
        'user_id' => $cashier->id,
        'status' => CashierShiftStatus::Closed,
        'total_cash_sales' => 200000,
        'total_non_cash_sales' => 0,
        'cash_variance' => -15000,
    ]);
    CashierShift::factory()->create([
        'user_id' => $cashier->id,
        'status' => CashierShiftStatus::Open,
        'total_cash_sales' => 999999,
    ]);

    Transaction::create([
        'invoice_number' => 'INV-SUM-01',
        'user_id' => $cashier->id,
        'total_amount' => 50000,
        'discount' => 0,
        'grand_total' => 50000,
        'pay_amount' => 50000,
        'change_amount' => 0,
        'payment_method' => PaymentMethod::Cash->value,
        'status' => TransactionStatus::Completed->value,
    ]);
    Transaction::create([
        'invoice_number' => 'INV-SUM-02',
        'user_id' => $cashier->id,
        'total_amount' => 20000,
        'discount' => 0,
        'grand_total' => 20000,
        'pay_amount' => 20000,
        'change_amount' => 0,
        'payment_method' => PaymentMethod::Cash->value,
        'status' => TransactionStatus::Voided->value,
    ]);

    $this->actingAs($admin)
        ->get(route('pos.shifts.history'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('POS/Shifts/ShiftHistory')
            ->where('summary.total_shifts', 3)
            ->where('summary.open_shifts', 1)
            ->where('summary.normal_closed_shifts', 1)
            ->where('summary.variance_shifts', 1)
            ->where('summary.total_shift_sales', 350000)
            ->where('summary.total_variance_amount', 15000)
        );

    $this->actingAs($admin)
        ->get(route('pos.transactions.index'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('POS/Transactions/Transaction')
            ->where('summary.total_transactions', 2)
            ->where('summary.completed_count', 1)
            ->where('summary.voided_count', 1)
            ->where('summary.total_sales', 50000)
            ->where('summary.voided_amount', 20000)
        );
});

it('filters module summaries by start_date and end_date when date range is provided', function () {
    $admin = User::factory()->create(['role' => UserRoles::Admin]);
    $cashier = User::factory()->create(['role' => UserRoles::Cashier]);
    $supplier = Supplier::create(['code' => 'SUP-DR', 'name' => 'PT Rentang', 'phone' => '0818888888', 'is_active' => true]);

    // 1. Purchase Orders across two dates
    PurchaseOrder::create([
        'supplier_id' => $supplier->id,
        'user_id' => $admin->id,
        'order_date' => '2026-01-05',
        'status' => PurchaseOrderStatus::Approved,
        'receiving_status' => ReceivingStatus::Received,
        'payment_status' => PaymentStatus::Paid,
        'subtotal' => 100000,
        'total_amount' => 100000,
    ]);
    PurchaseOrder::create([
        'supplier_id' => $supplier->id,
        'user_id' => $admin->id,
        'order_date' => '2026-01-20',
        'status' => PurchaseOrderStatus::PendingApproval,
        'receiving_status' => ReceivingStatus::Unreceived,
        'payment_status' => PaymentStatus::Unpaid,
        'subtotal' => 250000,
        'total_amount' => 250000,
    ]);

    $this->actingAs($admin)
        ->get(route('pos.purchase-orders.index', ['start_date' => '2026-01-10', 'end_date' => '2026-01-31']))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('POS/PurchaseOrders/PurchaseOrder')
            ->where('summary.total_orders', 1)
            ->where('summary.total_amount', 250000)
            ->where('summary.completed_orders', 0)
            ->where('summary.in_progress_orders', 1)
            ->where('summary.pending_approval_count', 1)
        );

    // 2. Financial Transactions across two dates
    $account = FinancialAccount::create([
        'code' => 'KAS-DR',
        'name' => 'Kas Rentang',
        'type' => FinancialAccountType::Cash,
        'opening_balance' => 1000000,
        'current_balance' => 1000000,
        'is_active' => true,
    ]);
    $catIn = FinancialCategory::create([
        'code' => 'INC-DR',
        'name' => 'Income DR',
        'type' => FinancialCategoryType::Income,
        'is_active' => true,
    ]);
    $catOut = FinancialCategory::create([
        'code' => 'EXP-DR',
        'name' => 'Expense DR',
        'type' => FinancialCategoryType::Expense,
        'is_active' => true,
    ]);

    FinancialTransaction::create([
        'financial_account_id' => $account->id,
        'financial_category_id' => $catIn->id,
        'type' => FinancialTransactionType::In,
        'amount' => 500000,
        'balance_before' => 1000000,
        'balance_after' => 1500000,
        'transaction_date' => '2026-01-05',
        'description' => 'Awal bulan',
        'created_by' => $admin->id,
    ]);
    FinancialTransaction::create([
        'financial_account_id' => $account->id,
        'financial_category_id' => $catOut->id,
        'type' => FinancialTransactionType::Out,
        'amount' => 120000,
        'balance_before' => 1500000,
        'balance_after' => 1380000,
        'transaction_date' => '2026-01-20',
        'description' => 'Pertengahan bulan',
        'created_by' => $admin->id,
    ]);

    $this->actingAs($admin)
        ->get(route('pos.finance.transactions.index', ['start_date' => '2026-01-10', 'end_date' => '2026-01-31']))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('POS/Finance/FinancialTransaction')
            ->where('summary.total_transactions', 1)
            ->where('summary.in_count', 0)
            ->where('summary.out_count', 1)
            ->where('summary.total_in', 0)
            ->where('summary.total_out', 120000)
            ->where('summary.net_flow', -120000)
        );

    // 3. Cashier Shifts across two dates
    CashierShift::factory()->create([
        'user_id' => $cashier->id,
        'status' => CashierShiftStatus::Closed,
        'opened_at' => '2026-01-05 08:00:00',
        'closed_at' => '2026-01-05 16:00:00',
        'total_cash_sales' => 100000,
        'total_non_cash_sales' => 0,
        'cash_variance' => 0,
    ]);
    CashierShift::factory()->create([
        'user_id' => $cashier->id,
        'status' => CashierShiftStatus::Closed,
        'opened_at' => '2026-01-20 08:00:00',
        'closed_at' => '2026-01-20 16:00:00',
        'total_cash_sales' => 300000,
        'total_non_cash_sales' => 50000,
        'cash_variance' => -10000,
    ]);

    $this->actingAs($admin)
        ->get(route('pos.shifts.history', ['start_date' => '2026-01-10', 'end_date' => '2026-01-31']))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('POS/Shifts/ShiftHistory')
            ->where('summary.total_shifts', 1)
            ->where('summary.normal_closed_shifts', 0)
            ->where('summary.variance_shifts', 1)
            ->where('summary.total_shift_sales', 350000)
            ->where('summary.total_variance_amount', 10000)
        );

    // 4. POS Transactions across two dates
    $txEarly = Transaction::create([
        'invoice_number' => 'INV-DR-01',
        'user_id' => $cashier->id,
        'total_amount' => 40000,
        'discount' => 0,
        'grand_total' => 40000,
        'pay_amount' => 40000,
        'change_amount' => 0,
        'payment_method' => PaymentMethod::Cash->value,
        'status' => TransactionStatus::Completed->value,
    ]);
    $txEarly->forceFill(['created_at' => '2026-01-05 10:00:00'])->save();

    $txLate = Transaction::create([
        'invoice_number' => 'INV-DR-02',
        'user_id' => $cashier->id,
        'total_amount' => 75000,
        'discount' => 0,
        'grand_total' => 75000,
        'pay_amount' => 75000,
        'change_amount' => 0,
        'payment_method' => PaymentMethod::Cash->value,
        'status' => TransactionStatus::Completed->value,
    ]);
    $txLate->forceFill(['created_at' => '2026-01-20 10:00:00'])->save();

    $this->actingAs($admin)
        ->get(route('pos.transactions.index', ['start_date' => '2026-01-10', 'end_date' => '2026-01-31']))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('POS/Transactions/Transaction')
            ->where('summary.total_transactions', 1)
            ->where('summary.completed_count', 1)
            ->where('summary.total_sales', 75000)
        );
});

<?php

use App\Enums\FinancialAccountType;
use App\Enums\FinancialCategoryType;
use App\Enums\FinancialTransactionType;
use App\Enums\PaymentMethod;
use App\Enums\PaymentStatus;
use App\Enums\PurchaseOrderStatus;
use App\Enums\ReceivingStatus;
use App\Enums\SalesReturnStatus;
use App\Enums\StockAdjustmentReason;
use App\Enums\StockAdjustmentStatus;
use App\Enums\StockAdjustmentType;
use App\Enums\StockOpnameStatus;
use App\Enums\TransactionStatus;
use App\Enums\UserRoles;
use App\Models\AccountPayable;
use App\Models\Category;
use App\Models\FinancialAccount;
use App\Models\FinancialCategory;
use App\Models\FinancialTransaction;
use App\Models\Product;
use App\Models\PurchaseOrder;
use App\Models\SalesReturn;
use App\Models\SalesReturnItem;
use App\Models\StockAdjustment;
use App\Models\StockOpname;
use App\Models\Supplier;
use App\Models\Transaction;
use App\Models\TransactionDetail;
use App\Models\TransactionPayment;
use App\Models\User;
use App\Services\Reports\FinanceReportService;
use App\Services\Reports\ProfitLossReportService;
use App\Services\Reports\SalesReportService;
use App\Services\Reports\StockReportService;
use Carbon\CarbonImmutable;

function createReportUser(UserRoles $role, string $name = 'User Test'): User
{
    return User::factory()->create([
        'name' => $name,
        'role' => $role,
        'is_active' => true,
    ]);
}

function createReportCategory(string $name): Category
{
    return Category::create([
        'name' => $name,
        'slug' => str($name)->slug()->append('-'.fake()->unique()->numberBetween(100, 999))->toString(),
        'is_active' => true,
    ]);
}

function createReportProduct(Category $category, string $name, float $buyPrice, float $sellPrice, int $stock = 20): Product
{
    return Product::create([
        'category_id' => $category->id,
        'barcode' => 'BR'.fake()->unique()->numerify('########'),
        'name' => $name,
        'base_unit' => 'pcs',
        'buy_price' => $buyPrice,
        'sell_price' => $sellPrice,
        'stock' => $stock,
        'min_stock' => 5,
        'active' => true,
    ]);
}

function createReportAccount(string $code, string $name, FinancialAccountType $type = FinancialAccountType::Cash, float $balance = 1000000): FinancialAccount
{
    return FinancialAccount::create([
        'code' => $code,
        'name' => $name,
        'type' => $type,
        'opening_balance' => $balance,
        'current_balance' => $balance,
        'is_active' => true,
    ]);
}

function createReportSale(
    User $cashier,
    FinancialAccount $account,
    Product $product,
    int $qty,
    float $unitPrice,
    float $costSnapshot,
    PaymentMethod $method = PaymentMethod::Cash,
    TransactionStatus $status = TransactionStatus::Completed,
    float $taxAmount = 0,
    ?CarbonImmutable $createdAt = null
): array {
    $subtotal = round($qty * $unitPrice, 2);
    $grandTotal = round($subtotal + $taxAmount, 2);

    $tx = Transaction::create([
        'invoice_number' => 'INV-'.fake()->unique()->numerify('######'),
        'user_id' => $cashier->id,
        'subtotal' => $subtotal,
        'discount_amount' => 0,
        'tax_amount' => $taxAmount,
        'rounding_amount' => 0,
        'donation_amount' => 0,
        'total_amount' => $grandTotal,
        'grand_total' => $grandTotal,
        'paid_amount' => $grandTotal,
        'pay_amount' => $grandTotal,
        'change_amount' => 0,
        'payment_method' => $method->value,
        'status' => $status,
    ]);

    if ($createdAt !== null) {
        $tx->forceFill(['created_at' => $createdAt, 'updated_at' => $createdAt])->save();
    }

    $detail = TransactionDetail::create([
        'transaction_id' => $tx->id,
        'product_id' => $product->id,
        'unit_name_snapshot' => 'pcs',
        'conversion_factor' => 1,
        'qty' => $qty,
        'base_qty' => $qty,
        'unit_price' => $unitPrice,
        'cost_price_snapshot' => $costSnapshot,
        'discount_amount' => 0,
        'quantity' => (string) $qty,
        'buy_price' => $costSnapshot,
        'sell_price' => $unitPrice,
        'subtotal' => $subtotal,
    ]);

    TransactionPayment::create([
        'transaction_id' => $tx->id,
        'payment_method' => $method,
        'financial_account_id' => $account->id,
        'amount' => $grandTotal,
    ]);

    return [$tx, $detail];
}

// =========================================================================
// 1. LAPORAN PENJUALAN
// =========================================================================
test('sales report excludes voided transactions, subtracts returns, and supports filters', function (): void {
    $cashierA = createReportUser(UserRoles::Cashier, 'Kasir Alpha');
    $cashierB = createReportUser(UserRoles::Cashier, 'Kasir Beta');
    $account = createReportAccount('KAS-RPT-1', 'Kas POS');

    $catDrink = createReportCategory('Minuman');
    $catSnack = createReportCategory('Makanan Ringan');

    $pDrink = createReportProduct($catDrink, 'Air Mineral 600ml', 2000, 4000, 100);
    $pSnack = createReportProduct($catSnack, 'Keripik Kentang', 5000, 10000, 50);

    $today = CarbonImmutable::now();

    // Transaksi 1 (valid, Kasir A, Tunai, Minuman): 5 x 4.000 = 20.000
    [$tx1, $det1] = createReportSale($cashierA, $account, $pDrink, 5, 4000, 2000, PaymentMethod::Cash, TransactionStatus::Completed, 0, $today);

    // Transaksi 2 (valid, Kasir B, QRIS, Snack): 3 x 10.000 = 30.000
    createReportSale($cashierB, $account, $pSnack, 3, 10000, 5000, PaymentMethod::Qris, TransactionStatus::Completed, 0, $today);

    // Transaksi 3 (VOIDED — harus dikecualikan 100%): 10 x 10.000 = 100.000
    createReportSale($cashierA, $account, $pSnack, 10, 10000, 5000, PaymentMethod::Debit, TransactionStatus::Voided, 0, $today);

    // Transaksi 4 (di luar rentang tanggal — 40 hari lalu)
    createReportSale($cashierA, $account, $pDrink, 10, 4000, 2000, PaymentMethod::Cash, TransactionStatus::Completed, 0, $today->subDays(40));

    // Retur pada Transaksi 1: 1 x 4.000 = 4.000
    $salesReturn = SalesReturn::create([
        'return_number' => 'RET-RPT-001',
        'transaction_id' => $tx1->id,
        'processed_by' => $cashierA->id,
        'approved_by' => $cashierA->id,
        'status' => SalesReturnStatus::Completed,
        'refund_method' => PaymentMethod::Cash,
        'financial_account_id' => $account->id,
        'total_refund_amount' => 4000,
        'reason' => 'Salah beli',
    ]);

    SalesReturnItem::create([
        'sales_return_id' => $salesReturn->id,
        'transaction_detail_id' => $det1->id,
        'product_id' => $pDrink->id,
        'unit_name_snapshot' => 'pcs',
        'conversion_factor' => 1,
        'qty' => 1,
        'base_qty' => 1,
        'unit_price_snapshot' => 4000,
        'subtotal_refund' => 4000,
        'is_restockable' => true,
    ]);

    /** @var SalesReportService $service */
    $service = app(SalesReportService::class);
    $dateRange = [
        'preset' => 'custom',
        'start_date' => $today->subDays(2)->toDateString(),
        'end_date' => $today->toDateString(),
    ];

    $report = $service->getReportData($dateRange, false);

    // Total valid = 20.000 + 30.000 = 50.000; Retur = 4.000; Net Sales = 46.000; Voided (100.000) & 40 hari lalu (40.000) tidak masuk
    expect($report['summary']['transactions_count'])->toBe(2)
        ->and($report['summary']['gross_sales'])->toBe(50000.0)
        ->and($report['summary']['total_returns'])->toBe(4000.0)
        ->and($report['summary']['net_sales'])->toBe(46000.0)
        ->and($report['summary']['average_order_value'])->toBe(23000.0);

    // Debit (dari transaksi voided) tidak boleh muncul pada breakdown metode pembayaran
    $methods = collect($report['paymentBreakdown'])->pluck('method')->all();
    expect($methods)->not->toContain(PaymentMethod::Debit->value)
        ->and($methods)->toContain(PaymentMethod::Cash->value)
        ->and($methods)->toContain(PaymentMethod::Qris->value);

    // Filter kasir A
    $byCashier = $service->getReportData([...$dateRange, 'cashier_id' => $cashierA->id], false);
    expect($byCashier['summary']['transactions_count'])->toBe(1)
        ->and($byCashier['summary']['net_sales'])->toBe(16000.0);

    // Filter metode QRIS
    $byPayment = $service->getReportData([...$dateRange, 'payment_method' => PaymentMethod::Qris->value], false);
    expect($byPayment['summary']['transactions_count'])->toBe(1)
        ->and($byPayment['summary']['net_sales'])->toBe(30000.0);

    // Filter kategori Snack
    $byCategory = $service->getReportData([...$dateRange, 'category_id' => $catSnack->id], false);
    expect($byCategory['summary']['transactions_count'])->toBe(1)
        ->and($byCategory['summary']['net_sales'])->toBe(30000.0);
});

// =========================================================================
// 2. LAPORAN LABA KOTOR (HPP)
// =========================================================================
test('profit loss report uses cost_price_snapshot, handles restockable vs damaged returns, zero division, and shrinkage', function (): void {
    $admin = createReportUser(UserRoles::Admin, 'Owner');
    $account = createReportAccount('KAS-PL-1', 'Kas Utama');
    $cat = createReportCategory('Sembako');
    $product = createReportProduct($cat, 'Beras 5kg', 50000, 70000, 30);

    $today = CarbonImmutable::now();

    // Transaksi 1: 4 unit @ 70.000 (HPP snapshot 50.000), PPN 10% = 28.000 (harus dikeluarkan dari Omzet Bersih)
    [$tx, $det] = createReportSale($admin, $account, $product, 4, 70000, 50000, PaymentMethod::Cash, TransactionStatus::Completed, 28000, $today);

    // Ubah buy_price produk SETELAH transaksi menjadi 65.000 — HPP historis TIDAK boleh berubah
    $product->update(['buy_price' => 65000]);

    // Retur 1 (is_restockable = true): 1 unit -> mengurangi Omzet Bersih 70.000 & mengurangi HPP 50.000
    $retRestock = SalesReturn::create([
        'return_number' => 'RET-PL-1',
        'transaction_id' => $tx->id,
        'processed_by' => $admin->id,
        'approved_by' => $admin->id,
        'status' => SalesReturnStatus::Completed,
        'refund_method' => PaymentMethod::Cash,
        'financial_account_id' => $account->id,
        'total_refund_amount' => 70000,
        'reason' => 'Barang masih tersegel',
    ]);
    SalesReturnItem::create([
        'sales_return_id' => $retRestock->id,
        'transaction_detail_id' => $det->id,
        'product_id' => $product->id,
        'unit_name_snapshot' => 'pcs',
        'conversion_factor' => 1,
        'qty' => 1,
        'base_qty' => 1,
        'unit_price_snapshot' => 70000,
        'subtotal_refund' => 70000,
        'is_restockable' => true,
    ]);

    // Retur 2 (is_restockable = false / rusak): 1 unit -> mengurangi Omzet Bersih 70.000, TIDAK mengurangi HPP
    $retDamaged = SalesReturn::create([
        'return_number' => 'RET-PL-2',
        'transaction_id' => $tx->id,
        'processed_by' => $admin->id,
        'approved_by' => $admin->id,
        'status' => SalesReturnStatus::Completed,
        'refund_method' => PaymentMethod::Cash,
        'financial_account_id' => $account->id,
        'total_refund_amount' => 70000,
        'reason' => 'Kemasan robek',
    ]);
    SalesReturnItem::create([
        'sales_return_id' => $retDamaged->id,
        'transaction_detail_id' => $det->id,
        'product_id' => $product->id,
        'unit_name_snapshot' => 'pcs',
        'conversion_factor' => 1,
        'qty' => 1,
        'base_qty' => 1,
        'unit_price_snapshot' => 70000,
        'subtotal_refund' => 70000,
        'is_restockable' => false,
    ]);

    // Shrinkage 1: StockAdjustment approved (damaged) = 25.000
    StockAdjustment::create([
        'adjustment_number' => 'ADJ-RPT-1',
        'product_id' => $product->id,
        'type' => StockAdjustmentType::Out,
        'reason' => StockAdjustmentReason::Damaged,
        'status' => StockAdjustmentStatus::Approved,
        'qty_before' => 30,
        'qty_change' => 1,
        'qty_after' => 29,
        'unit_cost_snapshot' => 25000,
        'total_cost_impact' => -25000,
        'notes' => 'Rusak gudang',
        'created_by' => $admin->id,
        'approved_by' => $admin->id,
        'approved_at' => $today,
    ]);

    // Shrinkage 2: StockOpname completed minus (-15.000) -> masuk shrinkage
    StockOpname::create([
        'opname_number' => 'OPN-RPT-1',
        'status' => StockOpnameStatus::Completed,
        'is_blind_count' => true,
        'started_at' => $today->subHour(),
        'completed_at' => $today,
        'created_by' => $admin->id,
        'approved_by' => $admin->id,
        'total_items_counted' => 1,
        'total_variance_items' => 1,
        'total_variance_value' => -15000,
    ]);

    // StockOpname draft & cancelled minus -> HARUS diabaikan
    StockOpname::create([
        'opname_number' => 'OPN-RPT-DRAFT',
        'status' => StockOpnameStatus::Draft,
        'is_blind_count' => true,
        'created_by' => $admin->id,
        'total_variance_value' => -99000,
    ]);
    StockOpname::create([
        'opname_number' => 'OPN-RPT-CANCEL',
        'status' => StockOpnameStatus::Cancelled,
        'is_blind_count' => true,
        'cancelled_at' => $today,
        'created_by' => $admin->id,
        'total_variance_value' => -88000,
    ]);

    /** @var ProfitLossReportService $service */
    $service = app(ProfitLossReportService::class);
    $report = $service->getReportData([
        'preset' => 'custom',
        'start_date' => $today->subDay()->toDateString(),
        'end_date' => $today->toDateString(),
    ], false);

    // Gross Revenue (excl. PPN) = 280.000; Returns = 140.000 -> Net Revenue = 140.000
    // Gross COGS (snapshot 50.000 x 4) = 200.000; Restockable COGS = 50.000 (damaged tidak mengurangi) -> Net COGS = 150.000
    // Gross Profit = 140.000 - 150.000 = -10.000
    // Shrinkage = 25.000 (adj) + 15.000 (opname completed) = 40.000
    expect($report['summary']['net_revenue'])->toBe(140000.0)
        ->and($report['summary']['gross_cogs'])->toBe(200000.0)
        ->and($report['summary']['restockable_return_cogs'])->toBe(50000.0)
        ->and($report['summary']['net_cogs'])->toBe(150000.0)
        ->and($report['summary']['gross_profit'])->toBe(-10000.0)
        ->and($report['summary']['adjustment_loss'])->toBe(25000.0)
        ->and($report['summary']['opname_loss'])->toBe(15000.0)
        ->and($report['summary']['total_shrinkage'])->toBe(40000.0);

    // Uji division-by-zero safety pada periode kosong
    $emptyReport = $service->getReportData([
        'preset' => 'custom',
        'start_date' => $today->subDays(120)->toDateString(),
        'end_date' => $today->subDays(115)->toDateString(),
    ], false);
    expect($emptyReport['summary']['net_revenue'])->toBe(0.0)
        ->and($emptyReport['summary']['gross_margin_pct'])->toBe(0.0);
});

// =========================================================================
// 3. LAPORAN VALUASI & PERGERAKAN STOK
// =========================================================================
test('stock valuation excludes soft-deleted products and classifies dead stock correctly', function (): void {
    $cashier = createReportUser(UserRoles::Cashier, 'Kasir Stok');
    $account = createReportAccount('KAS-STK-1', 'Kas Stok');
    $cat = createReportCategory('Alat Tulis');

    $fastProduct = createReportProduct($cat, 'Pulpen Gel', 2000, 4000, 100);
    $deadProduct = createReportProduct($cat, 'Penghapus Lama', 1000, 2500, 15);
    $deletedProduct = createReportProduct($cat, 'Produk Dihapus', 50000, 80000, 99);
    $deletedProduct->delete();

    // Jual 12 unit fastProduct -> >= 10 -> fast_moving
    createReportSale($cashier, $account, $fastProduct, 12, 4000, 2000);

    /** @var StockReportService $service */
    $service = app(StockReportService::class);
    $report = $service->getReportData(['preset' => '30d'], false);

    // Valuasi hanya produk aktif: (100 * 2.000) + (15 * 1.000) = 215.000 (produk soft-delete 4.950.000 diabaikan)
    expect($report['summary']['total_asset_value'])->toBe(215000.0)
        ->and($report['summary']['total_skus'])->toBe(2)
        ->and($report['summary']['fast_moving_count'])->toBe(1)
        ->and($report['summary']['dead_stock_count'])->toBe(1);

    $deadRow = collect($report['products'])->firstWhere('product_id', $deadProduct->id);
    expect($deadRow['movement_class'])->toBe('dead_stock');
});

// =========================================================================
// 4. LAPORAN KEUANGAN & AGING HUTANG
// =========================================================================
test('finance report aggregates cashflow and buckets unpaid payables into aging ranges', function (): void {
    $admin = createReportUser(UserRoles::Admin, 'Admin Finance');
    $account = createReportAccount('KAS-FIN-1', 'Brankas', FinancialAccountType::Cash, 5000000);

    $incCat = FinancialCategory::create([
        'code' => 'INC-TEST',
        'name' => 'Penjualan POS',
        'type' => FinancialCategoryType::Income,
        'is_active' => true,
    ]);
    $expCat = FinancialCategory::create([
        'code' => 'EXP-TEST',
        'name' => 'Listrik & Air',
        'type' => FinancialCategoryType::Expense,
        'is_active' => true,
    ]);

    $today = CarbonImmutable::now();

    FinancialTransaction::create([
        'financial_account_id' => $account->id,
        'financial_category_id' => $incCat->id,
        'type' => FinancialTransactionType::In,
        'amount' => 1500000,
        'balance_before' => 3500000,
        'balance_after' => 5000000,
        'transaction_date' => $today->toDateString(),
        'description' => 'Setoran penjualan',
        'created_by' => $admin->id,
    ]);
    FinancialTransaction::create([
        'financial_account_id' => $account->id,
        'financial_category_id' => $expCat->id,
        'type' => FinancialTransactionType::Out,
        'amount' => 400000,
        'balance_before' => 5000000,
        'balance_after' => 4600000,
        'transaction_date' => $today->toDateString(),
        'description' => 'Bayar listrik',
        'created_by' => $admin->id,
    ]);

    $supplier = Supplier::create([
        'code' => 'SUP-AG-1',
        'name' => 'PT Distributor Utama',
        'phone' => '08123456789',
        'is_active' => true,
    ]);

    $makePayable = function (string $poNum, float $remaining, CarbonImmutable $dueDate, PaymentStatus $status) use ($supplier, $admin): void {
        $po = PurchaseOrder::create([
            'po_number' => $poNum,
            'supplier_id' => $supplier->id,
            'user_id' => $admin->id,
            'order_date' => now()->subDays(120)->toDateString(),
            'status' => PurchaseOrderStatus::Approved,
            'receiving_status' => ReceivingStatus::Received,
            'payment_status' => $status,
            'subtotal' => $remaining > 0 ? $remaining : 500000,
            'total_amount' => $remaining > 0 ? $remaining : 500000,
        ]);

        AccountPayable::create([
            'purchase_order_id' => $po->id,
            'supplier_id' => $supplier->id,
            'total_amount' => $remaining > 0 ? $remaining : 500000,
            'paid_amount' => $status === PaymentStatus::Paid ? 500000 : 0,
            'remaining_amount' => $remaining,
            'due_date' => $dueDate->toDateString(),
            'status' => $status,
        ]);
    };

    $makePayable('PO-AG-CUR', 100000, $today->addDays(5), PaymentStatus::Unpaid);
    $makePayable('PO-AG-15', 200000, $today->subDays(15), PaymentStatus::Unpaid);
    $makePayable('PO-AG-45', 300000, $today->subDays(45), PaymentStatus::Partial);
    $makePayable('PO-AG-75', 400000, $today->subDays(75), PaymentStatus::Unpaid);
    $makePayable('PO-AG-100', 500000, $today->subDays(100), PaymentStatus::Unpaid);
    $makePayable('PO-AG-PAID', 0, $today->subDays(120), PaymentStatus::Paid); // harus dikecualikan

    /** @var FinanceReportService $service */
    $service = app(FinanceReportService::class);
    $report = $service->getReportData([
        'preset' => 'custom',
        'start_date' => $today->subDay()->toDateString(),
        'end_date' => $today->toDateString(),
    ], false);

    expect($report['summary']['total_income'])->toBe(1500000.0)
        ->and($report['summary']['total_expense'])->toBe(400000.0)
        ->and($report['summary']['net_cashflow'])->toBe(1100000.0)
        ->and($report['summary']['total_ap_remaining'])->toBe(1500000.0)
        ->and($report['summary']['total_overdue_amount'])->toBe(1400000.0)
        ->and($report['summary']['overdue_count'])->toBe(4);

    $buckets = collect($report['agingBuckets'])->keyBy('key');
    expect($buckets['current']['amount'])->toBe(100000.0)
        ->and($buckets['1_30']['amount'])->toBe(200000.0)
        ->and($buckets['31_60']['amount'])->toBe(300000.0)
        ->and($buckets['61_90']['amount'])->toBe(400000.0)
        ->and($buckets['over_90']['amount'])->toBe(500000.0);
});

// =========================================================================
// 5. EKSPOR CSV & PDF (BOM, FORMULA INJECTION, CONTENT-TYPE)
// =========================================================================
test('csv exports include utf8 bom, sanitize formula injection, and pdf exports return application/pdf', function (): void {
    $admin = createReportUser(UserRoles::Admin, 'Admin Export');
    $account = createReportAccount('KAS-EXP-1', 'Kas Export');
    $cat = createReportCategory('Kategori Uji');
    $evilProduct = createReportProduct($cat, '=SUM(A1:A5) Produk Bahaya', 5000, 10000, 10);

    createReportSale($admin, $account, $evilProduct, 2, 10000, 5000);

    // Uji CSV Export (Sales)
    $csvResponse = $this->actingAs($admin)->get(route('pos.reports.sales.export.csv'));
    $csvResponse->assertOk();
    expect($csvResponse->headers->get('content-type'))->toContain('text/csv');

    $content = $csvResponse->streamedContent();
    expect(str_starts_with($content, "\xEF\xBB\xBF"))->toBeTrue()
        ->and($content)->toContain("'=SUM(A1:A5) Produk Bahaya")
        ->and($content)->not->toContain(',=SUM(');

    // Uji CSV Export lainnya
    $this->actingAs($admin)->get(route('pos.reports.profit-loss.export.csv'))->assertOk();
    $this->actingAs($admin)->get(route('pos.reports.stock-valuation.export.csv'))->assertOk();
    $this->actingAs($admin)->get(route('pos.reports.finance-aging.export.csv'))->assertOk();

    // Uji 4 PDF Export
    foreach ([
        'pos.reports.sales.export.pdf',
        'pos.reports.profit-loss.export.pdf',
        'pos.reports.stock-valuation.export.pdf',
        'pos.reports.finance-aging.export.pdf',
    ] as $routeName) {
        $pdfResp = $this->actingAs($admin)->get(route($routeName));
        $pdfResp->assertOk();
        expect($pdfResp->headers->get('content-type'))->toContain('application/pdf');
    }
});

// =========================================================================
// 6. OTORISASI ROLE (ADMIN, SUPERVISOR, WAREHOUSE, CASHIER)
// =========================================================================
test('role authorization matrix is strictly enforced on all report pages and exports', function (): void {
    $admin = createReportUser(UserRoles::Admin, 'Admin');
    $supervisor = createReportUser(UserRoles::Supervisor, 'Supervisor');
    $warehouse = createReportUser(UserRoles::Warehouse, 'Warehouse');
    $cashier = createReportUser(UserRoles::Cashier, 'Cashier');

    $allRoutes = [
        'sales' => ['pos.reports.sales', 'pos.reports.sales.export.csv', 'pos.reports.sales.export.pdf'],
        'profit-loss' => ['pos.reports.profit-loss', 'pos.reports.profit-loss.export.csv', 'pos.reports.profit-loss.export.pdf'],
        'stock' => ['pos.reports.stock-valuation', 'pos.reports.stock-valuation.export.csv', 'pos.reports.stock-valuation.export.pdf'],
        'finance' => ['pos.reports.finance-aging', 'pos.reports.finance-aging.export.csv', 'pos.reports.finance-aging.export.pdf'],
    ];

    // Cashier: 403 pada SEMUA laporan & ekspor
    foreach ($allRoutes as $group) {
        foreach ($group as $routeName) {
            $this->actingAs($cashier)->get(route($routeName))->assertForbidden();
        }
    }

    // Warehouse: hanya boleh Valuasi Stok; 403 pada Penjualan, Laba Kotor, Keuangan
    foreach (['sales', 'profit-loss', 'finance'] as $forbiddenGroup) {
        foreach ($allRoutes[$forbiddenGroup] as $routeName) {
            $this->actingAs($warehouse)->get(route($routeName))->assertForbidden();
        }
    }
    $this->actingAs($warehouse)->get(route('pos.reports.stock-valuation'))->assertOk();
    $this->actingAs($warehouse)->get(route('pos.reports.stock-valuation.export.csv'))->assertOk();

    // Supervisor: boleh Penjualan & Valuasi Stok; 403 pada Laba Kotor & Keuangan
    foreach (['profit-loss', 'finance'] as $forbiddenGroup) {
        foreach ($allRoutes[$forbiddenGroup] as $routeName) {
            $this->actingAs($supervisor)->get(route($routeName))->assertForbidden();
        }
    }
    $this->actingAs($supervisor)->get(route('pos.reports.sales'))->assertOk();
    $this->actingAs($supervisor)->get(route('pos.reports.stock-valuation'))->assertOk();

    // Admin: akses penuh ke 4 halaman laporan
    foreach (['pos.reports.sales', 'pos.reports.profit-loss', 'pos.reports.stock-valuation', 'pos.reports.finance-aging'] as $routeName) {
        $this->actingAs($admin)->get(route($routeName))->assertOk();
    }
});

test('sales report cashier search and initial options exclude warehouse users', function (): void {
    $admin = createReportUser(UserRoles::Admin, 'Admin Report');
    $supervisor = createReportUser(UserRoles::Supervisor, 'Supervisor Report');
    $cashier = createReportUser(UserRoles::Cashier, 'Kasir Report');
    $warehouse = createReportUser(UserRoles::Warehouse, 'Gudang Report');

    $searchResponse = $this->actingAs($admin)
        ->getJson(route('pos.reports.cashiers.search', ['search' => 'Report']));

    $searchResponse->assertOk();

    $returnedIds = collect($searchResponse->json())->pluck('value')->all();

    expect($returnedIds)
        ->toContain($admin->id, $supervisor->id, $cashier->id)
        ->not->toContain($warehouse->id);

    $salesResponse = $this->actingAs($admin)
        ->get(route('pos.reports.sales'));

    $salesResponse->assertOk()
        ->assertInertia(fn ($page) => $page
            ->where('options.cashiers', function ($cashiers) use ($admin, $supervisor, $cashier, $warehouse): bool {
                $ids = collect($cashiers)->pluck('id')->all();

                return in_array($admin->id, $ids, true)
                    && in_array($supervisor->id, $ids, true)
                    && in_array($cashier->id, $ids, true)
                    && ! in_array($warehouse->id, $ids, true);
            })
        );
});

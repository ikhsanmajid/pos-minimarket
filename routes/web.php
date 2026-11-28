<?php

use App\Http\Controllers\AccountPayableController;
use App\Http\Controllers\ActivityLogController;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\CashRegisterController;
use App\Http\Controllers\CashierShiftController;
use App\Http\Controllers\CategoryController;
use App\Http\Controllers\CustomerController;
use App\Http\Controllers\FinancialAccountController;
use App\Http\Controllers\FinancialCategoryController;
use App\Http\Controllers\FinancialTransactionController;
use App\Http\Controllers\HomeController;
use App\Http\Controllers\PosController;
use App\Http\Controllers\ProductController;
use App\Http\Controllers\ProductMemberPriceController;
use App\Http\Controllers\ProductPriceTierController;
use App\Http\Controllers\ProfileController;
use App\Http\Controllers\PromotionController;
use App\Http\Controllers\PurchaseOrderController;
use App\Http\Controllers\Reports\ReportController;
use App\Http\Controllers\SalesReturnController;
use App\Http\Controllers\StockAdjustmentController;
use App\Http\Controllers\StockOpnameController;
use App\Http\Controllers\StoreSettingController;
use App\Http\Controllers\SupplierController;
use App\Http\Controllers\SupplierPromoClaimController;
use App\Http\Controllers\TransactionController;
use App\Http\Controllers\UserController;
use App\Http\Controllers\VoucherController;
use Illuminate\Support\Facades\Route;

Route::middleware('guest')->group(function () {
    Route::redirect('/', '/login');
    Route::get('/login', [AuthController::class, 'index'])->name('login');
    Route::post('/login', [AuthController::class, 'store'])->middleware('throttle:20,1');
});

Route::middleware('auth')->group(function () {
    Route::redirect('/', '/pos/dashboard');

    // Logout
    Route::post('/logout', [AuthController::class, 'destroy'])->name('logout');

    Route::prefix('/pos')->name('pos.')->group(function () {
        Route::redirect('/', '/pos/dashboard');

        // Dashboard
        Route::get('/dashboard', [HomeController::class, 'index'])->name('dashboard.index');

        // Kasir POS Terminal (wajib shift terbuka)
        Route::prefix('/cashier')->name('cashier.')->middleware('shift.open')->group(function () {
            Route::get('/', [PosController::class, 'index'])->name('index');
            Route::get('/lookup', [PosController::class, 'lookup'])->name('lookup');
            Route::post('/calculate-cart', [PosController::class, 'calculateCart'])->name('calculate-cart');
            Route::post('/voucher/validate', [PosController::class, 'validateVoucher'])->name('voucher.validate');
            Route::post('/voucher/reserve', [PosController::class, 'reserveVoucher'])->name('voucher.reserve');
            Route::post('/voucher/release', [PosController::class, 'releaseVoucher'])->name('voucher.release');
            Route::get('/check-promo', [PosController::class, 'checkProductPromo'])->name('check-promo');
            Route::post('/checkout', [PosController::class, 'checkout'])->name('checkout');
            Route::post('/hold', [PosController::class, 'hold'])->name('hold');
            Route::get('/held', [PosController::class, 'heldList'])->name('held.index');
            Route::delete('/held/{heldTransaction}', [PosController::class, 'deleteHeld'])->name('held.destroy');
        });

        // Riwayat Transaksi, Void & Retur Penjualan
        Route::prefix('/transactions')->name('transactions.')->group(function () {
            Route::get('/', [TransactionController::class, 'index'])->name('index');
            Route::get('/{transaction}', [TransactionController::class, 'show'])->name('show');
            Route::get('/{transaction}/receipt', [TransactionController::class, 'receipt'])->name('receipt');
            Route::post('/{transaction}/void', [TransactionController::class, 'void'])->name('void');
            Route::post('/{transaction}/returns', [SalesReturnController::class, 'store'])->name('returns.store');
        });

        Route::prefix('/shifts')->name('shifts.')->group(function () {
            Route::get('/', [CashierShiftController::class, 'index'])->name('index');
            Route::get('/history', [CashierShiftController::class, 'history'])->name('history');
            Route::post('/open', [CashierShiftController::class, 'open'])->name('open');
            Route::get('/{cashierShift}', [CashierShiftController::class, 'show'])->name('show');
            Route::post('/{cashierShift}/movements', [CashierShiftController::class, 'storeMovement'])->name('movements.store');
            Route::post('/{cashierShift}/close', [CashierShiftController::class, 'close'])->name('close');
        });

        // Daftar Kasir Fisik (Mesin Kasir)
        Route::resource('cash-registers', CashRegisterController::class)->only(['index', 'store', 'update', 'destroy']);

        // Product
        Route::prefix('/products')->name('products.')->group(function () {
            Route::get('/', [ProductController::class, 'index'])->name('index');
            Route::get('/search', [ProductController::class, 'search'])->name('search');
            Route::get('/create', [ProductController::class, 'create'])->name('create');
            Route::post('/create', [ProductController::class, 'store'])->name('store');
            Route::get('/{product}', [ProductController::class, 'show'])->name('show');
            Route::get('/{product}/edit', [ProductController::class, 'edit'])->name('edit');
            Route::match(['post', 'patch'], '/{product}', [ProductController::class, 'update'])->name('update');
            Route::delete('/{product}', [ProductController::class, 'destroy'])->name('destroy');
            Route::post('/{product}/price-tiers', [ProductPriceTierController::class, 'store'])->name('price-tiers.store');
            Route::patch('/{product}/price-tiers/{priceTier}', [ProductPriceTierController::class, 'update'])->name('price-tiers.update');
            Route::delete('/{product}/price-tiers/{priceTier}', [ProductPriceTierController::class, 'destroy'])->name('price-tiers.destroy');
            Route::post('/{product}/member-prices', [ProductMemberPriceController::class, 'store'])->name('member-prices.store');
            Route::patch('/{product}/member-prices/{memberPrice}', [ProductMemberPriceController::class, 'update'])->name('member-prices.update');
            Route::delete('/{product}/member-prices/{memberPrice}', [ProductMemberPriceController::class, 'destroy'])->name('member-prices.destroy');
        });

        // Promo & Diskon
        Route::get('/promotions/exclusive-groups', [PromotionController::class, 'searchExclusiveGroups'])->name('promotions.exclusive-groups');
        Route::resource('promotions', PromotionController::class)->only(['index', 'store', 'update', 'destroy']);

        // Voucher / Kode Promo
        Route::get('/vouchers/generate-code', [VoucherController::class, 'generateCode'])->name('vouchers.generate-code');
        Route::post('/vouchers/bulk', [VoucherController::class, 'generateBulk'])->name('vouchers.bulk');
        Route::resource('vouchers', VoucherController::class)->only(['index', 'store', 'update', 'destroy']);

        // Categories
        Route::get('/categories/search', [CategoryController::class, 'search'])->name('categories.search');
        Route::resource('categories', CategoryController::class)->only(['index', 'store', 'update', 'destroy']);

        // Inventaris: Stock Adjustment & Stock Opname
        Route::prefix('/inventory')->name('inventory.')->group(function () {
            Route::prefix('/stock-adjustments')->name('adjustments.')->group(function () {
                Route::get('/', [StockAdjustmentController::class, 'index'])->name('index');
                Route::post('/', [StockAdjustmentController::class, 'store'])->name('store');
                Route::post('/{stockAdjustment}/approve', [StockAdjustmentController::class, 'approve'])->name('approve');
                Route::post('/{stockAdjustment}/reject', [StockAdjustmentController::class, 'reject'])->name('reject');
            });

            Route::prefix('/stock-opnames')->name('opnames.')->group(function () {
                Route::get('/', [StockOpnameController::class, 'index'])->name('index');
                Route::post('/', [StockOpnameController::class, 'store'])->name('store');
                Route::get('/{stockOpname}', [StockOpnameController::class, 'show'])->name('show');
                Route::patch('/{stockOpname}/counts', [StockOpnameController::class, 'updateCounts'])->name('counts.update');
                Route::get('/{stockOpname}/lookup-barcode', [StockOpnameController::class, 'lookupBarcode'])->name('lookup-barcode');
                Route::post('/{stockOpname}/finalize', [StockOpnameController::class, 'finalize'])->name('finalize');
                Route::post('/{stockOpname}/cancel', [StockOpnameController::class, 'cancel'])->name('cancel');
                Route::get('/{stockOpname}/pdf', [StockOpnameController::class, 'downloadPdf'])->name('pdf');
            });
        });

        // Pelanggan / Member (Customer)
        Route::get('/customers/search', [CustomerController::class, 'search'])->name('customers.search');
        Route::resource('customers', CustomerController::class)->only(['index', 'show', 'store', 'update', 'destroy']);

        // Suppliers
        Route::get('/suppliers/search', [SupplierController::class, 'search'])->name('suppliers.search');
        Route::resource('suppliers', SupplierController::class)->only(['index', 'show', 'store', 'update', 'destroy']);

        // Purchase Orders
        Route::prefix('/purchase-orders')->name('purchase-orders.')->group(function () {
            Route::get('/', [PurchaseOrderController::class, 'index'])->name('index');
            Route::get('/create', [PurchaseOrderController::class, 'create'])->name('create');
            Route::post('/', [PurchaseOrderController::class, 'store'])->name('store');
            Route::get('/{purchaseOrder}', [PurchaseOrderController::class, 'show'])->name('show');
            Route::get('/{purchaseOrder}/pdf', [PurchaseOrderController::class, 'downloadPdf'])->name('pdf');
            Route::get('/{purchaseOrder}/receipts/{receipt}/pdf', [PurchaseOrderController::class, 'downloadReceiptPdf'])->name('receipt-pdf');
            Route::get('/{purchaseOrder}/edit', [PurchaseOrderController::class, 'edit'])->name('edit');
            Route::match(['post', 'patch'], '/{purchaseOrder}', [PurchaseOrderController::class, 'update'])->name('update');
            Route::delete('/{purchaseOrder}', [PurchaseOrderController::class, 'destroy'])->name('destroy');
            Route::post('/{purchaseOrder}/submit', [PurchaseOrderController::class, 'submit'])->name('submit');
            Route::post('/{purchaseOrder}/approve', [PurchaseOrderController::class, 'approve'])->name('approve');
            Route::post('/{purchaseOrder}/reject', [PurchaseOrderController::class, 'reject'])->name('reject');
            Route::post('/{purchaseOrder}/revise', [PurchaseOrderController::class, 'revise'])->name('revise');
            Route::post('/{purchaseOrder}/receive', [PurchaseOrderController::class, 'receive'])->name('receive');
            Route::post('/{purchaseOrder}/payments', [PurchaseOrderController::class, 'recordPayment'])->name('payments.store');
            Route::post('/{purchaseOrder}/close-remaining', [PurchaseOrderController::class, 'closeRemaining'])->name('close-remaining');
            Route::post('/{purchaseOrder}/cancel', [PurchaseOrderController::class, 'cancel'])->name('cancel');
        });

        // Keuangan (Fondasi Finance)
        Route::prefix('/finance')->name('finance.')->group(function () {
            Route::prefix('/accounts')->name('accounts.')->group(function () {
                Route::get('/', [FinancialAccountController::class, 'index'])->name('index');
                Route::post('/', [FinancialAccountController::class, 'store'])->name('store');
                Route::patch('/{financialAccount}', [FinancialAccountController::class, 'update'])->name('update');
                Route::delete('/{financialAccount}', [FinancialAccountController::class, 'destroy'])->name('destroy');
            });

            Route::prefix('/categories')->name('categories.')->group(function () {
                Route::get('/', [FinancialCategoryController::class, 'index'])->name('index');
                Route::post('/', [FinancialCategoryController::class, 'store'])->name('store');
                Route::patch('/{financialCategory}', [FinancialCategoryController::class, 'update'])->name('update');
                Route::delete('/{financialCategory}', [FinancialCategoryController::class, 'destroy'])->name('destroy');
            });

            Route::prefix('/payables')->name('payables.')->group(function () {
                Route::get('/', [AccountPayableController::class, 'index'])->name('index');
                Route::post('/{accountPayable}/payments', [AccountPayableController::class, 'recordPayment'])->name('payments.store');
            });

            Route::prefix('/supplier-claims')->name('supplier-claims.')->group(function () {
                Route::get('/', [SupplierPromoClaimController::class, 'index'])->name('index');
                Route::post('/settle', [SupplierPromoClaimController::class, 'settle'])->name('settle');
            });

            Route::prefix('/transactions')->name('transactions.')->group(function () {
                Route::get('/', [FinancialTransactionController::class, 'index'])->name('index');
                Route::post('/', [FinancialTransactionController::class, 'store'])->name('store');
            });
        });

        // Laporan Bisnis & Ekspor (CSV / PDF)
        Route::prefix('/reports')->name('reports.')->group(function () {
            Route::get('/cashiers/search', [ReportController::class, 'searchCashiers'])->name('cashiers.search');

            Route::get('/sales', [ReportController::class, 'sales'])->name('sales');
            Route::get('/sales/export/csv', [ReportController::class, 'exportSalesCsv'])->name('sales.export.csv');
            Route::get('/sales/export/pdf', [ReportController::class, 'exportSalesPdf'])->name('sales.export.pdf');

            Route::get('/profit-loss', [ReportController::class, 'profitLoss'])->name('profit-loss');
            Route::get('/profit-loss/export/csv', [ReportController::class, 'exportProfitLossCsv'])->name('profit-loss.export.csv');
            Route::get('/profit-loss/export/pdf', [ReportController::class, 'exportProfitLossPdf'])->name('profit-loss.export.pdf');

            Route::get('/stock-valuation', [ReportController::class, 'stockValuation'])->name('stock-valuation');
            Route::get('/stock-valuation/export/csv', [ReportController::class, 'exportStockCsv'])->name('stock-valuation.export.csv');
            Route::get('/stock-valuation/export/pdf', [ReportController::class, 'exportStockPdf'])->name('stock-valuation.export.pdf');

            Route::get('/finance-aging', [ReportController::class, 'financeAging'])->name('finance-aging');
            Route::get('/finance-aging/export/csv', [ReportController::class, 'exportFinanceCsv'])->name('finance-aging.export.csv');
            Route::get('/finance-aging/export/pdf', [ReportController::class, 'exportFinancePdf'])->name('finance-aging.export.pdf');
        });

        // Manajemen Users
        Route::prefix('/users')->name('users.')->group(function () {
            Route::get('/', [UserController::class, 'index'])->name('index');
            Route::post('/', [UserController::class, 'store'])->name('store');
            Route::get('/{user}', [UserController::class, 'show'])->name('show');
            Route::get('/{user}/edit', [UserController::class, 'edit'])->name('edit');
            Route::patch('/{user}', [UserController::class, 'update'])->name('update');
            Route::delete('/{user}', [UserController::class, 'destroy'])->name('destroy');
        });

        // Profil Saya
        Route::get('/profile', [ProfileController::class, 'edit'])->name('profile.edit');
        Route::patch('/profile', [ProfileController::class, 'update'])->name('profile.update');

        // Log Aktivitas
        Route::get('/activity-logs', [ActivityLogController::class, 'index'])->name('activity-logs.index');

        // Pengaturan Toko
        Route::prefix('/settings')->name('settings.')->group(function () {
            Route::get('/', [StoreSettingController::class, 'edit'])->name('edit');
            Route::match(['post', 'put'], '/', [StoreSettingController::class, 'update'])->name('update');
        });
    });
});

// Fallback route to serve public storage files when symlinks cannot be created (e.g. Windows without admin privileges)
Route::get('/storage/{path}', function (string $path) {
    $filePath = storage_path('app/public/'.$path);

    abort_unless(file_exists($filePath), 404);

    return response()->file($filePath);
})->where('path', '.*');

<?php

use App\Http\Controllers\AccountPayableController;
use App\Http\Controllers\ActivityLogController;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\CashierShiftController;
use App\Http\Controllers\CategoryController;
use App\Http\Controllers\FinancialAccountController;
use App\Http\Controllers\FinancialTransactionController;
use App\Http\Controllers\HomeController;
use App\Http\Controllers\PosController;
use App\Http\Controllers\ProductController;
use App\Http\Controllers\ProfileController;
use App\Http\Controllers\PurchaseOrderController;
use App\Http\Controllers\SalesReturnController;
use App\Http\Controllers\StoreSettingController;
use App\Http\Controllers\SupplierController;
use App\Http\Controllers\TransactionController;
use App\Http\Controllers\UserController;
use Illuminate\Support\Facades\Route;

Route::middleware('guest')->group(function () {
    Route::redirect('/', '/login');
    Route::get('/login', [AuthController::class, 'index'])->name('login');
    Route::post('/login', [AuthController::class, 'store'])->middleware('throttle:5,1');
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
        });

        // Categories
        Route::get('/categories/search', [CategoryController::class, 'search'])->name('categories.search');
        Route::resource('categories', CategoryController::class)->only(['index', 'store', 'update', 'destroy']);

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

            Route::prefix('/payables')->name('payables.')->group(function () {
                Route::get('/', [AccountPayableController::class, 'index'])->name('index');
                Route::post('/{accountPayable}/payments', [AccountPayableController::class, 'recordPayment'])->name('payments.store');
            });

            Route::get('/transactions', [FinancialTransactionController::class, 'index'])->name('transactions.index');
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

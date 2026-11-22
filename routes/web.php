<?php

use App\Http\Controllers\ActivityLogController;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\CategoryController;
use App\Http\Controllers\HomeController;
use App\Http\Controllers\ProductController;
use App\Http\Controllers\ProfileController;
use App\Http\Controllers\PurchaseOrderController;
use App\Http\Controllers\SupplierController;
use App\Http\Controllers\UserController;
use App\Models\Product;
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

    Route::prefix('/pos')->name('pos.')->group(function () { // pos
        Route::redirect('/', '/pos/dashboard');

        // Dashboard
        Route::get('/dashboard', [HomeController::class, 'index'])->name('dashboard.index'); // pos.dashboard.index

        // Product
        Route::prefix('/products')->name('products.')->group(function () {
            Route::get('/', [ProductController::class, 'index'])->name('index'); // pos.products.index
            Route::get('/search', [ProductController::class, 'search'])->name('search'); // pos.products.search
            Route::get('/create', [ProductController::class, 'create'])->name('create'); // pos.products.create
            Route::post('/create', [ProductController::class, 'store'])->name('store'); // pos.products.store
            Route::get('/{product}', [ProductController::class, 'show'])->name('show'); // pos.products.show
            Route::get('/{product}/edit', [ProductController::class, 'edit'])->name('edit'); // pos.products.edit
            Route::match(['post', 'patch'], '/{product}', [ProductController::class, 'update'])->name('update'); // pos.products.update
            Route::delete('/{product}', [ProductController::class, 'destroy'])->name('destroy'); // pos.products.destroy
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
            Route::get('/{purchaseOrder}/edit', [PurchaseOrderController::class, 'edit'])->name('edit');
            Route::match(['post', 'patch'], '/{purchaseOrder}', [PurchaseOrderController::class, 'update'])->name('update');
            Route::delete('/{purchaseOrder}', [PurchaseOrderController::class, 'destroy'])->name('destroy');
            Route::post('/{purchaseOrder}/receive', [PurchaseOrderController::class, 'receive'])->name('receive');
            Route::post('/{purchaseOrder}/mark-ordered', [PurchaseOrderController::class, 'markOrdered'])->name('mark-ordered');
            Route::post('/{purchaseOrder}/close-remaining', [PurchaseOrderController::class, 'closeRemaining'])->name('close-remaining');
            Route::patch('/{purchaseOrder}/payment-status', [PurchaseOrderController::class, 'updatePaymentStatus'])->name('payment-status');
            Route::post('/{purchaseOrder}/cancel', [PurchaseOrderController::class, 'cancel'])->name('cancel');
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

    });

});

// Fallback route to serve public storage files when symlinks cannot be created (e.g. Windows without admin privileges)
Route::get('/storage/{path}', function (string $path) {
    $filePath = storage_path('app/public/'.$path);

    abort_unless(file_exists($filePath), 404);

    return response()->file($filePath);
})->where('path', '.*');

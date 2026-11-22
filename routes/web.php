<?php

use App\Http\Controllers\AuthController;
use App\Http\Controllers\CategoryController;
use App\Http\Controllers\HomeController;
use App\Http\Controllers\ProductController;
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

        // Manajemen Users
        Route::prefix('/users')->name('users.')->group(function () {
            Route::get('/', [UserController::class, 'index'])->name('index');
            Route::post('/', [UserController::class, 'store'])->name('store');
            Route::get('/{user}', [UserController::class, 'show'])->name('show');
            Route::get('/{user}/edit', [UserController::class, 'edit'])->name('edit');
            Route::patch('/{user}', [UserController::class, 'update'])->name('update');
            Route::delete('/{user}', [UserController::class, 'destroy'])->name('destroy');
        });

    });

});

// Fallback route to serve public storage files when symlinks cannot be created (e.g. Windows without admin privileges)
Route::get('/storage/{path}', function (string $path) {
    $filePath = storage_path('app/public/'.$path);

    abort_unless(file_exists($filePath), 404);

    return response()->file($filePath);
})->where('path', '.*');

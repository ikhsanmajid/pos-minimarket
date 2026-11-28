<?php

use App\Enums\ActivityLogCategory;
use App\Enums\UserRoles;
use App\Models\Category;
use App\Models\Product;
use App\Models\User;
use Inertia\Testing\AssertableInertia as Assert;
use Spatie\Activitylog\Models\Activity;

it('does not record product activity log when only stock changes', function () {
    $admin = User::factory()->create(['role' => UserRoles::Admin]);
    $category = Category::create([
        'name' => 'Minuman',
        'slug' => 'minuman',
        'code' => 'MIN',
        'is_active' => true,
    ]);

    $this->actingAs($admin);

    $product = Product::create([
        'category_id' => $category->id,
        'barcode' => 'PRD-STK-001',
        'name' => 'Air Mineral 600ml',
        'buy_price' => 2500,
        'sell_price' => 3500,
        'stock' => 50,
        'min_stock' => 10,
        'active' => true,
    ]);

    expect(Activity::forSubject($product)->count())->toBe(1);

    // Simulasi perubahan stok akibat penjualan / mutasi stok
    $product->update(['stock' => 45]);
    $product->decrement('stock', 2);
    $product->increment('stock', 10);

    expect(Activity::forSubject($product)->count())->toBe(1);

    // Perubahan informasi produk tetap tercatat tanpa atribut stock
    $product->update([
        'name' => 'Air Mineral 600ml Botol',
        'sell_price' => 4000,
    ]);

    expect(Activity::forSubject($product)->count())->toBe(2);

    $latest = Activity::forSubject($product)->latest('id')->first();
    expect($latest?->event)->toBe('updated');
    expect($latest?->attribute_changes?->toArray()['attributes'] ?? [])
        ->toHaveKeys(['name', 'sell_price'])
        ->not->toHaveKey('stock');
});

it('excludes historical stock-only updates and strips stock attribute from product history response', function () {
    $admin = User::factory()->create(['role' => UserRoles::Admin]);
    $category = Category::create([
        'name' => 'Makanan',
        'slug' => 'makanan',
        'code' => 'MKN',
        'is_active' => true,
    ]);

    $this->actingAs($admin);

    $product = Product::create([
        'category_id' => $category->id,
        'barcode' => 'PRD-HIS-001',
        'name' => 'Indomie Goreng',
        'buy_price' => 3000,
        'sell_price' => 3500,
        'stock' => 100,
        'min_stock' => 10,
        'active' => true,
    ]);

    // Simulasi log historis lama: update hanya stock (harus disembunyikan)
    $stockOnlyLog = Activity::create([
        'log_name' => ActivityLogCategory::Product->value,
        'description' => "Produk {$product->name} diperbarui.",
        'subject_type' => Product::class,
        'subject_id' => $product->id,
        'event' => 'updated',
        'causer_type' => User::class,
        'causer_id' => $admin->id,
        'attribute_changes' => [
            'attributes' => ['stock' => 95],
            'old' => ['stock' => 100],
        ],
        'properties' => [],
    ]);

    // Simulasi log historis lama: update buy_price + stock (tetap tampil, namun stock dihapus dari payload)
    $mixedLog = Activity::create([
        'log_name' => ActivityLogCategory::Product->value,
        'description' => "Produk {$product->name} diperbarui.",
        'subject_type' => Product::class,
        'subject_id' => $product->id,
        'event' => 'updated',
        'causer_type' => User::class,
        'causer_id' => $admin->id,
        'attribute_changes' => [
            'attributes' => ['buy_price' => '3100.00', 'stock' => 120],
            'old' => ['buy_price' => '3000.00', 'stock' => 95],
        ],
        'properties' => [],
    ]);

    $this->actingAs($admin)
        ->get(route('pos.products.show', $product))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('POS/Product/DetailProduct')
            ->reloadOnly('activities', fn (Assert $reload) => $reload
                ->where('activities.total', 2)
                ->has('activities.data', 2)
                ->where('activities.data.0.id', $mixedLog->id)
                ->has('activities.data.0.attribute_changes.attributes.buy_price')
                ->missing('activities.data.0.attribute_changes.attributes.stock')
                ->missing('activities.data.0.attribute_changes.old.stock')
                ->where('activities.data.1.event', 'created')
                ->missing('activities.data.1.attribute_changes.attributes.stock')
            )
        );

    expect($stockOnlyLog->id)->not->toBe($mixedLog->id);
});

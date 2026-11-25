<?php

use App\Enums\UserRoles;
use App\Models\Category;
use App\Models\Product;
use App\Models\ProductUnit;
use App\Models\User;

function createCategory(): Category
{
    return Category::create([
        'name' => 'Makanan & Minuman',
        'slug' => 'makanan-minuman-'.uniqid(),
        'code' => 'CAT-'.random_int(100, 999),
        'is_active' => true,
    ]);
}

it('creates a product with base_unit and multiple conversion units keeping only one default purchase unit', function () {
    $admin = User::factory()->create(['role' => UserRoles::Admin]);
    $category = createCategory();

    $response = $this->actingAs($admin)->post(route('pos.products.store'), [
        'category_id' => $category->id,
        'barcode' => '8990001112223',
        'name' => 'Indomie Goreng 85g',
        'base_unit' => 'bungkus',
        'buy_price' => 2800,
        'sell_price' => 3500,
        'stock' => 50,
        'min_stock' => 10,
        'active' => true,
        'units' => [
            [
                'unit_name' => 'Dus',
                'conversion_factor' => 40,
                'barcode' => '8990001112224',
                'buy_price' => 108000,
                'sell_price' => 125000,
                'is_default_purchase' => true,
                'is_active' => true,
            ],
            [
                'unit_name' => 'Pack',
                'conversion_factor' => 5,
                'barcode' => '',
                'buy_price' => 14000,
                'sell_price' => '',
                'is_default_purchase' => true,
                'is_active' => true,
            ],
        ],
    ]);

    $response->assertRedirect(route('pos.products.index'));

    $product = Product::with('units')->where('barcode', '8990001112223')->firstOrFail();
    expect($product->base_unit)->toBe('bungkus');
    expect($product->units)->toHaveCount(2);
    expect($product->units->where('is_default_purchase', true))->toHaveCount(1);

    $dus = $product->units->firstWhere('unit_name', 'Dus');
    expect($dus->conversion_factor)->toBe(40)
        ->and((float) $dus->buy_price)->toBe(108000.0)
        ->and((float) $dus->sell_price)->toBe(125000.0);
});

it('updates and removes product conversion units cleanly', function () {
    $warehouse = User::factory()->create(['role' => UserRoles::Warehouse]);
    $category = createCategory();

    $product = Product::create([
        'category_id' => $category->id,
        'barcode' => '8991112223334',
        'name' => 'Aqua Botol 600ml',
        'base_unit' => 'botol',
        'buy_price' => 2500,
        'sell_price' => 3500,
        'stock' => 24,
        'min_stock' => 12,
        'active' => true,
    ]);

    $unit = ProductUnit::create([
        'product_id' => $product->id,
        'unit_name' => 'Karton',
        'conversion_factor' => 24,
        'buy_price' => 55000,
        'is_default_purchase' => true,
        'is_active' => true,
    ]);

    // Update existing unit and add a new one
    $this->actingAs($warehouse)
        ->patch(route('pos.products.update', $product), [
            'category_id' => $category->id,
            'barcode' => $product->barcode,
            'name' => $product->name,
            'base_unit' => 'botol',
            'buy_price' => 2500,
            'sell_price' => 3500,
            'stock' => 999, // harus diabaikan agar stok tidak ter-override
            'min_stock' => 12,
            'active' => true,
            'units_present' => true,
            'units' => [
                [
                    'id' => $unit->id,
                    'unit_name' => 'Karton',
                    'conversion_factor' => 24,
                    'buy_price' => 56000,
                    'is_default_purchase' => true,
                    'is_active' => true,
                ],
                [
                    'unit_name' => 'Pack',
                    'conversion_factor' => 6,
                    'buy_price' => 14500,
                    'is_default_purchase' => false,
                    'is_active' => true,
                ],
            ],
        ])
        ->assertRedirect(route('pos.products.index'));

    $product->refresh()->load('units');
    expect($product->stock)->toBe(24)
        ->and($product->units)->toHaveCount(2);

    // Clear all conversion units
    $this->actingAs($warehouse)
        ->patch(route('pos.products.update', $product), [
            'category_id' => $category->id,
            'barcode' => $product->barcode,
            'name' => $product->name,
            'base_unit' => 'botol',
            'buy_price' => 2500,
            'sell_price' => 3500,
            'stock' => 24,
            'min_stock' => 12,
            'active' => true,
            'units_present' => true,
            'units' => [],
        ])
        ->assertRedirect(route('pos.products.index'));

    expect($product->units()->count())->toBe(0);
});

it('rejects unit names matching base_unit and duplicate barcodes', function () {
    $admin = User::factory()->create(['role' => UserRoles::Admin]);
    $category = createCategory();

    $response = $this->actingAs($admin)->post(route('pos.products.store'), [
        'category_id' => $category->id,
        'barcode' => '8995556667778',
        'name' => 'Teh Botol 350ml',
        'base_unit' => 'botol',
        'buy_price' => 3000,
        'sell_price' => 4500,
        'stock' => 10,
        'min_stock' => 5,
        'active' => true,
        'units' => [
            [
                'unit_name' => 'Botol',
                'conversion_factor' => 12,
                'barcode' => '8995556667778',
                'buy_price' => 35000,
                'is_default_purchase' => false,
                'is_active' => true,
            ],
        ],
    ]);

    $response->assertSessionHasErrors(['units.0.unit_name', 'units.0.barcode']);
});

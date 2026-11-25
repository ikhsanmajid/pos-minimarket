<?php

use App\Enums\PaymentStatus;
use App\Enums\PurchaseOrderStatus;
use App\Enums\ReceivingStatus;
use App\Enums\UserRoles;
use App\Models\AccountPayable;
use App\Models\Category;
use App\Models\Product;
use App\Models\ProductUnit;
use App\Models\PurchaseOrder;
use App\Models\Supplier;
use App\Models\User;

function makePoTestFixtures(): array
{
    $category = Category::create([
        'name' => 'Sembako',
        'slug' => 'sembako-'.uniqid(),
        'code' => 'CAT-'.random_int(100, 999),
        'is_active' => true,
    ]);

    $supplier = Supplier::create([
        'name' => 'PT Sumber Makmur',
        'phone' => '081234567890',
        'payment_term_days' => 14,
        'is_active' => true,
    ]);

    $product = Product::create([
        'category_id' => $category->id,
        'barcode' => '899777'.random_int(100000, 999999),
        'name' => 'Mie Instan',
        'base_unit' => 'pcs',
        'buy_price' => 2500,
        'sell_price' => 3500,
        'stock' => 20,
        'min_stock' => 10,
        'active' => true,
    ]);

    $unitDus = ProductUnit::create([
        'product_id' => $product->id,
        'unit_name' => 'Dus',
        'conversion_factor' => 40,
        'buy_price' => 100000,
        'is_default_purchase' => true,
        'is_active' => true,
    ]);

    return [$supplier, $product, $unitDus];
}

it('requires admin approval when non-admin submits a PO and blocks receiving before approval', function () {
    $warehouse = User::factory()->create(['role' => UserRoles::Warehouse]);
    $supervisor = User::factory()->create(['role' => UserRoles::Supervisor]);
    $admin = User::factory()->create(['role' => UserRoles::Admin]);
    [$supplier, $product, $unitDus] = makePoTestFixtures();

    // Warehouse submits PO -> must become pending_approval
    $this->actingAs($warehouse)
        ->post(route('pos.purchase-orders.store'), [
            'supplier_id' => $supplier->id,
            'order_date' => now()->toDateString(),
            'action' => 'submit',
            'discount_type' => 'fixed',
            'discount_value' => 10000,
            'tax_type' => 'fixed',
            'tax_value' => 5000,
            'items' => [
                [
                    'product_id' => $product->id,
                    'product_unit_id' => $unitDus->id,
                    'quantity_ordered' => 2,
                    'free_qty_ordered' => 0,
                    'unit_cost' => 100000,
                    'discount_type' => 'percent',
                    'discount_value' => 10, // item gross 200.000 - 20.000 = 180.000
                ],
            ],
        ])
        ->assertRedirect();

    $po = PurchaseOrder::with('items')->firstOrFail();

    expect($po->status)->toBe(PurchaseOrderStatus::PendingApproval)
        ->and($po->receiving_status)->toBe(ReceivingStatus::Unreceived)
        ->and($po->payment_status)->toBe(PaymentStatus::Unpaid)
        ->and($po->approved_by)->toBeNull()
        ->and((float) $po->subtotal)->toBe(180000.0)
        ->and((float) $po->discount_amount)->toBe(10000.0)
        ->and((float) $po->tax_amount)->toBe(5000.0)
        ->and((float) $po->total_amount)->toBe(175000.0)
        ->and(AccountPayable::where('purchase_order_id', $po->id)->exists())->toBeFalse();

    // Non-admin cannot approve or reject
    $this->actingAs($supervisor)->post(route('pos.purchase-orders.approve', $po))->assertForbidden();
    $this->actingAs($warehouse)->post(route('pos.purchase-orders.reject', $po), [
        'rejection_reason' => 'Tidak berhak menolak',
    ])->assertForbidden();

    // Cannot receive goods before approval
    $this->actingAs($warehouse)->post(route('pos.purchase-orders.receive', $po), [
        'received_date' => now()->toDateString(),
        'items' => [
            [
                'purchase_order_item_id' => $po->items->first()->id,
                'receive_now_qty' => 1,
            ],
        ],
    ])->assertForbidden();

    // Admin rejects with reason
    $this->actingAs($admin)->post(route('pos.purchase-orders.reject', $po), [
        'rejection_reason' => 'Harga masih terlalu mahal, negosiasi ulang.',
    ])->assertRedirect();

    $po->refresh();
    expect($po->status)->toBe(PurchaseOrderStatus::Rejected)
        ->and($po->rejected_by)->toBe($admin->id)
        ->and($po->rejection_reason)->toBe('Harga masih terlalu mahal, negosiasi ulang.');

    // Warehouse revises back to draft and resubmits
    $this->actingAs($warehouse)->post(route('pos.purchase-orders.revise', $po))->assertRedirect();
    expect($po->refresh()->status)->toBe(PurchaseOrderStatus::Draft);

    $this->actingAs($warehouse)->post(route('pos.purchase-orders.submit', $po))->assertRedirect();
    expect($po->refresh()->status)->toBe(PurchaseOrderStatus::PendingApproval);

    // Admin approves -> creates AccountPayable automatically
    $this->actingAs($admin)->post(route('pos.purchase-orders.approve', $po))->assertRedirect();

    $po->refresh();
    expect($po->status)->toBe(PurchaseOrderStatus::Approved)
        ->and($po->approved_by)->toBe($admin->id)
        ->and($po->approved_at)->not->toBeNull();

    $payable = AccountPayable::where('purchase_order_id', $po->id)->first();
    expect($payable)->not->toBeNull()
        ->and((float) $payable->total_amount)->toBe(175000.0)
        ->and((float) $payable->remaining_amount)->toBe(175000.0)
        ->and($payable->status)->toBe(PaymentStatus::Unpaid);
});

it('allows admin to create an immediately approved PO and preserves UOM snapshot if product unit changes later', function () {
    $admin = User::factory()->create(['role' => UserRoles::Admin]);
    [$supplier, $product, $unitDus] = makePoTestFixtures();

    $this->actingAs($admin)
        ->post(route('pos.purchase-orders.store'), [
            'supplier_id' => $supplier->id,
            'order_date' => now()->toDateString(),
            'action' => 'submit',
            'discount_type' => 'fixed',
            'discount_value' => 0,
            'tax_type' => 'percent',
            'tax_value' => 11,
            'items' => [
                [
                    'product_id' => $product->id,
                    'product_unit_id' => $unitDus->id,
                    'quantity_ordered' => 1,
                    'free_qty_ordered' => 0,
                    'unit_cost' => 100000,
                    'discount_type' => 'fixed',
                    'discount_value' => 0,
                ],
            ],
        ])
        ->assertRedirect();

    $po = PurchaseOrder::with('items')->firstOrFail();
    expect($po->status)->toBe(PurchaseOrderStatus::Approved)
        ->and($po->approved_by)->toBe($admin->id)
        ->and((float) $po->total_amount)->toBe(111000.0)
        ->and(AccountPayable::where('purchase_order_id', $po->id)->exists())->toBeTrue();

    // Mutate product_units conversion factor afterwards
    $unitDus->update(['unit_name' => 'Karton Besar', 'conversion_factor' => 60]);

    $item = $po->items()->firstOrFail();
    expect($item->unit_name)->toBe('Dus')
        ->and($item->conversion_factor)->toBe(40)
        ->and($item->base_qty_ordered)->toBe(40);
});

it('cancels an unreceived unpaid approved PO and voids its account payable', function () {
    $admin = User::factory()->create(['role' => UserRoles::Admin]);
    [$supplier, $product, $unitDus] = makePoTestFixtures();

    $this->actingAs($admin)->post(route('pos.purchase-orders.store'), [
        'supplier_id' => $supplier->id,
        'order_date' => now()->toDateString(),
        'action' => 'submit',
        'discount_type' => 'fixed',
        'discount_value' => 0,
        'tax_type' => 'percent',
        'tax_value' => 0,
        'items' => [
            [
                'product_id' => $product->id,
                'product_unit_id' => $unitDus->id,
                'quantity_ordered' => 1,
                'unit_cost' => 100000,
            ],
        ],
    ])->assertRedirect();

    $po = PurchaseOrder::firstOrFail();
    expect(AccountPayable::where('purchase_order_id', $po->id)->exists())->toBeTrue();

    $this->actingAs($admin)->post(route('pos.purchase-orders.cancel', $po), [
        'reason' => 'Supplier kehabisan stok.',
    ])->assertRedirect();

    expect($po->refresh()->status)->toBe(PurchaseOrderStatus::Cancelled)
        ->and(AccountPayable::where('purchase_order_id', $po->id)->exists())->toBeFalse();
});

<?php

use App\Enums\ActivityLogCategory;
use App\Enums\FinancialAccountType;
use App\Enums\StockAdjustmentReason;
use App\Enums\StockAdjustmentStatus;
use App\Enums\StockAdjustmentType;
use App\Enums\StockMovementType;
use App\Enums\StockOpnameStatus;
use App\Enums\UserRoles;
use App\Models\Category;
use App\Models\FinancialAccount;
use App\Models\Product;
use App\Models\ProductUnit;
use App\Models\StockAdjustment;
use App\Models\StockMovement;
use App\Models\StockOpname;
use App\Models\StockOpnameItem;
use App\Models\User;
use Inertia\Testing\AssertableInertia as Assert;
use Spatie\Activitylog\Models\Activity;

function makeInventoryUser(UserRoles $role, string $emailPrefix): User
{
    return User::create([
        'name' => ucfirst($emailPrefix),
        'email' => $emailPrefix.'_'.uniqid().'@test.local',
        'password' => bcrypt('password'),
        'role' => $role,
        'is_active' => true,
    ]);
}

function makeInventoryCategory(string $name): Category
{
    return Category::create([
        'code' => strtoupper(substr(preg_replace('/[^A-Za-z0-9]/', '', $name) ?: 'CAT', 0, 6)).random_int(10, 99),
        'name' => $name,
        'is_active' => true,
    ]);
}

function makeInventoryProduct(Category $category, string $name, int $stock = 50, float $buyPrice = 10000, bool $active = true): Product
{
    return Product::create([
        'category_id' => $category->id,
        'barcode' => 'BC'.random_int(10000000, 99999999),
        'name' => $name,
        'base_unit' => 'pcs',
        'buy_price' => $buyPrice,
        'sell_price' => $buyPrice * 1.25,
        'stock' => $stock,
        'min_stock' => 5,
        'active' => $active,
    ]);
}

test('admin can create stock adjustment in and out, updates stock, creates movement, logs activity, and leaves financial accounts untouched', function () {
    $admin = makeInventoryUser(UserRoles::Admin, 'admin_adj');
    $category = makeInventoryCategory('Minuman');
    $product = makeInventoryProduct($category, 'Air Mineral 600ml', stock: 20, buyPrice: 3000);

    $cashAccount = FinancialAccount::create([
        'code' => 'KAS-TEST-1',
        'name' => 'Kas Toko',
        'type' => FinancialAccountType::Cash,
        'opening_balance' => 1000000,
        'current_balance' => 1000000,
        'is_default' => true,
        'is_active' => true,
    ]);

    // 1. Adjustment OUT (Damaged)
    $this->actingAs($admin)
        ->post(route('pos.inventory.adjustments.store'), [
            'product_id' => $product->id,
            'type' => StockAdjustmentType::Out->value,
            'reason' => StockAdjustmentReason::Damaged->value,
            'qty_change' => 5,
            'notes' => 'Kemasan botol bocor di gudang',
        ])
        ->assertRedirect(route('pos.inventory.adjustments.index'));

    $product->refresh();
    expect($product->stock)->toBe(15);

    $outAdj = StockAdjustment::where('product_id', $product->id)->where('type', StockAdjustmentType::Out->value)->firstOrFail();
    expect($outAdj->status)->toBe(StockAdjustmentStatus::Approved)
        ->and($outAdj->qty_before)->toBe(20)
        ->and($outAdj->qty_change)->toBe(5)
        ->and($outAdj->qty_after)->toBe(15)
        ->and((float) $outAdj->unit_cost_snapshot)->toBe(3000.0)
        ->and((float) $outAdj->total_cost_impact)->toBe(-15000.0)
        ->and($outAdj->approved_by)->toBe($admin->id);

    $outMovement = StockMovement::where('reference_type', StockAdjustment::class)
        ->where('reference_id', $outAdj->id)
        ->firstOrFail();
    expect($outMovement->type)->toBe(StockMovementType::AdjustmentOut)
        ->and($outMovement->stock_before)->toBe(20)
        ->and($outMovement->qty_change)->toBe(-5)
        ->and($outMovement->stock_after)->toBe(15);

    // 2. Adjustment IN (Correction)
    $this->actingAs($admin)
        ->post(route('pos.inventory.adjustments.store'), [
            'product_id' => $product->id,
            'type' => StockAdjustmentType::In->value,
            'reason' => StockAdjustmentReason::Correction->value,
            'qty_change' => 3,
            'notes' => 'Koreksi kelebihan hitung rak display',
        ])
        ->assertRedirect(route('pos.inventory.adjustments.index'));

    $product->refresh();
    expect($product->stock)->toBe(18);

    // Financial account balance MUST NOT be touched
    $cashAccount->refresh();
    expect((float) $cashAccount->current_balance)->toBe(1000000.0);

    // Activity Log recorded
    expect(
        Activity::where('log_name', ActivityLogCategory::StockAdjustment->value)->count()
    )->toBeGreaterThanOrEqual(2);

    // Verify KPI summary on index page
    $this->actingAs($admin)
        ->get(route('pos.inventory.adjustments.index'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('POS/Inventory/StockAdjustment')
            ->where('summary.total_count', 2)
            ->where('summary.pending_count', 0)
            ->where('summary.in_qty', 3)
            ->where('summary.out_qty', 5)
            ->where('summary.total_loss_value', 15000)
        );
});

test('stock adjustment rejects out quantity that would cause negative stock', function () {
    $admin = makeInventoryUser(UserRoles::Admin, 'admin_neg');
    $category = makeInventoryCategory('Snack');
    $product = makeInventoryProduct($category, 'Keripik Kentang', stock: 4, buyPrice: 8000);

    $this->actingAs($admin)
        ->post(route('pos.inventory.adjustments.store'), [
            'product_id' => $product->id,
            'type' => StockAdjustmentType::Out->value,
            'reason' => StockAdjustmentReason::Lost->value,
            'qty_change' => 10,
            'notes' => 'Coba kurangi melebihi stok',
        ])
        ->assertSessionHasErrors('qty_change');

    expect($product->fresh()->stock)->toBe(4)
        ->and(StockAdjustment::count())->toBe(0);
});

test('warehouse and cashier can submit pending stock adjustments, cannot approve/reject, and supervisor/admin can approve or reject', function () {
    $supervisor = makeInventoryUser(UserRoles::Supervisor, 'sup_adj');
    $warehouse = makeInventoryUser(UserRoles::Warehouse, 'wh_adj');
    $cashier = makeInventoryUser(UserRoles::Cashier, 'cash_adj');

    $category = makeInventoryCategory('Sembako');
    $product = makeInventoryProduct($category, 'Gula Pasir 1kg', stock: 30, buyPrice: 14000);

    // Cashier submits adjustment -> pending, stock NOT changed yet
    $this->actingAs($cashier)
        ->post(route('pos.inventory.adjustments.store'), [
            'product_id' => $product->id,
            'type' => StockAdjustmentType::Out->value,
            'reason' => StockAdjustmentReason::Damaged->value,
            'qty_change' => 2,
            'notes' => 'Kemasan sobek di meja kasir',
        ])
        ->assertRedirect(route('pos.inventory.adjustments.index'));

    $pendingAdj = StockAdjustment::firstOrFail();
    expect($pendingAdj->status)->toBe(StockAdjustmentStatus::Pending)
        ->and($pendingAdj->approved_by)->toBeNull()
        ->and($product->fresh()->stock)->toBe(30)
        ->and(StockMovement::count())->toBe(0);

    // Cashier & Warehouse receive 403 when trying to approve or reject
    $this->actingAs($cashier)
        ->post(route('pos.inventory.adjustments.approve', $pendingAdj))
        ->assertForbidden();

    $this->actingAs($warehouse)
        ->post(route('pos.inventory.adjustments.approve', $pendingAdj))
        ->assertForbidden();

    $this->actingAs($warehouse)
        ->post(route('pos.inventory.adjustments.reject', $pendingAdj), [
            'rejection_reason' => 'Tidak berhak',
        ])
        ->assertForbidden();

    // Supervisor approves -> stock updated & movement created
    $this->actingAs($supervisor)
        ->post(route('pos.inventory.adjustments.approve', $pendingAdj))
        ->assertRedirect();

    $pendingAdj->refresh();
    expect($pendingAdj->status)->toBe(StockAdjustmentStatus::Approved)
        ->and($pendingAdj->approved_by)->toBe($supervisor->id)
        ->and($product->fresh()->stock)->toBe(28)
        ->and(StockMovement::where('reference_type', StockAdjustment::class)->where('reference_id', $pendingAdj->id)->count())->toBe(1);

    // Warehouse submits another adjustment -> Supervisor rejects -> stock untouched
    $this->actingAs($warehouse)
        ->post(route('pos.inventory.adjustments.store'), [
            'product_id' => $product->id,
            'type' => StockAdjustmentType::Out->value,
            'reason' => StockAdjustmentReason::Lost->value,
            'qty_change' => 3,
            'notes' => 'Diduga hilang di gudang belakang',
        ])
        ->assertRedirect();

    $secondAdj = StockAdjustment::latest('id')->firstOrFail();
    expect($secondAdj->status)->toBe(StockAdjustmentStatus::Pending);

    $this->actingAs($supervisor)
        ->post(route('pos.inventory.adjustments.reject', $secondAdj), [
            'rejection_reason' => 'Barang ternyata sudah dipindah ke rak depan',
        ])
        ->assertRedirect();

    $secondAdj->refresh();
    expect($secondAdj->status)->toBe(StockAdjustmentStatus::Rejected)
        ->and($secondAdj->rejected_by)->toBe($supervisor->id)
        ->and($secondAdj->rejection_reason)->toBe('Barang ternyata sudah dipindah ke rak depan')
        ->and($product->fresh()->stock)->toBe(28);
});

test('stock opname supports store-wide and per-category scopes and prevents overlapping active sessions', function () {
    $admin = makeInventoryUser(UserRoles::Admin, 'admin_opn_scope');
    $catDrinks = makeInventoryCategory('Minuman');
    $catSnacks = makeInventoryCategory('Makanan Ringan');

    $p1 = makeInventoryProduct($catDrinks, 'Teh Botol', stock: 10, buyPrice: 4000, active: true);
    $p2 = makeInventoryProduct($catDrinks, 'Teh Nonaktif', stock: 10, buyPrice: 4000, active: false);
    $p3 = makeInventoryProduct($catSnacks, 'Wafer Coklat', stock: 25, buyPrice: 5000, active: true);

    // Create category opname for Drinks -> should only include active drink product ($p1)
    $this->actingAs($admin)
        ->post(route('pos.inventory.opnames.store'), [
            'category_id' => $catDrinks->id,
            'is_blind_count' => true,
            'notes' => 'Opname rak minuman',
        ])
        ->assertRedirect();

    $drinksOpname = StockOpname::firstOrFail();
    expect($drinksOpname->status)->toBe(StockOpnameStatus::InProgress)
        ->and($drinksOpname->items()->pluck('product_id')->all())->toBe([$p1->id]);

    // Overlapping same category -> rejected
    $this->actingAs($admin)
        ->post(route('pos.inventory.opnames.store'), [
            'category_id' => $catDrinks->id,
            'is_blind_count' => true,
        ])
        ->assertSessionHasErrors('category_id');

    // Overlapping whole store while a category session is active -> rejected
    $this->actingAs($admin)
        ->post(route('pos.inventory.opnames.store'), [
            'category_id' => null,
            'is_blind_count' => true,
        ])
        ->assertSessionHasErrors('category_id');

    // Different category (Snacks) -> allowed
    $this->actingAs($admin)
        ->post(route('pos.inventory.opnames.store'), [
            'category_id' => $catSnacks->id,
            'is_blind_count' => false,
        ])
        ->assertRedirect();

    $snacksOpname = StockOpname::latest('id')->firstOrFail();
    expect($snacksOpname->items()->pluck('product_id')->all())->toBe([$p3->id]);
});

test('blind count hides system stock from warehouse and cashier, supports multi-uom barcode lookup, enforces role permissions, and finalizes cleanly', function () {
    $admin = makeInventoryUser(UserRoles::Admin, 'admin_opn');
    $warehouse = makeInventoryUser(UserRoles::Warehouse, 'wh_opn');
    $cashier = makeInventoryUser(UserRoles::Cashier, 'cash_opn');

    $category = makeInventoryCategory('Susu & Dairy');
    $pMatch = makeInventoryProduct($category, 'Susu UHT 250ml', stock: 20, buyPrice: 5000);
    $pShortage = makeInventoryProduct($category, 'Susu Kental Manis', stock: 15, buyPrice: 10000);

    $unitDus = ProductUnit::create([
        'product_id' => $pMatch->id,
        'unit_name' => 'Dus',
        'conversion_factor' => 12,
        'barcode' => 'DUS-UHT-12',
        'buy_price' => 60000,
        'sell_price' => 72000,
        'is_default_purchase' => true,
        'is_active' => true,
    ]);

    $cashAccount = FinancialAccount::create([
        'code' => 'KAS-OPN-1',
        'name' => 'Kas Utama',
        'type' => FinancialAccountType::Cash,
        'opening_balance' => 500000,
        'current_balance' => 500000,
        'is_default' => true,
        'is_active' => true,
    ]);

    // Warehouse starts a blind count opname session
    $this->actingAs($warehouse)
        ->post(route('pos.inventory.opnames.store'), [
            'category_id' => $category->id,
            'is_blind_count' => true,
            'notes' => 'Opname bulanan susu',
        ])
        ->assertRedirect();

    $opname = StockOpname::firstOrFail();

    // Blind Count Security Test: Warehouse & Cashier MUST NOT receive system_stock, variance_qty, or variance_value
    foreach ([$warehouse, $cashier] as $counterUser) {
        $this->actingAs($counterUser)
            ->get(route('pos.inventory.opnames.show', $opname))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('POS/Inventory/StockOpnameSession')
                ->where('opname.hide_system_stock', true)
                ->missing('opname.total_variance_value')
                ->has('items', 2)
                ->missing('items.0.system_stock')
                ->missing('items.0.variance_qty')
                ->missing('items.0.variance_value')
            );
    }

    // Lookup barcode: ProductUnit Multi-UOM (Dus = 12 pcs) & hide system_stock for warehouse
    $this->actingAs($warehouse)
        ->getJson(route('pos.inventory.opnames.lookup-barcode', ['stockOpname' => $opname->id, 'barcode' => $unitDus->barcode]))
        ->assertOk()
        ->assertJsonPath('found', true)
        ->assertJsonPath('item.product_id', $pMatch->id)
        ->assertJsonPath('item.conversion_factor', 12)
        ->assertJsonMissingPath('item.system_stock');

    // Lookup barcode: Base product barcode
    $this->actingAs($cashier)
        ->getJson(route('pos.inventory.opnames.lookup-barcode', ['stockOpname' => $opname->id, 'barcode' => $pShortage->barcode]))
        ->assertOk()
        ->assertJsonPath('found', true)
        ->assertJsonPath('item.product_id', $pShortage->id)
        ->assertJsonPath('item.conversion_factor', 1)
        ->assertJsonMissingPath('item.system_stock');

    /** @var StockOpnameItem $itemMatch */
    $itemMatch = $opname->items()->where('product_id', $pMatch->id)->firstOrFail();
    /** @var StockOpnameItem $itemShortage */
    $itemShortage = $opname->items()->where('product_id', $pShortage->id)->firstOrFail();

    // Incremental draft save 1: Warehouse saves only 1 item
    $this->actingAs($warehouse)
        ->patch(route('pos.inventory.opnames.counts.update', $opname), [
            'items' => [
                ['id' => $itemMatch->id, 'physical_stock' => 20, 'notes' => 'Sesuai rak'],
            ],
        ])
        ->assertRedirect();

    expect($opname->fresh()->total_items_counted)->toBe(1);

    // Admin tries to finalize while 1 item is still uncounted -> rejected
    $this->actingAs($admin)
        ->post(route('pos.inventory.opnames.finalize', $opname))
        ->assertSessionHasErrors('items');

    // Incremental draft save 2: Cashier saves second item with shortage (12 instead of 15)
    $this->actingAs($cashier)
        ->patch(route('pos.inventory.opnames.counts.update', $opname), [
            'items' => [
                ['id' => $itemShortage->id, 'physical_stock' => 12, 'notes' => '3 kaleng penyok / hilang'],
            ],
        ])
        ->assertRedirect();

    expect($opname->fresh()->total_items_counted)->toBe(2);

    // Warehouse & Cashier receive 403 when attempting to finalize or cancel
    $this->actingAs($warehouse)->post(route('pos.inventory.opnames.finalize', $opname))->assertForbidden();
    $this->actingAs($cashier)->post(route('pos.inventory.opnames.finalize', $opname))->assertForbidden();
    $this->actingAs($warehouse)->post(route('pos.inventory.opnames.cancel', $opname))->assertForbidden();
    $this->actingAs($cashier)->post(route('pos.inventory.opnames.cancel', $opname))->assertForbidden();

    // Admin finalizes the opname
    $this->actingAs($admin)
        ->post(route('pos.inventory.opnames.finalize', $opname))
        ->assertRedirect(route('pos.inventory.opnames.show', $opname));

    $opname->refresh();
    expect($opname->status)->toBe(StockOpnameStatus::Completed)
        ->and($opname->approved_by)->toBe($admin->id)
        ->and($opname->completed_at)->not->toBeNull()
        ->and($opname->total_items_counted)->toBe(2)
        ->and($opname->total_variance_items)->toBe(1)
        ->and((float) $opname->total_variance_value)->toBe(-30000.0);

    // Products stock updated
    expect($pMatch->fresh()->stock)->toBe(20)
        ->and($pShortage->fresh()->stock)->toBe(12);

    // ONLY item with variance != 0 creates a StockMovement of type opname
    $opnameMovements = StockMovement::where('reference_type', StockOpname::class)
        ->where('reference_id', $opname->id)
        ->get();

    expect($opnameMovements)->toHaveCount(1)
        ->and($opnameMovements->first()->product_id)->toBe($pShortage->id)
        ->and($opnameMovements->first()->type)->toBe(StockMovementType::Opname)
        ->and($opnameMovements->first()->stock_before)->toBe(15)
        ->and($opnameMovements->first()->qty_change)->toBe(-3)
        ->and($opnameMovements->first()->stock_after)->toBe(12);

    // Financial account untouched
    expect((float) $cashAccount->fresh()->current_balance)->toBe(500000.0);

    // Activity Log recorded
    expect(
        Activity::where('log_name', ActivityLogCategory::StockOpname->value)
            ->where('event', 'completed')
            ->count()
    )->toBe(1);

    // Completed session cannot be modified or finalized again
    $this->actingAs($admin)
        ->patch(route('pos.inventory.opnames.counts.update', $opname), [
            'items' => [['id' => $itemMatch->id, 'physical_stock' => 99]],
        ])
        ->assertSessionHasErrors('status');

    $this->actingAs($admin)
        ->post(route('pos.inventory.opnames.finalize', $opname))
        ->assertSessionHasErrors('status');

    // Verify opname movement appears on Product detail page (StokMutasiProduct)
    $this->actingAs($admin)
        ->get(route('pos.products.show', $pShortage), [
            'X-Inertia' => 'true',
            'X-Inertia-Partial-Component' => 'POS/Product/DetailProduct',
            'X-Inertia-Partial-Data' => 'stockMovements',
        ])
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->where('stockMovements.data.0.type', StockMovementType::Opname->value)
            ->where('stockMovements.data.0.type_label', 'Stock Opname')
            ->where('stockMovements.data.0.qty_change', -3)
        );
});

test('cancelling an opname session locks it as cancelled without modifying product stock', function () {
    $supervisor = makeInventoryUser(UserRoles::Supervisor, 'sup_cancel_opn');
    $category = makeInventoryCategory('Alat Tulis');
    $product = makeInventoryProduct($category, 'Pulpen Hitam', stock: 40, buyPrice: 2000);

    $this->actingAs($supervisor)
        ->post(route('pos.inventory.opnames.store'), [
            'category_id' => $category->id,
            'is_blind_count' => true,
        ])
        ->assertRedirect();

    $opname = StockOpname::firstOrFail();
    $item = $opname->items()->firstOrFail();

    $this->actingAs($supervisor)
        ->patch(route('pos.inventory.opnames.counts.update', $opname), [
            'items' => [['id' => $item->id, 'physical_stock' => 10]],
        ])
        ->assertRedirect();

    $this->actingAs($supervisor)
        ->post(route('pos.inventory.opnames.cancel', $opname), [
            'reason' => 'Salah pilih kategori opname',
        ])
        ->assertRedirect(route('pos.inventory.opnames.show', $opname));

    $opname->refresh();
    expect($opname->status)->toBe(StockOpnameStatus::Cancelled)
        ->and($opname->cancelled_at)->not->toBeNull()
        ->and($product->fresh()->stock)->toBe(40)
        ->and(StockMovement::count())->toBe(0);

    // Cancelled session cannot be updated or finalized
    $this->actingAs($supervisor)
        ->patch(route('pos.inventory.opnames.counts.update', $opname), [
            'items' => [['id' => $item->id, 'physical_stock' => 25]],
        ])
        ->assertSessionHasErrors('status');

    $this->actingAs($supervisor)
        ->post(route('pos.inventory.opnames.finalize', $opname))
        ->assertSessionHasErrors('status');
});

<?php

use App\Enums\ActivityLogCategory;
use App\Enums\TransactionStatus;
use App\Enums\UserRoles;
use App\Models\Customer;
use App\Models\Transaction;
use App\Models\User;
use Inertia\Testing\AssertableInertia as Assert;
use Spatie\Activitylog\Models\Activity;

test('admin can perform full customer CRUD with auto member_code, phone normalization, and activity log', function () {
    $admin = User::factory()->create(['role' => UserRoles::Admin]);

    // Create without member_code and with formatted phone
    $this->actingAs($admin)
        ->post(route('pos.customers.store'), [
            'name' => 'Rina Kartika',
            'phone' => '0812-3456-7890',
            'email' => 'RINA@Example.COM',
            'address' => 'Jl. Melati No. 5',
            'points' => 25,
            'is_active' => true,
            'notes' => 'Pelanggan setia',
        ])
        ->assertRedirect();

    $customer = Customer::query()->where('name', 'Rina Kartika')->firstOrFail();

    expect($customer->member_code)->toStartWith('MBR-')
        ->and($customer->phone)->toBe('081234567890')
        ->and($customer->email)->toBe('rina@example.com')
        ->and($customer->points)->toBe(25)
        ->and($customer->is_active)->toBeTrue();

    // Activity log created
    $createdLog = Activity::forSubject($customer)->where('event', 'created')->first();
    expect($createdLog)->not->toBeNull()
        ->and($createdLog->log_name)->toBe(ActivityLogCategory::Customer->value)
        ->and($createdLog->description)->toContain('Rina Kartika');

    // Update
    $this->actingAs($admin)
        ->patch(route('pos.customers.update', $customer), [
            'member_code' => $customer->member_code,
            'name' => 'Rina Kartika Putri',
            'phone' => '0812 3456 7890',
            'email' => 'rina.putri@example.com',
            'points' => 100,
            'is_active' => true,
        ])
        ->assertRedirect();

    $customer->refresh();
    expect($customer->name)->toBe('Rina Kartika Putri')
        ->and($customer->points)->toBe(100);

    $updatedLog = Activity::forSubject($customer)->where('event', 'updated')->first();
    expect($updatedLog)->not->toBeNull();

    // Soft Delete
    $this->actingAs($admin)
        ->delete(route('pos.customers.destroy', $customer))
        ->assertRedirect(route('pos.customers.index'));

    expect($customer->fresh()->trashed())->toBeTrue();

    $deletedLog = Activity::forSubject($customer)->where('event', 'deleted')->first();
    expect($deletedLog)->not->toBeNull();
});

test('prevents duplicate phone and member_code among active customers but allows reusing phone after soft delete', function () {
    $admin = User::factory()->create(['role' => UserRoles::Admin]);

    $first = Customer::factory()->create([
        'member_code' => 'MBR-UNIQUE-01',
        'name' => 'Member Pertama',
        'phone' => '081311112222',
    ]);

    // Duplicate phone (with dashes) rejected
    $this->actingAs($admin)
        ->post(route('pos.customers.store'), [
            'name' => 'Member Duplikat HP',
            'phone' => '0813-1111-2222',
        ])
        ->assertSessionHasErrors(['phone']);

    // Duplicate member_code rejected
    $this->actingAs($admin)
        ->post(route('pos.customers.store'), [
            'member_code' => 'MBR-UNIQUE-01',
            'name' => 'Member Duplikat Kode',
            'phone' => '081399998888',
        ])
        ->assertSessionHasErrors(['member_code']);

    // Soft delete first customer
    $this->actingAs($admin)
        ->delete(route('pos.customers.destroy', $first))
        ->assertRedirect();

    // Reusing the same phone number on a new customer succeeds
    $this->actingAs($admin)
        ->post(route('pos.customers.store'), [
            'name' => 'Member Baru Reuse HP',
            'phone' => '0813-1111-2222',
        ])
        ->assertSessionHasNoErrors()
        ->assertRedirect();

    expect(Customer::query()->where('phone', '081311112222')->count())->toBe(1);
});

test('soft deleting customer preserves historical transaction relationship and detail stats exclude voided transactions', function () {
    $admin = User::factory()->create(['role' => UserRoles::Admin]);
    $customer = Customer::factory()->create([
        'name' => 'Pelanggan Loyal',
        'points' => 50,
        'is_active' => true,
    ]);

    $tx1 = Transaction::create([
        'invoice_number' => 'INV-CUST-001',
        'user_id' => $admin->id,
        'customer_id' => $customer->id,
        'subtotal' => 100000,
        'total_amount' => 100000,
        'grand_total' => 100000,
        'paid_amount' => 100000,
        'pay_amount' => 100000,
        'change_amount' => 0,
        'payment_method' => 'cash',
        'status' => TransactionStatus::Completed,
    ]);

    Transaction::create([
        'invoice_number' => 'INV-CUST-002',
        'user_id' => $admin->id,
        'customer_id' => $customer->id,
        'subtotal' => 50000,
        'total_amount' => 50000,
        'grand_total' => 50000,
        'paid_amount' => 50000,
        'pay_amount' => 50000,
        'change_amount' => 0,
        'payment_method' => 'cash',
        'status' => TransactionStatus::Completed,
    ]);

    // Voided transaction should be excluded from stats
    Transaction::create([
        'invoice_number' => 'INV-CUST-003',
        'user_id' => $admin->id,
        'customer_id' => $customer->id,
        'subtotal' => 900000,
        'total_amount' => 900000,
        'grand_total' => 900000,
        'paid_amount' => 900000,
        'pay_amount' => 900000,
        'change_amount' => 0,
        'payment_method' => 'cash',
        'status' => TransactionStatus::Voided,
    ]);

    // Check index summary KPIs
    $this->actingAs($admin)
        ->get(route('pos.customers.index'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->where('summary.total_customers', 1)
            ->where('summary.active_customers', 1)
            ->where('summary.transacted_customers', 1)
            ->where('summary.total_active_points', 50)
        );

    // Check detail stats exclude voided transaction
    $this->actingAs($admin)
        ->get(route('pos.customers.show', $customer))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->where('stats.total_transactions', 2)
            ->where('stats.total_spent', 150000)
            ->where('stats.average_spent', 75000)
        );

    // Soft delete customer and verify transaction still resolves customer via withTrashed()
    $customer->delete();

    $reloadedTx = Transaction::with('customer')->findOrFail($tx1->id);
    expect($reloadedTx->customer_id)->toBe($customer->id)
        ->and($reloadedTx->customer)->not->toBeNull()
        ->and($reloadedTx->customer->name)->toBe('Pelanggan Loyal');
});

test('pos quick search only returns active customers by phone, member_code, or name and supports json quick create', function () {
    $cashier = User::factory()->create(['role' => UserRoles::Cashier]);

    $active = Customer::factory()->create([
        'member_code' => 'MBR-POS-001',
        'name' => 'Ahmad Fauzi',
        'phone' => '085612345678',
        'points' => 75,
        'is_active' => true,
    ]);

    Customer::factory()->inactive()->create([
        'member_code' => 'MBR-POS-999',
        'name' => 'Ahmad Nonaktif',
        'phone' => '085612349999',
        'is_active' => false,
    ]);

    // Search by name
    $resName = $this->actingAs($cashier)
        ->getJson(route('pos.customers.search', ['q' => 'Ahmad']))
        ->assertOk();
    expect($resName->json('customers'))->toHaveCount(1)
        ->and($resName->json('customers.0.id'))->toBe($active->id);

    // Search by phone
    $resPhone = $this->actingAs($cashier)
        ->getJson(route('pos.customers.search', ['q' => '0856-1234-5678']))
        ->assertOk();
    expect($resPhone->json('customers'))->toHaveCount(1)
        ->and($resPhone->json('customers.0.id'))->toBe($active->id);

    // Search by member_code
    $resCode = $this->actingAs($cashier)
        ->getJson(route('pos.customers.search', ['q' => 'MBR-POS-001']))
        ->assertOk();
    expect($resCode->json('customers'))->toHaveCount(1)
        ->and($resCode->json('customers.0.points'))->toBe(75);

    // JSON quick create from POS Terminal
    $quickCreate = $this->actingAs($cashier)
        ->postJson(route('pos.customers.store'), [
            'name' => 'Member Baru Kasir',
            'phone' => '087711223344',
        ])
        ->assertCreated();

    expect($quickCreate->json('customer.name'))->toBe('Member Baru Kasir')
        ->and($quickCreate->json('customer.member_code'))->toStartWith('MBR-');
});

test('enforces customer policy across admin, supervisor, cashier, and warehouse roles', function () {
    $admin = User::factory()->create(['role' => UserRoles::Admin]);
    $supervisor = User::factory()->create(['role' => UserRoles::Supervisor]);
    $cashier = User::factory()->create(['role' => UserRoles::Cashier]);
    $warehouse = User::factory()->create(['role' => UserRoles::Warehouse]);

    $customer = Customer::factory()->create(['name' => 'Target Policy']);

    // Warehouse is forbidden everywhere
    $this->actingAs($warehouse)->get(route('pos.customers.index'))->assertForbidden();
    $this->actingAs($warehouse)->get(route('pos.customers.show', $customer))->assertForbidden();
    $this->actingAs($warehouse)->getJson(route('pos.customers.search'))->assertForbidden();
    $this->actingAs($warehouse)->post(route('pos.customers.store'), ['name' => 'Test'])->assertForbidden();
    $this->actingAs($warehouse)->patch(route('pos.customers.update', $customer), ['name' => 'Edit'])->assertForbidden();
    $this->actingAs($warehouse)->delete(route('pos.customers.destroy', $customer))->assertForbidden();

    // Cashier can view, create, update, search, but CANNOT delete (403)
    $this->actingAs($cashier)->get(route('pos.customers.index'))->assertOk();
    $this->actingAs($cashier)->post(route('pos.customers.store'), ['name' => 'Created By Cashier'])->assertRedirect();
    $this->actingAs($cashier)->patch(route('pos.customers.update', $customer), ['name' => 'Edited By Cashier'])->assertRedirect();
    $this->actingAs($cashier)->delete(route('pos.customers.destroy', $customer))->assertForbidden();

    // Supervisor can delete
    $this->actingAs($supervisor)->delete(route('pos.customers.destroy', $customer))->assertRedirect();
    expect($customer->fresh()->trashed())->toBeTrue();

    // Admin can delete
    $customer2 = Customer::factory()->create(['name' => 'Target Admin Delete']);
    $this->actingAs($admin)->delete(route('pos.customers.destroy', $customer2))->assertRedirect();
    expect($customer2->fresh()->trashed())->toBeTrue();
});

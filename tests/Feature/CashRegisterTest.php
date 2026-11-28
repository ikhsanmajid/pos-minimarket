<?php

use App\Enums\ActivityLogCategory;
use App\Enums\CashierShiftStatus;
use App\Enums\UserRoles;
use App\Models\CashRegister;
use App\Models\CashierShift;
use App\Models\User;
use Inertia\Testing\AssertableInertia as Assert;
use Spatie\Activitylog\Models\Activity;

it('restricts cash register management to admin and supervisor', function () {
    $cashier = User::factory()->create(['role' => UserRoles::Cashier]);
    $warehouse = User::factory()->create(['role' => UserRoles::Warehouse]);
    $supervisor = User::factory()->create(['role' => UserRoles::Supervisor]);
    $admin = User::factory()->create(['role' => UserRoles::Admin]);

    $this->actingAs($cashier)->get(route('pos.cash-registers.index'))->assertForbidden();
    $this->actingAs($warehouse)->get(route('pos.cash-registers.index'))->assertForbidden();
    $this->actingAs($supervisor)->get(route('pos.cash-registers.index'))->assertOk();
    $this->actingAs($admin)->get(route('pos.cash-registers.index'))->assertOk();
});

it('renders cash registers with accurate summary and supports filtering', function () {
    $admin = User::factory()->create(['role' => UserRoles::Admin]);
    $cashier = User::factory()->create(['role' => UserRoles::Cashier]);

    $inUse = CashRegister::factory()->create([
        'code' => 'KSR-01',
        'name' => 'Kasir 1',
        'location' => 'Depan Kiri',
        'is_active' => true,
    ]);
    CashRegister::factory()->create([
        'code' => 'KSR-02',
        'name' => 'Kasir 2',
        'location' => 'Depan Kanan',
        'is_active' => true,
    ]);
    CashRegister::factory()->inactive()->create([
        'code' => 'KSR-03',
        'name' => 'Kasir Cadangan',
        'location' => 'Gudang',
    ]);

    CashierShift::factory()->create([
        'user_id' => $cashier->id,
        'cash_register_id' => $inUse->id,
        'register_name' => $inUse->name,
        'status' => CashierShiftStatus::Open,
    ]);

    $this->actingAs($admin)
        ->get(route('pos.cash-registers.index'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('POS/CashRegisters/CashRegister')
            ->where('summary.total_registers', 3)
            ->where('summary.active_registers', 2)
            ->where('summary.inactive_registers', 1)
            ->where('summary.in_use_registers', 1)
            ->where('summary.available_registers', 1)
            ->has('cashRegisters.data', 3)
        );

    $this->actingAs($admin)
        ->get(route('pos.cash-registers.index', ['status' => 'in_use']))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->has('cashRegisters.data', 1)
            ->where('cashRegisters.data.0.code', 'KSR-01')
            ->where('cashRegisters.data.0.is_in_use', true)
        );
});

it('allows admin to create, update, and delete a cash register with descriptive activity logs', function () {
    $admin = User::factory()->create(['role' => UserRoles::Admin]);

    $this->actingAs($admin)
        ->post(route('pos.cash-registers.store'), [
            'code' => 'ksr-10',
            'name' => 'Kasir Express',
            'location' => 'Pintu Keluar',
            'description' => 'Printer thermal 80mm',
            'is_active' => true,
        ])
        ->assertRedirect();

    $register = CashRegister::where('code', 'KSR-10')->firstOrFail();
    expect($register->name)->toBe('Kasir Express');

    $createdLog = Activity::query()
        ->where('log_name', ActivityLogCategory::CashRegister->value)
        ->where('event', 'created')
        ->where('subject_id', $register->id)
        ->first();
    expect($createdLog?->description)->toBe('Kasir Fisik Kasir Express (KSR-10) berhasil dibuat.');

    $this->actingAs($admin)
        ->patch(route('pos.cash-registers.update', $register), [
            'code' => 'KSR-10',
            'name' => 'Kasir Express Utama',
            'location' => 'Pintu Keluar 2',
            'description' => 'Updated',
            'is_active' => false,
        ])
        ->assertRedirect();

    $register->refresh();
    expect($register->name)->toBe('Kasir Express Utama')
        ->and($register->is_active)->toBeFalse();

    $this->actingAs($admin)
        ->delete(route('pos.cash-registers.destroy', $register))
        ->assertRedirect();

    expect(CashRegister::find($register->id))->toBeNull();
});

it('prevents deactivating or deleting a cash register that has an active open shift', function () {
    $admin = User::factory()->create(['role' => UserRoles::Admin]);
    $cashier = User::factory()->create(['role' => UserRoles::Cashier]);

    $register = CashRegister::factory()->create([
        'code' => 'KSR-99',
        'name' => 'Kasir Sibuk',
        'is_active' => true,
    ]);

    CashierShift::factory()->create([
        'user_id' => $cashier->id,
        'cash_register_id' => $register->id,
        'register_name' => $register->name,
        'status' => CashierShiftStatus::Open,
    ]);

    $this->actingAs($admin)
        ->patch(route('pos.cash-registers.update', $register), [
            'code' => 'KSR-99',
            'name' => 'Kasir Sibuk',
            'is_active' => false,
        ])
        ->assertSessionHasErrors('is_active');

    expect($register->fresh()->is_active)->toBeTrue();

    $this->actingAs($admin)
        ->delete(route('pos.cash-registers.destroy', $register))
        ->assertSessionHas('error');

    expect(CashRegister::find($register->id))->not->toBeNull();
});

it('links opened shift to selected physical register and prevents double occupancy', function () {
    $cashierOne = User::factory()->create(['role' => UserRoles::Cashier]);
    $cashierTwo = User::factory()->create(['role' => UserRoles::Cashier]);

    $activeRegister = CashRegister::factory()->create([
        'code' => 'KSR-21',
        'name' => 'Kasir 21',
        'is_active' => true,
    ]);
    $inactiveRegister = CashRegister::factory()->inactive()->create([
        'code' => 'KSR-22',
        'name' => 'Kasir 22',
    ]);

    // Cashier 1 opens shift on active register
    $this->actingAs($cashierOne)
        ->post(route('pos.shifts.open'), [
            'cash_register_id' => $activeRegister->id,
            'starting_cash' => 500000,
        ])
        ->assertRedirect();

    $shift = CashierShift::where('user_id', $cashierOne->id)->firstOrFail();
    expect($shift->cash_register_id)->toBe($activeRegister->id)
        ->and($shift->register_name)->toBe('Kasir 21');

    // Cashier 2 cannot open shift on the same occupied register
    $this->actingAs($cashierTwo)
        ->post(route('pos.shifts.open'), [
            'cash_register_id' => $activeRegister->id,
            'starting_cash' => 300000,
        ])
        ->assertSessionHasErrors('cash_register_id');

    // Cashier 2 cannot open shift on an inactive register
    $this->actingAs($cashierTwo)
        ->post(route('pos.shifts.open'), [
            'cash_register_id' => $inactiveRegister->id,
            'starting_cash' => 300000,
        ])
        ->assertSessionHasErrors('cash_register_id');
});

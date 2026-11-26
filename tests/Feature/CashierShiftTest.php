<?php

use App\Enums\CashierShiftStatus;
use App\Enums\FinancialAccountType;
use App\Enums\PaymentMethod;
use App\Enums\ShiftCashMovementType;
use App\Enums\UserRoles;
use App\Models\CashierShift;
use App\Models\FinancialAccount;
use App\Models\FinancialTransaction;
use App\Models\Transaction;
use App\Models\User;
use Illuminate\Support\Facades\Route;
use Inertia\Testing\AssertableInertia as Assert;
use Spatie\Activitylog\Models\Activity;

function seedShiftFinancialAccounts(): array
{
    $drawer = FinancialAccount::create([
        'code' => 'KAS-001',
        'name' => 'Kas Kasir (Laci POS)',
        'type' => FinancialAccountType::Cash,
        'opening_balance' => 0,
        'current_balance' => 0,
        'is_default' => false,
        'is_active' => true,
    ]);

    $safe = FinancialAccount::create([
        'code' => 'KAS-002',
        'name' => 'Brankas Toko',
        'type' => FinancialAccountType::Cash,
        'opening_balance' => 1000000,
        'current_balance' => 1000000,
        'is_default' => true,
        'is_active' => true,
    ]);

    $bank = FinancialAccount::create([
        'code' => 'BNK-001',
        'name' => 'Bank BCA Toko',
        'type' => FinancialAccountType::Bank,
        'opening_balance' => 5000000,
        'current_balance' => 5000000,
        'is_default' => false,
        'is_active' => true,
    ]);

    return compact('drawer', 'safe', 'bank');
}

it('allows a cashier to open a shift and prevents double opening', function () {
    $cashier = User::factory()->create(['role' => UserRoles::Cashier]);

    $this->actingAs($cashier)
        ->post(route('pos.shifts.open'), [
            'register_name' => 'Kasir 1',
            'starting_cash' => 500000,
        ])
        ->assertRedirect(route('pos.shifts.index'));

    $shift = CashierShift::where('user_id', $cashier->id)->firstOrFail();
    expect($shift->status)->toBe(CashierShiftStatus::Open)
        ->and((float) $shift->starting_cash)->toBe(500000.0)
        ->and($shift->shift_number)->toStartWith('SHF-');

    // Attempt double open
    $this->actingAs($cashier)
        ->post(route('pos.shifts.open'), [
            'register_name' => 'Kasir 2',
            'starting_cash' => 200000,
        ])
        ->assertSessionHasErrors('shift');

    expect(CashierShift::where('user_id', $cashier->id)->count())->toBe(1);

    // Shared activeShift prop exists on Inertia response
    $this->actingAs($cashier)
        ->get(route('pos.shifts.index'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('POS/Shifts/CashierShift')
            ->where('activeShift.id', $shift->id)
            ->where('activeShift.register_name', 'Kasir 1')
            ->missing('activeShiftDetail.expected_cash')
        );
});

it('blocks access via EnsureHasOpenShift middleware when user has no open shift', function () {
    Route::middleware(['web', 'auth', 'shift.open'])->get('/_test/pos-checkout', fn () => response('OK'));

    $cashier = User::factory()->create(['role' => UserRoles::Cashier]);

    $this->actingAs($cashier)
        ->get('/_test/pos-checkout')
        ->assertRedirect(route('pos.shifts.index'));

    CashierShift::factory()->create([
        'user_id' => $cashier->id,
        'status' => CashierShiftStatus::Open,
    ]);

    $this->actingAs($cashier)
        ->get('/_test/pos-checkout')
        ->assertOk()
        ->assertSee('OK');
});

it('requires supervisor PIN for cashier cash drop and syncs balance to financial accounts', function () {
    $accounts = seedShiftFinancialAccounts();

    $supervisor = User::factory()->create([
        'role' => UserRoles::Supervisor,
        'pin' => '123456',
        'is_active' => true,
    ]);
    $cashier = User::factory()->create(['role' => UserRoles::Cashier]);
    $shift = CashierShift::factory()->create([
        'user_id' => $cashier->id,
        'status' => CashierShiftStatus::Open,
        'starting_cash' => 500000,
    ]);

    // Missing PIN should fail
    $this->actingAs($cashier)
        ->post(route('pos.shifts.movements.store', $shift), [
            'type' => ShiftCashMovementType::CashDrop->value,
            'amount' => 300000,
            'reason' => 'Setor uang tunai ke brankas',
            'financial_account_id' => $accounts['safe']->id,
        ])
        ->assertSessionHasErrors('supervisor_pin');

    // Wrong PIN should fail
    $this->actingAs($cashier)
        ->post(route('pos.shifts.movements.store', $shift), [
            'type' => ShiftCashMovementType::CashDrop->value,
            'amount' => 300000,
            'reason' => 'Setor uang tunai ke brankas',
            'financial_account_id' => $accounts['safe']->id,
            'supervisor_pin' => '999999',
        ])
        ->assertSessionHasErrors('supervisor_pin');

    // Valid supervisor PIN succeeds & updates safe balance
    $this->actingAs($cashier)
        ->post(route('pos.shifts.movements.store', $shift), [
            'type' => ShiftCashMovementType::CashDrop->value,
            'amount' => 300000,
            'reason' => 'Setor uang tunai ke brankas',
            'financial_account_id' => $accounts['safe']->id,
            'supervisor_pin' => '123456',
        ])
        ->assertSessionHasNoErrors();

    $accounts['safe']->refresh();
    $shift->refresh();

    expect((float) $accounts['safe']->current_balance)->toBe(1300000.0)
        ->and((float) $shift->total_cash_drop)->toBe(300000.0)
        ->and($shift->cashMovements()->first()?->approved_by)->toBe($supervisor->id)
        ->and(FinancialTransaction::where('financial_account_id', $accounts['safe']->id)->count())->toBe(1);
});

it('performs blind closing, computes variance, enforces notes and PIN on large variance, and syncs finance', function () {
    $accounts = seedShiftFinancialAccounts();

    $supervisor = User::factory()->create([
        'role' => UserRoles::Supervisor,
        'pin' => '654321',
        'is_active' => true,
    ]);
    $cashier = User::factory()->create(['role' => UserRoles::Cashier]);
    $shift = CashierShift::factory()->create([
        'user_id' => $cashier->id,
        'status' => CashierShiftStatus::Open,
        'starting_cash' => 500000,
    ]);

    // Add 1 cash sale (400.000) and 1 QRIS sale (250.000)
    Transaction::create([
        'invoice_number' => 'INV-001',
        'user_id' => $cashier->id,
        'cashier_shift_id' => $shift->id,
        'total_amount' => 400000,
        'discount' => 0,
        'grand_total' => 400000,
        'pay_amount' => 400000,
        'change_amount' => 0,
        'payment_method' => PaymentMethod::Cash->value,
        'status' => 'completed',
    ]);

    Transaction::create([
        'invoice_number' => 'INV-002',
        'user_id' => $cashier->id,
        'cashier_shift_id' => $shift->id,
        'total_amount' => 250000,
        'discount' => 0,
        'grand_total' => 250000,
        'pay_amount' => 250000,
        'change_amount' => 0,
        'payment_method' => PaymentMethod::Qris->value,
        'status' => 'completed',
    ]);

    // Mid-shift cash drop of 100.000 (safe becomes 1.100.000)
    $this->actingAs($cashier)
        ->post(route('pos.shifts.movements.store', $shift), [
            'type' => ShiftCashMovementType::CashDrop->value,
            'amount' => 100000,
            'reason' => 'Drop tengah shift',
            'financial_account_id' => $accounts['safe']->id,
            'supervisor_pin' => '654321',
        ])
        ->assertSessionHasNoErrors();

    // Expected cash = 500.000 + 400.000 - 100.000 = 800.000
    // Try closing with 750.000 (-50.000 variance) without notes -> error on closing_notes
    $this->actingAs($cashier)
        ->post(route('pos.shifts.close', $shift), [
            'actual_cash' => 750000,
        ])
        ->assertSessionHasErrors('closing_notes');

    // With notes but without PIN (variance 50.000 > threshold 10.000) -> error on supervisor_pin
    $this->actingAs($cashier)
        ->post(route('pos.shifts.close', $shift), [
            'actual_cash' => 750000,
            'closing_notes' => 'Salah kembalian',
        ])
        ->assertSessionHasErrors('supervisor_pin');

    // With notes + valid supervisor PIN + denomination breakdown -> succeeds!
    $this->actingAs($cashier)
        ->post(route('pos.shifts.close', $shift), [
            'actual_cash' => 750000,
            'denomination_breakdown' => [
                ['denomination' => 100000, 'qty' => 7, 'subtotal' => 700000],
                ['denomination' => 50000, 'qty' => 1, 'subtotal' => 50000],
            ],
            'closing_notes' => 'Salah kembalian Rp 50.000',
            'supervisor_pin' => '654321',
        ])
        ->assertRedirect(route('pos.shifts.show', $shift));

    $shift->refresh();
    $accounts['safe']->refresh();
    $accounts['bank']->refresh();

    // Net cash deposit at close = actual (750.000) - starting (500.000) = 250.000
    // Safe balance = 1.000.000 + 100.000 (drop) + 250.000 (close) = 1.350.000
    // Bank balance = 5.000.000 + 250.000 (QRIS) = 5.250.000
    expect($shift->status)->toBe(CashierShiftStatus::Closed)
        ->and((float) $shift->expected_cash)->toBe(800000.0)
        ->and((float) $shift->actual_cash)->toBe(750000.0)
        ->and((float) $shift->cash_variance)->toBe(-50000.0)
        ->and((float) $shift->total_cash_sales)->toBe(400000.0)
        ->and((float) $shift->total_non_cash_sales)->toBe(250000.0)
        ->and($shift->total_transactions)->toBe(2)
        ->and($shift->verified_by)->toBe($supervisor->id)
        ->and((float) $accounts['safe']->current_balance)->toBe(1350000.0)
        ->and((float) $accounts['bank']->current_balance)->toBe(5250000.0)
        ->and(Activity::where('log_name', 'cashier_shift')->where('event', 'closed')->exists())->toBeTrue();
});

it('enforces role policies so warehouse cannot access shifts and cashier cannot view other cashiers shifts', function () {
    $warehouse = User::factory()->create(['role' => UserRoles::Warehouse]);
    $cashierA = User::factory()->create(['role' => UserRoles::Cashier]);
    $cashierB = User::factory()->create(['role' => UserRoles::Cashier]);
    $shiftA = CashierShift::factory()->create(['user_id' => $cashierA->id]);

    $this->actingAs($warehouse)
        ->get(route('pos.shifts.index'))
        ->assertForbidden();

    $this->actingAs($cashierB)
        ->get(route('pos.shifts.show', $shiftA))
        ->assertForbidden();

    // Blind closing check on detail page while open for cashierA
    $this->actingAs($cashierA)
        ->get(route('pos.shifts.show', $shiftA))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->where('canRevealFinancials', false)
            ->where('shift.expected_cash', null)
        );
});

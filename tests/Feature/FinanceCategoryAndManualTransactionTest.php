<?php

use App\Enums\ActivityLogCategory;
use App\Enums\FinancialAccountType;
use App\Enums\FinancialCategoryType;
use App\Enums\FinancialTransactionType;
use App\Enums\UserRoles;
use App\Models\FinancialAccount;
use App\Models\FinancialCategory;
use App\Models\FinancialTransaction;
use App\Models\User;
use App\Services\Reports\FinanceReportService;
use App\Services\Reports\ProfitLossReportService;
use Spatie\Activitylog\Models\Activity;

test('admin can perform CRUD on financial categories while non-admin roles receive 403', function () {
    $admin = User::factory()->create(['role' => UserRoles::Admin]);
    $supervisor = User::factory()->create(['role' => UserRoles::Supervisor]);
    $cashier = User::factory()->create(['role' => UserRoles::Cashier]);
    $warehouse = User::factory()->create(['role' => UserRoles::Warehouse]);

    // Non-admin forbidden
    foreach ([$supervisor, $cashier, $warehouse] as $user) {
        $this->actingAs($user)->get(route('pos.finance.categories.index'))->assertForbidden();
        $this->actingAs($user)->post(route('pos.finance.categories.store'), [
            'name' => 'Test Forbidden',
            'type' => FinancialCategoryType::Expense->value,
        ])->assertForbidden();
    }

    // Admin create
    $this->actingAs($admin)
        ->post(route('pos.finance.categories.store'), [
            'name' => 'Biaya Kebersihan',
            'type' => FinancialCategoryType::Expense->value,
            'description' => 'Iuran sampah dan kebersihan',
            'is_active' => true,
        ])
        ->assertRedirect(route('pos.finance.categories.index'));

    $category = FinancialCategory::query()->where('name', 'Biaya Kebersihan')->firstOrFail();
    expect($category->code)->toStartWith('EXP-')
        ->and($category->is_system)->toBeFalse()
        ->and($category->is_active)->toBeTrue();

    // Activity log recorded
    expect(Activity::forSubject($category)->where('event', 'created')->exists())->toBeTrue();

    // Admin update
    $this->actingAs($admin)
        ->patch(route('pos.finance.categories.update', $category), [
            'code' => $category->code,
            'name' => 'Biaya Kebersihan & Keamanan',
            'type' => FinancialCategoryType::Expense->value,
            'is_active' => true,
        ])
        ->assertRedirect(route('pos.finance.categories.index'));

    expect($category->fresh()->name)->toBe('Biaya Kebersihan & Keamanan');

    // Admin delete (unused non-system category)
    $this->actingAs($admin)
        ->delete(route('pos.finance.categories.destroy', $category))
        ->assertRedirect(route('pos.finance.categories.index'));

    expect($category->fresh()->trashed())->toBeTrue();
});

test('protects system categories and used categories from deletion and type changes', function () {
    $admin = User::factory()->create(['role' => UserRoles::Admin]);

    $systemCat = FinancialCategory::create([
        'code' => 'EXP-PO',
        'name' => 'Pembelian Stok / Pelunasan Hutang Supplier',
        'type' => FinancialCategoryType::Expense,
        'is_system' => true,
        'is_active' => true,
    ]);

    // System category cannot be deleted
    $this->actingAs($admin)
        ->delete(route('pos.finance.categories.destroy', $systemCat))
        ->assertSessionHasErrors(['category']);

    expect($systemCat->fresh()->trashed())->toBeFalse();

    // System category type cannot be changed
    $this->actingAs($admin)
        ->patch(route('pos.finance.categories.update', $systemCat), [
            'name' => $systemCat->name,
            'type' => FinancialCategoryType::Income->value,
            'is_active' => true,
        ])
        ->assertSessionHasErrors(['type']);

    // Used custom category cannot be deleted or have its type changed
    $account = FinancialAccount::create([
        'code' => 'KAS-CAT-01',
        'name' => 'Brankas Uji',
        'type' => FinancialAccountType::Cash,
        'opening_balance' => 1000000,
        'current_balance' => 1000000,
        'is_active' => true,
    ]);

    $usedCat = FinancialCategory::create([
        'code' => 'EXP-UTL-01',
        'name' => 'Tagihan Listrik',
        'type' => FinancialCategoryType::Expense,
        'is_system' => false,
        'is_active' => true,
    ]);

    FinancialTransaction::create([
        'financial_account_id' => $account->id,
        'financial_category_id' => $usedCat->id,
        'type' => FinancialTransactionType::Out,
        'amount' => 150000,
        'balance_before' => 1000000,
        'balance_after' => 850000,
        'transaction_date' => now()->toDateString(),
        'description' => 'Bayar listrik',
        'created_by' => $admin->id,
    ]);

    $this->actingAs($admin)
        ->delete(route('pos.finance.categories.destroy', $usedCat))
        ->assertSessionHasErrors(['category']);

    $this->actingAs($admin)
        ->patch(route('pos.finance.categories.update', $usedCat), [
            'name' => 'Tagihan Listrik',
            'type' => FinancialCategoryType::Income->value,
            'is_active' => true,
        ])
        ->assertSessionHasErrors(['type']);

    // Deactivating a used custom category IS allowed
    $this->actingAs($admin)
        ->patch(route('pos.finance.categories.update', $usedCat), [
            'name' => 'Tagihan Listrik',
            'type' => FinancialCategoryType::Expense->value,
            'is_active' => false,
        ])
        ->assertSessionHasNoErrors()
        ->assertRedirect();

    expect($usedCat->fresh()->is_active)->toBeFalse();
});

test('records manual expense and income transactions accurately, updates balances, logs activity, and feeds Phase 3 reports', function () {
    $admin = User::factory()->create(['role' => UserRoles::Admin]);

    $account = FinancialAccount::create([
        'code' => 'KAS-MAN-01',
        'name' => 'Brankas Operasional',
        'type' => FinancialAccountType::Cash,
        'opening_balance' => 2000000,
        'current_balance' => 2000000,
        'is_active' => true,
    ]);

    $expenseCat = FinancialCategory::create([
        'code' => 'EXP-LISTRIK',
        'name' => 'Listrik & Air',
        'type' => FinancialCategoryType::Expense,
        'is_system' => false,
        'is_active' => true,
    ]);

    $incomeCat = FinancialCategory::create([
        'code' => 'INC-SEWA-PARKIR',
        'name' => 'Sewa Lahan Parkir',
        'type' => FinancialCategoryType::Income,
        'is_system' => false,
        'is_active' => true,
    ]);

    $today = now()->toDateString();

    // Record manual expense (Rp 350.000)
    $this->actingAs($admin)
        ->post(route('pos.finance.transactions.store'), [
            'financial_account_id' => $account->id,
            'financial_category_id' => $expenseCat->id,
            'type' => FinancialTransactionType::Out->value,
            'amount' => 350000,
            'transaction_date' => $today,
            'reference_number' => 'PLN-2026-11',
            'description' => 'Tagihan listrik PLN bulan ini',
        ])
        ->assertRedirect(route('pos.finance.transactions.index'));

    expect((float) $account->fresh()->current_balance)->toBe(1650000.0);

    // Record manual income (Rp 250.000)
    $this->actingAs($admin)
        ->post(route('pos.finance.transactions.store'), [
            'financial_account_id' => $account->id,
            'financial_category_id' => $incomeCat->id,
            'type' => FinancialTransactionType::In->value,
            'amount' => 250000,
            'transaction_date' => $today,
            'reference_number' => 'PRK-2026-11',
            'description' => 'Setoran sewa lahan parkir bulanan',
        ])
        ->assertRedirect(route('pos.finance.transactions.index'));

    expect((float) $account->fresh()->current_balance)->toBe(1900000.0);

    $expenseTx = FinancialTransaction::query()->where('reference_number', 'PLN-2026-11')->firstOrFail();
    expect($expenseTx->isManual())->toBeTrue()
        ->and($expenseTx->resolveSource()['code'])->toBe('manual');

    // Verify Activity Log
    $log = Activity::forSubject($expenseTx)->where('log_name', ActivityLogCategory::Finance->value)->first();
    expect($log)->not->toBeNull()
        ->and($log->description)->toContain('Listrik & Air');

    // Verify Phase 3 FinanceReportService reflects manual income & expense
    $financeReport = app(FinanceReportService::class)->getReportData([
        'preset' => 'custom',
        'start_date' => $today,
        'end_date' => $today,
    ], false);

    expect($financeReport['summary']['total_income'])->toBe(250000.0)
        ->and($financeReport['summary']['total_expense'])->toBe(350000.0)
        ->and($financeReport['summary']['net_cashflow'])->toBe(-100000.0);

    // Verify Phase 3 ProfitLossReportService operational_expense includes manual expense
    $plReport = app(ProfitLossReportService::class)->getReportData([
        'preset' => 'custom',
        'start_date' => $today,
        'end_date' => $today,
    ], false);

    expect($plReport['summary']['operational_expense'])->toBe(350000.0)
        ->and($plReport['summary']['estimated_operating_profit'])->toBe(-350000.0);
});

test('rejects invalid manual transactions (mismatched category type, inactive account/category, insufficient balance, auto-system category) and blocks non-admin', function () {
    $admin = User::factory()->create(['role' => UserRoles::Admin]);
    $supervisor = User::factory()->create(['role' => UserRoles::Supervisor]);
    $cashier = User::factory()->create(['role' => UserRoles::Cashier]);

    $account = FinancialAccount::create([
        'code' => 'KAS-VAL-01',
        'name' => 'Kas Kecil',
        'type' => FinancialAccountType::Cash,
        'opening_balance' => 100000,
        'current_balance' => 100000,
        'is_active' => true,
    ]);

    $inactiveAccount = FinancialAccount::create([
        'code' => 'KAS-VAL-02',
        'name' => 'Kas Nonaktif',
        'type' => FinancialAccountType::Cash,
        'opening_balance' => 500000,
        'current_balance' => 500000,
        'is_active' => false,
    ]);

    $incomeCat = FinancialCategory::create([
        'code' => 'INC-VAL-01',
        'name' => 'Pendapatan Lain',
        'type' => FinancialCategoryType::Income,
        'is_system' => false,
        'is_active' => true,
    ]);

    $expenseCat = FinancialCategory::create([
        'code' => 'EXP-VAL-01',
        'name' => 'Biaya ATK',
        'type' => FinancialCategoryType::Expense,
        'is_system' => false,
        'is_active' => true,
    ]);

    $inactiveCat = FinancialCategory::create([
        'code' => 'EXP-VAL-OFF',
        'name' => 'Biaya Nonaktif',
        'type' => FinancialCategoryType::Expense,
        'is_system' => false,
        'is_active' => false,
    ]);

    $autoSalesCat = FinancialCategory::create([
        'code' => 'INC-SALES',
        'name' => 'Penjualan Kasir (POS)',
        'type' => FinancialCategoryType::Income,
        'is_system' => true,
        'is_active' => true,
    ]);

    $today = now()->toDateString();

    // Mismatched type (expense transaction with income category)
    $this->actingAs($admin)
        ->post(route('pos.finance.transactions.store'), [
            'financial_account_id' => $account->id,
            'financial_category_id' => $incomeCat->id,
            'type' => FinancialTransactionType::Out->value,
            'amount' => 50000,
            'transaction_date' => $today,
            'description' => 'Salah tipe kategori',
        ])
        ->assertSessionHasErrors(['financial_category_id']);

    // Inactive account
    $this->actingAs($admin)
        ->post(route('pos.finance.transactions.store'), [
            'financial_account_id' => $inactiveAccount->id,
            'financial_category_id' => $expenseCat->id,
            'type' => FinancialTransactionType::Out->value,
            'amount' => 50000,
            'transaction_date' => $today,
            'description' => 'Akun nonaktif',
        ])
        ->assertSessionHasErrors(['financial_account_id']);

    // Inactive category
    $this->actingAs($admin)
        ->post(route('pos.finance.transactions.store'), [
            'financial_account_id' => $account->id,
            'financial_category_id' => $inactiveCat->id,
            'type' => FinancialTransactionType::Out->value,
            'amount' => 50000,
            'transaction_date' => $today,
            'description' => 'Kategori nonaktif',
        ])
        ->assertSessionHasErrors(['financial_category_id']);

    // Auto-system category (INC-SALES) rejected for manual input
    $this->actingAs($admin)
        ->post(route('pos.finance.transactions.store'), [
            'financial_account_id' => $account->id,
            'financial_category_id' => $autoSalesCat->id,
            'type' => FinancialTransactionType::In->value,
            'amount' => 50000,
            'transaction_date' => $today,
            'description' => 'Mencoba pakai kategori sistem POS',
        ])
        ->assertSessionHasErrors(['financial_category_id']);

    // Insufficient balance for expense
    $this->actingAs($admin)
        ->post(route('pos.finance.transactions.store'), [
            'financial_account_id' => $account->id,
            'financial_category_id' => $expenseCat->id,
            'type' => FinancialTransactionType::Out->value,
            'amount' => 250000,
            'transaction_date' => $today,
            'description' => 'Saldo tidak cukup',
        ])
        ->assertSessionHasErrors(['amount']);

    expect((float) $account->fresh()->current_balance)->toBe(100000.0);

    // Non-admin (including Supervisor & Cashier) receive 403 Forbidden
    foreach ([$supervisor, $cashier] as $nonAdmin) {
        $this->actingAs($nonAdmin)->get(route('pos.finance.transactions.index'))->assertForbidden();
        $this->actingAs($nonAdmin)
            ->post(route('pos.finance.transactions.store'), [
                'financial_account_id' => $account->id,
                'financial_category_id' => $expenseCat->id,
                'type' => FinancialTransactionType::Out->value,
                'amount' => 10000,
                'transaction_date' => $today,
                'description' => 'Percobaan non-admin',
            ])
            ->assertForbidden();
    }
});

<?php

namespace App\Http\Controllers;

use App\Enums\FinancialAccountType;
use App\Http\Requests\StoreFinancialAccountRequest;
use App\Http\Requests\UpdateFinancialAccountRequest;
use App\Models\FinancialAccount;
use App\Services\FinanceService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;
use Inertia\Response;

class FinancialAccountController extends Controller
{
    public function index(Request $request): Response
    {
        Gate::authorize('viewAny', FinancialAccount::class);

        $filters = $request->only([
            'search',
            'type',
            'status',
            'sort',
            'direction',
            'table_sort',
            'table_direction',
        ]);
        $perPage = $request->integer('per_page', 10);

        $allowedSorts = ['code', 'name', 'type', 'current_balance', 'is_active', 'created_at'];

        $tableSort = $request->input('table_sort');
        $tableDirection = strtolower((string) $request->input('table_direction')) === 'desc' ? 'desc' : 'asc';
        $hasTableSort = ! empty($tableSort) && in_array($tableSort, $allowedSorts, true);

        $toolbarSort = $request->input('sort');
        $toolbarDirection = strtolower((string) $request->input('direction')) === 'asc' ? 'asc' : 'desc';
        $hasToolbarSort = ! empty($toolbarSort) && in_array($toolbarSort, $allowedSorts, true);

        $query = FinancialAccount::query()
            ->withCount('transactions')
            ->when($request->search, function ($query, $search) {
                $query->where(function ($q) use ($search) {
                    $q->where('name', 'ilike', "%{$search}%")
                        ->orWhere('code', 'ilike', "%{$search}%")
                        ->orWhere('account_number', 'ilike', "%{$search}%")
                        ->orWhere('bank_name', 'ilike', "%{$search}%");
                });
            })
            ->when($request->type && $request->type !== 'all', function ($query) use ($request) {
                $query->where('type', $request->type);
            })
            ->when($request->status && $request->status !== 'all', function ($query) use ($request) {
                if ($request->status === 'active') {
                    $query->where('is_active', true);
                } elseif ($request->status === 'inactive') {
                    $query->where('is_active', false);
                }
            });

        if ($hasTableSort) {
            $query->orderBy($tableSort, $tableDirection);
        }

        if ($hasToolbarSort && (! $hasTableSort || $toolbarSort !== $tableSort)) {
            $query->orderBy($toolbarSort, $toolbarDirection);
        }

        if (! $hasTableSort && ! $hasToolbarSort) {
            $query->orderByDesc('is_default')->orderBy('code');
        }

        $accounts = $query->paginate($perPage)
            ->withQueryString()
            ->through(fn (FinancialAccount $acc) => [
                'id' => $acc->id,
                'code' => $acc->code,
                'name' => $acc->name,
                'type' => $acc->type->value,
                'type_label' => $acc->type->label(),
                'account_number' => $acc->account_number,
                'bank_name' => $acc->bank_name,
                'opening_balance' => (float) $acc->opening_balance,
                'current_balance' => (float) $acc->current_balance,
                'is_default' => (bool) $acc->is_default,
                'is_active' => (bool) $acc->is_active,
                'notes' => $acc->notes,
                'transactions_count' => (int) $acc->transactions_count,
                'created_at' => $acc->created_at?->format('d M Y'),
            ]);

        $activeAccounts = FinancialAccount::where('is_active', true)->get(['type', 'current_balance']);
        $summary = [
            'total_balance' => (float) $activeAccounts->sum('current_balance'),
            'cash_balance' => (float) $activeAccounts->where('type', FinancialAccountType::Cash)->sum('current_balance'),
            'bank_balance' => (float) $activeAccounts->where('type', FinancialAccountType::Bank)->sum('current_balance'),
            'ewallet_balance' => (float) $activeAccounts->where('type', FinancialAccountType::Ewallet)->sum('current_balance'),
        ];

        return Inertia::render('POS/Finance/FinancialAccount', [
            'accounts' => $accounts,
            'filters' => $filters,
            'summary' => $summary,
            'accountTypes' => collect(FinancialAccountType::cases())->map(fn ($t) => [
                'value' => $t->value,
                'label' => $t->label(),
            ]),
        ]);
    }

    public function store(StoreFinancialAccountRequest $request, FinanceService $financeService): RedirectResponse
    {
        $account = $financeService->createAccount($request->validated());

        return redirect()->route('pos.finance.accounts.index')
            ->with('success', "Akun keuangan {$account->name} berhasil ditambahkan.");
    }

    public function update(
        UpdateFinancialAccountRequest $request,
        FinancialAccount $financialAccount,
        FinanceService $financeService
    ): RedirectResponse {
        $account = $financeService->updateAccount($financialAccount, $request->validated());

        return redirect()->route('pos.finance.accounts.index')
            ->with('success', "Akun keuangan {$account->name} berhasil diperbarui.");
    }

    public function destroy(FinancialAccount $financialAccount, FinanceService $financeService): RedirectResponse
    {
        Gate::authorize('delete', $financialAccount);

        $name = $financialAccount->name;
        $financeService->deleteAccount($financialAccount);

        return redirect()->route('pos.finance.accounts.index')
            ->with('success', "Akun keuangan {$name} berhasil dihapus.");
    }
}

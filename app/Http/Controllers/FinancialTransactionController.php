<?php

namespace App\Http\Controllers;

use App\Enums\FinancialTransactionType;
use App\Http\Requests\StoreFinancialTransactionRequest;
use App\Models\FinancialAccount;
use App\Models\FinancialCategory;
use App\Models\FinancialTransaction;
use App\Models\User;
use App\Services\FinanceService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;
use Inertia\Response;

class FinancialTransactionController extends Controller
{
    public function index(Request $request): Response
    {
        Gate::authorize('viewAny', FinancialTransaction::class);

        $filters = $request->only([
            'search',
            'financial_account_id',
            'financial_category_id',
            'type',
            'start_date',
            'end_date',
            'sort',
            'direction',
            'table_sort',
            'table_direction',
        ]);
        $perPage = $request->integer('per_page', 15);

        $allowedSorts = ['transaction_number', 'transaction_date', 'type', 'amount', 'balance_after', 'created_at'];

        $tableSort = $request->input('table_sort');
        $tableDirection = strtolower((string) $request->input('table_direction')) === 'asc' ? 'asc' : 'desc';
        $hasTableSort = ! empty($tableSort) && in_array($tableSort, $allowedSorts, true);

        $toolbarSort = $request->input('sort');
        $toolbarDirection = strtolower((string) $request->input('direction')) === 'asc' ? 'asc' : 'desc';
        $hasToolbarSort = ! empty($toolbarSort) && in_array($toolbarSort, $allowedSorts, true);

        $likeOperator = DB::getDriverName() === 'pgsql' ? 'ilike' : 'like';

        $baseQuery = FinancialTransaction::query()
            ->when($request->search, function ($query, $search) use ($likeOperator): void {
                $term = trim((string) $search);
                $query->where(function ($q) use ($term, $likeOperator): void {
                    $q->where('transaction_number', $likeOperator, "%{$term}%")
                        ->orWhere('reference_number', $likeOperator, "%{$term}%")
                        ->orWhere('description', $likeOperator, "%{$term}%");
                });
            })
            ->when($request->financial_account_id && $request->financial_account_id !== 'all', function ($query) use ($request): void {
                $query->where('financial_account_id', $request->financial_account_id);
            })
            ->when($request->financial_category_id && $request->financial_category_id !== 'all', function ($query) use ($request): void {
                $query->where('financial_category_id', $request->financial_category_id);
            })
            ->when($request->type && $request->type !== 'all', function ($query) use ($request): void {
                $query->where('type', $request->type);
            })
            ->when($request->start_date, function ($query, $date): void {
                $query->whereDate('transaction_date', '>=', (string) $date);
            })
            ->when($request->end_date, function ($query, $date): void {
                $query->whereDate('transaction_date', '<=', (string) $date);
            });

        $summaryRow = FinancialTransaction::query()
            ->when($request->filled('start_date'), function ($query) use ($request): void {
                $query->whereDate('transaction_date', '>=', (string) $request->input('start_date'));
            })
            ->when($request->filled('end_date'), function ($query) use ($request): void {
                $query->whereDate('transaction_date', '<=', (string) $request->input('end_date'));
            })
            ->selectRaw(
                'COUNT(*) as total_transactions,
                COUNT(*) FILTER (WHERE type = ?) as in_count,
                COUNT(*) FILTER (WHERE type = ?) as out_count,
                COALESCE(SUM(amount) FILTER (WHERE type = ?), 0) as total_in,
                COALESCE(SUM(amount) FILTER (WHERE type = ?), 0) as total_out',
                [
                    FinancialTransactionType::In->value,
                    FinancialTransactionType::Out->value,
                    FinancialTransactionType::In->value,
                    FinancialTransactionType::Out->value,
                ]
            )
            ->first();

        $totalIn = round((float) ($summaryRow->total_in ?? 0), 2);
        $totalOut = round((float) ($summaryRow->total_out ?? 0), 2);

        $query = (clone $baseQuery)->with([
            'financialAccount:id,code,name,type',
            'financialCategory:id,code,name,type',
            'creator:id,name',
        ]);

        if ($hasTableSort) {
            $query->orderBy($tableSort, $tableDirection);
        }

        if ($hasToolbarSort && (! $hasTableSort || $toolbarSort !== $tableSort)) {
            $query->orderBy($toolbarSort, $toolbarDirection);
        }

        if (! $hasTableSort && ! $hasToolbarSort) {
            $query->orderByDesc('transaction_date')->orderByDesc('id');
        } else {
            $query->orderByDesc('id');
        }

        $transactions = $query->paginate($perPage)
            ->withQueryString()
            ->through(function (FinancialTransaction $tx): array {
                $source = $tx->resolveSource();

                return [
                    'id' => $tx->id,
                    'transaction_number' => $tx->transaction_number,
                    'transaction_date' => $tx->transaction_date->format('d M Y'),
                    'type' => $tx->type->value,
                    'type_label' => $tx->type->label(),
                    'amount' => (float) $tx->amount,
                    'balance_before' => (float) $tx->balance_before,
                    'balance_after' => (float) $tx->balance_after,
                    'reference_number' => $tx->reference_number,
                    'source_code' => $source['code'],
                    'source_label' => $source['label'],
                    'description' => $tx->description,
                    'account_name' => $tx->financialAccount?->name ?? '-',
                    'account_code' => $tx->financialAccount?->code ?? '-',
                    'category_name' => $tx->financialCategory?->name ?? '-',
                    'creator_name' => $tx->creator?->name ?? 'Sistem',
                    'created_at' => $tx->created_at?->format('d M Y H:i') ?? '-',
                ];
            });

        $accounts = FinancialAccount::withTrashed()
            ->orderBy('name')
            ->get(['id', 'code', 'name', 'is_active']);

        $activeAccounts = FinancialAccount::query()
            ->where('is_active', true)
            ->orderByDesc('is_default')
            ->orderBy('name')
            ->get(['id', 'code', 'name', 'type', 'current_balance', 'is_default'])
            ->map(fn (FinancialAccount $acc): array => [
                'id' => $acc->id,
                'code' => $acc->code,
                'name' => $acc->name,
                'type' => $acc->type->value,
                'type_label' => $acc->type->label(),
                'current_balance' => (float) $acc->current_balance,
                'is_default' => (bool) $acc->is_default,
            ])
            ->values();

        $categories = FinancialCategory::orderBy('type')->orderBy('name')
            ->get(['id', 'code', 'name', 'type']);

        $manualCategories = FinancialCategory::query()
            ->active()
            ->whereNotIn('code', FinanceService::AUTO_SYSTEM_CATEGORY_CODES)
            ->orderBy('type')
            ->orderBy('name')
            ->get(['id', 'code', 'name', 'type'])
            ->map(fn (FinancialCategory $cat): array => [
                'id' => $cat->id,
                'code' => $cat->code,
                'name' => $cat->name,
                'type' => $cat->type->value,
            ])
            ->values();

        return Inertia::render('POS/Finance/FinancialTransaction', [
            'transactions' => $transactions,
            'filters' => $filters,
            'summary' => [
                'total_transactions' => (int) ($summaryRow->total_transactions ?? 0),
                'in_count' => (int) ($summaryRow->in_count ?? 0),
                'out_count' => (int) ($summaryRow->out_count ?? 0),
                'total_in' => $totalIn,
                'total_out' => $totalOut,
                'net_flow' => round($totalIn - $totalOut, 2),
            ],
            'accounts' => $accounts,
            'activeAccounts' => $activeAccounts,
            'categories' => $categories,
            'manualCategories' => $manualCategories,
            'transactionTypes' => collect(FinancialTransactionType::cases())->map(fn (FinancialTransactionType $t): array => [
                'value' => $t->value,
                'label' => $t->label(),
            ])->values(),
            'canCreate' => $request->user()?->can('create', FinancialTransaction::class) ?? false,
        ]);
    }

    public function store(StoreFinancialTransactionRequest $request, FinanceService $financeService): RedirectResponse
    {
        /** @var User $actor */
        $actor = $request->user();

        /** @var array{
         *     financial_account_id: int|string,
         *     financial_category_id: int|string,
         *     type: string,
         *     amount: float|int|string,
         *     transaction_date: string,
         *     reference_number?: string|null,
         *     description: string
         * } $validated */
        $validated = $request->validated();

        $transaction = $financeService->recordManualTransaction($validated, $actor);

        return redirect()->route('pos.finance.transactions.index')
            ->with('success', "Transaksi {$transaction->transaction_number} berhasil dicatat dan saldo akun diperbarui.");
    }
}

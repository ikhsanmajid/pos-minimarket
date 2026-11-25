<?php

namespace App\Http\Controllers;

use App\Enums\FinancialTransactionType;
use App\Enums\UserRoles;
use App\Models\FinancialAccount;
use App\Models\FinancialCategory;
use App\Models\FinancialTransaction;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class FinancialTransactionController extends Controller
{
    public function index(Request $request): Response
    {
        if (! $request->user()?->hasRoles([UserRoles::Admin, UserRoles::Supervisor])) {
            abort(403, 'Akses tidak diizinkan.');
        }

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

        $baseQuery = FinancialTransaction::query()
            ->when($request->search, function ($query, $search) {
                $query->where(function ($q) use ($search) {
                    $q->where('transaction_number', 'ilike', "%{$search}%")
                        ->orWhere('description', 'ilike', "%{$search}%");
                });
            })
            ->when($request->financial_account_id && $request->financial_account_id !== 'all', function ($query) use ($request) {
                $query->where('financial_account_id', $request->financial_account_id);
            })
            ->when($request->financial_category_id && $request->financial_category_id !== 'all', function ($query) use ($request) {
                $query->where('financial_category_id', $request->financial_category_id);
            })
            ->when($request->type && $request->type !== 'all', function ($query) use ($request) {
                $query->where('type', $request->type);
            })
            ->when($request->start_date, function ($query, $date) {
                $query->whereDate('transaction_date', '>=', $date);
            })
            ->when($request->end_date, function ($query, $date) {
                $query->whereDate('transaction_date', '<=', $date);
            });

        $totalIn = (float) (clone $baseQuery)->where('type', FinancialTransactionType::In->value)->sum('amount');
        $totalOut = (float) (clone $baseQuery)->where('type', FinancialTransactionType::Out->value)->sum('amount');

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
            ->through(fn (FinancialTransaction $tx) => [
                'id' => $tx->id,
                'transaction_number' => $tx->transaction_number,
                'transaction_date' => $tx->transaction_date?->format('d M Y'),
                'type' => $tx->type->value,
                'type_label' => $tx->type->label(),
                'amount' => (float) $tx->amount,
                'balance_before' => (float) $tx->balance_before,
                'balance_after' => (float) $tx->balance_after,
                'description' => $tx->description,
                'account_name' => $tx->financialAccount?->name ?? '-',
                'account_code' => $tx->financialAccount?->code ?? '-',
                'category_name' => $tx->financialCategory?->name ?? '-',
                'creator_name' => $tx->creator?->name ?? 'Sistem',
                'created_at' => $tx->created_at?->format('d M Y H:i'),
            ]);

        $accounts = FinancialAccount::withTrashed()
            ->orderBy('name')
            ->get(['id', 'code', 'name', 'is_active']);

        $categories = FinancialCategory::orderBy('type')->orderBy('name')
            ->get(['id', 'code', 'name', 'type']);

        return Inertia::render('POS/Finance/FinancialTransaction', [
            'transactions' => $transactions,
            'filters' => $filters,
            'summary' => [
                'total_in' => $totalIn,
                'total_out' => $totalOut,
                'net_flow' => round($totalIn - $totalOut, 2),
            ],
            'accounts' => $accounts,
            'categories' => $categories,
            'transactionTypes' => collect(FinancialTransactionType::cases())->map(fn ($t) => [
                'value' => $t->value,
                'label' => $t->label(),
            ]),
        ]);
    }
}

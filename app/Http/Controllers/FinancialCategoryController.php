<?php

namespace App\Http\Controllers;

use App\Enums\FinancialCategoryType;
use App\Http\Requests\StoreFinancialCategoryRequest;
use App\Http\Requests\UpdateFinancialCategoryRequest;
use App\Models\FinancialCategory;
use App\Services\FinanceService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;
use Inertia\Response;

class FinancialCategoryController extends Controller
{
    public function __construct(public FinanceService $financeService) {}

    public function index(Request $request): Response
    {
        Gate::authorize('viewAny', FinancialCategory::class);

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

        $allowedSorts = ['code', 'name', 'type', 'transactions_count', 'is_active', 'created_at'];

        $tableSort = $request->input('table_sort');
        $tableDirection = strtolower((string) $request->input('table_direction')) === 'desc' ? 'desc' : 'asc';
        $hasTableSort = ! empty($tableSort) && in_array($tableSort, $allowedSorts, true);

        $toolbarSort = $request->input('sort');
        $toolbarDirection = strtolower((string) $request->input('direction')) === 'asc' ? 'asc' : 'desc';
        $hasToolbarSort = ! empty($toolbarSort) && in_array($toolbarSort, $allowedSorts, true);

        $likeOperator = DB::getDriverName() === 'pgsql' ? 'ilike' : 'like';

        $query = FinancialCategory::query()
            ->withCount('transactions')
            ->when($request->search, function ($query, $search) use ($likeOperator): void {
                $term = trim((string) $search);
                $query->where(function ($q) use ($term, $likeOperator): void {
                    $q->where('name', $likeOperator, "%{$term}%")
                        ->orWhere('code', $likeOperator, "%{$term}%")
                        ->orWhere('description', $likeOperator, "%{$term}%");
                });
            })
            ->when($request->type && $request->type !== 'all', function ($query) use ($request): void {
                $query->where('type', $request->type);
            })
            ->when($request->status && $request->status !== 'all', function ($query) use ($request): void {
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
            $query->orderByDesc('is_system')->orderBy('type')->orderBy('code');
        }

        $categories = $query->paginate($perPage)
            ->withQueryString()
            ->through(fn (FinancialCategory $cat): array => [
                'id' => $cat->id,
                'code' => $cat->code,
                'name' => $cat->name,
                'type' => $cat->type->value,
                'type_label' => $cat->type->label(),
                'is_system' => (bool) $cat->is_system,
                'is_active' => (bool) $cat->is_active,
                'description' => $cat->description,
                'transactions_count' => (int) ($cat->transactions_count ?? 0),
                'created_at' => $cat->created_at?->format('d M Y'),
            ]);

        return Inertia::render('POS/Finance/FinancialCategory', [
            'categories' => $categories,
            'filters' => $filters,
            'summary' => $this->financeService->getCategorySummary(),
            'categoryTypes' => collect(FinancialCategoryType::cases())->map(fn (FinancialCategoryType $t): array => [
                'value' => $t->value,
                'label' => $t->label(),
            ])->values(),
        ]);
    }

    public function store(StoreFinancialCategoryRequest $request): RedirectResponse
    {
        $category = $this->financeService->createCategory($request->validated());

        return redirect()->route('pos.finance.categories.index')
            ->with('success', "Kategori keuangan {$category->name} ({$category->code}) berhasil ditambahkan.");
    }

    public function update(UpdateFinancialCategoryRequest $request, FinancialCategory $financialCategory): RedirectResponse
    {
        $category = $this->financeService->updateCategory($financialCategory, $request->validated());

        return redirect()->route('pos.finance.categories.index')
            ->with('success', "Kategori keuangan {$category->name} berhasil diperbarui.");
    }

    public function destroy(FinancialCategory $financialCategory): RedirectResponse
    {
        Gate::authorize('delete', $financialCategory);

        $name = $financialCategory->name;
        $this->financeService->deleteCategory($financialCategory);

        return redirect()->route('pos.finance.categories.index')
            ->with('success', "Kategori keuangan {$name} berhasil dihapus.");
    }
}

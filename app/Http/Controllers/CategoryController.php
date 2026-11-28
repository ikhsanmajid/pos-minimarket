<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreCategoryRequest;
use App\Http\Requests\UpdateCategoryRequest;
use App\Models\Category;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;
use Inertia\Response;

class CategoryController extends Controller
{
    public function index(Request $request): Response
    {
        Gate::authorize('viewAny', Category::class);

        $filters = $request->only([
            'search',
            'status',
            'sort',
            'direction',
            'table_sort',
            'table_direction',
        ]);
        $perPage = $request->integer('per_page', 10);

        // Sorting definitions
        $allowedTableSorts = ['code', 'name', 'products_count', 'is_active'];
        $allowedToolbarSorts = ['code', 'name', 'products_count', 'is_active', 'created_at'];

        $tableSort = $request->input('table_sort');
        $tableDirection = strtolower((string) $request->input('table_direction')) === 'desc' ? 'desc' : 'asc';
        $hasTableSort = ! empty($tableSort) && in_array($tableSort, $allowedTableSorts, true);

        $toolbarSort = $request->input('sort');
        $toolbarDirection = strtolower((string) $request->input('direction')) === 'asc' ? 'asc' : 'desc';
        $hasToolbarSort = ! empty($toolbarSort) && in_array($toolbarSort, $allowedToolbarSorts, true);

        $query = Category::query()
            ->withCount('products')
            ->when($request->search, function ($query, $search) {
                $query->where(function ($q) use ($search) {
                    $q->where('name', 'ilike', "%{$search}%")
                        ->orWhere('code', 'ilike', "%{$search}%");
                });
            })
            ->when($request->status && $request->status !== 'all', function ($query) use ($request) {
                $isActive = match ($request->status) {
                    'active' => true,
                    'inactive' => false,
                    default => null,
                };
                if ($isActive !== null) {
                    $query->where('is_active', $isActive);
                }
            });

        // Multi-column sorting:
        // 1. Table header sort is the primary sort (if active)
        if ($hasTableSort) {
            $query->orderBy($tableSort, $tableDirection);
        }

        // 2. Toolbar select sort is the secondary sort (or primary if table sort is not active)
        if ($hasToolbarSort && (! $hasTableSort || $toolbarSort !== $tableSort)) {
            $query->orderBy($toolbarSort, $toolbarDirection);
        }

        // Fallback default sorting if neither is active, or tie-breaker for deterministic pagination
        if (! $hasTableSort && ! $hasToolbarSort) {
            $query->latest();
        } elseif (($hasTableSort && $tableSort !== 'created_at') && (! $hasToolbarSort || $toolbarSort !== 'created_at')) {
            $query->orderBy('id', 'desc');
        }

        $categories = $query->paginate($perPage)
            ->withQueryString()
            ->through(fn (Category $category) => [
                'id' => $category->id,
                'code' => $category->code,
                'name' => $category->name,
                'slug' => $category->slug,
                'description' => $category->description,
                'is_active' => (bool) $category->is_active,
                'products_count' => (int) $category->products_count,
                'created_at' => $category->created_at?->format('d M Y'),
            ]);

        $summaryRow = Category::query()
            ->selectRaw(
                'COUNT(*) as total_categories,
                COUNT(*) FILTER (WHERE is_active = true) as active_categories,
                COUNT(*) FILTER (WHERE is_active = false) as inactive_categories,
                COUNT(*) FILTER (WHERE NOT EXISTS (SELECT 1 FROM products WHERE products.category_id = categories.id AND products.deleted_at IS NULL)) as empty_categories,
                (SELECT COUNT(*) FROM products WHERE products.category_id IS NOT NULL AND products.deleted_at IS NULL) as categorized_products_count'
            )
            ->first();

        $summary = [
            'total_categories' => (int) ($summaryRow->total_categories ?? 0),
            'active_categories' => (int) ($summaryRow->active_categories ?? 0),
            'inactive_categories' => (int) ($summaryRow->inactive_categories ?? 0),
            'empty_categories' => (int) ($summaryRow->empty_categories ?? 0),
            'categorized_products_count' => (int) ($summaryRow->categorized_products_count ?? 0),
        ];

        return Inertia::render('POS/Categories/Category', [
            'categories' => $categories,
            'filters' => $filters,
            'summary' => $summary,
        ]);
    }

    public function search(Request $request): JsonResponse
    {
        Gate::authorize('viewAny', Category::class);

        $search = trim((string) $request->input('search', $request->input('q', '')));
        $onlyActive = $request->boolean('only_active', true);

        $categories = Category::query()
            ->when($onlyActive, function ($query) {
                $query->where('is_active', true);
            })
            ->when($search !== '', function ($query) use ($search) {
                $query->where(function ($q) use ($search) {
                    $q->where('name', 'ilike', "%{$search}%")
                        ->orWhere('code', 'ilike', "%{$search}%");
                });
            })
            ->orderBy('name')
            ->limit(25)
            ->get(['id', 'name'])
            ->map(fn (Category $cat) => [
                'value' => $cat->id,
                'label' => $cat->name,
            ]);

        return response()->json($categories);
    }

    public function store(StoreCategoryRequest $request): RedirectResponse
    {
        $data = $request->validated();

        Category::create($data);

        return back()->with('success', 'Kategori berhasil ditambahkan.');
    }

    public function update(UpdateCategoryRequest $request, Category $category): RedirectResponse
    {
        $data = $request->validated();

        $category->update($data);

        return back()->with('success', 'Kategori berhasil diperbarui.');
    }

    public function destroy(Category $category): RedirectResponse
    {
        Gate::authorize('delete', $category);

        if ($category->products()->exists()) {
            return back()->with('error', 'Kategori tidak dapat dihapus karena masih digunakan oleh produk. Silakan nonaktifkan status kategori sebagai gantinya.');
        }

        $category->delete();

        return back()->with('success', 'Kategori berhasil dihapus.');
    }
}

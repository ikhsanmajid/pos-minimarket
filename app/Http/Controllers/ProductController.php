<?php

namespace App\Http\Controllers;

use App\Enums\CustomerTier;
use App\Enums\StockMovementType;
use App\Http\Requests\StoreProductRequest;
use App\Http\Requests\UpdateProductRequest;
use App\Models\Category;
use App\Models\Product;
use App\Models\ProductMemberPrice;
use App\Models\ProductPriceTier;
use App\Models\ProductUnit;
use App\Models\StockMovement;
use App\Models\User;
use App\Services\ProductUnitService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;
use Inertia\Response;
use Spatie\Activitylog\Models\Activity;

class ProductController extends Controller
{
    public function index(Request $request): Response
    {
        Gate::authorize('viewAny', Product::class);

        $canViewStock = $request->user()?->can('viewStock', Product::class) ?? false;

        $filters = $request->only([
            'search',
            'status',
            'tax_status',
            'category_id',
            'stock_status',
            'sort',
            'direction',
            'table_sort',
            'table_direction',
        ]);

        if (! $canViewStock) {
            unset($filters['stock_status']);
            if (($filters['sort'] ?? null) === 'stock') {
                unset($filters['sort'], $filters['direction']);
            }
            if (($filters['table_sort'] ?? null) === 'stock') {
                unset($filters['table_sort'], $filters['table_direction']);
            }
        }

        $perPage = $request->integer('per_page', 10);

        $allowedTableSorts = $canViewStock
            ? ['name', 'barcode', 'buy_price', 'sell_price', 'stock', 'active', 'is_tax_exempt']
            : ['name', 'barcode', 'buy_price', 'sell_price', 'active', 'is_tax_exempt'];
        $allowedToolbarSorts = $canViewStock
            ? ['name', 'barcode', 'buy_price', 'sell_price', 'stock', 'active', 'is_tax_exempt', 'created_at']
            : ['name', 'barcode', 'buy_price', 'sell_price', 'active', 'is_tax_exempt', 'created_at'];

        $tableSort = $request->input('table_sort');
        $tableDirection = strtolower((string) $request->input('table_direction')) === 'desc' ? 'desc' : 'asc';
        $hasTableSort = ! empty($tableSort) && in_array($tableSort, $allowedTableSorts, true);

        $toolbarSort = $request->input('sort');
        $toolbarDirection = strtolower((string) $request->input('direction')) === 'asc' ? 'asc' : 'desc';
        $hasToolbarSort = ! empty($toolbarSort) && in_array($toolbarSort, $allowedToolbarSorts, true);

        $query = Product::with(['category', 'units'])
            ->when($request->search, function ($query, $search) {
                $query->where(function ($q) use ($search) {
                    $q->where('name', 'ilike', "%{$search}%")
                        ->orWhere('barcode', 'ilike', "%{$search}%")
                        ->orWhereHas('units', function ($u) use ($search) {
                            $u->where('barcode', 'ilike', "%{$search}%");
                        });
                });
            })
            ->when($request->category_id && $request->category_id !== 'all', function ($query) use ($request) {
                $query->where('category_id', $request->category_id);
            })
            ->when($request->status && $request->status !== 'all', function ($query) use ($request) {
                $isActive = match ($request->status) {
                    'active' => true,
                    'inactive' => false,
                    default => null,
                };

                if (! is_null($isActive)) {
                    $query->where('active', $isActive);
                }
            })
            ->when($request->tax_status && $request->tax_status !== 'all', function ($query) use ($request) {
                if ($request->tax_status === 'donation') {
                    $query->where('is_donation', true);

                    return;
                }

                $isTaxExempt = match ($request->tax_status) {
                    'exempt' => true,
                    'taxable' => false,
                    default => null,
                };

                if (! is_null($isTaxExempt)) {
                    $query->where('is_tax_exempt', $isTaxExempt);
                }
            })
            ->when($canViewStock && $request->stock_status && $request->stock_status !== 'all', function ($query) use ($request) {
                match ($request->stock_status) {
                    'out_of_stock' => $query->where('stock', '<=', 0),
                    'low_stock' => $query->where('stock', '>', 0)->whereColumn('stock', '<=', 'min_stock'),
                    'in_stock' => $query->whereColumn('stock', '>', 'min_stock'),
                    default => null,
                };
            });

        if ($hasTableSort) {
            $query->orderBy($tableSort, $tableDirection);
        }

        if ($hasToolbarSort && (! $hasTableSort || $toolbarSort !== $tableSort)) {
            $query->orderBy($toolbarSort, $toolbarDirection);
        }

        if (! $hasTableSort && ! $hasToolbarSort) {
            $query->orderBy('created_at', 'desc');
        } elseif (($hasTableSort && $tableSort !== 'created_at') && (! $hasToolbarSort || $toolbarSort !== 'created_at')) {
            $query->orderBy('id', 'desc');
        }

        $products = $query->paginate($perPage)
            ->withQueryString()
            ->through(fn (Product $product) => [
                'id' => $product->id,
                'category_id' => $product->category_id,
                'barcode' => $product->barcode,
                'name' => $product->name,
                'base_unit' => $product->base_unit ?: 'pcs',
                'category' => $product->category?->name,
                'buy_price' => $product->buy_price,
                'sell_price' => $product->sell_price,
                'stock' => $canViewStock ? $product->stock : null,
                'min_stock' => $canViewStock ? $product->min_stock : null,
                'image' => $product->image ? asset('storage/'.$product->image) : null,
                'active' => (bool) $product->active,
                'is_tax_exempt' => (bool) $product->is_tax_exempt,
                'is_donation' => (bool) $product->is_donation,
                'units' => $product->units->map(fn (ProductUnit $unit) => [
                    'id' => $unit->id,
                    'unit_name' => $unit->unit_name,
                    'conversion_factor' => (int) $unit->conversion_factor,
                    'barcode' => $unit->barcode,
                    'buy_price' => (float) $unit->buy_price,
                    'sell_price' => $unit->sell_price !== null ? (float) $unit->sell_price : null,
                    'is_default_purchase' => (bool) $unit->is_default_purchase,
                    'is_active' => (bool) $unit->is_active,
                ])->values()->all(),
            ]);

        $categories = Category::orderBy('name')->get(['id', 'name', 'is_active']);

        $summaryRow = Product::query()
            ->selectRaw(
                'COUNT(*) as total_products,
                COUNT(*) FILTER (WHERE active = true) as active_products,
                COUNT(*) FILTER (WHERE stock > min_stock) as safe_stock_count,
                COUNT(*) FILTER (WHERE stock > 0 AND stock <= min_stock) as low_stock_count,
                COUNT(*) FILTER (WHERE stock <= 0) as out_of_stock_count,
                (SELECT COUNT(*) FROM product_units WHERE product_units.is_active = true AND EXISTS (SELECT 1 FROM products p WHERE p.id = product_units.product_id AND p.deleted_at IS NULL)) as active_units_count'
            )
            ->first();

        $summary = [
            'total_products' => (int) ($summaryRow->total_products ?? 0),
            'active_products' => (int) ($summaryRow->active_products ?? 0),
            'safe_stock_count' => $canViewStock ? (int) ($summaryRow->safe_stock_count ?? 0) : null,
            'low_stock_count' => $canViewStock ? (int) ($summaryRow->low_stock_count ?? 0) : null,
            'out_of_stock_count' => $canViewStock ? (int) ($summaryRow->out_of_stock_count ?? 0) : null,
            'active_units_count' => (int) ($summaryRow->active_units_count ?? 0),
        ];

        return Inertia::render('POS/Product/Product', [
            'products' => $products,
            'filters' => $filters,
            'categories' => $categories,
            'summary' => $summary,
            'canViewStock' => $canViewStock,
        ]);
    }

    public function create(): RedirectResponse
    {
        return redirect()->route('pos.products.index');
    }

    public function store(StoreProductRequest $request, ProductUnitService $productUnitService): RedirectResponse
    {
        Gate::authorize('insertProduk', Product::class);

        $data = $request->validated();
        $units = $data['units'] ?? [];

        if ($request->hasFile('image')) {
            $data['image'] = $request->file('image')->store('products', 'public');
        }

        $productUnitService->createProductWithUnits($data, $units);

        return redirect()->route('pos.products.index')
            ->with('success', 'Produk berhasil ditambahkan.');
    }

    public function show(Request $request, Product $product): Response
    {
        Gate::authorize('view', $product);

        $canViewStock = $request->user()?->can('viewStock', Product::class) ?? false;
        $canManagePriceTiers = $request->user()?->can('update', $product) ?? false;

        $product->load(['category', 'units', 'priceTiers.productUnit', 'memberPrices.productUnit']);

        return Inertia::render('POS/Product/DetailProduct', [
            'canViewStock' => $canViewStock,
            'canManagePriceTiers' => $canManagePriceTiers,
            'tierOptions' => CustomerTier::options(),
            'product' => [
                'id' => $product->id,
                'category_id' => $product->category_id,
                'category_name' => $product->category?->name,
                'barcode' => $product->barcode,
                'name' => $product->name,
                'base_unit' => $product->base_unit ?: 'pcs',
                'buy_price' => $product->buy_price,
                'sell_price' => $product->sell_price,
                'stock' => $canViewStock ? $product->stock : null,
                'min_stock' => $canViewStock ? $product->min_stock : null,
                'image' => $product->image ? asset('storage/'.$product->image) : null,
                'active' => (bool) $product->active,
                'is_tax_exempt' => (bool) $product->is_tax_exempt,
                'tax_mode' => $product->effectiveTaxMode()->value,
                'is_donation' => (bool) $product->is_donation,
                'is_promo_excluded' => (bool) $product->is_promo_excluded,
                'created_at' => $product->created_at?->format('d M Y H:i'),
                'updated_at' => $product->updated_at?->format('d M Y H:i'),
                'units' => $product->units->map(fn (ProductUnit $unit) => [
                    'id' => $unit->id,
                    'unit_name' => $unit->unit_name,
                    'conversion_factor' => (int) $unit->conversion_factor,
                    'barcode' => $unit->barcode,
                    'buy_price' => (float) $unit->buy_price,
                    'sell_price' => $unit->sell_price !== null ? (float) $unit->sell_price : null,
                    'is_default_purchase' => (bool) $unit->is_default_purchase,
                    'is_active' => (bool) $unit->is_active,
                ])->values()->all(),
                'price_tiers' => $product->priceTiers->map(fn (ProductPriceTier $tier) => [
                    'id' => $tier->id,
                    'product_id' => $tier->product_id,
                    'product_unit_id' => $tier->product_unit_id,
                    'unit_name' => $tier->productUnit?->unit_name ?? ($product->base_unit ?: 'pcs'),
                    'min_qty' => (int) $tier->min_qty,
                    'unit_price' => (float) $tier->unit_price,
                    'is_active' => (bool) $tier->is_active,
                ])->values()->all(),
                'member_prices' => $product->memberPrices->map(fn (ProductMemberPrice $mp) => [
                    'id' => $mp->id,
                    'product_id' => $mp->product_id,
                    'product_unit_id' => $mp->product_unit_id,
                    'unit_name' => $mp->productUnit?->unit_name ?? ($product->base_unit ?: 'pcs'),
                    'tier' => $mp->tier?->value,
                    'tier_label' => $mp->tier?->label() ?? 'Semua Member',
                    'member_price' => (float) $mp->member_price,
                    'is_active' => (bool) $mp->is_active,
                ])->values()->all(),
            ],
            'stockMovements' => Inertia::optional(function () use ($request, $product, $canViewStock) {
                if (! $canViewStock) {
                    return null;
                }

                $perPage = $request->integer('mutation_per_page', 15);
                $likeOperator = DB::getDriverName() === 'pgsql' ? 'ilike' : 'like';

                $mutationFilters = $request->only([
                    'mutation_search',
                    'mutation_type',
                    'mutation_direction',
                    'mutation_start_date',
                    'mutation_end_date',
                    'mutation_sort',
                    'mutation_sort_dir',
                    'mutation_table_sort',
                    'mutation_table_dir',
                ]);

                $allowedSorts = ['created_at', 'type', 'stock_before', 'qty_change', 'stock_after', 'unit_cost'];

                $tableSort = $request->input('mutation_table_sort');
                $tableDirection = strtolower((string) $request->input('mutation_table_dir')) === 'desc' ? 'desc' : 'asc';
                $hasTableSort = ! empty($tableSort) && in_array($tableSort, $allowedSorts, true);

                $toolbarSort = $request->input('mutation_sort');
                $toolbarDirection = strtolower((string) $request->input('mutation_sort_dir')) === 'asc' ? 'asc' : 'desc';
                $hasToolbarSort = ! empty($toolbarSort) && in_array($toolbarSort, $allowedSorts, true);

                $query = StockMovement::where('product_id', $product->id)
                    ->with('creator:id,name')
                    ->when($request->filled('mutation_search'), function ($query) use ($request, $likeOperator): void {
                        $search = trim((string) $request->input('mutation_search'));
                        $query->where(function ($q) use ($search, $likeOperator): void {
                            $q->where('notes', $likeOperator, "%{$search}%")
                                ->orWhereHas('creator', function ($creatorQuery) use ($search, $likeOperator): void {
                                    $creatorQuery->where('name', $likeOperator, "%{$search}%");
                                });
                        });
                    })
                    ->when($request->filled('mutation_type') && $request->input('mutation_type') !== 'all', function ($query) use ($request): void {
                        $type = (string) $request->input('mutation_type');
                        $matchingTypes = match ($type) {
                            StockMovementType::Sale->value, StockMovementType::SaleOut->value => [
                                StockMovementType::Sale->value,
                                StockMovementType::SaleOut->value,
                            ],
                            StockMovementType::SaleReturn->value, StockMovementType::SaleReturnIn->value => [
                                StockMovementType::SaleReturn->value,
                                StockMovementType::SaleReturnIn->value,
                            ],
                            default => [$type],
                        };

                        $query->whereIn('type', $matchingTypes);
                    })
                    ->when($request->filled('mutation_direction') && $request->input('mutation_direction') !== 'all', function ($query) use ($request): void {
                        match ($request->input('mutation_direction')) {
                            'in' => $query->where('qty_change', '>', 0),
                            'out' => $query->where('qty_change', '<', 0),
                            default => null,
                        };
                    })
                    ->when($request->filled('mutation_start_date'), function ($query) use ($request): void {
                        $query->whereDate('created_at', '>=', (string) $request->input('mutation_start_date'));
                    })
                    ->when($request->filled('mutation_end_date'), function ($query) use ($request): void {
                        $query->whereDate('created_at', '<=', (string) $request->input('mutation_end_date'));
                    });

                if ($hasTableSort) {
                    $query->orderBy($tableSort, $tableDirection);
                }

                if ($hasToolbarSort && (! $hasTableSort || $toolbarSort !== $tableSort)) {
                    $query->orderBy($toolbarSort, $toolbarDirection);
                }

                if (! $hasTableSort && ! $hasToolbarSort) {
                    $query->latest('id');
                } else {
                    $query->orderBy('id', 'desc');
                }

                $paginated = $query
                    ->paginate($perPage, ['*'], 'mutation_page')
                    ->withQueryString();

                $typeOptions = [
                    ['value' => StockMovementType::PurchaseIn->value, 'label' => StockMovementType::PurchaseIn->label()],
                    ['value' => StockMovementType::Sale->value, 'label' => StockMovementType::Sale->label()],
                    ['value' => StockMovementType::SaleVoid->value, 'label' => StockMovementType::SaleVoid->label()],
                    ['value' => StockMovementType::SaleReturn->value, 'label' => StockMovementType::SaleReturn->label()],
                    ['value' => StockMovementType::AdjustmentIn->value, 'label' => StockMovementType::AdjustmentIn->label()],
                    ['value' => StockMovementType::AdjustmentOut->value, 'label' => StockMovementType::AdjustmentOut->label()],
                    ['value' => StockMovementType::Opname->value, 'label' => StockMovementType::Opname->label()],
                    ['value' => StockMovementType::PurchaseReturnOut->value, 'label' => StockMovementType::PurchaseReturnOut->label()],
                ];

                return [
                    'data' => collect($paginated->items())->map(fn (StockMovement $movement) => [
                        'id' => $movement->id,
                        'type' => $movement->type->value,
                        'type_label' => $movement->type->label(),
                        'stock_before' => (int) $movement->stock_before,
                        'qty_change' => (int) $movement->qty_change,
                        'stock_after' => (int) $movement->stock_after,
                        'unit_cost' => (float) $movement->unit_cost,
                        'notes' => $movement->notes,
                        'creator_name' => $movement->creator?->name ?? 'Sistem',
                        'created_at' => $movement->created_at?->format('d M Y H:i:s'),
                    ])->all(),
                    'filters' => $mutationFilters,
                    'type_options' => $typeOptions,
                    'current_page' => $paginated->currentPage(),
                    'last_page' => $paginated->lastPage(),
                    'per_page' => $paginated->perPage(),
                    'total' => $paginated->total(),
                    'from' => $paginated->firstItem(),
                    'to' => $paginated->lastItem(),
                ];
            }),
            'activities' => Inertia::optional(function () use ($request, $product) {
                $perPage = $request->integer('per_page', 10);
                $driver = DB::getDriverName();

                $paginated = Activity::forSubject($product)
                    ->where(function ($query) use ($driver): void {
                        $query->whereNull('event')
                            ->orWhere('event', '!=', 'updated');

                        if ($driver === 'pgsql') {
                            $query->orWhereRaw(
                                "((COALESCE(attribute_changes::jsonb -> 'attributes', properties::jsonb -> 'attributes', '{}'::jsonb) - 'stock') <> '{}'::jsonb OR (COALESCE(attribute_changes::jsonb -> 'old', properties::jsonb -> 'old', '{}'::jsonb) - 'stock') <> '{}'::jsonb)"
                            );
                        } else {
                            $query->orWhereRaw(
                                "(json_remove(COALESCE(json_extract(attribute_changes, '$.attributes'), json_extract(properties, '$.attributes'), '{}'), '$.stock') <> '{}' OR json_remove(COALESCE(json_extract(attribute_changes, '$.old'), json_extract(properties, '$.old'), '{}'), '$.stock') <> '{}')"
                            );
                        }
                    })
                    ->with('causer')
                    ->latest('id')
                    ->paginate($perPage)
                    ->withQueryString();

                $categoryIds = collect($paginated->items())
                    ->flatMap(function (Activity $act) {
                        $changes = $act->attribute_changes?->toArray() ?? [];
                        $props = $act->properties?->toArray() ?? [];
                        $old = $changes['old'] ?? $props['old'] ?? [];
                        $new = $changes['attributes'] ?? $props['attributes'] ?? [];

                        return array_filter([$old['category_id'] ?? null, $new['category_id'] ?? null]);
                    })
                    ->unique()
                    ->filter()
                    ->values();

                $categoryMap = Category::withTrashed()
                    ->whereIn('id', $categoryIds)
                    ->pluck('name', 'id')
                    ->all();

                return [
                    'data' => collect($paginated->items())->map(fn (Activity $act) => [
                        'id' => $act->id,
                        'description' => $act->description,
                        'event' => $act->event,
                        'causer_name' => $act->causer instanceof User ? $act->causer->name : ($act->causer_id ? 'User #'.$act->causer_id : 'Sistem'),
                        'causer_role' => $act->causer instanceof User ? ($act->causer->role?->label() ?? $act->causer->role?->value) : null,
                        'attribute_changes' => $this->stripStockFromActivityPayload($act->attribute_changes?->toArray() ?? []),
                        'properties' => $this->stripStockFromActivityPayload($act->properties?->toArray() ?? []),
                        'category_map' => $categoryMap,
                        'created_at' => $act->created_at?->format('d M Y H:i:s'),
                        'created_at_human' => $act->created_at?->diffForHumans(),
                    ])->all(),
                    'category_map' => $categoryMap,
                    'current_page' => $paginated->currentPage(),
                    'last_page' => $paginated->lastPage(),
                    'per_page' => $paginated->perPage(),
                    'total' => $paginated->total(),
                    'from' => $paginated->firstItem(),
                    'to' => $paginated->lastItem(),
                ];
            }),
        ]);
    }

    public function edit(Product $product): Response
    {
        Gate::authorize('update', $product);

        $product->load('units');
        $categories = Category::orderBy('name')->get(['id', 'name']);

        return Inertia::render('POS/Product/EditProduct', [
            'product' => [
                'id' => $product->id,
                'category_id' => $product->category_id,
                'barcode' => $product->barcode,
                'name' => $product->name,
                'base_unit' => $product->base_unit ?: 'pcs',
                'buy_price' => $product->buy_price,
                'sell_price' => $product->sell_price,
                'stock' => $product->stock,
                'min_stock' => $product->min_stock,
                'image' => $product->image ? asset('storage/'.$product->image) : null,
                'active' => (bool) $product->active,
                'is_tax_exempt' => (bool) $product->is_tax_exempt,
                'is_donation' => (bool) $product->is_donation,
                'units' => $product->units->map(fn (ProductUnit $unit) => [
                    'id' => $unit->id,
                    'unit_name' => $unit->unit_name,
                    'conversion_factor' => (int) $unit->conversion_factor,
                    'barcode' => $unit->barcode,
                    'buy_price' => (float) $unit->buy_price,
                    'sell_price' => $unit->sell_price !== null ? (float) $unit->sell_price : null,
                    'is_default_purchase' => (bool) $unit->is_default_purchase,
                    'is_active' => (bool) $unit->is_active,
                ])->values()->all(),
            ],
            'categories' => $categories,
        ]);
    }

    public function update(UpdateProductRequest $request, Product $product, ProductUnitService $productUnitService): RedirectResponse
    {
        $data = $request->validated();
        $units = array_key_exists('units', $data) ? ($data['units'] ?? []) : null;

        if ($request->hasFile('image')) {
            $data['image'] = $request->file('image')->store('products', 'public');
        } else {
            unset($data['image']);
        }

        $productUnitService->updateProductWithUnits($product, $data, $units);

        return redirect()->route('pos.products.index')
            ->with('success', 'Data produk berhasil diperbarui.');
    }

    public function search(Request $request): JsonResponse
    {
        Gate::authorize('viewAny', Product::class);

        $canViewStock = $request->user()?->can('viewStock', Product::class) ?? false;
        $search = trim((string) $request->input('search', $request->input('q', '')));
        $onlyActive = $request->boolean('only_active', true);

        $products = Product::query()
            ->with(['category:id,name', 'activeUnits'])
            ->when($onlyActive, function ($query) {
                $query->where('active', true);
            })
            ->when($search !== '', function ($query) use ($search) {
                $query->where(function ($q) use ($search) {
                    $q->where('name', 'ilike', "%{$search}%")
                        ->orWhere('barcode', 'ilike', "%{$search}%")
                        ->orWhereHas('units', function ($u) use ($search) {
                            $u->where('barcode', 'ilike', "%{$search}%");
                        });
                });
            })
            ->orderBy('name')
            ->limit(25)
            ->get(['id', 'name', 'base_unit', 'barcode', 'buy_price', 'sell_price', 'stock', 'min_stock', 'category_id', 'is_tax_exempt', 'is_donation'])
            ->map(function (Product $p) use ($canViewStock): array {
                $item = [
                    'value' => $p->id,
                    'label' => $canViewStock
                        ? "{$p->name} ({$p->barcode}) - Stok: {$p->stock} ".($p->base_unit ?: 'pcs')
                        : "{$p->name} ({$p->barcode})",
                    'id' => $p->id,
                    'name' => $p->name,
                    'base_unit' => $p->base_unit ?: 'pcs',
                    'barcode' => $p->barcode,
                    'buy_price' => (float) $p->buy_price,
                    'sell_price' => (float) $p->sell_price,
                    'is_tax_exempt' => (bool) $p->is_tax_exempt,
                    'is_donation' => (bool) $p->is_donation,
                    'category_name' => $p->category?->name ?? '-',
                    'units' => $p->activeUnits->map(fn (ProductUnit $unit) => [
                        'id' => $unit->id,
                        'unit_name' => $unit->unit_name,
                        'conversion_factor' => (int) $unit->conversion_factor,
                        'barcode' => $unit->barcode,
                        'buy_price' => (float) $unit->buy_price,
                        'sell_price' => $unit->sell_price !== null ? (float) $unit->sell_price : null,
                        'is_default_purchase' => (bool) $unit->is_default_purchase,
                    ])->values()->all(),
                ];

                if ($canViewStock) {
                    $item['stock'] = (int) $p->stock;
                    $item['min_stock'] = (int) $p->min_stock;
                }

                return $item;
            });

        return response()->json($products);
    }

    public function destroy(Product $product): RedirectResponse
    {
        Gate::authorize('delete', $product);

        $product->delete();

        return redirect()->route('pos.products.index')
            ->with('success', 'Produk berhasil dihapus.');
    }

    /**
     * Hapus atribut stock dari payload log aktivitas produk karena perubahan stok dicatat di mutasi stok.
     *
     * @param  array<string, mixed>  $payload
     * @return array<string, mixed>
     */
    private function stripStockFromActivityPayload(array $payload): array
    {
        foreach (['attributes', 'old'] as $section) {
            if (isset($payload[$section]) && is_array($payload[$section])) {
                unset($payload[$section]['stock']);
            }
        }

        return $payload;
    }
}

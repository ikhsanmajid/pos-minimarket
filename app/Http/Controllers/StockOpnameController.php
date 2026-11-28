<?php

namespace App\Http\Controllers;

use App\Enums\StockOpnameStatus;
use App\Http\Requests\StoreStockOpnameRequest;
use App\Http\Requests\UpdateStockOpnameCountsRequest;
use App\Models\Category;
use App\Models\StockOpname;
use App\Models\StockOpnameItem;
use App\Models\User;
use App\Services\StockOpnameService;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response as HttpResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;
use Inertia\Response;

class StockOpnameController extends Controller
{
    public function __construct(public StockOpnameService $stockOpnameService) {}

    public function index(Request $request): Response
    {
        Gate::authorize('viewAny', StockOpname::class);

        $filters = $request->only([
            'search',
            'status',
            'category_id',
            'sort',
            'direction',
            'table_sort',
            'table_direction',
        ]);

        $perPage = $request->integer('per_page', 10);
        $likeOperator = DB::getDriverName() === 'pgsql' ? 'ilike' : 'like';

        $allowedSorts = ['created_at', 'opname_number', 'status', 'total_items_counted', 'total_variance_items', 'total_variance_value'];

        $tableSort = $request->input('table_sort');
        $tableDirection = strtolower((string) $request->input('table_direction')) === 'desc' ? 'desc' : 'asc';
        $hasTableSort = ! empty($tableSort) && in_array($tableSort, $allowedSorts, true);

        $toolbarSort = $request->input('sort');
        $toolbarDirection = strtolower((string) $request->input('direction')) === 'asc' ? 'asc' : 'desc';
        $hasToolbarSort = ! empty($toolbarSort) && in_array($toolbarSort, $allowedSorts, true);

        /** @var User $user */
        $user = $request->user();
        $canReview = $user->can('reviewSystemStock', new StockOpname);

        $query = StockOpname::query()
            ->with(['category:id,name', 'creator:id,name', 'approver:id,name'])
            ->withCount('items')
            ->when($request->filled('search'), function ($q) use ($request, $likeOperator): void {
                $search = trim((string) $request->input('search'));
                $q->where(function ($sub) use ($search, $likeOperator): void {
                    $sub->where('opname_number', $likeOperator, "%{$search}%")
                        ->orWhere('notes', $likeOperator, "%{$search}%");
                });
            })
            ->when($request->filled('status') && $request->input('status') !== 'all', function ($q) use ($request): void {
                $q->where('status', (string) $request->input('status'));
            })
            ->when($request->filled('category_id') && $request->input('category_id') !== 'all', function ($q) use ($request): void {
                if ($request->input('category_id') === 'store') {
                    $q->whereNull('category_id');
                } else {
                    $q->where('category_id', (int) $request->input('category_id'));
                }
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
            $query->orderByDesc('id');
        }

        $opnames = $query->paginate($perPage)
            ->withQueryString()
            ->through(function (StockOpname $opname) use ($canReview): array {
                $hideVariance = $opname->is_blind_count && $opname->status->isEditable() && ! $canReview;

                $row = [
                    'id' => $opname->id,
                    'opname_number' => $opname->opname_number,
                    'status' => $opname->status->value,
                    'status_label' => $opname->status->label(),
                    'category_id' => $opname->category_id,
                    'category_name' => $opname->category?->name ?? 'Seluruh Toko',
                    'is_blind_count' => (bool) $opname->is_blind_count,
                    'notes' => $opname->notes,
                    'total_items' => (int) ($opname->items_count ?? 0),
                    'total_items_counted' => (int) $opname->total_items_counted,
                    'creator_name' => $opname->creator?->name ?? 'Sistem',
                    'approver_name' => $opname->approver?->name,
                    'started_at' => $opname->started_at?->format('d M Y H:i'),
                    'completed_at' => $opname->completed_at?->format('d M Y H:i'),
                    'created_at' => $opname->created_at?->format('d M Y H:i') ?? '-',
                ];

                if (! $hideVariance) {
                    $row['total_variance_items'] = (int) $opname->total_variance_items;
                    $row['total_variance_value'] = round((float) $opname->total_variance_value, 2);
                }

                return $row;
            });

        $categories = Category::query()
            ->where('is_active', true)
            ->orderBy('name')
            ->get(['id', 'name']);

        return Inertia::render('POS/Inventory/StockOpname', [
            'opnames' => $opnames,
            'filters' => $filters,
            'summary' => $this->stockOpnameService->getSummary(),
            'categories' => $categories,
            'canFinalize' => $canReview,
            'statusOptions' => array_map(
                fn (StockOpnameStatus $s): array => ['value' => $s->value, 'label' => $s->label()],
                StockOpnameStatus::cases()
            ),
        ]);
    }

    public function store(StoreStockOpnameRequest $request): RedirectResponse
    {
        Gate::authorize('create', StockOpname::class);

        /** @var User $user */
        $user = $request->user();

        $opname = $this->stockOpnameService->createSession($request->validated(), $user);

        return redirect()->route('pos.inventory.opnames.show', $opname)
            ->with('success', "Sesi Stock Opname {$opname->opname_number} berhasil dibuat.");
    }

    public function show(Request $request, StockOpname $stockOpname): Response
    {
        Gate::authorize('view', $stockOpname);

        /** @var User $user */
        $user = $request->user();

        $stockOpname->load(['category:id,name', 'creator:id,name,role', 'approver:id,name,role']);

        $canFinalize = $user->can('finalize', $stockOpname);
        $canCancel = $user->can('cancel', $stockOpname);
        $canReviewSystem = $user->can('reviewSystemStock', $stockOpname);

        // Blind Count Security: sembunyikan system_stock, variance_qty, variance_value dari payload jika non-Admin/Supervisor
        $hideSystemStock = $stockOpname->is_blind_count
            && $stockOpname->status->isEditable()
            && ! $canReviewSystem;

        $items = $stockOpname->items()
            ->with([
                'product:id,name,barcode,base_unit,category_id',
                'product.category:id,name',
                'counter:id,name',
            ])
            ->orderBy('id')
            ->get()
            ->map(function (StockOpnameItem $item) use ($hideSystemStock): array {
                $row = [
                    'id' => $item->id,
                    'product_id' => $item->product_id,
                    'product_name' => $item->product?->name ?? 'Produk Dihapus',
                    'barcode' => $item->product?->barcode ?? '-',
                    'base_unit' => $item->product?->base_unit ?: 'pcs',
                    'category_name' => $item->product?->category?->name ?? '-',
                    'physical_stock' => $item->physical_stock,
                    'notes' => $item->notes,
                    'counted_by_name' => $item->counter?->name,
                    'counted_at' => $item->counted_at?->format('d M Y H:i'),
                ];

                if (! $hideSystemStock) {
                    $row['system_stock'] = (int) $item->system_stock;
                    $row['variance_qty'] = (int) $item->variance_qty;
                    $row['unit_cost_snapshot'] = round((float) $item->unit_cost_snapshot, 2);
                    $row['variance_value'] = round((float) $item->variance_value, 2);
                }

                return $row;
            })
            ->values()
            ->all();

        $opnamePayload = [
            'id' => $stockOpname->id,
            'opname_number' => $stockOpname->opname_number,
            'status' => $stockOpname->status->value,
            'status_label' => $stockOpname->status->label(),
            'is_editable' => $stockOpname->status->isEditable(),
            'is_locked' => $stockOpname->status->isLocked(),
            'category_id' => $stockOpname->category_id,
            'category_name' => $stockOpname->category?->name ?? 'Seluruh Toko',
            'is_blind_count' => (bool) $stockOpname->is_blind_count,
            'hide_system_stock' => $hideSystemStock,
            'notes' => $stockOpname->notes,
            'creator_name' => $stockOpname->creator?->name ?? 'Sistem',
            'approver_name' => $stockOpname->approver?->name,
            'started_at' => $stockOpname->started_at?->format('d M Y H:i'),
            'completed_at' => $stockOpname->completed_at?->format('d M Y H:i'),
            'cancelled_at' => $stockOpname->cancelled_at?->format('d M Y H:i'),
            'total_items' => count($items),
            'total_items_counted' => (int) $stockOpname->total_items_counted,
        ];

        if (! $hideSystemStock) {
            $opnamePayload['total_variance_items'] = (int) $stockOpname->total_variance_items;
            $opnamePayload['total_variance_value'] = round((float) $stockOpname->total_variance_value, 2);
        }

        return Inertia::render('POS/Inventory/StockOpnameSession', [
            'opname' => $opnamePayload,
            'items' => $items,
            'canFinalize' => $canFinalize,
            'canCancel' => $canCancel,
            'canReviewSystem' => $canReviewSystem,
        ]);
    }

    public function updateCounts(UpdateStockOpnameCountsRequest $request, StockOpname $stockOpname): RedirectResponse
    {
        Gate::authorize('updateCounts', $stockOpname);

        /** @var User $user */
        $user = $request->user();

        $this->stockOpnameService->saveCounts($stockOpname, $request->validated('items'), $user);

        return redirect()->back()
            ->with('success', 'Draf penghitungan stok fisik berhasil disimpan.');
    }

    public function lookupBarcode(Request $request, StockOpname $stockOpname): JsonResponse
    {
        Gate::authorize('view', $stockOpname);

        $barcode = trim((string) $request->input('barcode', ''));
        if ($barcode === '') {
            return response()->json(['found' => false, 'message' => 'Barcode tidak boleh kosong.'], 422);
        }

        /** @var User $user */
        $user = $request->user();
        $canReviewSystem = $user->can('reviewSystemStock', $stockOpname);

        $result = $this->stockOpnameService->lookupBarcodeInSession($stockOpname, $barcode, $canReviewSystem);

        if ($result === null) {
            return response()->json([
                'found' => false,
                'message' => "Barcode \"{$barcode}\" tidak ditemukan dalam daftar produk sesi opname ini.",
            ], 404);
        }

        return response()->json([
            'found' => true,
            'item' => $result,
        ]);
    }

    public function finalize(Request $request, StockOpname $stockOpname): RedirectResponse
    {
        Gate::authorize('finalize', $stockOpname);

        /** @var User $user */
        $user = $request->user();

        $completed = $this->stockOpnameService->finalize($stockOpname, $user);

        return redirect()->route('pos.inventory.opnames.show', $completed)
            ->with('success', "Stock Opname {$completed->opname_number} berhasil difinalisasi dan stok produk telah diperbarui.");
    }

    public function cancel(Request $request, StockOpname $stockOpname): RedirectResponse
    {
        Gate::authorize('cancel', $stockOpname);

        /** @var User $user */
        $user = $request->user();

        $reason = $request->input('reason');
        $cancelled = $this->stockOpnameService->cancel(
            $stockOpname,
            $user,
            is_string($reason) ? $reason : null
        );

        return redirect()->route('pos.inventory.opnames.show', $cancelled)
            ->with('success', "Sesi Stock Opname {$cancelled->opname_number} berhasil dibatalkan.");
    }

    public function downloadPdf(Request $request, StockOpname $stockOpname): HttpResponse
    {
        Gate::authorize('view', $stockOpname);

        if ($stockOpname->status !== StockOpnameStatus::Completed) {
            abort(403, 'Laporan PDF hanya dapat diunduh untuk sesi opname yang sudah selesai.');
        }

        $stockOpname->load([
            'category:id,name',
            'creator:id,name',
            'approver:id,name',
            'items.product:id,name,barcode,base_unit',
        ]);

        $pdf = Pdf::loadView('pdf.stock-opname', [
            'opname' => $stockOpname,
        ])->setPaper('a4', 'portrait');

        return $pdf->stream("Stock-Opname-{$stockOpname->opname_number}.pdf");
    }
}

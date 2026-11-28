<?php

namespace App\Http\Controllers;

use App\Enums\StockAdjustmentReason;
use App\Enums\StockAdjustmentStatus;
use App\Enums\StockAdjustmentType;
use App\Enums\UserRoles;
use App\Http\Requests\RejectStockAdjustmentRequest;
use App\Http\Requests\StoreStockAdjustmentRequest;
use App\Models\Product;
use App\Models\StockAdjustment;
use App\Models\User;
use App\Services\StockAdjustmentService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;
use Inertia\Response;

class StockAdjustmentController extends Controller
{
    public function __construct(public StockAdjustmentService $stockAdjustmentService) {}

    public function index(Request $request): Response
    {
        Gate::authorize('viewAny', StockAdjustment::class);

        $filters = $request->only([
            'search',
            'type',
            'reason',
            'status',
            'start_date',
            'end_date',
            'sort',
            'direction',
            'table_sort',
            'table_direction',
        ]);

        $perPage = $request->integer('per_page', 10);
        $likeOperator = DB::getDriverName() === 'pgsql' ? 'ilike' : 'like';

        $allowedSorts = ['created_at', 'adjustment_number', 'type', 'reason', 'status', 'qty_change', 'total_cost_impact'];

        $tableSort = $request->input('table_sort');
        $tableDirection = strtolower((string) $request->input('table_direction')) === 'desc' ? 'desc' : 'asc';
        $hasTableSort = ! empty($tableSort) && in_array($tableSort, $allowedSorts, true);

        $toolbarSort = $request->input('sort');
        $toolbarDirection = strtolower((string) $request->input('direction')) === 'asc' ? 'asc' : 'desc';
        $hasToolbarSort = ! empty($toolbarSort) && in_array($toolbarSort, $allowedSorts, true);

        $query = StockAdjustment::query()
            ->with([
                'product:id,name,barcode,base_unit,stock',
                'creator:id,name,role',
                'approver:id,name,role',
                'rejecter:id,name,role',
            ])
            ->when($request->filled('search'), function ($q) use ($request, $likeOperator): void {
                $search = trim((string) $request->input('search'));
                $q->where(function ($sub) use ($search, $likeOperator): void {
                    $sub->where('adjustment_number', $likeOperator, "%{$search}%")
                        ->orWhere('notes', $likeOperator, "%{$search}%")
                        ->orWhereHas('product', function ($pq) use ($search, $likeOperator): void {
                            $pq->where('name', $likeOperator, "%{$search}%")
                                ->orWhere('barcode', $likeOperator, "%{$search}%");
                        });
                });
            })
            ->when($request->filled('type') && $request->input('type') !== 'all', function ($q) use ($request): void {
                $q->where('type', (string) $request->input('type'));
            })
            ->when($request->filled('reason') && $request->input('reason') !== 'all', function ($q) use ($request): void {
                $q->where('reason', (string) $request->input('reason'));
            })
            ->when($request->filled('status') && $request->input('status') !== 'all', function ($q) use ($request): void {
                $q->where('status', (string) $request->input('status'));
            })
            ->when($request->filled('start_date'), function ($q) use ($request): void {
                $q->whereDate('created_at', '>=', (string) $request->input('start_date'));
            })
            ->when($request->filled('end_date'), function ($q) use ($request): void {
                $q->whereDate('created_at', '<=', (string) $request->input('end_date'));
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

        /** @var User $user */
        $user = $request->user();
        $canViewStock = $user->can('viewStock', Product::class);

        $adjustments = $query->paginate($perPage)
            ->withQueryString()
            ->through(fn (StockAdjustment $adj): array => [
                'id' => $adj->id,
                'adjustment_number' => $adj->adjustment_number,
                'product_id' => $adj->product_id,
                'product_name' => $adj->product?->name ?? 'Produk Dihapus',
                'product_barcode' => $adj->product?->barcode ?? '-',
                'base_unit' => $adj->product?->base_unit ?: 'pcs',
                'current_product_stock' => $canViewStock ? (int) ($adj->product?->stock ?? 0) : null,
                'type' => $adj->type->value,
                'type_label' => $adj->type->label(),
                'type_short_label' => $adj->type->shortLabel(),
                'reason' => $adj->reason->value,
                'reason_label' => $adj->reason->label(),
                'status' => $adj->status->value,
                'status_label' => $adj->status->label(),
                'qty_before' => $canViewStock ? (int) $adj->qty_before : null,
                'qty_change' => (int) $adj->qty_change,
                'qty_after' => $canViewStock ? (int) $adj->qty_after : null,
                'unit_cost_snapshot' => round((float) $adj->unit_cost_snapshot, 2),
                'total_cost_impact' => round((float) $adj->total_cost_impact, 2),
                'notes' => $adj->notes,
                'creator_name' => $adj->creator?->name ?? 'Sistem',
                'approver_name' => $adj->approver?->name,
                'approved_at' => $adj->approved_at?->format('d M Y H:i'),
                'rejecter_name' => $adj->rejecter?->name,
                'rejected_at' => $adj->rejected_at?->format('d M Y H:i'),
                'rejection_reason' => $adj->rejection_reason,
                'created_at' => $adj->created_at?->format('d M Y H:i') ?? '-',
            ]);

        return Inertia::render('POS/Inventory/StockAdjustment', [
            'adjustments' => $adjustments,
            'filters' => $filters,
            'summary' => $this->stockAdjustmentService->getSummary(),
            'canApprove' => $user->hasRoles([UserRoles::Admin, UserRoles::Supervisor]),
            'canViewStock' => $canViewStock,
            'typeOptions' => array_map(
                fn (StockAdjustmentType $t): array => ['value' => $t->value, 'label' => $t->label()],
                StockAdjustmentType::cases()
            ),
            'reasonOptions' => array_map(
                fn (StockAdjustmentReason $r): array => ['value' => $r->value, 'label' => $r->label()],
                StockAdjustmentReason::cases()
            ),
            'statusOptions' => array_map(
                fn (StockAdjustmentStatus $s): array => ['value' => $s->value, 'label' => $s->label()],
                StockAdjustmentStatus::cases()
            ),
        ]);
    }

    public function store(StoreStockAdjustmentRequest $request): RedirectResponse
    {
        Gate::authorize('create', StockAdjustment::class);

        /** @var User $user */
        $user = $request->user();

        $adjustment = $this->stockAdjustmentService->create($request->validated(), $user);

        $message = $adjustment->status === StockAdjustmentStatus::Approved
            ? "Penyesuaian stok {$adjustment->adjustment_number} berhasil dicatat dan stok diperbarui."
            : "Pengajuan penyesuaian stok {$adjustment->adjustment_number} berhasil dikirim dan menunggu persetujuan Admin/Supervisor.";

        return redirect()->route('pos.inventory.adjustments.index')
            ->with('success', $message);
    }

    public function approve(Request $request, StockAdjustment $stockAdjustment): RedirectResponse
    {
        Gate::authorize('approve', $stockAdjustment);

        /** @var User $user */
        $user = $request->user();

        $approved = $this->stockAdjustmentService->approve($stockAdjustment, $user);

        return redirect()->back()
            ->with('success', "Penyesuaian stok {$approved->adjustment_number} disetujui dan stok produk diperbarui.");
    }

    public function reject(RejectStockAdjustmentRequest $request, StockAdjustment $stockAdjustment): RedirectResponse
    {
        Gate::authorize('reject', $stockAdjustment);

        /** @var User $user */
        $user = $request->user();

        $rejected = $this->stockAdjustmentService->reject(
            $stockAdjustment,
            $user,
            (string) $request->validated('rejection_reason')
        );

        return redirect()->back()
            ->with('success', "Pengajuan penyesuaian stok {$rejected->adjustment_number} ditolak.");
    }
}

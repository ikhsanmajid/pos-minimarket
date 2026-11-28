<?php

namespace App\Http\Controllers;

use App\Enums\PromotionFunding;
use App\Enums\VoucherStatus;
use App\Enums\VoucherType;
use App\Http\Requests\GenerateBulkVouchersRequest;
use App\Http\Requests\StoreVoucherRequest;
use App\Http\Requests\UpdateVoucherRequest;
use App\Models\Category;
use App\Models\Product;
use App\Models\Supplier;
use App\Models\User;
use App\Models\Voucher;
use App\Services\VoucherService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;
use Inertia\Response;

class VoucherController extends Controller
{
    public function __construct(public VoucherService $voucherService) {}

    public function index(Request $request): Response
    {
        Gate::authorize('viewAny', Voucher::class);

        $filters = $request->only([
            'search',
            'status',
            'type',
            'member_only',
            'sort',
            'direction',
            'table_sort',
            'table_direction',
        ]);

        $perPage = $request->integer('per_page', 10);
        $allowedSorts = ['code', 'name', 'type', 'value', 'min_spend', 'used_count', 'valid_from', 'valid_until', 'status', 'created_at'];

        $tableSort = $request->input('table_sort');
        $tableDirection = strtolower((string) $request->input('table_direction')) === 'desc' ? 'desc' : 'asc';
        $hasTableSort = ! empty($tableSort) && in_array($tableSort, $allowedSorts, true);

        $toolbarSort = $request->input('sort');
        $toolbarDirection = strtolower((string) $request->input('direction')) === 'asc' ? 'asc' : 'desc';
        $hasToolbarSort = ! empty($toolbarSort) && in_array($toolbarSort, $allowedSorts, true);

        $likeOperator = DB::getDriverName() === 'pgsql' ? 'ilike' : 'like';
        $now = now();
        $tz = (string) config('pos_promotions.timezone', 'Asia/Jakarta');

        $query = Voucher::query()
            ->with(['freeProduct:id,name,barcode', 'supplier:id,name', 'creator:id,name'])
            ->when($request->search, function ($query, $search) use ($likeOperator): void {
                $term = trim((string) $search);
                $query->where(function ($q) use ($term, $likeOperator): void {
                    $q->where('code', $likeOperator, "%{$term}%")
                        ->orWhere('name', $likeOperator, "%{$term}%");
                });
            })
            ->when($request->type && $request->type !== 'all', function ($query) use ($request): void {
                $query->where('type', (string) $request->input('type'));
            })
            ->when($request->status && $request->status !== 'all', function ($query) use ($request, $now): void {
                match ((string) $request->input('status')) {
                    'active' => $query->where('status', VoucherStatus::Active->value)
                        ->where('valid_from', '<=', $now)
                        ->where('valid_until', '>=', $now)
                        ->where(function ($q): void {
                            $q->whereNull('total_quota')
                                ->orWhereColumn('used_count', '<', 'total_quota');
                        }),
                    'draft' => $query->where('status', VoucherStatus::Draft->value),
                    'paused' => $query->where('status', VoucherStatus::Paused->value),
                    'expired' => $query->where(function ($q) use ($now): void {
                        $q->where('status', VoucherStatus::Expired->value)
                            ->orWhere('valid_until', '<', $now);
                    }),
                    'exhausted' => $query->where(function ($q): void {
                        $q->where('status', VoucherStatus::Exhausted->value)
                            ->orWhere(function ($sub): void {
                                $sub->whereNotNull('total_quota')
                                    ->whereColumn('used_count', '>=', 'total_quota');
                            });
                    }),
                    'expired_or_exhausted' => $query->where(function ($q) use ($now): void {
                        $q->whereIn('status', [VoucherStatus::Expired->value, VoucherStatus::Exhausted->value])
                            ->orWhere('valid_until', '<', $now)
                            ->orWhere(function ($sub): void {
                                $sub->whereNotNull('total_quota')
                                    ->whereColumn('used_count', '>=', 'total_quota');
                            });
                    }),
                    default => null,
                };
            })
            ->when($request->member_only && $request->member_only !== 'all', function ($query) use ($request): void {
                if ($request->input('member_only') === 'member') {
                    $query->where('member_only', true);
                } elseif ($request->input('member_only') === 'public') {
                    $query->where('member_only', false);
                }
            });

        if ($hasTableSort) {
            $query->orderBy($tableSort, $tableDirection);
        }

        if ($hasToolbarSort && (! $hasTableSort || $toolbarSort !== $tableSort)) {
            $query->orderBy($toolbarSort, $toolbarDirection);
        }

        if (! $hasTableSort && ! $hasToolbarSort) {
            $query->orderByDesc('id');
        } else {
            $query->orderByDesc('id');
        }

        $productOptions = Product::query()
            ->where('active', true)
            ->where('is_donation', false)
            ->orderBy('name')
            ->get(['id', 'name', 'barcode'])
            ->map(fn (Product $p): array => [
                'id' => $p->id,
                'name' => $p->name,
                'barcode' => $p->barcode,
            ])
            ->values()
            ->all();

        $productsByBarcode = collect($productOptions)->keyBy(fn (array $p): string => strtoupper($p['barcode']));
        $productsById = collect($productOptions)->keyBy('id');

        $vouchers = $query->paginate($perPage)
            ->withQueryString()
            ->through(function (Voucher $voucher) use ($now, $tz, $productsByBarcode, $productsById): array {
                $computedStatus = $voucher->computedStatus($now);
                $applicableProducts = collect($voucher->applicable_skus ?? [])
                    ->map(function (string|int $sku) use ($productsByBarcode, $productsById): ?array {
                        $key = strtoupper((string) $sku);

                        return $productsByBarcode->get($key) ?? $productsById->get((int) $sku);
                    })
                    ->filter()
                    ->values()
                    ->all();

                return [
                    'id' => $voucher->id,
                    'code' => $voucher->code,
                    'name' => $voucher->name,
                    'type' => $voucher->type->value,
                    'type_label' => $voucher->type->label(),
                    'type_short_label' => $voucher->type->shortLabel(),
                    'value' => (float) $voucher->value,
                    'max_discount' => $voucher->max_discount !== null ? (float) $voucher->max_discount : null,
                    'min_spend' => (float) $voucher->min_spend,
                    'valid_from' => $voucher->valid_from->copy()->timezone($tz)->format('Y-m-d\TH:i'),
                    'valid_until' => $voucher->valid_until->copy()->timezone($tz)->format('Y-m-d\TH:i'),
                    'valid_from_display' => $voucher->valid_from->copy()->timezone($tz)->format('d M Y H:i'),
                    'valid_until_display' => $voucher->valid_until->copy()->timezone($tz)->format('d M Y H:i'),
                    'allowed_days' => (int) $voucher->allowed_days,
                    'allowed_hours_start' => $voucher->allowed_hours_start ? substr($voucher->allowed_hours_start, 0, 5) : null,
                    'allowed_hours_end' => $voucher->allowed_hours_end ? substr($voucher->allowed_hours_end, 0, 5) : null,
                    'total_quota' => $voucher->total_quota,
                    'used_count' => (int) $voucher->used_count,
                    'per_customer_limit' => $voucher->per_customer_limit,
                    'per_day_limit' => $voucher->per_day_limit,
                    'store_ids' => $voucher->store_ids ?? [],
                    'channel' => $voucher->channel,
                    'member_only' => (bool) $voucher->member_only,
                    'member_tiers' => $voucher->member_tiers ?? [],
                    'applicable_skus' => $voucher->applicable_skus ?? [],
                    'applicable_products' => $applicableProducts,
                    'applicable_categories' => $voucher->applicable_categories ?? [],
                    'excluded_skus' => $voucher->excluded_skus ?? [],
                    'excluded_categories' => $voucher->excluded_categories ?? [],
                    'free_product_id' => $voucher->free_product_id,
                    'free_product_name' => $voucher->freeProduct?->name,
                    'stackable_with_promo' => (bool) $voucher->stackable_with_promo,
                    'stackable_with_voucher' => (bool) $voucher->stackable_with_voucher,
                    'funding' => $voucher->funding->value,
                    'funding_label' => $voucher->funding->label(),
                    'supplier_id' => $voucher->supplier_id,
                    'supplier_name' => $voucher->supplier?->name,
                    'store_share_percent' => (float) ($voucher->store_share_percent ?? 100),
                    'supplier_share_percent' => (float) ($voucher->supplier_share_percent ?? 0),
                    'status' => $voucher->status->value,
                    'status_label' => $voucher->status->label(),
                    'computed_status' => $computedStatus->value,
                    'computed_status_label' => $computedStatus->label(),
                    'creator_name' => $voucher->creator?->name ?? 'Sistem',
                ];
            });

        $categoryOptions = Category::query()
            ->where('is_active', true)
            ->orderBy('name')
            ->get(['id', 'name'])
            ->map(fn (Category $c): array => [
                'id' => $c->id,
                'name' => $c->name,
            ])
            ->values()
            ->all();

        $supplierOptions = Supplier::query()
            ->where('is_active', true)
            ->orderBy('name')
            ->get(['id', 'name'])
            ->map(fn (Supplier $s): array => [
                'id' => $s->id,
                'name' => $s->name,
            ])
            ->values()
            ->all();

        return Inertia::render('POS/Vouchers/Voucher', [
            'vouchers' => $vouchers,
            'filters' => $filters,
            'summary' => $this->voucherService->getSummary($now),
            'typeOptions' => VoucherType::options(),
            'statusOptions' => VoucherStatus::options(),
            'fundingOptions' => PromotionFunding::options(),
            'products' => $productOptions,
            'categories' => $categoryOptions,
            'suppliers' => $supplierOptions,
        ]);
    }

    public function store(StoreVoucherRequest $request): RedirectResponse
    {
        /** @var User $actor */
        $actor = $request->user();
        $voucher = $this->voucherService->create($request->validated(), $actor);

        return back()->with('success', "Voucher {$voucher->code} ({$voucher->name}) berhasil dibuat.");
    }

    public function update(UpdateVoucherRequest $request, Voucher $voucher): RedirectResponse
    {
        $updated = $this->voucherService->update($voucher, $request->validated());

        return back()->with('success', "Voucher {$updated->code} ({$updated->name}) berhasil diperbarui.");
    }

    public function destroy(Voucher $voucher): RedirectResponse
    {
        Gate::authorize('delete', $voucher);

        $code = $voucher->code;
        $this->voucherService->delete($voucher);

        return back()->with('success', "Voucher {$code} berhasil dihapus.");
    }

    public function generateBulk(GenerateBulkVouchersRequest $request): RedirectResponse
    {
        /** @var User $actor */
        $actor = $request->user();
        $validated = $request->validated();

        $created = $this->voucherService->generateBulk(
            (string) $validated['prefix'],
            (int) $validated['count'],
            $validated,
            $actor
        );

        $count = count($created);

        return back()->with('success', "{$count} kode voucher massal berhasil dibuat.");
    }

    public function generateCode(Request $request): JsonResponse
    {
        Gate::authorize('create', Voucher::class);

        $length = $request->integer('length', 8);

        return response()->json([
            'code' => $this->voucherService->generateSingleCode($length),
        ]);
    }
}

<?php

namespace App\Http\Controllers;

use App\Enums\PaymentMethod;
use App\Enums\PromotionFunding;
use App\Enums\PromotionScope;
use App\Enums\PromotionType;
use App\Http\Requests\StorePromotionRequest;
use App\Http\Requests\UpdatePromotionRequest;
use App\Models\Category;
use App\Models\Product;
use App\Models\Promotion;
use App\Models\PromotionBundleItem;
use App\Models\Supplier;
use App\Models\User;
use App\Services\PromotionService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;
use Inertia\Response;

class PromotionController extends Controller
{
    public function __construct(public PromotionService $promotionService) {}

    public function index(Request $request): Response
    {
        Gate::authorize('viewAny', Promotion::class);

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
        $allowedSorts = ['name', 'code', 'type', 'priority', 'starts_at', 'ends_at', 'is_active', 'created_at'];

        $tableSort = $request->input('table_sort');
        $tableDirection = strtolower((string) $request->input('table_direction')) === 'desc' ? 'desc' : 'asc';
        $hasTableSort = ! empty($tableSort) && in_array($tableSort, $allowedSorts, true);

        $toolbarSort = $request->input('sort');
        $toolbarDirection = strtolower((string) $request->input('direction')) === 'asc' ? 'asc' : 'desc';
        $hasToolbarSort = ! empty($toolbarSort) && in_array($toolbarSort, $allowedSorts, true);

        $likeOperator = DB::getDriverName() === 'pgsql' ? 'ilike' : 'like';
        $now = now();
        $tz = (string) config('pos_promotions.timezone', 'Asia/Jakarta');

        $query = Promotion::query()
            ->with([
                'products:id,name,barcode',
                'categories:id,name',
                'bundleItems.product:id,name,barcode,sell_price',
                'rewardProduct:id,name,barcode,sell_price',
                'supplier:id,name',
                'creator:id,name',
            ])
            ->when($request->search, function ($query, $search) use ($likeOperator): void {
                $term = trim((string) $search);
                $query->where(function ($q) use ($term, $likeOperator): void {
                    $q->where('name', $likeOperator, "%{$term}%")
                        ->orWhere('code', $likeOperator, "%{$term}%")
                        ->orWhere('exclusive_group', $likeOperator, "%{$term}%");
                });
            })
            ->when($request->type && $request->type !== 'all', function ($query) use ($request): void {
                $query->where('type', (string) $request->input('type'));
            })
            ->when($request->status && $request->status !== 'all', function ($query) use ($request, $now): void {
                match ((string) $request->input('status')) {
                    'active' => $query->where('is_active', true)
                        ->where('starts_at', '<=', $now)
                        ->where('ends_at', '>=', $now),
                    'scheduled' => $query->where('is_active', true)
                        ->where('starts_at', '>', $now),
                    'expired' => $query->where('is_active', true)
                        ->where('ends_at', '<', $now),
                    'inactive' => $query->where('is_active', false),
                    'ended_or_inactive' => $query->where(function ($q) use ($now): void {
                        $q->where('is_active', false)->orWhere('ends_at', '<', $now);
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
            $query->orderByDesc('priority')->orderByDesc('id');
        } else {
            $query->orderByDesc('id');
        }

        $promotions = $query->paginate($perPage)
            ->withQueryString()
            ->through(function (Promotion $promo) use ($now, $tz): array {
                $status = $promo->computedStatus($now);

                return [
                    'id' => $promo->id,
                    'code' => $promo->code,
                    'name' => $promo->name,
                    'type' => $promo->type->value,
                    'type_label' => $promo->type->label(),
                    'type_short_label' => $promo->type->shortLabel(),
                    'scope' => $promo->scope->value,
                    'scope_label' => $promo->scope->label(),
                    'funding' => $promo->funding->value,
                    'funding_label' => $promo->funding->label(),
                    'supplier_id' => $promo->supplier_id,
                    'supplier_name' => $promo->supplier?->name,
                    'store_share_percent' => (float) ($promo->store_share_percent ?? 100),
                    'supplier_share_percent' => (float) ($promo->supplier_share_percent ?? 0),
                    'discount_value' => $promo->discount_value !== null ? (float) $promo->discount_value : null,
                    'max_discount_amount' => $promo->max_discount_amount !== null ? (float) $promo->max_discount_amount : null,
                    'min_purchase_amount' => (float) $promo->min_purchase_amount,
                    'buy_qty' => $promo->buy_qty,
                    'get_qty' => $promo->get_qty,
                    'get_discount_percent' => (float) $promo->get_discount_percent,
                    'bundle_price' => $promo->bundle_price !== null ? (float) $promo->bundle_price : null,
                    'nth_item' => $promo->nth_item,
                    'reward_product_id' => $promo->reward_product_id,
                    'reward_product' => $promo->rewardProduct !== null ? [
                        'id' => $promo->rewardProduct->id,
                        'name' => $promo->rewardProduct->name,
                        'barcode' => $promo->rewardProduct->barcode,
                        'sell_price' => (float) $promo->rewardProduct->sell_price,
                    ] : null,
                    'special_price' => $promo->special_price !== null ? (float) $promo->special_price : null,
                    'payment_method' => $promo->payment_method,
                    'payment_bin_prefix' => $promo->payment_bin_prefix,
                    'near_expiry_days' => $promo->near_expiry_days,
                    'bundle_items' => $promo->bundleItems->map(fn (PromotionBundleItem $bi): array => [
                        'product_id' => $bi->product_id,
                        'product_name' => $bi->product?->name ?? "Produk #{$bi->product_id}",
                        'product_barcode' => $bi->product?->barcode ?? '',
                        'required_qty' => (int) $bi->required_qty,
                    ])->values()->all(),
                    'starts_at' => $promo->starts_at->copy()->timezone($tz)->format('Y-m-d\TH:i'),
                    'ends_at' => $promo->ends_at->copy()->timezone($tz)->format('Y-m-d\TH:i'),
                    'starts_at_display' => $promo->starts_at->copy()->timezone($tz)->format('d M Y H:i'),
                    'ends_at_display' => $promo->ends_at->copy()->timezone($tz)->format('d M Y H:i'),
                    'days_mask' => (int) $promo->days_mask,
                    'time_start' => $promo->time_start ? substr($promo->time_start, 0, 5) : null,
                    'time_end' => $promo->time_end ? substr($promo->time_end, 0, 5) : null,
                    'quota_total' => $promo->quota_total,
                    'quota_used' => (int) $promo->quota_used,
                    'max_qty_per_transaction' => $promo->max_qty_per_transaction,
                    'max_qty_per_customer_per_day' => $promo->max_qty_per_customer_per_day,
                    'stackable' => (bool) $promo->stackable,
                    'exclusive_group' => $promo->exclusive_group,
                    'priority' => (int) $promo->priority,
                    'member_only' => (bool) $promo->member_only,
                    'is_active' => (bool) $promo->is_active,
                    'computed_status' => $status,
                    'creator_name' => $promo->creator?->name ?? 'Sistem',
                    'product_ids' => $promo->products->pluck('id')->values()->all(),
                    'selected_products' => $promo->products->map(fn (Product $p): array => [
                        'id' => $p->id,
                        'name' => $p->name,
                        'barcode' => $p->barcode,
                    ])->values()->all(),
                    'category_ids' => $promo->categories->pluck('id')->values()->all(),
                    'products_count' => $promo->products->count(),
                    'categories_count' => $promo->categories->count(),
                ];
            });

        $productOptions = Product::query()
            ->where('active', true)
            ->where('is_donation', false)
            ->where('is_promo_excluded', false)
            ->orderBy('name')
            ->get(['id', 'name', 'barcode'])
            ->map(fn (Product $p): array => [
                'id' => $p->id,
                'name' => $p->name,
                'barcode' => $p->barcode,
            ])
            ->values()
            ->all();

        $categoryOptions = Category::query()
            ->where('is_active', true)
            ->where('is_promo_excluded', false)
            ->orderBy('name')
            ->get(['id', 'name'])
            ->map(fn (Category $c): array => [
                'id' => $c->id,
                'name' => $c->name,
            ])
            ->values()
            ->all();

        $paymentMethodOptions = array_map(
            fn (PaymentMethod $m): array => [
                'value' => $m->value,
                'label' => $m->label(),
            ],
            [
                PaymentMethod::Cash,
                PaymentMethod::Qris,
                PaymentMethod::Debit,
                PaymentMethod::Transfer,
            ]
        );

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

        return Inertia::render('POS/Promotions/Promotion', [
            'promotions' => $promotions,
            'filters' => $filters,
            'summary' => $this->promotionService->getSummary($now),
            'typeOptions' => PromotionType::options(),
            'scopeOptions' => PromotionScope::options(),
            'fundingOptions' => PromotionFunding::options(),
            'paymentMethodOptions' => $paymentMethodOptions,
            'products' => $productOptions,
            'categories' => $categoryOptions,
            'suppliers' => $supplierOptions,
        ]);
    }

    public function searchExclusiveGroups(Request $request): JsonResponse
    {
        Gate::authorize('viewAny', Promotion::class);

        $search = trim((string) $request->query('search', ''));
        $likeOperator = DB::getDriverName() === 'pgsql' ? 'ilike' : 'like';

        $groups = Promotion::query()
            ->whereNotNull('exclusive_group')
            ->where('exclusive_group', '!=', '')
            ->when($search !== '', fn ($q) => $q->where('exclusive_group', $likeOperator, "%{$search}%"))
            ->distinct()
            ->orderBy('exclusive_group')
            ->limit(30)
            ->pluck('exclusive_group')
            ->map(fn (string $group): array => [
                'value' => $group,
                'label' => $group,
            ])
            ->values()
            ->all();

        return response()->json($groups);
    }

    public function store(StorePromotionRequest $request): RedirectResponse
    {
        /** @var User $actor */
        $actor = $request->user();
        $promotion = $this->promotionService->create($request->validated(), $actor);

        return back()->with('success', "Promo {$promotion->name} berhasil dibuat.");
    }

    public function update(UpdatePromotionRequest $request, Promotion $promotion): RedirectResponse
    {
        $updated = $this->promotionService->update($promotion, $request->validated());

        return back()->with('success', "Promo {$updated->name} berhasil diperbarui.");
    }

    public function destroy(Promotion $promotion): RedirectResponse
    {
        Gate::authorize('delete', $promotion);

        $name = $promotion->name;
        $this->promotionService->delete($promotion);

        return back()->with('success', "Promo {$name} berhasil dihapus.");
    }
}

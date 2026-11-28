<?php

namespace App\Http\Controllers;

use App\Enums\FinancialCategoryType;
use App\Enums\PaymentStatus;
use App\Enums\PromotionFunding;
use App\Enums\TransactionStatus;
use App\Models\AccountPayable;
use App\Models\AppliedPromotion;
use App\Models\FinancialAccount;
use App\Models\FinancialCategory;
use App\Models\Product;
use App\Models\Supplier;
use App\Models\User;
use App\Services\FinanceService;
use App\Services\SupplierPromoClaimService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;
use Inertia\Response;

class SupplierPromoClaimController extends Controller
{
    public function __construct(public SupplierPromoClaimService $claimService) {}

    public function index(Request $request): Response
    {
        Gate::authorize('reports.finance');

        $filters = $request->only([
            'search',
            'supplier_id',
            'claim_status',
            'settlement_method',
            'date_from',
            'date_to',
            'sort',
            'direction',
            'table_sort',
            'table_direction',
        ]);

        $perPage = $request->integer('per_page', 15);
        $allowedSorts = ['created_at', 'supplier_discount_amount', 'discount_amount', 'claim_status', 'claimed_at'];

        $tableSort = $request->input('table_sort');
        $tableDirection = strtolower((string) $request->input('table_direction')) === 'desc' ? 'desc' : 'asc';
        $hasTableSort = ! empty($tableSort) && in_array($tableSort, $allowedSorts, true);

        $toolbarSort = $request->input('sort');
        $toolbarDirection = strtolower((string) $request->input('direction')) === 'asc' ? 'asc' : 'desc';
        $hasToolbarSort = ! empty($toolbarSort) && in_array($toolbarSort, $allowedSorts, true);

        $likeOperator = DB::getDriverName() === 'pgsql' ? 'ilike' : 'like';
        $tz = (string) config('pos_promotions.timezone', 'Asia/Jakarta');

        $baseQuery = AppliedPromotion::query()
            ->where('supplier_discount_amount', '>', 0)
            ->whereHas('transaction', fn ($q) => $q->where('status', '!=', TransactionStatus::Voided->value));

        $summaryRow = (clone $baseQuery)
            ->selectRaw("
                COALESCE(SUM(supplier_discount_amount), 0) as total_supplier_burden,
                COALESCE(SUM(CASE WHEN claim_status = 'pending' THEN supplier_discount_amount ELSE 0 END), 0) as pending_amount,
                SUM(CASE WHEN claim_status = 'pending' THEN 1 ELSE 0 END) as pending_count,
                COALESCE(SUM(CASE WHEN claim_status = 'claimed' THEN supplier_discount_amount ELSE 0 END), 0) as claimed_amount,
                SUM(CASE WHEN claim_status = 'claimed' THEN 1 ELSE 0 END) as claimed_count,
                COALESCE(SUM(CASE WHEN claim_status = 'paid' THEN supplier_discount_amount ELSE 0 END), 0) as paid_amount,
                SUM(CASE WHEN claim_status = 'paid' THEN 1 ELSE 0 END) as paid_count
            ")
            ->first();

        $query = (clone $baseQuery)
            ->with([
                'transaction:id,invoice_number,created_at,grand_total',
                'supplier:id,name',
                'settledAccountPayable:id,payable_number,invoice_number',
                'settledProduct:id,name,barcode,base_unit',
                'settledFinancialAccount:id,code,name',
                'settler:id,name',
            ])
            ->when($request->search, function ($q, $search) use ($likeOperator): void {
                $term = trim((string) $search);
                $q->where(function ($sub) use ($term, $likeOperator): void {
                    $sub->where('description_snapshot', $likeOperator, "%{$term}%")
                        ->orWhere('claim_reference', $likeOperator, "%{$term}%")
                        ->orWhereHas('transaction', fn ($tq) => $tq->where('invoice_number', $likeOperator, "%{$term}%"))
                        ->orWhereHas('supplier', fn ($sq) => $sq->where('name', $likeOperator, "%{$term}%"));
                });
            })
            ->when($request->supplier_id && $request->supplier_id !== 'all', function ($q) use ($request): void {
                $q->where('supplier_id', (int) $request->input('supplier_id'));
            })
            ->when($request->claim_status && $request->claim_status !== 'all', function ($q) use ($request): void {
                $q->where('claim_status', (string) $request->input('claim_status'));
            })
            ->when($request->settlement_method && $request->settlement_method !== 'all', function ($q) use ($request): void {
                $q->where('settlement_method', (string) $request->input('settlement_method'));
            })
            ->when($request->date_from, function ($q, $dateFrom): void {
                $q->whereHas('transaction', fn ($tq) => $tq->whereDate('created_at', '>=', (string) $dateFrom));
            })
            ->when($request->date_to, function ($q, $dateTo): void {
                $q->whereHas('transaction', fn ($tq) => $tq->whereDate('created_at', '<=', (string) $dateTo));
            });

        if ($hasTableSort) {
            $query->orderBy($tableSort, $tableDirection);
        }
        if ($hasToolbarSort && (! $hasTableSort || $toolbarSort !== $tableSort)) {
            $query->orderBy($toolbarSort, $toolbarDirection);
        }
        $query->orderByDesc('id');

        $claims = $query->paginate($perPage)
            ->withQueryString()
            ->through(function (AppliedPromotion $row) use ($tz): array {
                $method = $row->settlement_method;
                $methodLabel = $method ? (SupplierPromoClaimService::SETTLEMENT_METHODS[$method] ?? $method) : null;

                $settlementDetail = null;
                if ($method === 'credit_note' && $row->settledAccountPayable !== null) {
                    $settlementDetail = "Potong AP {$row->settledAccountPayable->payable_number}";
                } elseif ($method === 'free_goods' && $row->settledProduct !== null) {
                    $settlementDetail = "Free Goods: {$row->settled_product_qty} {$row->settledProduct->base_unit} {$row->settledProduct->name}";
                } elseif ($method === 'transfer_reimburse' && $row->settledFinancialAccount !== null) {
                    $settlementDetail = "Masuk {$row->settledFinancialAccount->name}";
                }

                return [
                    'id' => $row->id,
                    'transaction_id' => $row->transaction_id,
                    'invoice_number' => $row->transaction?->invoice_number ?? "#{$row->transaction_id}",
                    'transaction_date' => $row->transaction?->created_at?->copy()->timezone($tz)->format('d M Y H:i') ?? '-',
                    'description' => $row->description_snapshot,
                    'funding' => $row->funding instanceof PromotionFunding ? $row->funding->value : (string) $row->funding,
                    'funding_label' => $row->funding instanceof PromotionFunding ? $row->funding->label() : (string) $row->funding,
                    'supplier_id' => $row->supplier_id,
                    'supplier_name' => $row->supplier?->name ?? 'Supplier Belum Ditentukan',
                    'discount_amount' => round((float) $row->discount_amount, 2),
                    'store_discount_amount' => round((float) $row->store_discount_amount, 2),
                    'supplier_discount_amount' => round((float) $row->supplier_discount_amount, 2),
                    'claim_status' => (string) ($row->claim_status ?: 'pending'),
                    'settlement_method' => $method,
                    'settlement_method_label' => $methodLabel,
                    'settlement_detail' => $settlementDetail,
                    'claimed_at' => $row->claimed_at?->copy()->timezone($tz)->format('d M Y H:i'),
                    'claim_reference' => $row->claim_reference,
                    'claim_notes' => $row->claim_notes,
                    'settled_by_name' => $row->settler?->name,
                ];
            });

        $suppliers = Supplier::query()->where('is_active', true)->orderBy('name')->get(['id', 'name']);

        $openPayables = AccountPayable::query()
            ->with('supplier:id,name')
            ->where('status', '!=', PaymentStatus::Paid->value)
            ->where('remaining_amount', '>', 0)
            ->orderBy('due_date')
            ->limit(100)
            ->get(['id', 'payable_number', 'invoice_number', 'supplier_id', 'remaining_amount'])
            ->map(fn (AccountPayable $ap): array => [
                'id' => $ap->id,
                'supplier_id' => $ap->supplier_id,
                'payable_number' => $ap->payable_number,
                'invoice_number' => $ap->invoice_number,
                'supplier_name' => $ap->supplier?->name ?? '-',
                'remaining_amount' => round((float) $ap->remaining_amount, 2),
            ])
            ->values()
            ->all();

        $products = Product::query()
            ->where('active', true)
            ->where('is_donation', false)
            ->orderBy('name')
            ->limit(250)
            ->get(['id', 'name', 'barcode', 'base_unit'])
            ->map(fn (Product $p): array => [
                'id' => $p->id,
                'name' => $p->name,
                'barcode' => $p->barcode,
                'base_unit' => $p->base_unit ?: 'pcs',
            ])
            ->values()
            ->all();

        $financialAccounts = FinancialAccount::query()
            ->where('is_active', true)
            ->orderByDesc('is_default')
            ->orderBy('name')
            ->get(['id', 'code', 'name'])
            ->map(fn (FinancialAccount $a): array => [
                'id' => $a->id,
                'code' => $a->code,
                'name' => $a->name,
            ])
            ->values()
            ->all();

        $incomeCategories = FinancialCategory::query()
            ->where('type', FinancialCategoryType::Income->value)
            ->where('is_active', true)
            ->whereNotIn('code', FinanceService::AUTO_SYSTEM_CATEGORY_CODES)
            ->orderBy('name')
            ->get(['id', 'code', 'name'])
            ->map(fn (FinancialCategory $c): array => [
                'id' => $c->id,
                'code' => $c->code,
                'name' => $c->name,
            ])
            ->values()
            ->all();

        return Inertia::render('POS/Finance/SupplierPromoClaim', [
            'claims' => $claims,
            'filters' => $filters,
            'summary' => [
                'total_supplier_burden' => round((float) ($summaryRow->total_supplier_burden ?? 0), 2),
                'pending_amount' => round((float) ($summaryRow->pending_amount ?? 0), 2),
                'pending_count' => (int) ($summaryRow->pending_count ?? 0),
                'claimed_amount' => round((float) ($summaryRow->claimed_amount ?? 0), 2),
                'claimed_count' => (int) ($summaryRow->claimed_count ?? 0),
                'paid_amount' => round((float) ($summaryRow->paid_amount ?? 0), 2),
                'paid_count' => (int) ($summaryRow->paid_count ?? 0),
            ],
            'options' => [
                'suppliers' => $suppliers,
                'openPayables' => $openPayables,
                'products' => $products,
                'financialAccounts' => $financialAccounts,
                'incomeCategories' => $incomeCategories,
                'settlementMethods' => array_map(
                    fn (string $key, string $label): array => ['value' => $key, 'label' => $label],
                    array_keys(SupplierPromoClaimService::SETTLEMENT_METHODS),
                    array_values(SupplierPromoClaimService::SETTLEMENT_METHODS)
                ),
            ],
        ]);
    }

    public function settle(Request $request): RedirectResponse
    {
        Gate::authorize('reports.finance');

        /** @var User $actor */
        $actor = $request->user();

        $validated = $request->validate([
            'ids' => ['required', 'array', 'min:1'],
            'ids.*' => ['integer', 'exists:applied_promotions,id'],
            'action' => ['required', 'string', 'in:mark_claimed,settle'],
            'settlement_method' => ['required_if:action,settle', 'nullable', 'string', 'in:credit_note,free_goods,transfer_reimburse'],
            'account_payable_id' => ['nullable', 'integer', 'exists:account_payables,id'],
            'product_id' => ['nullable', 'integer', 'exists:products,id'],
            'product_qty' => ['nullable', 'integer', 'min:1'],
            'financial_account_id' => ['nullable', 'integer', 'exists:financial_accounts,id'],
            'financial_category_id' => ['nullable', 'integer', 'exists:financial_categories,id'],
            'claim_reference' => ['nullable', 'string', 'max:100'],
            'claim_notes' => ['nullable', 'string', 'max:500'],
        ]);

        $count = $this->claimService->settleClaims($validated['ids'], $validated, $actor);

        $msg = $validated['action'] === 'mark_claimed'
            ? "{$count} klaim promo supplier ditandai sebagai Diajukan."
            : "{$count} klaim promo supplier berhasil diselesaikan.";

        return back()->with('success', $msg);
    }
}

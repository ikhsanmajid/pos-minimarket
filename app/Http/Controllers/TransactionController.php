<?php

namespace App\Http\Controllers;

use App\Enums\PaymentMethod;
use App\Enums\TransactionStatus;
use App\Enums\UserRoles;
use App\Http\Requests\VoidTransactionRequest;
use App\Models\FinancialAccount;
use App\Models\SalesReturn;
use App\Models\SalesReturnItem;
use App\Models\Transaction;
use App\Models\TransactionDetail;
use App\Models\TransactionPayment;
use App\Models\User;
use App\Services\PosTransactionService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;
use Inertia\Response;
use Spatie\Activitylog\Models\Activity;

class TransactionController extends Controller
{
    public function __construct(public PosTransactionService $posTransactionService) {}

    public function index(Request $request): Response
    {
        Gate::authorize('viewAny', Transaction::class);

        /** @var User $user */
        $user = $request->user();
        $canViewAll = Gate::allows('viewAll', Transaction::class);
        $likeOperator = DB::connection()->getDriverName() === 'pgsql' ? 'ilike' : 'like';

        $filters = $request->only([
            'search',
            'user_id',
            'payment_method',
            'status',
            'start_date',
            'end_date',
            'sort',
            'direction',
            'table_sort',
            'table_direction',
        ]);
        $perPage = $request->integer('per_page', 15);

        $allowedSorts = [
            'invoice_number',
            'created_at',
            'grand_total',
            'status',
        ];

        $tableSort = $request->input('table_sort');
        $tableDirection = strtolower((string) $request->input('table_direction')) === 'asc' ? 'asc' : 'desc';
        $hasTableSort = ! empty($tableSort) && in_array($tableSort, $allowedSorts, true);

        $toolbarSort = $request->input('sort');
        $toolbarDirection = strtolower((string) $request->input('direction')) === 'asc' ? 'asc' : 'desc';
        $hasToolbarSort = ! empty($toolbarSort) && in_array($toolbarSort, $allowedSorts, true);

        $query = Transaction::query()
            ->with([
                'user:id,name,role',
                'customer:id,name',
                'payments:id,transaction_id,payment_method,amount',
            ])
            ->withCount('details')
            ->when(! $canViewAll, fn ($q) => $q->where('user_id', $user->id))
            ->when($canViewAll && $request->filled('user_id') && $request->input('user_id') !== 'all', function ($q) use ($request): void {
                $q->where('user_id', (int) $request->input('user_id'));
            })
            ->when($request->filled('search'), function ($q) use ($request, $likeOperator): void {
                $search = trim((string) $request->input('search'));
                $q->where(function ($sub) use ($search, $likeOperator): void {
                    $sub->where('invoice_number', $likeOperator, "%{$search}%")
                        ->orWhereHas('user', fn ($u) => $u->where('name', $likeOperator, "%{$search}%"))
                        ->orWhereHas('customer', fn ($c) => $c->where('name', $likeOperator, "%{$search}%"));
                });
            })
            ->when($request->filled('status') && $request->input('status') !== 'all', function ($q) use ($request): void {
                $q->where('status', (string) $request->input('status'));
            })
            ->when($request->filled('payment_method') && $request->input('payment_method') !== 'all', function ($q) use ($request): void {
                $method = (string) $request->input('payment_method');
                $q->where(function ($sub) use ($method): void {
                    $sub->where('payment_method', $method)
                        ->orWhereHas('payments', fn ($p) => $p->where('payment_method', $method));
                });
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
            $query->orderByDesc('created_at')->orderByDesc('id');
        } else {
            $query->orderByDesc('id');
        }

        $transactions = $query->paginate($perPage)
            ->withQueryString()
            ->through(function (Transaction $tx): array {
                $paymentLabels = $tx->payments->isNotEmpty()
                    ? $tx->payments->map(fn (TransactionPayment $p): string => $p->payment_method->label())->unique()->values()->all()
                    : [PaymentMethod::tryFrom(strtolower((string) $tx->payment_method))?->label() ?? ucfirst((string) $tx->payment_method)];

                return [
                    'id' => $tx->id,
                    'invoice_number' => $tx->invoice_number,
                    'created_at' => $tx->created_at?->format('d M Y H:i') ?? '-',
                    'cashier_name' => $tx->user?->name ?? '-',
                    'customer_name' => $tx->customer?->name ?? 'Umum',
                    'items_count' => (int) ($tx->details_count ?? 0),
                    'grand_total' => (float) $tx->grand_total,
                    'payment_methods' => $paymentLabels,
                    'status' => $tx->status->value,
                    'status_label' => $tx->status->label(),
                ];
            });

        $cashiers = $canViewAll
            ? User::query()
                ->whereIn('role', [UserRoles::Admin->value, UserRoles::Supervisor->value, UserRoles::Cashier->value])
                ->orderBy('name')
                ->get(['id', 'name', 'role'])
                ->map(fn (User $u): array => [
                    'id' => $u->id,
                    'name' => $u->name,
                    'role_name' => $u->role?->label() ?? '-',
                ])
                ->values()
                ->all()
            : [];

        $summaryRow = Transaction::query()
            ->when(! $canViewAll, fn ($q) => $q->where('user_id', $user->id))
            ->when($request->filled('start_date'), function ($q) use ($request): void {
                $q->whereDate('created_at', '>=', (string) $request->input('start_date'));
            })
            ->when($request->filled('end_date'), function ($q) use ($request): void {
                $q->whereDate('created_at', '<=', (string) $request->input('end_date'));
            })
            ->selectRaw(
                'COUNT(*) as total_transactions,
                COUNT(*) FILTER (WHERE status = ?) as completed_count,
                COUNT(*) FILTER (WHERE status IN (?, ?)) as refunded_count,
                COUNT(*) FILTER (WHERE status = ?) as voided_count,
                COALESCE(SUM(grand_total) FILTER (WHERE status != ?), 0) as total_sales,
                COALESCE(SUM(grand_total) FILTER (WHERE status = ?), 0) as voided_amount',
                [
                    TransactionStatus::Completed->value,
                    TransactionStatus::PartiallyRefunded->value,
                    TransactionStatus::Refunded->value,
                    TransactionStatus::Voided->value,
                    TransactionStatus::Voided->value,
                    TransactionStatus::Voided->value,
                ]
            )
            ->first();

        $summary = [
            'total_transactions' => (int) ($summaryRow->total_transactions ?? 0),
            'completed_count' => (int) ($summaryRow->completed_count ?? 0),
            'refunded_count' => (int) ($summaryRow->refunded_count ?? 0),
            'voided_count' => (int) ($summaryRow->voided_count ?? 0),
            'total_sales' => round((float) ($summaryRow->total_sales ?? 0), 2),
            'voided_amount' => round((float) ($summaryRow->voided_amount ?? 0), 2),
        ];

        return Inertia::render('POS/Transactions/Transaction', [
            'transactions' => $transactions,
            'filters' => $filters,
            'summary' => $summary,
            'cashiers' => $cashiers,
            'canViewAll' => $canViewAll,
            'statusOptions' => TransactionStatus::options(),
            'paymentMethodOptions' => array_map(
                fn (PaymentMethod $m): array => ['value' => $m->value, 'label' => $m->label()],
                [PaymentMethod::Cash, PaymentMethod::Qris, PaymentMethod::Debit, PaymentMethod::Transfer]
            ),
        ]);
    }

    public function show(Request $request, Transaction $transaction): Response
    {
        Gate::authorize('view', $transaction);

        $transaction->load([
            'user:id,name,email,role',
            'cashierShift:id,shift_number,register_name',
            'customer:id,name,phone',
            'voidedByUser:id,name,role',
            'discountApprovedByUser:id,name,role',
            'details.product:id,name,barcode,base_unit',
            'details.returnItems:id,transaction_detail_id,qty',
            'payments.financialAccount:id,code,name,type',
            'salesReturns.items.product:id,name,barcode,base_unit',
            'salesReturns.processor:id,name',
            'salesReturns.approver:id,name',
            'salesReturns.financialAccount:id,code,name,type',
        ]);

        $financialAccounts = FinancialAccount::query()
            ->where('is_active', true)
            ->orderByDesc('is_default')
            ->orderBy('name')
            ->get(['id', 'code', 'name', 'type', 'is_default'])
            ->map(fn (FinancialAccount $acc): array => [
                'id' => $acc->id,
                'code' => $acc->code,
                'name' => $acc->name,
                'type' => $acc->type->value,
                'type_label' => $acc->type->label(),
                'is_default' => (bool) $acc->is_default,
            ])
            ->values()
            ->all();

        $totalReturnedAmount = round((float) $transaction->salesReturns->sum('total_refund_amount'), 2);

        return Inertia::render('POS/Transactions/DetailTransaction', [
            'transaction' => [
                'id' => $transaction->id,
                'invoice_number' => $transaction->invoice_number,
                'status' => $transaction->status->value,
                'status_label' => $transaction->status->label(),
                'created_at' => $transaction->created_at?->format('d M Y H:i:s') ?? '-',
                'cashier_name' => $transaction->user?->name ?? '-',
                'cashier_role' => $transaction->user?->role?->label() ?? '-',
                'shift_number' => $transaction->cashierShift?->shift_number,
                'register_name' => $transaction->cashierShift?->register_name,
                'customer_name' => $transaction->customer?->name ?? 'Umum',
                'customer_phone' => $transaction->customer?->phone,
                'subtotal' => (float) $transaction->subtotal,
                'discount_amount' => (float) $transaction->discount_amount,
                'tax_amount' => (float) $transaction->tax_amount,
                'rounding_amount' => (float) $transaction->rounding_amount,
                'grand_total' => (float) $transaction->grand_total,
                'paid_amount' => (float) $transaction->paid_amount,
                'change_amount' => (float) ($transaction->change_amount ?? 0),
                'total_returned_amount' => $totalReturnedAmount,
                'voided_by_name' => $transaction->voidedByUser?->name,
                'voided_at' => $transaction->voided_at?->format('d M Y H:i:s'),
                'void_reason' => $transaction->void_reason,
                'discount_approved_by_name' => $transaction->discountApprovedByUser?->name,
                'details' => $transaction->details->map(function (TransactionDetail $d): array {
                    $qty = $d->qty > 0 ? $d->qty : max(1, (int) $d->quantity);
                    $returnedQty = (int) $d->returnItems->sum('qty');

                    return [
                        'id' => $d->id,
                        'product_id' => $d->product_id,
                        'product_name' => $d->product?->name ?? "Produk #{$d->product_id}",
                        'product_barcode' => $d->product?->barcode ?? '-',
                        'unit_name' => $d->unit_name_snapshot ?: 'pcs',
                        'conversion_factor' => (int) $d->conversion_factor,
                        'qty' => $qty,
                        'base_qty' => $d->base_qty > 0 ? $d->base_qty : $qty,
                        'returned_qty' => $returnedQty,
                        'returnable_qty' => max(0, $qty - $returnedQty),
                        'unit_price' => (float) ((float) $d->unit_price > 0 ? $d->unit_price : $d->sell_price),
                        'discount_amount' => (float) $d->discount_amount,
                        'subtotal' => (float) $d->subtotal,
                    ];
                })->values()->all(),
                'payments' => $transaction->payments->map(fn (TransactionPayment $p): array => [
                    'id' => $p->id,
                    'payment_method' => $p->payment_method->value,
                    'payment_method_label' => $p->payment_method->label(),
                    'account_name' => $p->financialAccount?->name ?? '-',
                    'amount' => (float) $p->amount,
                    'reference_number' => $p->reference_number,
                ])->values()->all(),
                'sales_returns' => $transaction->salesReturns->map(fn (SalesReturn $ret): array => [
                    'id' => $ret->id,
                    'return_number' => $ret->return_number,
                    'created_at' => $ret->created_at?->format('d M Y H:i:s') ?? '-',
                    'refund_method' => $ret->refund_method->value,
                    'refund_method_label' => $ret->refund_method->label(),
                    'account_name' => $ret->financialAccount?->name ?? '-',
                    'total_refund_amount' => (float) $ret->total_refund_amount,
                    'reason' => $ret->reason,
                    'processed_by_name' => $ret->processor?->name ?? '-',
                    'approved_by_name' => $ret->approver?->name ?? '-',
                    'items' => $ret->items->map(fn (SalesReturnItem $item): array => [
                        'id' => $item->id,
                        'product_name' => $item->product?->name ?? "Produk #{$item->product_id}",
                        'unit_name' => $item->unit_name_snapshot,
                        'qty' => (int) $item->qty,
                        'base_qty' => (int) $item->base_qty,
                        'unit_price_snapshot' => (float) $item->unit_price_snapshot,
                        'subtotal_refund' => (float) $item->subtotal_refund,
                        'is_restockable' => (bool) $item->is_restockable,
                    ])->values()->all(),
                ])->values()->all(),
            ],
            'receipt' => PosController::formatReceiptPayload($transaction),
            'financialAccounts' => $financialAccounts,
            'paymentMethods' => array_map(
                fn (PaymentMethod $m): array => ['value' => $m->value, 'label' => $m->label()],
                [PaymentMethod::Cash, PaymentMethod::Qris, PaymentMethod::Debit, PaymentMethod::Transfer]
            ),
            'canVoid' => Gate::allows('void', $transaction),
            'canReturn' => Gate::allows('returnItems', $transaction),
            'activities' => Inertia::optional(function () use ($request, $transaction): array {
                $perPage = $request->integer('per_page', 10);

                $paginated = Activity::forSubject($transaction)
                    ->with('causer')
                    ->latest('id')
                    ->paginate($perPage)
                    ->withQueryString();

                return [
                    'data' => collect($paginated->items())->map(fn (Activity $act): array => [
                        'id' => $act->id,
                        'description' => $act->description,
                        'event' => $act->event,
                        'causer_name' => $act->causer instanceof User ? $act->causer->name : 'Sistem',
                        'causer_role' => $act->causer instanceof User ? $act->causer->role?->label() : null,
                        'attribute_changes' => $act->attribute_changes?->toArray() ?? [],
                        'properties' => $act->properties?->toArray() ?? [],
                        'created_at' => $act->created_at?->format('d M Y H:i:s'),
                        'created_at_human' => $act->created_at?->diffForHumans(),
                    ])->all(),
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

    public function void(VoidTransactionRequest $request, Transaction $transaction): RedirectResponse
    {
        Gate::authorize('void', $transaction);

        /** @var User $user */
        $user = $request->user();

        /** @var array{reason: string, supervisor_pin: string} $validated */
        $validated = $request->validated();

        $this->posTransactionService->void($transaction, $validated, $user);

        return back()->with('success', "Transaksi {$transaction->invoice_number} berhasil dibatalkan (Void).");
    }

    public function receipt(Request $request, Transaction $transaction): JsonResponse
    {
        Gate::authorize('view', $transaction);

        return response()->json([
            'receipt' => PosController::formatReceiptPayload($transaction),
        ]);
    }
}

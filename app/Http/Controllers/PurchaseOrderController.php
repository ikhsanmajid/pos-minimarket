<?php

namespace App\Http\Controllers;

use App\Enums\PaymentMethod;
use App\Enums\PaymentStatus;
use App\Enums\PurchaseOrderStatus;
use App\Enums\ReceivingStatus;
use App\Enums\UserRoles;
use App\Http\Requests\ReceivePurchaseOrderRequest;
use App\Http\Requests\RejectPurchaseOrderRequest;
use App\Http\Requests\StorePayablePaymentRequest;
use App\Http\Requests\StorePurchaseOrderRequest;
use App\Http\Requests\UpdatePurchaseOrderRequest;
use App\Models\FinancialAccount;
use App\Models\Product;
use App\Models\ProductUnit;
use App\Models\PurchaseOrder;
use App\Models\PurchaseOrderReceipt;
use App\Models\Supplier;
use App\Services\FinanceService;
use App\Services\GoodsReceiptService;
use App\Services\PurchaseOrderService;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response as HttpResponse;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;
use Inertia\Response;
use Spatie\Activitylog\Models\Activity;

class PurchaseOrderController extends Controller
{
    public function index(Request $request): Response
    {
        Gate::authorize('viewAny', PurchaseOrder::class);

        $filters = $request->only([
            'search',
            'status',
            'receiving_status',
            'payment_status',
            'supplier_id',
            'start_date',
            'end_date',
            'sort',
            'direction',
            'table_sort',
            'table_direction',
        ]);
        $perPage = $request->integer('per_page', 10);

        $allowedSorts = [
            'po_number',
            'order_date',
            'expected_date',
            'due_date',
            'status',
            'receiving_status',
            'payment_status',
            'total_amount',
            'created_at',
        ];

        $tableSort = $request->input('table_sort');
        $tableDirection = strtolower((string) $request->input('table_direction')) === 'asc' ? 'asc' : 'desc';
        $hasTableSort = ! empty($tableSort) && in_array($tableSort, $allowedSorts, true);

        $toolbarSort = $request->input('sort');
        $toolbarDirection = strtolower((string) $request->input('direction')) === 'asc' ? 'asc' : 'desc';
        $hasToolbarSort = ! empty($toolbarSort) && in_array($toolbarSort, $allowedSorts, true);

        $query = PurchaseOrder::with(['supplier', 'user', 'approvedBy', 'items', 'accountPayable'])
            ->when($request->search, function ($query, $search) {
                $query->where(function ($q) use ($search) {
                    $q->where('po_number', 'ilike', "%{$search}%")
                        ->orWhereHas('supplier', function ($supQ) use ($search) {
                            $supQ->where('name', 'ilike', "%{$search}%")
                                ->orWhere('code', 'ilike', "%{$search}%");
                        });
                });
            })
            ->when($request->status && $request->status !== 'all', function ($query) use ($request) {
                $query->where('status', $request->status);
            })
            ->when($request->receiving_status && $request->receiving_status !== 'all', function ($query) use ($request) {
                $query->where('receiving_status', $request->receiving_status);
            })
            ->when($request->payment_status && $request->payment_status !== 'all', function ($query) use ($request) {
                $query->where('payment_status', $request->payment_status);
            })
            ->when($request->supplier_id && $request->supplier_id !== 'all', function ($query) use ($request) {
                $query->where('supplier_id', $request->supplier_id);
            })
            ->when($request->start_date, function ($query, $date) {
                $query->whereDate('order_date', '>=', $date);
            })
            ->when($request->end_date, function ($query, $date) {
                $query->whereDate('order_date', '<=', $date);
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

        $user = $request->user();

        $purchaseOrders = $query->paginate($perPage)
            ->withQueryString()
            ->through(fn (PurchaseOrder $po) => [
                'id' => $po->id,
                'po_number' => $po->po_number,
                'supplier_id' => $po->supplier_id,
                'supplier_name' => $po->supplier?->name ?? '-',
                'creator_name' => $po->user?->name ?? 'Sistem',
                'approver_name' => $po->approvedBy?->name,
                'order_date' => $po->order_date?->format('d M Y'),
                'expected_date' => $po->expected_date?->format('d M Y'),
                'received_at' => $po->received_at?->format('d M Y H:i'),
                'due_date' => $po->due_date?->format('d M Y'),
                'status' => $po->status->value,
                'status_label' => $po->status->label(),
                'receiving_status' => $po->receiving_status->value,
                'receiving_status_label' => $po->receiving_status->label(),
                'payment_status' => $po->payment_status->value,
                'payment_status_label' => $po->payment_status->label(),
                'is_locked' => $po->isLocked(),
                'needs_approval' => $po->status === PurchaseOrderStatus::PendingApproval,
                'items_count' => $po->items->count(),
                'total_base_qty_ordered' => (int) $po->items->sum('base_qty_ordered'),
                'total_base_qty_received' => (int) $po->items->sum('base_qty_received'),
                'subtotal' => $po->subtotal,
                'discount_amount' => $po->discount_amount,
                'tax_amount' => $po->tax_amount,
                'total_amount' => $po->total_amount,
                'paid_amount' => (float) ($po->accountPayable?->paid_amount ?? 0),
                'remaining_amount' => (float) ($po->accountPayable?->remaining_amount ?? $po->total_amount),
                'can_edit' => $user ? $user->can('update', $po) : false,
                'can_delete' => $user ? $user->can('delete', $po) : false,
                'can_cancel' => $user ? $user->can('cancel', $po) : false,
                'created_at' => $po->created_at?->format('d M Y H:i'),
            ]);

        $suppliers = Supplier::orderBy('name')->get(['id', 'name', 'code', 'is_active']);

        $summaryRow = PurchaseOrder::query()
            ->when($request->filled('start_date'), function ($query) use ($request): void {
                $query->whereDate('order_date', '>=', (string) $request->input('start_date'));
            })
            ->when($request->filled('end_date'), function ($query) use ($request): void {
                $query->whereDate('order_date', '<=', (string) $request->input('end_date'));
            })
            ->selectRaw(
                'COUNT(*) as total_orders,
                COALESCE(SUM(total_amount), 0) as total_amount,
                COUNT(*) FILTER (WHERE status = ? AND receiving_status = ?) as completed_orders,
                COUNT(*) FILTER (WHERE status IN (?, ?) OR (status = ? AND receiving_status IN (?, ?))) as in_progress_orders,
                COUNT(*) FILTER (WHERE status = ?) as pending_approval_count,
                COUNT(*) FILTER (WHERE status IN (?, ?)) as rejected_or_cancelled_orders,
                COUNT(*) FILTER (WHERE status = ?) as rejected_orders,
                COUNT(*) FILTER (WHERE status = ?) as cancelled_orders',
                [
                    PurchaseOrderStatus::Approved->value,
                    ReceivingStatus::Received->value,
                    PurchaseOrderStatus::Draft->value,
                    PurchaseOrderStatus::PendingApproval->value,
                    PurchaseOrderStatus::Approved->value,
                    ReceivingStatus::Unreceived->value,
                    ReceivingStatus::Partial->value,
                    PurchaseOrderStatus::PendingApproval->value,
                    PurchaseOrderStatus::Rejected->value,
                    PurchaseOrderStatus::Cancelled->value,
                    PurchaseOrderStatus::Rejected->value,
                    PurchaseOrderStatus::Cancelled->value,
                ]
            )
            ->first();

        $pendingApprovalCount = (int) ($summaryRow->pending_approval_count ?? 0);

        $summary = [
            'total_orders' => (int) ($summaryRow->total_orders ?? 0),
            'total_amount' => round((float) ($summaryRow->total_amount ?? 0), 2),
            'completed_orders' => (int) ($summaryRow->completed_orders ?? 0),
            'in_progress_orders' => (int) ($summaryRow->in_progress_orders ?? 0),
            'pending_approval_count' => $pendingApprovalCount,
            'rejected_or_cancelled_orders' => (int) ($summaryRow->rejected_or_cancelled_orders ?? 0),
            'rejected_orders' => (int) ($summaryRow->rejected_orders ?? 0),
            'cancelled_orders' => (int) ($summaryRow->cancelled_orders ?? 0),
        ];

        return Inertia::render('POS/PurchaseOrders/PurchaseOrder', [
            'purchaseOrders' => $purchaseOrders,
            'filters' => $filters,
            'summary' => $summary,
            'suppliers' => $suppliers,
            'pendingApprovalCount' => $pendingApprovalCount,
            'statuses' => collect(PurchaseOrderStatus::cases())->map(fn ($s) => [
                'value' => $s->value,
                'label' => $s->label(),
            ]),
            'receivingStatuses' => collect(ReceivingStatus::cases())->map(fn ($s) => [
                'value' => $s->value,
                'label' => $s->label(),
            ]),
            'paymentStatuses' => collect(PaymentStatus::cases())->map(fn ($s) => [
                'value' => $s->value,
                'label' => $s->label(),
            ]),
        ]);
    }

    public function create(Request $request): Response
    {
        Gate::authorize('create', PurchaseOrder::class);

        $suppliers = Supplier::where('is_active', true)
            ->orderBy('name')
            ->get(['id', 'name', 'code', 'payment_term_days', 'phone']);

        $products = $this->getProductOptions(true);

        return Inertia::render('POS/PurchaseOrders/Create', [
            'suppliers' => $suppliers,
            'products' => $products,
            'isAdmin' => $request->user()->hasRoles(UserRoles::Admin),
        ]);
    }

    public function store(StorePurchaseOrderRequest $request, PurchaseOrderService $service): RedirectResponse
    {
        $po = $service->create($request->validated(), $request->user());

        $message = match ($po->status) {
            PurchaseOrderStatus::PendingApproval => "Purchase Order {$po->po_number} berhasil diajukan dan menunggu persetujuan Admin.",
            PurchaseOrderStatus::Approved => "Purchase Order {$po->po_number} berhasil dibuat dan langsung disetujui.",
            default => "Purchase Order {$po->po_number} berhasil disimpan sebagai Draft.",
        };

        return redirect()->route('pos.purchase-orders.show', $po->id)
            ->with('success', $message);
    }

    public function show(Request $request, PurchaseOrder $purchaseOrder): Response
    {
        Gate::authorize('view', $purchaseOrder);

        $purchaseOrder->load([
            'supplier',
            'user',
            'receivedBy',
            'approvedBy',
            'rejectedBy',
            'items.product.category',
            'receipts.receivedBy',
            'receipts.items.product',
            'accountPayable.payments.financialAccount',
            'accountPayable.payments.paidBy',
        ]);

        $activities = Activity::forSubject($purchaseOrder)
            ->with('causer')
            ->latest('id')
            ->get()
            ->map(fn (Activity $act) => [
                'id' => $act->id,
                'description' => $act->description,
                'event' => $act->event,
                'causer_name' => $act->causer?->name ?? 'Sistem',
                'properties' => $act->properties?->toArray() ?? [],
                'created_at' => $act->created_at?->format('d M Y H:i:s'),
                'created_at_human' => $act->created_at?->diffForHumans(),
            ]);

        $financialAccounts = FinancialAccount::where('is_active', true)
            ->orderByDesc('is_default')
            ->orderBy('name')
            ->get(['id', 'code', 'name', 'type', 'current_balance', 'is_default'])
            ->map(fn (FinancialAccount $acc) => [
                'id' => $acc->id,
                'code' => $acc->code,
                'name' => $acc->name,
                'type' => $acc->type->value,
                'type_label' => $acc->type->label(),
                'current_balance' => (float) $acc->current_balance,
                'is_default' => (bool) $acc->is_default,
            ]);

        $user = $request->user();
        $payable = $purchaseOrder->accountPayable;

        return Inertia::render('POS/PurchaseOrders/DetailPurchaseOrder', [
            'purchaseOrder' => [
                'id' => $purchaseOrder->id,
                'po_number' => $purchaseOrder->po_number,
                'order_date' => $purchaseOrder->order_date?->format('d M Y'),
                'raw_order_date' => $purchaseOrder->order_date?->toDateString(),
                'expected_date' => $purchaseOrder->expected_date?->format('d M Y'),
                'received_at' => $purchaseOrder->received_at?->format('d M Y H:i:s'),
                'due_date' => $purchaseOrder->due_date?->format('d M Y'),
                'submitted_at' => $purchaseOrder->submitted_at?->format('d M Y H:i'),
                'approved_at' => $purchaseOrder->approved_at?->format('d M Y H:i'),
                'rejected_at' => $purchaseOrder->rejected_at?->format('d M Y H:i'),
                'rejection_reason' => $purchaseOrder->rejection_reason,
                'status' => $purchaseOrder->status->value,
                'status_label' => $purchaseOrder->status->label(),
                'receiving_status' => $purchaseOrder->receiving_status->value,
                'receiving_status_label' => $purchaseOrder->receiving_status->label(),
                'payment_status' => $purchaseOrder->payment_status->value,
                'payment_status_label' => $purchaseOrder->payment_status->label(),
                'is_locked' => $purchaseOrder->isLocked(),
                'subtotal' => $purchaseOrder->subtotal,
                'discount_type' => $purchaseOrder->discount_type ?? 'fixed',
                'discount_value' => $purchaseOrder->discount_value,
                'discount_amount' => $purchaseOrder->discount_amount,
                'tax_type' => $purchaseOrder->tax_type ?? 'percent',
                'tax_value' => $purchaseOrder->tax_value,
                'tax_percentage' => $purchaseOrder->tax_percentage,
                'tax_amount' => $purchaseOrder->tax_amount,
                'total_amount' => $purchaseOrder->total_amount,
                'notes' => $purchaseOrder->notes,
                'created_at' => $purchaseOrder->created_at?->format('d M Y H:i'),
                'supplier' => $purchaseOrder->supplier ? [
                    'id' => $purchaseOrder->supplier->id,
                    'code' => $purchaseOrder->supplier->code,
                    'name' => $purchaseOrder->supplier->name,
                    'contact_person' => $purchaseOrder->supplier->contact_person,
                    'phone' => $purchaseOrder->supplier->phone,
                    'email' => $purchaseOrder->supplier->email,
                    'address' => $purchaseOrder->supplier->address,
                    'city' => $purchaseOrder->supplier->city,
                    'npwp' => $purchaseOrder->supplier->npwp,
                    'payment_term_days' => $purchaseOrder->supplier->payment_term_days,
                    'bank_name' => $purchaseOrder->supplier->bank_name,
                    'bank_account_number' => $purchaseOrder->supplier->bank_account_number,
                    'bank_account_name' => $purchaseOrder->supplier->bank_account_name,
                ] : null,
                'creator' => $purchaseOrder->user ? [
                    'id' => $purchaseOrder->user->id,
                    'name' => $purchaseOrder->user->name,
                    'role' => $purchaseOrder->user->role?->label(),
                ] : null,
                'approved_by' => $purchaseOrder->approvedBy ? [
                    'id' => $purchaseOrder->approvedBy->id,
                    'name' => $purchaseOrder->approvedBy->name,
                ] : null,
                'rejected_by' => $purchaseOrder->rejectedBy ? [
                    'id' => $purchaseOrder->rejectedBy->id,
                    'name' => $purchaseOrder->rejectedBy->name,
                ] : null,
                'received_by' => $purchaseOrder->receivedBy ? [
                    'id' => $purchaseOrder->receivedBy->id,
                    'name' => $purchaseOrder->receivedBy->name,
                ] : null,
                'items' => $purchaseOrder->items->map(fn ($item) => [
                    'id' => $item->id,
                    'product_id' => $item->product_id,
                    'product_name' => $item->product?->name ?? 'Produk Dihapus',
                    'barcode' => $item->product?->barcode ?? '-',
                    'base_unit' => $item->product?->base_unit ?: 'pcs',
                    'category_name' => $item->product?->category?->name ?? '-',
                    'current_stock' => (int) ($item->product?->stock ?? 0),
                    'current_buy_price' => (float) ($item->product?->buy_price ?? 0),
                    'unit_name' => $item->unit_name ?: 'pcs',
                    'conversion_factor' => (int) $item->conversion_factor,
                    'quantity_ordered' => (int) $item->quantity_ordered,
                    'quantity_received' => (int) $item->quantity_received,
                    'remaining_quantity' => (int) $item->remaining_quantity,
                    'free_qty_ordered' => (int) $item->free_qty_ordered,
                    'free_qty_received' => (int) $item->free_qty_received,
                    'remaining_free_quantity' => (int) $item->remaining_free_quantity,
                    'base_qty_ordered' => (int) $item->base_qty_ordered,
                    'base_qty_received' => (int) $item->base_qty_received,
                    'unit_cost' => (float) $item->unit_cost,
                    'net_unit_cost' => (float) $item->net_unit_cost,
                    'discount_type' => $item->discount_type ?? 'fixed',
                    'discount_value' => (float) $item->discount_value,
                    'discount_amount' => (float) $item->discount_amount,
                    'subtotal' => (float) $item->subtotal,
                    'expired_date' => $item->expired_date?->format('d M Y'),
                    'raw_expired_date' => $item->expired_date?->toDateString(),
                ]),
                'receipts' => $purchaseOrder->receipts->map(fn (PurchaseOrderReceipt $receipt) => [
                    'id' => $receipt->id,
                    'receipt_number' => $receipt->receipt_number,
                    'supplier_delivery_note' => $receipt->supplier_delivery_note,
                    'received_date' => $receipt->received_date?->format('d M Y'),
                    'received_by_name' => $receipt->receivedBy?->name ?? 'Sistem',
                    'notes' => $receipt->notes,
                    'created_at' => $receipt->created_at?->format('d M Y H:i'),
                    'items' => $receipt->items->map(fn ($rItem) => [
                        'id' => $rItem->id,
                        'product_name' => $rItem->product?->name ?? 'Produk Dihapus',
                        'base_unit' => $rItem->product?->base_unit ?: 'pcs',
                        'unit_name' => $rItem->unit_name,
                        'conversion_factor' => (int) $rItem->conversion_factor,
                        'qty_received' => (int) $rItem->qty_received,
                        'free_qty_received' => (int) $rItem->free_qty_received,
                        'base_qty_received' => (int) $rItem->base_qty_received,
                        'unit_cost' => (float) $rItem->unit_cost,
                        'base_unit_cost' => (float) $rItem->base_unit_cost,
                        'batch_number' => $rItem->batch_number,
                        'expired_date' => $rItem->expired_date?->format('d M Y'),
                    ]),
                ]),
                'account_payable' => $payable ? [
                    'id' => $payable->id,
                    'payable_number' => $payable->payable_number,
                    'invoice_number' => $payable->invoice_number,
                    'total_amount' => (float) $payable->total_amount,
                    'paid_amount' => (float) $payable->paid_amount,
                    'remaining_amount' => (float) $payable->remaining_amount,
                    'due_date' => $payable->due_date?->format('d M Y'),
                    'is_overdue' => $payable->isOverdue(),
                    'status' => $payable->status->value,
                    'status_label' => $payable->status->label(),
                    'payments' => $payable->payments->sortByDesc('id')->values()->map(fn ($pay) => [
                        'id' => $pay->id,
                        'payment_number' => $pay->payment_number,
                        'amount' => (float) $pay->amount,
                        'payment_date' => $pay->payment_date?->format('d M Y'),
                        'payment_method' => $pay->payment_method->value,
                        'payment_method_label' => $pay->payment_method->label(),
                        'financial_account_name' => $pay->financialAccount?->name ?? '-',
                        'reference_number' => $pay->reference_number,
                        'notes' => $pay->notes,
                        'paid_by_name' => $pay->paidBy?->name ?? 'Sistem',
                        'created_at' => $pay->created_at?->format('d M Y H:i'),
                    ]),
                ] : null,
            ],
            'permissions' => [
                'canEdit' => $user->can('update', $purchaseOrder),
                'canDelete' => $user->can('delete', $purchaseOrder),
                'canSubmit' => $user->can('submit', $purchaseOrder),
                'canApprove' => $user->can('approve', $purchaseOrder),
                'canReject' => $user->can('reject', $purchaseOrder),
                'canRevise' => $user->can('revise', $purchaseOrder),
                'canReceive' => $user->can('receive', $purchaseOrder),
                'canCloseRemaining' => $user->can('closeRemaining', $purchaseOrder),
                'canRecordPayment' => $user->can('recordPayment', $purchaseOrder),
                'canCancel' => $user->can('cancel', $purchaseOrder),
            ],
            'financialAccounts' => $financialAccounts,
            'paymentMethods' => collect(PaymentMethod::cases())->map(fn ($m) => [
                'value' => $m->value,
                'label' => $m->label(),
            ]),
            'activities' => $activities,
        ]);
    }

    public function downloadPdf(PurchaseOrder $purchaseOrder): HttpResponse
    {
        Gate::authorize('view', $purchaseOrder);

        $purchaseOrder->load(['supplier', 'user', 'approvedBy', 'receivedBy', 'items.product.category']);

        $pdf = Pdf::loadView('pdf.purchase-order', [
            'purchaseOrder' => $purchaseOrder,
        ])->setPaper('a4', 'portrait');

        $filename = preg_replace('/[^A-Za-z0-9_-]+/', '-', $purchaseOrder->po_number).'.pdf';

        return $pdf->download($filename);
    }

    public function downloadReceiptPdf(PurchaseOrder $purchaseOrder, PurchaseOrderReceipt $receipt): HttpResponse
    {
        Gate::authorize('view', $purchaseOrder);

        abort_unless((int) $receipt->purchase_order_id === (int) $purchaseOrder->id, 404);

        $receipt->load(['purchaseOrder.supplier', 'receivedBy', 'items.product']);

        $pdf = Pdf::loadView('pdf.goods-receipt', [
            'purchaseOrder' => $purchaseOrder,
            'receipt' => $receipt,
        ])->setPaper('a4', 'portrait');

        $filename = preg_replace('/[^A-Za-z0-9_-]+/', '-', $receipt->receipt_number).'.pdf';

        return $pdf->download($filename);
    }

    public function edit(Request $request, PurchaseOrder $purchaseOrder): Response
    {
        Gate::authorize('update', $purchaseOrder);

        $purchaseOrder->load(['supplier', 'items.product.activeUnits', 'accountPayable']);

        $suppliers = Supplier::where('is_active', true)
            ->orWhere('id', $purchaseOrder->supplier_id)
            ->orderBy('name')
            ->get(['id', 'name', 'code', 'payment_term_days', 'phone']);

        $products = $this->getProductOptions(false);

        $isSupplierLocked = $purchaseOrder->status === PurchaseOrderStatus::Approved
            || $purchaseOrder->hasAnyReceipts();

        return Inertia::render('POS/PurchaseOrders/Edit', [
            'purchaseOrder' => [
                'id' => $purchaseOrder->id,
                'po_number' => $purchaseOrder->po_number,
                'supplier_id' => $purchaseOrder->supplier_id,
                'order_date' => $purchaseOrder->order_date?->toDateString(),
                'expected_date' => $purchaseOrder->expected_date?->toDateString(),
                'due_date' => $purchaseOrder->due_date?->toDateString(),
                'status' => $purchaseOrder->status->value,
                'status_label' => $purchaseOrder->status->label(),
                'receiving_status' => $purchaseOrder->receiving_status->value,
                'rejection_reason' => $purchaseOrder->rejection_reason,
                'discount_type' => $purchaseOrder->discount_type ?? 'fixed',
                'discount_value' => $purchaseOrder->discount_value,
                'discount_amount' => $purchaseOrder->discount_amount,
                'tax_type' => $purchaseOrder->tax_type ?? 'percent',
                'tax_value' => $purchaseOrder->tax_value,
                'tax_percentage' => $purchaseOrder->tax_percentage,
                'tax_amount' => $purchaseOrder->tax_amount,
                'paid_amount' => (float) ($purchaseOrder->accountPayable?->paid_amount ?? 0),
                'notes' => $purchaseOrder->notes,
                'is_supplier_locked' => $isSupplierLocked,
                'items' => $purchaseOrder->items->map(fn ($item) => [
                    'id' => $item->id,
                    'product_id' => $item->product_id,
                    'product_unit_id' => $item->product_unit_id,
                    'unit_name' => $item->unit_name ?: 'pcs',
                    'conversion_factor' => (int) $item->conversion_factor,
                    'product_name' => $item->product?->name ?? 'Produk Dihapus',
                    'barcode' => $item->product?->barcode ?? '-',
                    'base_unit' => $item->product?->base_unit ?: 'pcs',
                    'quantity_ordered' => (int) $item->quantity_ordered,
                    'quantity_received' => (int) $item->quantity_received,
                    'free_qty_ordered' => (int) $item->free_qty_ordered,
                    'free_qty_received' => (int) $item->free_qty_received,
                    'unit_cost' => (float) $item->unit_cost,
                    'discount_type' => $item->discount_type ?? 'fixed',
                    'discount_value' => (float) $item->discount_value,
                    'discount_amount' => (float) $item->discount_amount,
                    'subtotal' => (float) $item->subtotal,
                    'expired_date' => $item->expired_date?->toDateString(),
                    'units' => $item->product?->activeUnits->map(fn (ProductUnit $unit) => [
                        'id' => $unit->id,
                        'unit_name' => $unit->unit_name,
                        'conversion_factor' => (int) $unit->conversion_factor,
                        'buy_price' => (float) $unit->buy_price,
                        'is_default_purchase' => (bool) $unit->is_default_purchase,
                    ])->values()->all() ?? [],
                ]),
            ],
            'suppliers' => $suppliers,
            'products' => $products,
            'isAdmin' => $request->user()->hasRoles(UserRoles::Admin),
        ]);
    }

    public function update(UpdatePurchaseOrderRequest $request, PurchaseOrder $purchaseOrder, PurchaseOrderService $service): RedirectResponse
    {
        $po = $service->update($purchaseOrder, $request->validated(), $request->user());

        return redirect()->route('pos.purchase-orders.show', $po->id)
            ->with('success', "Purchase Order {$po->po_number} berhasil diperbarui.");
    }

    public function destroy(Request $request, PurchaseOrder $purchaseOrder, PurchaseOrderService $service): RedirectResponse
    {
        Gate::authorize('delete', $purchaseOrder);

        $poNumber = $purchaseOrder->po_number;
        $service->delete($purchaseOrder, $request->user());

        return redirect()->route('pos.purchase-orders.index')
            ->with('success', "Purchase Order {$poNumber} berhasil dihapus.");
    }

    public function submit(Request $request, PurchaseOrder $purchaseOrder, PurchaseOrderService $service): RedirectResponse
    {
        Gate::authorize('submit', $purchaseOrder);

        $po = $service->submitForApproval($purchaseOrder, $request->user());

        $message = $po->status === PurchaseOrderStatus::Approved
            ? "Purchase Order {$po->po_number} langsung disetujui."
            : "Purchase Order {$po->po_number} berhasil diajukan untuk persetujuan Admin.";

        return back()->with('success', $message);
    }

    public function approve(Request $request, PurchaseOrder $purchaseOrder, PurchaseOrderService $service): RedirectResponse
    {
        Gate::authorize('approve', $purchaseOrder);

        $po = $service->approve($purchaseOrder, $request->user());

        return back()->with('success', "Purchase Order {$po->po_number} telah disetujui dan hutang dagang telah dibuat.");
    }

    public function reject(RejectPurchaseOrderRequest $request, PurchaseOrder $purchaseOrder, PurchaseOrderService $service): RedirectResponse
    {
        $po = $service->reject($purchaseOrder, $request->user(), (string) $request->validated('rejection_reason'));

        return back()->with('success', "Purchase Order {$po->po_number} telah ditolak.");
    }

    public function revise(Request $request, PurchaseOrder $purchaseOrder, PurchaseOrderService $service): RedirectResponse
    {
        Gate::authorize('revise', $purchaseOrder);

        $po = $service->reviseToDraft($purchaseOrder, $request->user());

        return redirect()->route('pos.purchase-orders.edit', $po->id)
            ->with('success', "Purchase Order {$po->po_number} dikembalikan ke Draft untuk direvisi.");
    }

    public function receive(ReceivePurchaseOrderRequest $request, PurchaseOrder $purchaseOrder, GoodsReceiptService $receiptService): RedirectResponse
    {
        $receipt = $receiptService->receiveGoods($purchaseOrder, $request->validated(), $request->user());

        return back()->with('success', "Penerimaan barang {$receipt->receipt_number} berhasil dicatat. Stok, HPP rata-rata, dan kartu stok telah diperbarui.");
    }

    public function recordPayment(
        StorePayablePaymentRequest $request,
        PurchaseOrder $purchaseOrder,
        FinanceService $financeService
    ): RedirectResponse {
        $payable = $purchaseOrder->accountPayable
            ?? $financeService->syncPayableForPurchaseOrder($purchaseOrder, $request->user());

        $payment = $financeService->recordPayablePayment($payable, $request->validated(), $request->user());

        return back()->with('success', "Pembayaran {$payment->payment_number} berhasil dicatat dan saldo kas/bank telah diperbarui.");
    }

    public function closeRemaining(Request $request, PurchaseOrder $purchaseOrder, PurchaseOrderService $service): RedirectResponse
    {
        Gate::authorize('closeRemaining', $purchaseOrder);

        $service->closeRemaining($purchaseOrder, $request->user(), $request->input('reason'));

        return back()->with('success', "Sisa pesanan PO {$purchaseOrder->po_number} berhasil ditutup dan total hutang disesuaikan.");
    }

    public function cancel(Request $request, PurchaseOrder $purchaseOrder, PurchaseOrderService $service): RedirectResponse
    {
        Gate::authorize('cancel', $purchaseOrder);

        $service->cancel($purchaseOrder, $request->user(), $request->input('reason'));

        return back()->with('success', "Purchase Order {$purchaseOrder->po_number} berhasil dibatalkan.");
    }

    /**
     * @return Collection<int, array<string, mixed>>
     */
    private function getProductOptions(bool $onlyActive)
    {
        return Product::query()
            ->when($onlyActive, fn ($q) => $q->where('active', true))
            ->with(['category:id,name', 'activeUnits'])
            ->orderBy('name')
            ->get(['id', 'name', 'base_unit', 'barcode', 'buy_price', 'sell_price', 'stock', 'min_stock', 'category_id'])
            ->map(fn (Product $product) => [
                'id' => $product->id,
                'name' => $product->name,
                'base_unit' => $product->base_unit ?: 'pcs',
                'barcode' => $product->barcode,
                'buy_price' => (float) $product->buy_price,
                'sell_price' => (float) $product->sell_price,
                'stock' => (int) $product->stock,
                'min_stock' => (int) $product->min_stock,
                'category_id' => $product->category_id,
                'category' => $product->category ? [
                    'id' => $product->category->id,
                    'name' => $product->category->name,
                ] : null,
                'units' => $product->activeUnits->map(fn (ProductUnit $unit) => [
                    'id' => $unit->id,
                    'unit_name' => $unit->unit_name,
                    'conversion_factor' => (int) $unit->conversion_factor,
                    'barcode' => $unit->barcode,
                    'buy_price' => (float) $unit->buy_price,
                    'sell_price' => $unit->sell_price !== null ? (float) $unit->sell_price : null,
                    'is_default_purchase' => (bool) $unit->is_default_purchase,
                ])->values()->all(),
            ]);
    }
}

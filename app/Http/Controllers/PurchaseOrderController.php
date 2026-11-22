<?php

namespace App\Http\Controllers;

use App\Enums\PaymentStatus;
use App\Enums\PurchaseOrderStatus;
use App\Http\Requests\ReceivePurchaseOrderRequest;
use App\Http\Requests\StorePurchaseOrderRequest;
use App\Http\Requests\UpdatePurchaseOrderRequest;
use App\Models\Product;
use App\Models\PurchaseOrder;
use App\Models\Supplier;
use App\Services\PurchaseOrderService;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response as HttpResponse;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rules\Enum;
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

        $allowedSorts = ['po_number', 'order_date', 'expected_date', 'due_date', 'status', 'payment_status', 'total_amount', 'created_at'];

        $tableSort = $request->input('table_sort');
        $tableDirection = strtolower((string) $request->input('table_direction')) === 'asc' ? 'asc' : 'desc';
        $hasTableSort = ! empty($tableSort) && in_array($tableSort, $allowedSorts, true);

        $toolbarSort = $request->input('sort');
        $toolbarDirection = strtolower((string) $request->input('direction')) === 'asc' ? 'asc' : 'desc';
        $hasToolbarSort = ! empty($toolbarSort) && in_array($toolbarSort, $allowedSorts, true);

        $query = PurchaseOrder::with(['supplier', 'user', 'receivedBy', 'items'])
            ->when($request->search, function ($query, $search) {
                $query->where('po_number', 'ilike', "%{$search}%");
            })
            ->when($request->status && $request->status !== 'all', function ($query) use ($request) {
                $query->where('status', $request->status);
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
        }

        $purchaseOrders = $query->paginate($perPage)
            ->withQueryString()
            ->through(fn (PurchaseOrder $po) => [
                'id' => $po->id,
                'po_number' => $po->po_number,
                'supplier_id' => $po->supplier_id,
                'supplier_name' => $po->supplier?->name ?? '-',
                'creator_name' => $po->user?->name ?? 'Sistem',
                'order_date' => $po->order_date?->format('d M Y'),
                'expected_date' => $po->expected_date?->format('d M Y'),
                'received_at' => $po->received_at?->format('d M Y H:i'),
                'due_date' => $po->due_date?->format('d M Y'),
                'status' => $po->status->value,
                'status_label' => $po->status->label(),
                'payment_status' => $po->payment_status->value,
                'payment_status_label' => $po->payment_status->label(),
                'items_count' => $po->items->count(),
                'total_quantity_ordered' => $po->items->sum('quantity_ordered'),
                'total_quantity_received' => $po->items->sum('quantity_received'),
                'subtotal' => $po->subtotal,
                'discount_amount' => $po->discount_amount,
                'tax_amount' => $po->tax_amount,
                'total_amount' => $po->total_amount,
                'created_at' => $po->created_at?->format('d M Y H:i'),
            ]);

        $suppliers = Supplier::orderBy('name')->get(['id', 'name', 'code', 'is_active']);

        return Inertia::render('POS/PurchaseOrders/Index', [
            'purchaseOrders' => $purchaseOrders,
            'filters' => $filters,
            'suppliers' => $suppliers,
            'statuses' => collect(PurchaseOrderStatus::cases())->map(fn ($s) => [
                'value' => $s->value,
                'label' => $s->label(),
            ]),
            'paymentStatuses' => collect(PaymentStatus::cases())->map(fn ($s) => [
                'value' => $s->value,
                'label' => $s->label(),
            ]),
        ]);
    }

    public function create(): Response
    {
        Gate::authorize('create', PurchaseOrder::class);

        $suppliers = Supplier::where('is_active', true)
            ->orderBy('name')
            ->get(['id', 'name', 'code', 'payment_term_days', 'phone']);

        $products = Product::where('active', true)
            ->with('category:id,name')
            ->orderBy('name')
            ->get(['id', 'name', 'barcode', 'buy_price', 'sell_price', 'stock', 'min_stock', 'category_id']);

        return Inertia::render('POS/PurchaseOrders/Create', [
            'suppliers' => $suppliers,
            'products' => $products,
        ]);
    }

    public function store(StorePurchaseOrderRequest $request, PurchaseOrderService $service): RedirectResponse
    {
        $po = $service->create($request->validated(), $request->user());

        return redirect()->route('pos.purchase-orders.show', $po->id)
            ->with('success', "Purchase Order {$po->po_number} berhasil dibuat.");
    }

    public function show(PurchaseOrder $purchaseOrder): Response
    {
        Gate::authorize('view', $purchaseOrder);

        $purchaseOrder->load(['supplier', 'user', 'receivedBy', 'items.product.category']);

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

        return Inertia::render('POS/PurchaseOrders/Show', [
            'purchaseOrder' => [
                'id' => $purchaseOrder->id,
                'po_number' => $purchaseOrder->po_number,
                'order_date' => $purchaseOrder->order_date?->format('d M Y'),
                'raw_order_date' => $purchaseOrder->order_date?->toDateString(),
                'expected_date' => $purchaseOrder->expected_date?->format('d M Y'),
                'received_at' => $purchaseOrder->received_at?->format('d M Y H:i:s'),
                'due_date' => $purchaseOrder->due_date?->format('d M Y'),
                'status' => $purchaseOrder->status->value,
                'status_label' => $purchaseOrder->status->label(),
                'payment_status' => $purchaseOrder->payment_status->value,
                'payment_status_label' => $purchaseOrder->payment_status->label(),
                'subtotal' => $purchaseOrder->subtotal,
                'discount_type' => $purchaseOrder->discount_type ?? 'fixed',
                'discount_value' => $purchaseOrder->discount_value,
                'discount_amount' => $purchaseOrder->discount_amount,
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
                'received_by' => $purchaseOrder->receivedBy ? [
                    'id' => $purchaseOrder->receivedBy->id,
                    'name' => $purchaseOrder->receivedBy->name,
                ] : null,
                'items' => $purchaseOrder->items->map(fn ($item) => [
                    'id' => $item->id,
                    'product_id' => $item->product_id,
                    'product_name' => $item->product?->name ?? 'Produk Dihapus',
                    'barcode' => $item->product?->barcode ?? '-',
                    'category_name' => $item->product?->category?->name ?? '-',
                    'current_stock' => $item->product?->stock ?? 0,
                    'current_buy_price' => $item->product?->buy_price ?? 0,
                    'quantity_ordered' => (int) $item->quantity_ordered,
                    'quantity_received' => (int) $item->quantity_received,
                    'remaining_quantity' => max(0, (int) $item->quantity_ordered - (int) $item->quantity_received),
                    'unit_cost' => $item->unit_cost,
                    'subtotal' => $item->subtotal,
                    'expired_date' => $item->expired_date?->format('d M Y'),
                    'raw_expired_date' => $item->expired_date?->toDateString(),
                ]),
            ],
            'activities' => $activities,
        ]);
    }

    public function downloadPdf(PurchaseOrder $purchaseOrder): HttpResponse
    {
        Gate::authorize('view', $purchaseOrder);

        $purchaseOrder->load(['supplier', 'user', 'receivedBy', 'items.product.category']);

        $pdf = Pdf::loadView('pdf.purchase-order', [
            'purchaseOrder' => $purchaseOrder,
        ])->setPaper('a4', 'portrait');

        $filename = preg_replace('/[^A-Za-z0-9_-]+/', '-', $purchaseOrder->po_number) . '.pdf';

        return $pdf->download($filename);
    }

    public function edit(PurchaseOrder $purchaseOrder): Response
    {
        Gate::authorize('update', $purchaseOrder);

        $purchaseOrder->load(['supplier', 'items.product']);

        $suppliers = Supplier::where('is_active', true)
            ->orderBy('name')
            ->get(['id', 'name', 'code', 'payment_term_days', 'phone']);

        $products = Product::where('active', true)
            ->with('category:id,name')
            ->orderBy('name')
            ->get(['id', 'name', 'barcode', 'buy_price', 'sell_price', 'stock', 'min_stock', 'category_id']);

        return Inertia::render('POS/PurchaseOrders/Edit', [
            'purchaseOrder' => [
                'id' => $purchaseOrder->id,
                'po_number' => $purchaseOrder->po_number,
                'supplier_id' => $purchaseOrder->supplier_id,
                'order_date' => $purchaseOrder->order_date?->toDateString(),
                'expected_date' => $purchaseOrder->expected_date?->toDateString(),
                'due_date' => $purchaseOrder->due_date?->toDateString(),
                'status' => $purchaseOrder->status->value,
                'discount_type' => $purchaseOrder->discount_type ?? 'fixed',
                'discount_value' => $purchaseOrder->discount_value,
                'discount_amount' => $purchaseOrder->discount_amount,
                'tax_percentage' => $purchaseOrder->tax_percentage,
                'tax_amount' => $purchaseOrder->tax_amount,
                'notes' => $purchaseOrder->notes,
                'items' => $purchaseOrder->items->map(fn ($item) => [
                    'id' => $item->id,
                    'product_id' => $item->product_id,
                    'product_name' => $item->product?->name ?? 'Produk Dihapus',
                    'barcode' => $item->product?->barcode ?? '-',
                    'quantity_ordered' => (int) $item->quantity_ordered,
                    'unit_cost' => $item->unit_cost,
                    'subtotal' => $item->subtotal,
                    'expired_date' => $item->expired_date?->toDateString(),
                ]),
            ],
            'suppliers' => $suppliers,
            'products' => $products,
        ]);
    }

    public function update(UpdatePurchaseOrderRequest $request, PurchaseOrder $purchaseOrder, PurchaseOrderService $service): RedirectResponse
    {
        $service->update($purchaseOrder, $request->validated(), $request->user());

        return redirect()->route('pos.purchase-orders.show', $purchaseOrder->id)
            ->with('success', "Purchase Order {$purchaseOrder->po_number} berhasil diperbarui.");
    }

    public function destroy(PurchaseOrder $purchaseOrder): RedirectResponse
    {
        Gate::authorize('delete', $purchaseOrder);

        $purchaseOrder->delete();

        return redirect()->route('pos.purchase-orders.index')
            ->with('success', "Purchase Order {$purchaseOrder->po_number} berhasil dihapus.");
    }

    public function receive(ReceivePurchaseOrderRequest $request, PurchaseOrder $purchaseOrder, PurchaseOrderService $service): RedirectResponse
    {
        $service->receiveGoods($purchaseOrder, $request->validated()['items'], $request->user());

        return back()->with('success', 'Barang berhasil diterima, stok ditambahkan, dan harga beli rata-rata tertimbang telah diperbarui.');
    }

    public function closeRemaining(Request $request, PurchaseOrder $purchaseOrder, PurchaseOrderService $service): RedirectResponse
    {
        Gate::authorize('closeRemaining', $purchaseOrder);

        $service->closeRemaining($purchaseOrder, $request->user(), $request->input('reason'));

        return back()->with('success', "Sisa pesanan PO {$purchaseOrder->po_number} berhasil ditutup.");
    }

    public function markOrdered(Request $request, PurchaseOrder $purchaseOrder, PurchaseOrderService $service): RedirectResponse
    {
        Gate::authorize('update', $purchaseOrder);

        $service->markAsOrdered($purchaseOrder, $request->user());

        return back()->with('success', "Purchase Order {$purchaseOrder->po_number} berhasil ditandai sebagai Dipesan.");
    }

    public function updatePaymentStatus(Request $request, PurchaseOrder $purchaseOrder, PurchaseOrderService $service): RedirectResponse
    {
        Gate::authorize('updatePaymentStatus', $purchaseOrder);

        $request->validate([
            'payment_status' => ['required', new Enum(PaymentStatus::class)],
        ]);

        $service->updatePaymentStatus(
            $purchaseOrder,
            PaymentStatus::from($request->input('payment_status')),
            $request->user()
        );

        return back()->with('success', 'Status pembayaran berhasil diperbarui.');
    }

    public function cancel(Request $request, PurchaseOrder $purchaseOrder, PurchaseOrderService $service): RedirectResponse
    {
        Gate::authorize('cancel', $purchaseOrder);

        $service->cancel($purchaseOrder, $request->user(), $request->input('reason'));

        return back()->with('success', "Purchase Order {$purchaseOrder->po_number} berhasil dibatalkan.");
    }
}

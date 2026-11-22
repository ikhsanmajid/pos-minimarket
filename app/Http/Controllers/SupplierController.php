<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreSupplierRequest;
use App\Http\Requests\UpdateSupplierRequest;
use App\Models\Supplier;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;
use Inertia\Response;
use Spatie\Activitylog\Models\Activity;

class SupplierController extends Controller
{
    public function index(Request $request): Response
    {
        Gate::authorize('viewAny', Supplier::class);

        $filters = $request->only([
            'search',
            'status',
            'sort',
            'direction',
            'table_sort',
            'table_direction',
        ]);
        $perPage = $request->integer('per_page', 10);

        $allowedSorts = ['code', 'name', 'city', 'payment_term_days', 'purchase_orders_count', 'is_active', 'created_at'];

        $tableSort = $request->input('table_sort');
        $tableDirection = strtolower((string) $request->input('table_direction')) === 'desc' ? 'desc' : 'asc';
        $hasTableSort = ! empty($tableSort) && in_array($tableSort, $allowedSorts, true);

        $toolbarSort = $request->input('sort');
        $toolbarDirection = strtolower((string) $request->input('direction')) === 'asc' ? 'asc' : 'desc';
        $hasToolbarSort = ! empty($toolbarSort) && in_array($toolbarSort, $allowedSorts, true);

        $query = Supplier::query()
            ->withCount('purchaseOrders')
            ->when($request->search, function ($query, $search) {
                $query->where(function ($q) use ($search) {
                    $q->where('name', 'ilike', "%{$search}%")
                        ->orWhere('code', 'ilike', "%{$search}%")
                        ->orWhere('contact_person', 'ilike', "%{$search}%")
                        ->orWhere('phone', 'ilike', "%{$search}%")
                        ->orWhere('city', 'ilike', "%{$search}%");
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

        if ($hasTableSort) {
            $query->orderBy($tableSort, $tableDirection);
        }

        if ($hasToolbarSort && (! $hasTableSort || $toolbarSort !== $tableSort)) {
            $query->orderBy($toolbarSort, $toolbarDirection);
        }

        if (! $hasTableSort && ! $hasToolbarSort) {
            $query->orderBy('name', 'asc');
        }

        $suppliers = $query->paginate($perPage)
            ->withQueryString()
            ->through(fn (Supplier $s) => [
                'id' => $s->id,
                'code' => $s->code,
                'name' => $s->name,
                'contact_person' => $s->contact_person,
                'phone' => $s->phone,
                'email' => $s->email,
                'address' => $s->address,
                'city' => $s->city,
                'npwp' => $s->npwp,
                'payment_term_days' => (int) $s->payment_term_days,
                'bank_name' => $s->bank_name,
                'bank_account_number' => $s->bank_account_number,
                'bank_account_name' => $s->bank_account_name,
                'is_active' => (bool) $s->is_active,
                'notes' => $s->notes,
                'purchase_orders_count' => (int) $s->purchase_orders_count,
                'created_at' => $s->created_at?->format('d M Y H:i'),
            ]);

        return Inertia::render('POS/Suppliers/Supplier', [
            'suppliers' => $suppliers,
            'filters' => $filters,
        ]);
    }

    public function show(Request $request, Supplier $supplier): Response
    {
        Gate::authorize('view', $supplier);

        $supplier->loadCount('purchaseOrders');

        return Inertia::render('POS/Suppliers/DetailSupplier', [
            'supplier' => [
                'id' => $supplier->id,
                'code' => $supplier->code,
                'name' => $supplier->name,
                'contact_person' => $supplier->contact_person,
                'phone' => $supplier->phone,
                'email' => $supplier->email,
                'address' => $supplier->address,
                'city' => $supplier->city,
                'npwp' => $supplier->npwp,
                'payment_term_days' => (int) $supplier->payment_term_days,
                'bank_name' => $supplier->bank_name,
                'bank_account_number' => $supplier->bank_account_number,
                'bank_account_name' => $supplier->bank_account_name,
                'is_active' => (bool) $supplier->is_active,
                'notes' => $supplier->notes,
                'purchase_orders_count' => (int) $supplier->purchase_orders_count,
                'created_at' => $supplier->created_at?->format('d M Y H:i'),
                'updated_at' => $supplier->updated_at?->format('d M Y H:i'),
            ],
            'activities' => Inertia::optional(function () use ($request, $supplier) {
                $perPage = $request->integer('per_page', 10);

                $paginated = Activity::forSubject($supplier)
                    ->with('causer')
                    ->latest('id')
                    ->paginate($perPage)
                    ->withQueryString();

                return [
                    'data' => collect($paginated->items())->map(fn (Activity $act) => [
                        'id' => $act->id,
                        'description' => $act->description,
                        'event' => $act->event,
                        'causer_name' => $act->causer instanceof User ? $act->causer->name : ($act->causer_id ? 'User #'.$act->causer_id : 'Sistem'),
                        'causer_role' => $act->causer instanceof User ? ($act->causer->role?->label() ?? $act->causer->role?->value) : null,
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

    public function search(Request $request): JsonResponse
    {
        Gate::authorize('viewAny', Supplier::class);

        $search = trim((string) $request->input('search', $request->input('q', '')));
        $onlyActive = $request->boolean('only_active', false);

        $suppliers = Supplier::query()
            ->when($onlyActive, function ($query) {
                $query->where('is_active', true);
            })
            ->when($search !== '', function ($query) use ($search) {
                $query->where(function ($q) use ($search) {
                    $q->where('name', 'ilike', "%{$search}%")
                        ->orWhere('code', 'ilike', "%{$search}%")
                        ->orWhere('contact_person', 'ilike', "%{$search}%")
                        ->orWhere('city', 'ilike', "%{$search}%");
                });
            })
            ->orderBy('name')
            ->limit(25)
            ->get(['id', 'name', 'code', 'payment_term_days', 'phone'])
            ->map(fn (Supplier $s) => [
                'value' => $s->id,
                'label' => $s->code ? "{$s->name} ({$s->code})" : $s->name,
                'id' => $s->id,
                'name' => $s->name,
                'code' => $s->code,
                'payment_term_days' => (int) $s->payment_term_days,
                'phone' => $s->phone,
            ]);

        return response()->json($suppliers);
    }

    public function store(StoreSupplierRequest $request): RedirectResponse
    {
        Supplier::create($request->validated());

        return back()->with('success', 'Supplier berhasil ditambahkan.');
    }

    public function update(UpdateSupplierRequest $request, Supplier $supplier): RedirectResponse
    {
        $supplier->update($request->validated());

        return back()->with('success', 'Supplier berhasil diperbarui.');
    }

    public function destroy(Supplier $supplier): RedirectResponse
    {
        Gate::authorize('delete', $supplier);

        if ($supplier->purchaseOrders()->exists()) {
            return back()->with('error', 'Supplier tidak dapat dihapus karena memiliki riwayat transaksi Purchase Order.');
        }

        $supplier->delete();

        return back()->with('success', 'Supplier berhasil dihapus.');
    }
}

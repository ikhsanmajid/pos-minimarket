<?php

namespace App\Http\Controllers;

use App\Enums\TransactionStatus;
use App\Http\Requests\StoreCustomerRequest;
use App\Http\Requests\UpdateCustomerRequest;
use App\Models\Customer;
use App\Models\Transaction;
use App\Models\User;
use App\Services\CustomerService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;
use Inertia\Response;
use Spatie\Activitylog\Models\Activity;

class CustomerController extends Controller
{
    public function __construct(public CustomerService $customerService) {}

    public function index(Request $request): Response
    {
        Gate::authorize('viewAny', Customer::class);

        $filters = $request->only([
            'search',
            'status',
            'sort',
            'direction',
            'table_sort',
            'table_direction',
        ]);
        $perPage = $request->integer('per_page', 10);

        $allowedSorts = ['member_code', 'name', 'phone', 'points', 'transactions_count', 'is_active', 'created_at'];

        $tableSort = $request->input('table_sort');
        $tableDirection = strtolower((string) $request->input('table_direction')) === 'desc' ? 'desc' : 'asc';
        $hasTableSort = ! empty($tableSort) && in_array($tableSort, $allowedSorts, true);

        $toolbarSort = $request->input('sort');
        $toolbarDirection = strtolower((string) $request->input('direction')) === 'asc' ? 'asc' : 'desc';
        $hasToolbarSort = ! empty($toolbarSort) && in_array($toolbarSort, $allowedSorts, true);

        $likeOperator = DB::getDriverName() === 'pgsql' ? 'ilike' : 'like';

        $query = Customer::query()
            ->withCount([
                'transactions as transactions_count' => fn ($q) => $q->where('status', '!=', TransactionStatus::Voided->value),
            ])
            ->when($request->search, function ($query, $search) use ($likeOperator): void {
                $term = trim((string) $search);
                $normalizedPhone = CustomerService::normalizePhone($term);

                $query->where(function ($q) use ($term, $normalizedPhone, $likeOperator): void {
                    $q->where('name', $likeOperator, "%{$term}%")
                        ->orWhere('member_code', $likeOperator, "%{$term}%")
                        ->orWhere('phone', $likeOperator, "%{$term}%")
                        ->orWhere('email', $likeOperator, "%{$term}%");

                    if ($normalizedPhone !== null && $normalizedPhone !== $term) {
                        $q->orWhere('phone', $likeOperator, "%{$normalizedPhone}%");
                    }
                });
            })
            ->when($request->status && $request->status !== 'all', function ($query) use ($request): void {
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

        $customers = $query->paginate($perPage)
            ->withQueryString()
            ->through(fn (Customer $c): array => [
                'id' => $c->id,
                'member_code' => $c->member_code,
                'name' => $c->name,
                'phone' => $c->phone,
                'email' => $c->email,
                'address' => $c->address,
                'points' => (int) $c->points,
                'is_active' => (bool) $c->is_active,
                'notes' => $c->notes,
                'transactions_count' => (int) ($c->transactions_count ?? 0),
                'created_at' => $c->created_at?->format('d M Y H:i'),
            ]);

        return Inertia::render('POS/Customers/Customer', [
            'customers' => $customers,
            'filters' => $filters,
            'summary' => $this->customerService->getSummary(),
        ]);
    }

    public function show(Request $request, Customer $customer): Response
    {
        Gate::authorize('view', $customer);

        $stats = $this->customerService->getDetailStats($customer);

        return Inertia::render('POS/Customers/DetailCustomer', [
            'customer' => [
                'id' => $customer->id,
                'member_code' => $customer->member_code,
                'name' => $customer->name,
                'phone' => $customer->phone,
                'email' => $customer->email,
                'address' => $customer->address,
                'points' => (int) $customer->points,
                'is_active' => (bool) $customer->is_active,
                'notes' => $customer->notes,
                'transactions_count' => $stats['total_transactions'],
                'created_at' => $customer->created_at?->format('d M Y H:i'),
                'updated_at' => $customer->updated_at?->format('d M Y H:i'),
            ],
            'stats' => $stats,
            'transactions' => Inertia::optional(function () use ($request, $customer): array {
                $perPage = $request->integer('per_page', 10);

                $paginated = Transaction::query()
                    ->where('customer_id', $customer->id)
                    ->with(['user:id,name', 'payments:id,transaction_id,payment_method'])
                    ->withCount('details')
                    ->latest('id')
                    ->paginate($perPage)
                    ->withQueryString();

                return [
                    'data' => collect($paginated->items())->map(fn (Transaction $tx): array => [
                        'id' => $tx->id,
                        'invoice_number' => $tx->invoice_number,
                        'created_at' => $tx->created_at?->format('d M Y H:i') ?? '-',
                        'cashier_name' => $tx->user?->name ?? '-',
                        'items_count' => (int) ($tx->details_count ?? 0),
                        'grand_total' => (float) $tx->grand_total,
                        'payment_methods' => $tx->payments
                            ->map(fn ($p) => $p->payment_method->label())
                            ->unique()
                            ->values()
                            ->all(),
                        'status' => $tx->status->value,
                        'status_label' => $tx->status->label(),
                    ])->all(),
                    'current_page' => $paginated->currentPage(),
                    'last_page' => $paginated->lastPage(),
                    'per_page' => $paginated->perPage(),
                    'total' => $paginated->total(),
                    'from' => $paginated->firstItem(),
                    'to' => $paginated->lastItem(),
                ];
            }),
            'activities' => Inertia::optional(function () use ($request, $customer): array {
                $perPage = $request->integer('per_page', 10);

                $paginated = Activity::forSubject($customer)
                    ->with('causer')
                    ->latest('id')
                    ->paginate($perPage)
                    ->withQueryString();

                return [
                    'data' => collect($paginated->items())->map(fn (Activity $act): array => [
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
        Gate::authorize('viewAny', Customer::class);

        $query = (string) $request->input('q', $request->input('search', ''));
        $limit = $request->integer('limit', 15);

        $customers = $this->customerService->searchForPos($query, $limit)
            ->map(fn (Customer $c): array => [
                'id' => $c->id,
                'member_code' => $c->member_code,
                'name' => $c->name,
                'phone' => $c->phone,
                'points' => (int) $c->points,
            ])
            ->values();

        return response()->json([
            'customers' => $customers,
        ]);
    }

    public function store(StoreCustomerRequest $request): JsonResponse|RedirectResponse
    {
        /** @var User $actor */
        $actor = $request->user();
        $customer = $this->customerService->create($request->validated(), $actor);

        if ($request->expectsJson() && ! $request->hasHeader('X-Inertia')) {
            return response()->json([
                'message' => "Pelanggan {$customer->name} ({$customer->member_code}) berhasil ditambahkan.",
                'customer' => [
                    'id' => $customer->id,
                    'member_code' => $customer->member_code,
                    'name' => $customer->name,
                    'phone' => $customer->phone,
                    'points' => (int) $customer->points,
                ],
            ], 201);
        }

        return back()->with('success', "Pelanggan {$customer->name} ({$customer->member_code}) berhasil ditambahkan.");
    }

    public function update(UpdateCustomerRequest $request, Customer $customer): RedirectResponse
    {
        /** @var User $actor */
        $actor = $request->user();
        $updated = $this->customerService->update($customer, $request->validated(), $actor);

        return back()->with('success', "Pelanggan {$updated->name} berhasil diperbarui.");
    }

    public function destroy(Request $request, Customer $customer): RedirectResponse
    {
        Gate::authorize('delete', $customer);

        /** @var User $actor */
        $actor = $request->user();
        $name = $customer->name;

        $this->customerService->delete($customer, $actor);

        return redirect()->route('pos.customers.index')
            ->with('success', "Pelanggan {$name} berhasil dihapus.");
    }
}

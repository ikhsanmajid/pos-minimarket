<?php

namespace App\Http\Controllers;

use App\Enums\UserRoles;
use App\Http\Requests\StoreUserRequest;
use App\Http\Requests\UpdateUserRequest;
use App\Models\User;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;
use Inertia\Response;
use Spatie\Activitylog\Models\Activity;

class UserController extends Controller
{
    public function index(Request $request): Response
    {
        Gate::authorize('viewAny', User::class);

        $filters = $request->only([
            'search',
            'role',
            'is_active',
            'sort',
            'direction',
            'table_sort',
            'table_direction',
        ]);

        $perPage = $request->integer('per_page', 10);

        // Sorting definitions
        $allowedTableSorts = ['name', 'phone', 'role', 'is_active', 'last_login_at', 'created_at'];
        $allowedToolbarSorts = ['name', 'phone', 'role', 'is_active', 'last_login_at', 'created_at'];

        $tableSort = $request->input('table_sort');
        $tableDirection = strtolower((string) $request->input('table_direction')) === 'desc' ? 'desc' : 'asc';
        $hasTableSort = ! empty($tableSort) && in_array($tableSort, $allowedTableSorts, true);

        $toolbarSort = $request->input('sort');
        $toolbarDirection = strtolower((string) $request->input('direction')) === 'asc' ? 'asc' : 'desc';
        $hasToolbarSort = ! empty($toolbarSort) && in_array($toolbarSort, $allowedToolbarSorts, true);

        $query = User::query()
            ->when($request->search, function ($query, $search) {
                $query->where(function ($q) use ($search) {
                    $q->where('name', 'ilike', "%{$search}%")
                        ->orWhere('email', 'ilike', "%{$search}%")
                        ->orWhere('phone', 'ilike', "%{$search}%");
                });
            })
            ->when($request->filled('role') && $request->role !== 'all', function ($query) use ($request) {
                $query->where('role', $request->role);
            })
            ->when($request->has('is_active') && $request->is_active !== 'all' && $request->is_active !== null, function ($query) use ($request) {
                $isActive = filter_var($request->is_active, FILTER_VALIDATE_BOOLEAN);
                $query->where('is_active', $isActive);
            });

        // Multi-column sorting:
        // 1. Table header sort is the primary sort (if active)
        if ($hasTableSort) {
            $query->orderBy($tableSort, $tableDirection);
        }

        // 2. Toolbar select sort is the secondary sort (or primary if table sort is not active)
        if ($hasToolbarSort && (! $hasTableSort || $toolbarSort !== $tableSort)) {
            $query->orderBy($toolbarSort, $toolbarDirection);
        }

        // Fallback default sorting if neither is active, or tie-breaker for deterministic pagination
        if (! $hasTableSort && ! $hasToolbarSort) {
            $query->orderBy('created_at', 'desc');
        } elseif (($hasTableSort && $tableSort !== 'created_at') && (! $hasToolbarSort || $toolbarSort !== 'created_at')) {
            $query->orderBy('id', 'desc');
        }

        $users = $query->paginate($perPage)
            ->withQueryString()
            ->through(fn (User $user) => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'phone' => $user->phone,
                'role' => $user->role?->value,
                'role_name' => $user->role_name,
                'is_active' => (bool) $user->is_active,
                'has_pin' => ! empty($user->pin),
                'last_login_at' => $user->last_login_at?->format('d M Y H:i'),
                'created_at' => $user->created_at?->format('d M Y'),
            ]);

        return Inertia::render('POS/Users/Users', [
            'users' => $users,
            'filters' => $filters,
            'roles' => collect(UserRoles::cases())->map(fn (UserRoles $r) => [
                'value' => $r->value,
                'label' => $r->label(),
            ]),
        ]);
    }

    public function store(StoreUserRequest $request): RedirectResponse
    {
        Gate::authorize('create', User::class);

        $data = $request->safe()->except(['password_confirmation', 'pin']);
        $role = $request->input('role');
        $isPrivileged = in_array($role, [UserRoles::Admin->value, UserRoles::Supervisor->value], true);

        if ($isPrivileged && $request->filled('pin')) {
            $data['pin'] = $request->input('pin');
        } else {
            $data['pin'] = null;
        }

        User::create($data);

        return redirect()->route('pos.users.index')
            ->with('success', 'Pengguna berhasil ditambahkan.');
    }

    public function show(Request $request, User $user): Response
    {
        Gate::authorize('view', $user);

        return Inertia::render('POS/Users/DetailUser', [
            'user' => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'phone' => $user->phone,
                'role' => $user->role?->value,
                'role_name' => $user->role_name,
                'is_active' => (bool) $user->is_active,
                'has_pin' => ! empty($user->pin),
                'last_login_at' => $user->last_login_at?->format('d M Y H:i'),
                'created_at' => $user->created_at?->format('d M Y H:i'),
                'updated_at' => $user->updated_at?->format('d M Y H:i'),
            ],
            'roles' => collect(UserRoles::cases())->map(fn (UserRoles $r) => [
                'value' => $r->value,
                'label' => $r->label(),
            ])->values(),
            'activities' => Inertia::optional(function () use ($request, $user) {
                $perPage = $request->integer('per_page', 10);

                $paginated = Activity::forSubject($user)
                    ->where('log_name', '!=', 'auth')
                    ->whereNotIn('event', ['login', 'logout'])
                    ->whereNotIn('description', ['User berhasil login', 'User logout'])
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

    public function edit(User $user): Response
    {
        Gate::authorize('update', $user);

        return Inertia::render('POS/Users/EditUser', [
            'user' => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'phone' => $user->phone,
                'role' => $user->role?->value,
                'is_active' => (bool) $user->is_active,
                'has_pin' => ! empty($user->pin),
            ],
            'roles' => collect(UserRoles::cases())->map(fn (UserRoles $r) => [
                'value' => $r->value,
                'label' => $r->label(),
            ]),
        ]);
    }

    public function update(UpdateUserRequest $request, User $user): RedirectResponse
    {
        Gate::authorize('update', $user);

        $data = $request->safe()->except(['password', 'password_confirmation', 'pin']);

        if ($request->filled('password')) {
            $data['password'] = $request->validated('password');
        }

        $role = $request->input('role');
        $isPrivileged = in_array($role, [UserRoles::Admin->value, UserRoles::Supervisor->value], true);

        if (! $isPrivileged) {
            $data['pin'] = null;
        } elseif ($request->filled('pin')) {
            $data['pin'] = $request->input('pin');
        }

        $user->update($data);

        return redirect()->route('pos.users.index')
            ->with('success', 'Data pengguna berhasil diperbarui.');
    }

    public function destroy(User $user): RedirectResponse
    {
        Gate::authorize('delete', $user);

        $user->delete();

        return redirect()->route('pos.users.index')
            ->with('success', 'Pengguna berhasil dihapus.');
    }
}

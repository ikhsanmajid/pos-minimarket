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

class UserController extends Controller
{
    public function index(Request $request): Response
    {
        Gate::authorize('viewAny', User::class);

        $filters = $request->only(['search', 'role']);

        $perPage = $request->integer('per_page', 10);

        $users = User::query()
            ->when($request->search, function ($query, $search) {
                $query->where(function ($q) use ($search) {
                    $q->where('name', 'ilike', "%{$search}%")
                        ->orWhere('email', 'ilike', "%{$search}%");
                });
            })
            ->when($request->role, fn ($query, $role) => $query->where('role', $role))
            ->latest()
            ->paginate($perPage)
            ->withQueryString()
            ->through(fn (User $user) => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'role' => $user->role?->value,
                'role_name' => $user->role_name,
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
        User::create($request->validated());

        return redirect()->route('pos.users.index')
            ->with('success', 'Pengguna berhasil ditambahkan.');
    }

    public function show(User $user): Response
    {
        Gate::authorize('view', $user);

        return Inertia::render('POS/Users/DetailUser', [
            'user' => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'role' => $user->role?->value,
                'role_name' => $user->role_name,
                'created_at' => $user->created_at?->format('d M Y H:i'),
                'updated_at' => $user->updated_at?->format('d M Y H:i'),
            ],
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
                'role' => $user->role?->value,
            ],
            'roles' => collect(UserRoles::cases())->map(fn (UserRoles $r) => [
                'value' => $r->value,
                'label' => $r->label(),
            ]),
        ]);
    }

    public function update(UpdateUserRequest $request, User $user): RedirectResponse
    {
        $data = $request->safe()->except(['password', 'password_confirmation']);

        if ($request->filled('password')) {
            $data['password'] = $request->validated('password');
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

<?php

namespace App\Http\Controllers;

use App\Enums\UserRoles;
use App\Http\Requests\UpdateProfileRequest;
use App\Models\User;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class ProfileController extends Controller
{
    public function edit(Request $request): Response
    {
        /** @var User $user */
        $user = $request->user();

        return Inertia::render('POS/Profile/Profile', [
            'user' => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'phone' => $user->phone,
                'role' => $user->role?->value,
                'role_name' => $user->role_name,
                'has_pin' => ! empty($user->pin),
                'created_at' => $user->created_at?->format('d M Y'),
                'last_login_at' => $user->last_login_at?->format('d M Y H:i'),
            ],
            'isPrivileged' => in_array($user->role?->value, [UserRoles::Admin->value, UserRoles::Supervisor->value], true),
        ]);
    }

    public function update(UpdateProfileRequest $request): RedirectResponse
    {
        /** @var User $user */
        $user = $request->user();

        $data = $request->safe()->only(['name', 'phone']);

        if ($request->filled('password')) {
            $data['password'] = $request->validated('password');
        }

        $isPrivileged = in_array($user->role?->value, [UserRoles::Admin->value, UserRoles::Supervisor->value], true);
        if ($isPrivileged && $request->filled('pin')) {
            $data['pin'] = $request->input('pin');
        }

        $user->update($data);

        return back()->with('success', 'Profil berhasil diperbarui.');
    }
}

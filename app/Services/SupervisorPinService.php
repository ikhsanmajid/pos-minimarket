<?php

namespace App\Services;

use App\Enums\UserRoles;
use App\Models\User;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

class SupervisorPinService
{
    /**
     * Memverifikasi PIN milik Admin atau Supervisor aktif dan mengembalikan model User approver.
     */
    public function verify(?string $pin, ?string $missingMessage = null): User
    {
        $normalizedPin = trim((string) $pin);

        if ($normalizedPin === '') {
            throw ValidationException::withMessages([
                'supervisor_pin' => $missingMessage ?? 'PIN otorisasi Admin / Supervisor wajib diisi untuk tindakan ini.',
            ]);
        }

        $supervisors = User::query()
            ->whereIn('role', [UserRoles::Admin->value, UserRoles::Supervisor->value])
            ->where('is_active', true)
            ->whereNotNull('pin')
            ->get(['id', 'name', 'role', 'pin']);

        foreach ($supervisors as $supervisor) {
            if (! empty($supervisor->pin) && Hash::check($normalizedPin, $supervisor->pin)) {
                return $supervisor;
            }
        }

        throw ValidationException::withMessages([
            'supervisor_pin' => 'PIN Supervisor / Admin tidak valid atau belum diatur.',
        ]);
    }
}

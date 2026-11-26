<?php

namespace App\Policies;

use App\Enums\UserRoles;
use App\Models\CashierShift;
use App\Models\User;

class CashierShiftPolicy
{
    public function viewAny(User $user): bool
    {
        return $user->hasRoles([UserRoles::Admin, UserRoles::Supervisor, UserRoles::Cashier]);
    }

    public function viewAllHistory(User $user): bool
    {
        return $user->hasRoles([UserRoles::Admin, UserRoles::Supervisor]);
    }

    public function view(User $user, CashierShift $cashierShift): bool
    {
        if ($user->hasRoles([UserRoles::Admin, UserRoles::Supervisor])) {
            return true;
        }

        return $user->hasRoles(UserRoles::Cashier) && $cashierShift->user_id === $user->id;
    }

    public function open(User $user): bool
    {
        return $user->hasRoles([UserRoles::Admin, UserRoles::Supervisor, UserRoles::Cashier]);
    }

    public function manageMovement(User $user, CashierShift $cashierShift): bool
    {
        if (! $cashierShift->isOpen()) {
            return false;
        }

        if ($user->hasRoles([UserRoles::Admin, UserRoles::Supervisor])) {
            return true;
        }

        return $user->hasRoles(UserRoles::Cashier) && $cashierShift->user_id === $user->id;
    }

    public function close(User $user, CashierShift $cashierShift): bool
    {
        if (! $cashierShift->isOpen()) {
            return false;
        }

        if ($user->hasRoles([UserRoles::Admin, UserRoles::Supervisor])) {
            return true;
        }

        return $user->hasRoles(UserRoles::Cashier) && $cashierShift->user_id === $user->id;
    }
}

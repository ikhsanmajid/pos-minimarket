<?php

namespace App\Policies;

use App\Enums\UserRoles;
use App\Models\CashRegister;
use App\Models\User;

class CashRegisterPolicy
{
    public function viewAny(User $user): bool
    {
        return $user->hasRoles([UserRoles::Admin, UserRoles::Supervisor]);
    }

    public function view(User $user, CashRegister $cashRegister): bool
    {
        return $user->hasRoles([UserRoles::Admin, UserRoles::Supervisor]);
    }

    public function create(User $user): bool
    {
        return $user->hasRoles([UserRoles::Admin, UserRoles::Supervisor]);
    }

    public function update(User $user, CashRegister $cashRegister): bool
    {
        return $user->hasRoles([UserRoles::Admin, UserRoles::Supervisor]);
    }

    public function delete(User $user, CashRegister $cashRegister): bool
    {
        return $user->hasRoles([UserRoles::Admin]);
    }

    public function restore(User $user, CashRegister $cashRegister): bool
    {
        return $user->hasRoles([UserRoles::Admin]);
    }

    public function forceDelete(User $user, CashRegister $cashRegister): bool
    {
        return $user->hasRoles([UserRoles::Admin]);
    }
}

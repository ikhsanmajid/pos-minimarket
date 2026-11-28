<?php

namespace App\Policies;

use App\Enums\UserRoles;
use App\Models\SalesReturn;
use App\Models\User;

class SalesReturnPolicy
{
    public function viewAny(User $user): bool
    {
        return $user->hasRoles([UserRoles::Admin, UserRoles::Supervisor, UserRoles::Cashier]);
    }

    public function view(User $user, SalesReturn $salesReturn): bool
    {
        if ($user->hasRoles([UserRoles::Admin, UserRoles::Supervisor])) {
            return true;
        }

        return $user->hasRoles(UserRoles::Cashier) && $salesReturn->processed_by === $user->id;
    }

    public function create(User $user): bool
    {
        return $user->hasRoles([UserRoles::Admin, UserRoles::Supervisor, UserRoles::Cashier]);
    }
}

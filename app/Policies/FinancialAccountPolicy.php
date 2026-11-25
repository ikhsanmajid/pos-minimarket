<?php

namespace App\Policies;

use App\Enums\UserRoles;
use App\Models\FinancialAccount;
use App\Models\User;

class FinancialAccountPolicy
{
    public function viewAny(User $user): bool
    {
        return $user->hasRoles([UserRoles::Admin, UserRoles::Supervisor]);
    }

    public function view(User $user, FinancialAccount $financialAccount): bool
    {
        return $user->hasRoles([UserRoles::Admin, UserRoles::Supervisor]);
    }

    public function create(User $user): bool
    {
        return $user->hasRoles(UserRoles::Admin);
    }

    public function update(User $user, FinancialAccount $financialAccount): bool
    {
        return $user->hasRoles(UserRoles::Admin);
    }

    public function delete(User $user, FinancialAccount $financialAccount): bool
    {
        return $user->hasRoles(UserRoles::Admin);
    }
}

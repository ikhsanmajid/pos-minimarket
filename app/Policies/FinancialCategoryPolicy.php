<?php

namespace App\Policies;

use App\Enums\UserRoles;
use App\Models\FinancialCategory;
use App\Models\User;

class FinancialCategoryPolicy
{
    public function viewAny(User $user): bool
    {
        return $user->hasRoles(UserRoles::Admin);
    }

    public function view(User $user, FinancialCategory $financialCategory): bool
    {
        return $user->hasRoles(UserRoles::Admin);
    }

    public function create(User $user): bool
    {
        return $user->hasRoles(UserRoles::Admin);
    }

    public function update(User $user, FinancialCategory $financialCategory): bool
    {
        return $user->hasRoles(UserRoles::Admin);
    }

    public function delete(User $user, FinancialCategory $financialCategory): bool
    {
        return $user->hasRoles(UserRoles::Admin);
    }
}

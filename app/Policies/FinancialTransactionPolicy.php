<?php

namespace App\Policies;

use App\Enums\UserRoles;
use App\Models\FinancialTransaction;
use App\Models\User;

class FinancialTransactionPolicy
{
    public function viewAny(User $user): bool
    {
        return $user->hasRoles(UserRoles::Admin);
    }

    public function view(User $user, FinancialTransaction $financialTransaction): bool
    {
        return $user->hasRoles(UserRoles::Admin);
    }

    public function create(User $user): bool
    {
        return $user->hasRoles(UserRoles::Admin);
    }
}

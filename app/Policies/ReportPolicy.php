<?php

namespace App\Policies;

use App\Enums\UserRoles;
use App\Models\User;

class ReportPolicy
{
    public function viewSales(User $user): bool
    {
        return $user->hasRoles([UserRoles::Admin, UserRoles::Supervisor]);
    }

    public function viewProfitLoss(User $user): bool
    {
        return $user->hasRoles(UserRoles::Admin);
    }

    public function viewStock(User $user): bool
    {
        return $user->hasRoles([UserRoles::Admin, UserRoles::Supervisor, UserRoles::Warehouse]);
    }

    public function viewFinance(User $user): bool
    {
        return $user->hasRoles(UserRoles::Admin);
    }
}

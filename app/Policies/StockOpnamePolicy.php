<?php

namespace App\Policies;

use App\Enums\UserRoles;
use App\Models\StockOpname;
use App\Models\User;

class StockOpnamePolicy
{
    public function viewAny(User $user): bool
    {
        return $user->hasRoles([
            UserRoles::Admin,
            UserRoles::Supervisor,
            UserRoles::Warehouse,
            UserRoles::Cashier,
        ]);
    }

    public function view(User $user, StockOpname $stockOpname): bool
    {
        return $user->hasRoles([
            UserRoles::Admin,
            UserRoles::Supervisor,
            UserRoles::Warehouse,
            UserRoles::Cashier,
        ]);
    }

    public function create(User $user): bool
    {
        return $user->hasRoles([
            UserRoles::Admin,
            UserRoles::Supervisor,
            UserRoles::Warehouse,
            UserRoles::Cashier,
        ]);
    }

    public function updateCounts(User $user, StockOpname $stockOpname): bool
    {
        return $user->hasRoles([
            UserRoles::Admin,
            UserRoles::Supervisor,
            UserRoles::Warehouse,
            UserRoles::Cashier,
        ]);
    }

    public function reviewSystemStock(User $user, StockOpname $stockOpname): bool
    {
        return $user->hasRoles([UserRoles::Admin, UserRoles::Supervisor]);
    }

    public function finalize(User $user, StockOpname $stockOpname): bool
    {
        return $user->hasRoles([UserRoles::Admin, UserRoles::Supervisor]);
    }

    public function cancel(User $user, StockOpname $stockOpname): bool
    {
        return $user->hasRoles([UserRoles::Admin, UserRoles::Supervisor]);
    }
}

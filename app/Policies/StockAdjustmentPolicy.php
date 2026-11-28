<?php

namespace App\Policies;

use App\Enums\StockAdjustmentStatus;
use App\Enums\UserRoles;
use App\Models\StockAdjustment;
use App\Models\User;

class StockAdjustmentPolicy
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

    public function view(User $user, StockAdjustment $stockAdjustment): bool
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

    public function approve(User $user, StockAdjustment $stockAdjustment): bool
    {
        if ($stockAdjustment->status !== StockAdjustmentStatus::Pending) {
            return false;
        }

        return $user->hasRoles([UserRoles::Admin, UserRoles::Supervisor]);
    }

    public function reject(User $user, StockAdjustment $stockAdjustment): bool
    {
        if ($stockAdjustment->status !== StockAdjustmentStatus::Pending) {
            return false;
        }

        return $user->hasRoles([UserRoles::Admin, UserRoles::Supervisor]);
    }
}

<?php

namespace App\Policies;

use App\Enums\UserRoles;
use App\Models\Product;
use App\Models\User;

class ProductPolicy
{
    /**
     * Determine whether the user can view any models.
     */
    public function viewAny(User $user): bool
    {
        return $user->hasRoles([UserRoles::Admin, UserRoles::Cashier, UserRoles::Warehouse, UserRoles::Supervisor]);
    }

    /**
     * Determine whether the user can view the model.
     */
    public function view(User $user): bool
    {
        return $user->hasRoles([UserRoles::Admin, UserRoles::Cashier, UserRoles::Warehouse, UserRoles::Supervisor]);
    }

    /**
     * Determine whether the user can view stock quantities and stock movements.
     */
    public function viewStock(User $user): bool
    {
        return $user->hasRoles([UserRoles::Admin, UserRoles::Supervisor, UserRoles::Warehouse]);
    }

    /**
     * Determine whether the user can create models.
     */
    public function create(User $user): bool
    {
        return $user->hasRoles([UserRoles::Admin, UserRoles::Warehouse]);
    }

    public function insertProduk(User $user): bool
    {
        return $user->hasRoles([UserRoles::Admin, UserRoles::Warehouse]);
    }

    /**
     * Determine whether the user can update the model.
     */
    public function update(User $user, Product $product): bool
    {
        return $user->hasRoles([UserRoles::Admin, UserRoles::Warehouse]);
    }

    /**
     * Determine whether the user can delete the model.
     */
    public function delete(User $user, Product $product): bool
    {
        return $user->hasRoles([UserRoles::Admin]);
    }

    /**
     * Determine whether the user can restore the model.
     */
    public function restore(User $user, Product $product): bool
    {
        return false;
    }

    /**
     * Determine whether the user can permanently delete the model.
     */
    public function forceDelete(User $user, Product $product): bool
    {
        return false;
    }
}

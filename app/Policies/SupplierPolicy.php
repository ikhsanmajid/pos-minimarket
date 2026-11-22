<?php

namespace App\Policies;

use App\Enums\UserRoles;
use App\Models\Supplier;
use App\Models\User;

class SupplierPolicy
{
    public function viewAny(User $user): bool
    {
        return $user->hasRoles([UserRoles::Admin, UserRoles::Supervisor, UserRoles::Warehouse]);
    }

    public function view(User $user, Supplier $supplier): bool
    {
        return $user->hasRoles([UserRoles::Admin, UserRoles::Supervisor, UserRoles::Warehouse]);
    }

    public function create(User $user): bool
    {
        return $user->hasRoles([UserRoles::Admin, UserRoles::Supervisor, UserRoles::Warehouse]);
    }

    public function update(User $user, Supplier $supplier): bool
    {
        return $user->hasRoles([UserRoles::Admin, UserRoles::Supervisor, UserRoles::Warehouse]);
    }

    public function delete(User $user, Supplier $supplier): bool
    {
        return $user->hasRoles([UserRoles::Admin, UserRoles::Supervisor]);
    }
}

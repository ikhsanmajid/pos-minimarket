<?php

namespace App\Policies;

use App\Enums\UserRoles;
use App\Models\Customer;
use App\Models\User;

class CustomerPolicy
{
    public function viewAny(User $user): bool
    {
        return $user->hasRoles([UserRoles::Admin, UserRoles::Supervisor, UserRoles::Cashier]);
    }

    public function view(User $user, Customer $customer): bool
    {
        return $user->hasRoles([UserRoles::Admin, UserRoles::Supervisor, UserRoles::Cashier]);
    }

    public function create(User $user): bool
    {
        return $user->hasRoles([UserRoles::Admin, UserRoles::Supervisor, UserRoles::Cashier]);
    }

    public function update(User $user, Customer $customer): bool
    {
        return $user->hasRoles([UserRoles::Admin, UserRoles::Supervisor, UserRoles::Cashier]);
    }

    public function delete(User $user, Customer $customer): bool
    {
        return $user->hasRoles([UserRoles::Admin, UserRoles::Supervisor]);
    }
}

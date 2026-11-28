<?php

namespace App\Policies;

use App\Enums\UserRoles;
use App\Models\Promotion;
use App\Models\User;

class PromotionPolicy
{
    public function viewAny(User $user): bool
    {
        return $user->hasRoles([UserRoles::Admin, UserRoles::Supervisor]);
    }

    public function view(User $user, Promotion $promotion): bool
    {
        return $user->hasRoles([UserRoles::Admin, UserRoles::Supervisor]);
    }

    public function create(User $user): bool
    {
        return $user->hasRoles([UserRoles::Admin, UserRoles::Supervisor]);
    }

    public function update(User $user, Promotion $promotion): bool
    {
        return $user->hasRoles([UserRoles::Admin, UserRoles::Supervisor]);
    }

    public function delete(User $user, Promotion $promotion): bool
    {
        return $user->hasRoles([UserRoles::Admin, UserRoles::Supervisor]);
    }
}

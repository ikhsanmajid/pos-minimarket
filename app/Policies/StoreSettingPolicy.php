<?php

namespace App\Policies;

use App\Enums\UserRoles;
use App\Models\StoreSetting;
use App\Models\User;

class StoreSettingPolicy
{
    public function viewAny(User $user): bool
    {
        return $user->hasRoles(UserRoles::Admin);
    }

    public function view(User $user, StoreSetting $storeSetting): bool
    {
        return $user->hasRoles(UserRoles::Admin);
    }

    public function update(User $user, StoreSetting $storeSetting): bool
    {
        return $user->hasRoles(UserRoles::Admin);
    }
}

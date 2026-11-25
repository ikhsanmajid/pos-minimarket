<?php

namespace App\Policies;

use App\Enums\PaymentStatus;
use App\Enums\UserRoles;
use App\Models\AccountPayable;
use App\Models\User;

class AccountPayablePolicy
{
    public function viewAny(User $user): bool
    {
        return $user->hasRoles([UserRoles::Admin, UserRoles::Supervisor]);
    }

    public function view(User $user, AccountPayable $accountPayable): bool
    {
        return $user->hasRoles([UserRoles::Admin, UserRoles::Supervisor]);
    }

    public function recordPayment(User $user, AccountPayable $accountPayable): bool
    {
        if ($accountPayable->status === PaymentStatus::Paid) {
            return false;
        }

        if ($accountPayable->purchaseOrder?->isLocked()) {
            return false;
        }

        return $user->hasRoles([UserRoles::Admin, UserRoles::Supervisor]);
    }
}

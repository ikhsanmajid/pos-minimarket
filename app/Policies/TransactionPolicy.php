<?php

namespace App\Policies;

use App\Enums\TransactionStatus;
use App\Enums\UserRoles;
use App\Models\Transaction;
use App\Models\User;

class TransactionPolicy
{
    public function viewAny(User $user): bool
    {
        return $user->hasRoles([UserRoles::Admin, UserRoles::Supervisor, UserRoles::Cashier]);
    }

    public function viewAll(User $user): bool
    {
        return $user->hasRoles([UserRoles::Admin, UserRoles::Supervisor]);
    }

    public function view(User $user, Transaction $transaction): bool
    {
        if ($user->hasRoles([UserRoles::Admin, UserRoles::Supervisor])) {
            return true;
        }

        return $user->hasRoles(UserRoles::Cashier) && $transaction->user_id === $user->id;
    }

    public function create(User $user): bool
    {
        return $user->hasRoles([UserRoles::Admin, UserRoles::Supervisor, UserRoles::Cashier]);
    }

    public function void(User $user, Transaction $transaction): bool
    {
        if ($transaction->status !== TransactionStatus::Completed) {
            return false;
        }

        if ($user->hasRoles([UserRoles::Admin, UserRoles::Supervisor])) {
            return true;
        }

        return $user->hasRoles(UserRoles::Cashier) && $transaction->user_id === $user->id;
    }

    public function returnItems(User $user, Transaction $transaction): bool
    {
        if (! in_array($transaction->status, [TransactionStatus::Completed, TransactionStatus::PartiallyRefunded], true)) {
            return false;
        }

        if ($user->hasRoles([UserRoles::Admin, UserRoles::Supervisor])) {
            return true;
        }

        return $user->hasRoles(UserRoles::Cashier) && $transaction->user_id === $user->id;
    }
}

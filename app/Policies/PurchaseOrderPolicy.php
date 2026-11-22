<?php

namespace App\Policies;

use App\Enums\PurchaseOrderStatus;
use App\Enums\UserRoles;
use App\Models\PurchaseOrder;
use App\Models\User;

class PurchaseOrderPolicy
{
    public function viewAny(User $user): bool
    {
        return $user->hasRoles([UserRoles::Admin, UserRoles::Supervisor, UserRoles::Warehouse]);
    }

    public function view(User $user, PurchaseOrder $po): bool
    {
        return $user->hasRoles([UserRoles::Admin, UserRoles::Supervisor, UserRoles::Warehouse]);
    }

    public function create(User $user): bool
    {
        return $user->hasRoles([UserRoles::Admin, UserRoles::Supervisor, UserRoles::Warehouse]);
    }

    public function update(User $user, PurchaseOrder $po): bool
    {
        if (! in_array($po->status, [PurchaseOrderStatus::Draft, PurchaseOrderStatus::Ordered], true)) {
            return false;
        }

        if ($po->items()->where('quantity_received', '>', 0)->exists()) {
            return false;
        }

        return $user->hasRoles([UserRoles::Admin, UserRoles::Supervisor, UserRoles::Warehouse]);
    }

    public function delete(User $user, PurchaseOrder $po): bool
    {
        if ($po->items()->where('quantity_received', '>', 0)->exists()) {
            return false;
        }

        return $user->hasRoles([UserRoles::Admin, UserRoles::Supervisor]);
    }

    public function receive(User $user, PurchaseOrder $po): bool
    {
        if (in_array($po->status, [PurchaseOrderStatus::Received, PurchaseOrderStatus::Cancelled], true)) {
            return false;
        }

        return $user->hasRoles([UserRoles::Admin, UserRoles::Supervisor, UserRoles::Warehouse]);
    }

    public function closeRemaining(User $user, PurchaseOrder $po): bool
    {
        if ($po->status !== PurchaseOrderStatus::PartiallyReceived) {
            return false;
        }

        return $user->hasRoles([UserRoles::Admin, UserRoles::Supervisor]);
    }

    public function cancel(User $user, PurchaseOrder $po): bool
    {
        if (in_array($po->status, [PurchaseOrderStatus::Received, PurchaseOrderStatus::Cancelled], true)) {
            return false;
        }

        if ($po->items()->where('quantity_received', '>', 0)->exists()) {
            return false;
        }

        return $user->hasRoles([UserRoles::Admin, UserRoles::Supervisor]);
    }

    public function updatePaymentStatus(User $user, PurchaseOrder $po): bool
    {
        return $user->hasRoles([UserRoles::Admin, UserRoles::Supervisor]);
    }
}

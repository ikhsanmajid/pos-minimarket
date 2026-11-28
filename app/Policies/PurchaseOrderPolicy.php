<?php

namespace App\Policies;

use App\Enums\PaymentStatus;
use App\Enums\PurchaseOrderStatus;
use App\Enums\ReceivingStatus;
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
        if ($po->isLocked()) {
            return false;
        }

        if ($po->status === PurchaseOrderStatus::Cancelled || $po->receiving_status === ReceivingStatus::Received) {
            return false;
        }

        // PO yang sudah disetujui / diterima sebagian hanya boleh disesuaikan oleh Admin atau Supervisor
        if ($po->status === PurchaseOrderStatus::Approved) {
            return $user->hasRoles([UserRoles::Admin, UserRoles::Supervisor]);
        }

        // PO menunggu persetujuan hanya boleh diubah oleh Admin atau pembuatnya
        if ($po->status === PurchaseOrderStatus::PendingApproval) {
            return $user->hasRoles(UserRoles::Admin) || $po->user_id === $user->id;
        }

        return $user->hasRoles([UserRoles::Admin, UserRoles::Supervisor, UserRoles::Warehouse]);
    }

    public function delete(User $user, PurchaseOrder $po): bool
    {
        if ($po->isLocked()) {
            return false;
        }

        if ($po->hasAnyReceipts() || $po->hasAnyPayments()) {
            return false;
        }

        return $user->hasRoles([UserRoles::Admin, UserRoles::Supervisor]);
    }

    public function submit(User $user, PurchaseOrder $po): bool
    {
        if ($po->isLocked()) {
            return false;
        }

        if (! in_array($po->status, [PurchaseOrderStatus::Draft, PurchaseOrderStatus::Rejected], true)) {
            return false;
        }

        return $user->hasRoles([UserRoles::Admin, UserRoles::Supervisor, UserRoles::Warehouse]);
    }

    public function approve(User $user, PurchaseOrder $po): bool
    {
        if ($po->isLocked()) {
            return false;
        }

        if (! in_array($po->status, [PurchaseOrderStatus::PendingApproval, PurchaseOrderStatus::Draft], true)) {
            return false;
        }

        return $user->hasRoles(UserRoles::Admin);
    }

    public function reject(User $user, PurchaseOrder $po): bool
    {
        if ($po->isLocked()) {
            return false;
        }

        if ($po->status !== PurchaseOrderStatus::PendingApproval) {
            return false;
        }

        return $user->hasRoles(UserRoles::Admin);
    }

    public function revise(User $user, PurchaseOrder $po): bool
    {
        if ($po->status !== PurchaseOrderStatus::Rejected) {
            return false;
        }

        return $user->hasRoles([UserRoles::Admin, UserRoles::Supervisor, UserRoles::Warehouse]);
    }

    public function receive(User $user, PurchaseOrder $po): bool
    {
        if ($po->isLocked()) {
            return false;
        }

        if ($po->status !== PurchaseOrderStatus::Approved || $po->receiving_status === ReceivingStatus::Received) {
            return false;
        }

        return $user->hasRoles([UserRoles::Admin, UserRoles::Supervisor, UserRoles::Warehouse]);
    }

    public function closeRemaining(User $user, PurchaseOrder $po): bool
    {
        if ($po->isLocked()) {
            return false;
        }

        if ($po->status !== PurchaseOrderStatus::Approved || $po->receiving_status !== ReceivingStatus::Partial) {
            return false;
        }

        return $user->hasRoles([UserRoles::Admin, UserRoles::Supervisor]);
    }

    public function cancel(User $user, PurchaseOrder $po): bool
    {
        if ($po->isLocked() || $po->status === PurchaseOrderStatus::Cancelled) {
            return false;
        }

        if ($po->hasAnyReceipts() || $po->hasAnyPayments()) {
            return false;
        }

        return $user->hasRoles([UserRoles::Admin, UserRoles::Supervisor]);
    }

    public function recordPayment(User $user, PurchaseOrder $po): bool
    {
        if ($po->isLocked()) {
            return false;
        }

        if ($po->status !== PurchaseOrderStatus::Approved || $po->payment_status === PaymentStatus::Paid) {
            return false;
        }

        return $user->hasRoles(UserRoles::Admin);
    }
}

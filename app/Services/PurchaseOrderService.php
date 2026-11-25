<?php

namespace App\Services;

use App\Enums\ActivityLogCategory;
use App\Enums\PaymentStatus;
use App\Enums\PurchaseOrderStatus;
use App\Enums\ReceivingStatus;
use App\Enums\UserRoles;
use App\Models\Product;
use App\Models\ProductUnit;
use App\Models\PurchaseOrder;
use App\Models\PurchaseOrderItem;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class PurchaseOrderService
{
    public function __construct(public FinanceService $financeService) {}

    /**
     * Menghitung diskon per baris item dan subtotal bersih item.
     *
     * @param  array{quantity_ordered?: int|string, free_qty_ordered?: int|string|null, unit_cost?: float|int|string, discount_type?: string|null, discount_value?: float|int|string|null}  $row
     * @return array{discount_type: string, discount_value: float, discount_amount: float, subtotal: float}
     */
    public function calculateItemAmounts(array $row): array
    {
        $qty = max(0, (int) ($row['quantity_ordered'] ?? 0));
        $unitCost = max(0, (float) ($row['unit_cost'] ?? 0));
        $gross = round($qty * $unitCost, 2);

        $discountType = ($row['discount_type'] ?? 'fixed') === 'percent' ? 'percent' : 'fixed';
        $discountValue = max(0, (float) ($row['discount_value'] ?? 0));

        if ($discountType === 'percent') {
            $discountValue = min(100, $discountValue);
            $discountAmount = round($gross * ($discountValue / 100), 2);
        } else {
            $discountAmount = round(min($gross, $discountValue), 2);
        }

        return [
            'discount_type' => $discountType,
            'discount_value' => $discountValue,
            'discount_amount' => $discountAmount,
            'subtotal' => max(0, round($gross - $discountAmount, 2)),
        ];
    }

    /**
     * Menghitung diskon global, DPP, pajak fleksibel (persen/nominal), dan grand total PO.
     * Urutan: Subtotal Item -> Diskon Global -> DPP -> Pajak (Persen dari DPP / Nominal Tetap) -> Total.
     *
     * @param  array{discount_type?: string|null, discount_value?: float|int|string|null, tax_type?: string|null, tax_value?: float|int|string|null, tax_percentage?: float|int|string|null}  $data
     * @return array{discount_type: string, discount_value: float, discount_amount: float, tax_type: string, tax_value: float, tax_percentage: float, tax_amount: float, total_amount: float}
     */
    public function calculateTotals(float $subtotal, array $data): array
    {
        $discountType = ($data['discount_type'] ?? 'fixed') === 'percent' ? 'percent' : 'fixed';
        $discountValue = max(0, (float) ($data['discount_value'] ?? 0));

        if ($discountType === 'percent') {
            $discountValue = min(100, $discountValue);
            $discountAmount = round($subtotal * ($discountValue / 100), 2);
        } else {
            $discountAmount = round(min($subtotal, $discountValue), 2);
        }

        $taxableAmount = max(0, round($subtotal - $discountAmount, 2));

        $taxType = ($data['tax_type'] ?? 'percent') === 'fixed' ? 'fixed' : 'percent';
        $rawTaxValue = $data['tax_value'] ?? $data['tax_percentage'] ?? 0;
        $taxValue = max(0, (float) $rawTaxValue);

        if ($taxType === 'percent') {
            $taxValue = min(100, $taxValue);
            $taxPercentage = $taxValue;
            $taxAmount = round($taxableAmount * ($taxValue / 100), 2);
        } else {
            $taxPercentage = 0.0;
            $taxAmount = round($taxValue, 2);
        }

        return [
            'discount_type' => $discountType,
            'discount_value' => $discountValue,
            'discount_amount' => $discountAmount,
            'tax_type' => $taxType,
            'tax_value' => $taxValue,
            'tax_percentage' => $taxPercentage,
            'tax_amount' => $taxAmount,
            'total_amount' => round($taxableAmount + $taxAmount, 2),
        ];
    }

    /**
     * Membuat PO baru beserta snapshot Multi-UOM dan menerapkan aturan approval berbasis role.
     *
     * @param  array<string, mixed>  $data
     */
    public function create(array $data, User $creator): PurchaseOrder
    {
        return DB::transaction(function () use ($data, $creator): PurchaseOrder {
            $itemsData = $data['items'] ?? [];
            if (empty($itemsData)) {
                throw ValidationException::withMessages([
                    'items' => 'Minimal satu produk harus ditambahkan dalam pesanan.',
                ]);
            }

            [$subtotal, $preparedItems] = $this->prepareItemsPayload($itemsData);
            $totals = $this->calculateTotals($subtotal, $data);

            $requestedAction = (string) ($data['action'] ?? $data['status'] ?? 'draft');
            $isAdmin = $creator->hasRoles(UserRoles::Admin);

            $status = PurchaseOrderStatus::Draft;
            $submittedAt = null;
            $approvedBy = null;
            $approvedAt = null;

            if (in_array($requestedAction, ['submit', 'pending_approval', 'approved', 'ordered'], true)) {
                if ($isAdmin) {
                    $status = PurchaseOrderStatus::Approved;
                    $approvedBy = $creator->id;
                    $approvedAt = now();
                } else {
                    $status = PurchaseOrderStatus::PendingApproval;
                    $submittedAt = now();
                }
            }

            $po = PurchaseOrder::create([
                'po_number' => ! empty($data['po_number']) ? trim((string) $data['po_number']) : null,
                'supplier_id' => (int) $data['supplier_id'],
                'user_id' => $creator->id,
                'order_date' => $data['order_date'] ?? now()->toDateString(),
                'expected_date' => $data['expected_date'] ?? null,
                'due_date' => $data['due_date'] ?? null,
                'submitted_at' => $submittedAt,
                'approved_by' => $approvedBy,
                'approved_at' => $approvedAt,
                'status' => $status,
                'receiving_status' => ReceivingStatus::Unreceived,
                'payment_status' => PaymentStatus::Unpaid,
                'subtotal' => $subtotal,
                ...$totals,
                'notes' => $data['notes'] ?? null,
            ]);

            foreach ($preparedItems as $item) {
                $po->items()->create($item);
            }

            if ($status === PurchaseOrderStatus::Approved) {
                $this->financeService->syncPayableForPurchaseOrder($po, $creator);
            }

            activity(ActivityLogCategory::PurchaseOrder->value)
                ->event('created')
                ->performedOn($po)
                ->causedBy($creator)
                ->withProperties([
                    'event' => 'created',
                    'po_number' => $po->po_number,
                    'status' => $po->status->value,
                    'receiving_status' => $po->receiving_status->value,
                    'payment_status' => $po->payment_status->value,
                    'total_amount' => $po->total_amount,
                    'items_count' => count($preparedItems),
                ])
                ->log("Purchase Order {$po->po_number} berhasil dibuat (Status: {$po->status->label()}).");

            return $po->load(['supplier', 'items.product', 'user', 'approvedBy', 'accountPayable']);
        });
    }

    /**
     * Memperbarui PO dengan proteksi penguncian permanen dan integritas penerimaan/pembayaran.
     *
     * @param  array<string, mixed>  $data
     */
    public function update(PurchaseOrder $po, array $data, User $updater): PurchaseOrder
    {
        return DB::transaction(function () use ($po, $data, $updater): PurchaseOrder {
            /** @var PurchaseOrder $lockedPo */
            $lockedPo = PurchaseOrder::where('id', $po->id)
                ->lockForUpdate()
                ->firstOrFail();

            $lockedPo->load('items');

            if ($lockedPo->isLocked()) {
                throw ValidationException::withMessages([
                    'status' => "PO {$lockedPo->po_number} sudah Lunas dan Diterima Penuh sehingga terkunci permanen dan tidak dapat diedit.",
                ]);
            }

            if ($lockedPo->status === PurchaseOrderStatus::Cancelled) {
                throw ValidationException::withMessages([
                    'status' => "PO {$lockedPo->po_number} sudah dibatalkan sehingga tidak dapat diedit.",
                ]);
            }

            if ($lockedPo->receiving_status === ReceivingStatus::Received) {
                throw ValidationException::withMessages([
                    'status' => "PO {$lockedPo->po_number} sudah diterima penuh sehingga tidak dapat diedit.",
                ]);
            }

            $itemsData = $data['items'] ?? [];
            if (empty($itemsData)) {
                throw ValidationException::withMessages([
                    'items' => 'Minimal satu produk harus ada dalam pesanan.',
                ]);
            }

            $isApprovedOrPartial = $lockedPo->status === PurchaseOrderStatus::Approved
                || $lockedPo->receiving_status === ReceivingStatus::Partial;

            // Aturan Integritas: PO yang sudah disetujui/partial tidak boleh ganti supplier
            if ($isApprovedOrPartial && (int) $data['supplier_id'] !== (int) $lockedPo->supplier_id) {
                throw ValidationException::withMessages([
                    'supplier_id' => 'Supplier tidak dapat diubah pada PO yang sudah disetujui atau memiliki penerimaan barang.',
                ]);
            }

            $existingItems = $lockedPo->items->keyBy('id');
            $submittedIds = [];
            $subtotal = 0.0;
            $preparedRows = [];

            foreach ($itemsData as $index => $row) {
                $existingItemId = isset($row['id']) && $row['id'] !== '' ? (int) $row['id'] : null;
                /** @var PurchaseOrderItem|null $existingItem */
                $existingItem = $existingItemId ? $existingItems->get($existingItemId) : null;

                $productId = (int) $row['product_id'];
                $productUnitId = isset($row['product_unit_id']) && $row['product_unit_id'] !== ''
                    ? (int) $row['product_unit_id']
                    : null;

                $qtyOrdered = (int) ($row['quantity_ordered'] ?? 0);
                $freeQtyOrdered = max(0, (int) ($row['free_qty_ordered'] ?? 0));

                if ($existingItem) {
                    $submittedIds[] = $existingItem->id;
                    $alreadyReceived = (int) $existingItem->quantity_received;
                    $alreadyFreeReceived = (int) $existingItem->free_qty_received;
                    $hasItemReceipts = $alreadyReceived > 0 || $alreadyFreeReceived > 0;

                    if ($hasItemReceipts) {
                        if ($productId !== (int) $existingItem->product_id) {
                            throw ValidationException::withMessages([
                                "items.{$index}.product_id" => 'Produk tidak dapat diganti karena item ini sudah memiliki penerimaan barang.',
                            ]);
                        }

                        if ($qtyOrdered < $alreadyReceived) {
                            throw ValidationException::withMessages([
                                "items.{$index}.quantity_ordered" => "Jumlah pesan ({$qtyOrdered}) tidak boleh lebih kecil dari jumlah yang sudah diterima ({$alreadyReceived}).",
                            ]);
                        }

                        if ($freeQtyOrdered < $alreadyFreeReceived) {
                            throw ValidationException::withMessages([
                                "items.{$index}.free_qty_ordered" => "Jumlah bonus ({$freeQtyOrdered}) tidak boleh lebih kecil dari bonus yang sudah diterima ({$alreadyFreeReceived}).",
                            ]);
                        }

                        // Pertahankan snapshot satuan item yang sudah diterima
                        $unitName = $existingItem->unit_name;
                        $conversionFactor = max(1, (int) $existingItem->conversion_factor);
                        $productUnitId = $existingItem->product_unit_id;
                    } else {
                        [$unitName, $conversionFactor, $productUnitId] = $this->resolveUnitSnapshot($productId, $productUnitId);
                    }
                } else {
                    [$unitName, $conversionFactor, $productUnitId] = $this->resolveUnitSnapshot($productId, $productUnitId);
                }

                $amounts = $this->calculateItemAmounts($row);
                $subtotal += $amounts['subtotal'];

                $preparedRows[] = [
                    'existing' => $existingItem,
                    'payload' => [
                        'product_id' => $productId,
                        'product_unit_id' => $productUnitId,
                        'unit_name' => $unitName,
                        'conversion_factor' => $conversionFactor,
                        'quantity_ordered' => $qtyOrdered,
                        'free_qty_ordered' => $freeQtyOrdered,
                        'base_qty_ordered' => ($qtyOrdered + $freeQtyOrdered) * $conversionFactor,
                        'unit_cost' => round(max(0, (float) ($row['unit_cost'] ?? 0)), 2),
                        ...$amounts,
                        'expired_date' => $row['expired_date'] ?? null,
                    ],
                ];
            }

            // Pastikan tidak ada item yang sudah diterima ikut terhapus
            foreach ($existingItems as $existingItem) {
                if (! in_array($existingItem->id, $submittedIds, true)) {
                    if ((int) $existingItem->quantity_received > 0 || (int) $existingItem->free_qty_received > 0) {
                        throw ValidationException::withMessages([
                            'items' => "Item {$existingItem->product?->name} sudah memiliki penerimaan barang sehingga tidak dapat dihapus.",
                        ]);
                    }
                }
            }

            $totals = $this->calculateTotals($subtotal, $data);

            // Tentukan transisi status jika ada action submit/draft
            $nextStatus = $lockedPo->status;
            $submittedAt = $lockedPo->submitted_at;
            $approvedBy = $lockedPo->approved_by;
            $approvedAt = $lockedPo->approved_at;
            $rejectedBy = $lockedPo->rejected_by;
            $rejectedAt = $lockedPo->rejected_at;
            $rejectionReason = $lockedPo->rejection_reason;

            $requestedAction = (string) ($data['action'] ?? '');
            $isAdmin = $updater->hasRoles(UserRoles::Admin);

            if (in_array($lockedPo->status, [PurchaseOrderStatus::Draft, PurchaseOrderStatus::Rejected], true)) {
                if ($requestedAction === 'submit') {
                    if ($isAdmin) {
                        $nextStatus = PurchaseOrderStatus::Approved;
                        $approvedBy = $updater->id;
                        $approvedAt = now();
                    } else {
                        $nextStatus = PurchaseOrderStatus::PendingApproval;
                        $submittedAt = now();
                    }
                    $rejectedBy = null;
                    $rejectedAt = null;
                    $rejectionReason = null;
                } elseif ($lockedPo->status === PurchaseOrderStatus::Rejected) {
                    $nextStatus = PurchaseOrderStatus::Draft;
                }
            }

            $lockedPo->update([
                'supplier_id' => $isApprovedOrPartial ? $lockedPo->supplier_id : (int) $data['supplier_id'],
                'order_date' => $data['order_date'] ?? $lockedPo->order_date,
                'expected_date' => $data['expected_date'] ?? $lockedPo->expected_date,
                'due_date' => $data['due_date'] ?? $lockedPo->due_date,
                'status' => $nextStatus,
                'submitted_at' => $submittedAt,
                'approved_by' => $approvedBy,
                'approved_at' => $approvedAt,
                'rejected_by' => $rejectedBy,
                'rejected_at' => $rejectedAt,
                'rejection_reason' => $rejectionReason,
                'subtotal' => $subtotal,
                ...$totals,
                'notes' => $data['notes'] ?? $lockedPo->notes,
            ]);

            // Hapus hanya item yang dihapus & belum memiliki penerimaan
            $idsToDelete = $existingItems->keys()->diff($submittedIds)->all();
            if (! empty($idsToDelete)) {
                $lockedPo->items()->whereIn('id', $idsToDelete)->delete();
            }

            foreach ($preparedRows as $entry) {
                /** @var PurchaseOrderItem|null $existing */
                $existing = $entry['existing'];
                if ($existing) {
                    $existing->update($entry['payload']);
                } else {
                    $lockedPo->items()->create([
                        ...$entry['payload'],
                        'quantity_received' => 0,
                        'free_qty_received' => 0,
                        'base_qty_received' => 0,
                    ]);
                }
            }

            // Rekalkulasi receiving_status jika PO sudah punya penerimaan sebagian
            $lockedPo->refresh()->load('items');
            if ($lockedPo->hasAnyReceipts()) {
                $allCompleted = $lockedPo->items->every(
                    fn (PurchaseOrderItem $itm): bool => (int) $itm->quantity_received >= (int) $itm->quantity_ordered
                        && (int) $itm->free_qty_received >= (int) $itm->free_qty_ordered
                );
                $lockedPo->receiving_status = $allCompleted ? ReceivingStatus::Received : ReceivingStatus::Partial;
                $lockedPo->save();
            }

            // Sinkronkan AccountPayable bila PO berstatus Approved (menolak jika total baru < paid_amount)
            if ($lockedPo->status === PurchaseOrderStatus::Approved) {
                $this->financeService->syncPayableForPurchaseOrder($lockedPo, $updater);
            }

            activity(ActivityLogCategory::PurchaseOrder->value)
                ->event('updated')
                ->performedOn($lockedPo)
                ->causedBy($updater)
                ->withProperties([
                    'event' => 'updated',
                    'po_number' => $lockedPo->po_number,
                    'status' => $lockedPo->status->value,
                    'receiving_status' => $lockedPo->receiving_status->value,
                    'total_amount' => $lockedPo->total_amount,
                ])
                ->log("Purchase Order {$lockedPo->po_number} diperbarui.");

            return $lockedPo->load(['supplier', 'items.product', 'user', 'approvedBy', 'accountPayable']);
        });
    }

    /**
     * Mengajukan PO dari Draft/Rejected ke antrean Approval Admin (atau langsung Approved jika Admin).
     */
    public function submitForApproval(PurchaseOrder $po, User $actor): PurchaseOrder
    {
        return DB::transaction(function () use ($po, $actor): PurchaseOrder {
            /** @var PurchaseOrder $lockedPo */
            $lockedPo = PurchaseOrder::where('id', $po->id)->lockForUpdate()->firstOrFail();

            if (! in_array($lockedPo->status, [PurchaseOrderStatus::Draft, PurchaseOrderStatus::Rejected], true)) {
                throw ValidationException::withMessages([
                    'status' => "PO {$lockedPo->po_number} hanya dapat diajukan dari status Draft atau Ditolak.",
                ]);
            }

            if (! $lockedPo->items()->exists()) {
                throw ValidationException::withMessages([
                    'items' => "PO {$lockedPo->po_number} belum memiliki item produk.",
                ]);
            }

            $oldStatus = $lockedPo->status->value;
            $isAdmin = $actor->hasRoles(UserRoles::Admin);

            if ($isAdmin) {
                $lockedPo->status = PurchaseOrderStatus::Approved;
                $lockedPo->approved_by = $actor->id;
                $lockedPo->approved_at = now();
            } else {
                $lockedPo->status = PurchaseOrderStatus::PendingApproval;
                $lockedPo->submitted_at = now();
            }

            $lockedPo->rejected_by = null;
            $lockedPo->rejected_at = null;
            $lockedPo->rejection_reason = null;
            $lockedPo->save();

            if ($lockedPo->status === PurchaseOrderStatus::Approved) {
                $this->financeService->syncPayableForPurchaseOrder($lockedPo, $actor);
            }

            activity(ActivityLogCategory::PurchaseOrder->value)
                ->event('updated')
                ->performedOn($lockedPo)
                ->causedBy($actor)
                ->withProperties([
                    'event' => $isAdmin ? 'approved' : 'submitted',
                    'po_number' => $lockedPo->po_number,
                    'old_status' => $oldStatus,
                    'new_status' => $lockedPo->status->value,
                ])
                ->log(
                    $isAdmin
                        ? "Purchase Order {$lockedPo->po_number} langsung disetujui (Approved) oleh Admin {$actor->name}."
                        : "Purchase Order {$lockedPo->po_number} diajukan untuk persetujuan Admin."
                );

            return $lockedPo->load(['supplier', 'items.product', 'user', 'approvedBy', 'accountPayable']);
        });
    }

    /**
     * Persetujuan PO oleh Admin (PendingApproval / Draft -> Approved).
     */
    public function approve(PurchaseOrder $po, User $admin): PurchaseOrder
    {
        if (! $admin->hasRoles(UserRoles::Admin)) {
            throw ValidationException::withMessages([
                'status' => 'Hanya Admin yang berwenang menyetujui Purchase Order.',
            ]);
        }

        return DB::transaction(function () use ($po, $admin): PurchaseOrder {
            /** @var PurchaseOrder $lockedPo */
            $lockedPo = PurchaseOrder::where('id', $po->id)->lockForUpdate()->firstOrFail();

            if (! in_array($lockedPo->status, [PurchaseOrderStatus::PendingApproval, PurchaseOrderStatus::Draft], true)) {
                throw ValidationException::withMessages([
                    'status' => "PO {$lockedPo->po_number} tidak sedang menunggu persetujuan.",
                ]);
            }

            if (! $lockedPo->items()->exists()) {
                throw ValidationException::withMessages([
                    'items' => "PO {$lockedPo->po_number} belum memiliki item produk.",
                ]);
            }

            $oldStatus = $lockedPo->status->value;
            $lockedPo->status = PurchaseOrderStatus::Approved;
            $lockedPo->approved_by = $admin->id;
            $lockedPo->approved_at = now();
            $lockedPo->rejected_by = null;
            $lockedPo->rejected_at = null;
            $lockedPo->rejection_reason = null;
            $lockedPo->save();

            $this->financeService->syncPayableForPurchaseOrder($lockedPo, $admin);

            activity(ActivityLogCategory::PurchaseOrder->value)
                ->event('updated')
                ->performedOn($lockedPo)
                ->causedBy($admin)
                ->withProperties([
                    'event' => 'approved',
                    'po_number' => $lockedPo->po_number,
                    'old_status' => $oldStatus,
                    'new_status' => $lockedPo->status->value,
                    'approved_by' => $admin->name,
                ])
                ->log("Purchase Order {$lockedPo->po_number} disetujui oleh Admin {$admin->name}.");

            return $lockedPo->load(['supplier', 'items.product', 'user', 'approvedBy', 'accountPayable']);
        });
    }

    /**
     * Penolakan PO oleh Admin (wajib disertai alasan penolakan).
     */
    public function reject(PurchaseOrder $po, User $admin, string $reason): PurchaseOrder
    {
        if (! $admin->hasRoles(UserRoles::Admin)) {
            throw ValidationException::withMessages([
                'status' => 'Hanya Admin yang berwenang menolak Purchase Order.',
            ]);
        }

        $trimmedReason = trim($reason);
        if ($trimmedReason === '') {
            throw ValidationException::withMessages([
                'rejection_reason' => 'Alasan penolakan wajib diisi.',
            ]);
        }

        return DB::transaction(function () use ($po, $admin, $trimmedReason): PurchaseOrder {
            /** @var PurchaseOrder $lockedPo */
            $lockedPo = PurchaseOrder::where('id', $po->id)->lockForUpdate()->firstOrFail();

            if ($lockedPo->status !== PurchaseOrderStatus::PendingApproval) {
                throw ValidationException::withMessages([
                    'status' => 'Hanya PO berstatus Menunggu Persetujuan yang dapat ditolak.',
                ]);
            }

            $oldStatus = $lockedPo->status->value;
            $lockedPo->status = PurchaseOrderStatus::Rejected;
            $lockedPo->rejected_by = $admin->id;
            $lockedPo->rejected_at = now();
            $lockedPo->rejection_reason = $trimmedReason;
            $lockedPo->save();

            activity(ActivityLogCategory::PurchaseOrder->value)
                ->event('updated')
                ->performedOn($lockedPo)
                ->causedBy($admin)
                ->withProperties([
                    'event' => 'rejected',
                    'po_number' => $lockedPo->po_number,
                    'old_status' => $oldStatus,
                    'new_status' => $lockedPo->status->value,
                    'rejected_by' => $admin->name,
                    'rejection_reason' => $trimmedReason,
                ])
                ->log("Purchase Order {$lockedPo->po_number} ditolak oleh Admin {$admin->name}: {$trimmedReason}");

            return $lockedPo->load(['supplier', 'items.product', 'user', 'rejectedBy']);
        });
    }

    /**
     * Mengembalikan PO berstatus Rejected ke Draft agar dapat direvisi.
     */
    public function reviseToDraft(PurchaseOrder $po, User $actor): PurchaseOrder
    {
        return DB::transaction(function () use ($po, $actor): PurchaseOrder {
            /** @var PurchaseOrder $lockedPo */
            $lockedPo = PurchaseOrder::where('id', $po->id)->lockForUpdate()->firstOrFail();

            if ($lockedPo->status !== PurchaseOrderStatus::Rejected) {
                throw ValidationException::withMessages([
                    'status' => 'Hanya PO berstatus Ditolak yang dapat dikembalikan ke Draft.',
                ]);
            }

            $oldStatus = $lockedPo->status->value;
            $lockedPo->status = PurchaseOrderStatus::Draft;
            $lockedPo->save();

            activity(ActivityLogCategory::PurchaseOrder->value)
                ->event('updated')
                ->performedOn($lockedPo)
                ->causedBy($actor)
                ->withProperties([
                    'event' => 'revised',
                    'po_number' => $lockedPo->po_number,
                    'old_status' => $oldStatus,
                    'new_status' => $lockedPo->status->value,
                ])
                ->log("Purchase Order {$lockedPo->po_number} dikembalikan ke Draft untuk revisi.");

            return $lockedPo;
        });
    }

    /**
     * Menutup sisa pesanan PO yang berstatus receiving_status = partial dan menyesuaikan nilai hutang.
     */
    public function closeRemaining(PurchaseOrder $po, User $actor, ?string $reason = null): PurchaseOrder
    {
        return DB::transaction(function () use ($po, $actor, $reason): PurchaseOrder {
            /** @var PurchaseOrder $lockedPo */
            $lockedPo = PurchaseOrder::where('id', $po->id)->lockForUpdate()->firstOrFail();
            $lockedPo->load('items');

            if ($lockedPo->isLocked()) {
                throw ValidationException::withMessages([
                    'status' => "PO {$lockedPo->po_number} sudah terkunci permanen.",
                ]);
            }

            if ($lockedPo->status !== PurchaseOrderStatus::Approved || $lockedPo->receiving_status !== ReceivingStatus::Partial) {
                throw ValidationException::withMessages([
                    'status' => 'Hanya PO yang sudah disetujui dan berstatus Diterima Sebagian yang dapat ditutup sisa pesanannya.',
                ]);
            }

            $newSubtotal = 0.0;
            foreach ($lockedPo->items as $item) {
                $actualQty = (int) $item->quantity_received;
                $actualFreeQty = (int) $item->free_qty_received;
                $conversionFactor = max(1, (int) $item->conversion_factor);

                $amounts = $this->calculateItemAmounts([
                    'quantity_ordered' => $actualQty,
                    'unit_cost' => $item->unit_cost,
                    'discount_type' => $item->discount_type,
                    'discount_value' => $item->discount_type === 'fixed'
                        ? min((float) $item->discount_value, $actualQty * (float) $item->unit_cost)
                        : $item->discount_value,
                ]);

                $item->update([
                    'quantity_ordered' => $actualQty,
                    'free_qty_ordered' => $actualFreeQty,
                    'base_qty_ordered' => ($actualQty + $actualFreeQty) * $conversionFactor,
                    ...$amounts,
                ]);

                $newSubtotal += $amounts['subtotal'];
            }

            $totals = $this->calculateTotals($newSubtotal, [
                'discount_type' => $lockedPo->discount_type,
                'discount_value' => $lockedPo->discount_value,
                'tax_type' => $lockedPo->tax_type,
                'tax_value' => $lockedPo->tax_value,
            ]);

            $oldReceivingStatus = $lockedPo->receiving_status->value;
            $lockedPo->receiving_status = ReceivingStatus::Received;
            $lockedPo->subtotal = $newSubtotal;
            $lockedPo->discount_amount = $totals['discount_amount'];
            $lockedPo->tax_amount = $totals['tax_amount'];
            $lockedPo->total_amount = $totals['total_amount'];

            if ($reason) {
                $lockedPo->notes = trim(($lockedPo->notes ?? '')."\n[Tutup Sisa: {$reason}]");
            }
            $lockedPo->save();

            // Sinkronkan hutang dagang (akan menolak otomatis bila adjusted total < paid_amount)
            $this->financeService->syncPayableForPurchaseOrder($lockedPo, $actor);

            activity(ActivityLogCategory::PurchaseOrder->value)
                ->event('updated')
                ->performedOn($lockedPo)
                ->causedBy($actor)
                ->withProperties([
                    'event' => 'closed_remaining',
                    'po_number' => $lockedPo->po_number,
                    'old_receiving_status' => $oldReceivingStatus,
                    'new_receiving_status' => $lockedPo->receiving_status->value,
                    'adjusted_total_amount' => $lockedPo->total_amount,
                    'reason' => $reason,
                ])
                ->log("Sisa pesanan PO {$lockedPo->po_number} ditutup dan disesuaikan berdasarkan barang diterima.");

            return $lockedPo->load(['supplier', 'items.product', 'user', 'receivedBy', 'accountPayable']);
        });
    }

    /**
     * Membatalkan PO (hanya boleh jika belum ada barang diterima dan belum ada pembayaran).
     */
    public function cancel(PurchaseOrder $po, User $actor, ?string $reason = null): PurchaseOrder
    {
        return DB::transaction(function () use ($po, $actor, $reason): PurchaseOrder {
            /** @var PurchaseOrder $lockedPo */
            $lockedPo = PurchaseOrder::where('id', $po->id)->lockForUpdate()->firstOrFail();

            if ($lockedPo->isLocked()) {
                throw ValidationException::withMessages([
                    'status' => "PO {$lockedPo->po_number} sudah Lunas dan Diterima Penuh sehingga terkunci permanen.",
                ]);
            }

            if ($lockedPo->status === PurchaseOrderStatus::Cancelled) {
                throw ValidationException::withMessages([
                    'status' => "PO {$lockedPo->po_number} sudah berstatus Dibatalkan.",
                ]);
            }

            if ($lockedPo->hasAnyReceipts()) {
                throw ValidationException::withMessages([
                    'status' => "PO {$lockedPo->po_number} sudah memiliki penerimaan barang sehingga tidak dapat dibatalkan.",
                ]);
            }

            if ($lockedPo->hasAnyPayments()) {
                throw ValidationException::withMessages([
                    'status' => "PO {$lockedPo->po_number} sudah memiliki catatan pembayaran sehingga tidak dapat dibatalkan.",
                ]);
            }

            $oldStatus = $lockedPo->status->value;
            $lockedPo->status = PurchaseOrderStatus::Cancelled;
            if ($reason) {
                $lockedPo->notes = trim(($lockedPo->notes ?? '')."\n[Dibatalkan: {$reason}]");
            }
            $lockedPo->save();

            $this->financeService->voidPayableForPurchaseOrder($lockedPo, $actor);

            activity(ActivityLogCategory::PurchaseOrder->value)
                ->event('updated')
                ->performedOn($lockedPo)
                ->causedBy($actor)
                ->withProperties([
                    'event' => 'cancelled',
                    'po_number' => $lockedPo->po_number,
                    'old_status' => $oldStatus,
                    'new_status' => $lockedPo->status->value,
                    'reason' => $reason,
                ])
                ->log("Purchase Order {$lockedPo->po_number} dibatalkan.");

            return $lockedPo;
        });
    }

    /**
     * Menghapus PO (soft delete) dengan validasi ketat lock, penerimaan, dan pembayaran.
     */
    public function delete(PurchaseOrder $po, User $actor): void
    {
        DB::transaction(function () use ($po, $actor): void {
            /** @var PurchaseOrder $lockedPo */
            $lockedPo = PurchaseOrder::where('id', $po->id)->lockForUpdate()->firstOrFail();

            if ($lockedPo->isLocked()) {
                throw ValidationException::withMessages([
                    'status' => "PO {$lockedPo->po_number} sudah terkunci permanen (Lunas & Diterima Penuh) dan tidak dapat dihapus.",
                ]);
            }

            if ($lockedPo->hasAnyReceipts() || $lockedPo->hasAnyPayments()) {
                throw ValidationException::withMessages([
                    'status' => "PO {$lockedPo->po_number} sudah memiliki penerimaan barang atau pembayaran sehingga tidak dapat dihapus.",
                ]);
            }

            $this->financeService->voidPayableForPurchaseOrder($lockedPo, $actor);
            $lockedPo->delete();
        });
    }

    /**
     * Menyiapkan array item beserta snapshot UOM & kalkulasi diskon item.
     *
     * @param  array<int, array<string, mixed>>  $itemsData
     * @return array{0: float, 1: array<int, array<string, mixed>>}
     */
    private function prepareItemsPayload(array $itemsData): array
    {
        $subtotal = 0.0;
        $preparedItems = [];

        foreach ($itemsData as $row) {
            $productId = (int) $row['product_id'];
            $productUnitId = isset($row['product_unit_id']) && $row['product_unit_id'] !== ''
                ? (int) $row['product_unit_id']
                : null;

            [$unitName, $conversionFactor, $resolvedUnitId] = $this->resolveUnitSnapshot($productId, $productUnitId);

            $qtyOrdered = (int) ($row['quantity_ordered'] ?? 0);
            $freeQtyOrdered = max(0, (int) ($row['free_qty_ordered'] ?? 0));
            $amounts = $this->calculateItemAmounts($row);
            $subtotal += $amounts['subtotal'];

            $preparedItems[] = [
                'product_id' => $productId,
                'product_unit_id' => $resolvedUnitId,
                'unit_name' => $unitName,
                'conversion_factor' => $conversionFactor,
                'quantity_ordered' => $qtyOrdered,
                'quantity_received' => 0,
                'free_qty_ordered' => $freeQtyOrdered,
                'free_qty_received' => 0,
                'base_qty_ordered' => ($qtyOrdered + $freeQtyOrdered) * $conversionFactor,
                'base_qty_received' => 0,
                'unit_cost' => round(max(0, (float) ($row['unit_cost'] ?? 0)), 2),
                ...$amounts,
                'expired_date' => $row['expired_date'] ?? null,
            ];
        }

        return [round($subtotal, 2), $preparedItems];
    }

    /**
     * Mengambil snapshot satuan beli & faktor konversi dari ProductUnit atau base_unit Product.
     *
     * @return array{0: string, 1: int, 2: int|null}
     */
    private function resolveUnitSnapshot(int $productId, ?int $productUnitId): array
    {
        /** @var Product $product */
        $product = Product::findOrFail($productId);

        if ($productUnitId !== null) {
            /** @var ProductUnit|null $unit */
            $unit = ProductUnit::where('id', $productUnitId)
                ->where('product_id', $product->id)
                ->first();

            if (! $unit) {
                throw ValidationException::withMessages([
                    'items' => "Satuan konversi yang dipilih tidak cocok dengan produk {$product->name}.",
                ]);
            }

            return [$unit->unit_name, max(1, (int) $unit->conversion_factor), $unit->id];
        }

        return [$product->base_unit ?: 'pcs', 1, null];
    }
}

<?php

namespace App\Services;

use App\Enums\ActivityLogCategory;
use App\Enums\StockAdjustmentReason;
use App\Enums\StockAdjustmentStatus;
use App\Enums\StockAdjustmentType;
use App\Enums\StockMovementType;
use App\Enums\UserRoles;
use App\Models\Product;
use App\Models\StockAdjustment;
use App\Models\StockMovement;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class StockAdjustmentService
{
    /**
     * Membuat penyesuaian stok baru.
     * - Admin / Supervisor: langsung disetujui & memperbarui stok produk serta StockMovement.
     * - Warehouse / Cashier: berstatus pending menunggu persetujuan Admin / Supervisor.
     *
     * @param  array{
     *     product_id: int,
     *     type: string,
     *     reason: string,
     *     qty_change: int,
     *     notes: string
     * }  $data
     */
    public function create(array $data, User $actor): StockAdjustment
    {
        return DB::transaction(function () use ($data, $actor): StockAdjustment {
            /** @var Product $product */
            $product = Product::query()
                ->where('id', (int) $data['product_id'])
                ->lockForUpdate()
                ->firstOrFail();

            $type = StockAdjustmentType::from((string) $data['type']);
            $reason = StockAdjustmentReason::from((string) $data['reason']);
            $qtyChange = (int) $data['qty_change'];
            $notes = trim((string) $data['notes']);

            if ($qtyChange < 1) {
                throw ValidationException::withMessages([
                    'qty_change' => 'Jumlah perubahan stok minimal 1.',
                ]);
            }

            $qtyBefore = (int) $product->stock;
            $qtyAfter = $type === StockAdjustmentType::In
                ? $qtyBefore + $qtyChange
                : $qtyBefore - $qtyChange;

            if ($qtyAfter < 0) {
                throw ValidationException::withMessages([
                    'qty_change' => sprintf(
                        'Stok produk %s tidak mencukupi untuk pengurangan %d %s (stok saat ini: %d %s).',
                        $product->name,
                        $qtyChange,
                        $product->base_unit ?: 'pcs',
                        $qtyBefore,
                        $product->base_unit ?: 'pcs'
                    ),
                ]);
            }

            $unitCost = round((float) $product->buy_price, 2);
            $signedQty = $type === StockAdjustmentType::In ? $qtyChange : -$qtyChange;
            $totalCostImpact = round($signedQty * $unitCost, 2);
            $adjustmentNumber = $this->generateAdjustmentNumber();

            $canAutoApprove = $actor->hasRoles([UserRoles::Admin, UserRoles::Supervisor]);

            $adjustment = StockAdjustment::create([
                'adjustment_number' => $adjustmentNumber,
                'product_id' => $product->id,
                'type' => $type,
                'reason' => $reason,
                'status' => $canAutoApprove ? StockAdjustmentStatus::Approved : StockAdjustmentStatus::Pending,
                'qty_before' => $qtyBefore,
                'qty_change' => $qtyChange,
                'qty_after' => $qtyAfter,
                'unit_cost_snapshot' => $unitCost,
                'total_cost_impact' => $totalCostImpact,
                'notes' => $notes,
                'created_by' => $actor->id,
                'approved_by' => $canAutoApprove ? $actor->id : null,
                'approved_at' => $canAutoApprove ? now() : null,
            ]);

            if ($canAutoApprove) {
                $this->applyStockChange($adjustment, $product, $actor);

                activity(ActivityLogCategory::StockAdjustment->value)
                    ->event('created')
                    ->performedOn($adjustment)
                    ->causedBy($actor)
                    ->withProperties([
                        'adjustment_number' => $adjustment->adjustment_number,
                        'product_name' => $product->name,
                        'type' => $type->value,
                        'reason' => $reason->value,
                        'status' => StockAdjustmentStatus::Approved->value,
                        'old_stock' => $qtyBefore,
                        'new_stock' => $qtyAfter,
                        'qty_change' => $signedQty,
                        'unit_cost_snapshot' => $unitCost,
                        'total_cost_impact' => $totalCostImpact,
                        'notes' => $notes,
                        'approved_by' => $actor->name,
                    ])
                    ->log(sprintf(
                        'Penyesuaian stok %s (%s %d %s) untuk %s berhasil dibuat & disetujui oleh %s.',
                        $adjustment->adjustment_number,
                        $type === StockAdjustmentType::In ? '+' : '-',
                        $qtyChange,
                        $product->base_unit ?: 'pcs',
                        $product->name,
                        $actor->name
                    ));
            } else {
                activity(ActivityLogCategory::StockAdjustment->value)
                    ->event('created')
                    ->performedOn($adjustment)
                    ->causedBy($actor)
                    ->withProperties([
                        'adjustment_number' => $adjustment->adjustment_number,
                        'product_name' => $product->name,
                        'type' => $type->value,
                        'reason' => $reason->value,
                        'status' => StockAdjustmentStatus::Pending->value,
                        'old_stock' => $qtyBefore,
                        'new_stock' => $qtyAfter,
                        'qty_change' => $signedQty,
                        'unit_cost_snapshot' => $unitCost,
                        'total_cost_impact' => $totalCostImpact,
                        'notes' => $notes,
                    ])
                    ->log(sprintf(
                        'Pengajuan penyesuaian stok %s (%s %d %s) untuk %s diajukan oleh %s (Menunggu Persetujuan).',
                        $adjustment->adjustment_number,
                        $type === StockAdjustmentType::In ? '+' : '-',
                        $qtyChange,
                        $product->base_unit ?: 'pcs',
                        $product->name,
                        $actor->name
                    ));
            }

            return $adjustment->load(['product:id,name,barcode,base_unit,stock', 'creator:id,name,role', 'approver:id,name,role']);
        });
    }

    /**
     * Menyetujui pengajuan penyesuaian stok yang berstatus pending dan menerapkan mutasi stok.
     */
    public function approve(StockAdjustment $adjustment, User $approver): StockAdjustment
    {
        return DB::transaction(function () use ($adjustment, $approver): StockAdjustment {
            /** @var StockAdjustment $lockedAdjustment */
            $lockedAdjustment = StockAdjustment::query()
                ->where('id', $adjustment->id)
                ->lockForUpdate()
                ->firstOrFail();

            if ($lockedAdjustment->status !== StockAdjustmentStatus::Pending) {
                throw ValidationException::withMessages([
                    'status' => "Penyesuaian stok {$lockedAdjustment->adjustment_number} berstatus {$lockedAdjustment->status->label()} sehingga tidak dapat disetujui.",
                ]);
            }

            /** @var Product $product */
            $product = Product::query()
                ->where('id', $lockedAdjustment->product_id)
                ->lockForUpdate()
                ->firstOrFail();

            $qtyBefore = (int) $product->stock;
            $qtyChange = (int) $lockedAdjustment->qty_change;
            $qtyAfter = $lockedAdjustment->type === StockAdjustmentType::In
                ? $qtyBefore + $qtyChange
                : $qtyBefore - $qtyChange;

            if ($qtyAfter < 0) {
                throw ValidationException::withMessages([
                    'qty_change' => sprintf(
                        'Tidak dapat menyetujui %s: stok aktual %s saat ini %d %s, tidak cukup untuk pengurangan %d %s.',
                        $lockedAdjustment->adjustment_number,
                        $product->name,
                        $qtyBefore,
                        $product->base_unit ?: 'pcs',
                        $qtyChange,
                        $product->base_unit ?: 'pcs'
                    ),
                ]);
            }

            $unitCost = round((float) $product->buy_price, 2);
            $signedQty = $lockedAdjustment->type === StockAdjustmentType::In ? $qtyChange : -$qtyChange;
            $totalCostImpact = round($signedQty * $unitCost, 2);

            $lockedAdjustment->update([
                'status' => StockAdjustmentStatus::Approved,
                'qty_before' => $qtyBefore,
                'qty_after' => $qtyAfter,
                'unit_cost_snapshot' => $unitCost,
                'total_cost_impact' => $totalCostImpact,
                'approved_by' => $approver->id,
                'approved_at' => now(),
            ]);

            $this->applyStockChange($lockedAdjustment, $product, $approver);

            activity(ActivityLogCategory::StockAdjustment->value)
                ->event('approved')
                ->performedOn($lockedAdjustment)
                ->causedBy($approver)
                ->withProperties([
                    'adjustment_number' => $lockedAdjustment->adjustment_number,
                    'product_name' => $product->name,
                    'old_status' => StockAdjustmentStatus::Pending->value,
                    'new_status' => StockAdjustmentStatus::Approved->value,
                    'old_stock' => $qtyBefore,
                    'new_stock' => $qtyAfter,
                    'qty_change' => $signedQty,
                    'unit_cost_snapshot' => $unitCost,
                    'total_cost_impact' => $totalCostImpact,
                    'approved_by' => $approver->name,
                ])
                ->log(sprintf(
                    'Penyesuaian stok %s untuk %s disetujui oleh %s (Stok: %d → %d %s).',
                    $lockedAdjustment->adjustment_number,
                    $product->name,
                    $approver->name,
                    $qtyBefore,
                    $qtyAfter,
                    $product->base_unit ?: 'pcs'
                ));

            return $lockedAdjustment->fresh(['product:id,name,barcode,base_unit,stock', 'creator:id,name,role', 'approver:id,name,role']) ?? $lockedAdjustment;
        });
    }

    /**
     * Menolak pengajuan penyesuaian stok tanpa mengubah stok produk.
     */
    public function reject(StockAdjustment $adjustment, User $rejecter, string $rejectionReason): StockAdjustment
    {
        return DB::transaction(function () use ($adjustment, $rejecter, $rejectionReason): StockAdjustment {
            /** @var StockAdjustment $lockedAdjustment */
            $lockedAdjustment = StockAdjustment::query()
                ->where('id', $adjustment->id)
                ->lockForUpdate()
                ->firstOrFail();

            if ($lockedAdjustment->status !== StockAdjustmentStatus::Pending) {
                throw ValidationException::withMessages([
                    'status' => "Penyesuaian stok {$lockedAdjustment->adjustment_number} berstatus {$lockedAdjustment->status->label()} sehingga tidak dapat ditolak.",
                ]);
            }

            $cleanReason = trim($rejectionReason);

            $lockedAdjustment->update([
                'status' => StockAdjustmentStatus::Rejected,
                'rejected_by' => $rejecter->id,
                'rejected_at' => now(),
                'rejection_reason' => $cleanReason,
            ]);

            $productName = $lockedAdjustment->product?->name ?? 'Produk';

            activity(ActivityLogCategory::StockAdjustment->value)
                ->event('rejected')
                ->performedOn($lockedAdjustment)
                ->causedBy($rejecter)
                ->withProperties([
                    'adjustment_number' => $lockedAdjustment->adjustment_number,
                    'product_name' => $productName,
                    'old_status' => StockAdjustmentStatus::Pending->value,
                    'new_status' => StockAdjustmentStatus::Rejected->value,
                    'rejection_reason' => $cleanReason,
                    'rejected_by' => $rejecter->name,
                ])
                ->log(sprintf(
                    'Pengajuan penyesuaian stok %s untuk %s ditolak oleh %s. Alasan: %s',
                    $lockedAdjustment->adjustment_number,
                    $productName,
                    $rejecter->name,
                    $cleanReason
                ));

            return $lockedAdjustment->fresh(['product:id,name,barcode,base_unit,stock', 'creator:id,name,role', 'rejecter:id,name,role']) ?? $lockedAdjustment;
        });
    }

    /**
     * Menghitung 4 metrik ringkasan KPI dalam 1 query agregasi.
     *
     * @return array{
     *     total_count: int,
     *     pending_count: int,
     *     in_count: int,
     *     in_qty: int,
     *     out_count: int,
     *     out_qty: int,
     *     total_loss_value: float,
     *     net_cost_impact: float
     * }
     */
    public function getSummary(): array
    {
        $approvedVal = StockAdjustmentStatus::Approved->value;
        $pendingVal = StockAdjustmentStatus::Pending->value;
        $inVal = StockAdjustmentType::In->value;
        $outVal = StockAdjustmentType::Out->value;

        /** @var object{total_count: int|string|null, pending_count: int|string|null, in_count: int|string|null, in_qty: int|string|null, out_count: int|string|null, out_qty: int|string|null, total_loss_value: float|int|string|null, net_cost_impact: float|int|string|null}|null $row */
        $row = StockAdjustment::query()
            ->selectRaw(
                "COUNT(*) as total_count,
                COALESCE(SUM(CASE WHEN status = ? THEN 1 ELSE 0 END), 0) as pending_count,
                COALESCE(SUM(CASE WHEN status = ? AND type = ? THEN 1 ELSE 0 END), 0) as in_count,
                COALESCE(SUM(CASE WHEN status = ? AND type = ? THEN qty_change ELSE 0 END), 0) as in_qty,
                COALESCE(SUM(CASE WHEN status = ? AND type = ? THEN 1 ELSE 0 END), 0) as out_count,
                COALESCE(SUM(CASE WHEN status = ? AND type = ? THEN qty_change ELSE 0 END), 0) as out_qty,
                COALESCE(SUM(CASE WHEN status = ? AND type = ? THEN ABS(total_cost_impact) ELSE 0 END), 0) as total_loss_value,
                COALESCE(SUM(CASE WHEN status = ? THEN total_cost_impact ELSE 0 END), 0) as net_cost_impact",
                [
                    $pendingVal,
                    $approvedVal, $inVal,
                    $approvedVal, $inVal,
                    $approvedVal, $outVal,
                    $approvedVal, $outVal,
                    $approvedVal, $outVal,
                    $approvedVal,
                ]
            )
            ->first();

        return [
            'total_count' => (int) ($row->total_count ?? 0),
            'pending_count' => (int) ($row->pending_count ?? 0),
            'in_count' => (int) ($row->in_count ?? 0),
            'in_qty' => (int) ($row->in_qty ?? 0),
            'out_count' => (int) ($row->out_count ?? 0),
            'out_qty' => (int) ($row->out_qty ?? 0),
            'total_loss_value' => round((float) ($row->total_loss_value ?? 0), 2),
            'net_cost_impact' => round((float) ($row->net_cost_impact ?? 0), 2),
        ];
    }

    private function applyStockChange(StockAdjustment $adjustment, Product $product, User $actor): void
    {
        $product->stock = $adjustment->qty_after;
        $product->save();

        $isIn = $adjustment->type === StockAdjustmentType::In;
        $signedQty = $isIn ? (int) $adjustment->qty_change : -(int) $adjustment->qty_change;

        StockMovement::create([
            'product_id' => $product->id,
            'type' => $isIn ? StockMovementType::AdjustmentIn : StockMovementType::AdjustmentOut,
            'reference_type' => StockAdjustment::class,
            'reference_id' => $adjustment->id,
            'stock_before' => $adjustment->qty_before,
            'qty_change' => $signedQty,
            'stock_after' => $adjustment->qty_after,
            'unit_cost' => $adjustment->unit_cost_snapshot,
            'notes' => sprintf(
                '%s [%s]: %s',
                $adjustment->adjustment_number,
                $adjustment->reason->label(),
                $adjustment->notes
            ),
            'created_by' => $actor->id,
        ]);
    }

    private function generateAdjustmentNumber(): string
    {
        $prefix = 'ADJ-'.now()->format('Ymd').'-';

        /** @var string|null $lastNumber */
        $lastNumber = StockAdjustment::query()
            ->where('adjustment_number', 'like', $prefix.'%')
            ->lockForUpdate()
            ->orderByDesc('adjustment_number')
            ->value('adjustment_number');

        $nextSeq = 1;
        if ($lastNumber !== null) {
            $suffix = substr($lastNumber, strlen($prefix));
            if (is_numeric($suffix)) {
                $nextSeq = ((int) $suffix) + 1;
            }
        }

        return $prefix.str_pad((string) $nextSeq, 4, '0', STR_PAD_LEFT);
    }
}

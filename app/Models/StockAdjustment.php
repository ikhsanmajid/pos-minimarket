<?php

namespace App\Models;

use App\Enums\StockAdjustmentReason;
use App\Enums\StockAdjustmentStatus;
use App\Enums\StockAdjustmentType;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Table;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\MorphMany;

#[Table('stock_adjustments')]
#[Fillable([
    'adjustment_number',
    'product_id',
    'type',
    'reason',
    'status',
    'qty_before',
    'qty_change',
    'qty_after',
    'unit_cost_snapshot',
    'total_cost_impact',
    'notes',
    'created_by',
    'approved_by',
    'approved_at',
    'rejected_by',
    'rejected_at',
    'rejection_reason',
])]
class StockAdjustment extends Model
{
    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'type' => StockAdjustmentType::class,
            'reason' => StockAdjustmentReason::class,
            'status' => StockAdjustmentStatus::class,
            'qty_before' => 'integer',
            'qty_change' => 'integer',
            'qty_after' => 'integer',
            'unit_cost_snapshot' => 'decimal:2',
            'total_cost_impact' => 'decimal:2',
            'approved_at' => 'datetime',
            'rejected_at' => 'datetime',
        ];
    }

    /** @return BelongsTo<Product, $this> */
    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class)->withTrashed();
    }

    /** @return BelongsTo<User, $this> */
    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    /** @return BelongsTo<User, $this> */
    public function approver(): BelongsTo
    {
        return $this->belongsTo(User::class, 'approved_by');
    }

    /** @return BelongsTo<User, $this> */
    public function rejecter(): BelongsTo
    {
        return $this->belongsTo(User::class, 'rejected_by');
    }

    /** @return MorphMany<StockMovement, $this> */
    public function stockMovements(): MorphMany
    {
        return $this->morphMany(StockMovement::class, 'reference');
    }
}

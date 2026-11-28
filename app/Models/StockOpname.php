<?php

namespace App\Models;

use App\Enums\StockOpnameStatus;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Table;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\MorphMany;

#[Table('stock_opnames')]
#[Fillable([
    'opname_number',
    'status',
    'category_id',
    'is_blind_count',
    'notes',
    'started_at',
    'completed_at',
    'cancelled_at',
    'created_by',
    'approved_by',
    'total_items_counted',
    'total_variance_items',
    'total_variance_value',
])]
class StockOpname extends Model
{
    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'status' => StockOpnameStatus::class,
            'is_blind_count' => 'boolean',
            'started_at' => 'datetime',
            'completed_at' => 'datetime',
            'cancelled_at' => 'datetime',
            'total_items_counted' => 'integer',
            'total_variance_items' => 'integer',
            'total_variance_value' => 'decimal:2',
        ];
    }

    /** @return BelongsTo<Category, $this> */
    public function category(): BelongsTo
    {
        return $this->belongsTo(Category::class)->withTrashed();
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

    /** @return HasMany<StockOpnameItem, $this> */
    public function items(): HasMany
    {
        return $this->hasMany(StockOpnameItem::class);
    }

    /** @return MorphMany<StockMovement, $this> */
    public function stockMovements(): MorphMany
    {
        return $this->morphMany(StockMovement::class, 'reference');
    }
}

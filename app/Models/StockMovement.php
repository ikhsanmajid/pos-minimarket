<?php

namespace App\Models;

use App\Enums\StockMovementType;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Table;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\MorphTo;

#[Table('stock_movements')]
#[Fillable([
    'product_id',
    'type',
    'reference_type',
    'reference_id',
    'stock_before',
    'qty_change',
    'stock_after',
    'unit_cost',
    'notes',
    'created_by',
])]
class StockMovement extends Model
{
    protected function casts(): array
    {
        return [
            'type' => StockMovementType::class,
            'stock_before' => 'integer',
            'qty_change' => 'integer',
            'stock_after' => 'integer',
            'unit_cost' => 'decimal:2',
        ];
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class)->withTrashed();
    }

    public function reference(): MorphTo
    {
        return $this->morphTo();
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}

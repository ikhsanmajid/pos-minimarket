<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Table;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Table('stock_opname_items')]
#[Fillable([
    'stock_opname_id',
    'product_id',
    'system_stock',
    'physical_stock',
    'variance_qty',
    'unit_cost_snapshot',
    'variance_value',
    'notes',
    'counted_by',
    'counted_at',
])]
class StockOpnameItem extends Model
{
    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'system_stock' => 'integer',
            'physical_stock' => 'integer',
            'variance_qty' => 'integer',
            'unit_cost_snapshot' => 'decimal:2',
            'variance_value' => 'decimal:2',
            'counted_at' => 'datetime',
        ];
    }

    /** @return BelongsTo<StockOpname, $this> */
    public function stockOpname(): BelongsTo
    {
        return $this->belongsTo(StockOpname::class);
    }

    /** @return BelongsTo<Product, $this> */
    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class)->withTrashed();
    }

    /** @return BelongsTo<User, $this> */
    public function counter(): BelongsTo
    {
        return $this->belongsTo(User::class, 'counted_by');
    }
}

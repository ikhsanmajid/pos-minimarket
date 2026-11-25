<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Table;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Table('product_units')]
#[Fillable([
    'product_id',
    'unit_name',
    'conversion_factor',
    'barcode',
    'buy_price',
    'sell_price',
    'is_default_purchase',
    'is_active',
])]
class ProductUnit extends Model
{
    protected function casts(): array
    {
        return [
            'conversion_factor' => 'integer',
            'buy_price' => 'decimal:2',
            'sell_price' => 'decimal:2',
            'is_default_purchase' => 'boolean',
            'is_active' => 'boolean',
        ];
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    public function purchaseOrderItems(): HasMany
    {
        return $this->hasMany(PurchaseOrderItem::class);
    }
}

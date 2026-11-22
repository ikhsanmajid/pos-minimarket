<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Table;
use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Table('purchase_order_items')]
#[Fillable([
    'purchase_order_id',
    'product_id',
    'quantity_ordered',
    'quantity_received',
    'unit_cost',
    'subtotal',
    'expired_date',
])]
class PurchaseOrderItem extends Model
{
    protected function casts(): array
    {
        return [
            'quantity_ordered' => 'integer',
            'quantity_received' => 'integer',
            'unit_cost' => 'decimal:2',
            'subtotal' => 'decimal:2',
            'expired_date' => 'date',
        ];
    }

    protected function remainingQuantity(): Attribute
    {
        return Attribute::make(
            get: fn () => max(0, (int) $this->quantity_ordered - (int) $this->quantity_received),
        );
    }

    public function purchaseOrder(): BelongsTo
    {
        return $this->belongsTo(PurchaseOrder::class);
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class)->withTrashed();
    }
}

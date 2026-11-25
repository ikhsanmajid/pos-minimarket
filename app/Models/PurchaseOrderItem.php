<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Table;
use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Table('purchase_order_items')]
#[Fillable([
    'purchase_order_id',
    'product_id',
    'product_unit_id',
    'unit_name',
    'conversion_factor',
    'quantity_ordered',
    'quantity_received',
    'free_qty_ordered',
    'free_qty_received',
    'base_qty_ordered',
    'base_qty_received',
    'unit_cost',
    'discount_type',
    'discount_value',
    'discount_amount',
    'subtotal',
    'expired_date',
])]
class PurchaseOrderItem extends Model
{
    protected $attributes = [
        'unit_name' => 'pcs',
        'conversion_factor' => 1,
        'quantity_received' => 0,
        'free_qty_ordered' => 0,
        'free_qty_received' => 0,
        'base_qty_ordered' => 0,
        'base_qty_received' => 0,
        'discount_type' => 'fixed',
        'discount_value' => 0,
        'discount_amount' => 0,
    ];

    protected function casts(): array
    {
        return [
            'conversion_factor' => 'integer',
            'quantity_ordered' => 'integer',
            'quantity_received' => 'integer',
            'free_qty_ordered' => 'integer',
            'free_qty_received' => 'integer',
            'base_qty_ordered' => 'integer',
            'base_qty_received' => 'integer',
            'unit_cost' => 'decimal:2',
            'discount_value' => 'decimal:2',
            'discount_amount' => 'decimal:2',
            'subtotal' => 'decimal:2',
            'expired_date' => 'date',
        ];
    }

    protected function remainingQuantity(): Attribute
    {
        return Attribute::make(
            get: fn (): int => max(0, (int) $this->quantity_ordered - (int) $this->quantity_received),
        );
    }

    protected function remainingFreeQuantity(): Attribute
    {
        return Attribute::make(
            get: fn (): int => max(0, (int) $this->free_qty_ordered - (int) $this->free_qty_received),
        );
    }

    /**
     * Harga beli bersih per satuan beli setelah diskon item.
     */
    protected function netUnitCost(): Attribute
    {
        return Attribute::make(
            get: fn (): float => (int) $this->quantity_ordered > 0
                ? round((float) $this->subtotal / (int) $this->quantity_ordered, 2)
                : (float) $this->unit_cost,
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

    public function productUnit(): BelongsTo
    {
        return $this->belongsTo(ProductUnit::class);
    }

    public function receiptItems(): HasMany
    {
        return $this->hasMany(PurchaseOrderReceiptItem::class);
    }
}

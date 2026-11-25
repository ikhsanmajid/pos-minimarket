<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Table;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Table('purchase_order_receipt_items')]
#[Fillable([
    'purchase_order_receipt_id',
    'purchase_order_item_id',
    'product_id',
    'unit_name',
    'conversion_factor',
    'qty_received',
    'free_qty_received',
    'base_qty_received',
    'unit_cost',
    'base_unit_cost',
    'batch_number',
    'expired_date',
])]
class PurchaseOrderReceiptItem extends Model
{
    protected function casts(): array
    {
        return [
            'conversion_factor' => 'integer',
            'qty_received' => 'integer',
            'free_qty_received' => 'integer',
            'base_qty_received' => 'integer',
            'unit_cost' => 'decimal:2',
            'base_unit_cost' => 'decimal:2',
            'expired_date' => 'date',
        ];
    }

    public function receipt(): BelongsTo
    {
        return $this->belongsTo(PurchaseOrderReceipt::class, 'purchase_order_receipt_id');
    }

    public function purchaseOrderItem(): BelongsTo
    {
        return $this->belongsTo(PurchaseOrderItem::class);
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class)->withTrashed();
    }
}

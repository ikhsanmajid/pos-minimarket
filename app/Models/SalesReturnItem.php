<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Table;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property int $sales_return_id
 * @property int $transaction_detail_id
 * @property int $product_id
 * @property int|null $product_unit_id
 * @property string $unit_name_snapshot
 * @property int $conversion_factor
 * @property int $qty
 * @property int $base_qty
 * @property string $unit_price_snapshot
 * @property string $subtotal_refund
 * @property bool $is_restockable
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 */
#[Table('sales_return_items')]
#[Fillable([
    'sales_return_id',
    'transaction_detail_id',
    'product_id',
    'product_unit_id',
    'unit_name_snapshot',
    'conversion_factor',
    'qty',
    'base_qty',
    'unit_price_snapshot',
    'subtotal_refund',
    'is_restockable',
])]
class SalesReturnItem extends Model
{
    protected function casts(): array
    {
        return [
            'conversion_factor' => 'integer',
            'qty' => 'integer',
            'base_qty' => 'integer',
            'unit_price_snapshot' => 'decimal:2',
            'subtotal_refund' => 'decimal:2',
            'is_restockable' => 'boolean',
        ];
    }

    /** @return BelongsTo<SalesReturn, $this> */
    public function salesReturn(): BelongsTo
    {
        return $this->belongsTo(SalesReturn::class);
    }

    /** @return BelongsTo<TransactionDetail, $this> */
    public function transactionDetail(): BelongsTo
    {
        return $this->belongsTo(TransactionDetail::class);
    }

    /** @return BelongsTo<Product, $this> */
    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class)->withTrashed();
    }

    /** @return BelongsTo<ProductUnit, $this> */
    public function productUnit(): BelongsTo
    {
        return $this->belongsTo(ProductUnit::class);
    }
}

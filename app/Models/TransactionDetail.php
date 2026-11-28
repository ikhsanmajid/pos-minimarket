<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Table;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property int $transaction_id
 * @property int $product_id
 * @property int|null $product_unit_id
 * @property string $unit_name_snapshot
 * @property int $conversion_factor
 * @property int $qty
 * @property int $base_qty
 * @property string $unit_price
 * @property string $cost_price_snapshot
 * @property string $discount_amount
 * @property string $quantity
 * @property string $buy_price
 * @property string $sell_price
 * @property string $subtotal
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 */
#[Table('transaction_details')]
#[Fillable([
    'transaction_id',
    'product_id',
    'product_unit_id',
    'unit_name_snapshot',
    'conversion_factor',
    'qty',
    'base_qty',
    'unit_price',
    'cost_price_snapshot',
    'discount_amount',
    'quantity',
    'buy_price',
    'sell_price',
    'subtotal',
])]
class TransactionDetail extends Model
{
    protected function casts(): array
    {
        return [
            'conversion_factor' => 'integer',
            'qty' => 'integer',
            'base_qty' => 'integer',
            'unit_price' => 'decimal:2',
            'cost_price_snapshot' => 'decimal:2',
            'discount_amount' => 'decimal:2',
            'buy_price' => 'decimal:2',
            'sell_price' => 'decimal:2',
            'subtotal' => 'decimal:2',
        ];
    }

    /** @return BelongsTo<Transaction, $this> */
    public function transaction(): BelongsTo
    {
        return $this->belongsTo(Transaction::class);
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

    /** @return HasMany<SalesReturnItem, $this> */
    public function returnItems(): HasMany
    {
        return $this->hasMany(SalesReturnItem::class);
    }
}

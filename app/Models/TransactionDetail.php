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
 * @property int|null $applied_promotion_id
 * @property string|null $applied_promotion_name
 * @property string $pricing_source
 * @property string $allocated_header_discount
 * @property int $free_qty
 * @property bool $is_promo_excluded
 * @property bool $is_tax_exempt
 * @property bool $is_donation
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
    'applied_promotion_id',
    'applied_promotion_name',
    'pricing_source',
    'allocated_header_discount',
    'free_qty',
    'is_promo_excluded',
    'is_tax_exempt',
    'is_donation',
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
            'allocated_header_discount' => 'decimal:2',
            'free_qty' => 'integer',
            'is_promo_excluded' => 'boolean',
            'is_tax_exempt' => 'boolean',
            'is_donation' => 'boolean',
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

    /** @return BelongsTo<Promotion, $this> */
    public function appliedPromotion(): BelongsTo
    {
        return $this->belongsTo(Promotion::class, 'applied_promotion_id');
    }

    /** @return HasMany<AppliedPromotion, $this> */
    public function appliedPromotions(): HasMany
    {
        return $this->hasMany(AppliedPromotion::class);
    }
}

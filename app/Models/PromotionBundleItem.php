<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Table;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property int $promotion_id
 * @property int $product_id
 * @property int $required_qty
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 */
#[Table('promotion_bundle_items')]
#[Fillable([
    'promotion_id',
    'product_id',
    'required_qty',
])]
class PromotionBundleItem extends Model
{
    protected $attributes = [
        'required_qty' => 1,
    ];

    protected function casts(): array
    {
        return [
            'required_qty' => 'integer',
        ];
    }

    /** @return BelongsTo<Promotion, $this> */
    public function promotion(): BelongsTo
    {
        return $this->belongsTo(Promotion::class);
    }

    /** @return BelongsTo<Product, $this> */
    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }
}

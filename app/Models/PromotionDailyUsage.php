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
 * @property Carbon $usage_date
 * @property int|null $customer_id
 * @property int $used_qty
 * @property int $used_count
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 */
#[Table('promotion_daily_usages')]
#[Fillable([
    'promotion_id',
    'usage_date',
    'customer_id',
    'used_qty',
    'used_count',
])]
class PromotionDailyUsage extends Model
{
    protected $attributes = [
        'used_qty' => 0,
        'used_count' => 0,
    ];

    protected function casts(): array
    {
        return [
            'usage_date' => 'date',
            'used_qty' => 'integer',
            'used_count' => 'integer',
        ];
    }

    /** @return BelongsTo<Promotion, $this> */
    public function promotion(): BelongsTo
    {
        return $this->belongsTo(Promotion::class);
    }

    /** @return BelongsTo<Customer, $this> */
    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class);
    }
}

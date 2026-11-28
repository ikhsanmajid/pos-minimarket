<?php

namespace App\Models;

use App\Enums\PromotionFunding;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Table;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property int $transaction_id
 * @property int|null $transaction_detail_id
 * @property int|null $promotion_id
 * @property int|null $voucher_id
 * @property string $type
 * @property PromotionFunding $funding
 * @property string $discount_amount
 * @property string $description_snapshot
 * @property array<string, mixed>|null $meta
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 */
#[Table('applied_promotions')]
#[Fillable([
    'transaction_id',
    'transaction_detail_id',
    'promotion_id',
    'voucher_id',
    'type',
    'funding',
    'discount_amount',
    'description_snapshot',
    'meta',
])]
class AppliedPromotion extends Model
{
    protected function casts(): array
    {
        return [
            'funding' => PromotionFunding::class,
            'discount_amount' => 'decimal:2',
            'meta' => 'array',
        ];
    }

    /** @return BelongsTo<Transaction, $this> */
    public function transaction(): BelongsTo
    {
        return $this->belongsTo(Transaction::class);
    }

    /** @return BelongsTo<TransactionDetail, $this> */
    public function transactionDetail(): BelongsTo
    {
        return $this->belongsTo(TransactionDetail::class);
    }

    /** @return BelongsTo<Promotion, $this> */
    public function promotion(): BelongsTo
    {
        return $this->belongsTo(Promotion::class);
    }

    /** @return BelongsTo<Voucher, $this> */
    public function voucher(): BelongsTo
    {
        return $this->belongsTo(Voucher::class);
    }
}

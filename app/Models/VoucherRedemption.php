<?php

namespace App\Models;

use App\Enums\ActivityLogCategory;
use App\Enums\VoucherRedemptionStatus;
use Carbon\CarbonInterface;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Table;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Spatie\Activitylog\Models\Concerns\LogsActivity;
use Spatie\Activitylog\Support\LogOptions;

/**
 * @property int $id
 * @property int $voucher_id
 * @property int|null $transaction_id
 * @property int|null $customer_id
 * @property int $cashier_id
 * @property string|null $reservation_token
 * @property VoucherRedemptionStatus $status
 * @property string $discount_amount
 * @property CarbonInterface|null $reserved_until
 * @property CarbonInterface|null $redeemed_at
 * @property CarbonInterface|null $released_at
 * @property CarbonInterface|null $created_at
 * @property CarbonInterface|null $updated_at
 */
#[Table('voucher_redemptions')]
#[Fillable([
    'voucher_id',
    'transaction_id',
    'customer_id',
    'cashier_id',
    'reservation_token',
    'status',
    'discount_amount',
    'reserved_until',
    'redeemed_at',
    'released_at',
])]
class VoucherRedemption extends Model
{
    use LogsActivity;

    protected $attributes = [
        'discount_amount' => 0,
    ];

    protected function casts(): array
    {
        return [
            'status' => VoucherRedemptionStatus::class,
            'discount_amount' => 'decimal:2',
            'reserved_until' => 'datetime',
            'redeemed_at' => 'datetime',
            'released_at' => 'datetime',
        ];
    }

    public function getActivitylogOptions(): LogOptions
    {
        return LogOptions::defaults()
            ->useLogName(ActivityLogCategory::Promotion->value)
            ->setDescriptionForEvent(fn (string $eventName): string => match ($eventName) {
                'created' => "Redemption voucher #{$this->voucher_id} ({$this->status->label()}) dicatat.",
                'updated' => "Status redemption voucher #{$this->voucher_id} diperbarui menjadi {$this->status->label()}.",
                'deleted' => "Redemption voucher #{$this->voucher_id} dihapus.",
                default => "Redemption voucher #{$this->voucher_id} ({$eventName}).",
            })
            ->logOnly([
                'voucher_id',
                'transaction_id',
                'customer_id',
                'cashier_id',
                'status',
                'discount_amount',
                'reserved_until',
                'redeemed_at',
                'released_at',
            ])
            ->logOnlyDirty()
            ->dontLogEmptyChanges();
    }

    /** @return BelongsTo<Voucher, $this> */
    public function voucher(): BelongsTo
    {
        return $this->belongsTo(Voucher::class);
    }

    /** @return BelongsTo<Transaction, $this> */
    public function transaction(): BelongsTo
    {
        return $this->belongsTo(Transaction::class);
    }

    /** @return BelongsTo<Customer, $this> */
    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class)->withTrashed();
    }

    /** @return BelongsTo<User, $this> */
    public function cashier(): BelongsTo
    {
        return $this->belongsTo(User::class, 'cashier_id')->withTrashed();
    }
}

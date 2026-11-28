<?php

namespace App\Models;

use App\Enums\ActivityLogCategory;
use App\Enums\TransactionStatus;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Table;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Carbon;
use Spatie\Activitylog\Models\Concerns\LogsActivity;
use Spatie\Activitylog\Support\LogOptions;

/**
 * @property int $id
 * @property string $invoice_number
 * @property int $user_id
 * @property int|null $cashier_shift_id
 * @property int|null $customer_id
 * @property string $subtotal
 * @property string $discount_amount
 * @property string $tax_amount
 * @property string $rounding_amount
 * @property string $donation_amount
 * @property string $total_amount
 * @property string|null $discount
 * @property string $grand_total
 * @property string $paid_amount
 * @property string $pay_amount
 * @property string|null $change_amount
 * @property string $payment_method
 * @property TransactionStatus $status
 * @property int|null $voided_by
 * @property Carbon|null $voided_at
 * @property string|null $void_reason
 * @property int|null $discount_approved_by
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 */
#[Table('transactions')]
#[Fillable([
    'invoice_number',
    'user_id',
    'cashier_shift_id',
    'customer_id',
    'subtotal',
    'discount_amount',
    'tax_amount',
    'rounding_amount',
    'donation_amount',
    'total_amount',
    'discount',
    'grand_total',
    'paid_amount',
    'pay_amount',
    'change_amount',
    'payment_method',
    'status',
    'voided_by',
    'voided_at',
    'void_reason',
    'discount_approved_by',
])]
class Transaction extends Model
{
    use LogsActivity;

    /**
     * Logging dikelola secara terstruktur oleh PosTransactionService & SalesReturnService agar tidak ganda.
     *
     * @var array<int, string>
     */
    protected static array $recordEvents = [];

    protected $attributes = [
        'status' => 'completed',
    ];

    protected function casts(): array
    {
        return [
            'subtotal' => 'decimal:2',
            'discount_amount' => 'decimal:2',
            'tax_amount' => 'decimal:2',
            'rounding_amount' => 'decimal:2',
            'donation_amount' => 'decimal:2',
            'total_amount' => 'decimal:2',
            'discount' => 'decimal:2',
            'grand_total' => 'decimal:2',
            'paid_amount' => 'decimal:2',
            'pay_amount' => 'decimal:2',
            'change_amount' => 'decimal:2',
            'status' => TransactionStatus::class,
            'voided_at' => 'datetime',
        ];
    }

    public function getActivitylogOptions(): LogOptions
    {
        return LogOptions::defaults()
            ->useLogName(ActivityLogCategory::Transaction->value)
            ->setDescriptionForEvent(fn (string $eventName): string => match ($eventName) {
                'created' => "Transaksi {$this->invoice_number} berhasil dibuat.",
                'updated' => "Transaksi {$this->invoice_number} diperbarui.",
                'deleted' => "Transaksi {$this->invoice_number} dihapus.",
                'restored' => "Transaksi {$this->invoice_number} dipulihkan.",
                default => "Transaksi {$this->invoice_number} ({$eventName}).",
            })
            ->logOnly([
                'invoice_number',
                'status',
                'subtotal',
                'discount_amount',
                'tax_amount',
                'rounding_amount',
                'donation_amount',
                'grand_total',
                'paid_amount',
                'change_amount',
                'voided_by',
                'voided_at',
                'void_reason',
            ])
            ->logOnlyDirty()
            ->dontLogEmptyChanges();
    }

    /** @return BelongsTo<User, $this> */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class)->withTrashed();
    }

    /** @return BelongsTo<CashierShift, $this> */
    public function cashierShift(): BelongsTo
    {
        return $this->belongsTo(CashierShift::class);
    }

    /** @return BelongsTo<Customer, $this> */
    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class)->withTrashed();
    }

    /** @return BelongsTo<User, $this> */
    public function voidedByUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'voided_by')->withTrashed();
    }

    /** @return BelongsTo<User, $this> */
    public function discountApprovedByUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'discount_approved_by')->withTrashed();
    }

    /** @return HasMany<TransactionDetail, $this> */
    public function details(): HasMany
    {
        return $this->hasMany(TransactionDetail::class);
    }

    /** @return HasMany<TransactionPayment, $this> */
    public function payments(): HasMany
    {
        return $this->hasMany(TransactionPayment::class);
    }

    /** @return HasMany<SalesReturn, $this> */
    public function salesReturns(): HasMany
    {
        return $this->hasMany(SalesReturn::class)->latest('id');
    }

    /** @return HasMany<AppliedPromotion, $this> */
    public function appliedPromotions(): HasMany
    {
        return $this->hasMany(AppliedPromotion::class);
    }

    /** @return HasMany<VoucherRedemption, $this> */
    public function voucherRedemptions(): HasMany
    {
        return $this->hasMany(VoucherRedemption::class);
    }
}

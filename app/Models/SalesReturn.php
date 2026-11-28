<?php

namespace App\Models;

use App\Enums\ActivityLogCategory;
use App\Enums\PaymentMethod;
use App\Enums\SalesReturnStatus;
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
 * @property string $return_number
 * @property int $transaction_id
 * @property int|null $cashier_shift_id
 * @property int $processed_by
 * @property int $approved_by
 * @property SalesReturnStatus $status
 * @property PaymentMethod $refund_method
 * @property int $financial_account_id
 * @property string $total_refund_amount
 * @property string $reason
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 */
#[Table('sales_returns')]
#[Fillable([
    'return_number',
    'transaction_id',
    'cashier_shift_id',
    'processed_by',
    'approved_by',
    'status',
    'refund_method',
    'financial_account_id',
    'total_refund_amount',
    'reason',
])]
class SalesReturn extends Model
{
    use LogsActivity;

    /**
     * Logging dikelola secara terstruktur oleh SalesReturnService agar tidak ganda.
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
            'status' => SalesReturnStatus::class,
            'refund_method' => PaymentMethod::class,
            'total_refund_amount' => 'decimal:2',
        ];
    }

    public function getActivitylogOptions(): LogOptions
    {
        return LogOptions::defaults()
            ->useLogName(ActivityLogCategory::Transaction->value)
            ->setDescriptionForEvent(fn (string $eventName): string => match ($eventName) {
                'created' => "Retur Penjualan {$this->return_number} berhasil dibuat.",
                'updated' => "Retur Penjualan {$this->return_number} diperbarui.",
                'deleted' => "Retur Penjualan {$this->return_number} dihapus.",
                'restored' => "Retur Penjualan {$this->return_number} dipulihkan.",
                default => "Retur Penjualan {$this->return_number} ({$eventName}).",
            })
            ->logOnly([
                'return_number',
                'status',
                'refund_method',
                'total_refund_amount',
                'reason',
                'approved_by',
            ])
            ->logOnlyDirty()
            ->dontLogEmptyChanges();
    }

    /** @return BelongsTo<Transaction, $this> */
    public function transaction(): BelongsTo
    {
        return $this->belongsTo(Transaction::class);
    }

    /** @return BelongsTo<CashierShift, $this> */
    public function cashierShift(): BelongsTo
    {
        return $this->belongsTo(CashierShift::class);
    }

    /** @return BelongsTo<User, $this> */
    public function processor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'processed_by')->withTrashed();
    }

    /** @return BelongsTo<User, $this> */
    public function approver(): BelongsTo
    {
        return $this->belongsTo(User::class, 'approved_by')->withTrashed();
    }

    /** @return BelongsTo<FinancialAccount, $this> */
    public function financialAccount(): BelongsTo
    {
        return $this->belongsTo(FinancialAccount::class);
    }

    /** @return HasMany<SalesReturnItem, $this> */
    public function items(): HasMany
    {
        return $this->hasMany(SalesReturnItem::class);
    }
}

<?php

namespace App\Models;

use App\Enums\ActivityLogCategory;
use App\Enums\ShiftCashMovementType;
use Database\Factories\ShiftCashMovementFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Table;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Spatie\Activitylog\Models\Concerns\LogsActivity;
use Spatie\Activitylog\Support\LogOptions;

/**
 * @property int $id
 * @property int $cashier_shift_id
 * @property ShiftCashMovementType $type
 * @property string $amount
 * @property string $reason
 * @property int|null $financial_account_id
 * @property int|null $approved_by
 * @property int $created_by
 */
#[Table('shift_cash_movements')]
#[Fillable([
    'cashier_shift_id',
    'type',
    'amount',
    'reason',
    'financial_account_id',
    'approved_by',
    'created_by',
])]
class ShiftCashMovement extends Model
{
    /** @use HasFactory<ShiftCashMovementFactory> */
    use HasFactory, LogsActivity;

    /**
     * Logging dikelola secara terstruktur oleh CashierShiftService agar tidak ganda.
     *
     * @var array<int, string>
     */
    protected static array $recordEvents = [];

    protected function casts(): array
    {
        return [
            'type' => ShiftCashMovementType::class,
            'amount' => 'decimal:2',
        ];
    }

    public function getActivitylogOptions(): LogOptions
    {
        return LogOptions::defaults()
            ->useLogName(ActivityLogCategory::CashierShift->value)
            ->setDescriptionForEvent(fn (string $eventName): string => match ($eventName) {
                'created' => "Mutasi Kas Shift #{$this->id} berhasil dibuat.",
                'updated' => "Mutasi Kas Shift #{$this->id} diperbarui.",
                'deleted' => "Mutasi Kas Shift #{$this->id} dihapus.",
                'restored' => "Mutasi Kas Shift #{$this->id} dipulihkan.",
                default => "Mutasi Kas Shift #{$this->id} ({$eventName}).",
            })
            ->logOnly(['cashier_shift_id', 'type', 'amount', 'reason', 'financial_account_id', 'approved_by'])
            ->logOnlyDirty()
            ->dontLogEmptyChanges();
    }

    /** @return BelongsTo<CashierShift, $this> */
    public function cashierShift(): BelongsTo
    {
        return $this->belongsTo(CashierShift::class);
    }

    /** @return BelongsTo<FinancialAccount, $this> */
    public function financialAccount(): BelongsTo
    {
        return $this->belongsTo(FinancialAccount::class)->withTrashed();
    }

    /** @return BelongsTo<User, $this> */
    public function approver(): BelongsTo
    {
        return $this->belongsTo(User::class, 'approved_by')->withTrashed();
    }

    /** @return BelongsTo<User, $this> */
    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by')->withTrashed();
    }
}

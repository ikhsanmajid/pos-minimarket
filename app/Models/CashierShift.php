<?php

namespace App\Models;

use App\Enums\ActivityLogCategory;
use App\Enums\CashierShiftStatus;
use Database\Factories\CashierShiftFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Table;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Carbon;
use Spatie\Activitylog\Models\Concerns\LogsActivity;
use Spatie\Activitylog\Support\LogOptions;

/**
 * @property int $id
 * @property string $shift_number
 * @property int $user_id
 * @property int|null $cash_register_id
 * @property string $register_name
 * @property CashierShiftStatus $status
 * @property Carbon $opened_at
 * @property Carbon|null $closed_at
 * @property string $starting_cash
 * @property string|null $expected_cash
 * @property string|null $actual_cash
 * @property string|null $cash_variance
 * @property string $total_cash_sales
 * @property string $total_non_cash_sales
 * @property string $total_refunds
 * @property string $total_cash_in
 * @property string $total_cash_out
 * @property string $total_cash_drop
 * @property int $total_transactions
 * @property array<int, array{denomination: int, qty: int, subtotal: int}>|null $denomination_breakdown
 * @property string|null $closing_notes
 * @property int|null $verified_by
 */
#[Table('cashier_shifts')]
#[Fillable([
    'shift_number',
    'user_id',
    'cash_register_id',
    'register_name',
    'status',
    'opened_at',
    'closed_at',
    'starting_cash',
    'expected_cash',
    'actual_cash',
    'cash_variance',
    'total_cash_sales',
    'total_non_cash_sales',
    'total_refunds',
    'total_cash_in',
    'total_cash_out',
    'total_cash_drop',
    'total_transactions',
    'denomination_breakdown',
    'closing_notes',
    'verified_by',
])]
class CashierShift extends Model
{
    /** @use HasFactory<CashierShiftFactory> */
    use HasFactory, LogsActivity;

    /**
     * Logging dikelola secara terstruktur oleh CashierShiftService agar tidak ganda.
     *
     * @var array<int, string>
     */
    protected static array $recordEvents = [];

    protected $attributes = [
        'register_name' => 'Kasir 1',
        'status' => 'open',
    ];

    protected function casts(): array
    {
        return [
            'status' => CashierShiftStatus::class,
            'opened_at' => 'datetime',
            'closed_at' => 'datetime',
            'starting_cash' => 'decimal:2',
            'expected_cash' => 'decimal:2',
            'actual_cash' => 'decimal:2',
            'cash_variance' => 'decimal:2',
            'total_cash_sales' => 'decimal:2',
            'total_non_cash_sales' => 'decimal:2',
            'total_refunds' => 'decimal:2',
            'total_cash_in' => 'decimal:2',
            'total_cash_out' => 'decimal:2',
            'total_cash_drop' => 'decimal:2',
            'total_transactions' => 'integer',
            'denomination_breakdown' => 'array',
        ];
    }

    protected static function booted(): void
    {
        static::creating(function (CashierShift $shift): void {
            if (empty($shift->shift_number)) {
                $dateStr = now()->format('Ymd');
                $prefix = "SHF-{$dateStr}-";
                $latest = static::where('shift_number', 'like', "{$prefix}%")
                    ->orderByDesc('shift_number')
                    ->value('shift_number');
                $nextNumber = $latest ? ((int) substr((string) $latest, strlen($prefix)) + 1) : 1;
                $shift->shift_number = sprintf('%s%03d', $prefix, $nextNumber);
            }
        });
    }

    public function getActivitylogOptions(): LogOptions
    {
        return LogOptions::defaults()
            ->useLogName(ActivityLogCategory::CashierShift->value)
            ->setDescriptionForEvent(fn (string $eventName): string => match ($eventName) {
                'created' => "Sesi Shift {$this->shift_number} berhasil dibuat.",
                'updated' => "Sesi Shift {$this->shift_number} diperbarui.",
                'deleted' => "Sesi Shift {$this->shift_number} dihapus.",
                'restored' => "Sesi Shift {$this->shift_number} dipulihkan.",
                default => "Sesi Shift {$this->shift_number} ({$eventName}).",
            })
            ->logOnly([
                'shift_number',
                'register_name',
                'status',
                'starting_cash',
                'expected_cash',
                'actual_cash',
                'cash_variance',
                'closing_notes',
                'verified_by',
            ])
            ->logOnlyDirty()
            ->dontLogEmptyChanges();
    }

    public function isOpen(): bool
    {
        return $this->status === CashierShiftStatus::Open;
    }

    /** @return BelongsTo<User, $this> */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class)->withTrashed();
    }

    /** @return BelongsTo<CashRegister, $this> */
    public function cashRegister(): BelongsTo
    {
        return $this->belongsTo(CashRegister::class)->withTrashed();
    }

    /** @return BelongsTo<User, $this> */
    public function verifier(): BelongsTo
    {
        return $this->belongsTo(User::class, 'verified_by')->withTrashed();
    }

    /** @return HasMany<ShiftCashMovement, $this> */
    public function cashMovements(): HasMany
    {
        return $this->hasMany(ShiftCashMovement::class)->latest('id');
    }

    /** @return HasMany<Transaction, $this> */
    public function transactions(): HasMany
    {
        return $this->hasMany(Transaction::class);
    }
}

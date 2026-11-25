<?php

namespace App\Models;

use App\Enums\ActivityLogCategory;
use App\Enums\PaymentStatus;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Table;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Spatie\Activitylog\Models\Concerns\LogsActivity;
use Spatie\Activitylog\Support\LogOptions;

#[Table('account_payables')]
#[Fillable([
    'payable_number',
    'purchase_order_id',
    'supplier_id',
    'invoice_number',
    'total_amount',
    'paid_amount',
    'remaining_amount',
    'due_date',
    'status',
    'notes',
])]
class AccountPayable extends Model
{
    use LogsActivity, SoftDeletes;

    /**
     * Logging dikelola oleh FinanceService agar terstruktur dan tidak ganda.
     *
     * @var array<int, string>
     */
    protected static array $recordEvents = [];

    protected function casts(): array
    {
        return [
            'total_amount' => 'decimal:2',
            'paid_amount' => 'decimal:2',
            'remaining_amount' => 'decimal:2',
            'due_date' => 'date',
            'status' => PaymentStatus::class,
        ];
    }

    protected static function booted(): void
    {
        static::creating(function (AccountPayable $payable): void {
            if (empty($payable->payable_number)) {
                $dateStr = now()->format('Ymd');
                $prefix = "AP-{$dateStr}-";
                $latest = static::withTrashed()
                    ->where('payable_number', 'like', "{$prefix}%")
                    ->orderByDesc('payable_number')
                    ->value('payable_number');
                $nextNumber = $latest ? ((int) substr($latest, strlen($prefix)) + 1) : 1;
                $payable->payable_number = sprintf('%s%04d', $prefix, $nextNumber);
            }
        });
    }

    public function getActivitylogOptions(): LogOptions
    {
        return LogOptions::defaults()
            ->useLogName(ActivityLogCategory::Finance->value)
            ->setDescriptionForEvent(fn (string $eventName): string => match ($eventName) {
                'created' => "Hutang Dagang {$this->payable_number} berhasil dibuat.",
                'updated' => "Hutang Dagang {$this->payable_number} diperbarui.",
                'deleted' => "Hutang Dagang {$this->payable_number} dihapus.",
                'restored' => "Hutang Dagang {$this->payable_number} dipulihkan.",
                default => "Hutang Dagang {$this->payable_number} ({$eventName}).",
            })
            ->logOnly(['payable_number', 'invoice_number', 'total_amount', 'paid_amount', 'remaining_amount', 'due_date', 'status'])
            ->logOnlyDirty()
            ->dontLogEmptyChanges();
    }

    public function isOverdue(): bool
    {
        return $this->status !== PaymentStatus::Paid
            && $this->due_date !== null
            && $this->due_date->isPast()
            && ! $this->due_date->isToday();
    }

    public function purchaseOrder(): BelongsTo
    {
        return $this->belongsTo(PurchaseOrder::class)->withTrashed();
    }

    public function supplier(): BelongsTo
    {
        return $this->belongsTo(Supplier::class)->withTrashed();
    }

    public function payments(): HasMany
    {
        return $this->hasMany(PayablePayment::class);
    }
}

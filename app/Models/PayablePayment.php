<?php

namespace App\Models;

use App\Enums\ActivityLogCategory;
use App\Enums\PaymentMethod;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Table;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\MorphMany;
use Spatie\Activitylog\Models\Concerns\LogsActivity;
use Spatie\Activitylog\Support\LogOptions;

#[Table('payable_payments')]
#[Fillable([
    'payment_number',
    'account_payable_id',
    'financial_account_id',
    'amount',
    'payment_date',
    'payment_method',
    'reference_number',
    'notes',
    'paid_by',
])]
class PayablePayment extends Model
{
    use LogsActivity;

    /**
     * Logging dikelola secara kontekstual oleh FinanceService.
     *
     * @var array<int, string>
     */
    protected static array $recordEvents = [];

    protected function casts(): array
    {
        return [
            'amount' => 'decimal:2',
            'payment_date' => 'date',
            'payment_method' => PaymentMethod::class,
        ];
    }

    protected static function booted(): void
    {
        static::creating(function (PayablePayment $payment): void {
            if (empty($payment->payment_number)) {
                $dateStr = now()->format('Ymd');
                $prefix = "PAY-{$dateStr}-";
                $latest = static::where('payment_number', 'like', "{$prefix}%")
                    ->orderByDesc('payment_number')
                    ->value('payment_number');
                $nextNumber = $latest ? ((int) substr($latest, strlen($prefix)) + 1) : 1;
                $payment->payment_number = sprintf('%s%04d', $prefix, $nextNumber);
            }
        });
    }

    public function getActivitylogOptions(): LogOptions
    {
        return LogOptions::defaults()
            ->useLogName(ActivityLogCategory::Finance->value)
            ->setDescriptionForEvent(fn (string $eventName): string => match ($eventName) {
                'created' => "Pembayaran Hutang {$this->payment_number} berhasil dicatat.",
                'updated' => "Pembayaran Hutang {$this->payment_number} diperbarui.",
                'deleted' => "Pembayaran Hutang {$this->payment_number} dihapus.",
                default => "Pembayaran Hutang {$this->payment_number} ({$eventName}).",
            })
            ->logOnly(['payment_number', 'amount', 'payment_date', 'payment_method', 'reference_number', 'notes'])
            ->logOnlyDirty()
            ->dontLogEmptyChanges();
    }

    public function accountPayable(): BelongsTo
    {
        return $this->belongsTo(AccountPayable::class);
    }

    public function financialAccount(): BelongsTo
    {
        return $this->belongsTo(FinancialAccount::class)->withTrashed();
    }

    public function paidBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'paid_by');
    }

    public function financialTransactions(): MorphMany
    {
        return $this->morphMany(FinancialTransaction::class, 'reference');
    }
}

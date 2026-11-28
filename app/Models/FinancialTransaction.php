<?php

namespace App\Models;

use App\Enums\FinancialTransactionType;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Table;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\MorphTo;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property string $transaction_number
 * @property int $financial_account_id
 * @property int $financial_category_id
 * @property FinancialTransactionType $type
 * @property string $amount
 * @property string $balance_before
 * @property string $balance_after
 * @property Carbon $transaction_date
 * @property string|null $reference_type
 * @property int|null $reference_id
 * @property string|null $reference_number
 * @property string $description
 * @property int|null $created_by
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 */
#[Table('financial_transactions')]
#[Fillable([
    'transaction_number',
    'financial_account_id',
    'financial_category_id',
    'type',
    'amount',
    'balance_before',
    'balance_after',
    'transaction_date',
    'reference_type',
    'reference_id',
    'reference_number',
    'description',
    'created_by',
])]
class FinancialTransaction extends Model
{
    protected function casts(): array
    {
        return [
            'type' => FinancialTransactionType::class,
            'amount' => 'decimal:2',
            'balance_before' => 'decimal:2',
            'balance_after' => 'decimal:2',
            'transaction_date' => 'date',
        ];
    }

    protected static function booted(): void
    {
        static::creating(function (FinancialTransaction $transaction): void {
            if (empty($transaction->transaction_number)) {
                $dateStr = now()->format('Ymd');
                $prefix = "FIN-{$dateStr}-";
                $latest = static::where('transaction_number', 'like', "{$prefix}%")
                    ->orderByDesc('transaction_number')
                    ->value('transaction_number');
                $nextNumber = $latest ? ((int) substr($latest, strlen($prefix)) + 1) : 1;
                $transaction->transaction_number = sprintf('%s%04d', $prefix, $nextNumber);
            }
        });
    }

    public function isManual(): bool
    {
        return $this->reference_type === null;
    }

    /**
     * @return array{code: string, label: string}
     */
    public function resolveSource(): array
    {
        return match ($this->reference_type) {
            null => ['code' => 'manual', 'label' => 'Manual'],
            Transaction::class => ['code' => 'pos', 'label' => 'POS'],
            SalesReturn::class => ['code' => 'return', 'label' => 'Retur POS'],
            PayablePayment::class => ['code' => 'payable', 'label' => 'PO / Hutang'],
            CashierShift::class, ShiftCashMovement::class => ['code' => 'shift', 'label' => 'Shift'],
            default => ['code' => 'system', 'label' => 'Sistem'],
        };
    }

    /** @return BelongsTo<FinancialAccount, $this> */
    public function financialAccount(): BelongsTo
    {
        return $this->belongsTo(FinancialAccount::class)->withTrashed();
    }

    /** @return BelongsTo<FinancialCategory, $this> */
    public function financialCategory(): BelongsTo
    {
        return $this->belongsTo(FinancialCategory::class)->withTrashed();
    }

    /** @return MorphTo<Model, $this> */
    public function reference(): MorphTo
    {
        return $this->morphTo();
    }

    /** @return BelongsTo<User, $this> */
    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by')->withTrashed();
    }
}

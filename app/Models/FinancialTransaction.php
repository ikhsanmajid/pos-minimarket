<?php

namespace App\Models;

use App\Enums\FinancialTransactionType;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Table;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\MorphTo;

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

    public function financialAccount(): BelongsTo
    {
        return $this->belongsTo(FinancialAccount::class)->withTrashed();
    }

    public function financialCategory(): BelongsTo
    {
        return $this->belongsTo(FinancialCategory::class)->withTrashed();
    }

    public function reference(): MorphTo
    {
        return $this->morphTo();
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}

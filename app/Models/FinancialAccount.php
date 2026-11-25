<?php

namespace App\Models;

use App\Enums\ActivityLogCategory;
use App\Enums\FinancialAccountType;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Table;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Spatie\Activitylog\Models\Concerns\LogsActivity;
use Spatie\Activitylog\Support\LogOptions;

#[Table('financial_accounts')]
#[Fillable([
    'code',
    'name',
    'type',
    'account_number',
    'bank_name',
    'opening_balance',
    'current_balance',
    'is_default',
    'is_active',
    'notes',
])]
class FinancialAccount extends Model
{
    use LogsActivity, SoftDeletes;

    protected function casts(): array
    {
        return [
            'type' => FinancialAccountType::class,
            'opening_balance' => 'decimal:2',
            'current_balance' => 'decimal:2',
            'is_default' => 'boolean',
            'is_active' => 'boolean',
        ];
    }

    protected static function booted(): void
    {
        static::creating(function (FinancialAccount $account): void {
            if (empty($account->code)) {
                $prefix = match ($account->type) {
                    FinancialAccountType::Bank => 'BNK',
                    FinancialAccountType::Ewallet => 'EWL',
                    default => 'KAS',
                };
                $latestId = static::withTrashed()->max('id') ?? 0;
                $account->code = sprintf('%s-%03d', $prefix, $latestId + 1);
            }
        });
    }

    public function getActivitylogOptions(): LogOptions
    {
        return LogOptions::defaults()
            ->useLogName(ActivityLogCategory::Finance->value)
            ->setDescriptionForEvent(fn (string $eventName): string => match ($eventName) {
                'created' => "Akun Keuangan {$this->name} berhasil dibuat.",
                'updated' => "Akun Keuangan {$this->name} diperbarui.",
                'deleted' => "Akun Keuangan {$this->name} dihapus.",
                'restored' => "Akun Keuangan {$this->name} dipulihkan.",
                default => "Akun Keuangan {$this->name} ({$eventName}).",
            })
            ->logOnly([
                'code',
                'name',
                'type',
                'account_number',
                'bank_name',
                'opening_balance',
                'is_default',
                'is_active',
                'notes',
            ])
            ->logOnlyDirty()
            ->dontLogEmptyChanges();
    }

    public function transactions(): HasMany
    {
        return $this->hasMany(FinancialTransaction::class);
    }

    public function payablePayments(): HasMany
    {
        return $this->hasMany(PayablePayment::class);
    }
}

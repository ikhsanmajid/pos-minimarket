<?php

namespace App\Models;

use App\Enums\ActivityLogCategory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Table;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Spatie\Activitylog\Models\Concerns\LogsActivity;
use Spatie\Activitylog\Support\LogOptions;

#[Table('suppliers')]
#[Fillable([
    'code',
    'name',
    'contact_person',
    'phone',
    'email',
    'address',
    'city',
    'npwp',
    'payment_term_days',
    'bank_name',
    'bank_account_number',
    'bank_account_name',
    'is_active',
    'notes',
])]
class Supplier extends Model
{
    use LogsActivity, SoftDeletes;

    protected function casts(): array
    {
        return [
            'is_active' => 'boolean',
            'payment_term_days' => 'integer',
        ];
    }

    protected static function booted(): void
    {
        static::creating(function (Supplier $supplier): void {
            if (empty($supplier->code)) {
                $latestId = static::withTrashed()->max('id') ?? 0;
                $supplier->code = sprintf('SUP-%04d', $latestId + 1);
            }
        });
    }

    public function getActivitylogOptions(): LogOptions
    {
        return LogOptions::defaults()
            ->useLogName(ActivityLogCategory::Supplier->value)
            ->setDescriptionForEvent(fn (string $eventName): string => match ($eventName) {
                'created' => "Supplier {$this->name} berhasil dibuat.",
                'updated' => "Supplier {$this->name} diperbarui.",
                'deleted' => "Supplier {$this->name} dihapus.",
                'restored' => "Supplier {$this->name} dipulihkan.",
                default => "Supplier {$this->name} ({$eventName}).",
            })
            ->logOnly([
                'code',
                'name',
                'contact_person',
                'phone',
                'email',
                'address',
                'city',
                'npwp',
                'payment_term_days',
                'bank_name',
                'bank_account_number',
                'bank_account_name',
                'is_active',
                'notes',
            ])
            ->logOnlyDirty()
            ->dontLogEmptyChanges();
    }

    public function purchaseOrders(): HasMany
    {
        return $this->hasMany(PurchaseOrder::class);
    }

    public function accountPayables(): HasMany
    {
        return $this->hasMany(AccountPayable::class);
    }
}

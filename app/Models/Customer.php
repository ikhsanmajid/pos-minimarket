<?php

namespace App\Models;

use App\Enums\ActivityLogCategory;
use App\Enums\CustomerTier;
use Database\Factories\CustomerFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Table;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Carbon;
use Spatie\Activitylog\Models\Concerns\LogsActivity;
use Spatie\Activitylog\Support\LogOptions;

/**
 * @property int $id
 * @property string $member_code
 * @property string $name
 * @property string|null $phone
 * @property string|null $email
 * @property string|null $address
 * @property int $points
 * @property CustomerTier $tier
 * @property Carbon|null $birth_date
 * @property bool $is_active
 * @property string|null $notes
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 * @property Carbon|null $deleted_at
 */
#[Table('customers')]
#[Fillable([
    'member_code',
    'name',
    'phone',
    'email',
    'address',
    'points',
    'tier',
    'birth_date',
    'is_active',
    'notes',
])]
class Customer extends Model
{
    /** @use HasFactory<CustomerFactory> */
    use HasFactory, LogsActivity, SoftDeletes;

    protected $attributes = [
        'points' => 0,
        'tier' => 'silver',
        'is_active' => true,
    ];

    protected function casts(): array
    {
        return [
            'points' => 'integer',
            'tier' => CustomerTier::class,
            'birth_date' => 'date',
            'is_active' => 'boolean',
        ];
    }

    public function getActivitylogOptions(): LogOptions
    {
        return LogOptions::defaults()
            ->useLogName(ActivityLogCategory::Customer->value)
            ->setDescriptionForEvent(fn (string $eventName): string => match ($eventName) {
                'created' => "Pelanggan {$this->name} ({$this->member_code}) berhasil dibuat.",
                'updated' => "Pelanggan {$this->name} ({$this->member_code}) diperbarui.",
                'deleted' => "Pelanggan {$this->name} ({$this->member_code}) dihapus.",
                'restored' => "Pelanggan {$this->name} ({$this->member_code}) dipulihkan.",
                default => "Pelanggan {$this->name} ({$eventName}).",
            })
            ->logOnly([
                'member_code',
                'name',
                'phone',
                'email',
                'address',
                'points',
                'tier',
                'birth_date',
                'is_active',
                'notes',
            ])
            ->logOnlyDirty()
            ->dontLogEmptyChanges();
    }

    /**
     * @param  Builder<Customer>  $query
     * @return Builder<Customer>
     */
    public function scopeActive(Builder $query): Builder
    {
        return $query->where('is_active', true);
    }

    /** @return HasMany<Transaction, $this> */
    public function transactions(): HasMany
    {
        return $this->hasMany(Transaction::class);
    }

    /** @return HasMany<CustomerPointLedger, $this> */
    public function pointLedgers(): HasMany
    {
        return $this->hasMany(CustomerPointLedger::class);
    }

    public function effectiveTier(): CustomerTier
    {
        return $this->tier instanceof CustomerTier
            ? $this->tier
            : CustomerTier::Silver;
    }
}

<?php

namespace App\Models;

use App\Enums\ActivityLogCategory;
use App\Enums\FinancialCategoryType;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Table;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Carbon;
use Spatie\Activitylog\Models\Concerns\LogsActivity;
use Spatie\Activitylog\Support\LogOptions;

/**
 * @property int $id
 * @property string $code
 * @property string $name
 * @property FinancialCategoryType $type
 * @property bool $is_system
 * @property bool $is_active
 * @property string|null $description
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 * @property Carbon|null $deleted_at
 */
#[Table('financial_categories')]
#[Fillable([
    'code',
    'name',
    'type',
    'is_system',
    'is_active',
    'description',
])]
class FinancialCategory extends Model
{
    use LogsActivity, SoftDeletes;

    protected function casts(): array
    {
        return [
            'type' => FinancialCategoryType::class,
            'is_system' => 'boolean',
            'is_active' => 'boolean',
        ];
    }

    public function getActivitylogOptions(): LogOptions
    {
        return LogOptions::defaults()
            ->useLogName(ActivityLogCategory::Finance->value)
            ->setDescriptionForEvent(fn (string $eventName): string => match ($eventName) {
                'created' => "Kategori Keuangan {$this->name} ({$this->code}) berhasil dibuat.",
                'updated' => "Kategori Keuangan {$this->name} ({$this->code}) diperbarui.",
                'deleted' => "Kategori Keuangan {$this->name} ({$this->code}) dihapus.",
                'restored' => "Kategori Keuangan {$this->name} ({$this->code}) dipulihkan.",
                default => "Kategori Keuangan {$this->name} ({$eventName}).",
            })
            ->logOnly([
                'code',
                'name',
                'type',
                'is_system',
                'is_active',
                'description',
            ])
            ->logOnlyDirty()
            ->dontLogEmptyChanges();
    }

    /**
     * @param  Builder<FinancialCategory>  $query
     * @return Builder<FinancialCategory>
     */
    public function scopeActive(Builder $query): Builder
    {
        return $query->where('is_active', true);
    }

    /** @return HasMany<FinancialTransaction, $this> */
    public function transactions(): HasMany
    {
        return $this->hasMany(FinancialTransaction::class);
    }
}

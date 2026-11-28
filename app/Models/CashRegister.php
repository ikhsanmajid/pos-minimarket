<?php

namespace App\Models;

use App\Enums\ActivityLogCategory;
use App\Enums\CashierShiftStatus;
use Database\Factories\CashRegisterFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Table;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Database\Eloquent\SoftDeletes;
use Spatie\Activitylog\Models\Concerns\LogsActivity;
use Spatie\Activitylog\Support\LogOptions;

/**
 * @property int $id
 * @property string $code
 * @property string $name
 * @property string|null $location
 * @property string|null $description
 * @property bool $is_active
 */
#[Table('cash_registers')]
#[Fillable([
    'code',
    'name',
    'location',
    'description',
    'is_active',
])]
class CashRegister extends Model
{
    /** @use HasFactory<CashRegisterFactory> */
    use HasFactory, LogsActivity, SoftDeletes;

    protected function casts(): array
    {
        return [
            'is_active' => 'boolean',
        ];
    }

    public function getActivitylogOptions(): LogOptions
    {
        return LogOptions::defaults()
            ->useLogName(ActivityLogCategory::CashRegister->value)
            ->setDescriptionForEvent(fn (string $eventName): string => match ($eventName) {
                'created' => "Kasir Fisik {$this->name} ({$this->code}) berhasil dibuat.",
                'updated' => "Kasir Fisik {$this->name} ({$this->code}) diperbarui.",
                'deleted' => "Kasir Fisik {$this->name} ({$this->code}) dihapus.",
                'restored' => "Kasir Fisik {$this->name} ({$this->code}) dipulihkan.",
                default => "Kasir Fisik {$this->name} ({$eventName}).",
            })
            ->logOnly([
                'code',
                'name',
                'location',
                'description',
                'is_active',
            ])
            ->logOnlyDirty()
            ->dontLogEmptyChanges();
    }

    /** @return HasMany<CashierShift, $this> */
    public function shifts(): HasMany
    {
        return $this->hasMany(CashierShift::class);
    }

    /** @return HasOne<CashierShift, $this> */
    public function activeShift(): HasOne
    {
        return $this->hasOne(CashierShift::class)
            ->where('status', CashierShiftStatus::Open->value)
            ->latestOfMany('opened_at');
    }
}

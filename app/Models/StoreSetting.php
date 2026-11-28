<?php

namespace App\Models;

use App\Enums\ActivityLogCategory;
use App\Enums\RoundingMode;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Carbon;
use Spatie\Activitylog\Models\Concerns\LogsActivity;
use Spatie\Activitylog\Support\LogOptions;

/**
 * @property int $id
 * @property string $store_name
 * @property string|null $store_address
 * @property string|null $store_phone
 * @property string|null $store_logo
 * @property string|null $receipt_header
 * @property string|null $receipt_footer
 * @property numeric-string $default_tax_rate
 * @property RoundingMode $rounding_mode
 * @property numeric-string $shift_variance_tolerance
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 */
class StoreSetting extends Model
{
    use LogsActivity;

    protected $table = 'store_settings';

    /**
     * @var list<string>
     */
    protected $fillable = [
        'store_name',
        'store_address',
        'store_phone',
        'store_logo',
        'receipt_header',
        'receipt_footer',
        'default_tax_rate',
        'rounding_mode',
        'shift_variance_tolerance',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'default_tax_rate' => 'decimal:2',
            'rounding_mode' => RoundingMode::class,
            'shift_variance_tolerance' => 'decimal:2',
        ];
    }

    public function getActivitylogOptions(): LogOptions
    {
        return LogOptions::defaults()
            ->useLogName(ActivityLogCategory::StoreSetting->value)
            ->setDescriptionForEvent(fn (string $eventName): string => match ($eventName) {
                'created' => "Pengaturan Toko {$this->store_name} berhasil dibuat.",
                'updated' => "Pengaturan Toko {$this->store_name} diperbarui.",
                'deleted' => "Pengaturan Toko {$this->store_name} dihapus.",
                'restored' => "Pengaturan Toko {$this->store_name} dipulihkan.",
                default => "Pengaturan Toko {$this->store_name} ({$eventName}).",
            })
            ->logOnly([
                'store_name',
                'store_address',
                'store_phone',
                'store_logo',
                'receipt_header',
                'receipt_footer',
                'default_tax_rate',
                'rounding_mode',
                'shift_variance_tolerance',
            ])
            ->logOnlyDirty()
            ->dontLogEmptyChanges();
    }

    public function getLogoUrlAttribute(): ?string
    {
        if (empty($this->store_logo)) {
            return null;
        }

        return asset('storage/'.$this->store_logo);
    }
}

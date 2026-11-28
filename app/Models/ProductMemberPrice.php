<?php

namespace App\Models;

use App\Enums\ActivityLogCategory;
use App\Enums\CustomerTier;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Table;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;
use Spatie\Activitylog\Models\Concerns\LogsActivity;
use Spatie\Activitylog\Support\LogOptions;

/**
 * @property int $id
 * @property int $product_id
 * @property int|null $product_unit_id
 * @property CustomerTier|null $tier
 * @property string $member_price
 * @property bool $is_active
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 */
#[Table('product_member_prices')]
#[Fillable([
    'product_id',
    'product_unit_id',
    'tier',
    'member_price',
    'is_active',
])]
class ProductMemberPrice extends Model
{
    use LogsActivity;

    protected $attributes = [
        'is_active' => true,
    ];

    protected function casts(): array
    {
        return [
            'tier' => CustomerTier::class,
            'member_price' => 'decimal:2',
            'is_active' => 'boolean',
        ];
    }

    public function getActivitylogOptions(): LogOptions
    {
        return LogOptions::defaults()
            ->useLogName(ActivityLogCategory::Promotion->value)
            ->setDescriptionForEvent(function (string $eventName): string {
                $productName = $this->product?->name ?? "Produk #{$this->product_id}";
                $tierLabel = $this->tier instanceof CustomerTier ? $this->tier->label() : 'Semua Member';
                $unitLabel = $this->productUnit?->unit_name ?? ($this->product?->base_unit ?: 'pcs');

                return match ($eventName) {
                    'created' => "Harga member {$productName} ({$tierLabel} / {$unitLabel}) berhasil dibuat.",
                    'updated' => "Harga member {$productName} ({$tierLabel} / {$unitLabel}) diperbarui.",
                    'deleted' => "Harga member {$productName} ({$tierLabel} / {$unitLabel}) dihapus.",
                    default => "Harga member {$productName} ({$eventName}).",
                };
            })
            ->logOnly(['product_id', 'product_unit_id', 'tier', 'member_price', 'is_active'])
            ->logOnlyDirty()
            ->dontLogEmptyChanges();
    }

    /** @return BelongsTo<Product, $this> */
    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    /** @return BelongsTo<ProductUnit, $this> */
    public function productUnit(): BelongsTo
    {
        return $this->belongsTo(ProductUnit::class);
    }
}

<?php

namespace App\Models;

use App\Enums\ActivityLogCategory;
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
 * @property int $min_qty
 * @property string $unit_price
 * @property bool $is_active
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 */
#[Table('product_price_tiers')]
#[Fillable([
    'product_id',
    'product_unit_id',
    'min_qty',
    'unit_price',
    'is_active',
])]
class ProductPriceTier extends Model
{
    use LogsActivity;

    protected function casts(): array
    {
        return [
            'min_qty' => 'integer',
            'unit_price' => 'decimal:2',
            'is_active' => 'boolean',
        ];
    }

    public function getActivitylogOptions(): LogOptions
    {
        return LogOptions::defaults()
            ->useLogName(ActivityLogCategory::Promotion->value)
            ->setDescriptionForEvent(function (string $eventName): string {
                $productName = $this->product?->name ?? "Produk #{$this->product_id}";
                $unitLabel = $this->productUnit?->unit_name ?? ($this->product?->base_unit ?: 'pcs');

                return match ($eventName) {
                    'created' => "Harga grosir {$productName} (min. {$this->min_qty} {$unitLabel}) berhasil dibuat.",
                    'updated' => "Harga grosir {$productName} (min. {$this->min_qty} {$unitLabel}) diperbarui.",
                    'deleted' => "Harga grosir {$productName} (min. {$this->min_qty} {$unitLabel}) dihapus.",
                    default => "Harga grosir {$productName} ({$eventName}).",
                };
            })
            ->logOnly(['product_id', 'product_unit_id', 'min_qty', 'unit_price', 'is_active'])
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

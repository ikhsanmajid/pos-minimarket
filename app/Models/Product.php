<?php

namespace App\Models;

use App\Enums\ActivityLogCategory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Table;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Spatie\Activitylog\Contracts\Activity;
use Spatie\Activitylog\Models\Concerns\LogsActivity;
use Spatie\Activitylog\Support\LogOptions;

#[Table('products')]
#[Fillable([
    'category_id',
    'barcode',
    'name',
    'base_unit',
    'buy_price',
    'sell_price',
    'stock',
    'min_stock',
    'image',
    'active',
    'is_tax_exempt',
    'is_donation',
])]
class Product extends Model
{
    use LogsActivity, SoftDeletes;

    protected $attributes = [
        'base_unit' => 'pcs',
        'is_tax_exempt' => false,
        'is_donation' => false,
    ];

    protected function casts(): array
    {
        return [
            'active' => 'boolean',
            'is_tax_exempt' => 'boolean',
            'is_donation' => 'boolean',
            'buy_price' => 'decimal:2',
            'sell_price' => 'decimal:2',
            'stock' => 'integer',
            'min_stock' => 'integer',
        ];
    }

    public function getActivitylogOptions(): LogOptions
    {
        return LogOptions::defaults()
            ->useLogName(ActivityLogCategory::Product->value)
            ->setDescriptionForEvent(fn (string $eventName): string => match ($eventName) {
                'created' => "Produk {$this->name} berhasil dibuat.",
                'updated' => "Produk {$this->name} diperbarui.",
                'deleted' => "Produk {$this->name} dihapus.",
                'restored' => "Produk {$this->name} dipulihkan.",
                default => "Produk {$this->name} ({$eventName}).",
            })
            ->logOnly(['category_id', 'barcode', 'name', 'base_unit', 'buy_price', 'sell_price', 'min_stock', 'image', 'active', 'is_tax_exempt', 'is_donation'])
            ->logOnlyDirty()
            ->dontLogEmptyChanges();
    }

    public function tapActivity(Activity $activity, string $eventName): void
    {
        if ($this->category_id) {
            $activity->properties = $activity->properties->merge([
                'category_name' => $this->category?->name,
            ]);
        }
    }

    public function category(): BelongsTo
    {
        return $this->belongsTo(Category::class);
    }

    /** @return HasMany<ProductUnit, $this> */
    public function units(): HasMany
    {
        return $this->hasMany(ProductUnit::class)->orderBy('conversion_factor');
    }

    public function activeUnits(): HasMany
    {
        return $this->hasMany(ProductUnit::class)
            ->where('is_active', true)
            ->orderByDesc('is_default_purchase')
            ->orderBy('conversion_factor');
    }

    public function stockMovements(): HasMany
    {
        return $this->hasMany(StockMovement::class);
    }

    public function transactionDetails(): HasMany
    {
        return $this->hasMany(TransactionDetail::class);
    }

    public function purchaseOrderItems(): HasMany
    {
        return $this->hasMany(PurchaseOrderItem::class);
    }
}

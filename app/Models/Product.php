<?php

namespace App\Models;

use App\Enums\ActivityLogCategory;
use App\Enums\ProductTaxMode;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Table;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
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
    'tax_mode',
    'is_donation',
    'is_promo_excluded',
])]
class Product extends Model
{
    use LogsActivity, SoftDeletes;

    protected $attributes = [
        'base_unit' => 'pcs',
        'is_tax_exempt' => false,
        'tax_mode' => 'exclusive',
        'is_donation' => false,
        'is_promo_excluded' => false,
    ];

    protected function casts(): array
    {
        return [
            'active' => 'boolean',
            'is_tax_exempt' => 'boolean',
            'tax_mode' => ProductTaxMode::class,
            'is_donation' => 'boolean',
            'is_promo_excluded' => 'boolean',
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
            ->logOnly(['category_id', 'barcode', 'name', 'base_unit', 'buy_price', 'sell_price', 'min_stock', 'image', 'active', 'is_tax_exempt', 'tax_mode', 'is_donation', 'is_promo_excluded'])
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

    /** @return HasMany<PurchaseOrderReceiptItem, $this> */
    public function purchaseOrderReceiptItems(): HasMany
    {
        return $this->hasMany(PurchaseOrderReceiptItem::class);
    }

    /** @return HasMany<ProductPriceTier, $this> */
    public function priceTiers(): HasMany
    {
        return $this->hasMany(ProductPriceTier::class)
            ->orderByRaw('CASE WHEN product_unit_id IS NULL THEN 0 ELSE 1 END')
            ->orderBy('product_unit_id')
            ->orderBy('min_qty');
    }

    /** @return HasMany<ProductPriceTier, $this> */
    public function activePriceTiers(): HasMany
    {
        return $this->hasMany(ProductPriceTier::class)
            ->where('is_active', true)
            ->orderBy('min_qty');
    }

    /** @return HasMany<ProductMemberPrice, $this> */
    public function memberPrices(): HasMany
    {
        return $this->hasMany(ProductMemberPrice::class)
            ->orderByRaw('CASE WHEN product_unit_id IS NULL THEN 0 ELSE 1 END')
            ->orderBy('product_unit_id')
            ->orderByRaw('CASE WHEN tier IS NULL THEN 0 ELSE 1 END')
            ->orderBy('tier');
    }

    /** @return HasMany<ProductMemberPrice, $this> */
    public function activeMemberPrices(): HasMany
    {
        return $this->hasMany(ProductMemberPrice::class)
            ->where('is_active', true);
    }

    /** @return BelongsToMany<Promotion, $this> */
    public function promotions(): BelongsToMany
    {
        return $this->belongsToMany(Promotion::class, 'promotion_products');
    }

    public function effectiveTaxMode(): ProductTaxMode
    {
        if ($this->is_donation || $this->is_tax_exempt) {
            return ProductTaxMode::Exempt;
        }

        return $this->tax_mode instanceof ProductTaxMode
            ? $this->tax_mode
            : ProductTaxMode::Exclusive;
    }

    public function isExcludedFromPromotions(): bool
    {
        if ($this->is_donation || $this->is_promo_excluded) {
            return true;
        }

        return $this->category?->isExcludedFromPromotions() ?? false;
    }
}

<?php

namespace App\Models;

use App\Enums\ActivityLogCategory;
use App\Enums\PromotionFunding;
use App\Enums\PromotionScope;
use App\Enums\PromotionType;
use Carbon\CarbonInterface;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Table;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Carbon;
use Spatie\Activitylog\Models\Concerns\LogsActivity;
use Spatie\Activitylog\Support\LogOptions;

/**
 * @property int $id
 * @property string|null $code
 * @property string $name
 * @property PromotionType $type
 * @property PromotionScope $scope
 * @property PromotionFunding $funding
 * @property string|null $discount_value
 * @property string|null $max_discount_amount
 * @property string $min_purchase_amount
 * @property int|null $buy_qty
 * @property int|null $get_qty
 * @property string $get_discount_percent
 * @property string|null $bundle_price
 * @property int|null $nth_item
 * @property int|null $reward_product_id
 * @property string|null $special_price
 * @property string|null $payment_method
 * @property string|null $payment_bin_prefix
 * @property int|null $near_expiry_days
 * @property Carbon $starts_at
 * @property Carbon $ends_at
 * @property int $days_mask
 * @property string|null $time_start
 * @property string|null $time_end
 * @property int|null $quota_total
 * @property int $quota_used
 * @property int|null $max_qty_per_transaction
 * @property int|null $max_qty_per_customer_per_day
 * @property bool $stackable
 * @property string|null $exclusive_group
 * @property int $priority
 * @property bool $member_only
 * @property bool $is_active
 * @property int|null $created_by
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 */
#[Table('promotions')]
#[Fillable([
    'code',
    'name',
    'type',
    'scope',
    'funding',
    'discount_value',
    'max_discount_amount',
    'min_purchase_amount',
    'buy_qty',
    'get_qty',
    'get_discount_percent',
    'bundle_price',
    'nth_item',
    'reward_product_id',
    'special_price',
    'payment_method',
    'payment_bin_prefix',
    'near_expiry_days',
    'starts_at',
    'ends_at',
    'days_mask',
    'time_start',
    'time_end',
    'quota_total',
    'quota_used',
    'max_qty_per_transaction',
    'max_qty_per_customer_per_day',
    'stackable',
    'exclusive_group',
    'priority',
    'member_only',
    'is_active',
    'created_by',
])]
class Promotion extends Model
{
    use LogsActivity;

    protected $attributes = [
        'scope' => 'all_products',
        'funding' => 'store',
        'min_purchase_amount' => 0,
        'get_discount_percent' => 100,
        'days_mask' => 127,
        'quota_used' => 0,
        'stackable' => false,
        'priority' => 0,
        'member_only' => false,
        'is_active' => true,
    ];

    protected function casts(): array
    {
        return [
            'type' => PromotionType::class,
            'scope' => PromotionScope::class,
            'funding' => PromotionFunding::class,
            'discount_value' => 'decimal:2',
            'max_discount_amount' => 'decimal:2',
            'min_purchase_amount' => 'decimal:2',
            'buy_qty' => 'integer',
            'get_qty' => 'integer',
            'get_discount_percent' => 'decimal:2',
            'bundle_price' => 'decimal:2',
            'nth_item' => 'integer',
            'special_price' => 'decimal:2',
            'near_expiry_days' => 'integer',
            'starts_at' => 'datetime',
            'ends_at' => 'datetime',
            'days_mask' => 'integer',
            'quota_total' => 'integer',
            'quota_used' => 'integer',
            'max_qty_per_transaction' => 'integer',
            'max_qty_per_customer_per_day' => 'integer',
            'stackable' => 'boolean',
            'priority' => 'integer',
            'member_only' => 'boolean',
            'is_active' => 'boolean',
        ];
    }

    public function getActivitylogOptions(): LogOptions
    {
        return LogOptions::defaults()
            ->useLogName(ActivityLogCategory::Promotion->value)
            ->setDescriptionForEvent(fn (string $eventName): string => match ($eventName) {
                'created' => "Promo {$this->name} berhasil dibuat.",
                'updated' => "Promo {$this->name} diperbarui.",
                'deleted' => "Promo {$this->name} dihapus.",
                default => "Promo {$this->name} ({$eventName}).",
            })
            ->logOnly([
                'code',
                'name',
                'type',
                'scope',
                'funding',
                'discount_value',
                'max_discount_amount',
                'min_purchase_amount',
                'buy_qty',
                'get_qty',
                'get_discount_percent',
                'bundle_price',
                'nth_item',
                'reward_product_id',
                'special_price',
                'payment_method',
                'payment_bin_prefix',
                'near_expiry_days',
                'starts_at',
                'ends_at',
                'days_mask',
                'time_start',
                'time_end',
                'quota_total',
                'max_qty_per_transaction',
                'max_qty_per_customer_per_day',
                'stackable',
                'exclusive_group',
                'priority',
                'member_only',
                'is_active',
            ])
            ->logOnlyDirty()
            ->dontLogEmptyChanges();
    }

    /**
     * Status komputasi promo berdasarkan flag aktif dan rentang waktu.
     */
    public function computedStatus(?CarbonInterface $at = null): string
    {
        $now = $at ?? now();

        if (! $this->is_active) {
            return 'inactive';
        }

        if ($this->starts_at->gt($now)) {
            return 'scheduled';
        }

        if ($this->ends_at->lt($now)) {
            return 'expired';
        }

        return 'active';
    }

    /**
     * Memeriksa apakah promo berlaku pada hari & jam (WIB) dari timestamp acuan.
     */
    public function isWithinSchedule(CarbonInterface $at): bool
    {
        if (! $this->is_active) {
            return false;
        }

        if ($at->lt($this->starts_at) || $at->gt($this->ends_at)) {
            return false;
        }

        $tz = (string) config('pos_promotions.timezone', 'Asia/Jakarta');
        $localTime = $at->copy()->timezone($tz);

        // isoWeekday: 1 = Senin ... 7 = Minggu -> bit 0..6
        $dayBit = 1 << ($localTime->dayOfWeekIso - 1);
        $mask = (int) ($this->days_mask ?? 127);

        if (($mask & $dayBit) === 0) {
            return false;
        }

        if ($this->time_start !== null && $this->time_end !== null) {
            $currentHms = $localTime->format('H:i:s');
            $startHms = strlen($this->time_start) === 5 ? "{$this->time_start}:00" : $this->time_start;
            $endHms = strlen($this->time_end) === 5 ? "{$this->time_end}:59" : $this->time_end;

            if ($startHms <= $endHms) {
                if ($currentHms < $startHms || $currentHms > $endHms) {
                    return false;
                }
            } else {
                // Rentang lintas tengah malam (mis. 22:00 - 02:00)
                if ($currentHms < $startHms && $currentHms > $endHms) {
                    return false;
                }
            }
        }

        return true;
    }

    public function remainingQuota(): ?int
    {
        if ($this->quota_total === null) {
            return null;
        }

        return max(0, (int) $this->quota_total - (int) $this->quota_used);
    }

    /**
     * @param  Builder<Promotion>  $query
     * @return Builder<Promotion>
     */
    public function scopeCurrentlyActive(Builder $query, ?CarbonInterface $at = null): Builder
    {
        $now = $at ?? now();

        return $query
            ->where('is_active', true)
            ->where('starts_at', '<=', $now)
            ->where('ends_at', '>=', $now);
    }

    /** @return BelongsToMany<Product, $this> */
    public function products(): BelongsToMany
    {
        return $this->belongsToMany(Product::class, 'promotion_products');
    }

    /** @return BelongsToMany<Category, $this> */
    public function categories(): BelongsToMany
    {
        return $this->belongsToMany(Category::class, 'promotion_categories');
    }

    /** @return BelongsTo<Product, $this> */
    public function rewardProduct(): BelongsTo
    {
        return $this->belongsTo(Product::class, 'reward_product_id');
    }

    /** @return BelongsTo<User, $this> */
    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by')->withTrashed();
    }

    /** @return HasMany<AppliedPromotion, $this> */
    public function appliedPromotions(): HasMany
    {
        return $this->hasMany(AppliedPromotion::class);
    }

    /** @return HasMany<PromotionBundleItem, $this> */
    public function bundleItems(): HasMany
    {
        return $this->hasMany(PromotionBundleItem::class)->orderBy('id');
    }

    /** @return HasMany<PromotionDailyUsage, $this> */
    public function dailyUsages(): HasMany
    {
        return $this->hasMany(PromotionDailyUsage::class);
    }
}

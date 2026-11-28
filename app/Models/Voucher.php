<?php

namespace App\Models;

use App\Enums\ActivityLogCategory;
use App\Enums\PromotionFunding;
use App\Enums\VoucherStatus;
use App\Enums\VoucherType;
use Carbon\CarbonInterface;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Table;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Spatie\Activitylog\Models\Concerns\LogsActivity;
use Spatie\Activitylog\Support\LogOptions;

/**
 * @property int $id
 * @property string $code
 * @property string $name
 * @property VoucherType $type
 * @property string $value
 * @property string|null $max_discount
 * @property string $min_spend
 * @property CarbonInterface $valid_from
 * @property CarbonInterface $valid_until
 * @property int $allowed_days
 * @property string|null $allowed_hours_start
 * @property string|null $allowed_hours_end
 * @property int|null $total_quota
 * @property int $used_count
 * @property int|null $per_customer_limit
 * @property int|null $per_day_limit
 * @property array<int, int|string>|null $store_ids
 * @property string $channel
 * @property bool $member_only
 * @property array<int, string>|null $member_tiers
 * @property array<int, string|int>|null $applicable_skus
 * @property array<int, int|string>|null $applicable_categories
 * @property array<int, string|int>|null $excluded_skus
 * @property array<int, int|string>|null $excluded_categories
 * @property int|null $free_product_id
 * @property bool $stackable_with_promo
 * @property bool $stackable_with_voucher
 * @property PromotionFunding $funding
 * @property VoucherStatus $status
 * @property int|null $created_by
 * @property CarbonInterface|null $created_at
 * @property CarbonInterface|null $updated_at
 */
#[Table('vouchers')]
#[Fillable([
    'code',
    'name',
    'type',
    'value',
    'max_discount',
    'min_spend',
    'valid_from',
    'valid_until',
    'allowed_days',
    'allowed_hours_start',
    'allowed_hours_end',
    'total_quota',
    'used_count',
    'per_customer_limit',
    'per_day_limit',
    'store_ids',
    'channel',
    'member_only',
    'member_tiers',
    'applicable_skus',
    'applicable_categories',
    'excluded_skus',
    'excluded_categories',
    'free_product_id',
    'stackable_with_promo',
    'stackable_with_voucher',
    'funding',
    'supplier_id',
    'store_share_percent',
    'supplier_share_percent',
    'status',
    'created_by',
])]
class Voucher extends Model
{
    use LogsActivity;

    protected $attributes = [
        'value' => 0,
        'min_spend' => 0,
        'allowed_days' => 127,
        'used_count' => 0,
        'channel' => 'pos',
        'member_only' => false,
        'stackable_with_promo' => true,
        'stackable_with_voucher' => false,
        'funding' => 'store',
        'store_share_percent' => 100,
        'supplier_share_percent' => 0,
        'status' => 'draft',
    ];

    protected function casts(): array
    {
        return [
            'type' => VoucherType::class,
            'funding' => PromotionFunding::class,
            'store_share_percent' => 'decimal:2',
            'supplier_share_percent' => 'decimal:2',
            'status' => VoucherStatus::class,
            'value' => 'decimal:2',
            'max_discount' => 'decimal:2',
            'min_spend' => 'decimal:2',
            'valid_from' => 'datetime',
            'valid_until' => 'datetime',
            'allowed_days' => 'integer',
            'total_quota' => 'integer',
            'used_count' => 'integer',
            'per_customer_limit' => 'integer',
            'per_day_limit' => 'integer',
            'store_ids' => 'array',
            'member_only' => 'boolean',
            'member_tiers' => 'array',
            'applicable_skus' => 'array',
            'applicable_categories' => 'array',
            'excluded_skus' => 'array',
            'excluded_categories' => 'array',
            'free_product_id' => 'integer',
            'stackable_with_promo' => 'boolean',
            'stackable_with_voucher' => 'boolean',
        ];
    }

    /**
     * Selalu simpan kode voucher dalam format UPPERCASE tanpa spasi.
     *
     * @return Attribute<string, string>
     */
    protected function code(): Attribute
    {
        return Attribute::make(
            set: fn (string $value): string => strtoupper(preg_replace('/\s+/', '', trim($value)) ?? ''),
        );
    }

    public function getActivitylogOptions(): LogOptions
    {
        return LogOptions::defaults()
            ->useLogName(ActivityLogCategory::Promotion->value)
            ->setDescriptionForEvent(fn (string $eventName): string => match ($eventName) {
                'created' => "Voucher {$this->code} ({$this->name}) berhasil dibuat.",
                'updated' => "Voucher {$this->code} ({$this->name}) diperbarui.",
                'deleted' => "Voucher {$this->code} ({$this->name}) dihapus.",
                default => "Voucher {$this->code} ({$eventName}).",
            })
            ->logOnly([
                'code',
                'name',
                'type',
                'value',
                'max_discount',
                'min_spend',
                'valid_from',
                'valid_until',
                'allowed_days',
                'allowed_hours_start',
                'allowed_hours_end',
                'total_quota',
                'used_count',
                'per_customer_limit',
                'per_day_limit',
                'store_ids',
                'channel',
                'member_only',
                'member_tiers',
                'applicable_skus',
                'applicable_categories',
                'excluded_skus',
                'excluded_categories',
                'free_product_id',
                'stackable_with_promo',
                'stackable_with_voucher',
                'funding',
                'status',
            ])
            ->logOnlyDirty()
            ->dontLogEmptyChanges();
    }

    /**
     * Status aktual voucher dengan memperhitungkan jadwal & kuota.
     */
    public function computedStatus(?CarbonInterface $at = null): VoucherStatus
    {
        $now = $at ?? now();

        if (in_array($this->status, [VoucherStatus::Draft, VoucherStatus::Paused], true)) {
            return $this->status;
        }

        if ($this->status === VoucherStatus::Exhausted || ($this->total_quota !== null && $this->used_count >= $this->total_quota)) {
            return VoucherStatus::Exhausted;
        }

        if ($this->status === VoucherStatus::Expired || $this->valid_until->lt($now)) {
            return VoucherStatus::Expired;
        }

        return VoucherStatus::Active;
    }

    /**
     * Periksa apakah waktu acuan sesuai aturan hari (bitmask) dan jam (WIB).
     */
    public function isWithinAllowedDayAndHours(CarbonInterface $at): bool
    {
        $tz = (string) config('pos_promotions.timezone', 'Asia/Jakarta');
        $localTime = $at->copy()->timezone($tz);

        // isoWeekday: 1 = Senin ... 7 = Minggu -> bit 0..6
        $dayBit = 1 << ($localTime->dayOfWeekIso - 1);
        $mask = (int) ($this->allowed_days ?? 127);

        if (($mask & $dayBit) === 0) {
            return false;
        }

        if ($this->allowed_hours_start !== null && $this->allowed_hours_end !== null) {
            $currentHms = $localTime->format('H:i:s');
            $startHms = strlen($this->allowed_hours_start) === 5
                ? "{$this->allowed_hours_start}:00"
                : $this->allowed_hours_start;
            $endHms = strlen($this->allowed_hours_end) === 5
                ? "{$this->allowed_hours_end}:59"
                : $this->allowed_hours_end;

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
        if ($this->total_quota === null) {
            return null;
        }

        return max(0, (int) $this->total_quota - (int) $this->used_count);
    }

    /**
     * @param  Builder<Voucher>  $query
     * @return Builder<Voucher>
     */
    public function scopeActiveNow(Builder $query, ?CarbonInterface $at = null): Builder
    {
        $now = $at ?? now();

        return $query
            ->where('status', VoucherStatus::Active->value)
            ->where('valid_from', '<=', $now)
            ->where('valid_until', '>=', $now)
            ->where(function (Builder $q): void {
                $q->whereNull('total_quota')
                    ->orWhereColumn('used_count', '<', 'total_quota');
            });
    }

    /** @return BelongsTo<Product, $this> */
    public function freeProduct(): BelongsTo
    {
        return $this->belongsTo(Product::class, 'free_product_id');
    }

    /** @return BelongsTo<Supplier, $this> */
    public function supplier(): BelongsTo
    {
        return $this->belongsTo(Supplier::class);
    }

    /** @return BelongsTo<User, $this> */
    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by')->withTrashed();
    }

    /** @return HasMany<VoucherRedemption, $this> */
    public function redemptions(): HasMany
    {
        return $this->hasMany(VoucherRedemption::class);
    }

    /** @return HasMany<AppliedPromotion, $this> */
    public function appliedPromotions(): HasMany
    {
        return $this->hasMany(AppliedPromotion::class);
    }
}

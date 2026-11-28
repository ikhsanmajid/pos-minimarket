<?php

namespace App\Services;

use App\Enums\PromotionScope;
use App\Enums\PromotionType;
use App\Models\Promotion;
use App\Models\PromotionBundleItem;
use App\Models\User;
use App\Support\PricingMath;
use Carbon\CarbonInterface;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

/**
 * Layanan manajemen promo penjualan.
 *
 * Konvensi prioritas promo (berlaku seragam di seluruh promotion engine):
 * - Pada level baris / exclusive_group, kandidat dengan penghematan Rupiah terbesar menang.
 * - Jika penghematan seri, promo dengan nilai `priority` tertinggi menang.
 * - Jika `priority` masih seri, promo dengan `id` terkecil (dibuat lebih dahulu) menang.
 */
class PromotionService
{
    /**
     * Ringkasan 4 metrik KPI promo (kompatibel PostgreSQL & SQLite).
     *
     * @return array{
     *     total_promotions: int,
     *     active_promotions: int,
     *     scheduled_promotions: int,
     *     ended_or_inactive_promotions: int
     * }
     */
    public function getSummary(?CarbonInterface $at = null): array
    {
        $now = ($at ?? now())->toDateTimeString();

        $row = Promotion::query()
            ->selectRaw(
                'COUNT(*) as total_promotions,
                SUM(CASE WHEN is_active = ? AND starts_at <= ? AND ends_at >= ? THEN 1 ELSE 0 END) as active_promotions,
                SUM(CASE WHEN is_active = ? AND starts_at > ? THEN 1 ELSE 0 END) as scheduled_promotions,
                SUM(CASE WHEN is_active = ? OR ends_at < ? THEN 1 ELSE 0 END) as ended_or_inactive_promotions',
                [true, $now, $now, true, $now, false, $now]
            )
            ->first();

        return [
            'total_promotions' => (int) ($row->total_promotions ?? 0),
            'active_promotions' => (int) ($row->active_promotions ?? 0),
            'scheduled_promotions' => (int) ($row->scheduled_promotions ?? 0),
            'ended_or_inactive_promotions' => (int) ($row->ended_or_inactive_promotions ?? 0),
        ];
    }

    /**
     * @param  array<string, mixed>  $data
     */
    public function create(array $data, User $actor): Promotion
    {
        return DB::transaction(function () use ($data, $actor): Promotion {
            $productIds = $this->extractIds($data['product_ids'] ?? []);
            $categoryIds = $this->extractIds($data['category_ids'] ?? []);
            $payload = $this->normalizePayload($data);
            $payload['created_by'] = $actor->id;

            $promotion = Promotion::create($payload);
            $this->syncTargets($promotion, $productIds, $categoryIds);
            $this->syncBundleItems($promotion, $data['bundle_items'] ?? []);

            return $promotion->load([
                'products:id,name,barcode',
                'categories:id,name',
                'bundleItems.product:id,name,barcode',
                'rewardProduct:id,name,barcode',
            ]);
        });
    }

    /**
     * @param  array<string, mixed>  $data
     */
    public function update(Promotion $promotion, array $data): Promotion
    {
        return DB::transaction(function () use ($promotion, $data): Promotion {
            $productIds = $this->extractIds($data['product_ids'] ?? []);
            $categoryIds = $this->extractIds($data['category_ids'] ?? []);
            $payload = $this->normalizePayload($data);

            $promotion->update($payload);
            $this->syncTargets($promotion, $productIds, $categoryIds);
            $this->syncBundleItems($promotion, $data['bundle_items'] ?? []);

            return $promotion->load([
                'products:id,name,barcode',
                'categories:id,name',
                'bundleItems.product:id,name,barcode',
                'rewardProduct:id,name,barcode',
            ]);
        });
    }

    public function delete(Promotion $promotion): void
    {
        DB::transaction(function () use ($promotion): void {
            $promotion->delete();
        });
    }

    /**
     * @param  array<string, mixed>  $data
     * @return array<string, mixed>
     */
    private function normalizePayload(array $data): array
    {
        $tz = (string) config('pos_promotions.timezone', 'Asia/Jakarta');

        $startsAt = Carbon::parse((string) $data['starts_at'], $tz)->utc();
        $endsAt = Carbon::parse((string) $data['ends_at'], $tz)->utc();

        $code = isset($data['code']) && trim((string) $data['code']) !== ''
            ? strtoupper(trim((string) $data['code']))
            : null;

        $exclusiveGroup = isset($data['exclusive_group']) && trim((string) $data['exclusive_group']) !== ''
            ? trim((string) $data['exclusive_group'])
            : null;

        $discountValue = isset($data['discount_value']) && $data['discount_value'] !== '' && $data['discount_value'] !== null
            ? round((float) $data['discount_value'], 2)
            : null;

        $type = (string) $data['type'];
        if (in_array($type, [PromotionType::FixedDiscount->value, PromotionType::MinSpendDiscount->value], true) && $discountValue !== null) {
            $discountValue = (float) PricingMath::toRupiah($discountValue);
        }

        $paymentBin = isset($data['payment_bin_prefix']) && trim((string) $data['payment_bin_prefix']) !== ''
            ? preg_replace('/\D+/', '', trim((string) $data['payment_bin_prefix']))
            : null;

        return [
            'code' => $code,
            'name' => trim((string) $data['name']),
            'type' => $type,
            'scope' => (string) ($data['scope'] ?? PromotionScope::AllProducts->value),
            'funding' => (string) ($data['funding'] ?? 'store'),
            'discount_value' => $discountValue,
            'max_discount_amount' => isset($data['max_discount_amount']) && $data['max_discount_amount'] !== '' && $data['max_discount_amount'] !== null
                ? PricingMath::toRupiah($data['max_discount_amount'])
                : null,
            'min_purchase_amount' => PricingMath::toRupiah($data['min_purchase_amount'] ?? 0),
            'buy_qty' => isset($data['buy_qty']) && $data['buy_qty'] !== '' && $data['buy_qty'] !== null
                ? (int) $data['buy_qty']
                : null,
            'get_qty' => isset($data['get_qty']) && $data['get_qty'] !== '' && $data['get_qty'] !== null
                ? (int) $data['get_qty']
                : null,
            'get_discount_percent' => isset($data['get_discount_percent']) && $data['get_discount_percent'] !== '' && $data['get_discount_percent'] !== null
                ? round(min(100, max(0, (float) $data['get_discount_percent'])), 2)
                : 100.00,
            'bundle_price' => isset($data['bundle_price']) && $data['bundle_price'] !== '' && $data['bundle_price'] !== null
                ? PricingMath::toRupiah($data['bundle_price'])
                : null,
            'nth_item' => isset($data['nth_item']) && $data['nth_item'] !== '' && $data['nth_item'] !== null
                ? (int) $data['nth_item']
                : null,
            'reward_product_id' => isset($data['reward_product_id']) && $data['reward_product_id'] !== '' && $data['reward_product_id'] !== null
                ? (int) $data['reward_product_id']
                : null,
            'special_price' => isset($data['special_price']) && $data['special_price'] !== '' && $data['special_price'] !== null
                ? PricingMath::toRupiah($data['special_price'])
                : null,
            'payment_method' => isset($data['payment_method']) && trim((string) $data['payment_method']) !== ''
                ? trim((string) $data['payment_method'])
                : null,
            'payment_bin_prefix' => $paymentBin !== '' ? $paymentBin : null,
            'near_expiry_days' => isset($data['near_expiry_days']) && $data['near_expiry_days'] !== '' && $data['near_expiry_days'] !== null
                ? (int) $data['near_expiry_days']
                : null,
            'starts_at' => $startsAt,
            'ends_at' => $endsAt,
            'days_mask' => isset($data['days_mask']) && $data['days_mask'] !== '' ? (int) $data['days_mask'] : 127,
            'time_start' => isset($data['time_start']) && trim((string) $data['time_start']) !== ''
                ? trim((string) $data['time_start'])
                : null,
            'time_end' => isset($data['time_end']) && trim((string) $data['time_end']) !== ''
                ? trim((string) $data['time_end'])
                : null,
            'quota_total' => isset($data['quota_total']) && $data['quota_total'] !== '' && $data['quota_total'] !== null
                ? (int) $data['quota_total']
                : null,
            'max_qty_per_transaction' => isset($data['max_qty_per_transaction']) && $data['max_qty_per_transaction'] !== '' && $data['max_qty_per_transaction'] !== null
                ? (int) $data['max_qty_per_transaction']
                : null,
            'max_qty_per_customer_per_day' => isset($data['max_qty_per_customer_per_day']) && $data['max_qty_per_customer_per_day'] !== '' && $data['max_qty_per_customer_per_day'] !== null
                ? (int) $data['max_qty_per_customer_per_day']
                : null,
            'stackable' => (bool) ($data['stackable'] ?? false),
            'exclusive_group' => $exclusiveGroup,
            'priority' => (int) ($data['priority'] ?? 0),
            'member_only' => (bool) ($data['member_only'] ?? false),
            'is_active' => (bool) ($data['is_active'] ?? true),
        ];
    }

    /**
     * @param  array<int, int>  $productIds
     * @param  array<int, int>  $categoryIds
     */
    private function syncTargets(Promotion $promotion, array $productIds, array $categoryIds): void
    {
        if ($promotion->scope === PromotionScope::Product) {
            $promotion->products()->sync($productIds);
            $promotion->categories()->sync([]);
        } elseif ($promotion->scope === PromotionScope::Category) {
            $promotion->categories()->sync($categoryIds);
            $promotion->products()->sync([]);
        } else {
            $promotion->products()->sync([]);
            $promotion->categories()->sync([]);
        }
    }

    /**
     * @param  mixed  $rawBundleItems
     */
    private function syncBundleItems(Promotion $promotion, mixed $rawBundleItems): void
    {
        $promotion->bundleItems()->delete();

        if ($promotion->type !== PromotionType::Bundle || ! is_array($rawBundleItems)) {
            return;
        }

        $merged = [];
        foreach ($rawBundleItems as $row) {
            if (! is_array($row)) {
                continue;
            }
            $productId = (int) ($row['product_id'] ?? 0);
            $requiredQty = max(1, (int) ($row['required_qty'] ?? 1));
            if ($productId <= 0) {
                continue;
            }
            $merged[$productId] = ($merged[$productId] ?? 0) + $requiredQty;
        }

        foreach ($merged as $productId => $requiredQty) {
            PromotionBundleItem::create([
                'promotion_id' => $promotion->id,
                'product_id' => $productId,
                'required_qty' => $requiredQty,
            ]);
        }
    }

    /**
     * @param  mixed  $raw
     * @return array<int, int>
     */
    private function extractIds(mixed $raw): array
    {
        if (! is_array($raw)) {
            return [];
        }

        return array_values(array_unique(array_filter(array_map(
            fn (mixed $id): int => (int) $id,
            $raw
        ), fn (int $id): bool => $id > 0)));
    }
}

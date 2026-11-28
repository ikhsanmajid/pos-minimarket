<?php

namespace Database\Seeders;

use App\Enums\PaymentMethod;
use App\Enums\PromotionFunding;
use App\Enums\PromotionScope;
use App\Enums\PromotionType;
use App\Models\Category;
use App\Models\Product;
use App\Models\Promotion;
use App\Models\PromotionBundleItem;
use App\Models\User;
use Carbon\CarbonInterface;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class PromotionSeeder extends Seeder
{
    public function run(): void
    {
        if (function_exists('activity')) {
            activity()->disableLogging();
        }

        try {
            DB::transaction(function (): void {
                $this->seedPromotions();
            });
        } finally {
            if (function_exists('activity')) {
                activity()->enableLogging();
            }
        }
    }

    private function seedPromotions(): void
    {
        $likeOperator = DB::getDriverName() === 'pgsql' ? 'ilike' : 'like';

        /** @var Product|null $indomieGoreng */
        $indomieGoreng = Product::query()
            ->where('barcode', '8990001001')
            ->orWhere('name', $likeOperator, '%Indomie Goreng%')
            ->first();

        /** @var Category|null $makananSnack */
        $makananSnack = Category::query()
            ->where('code', 'MKN')
            ->orWhere('name', 'Makanan & Snack')
            ->orWhere('name', $likeOperator, '%Makanan & Snack%')
            ->first();

        if (! $indomieGoreng instanceof Product || ! $makananSnack instanceof Category) {
            $this->command?->warn(
                'PromotionSeeder dilewati: produk "Indomie Goreng" atau kategori "Makanan & Snack" belum ditemukan.'
            );

            return;
        }

        /** @var Product|null $bundleCompanion */
        $bundleCompanion = Product::query()
            ->where('id', '!=', $indomieGoreng->id)
            ->where(function ($q) use ($likeOperator): void {
                $q->where('barcode', '8990002003')
                    ->orWhere('name', $likeOperator, '%Teh Pucuk%');
            })
            ->first()
            ?? Product::query()
                ->where('id', '!=', $indomieGoreng->id)
                ->where('category_id', $makananSnack->id)
                ->where('active', true)
                ->first();

        /** @var User|null $admin */
        $admin = User::query()->where('email', 'admin@minimarket.test')->first()
            ?? User::query()->orderBy('id')->first();

        $startsAt = now()->subDay()->startOfHour();
        $endsAt = now()->addDays(60)->endOfDay();

        // 1. Promo per Produk (khusus Indomie Goreng)
        $productPromos = [
            [
                'code' => 'PROMO-PCT-INDOMIE',
                'name' => 'Diskon 10% Indomie Goreng',
                'type' => PromotionType::PercentageDiscount,
                'scope' => PromotionScope::Product,
                'funding' => PromotionFunding::Store,
                'discount_value' => 10,
                'max_discount_amount' => 5000,
                'min_purchase_amount' => 0,
                'priority' => 10,
            ],
            [
                'code' => 'PROMO-FIX-INDOMIE',
                'name' => 'Potongan Rp 500 Indomie Goreng',
                'type' => PromotionType::FixedDiscount,
                'scope' => PromotionScope::Product,
                'funding' => PromotionFunding::Supplier,
                'discount_value' => 500,
                'min_purchase_amount' => 0,
                'priority' => 15,
            ],
            [
                'code' => 'PROMO-BXGY-INDOMIE',
                'name' => 'Beli 3 Gratis 1 Indomie Goreng',
                'type' => PromotionType::BuyXGetY,
                'scope' => PromotionScope::Product,
                'funding' => PromotionFunding::Supplier,
                'buy_qty' => 3,
                'get_qty' => 1,
                'get_discount_percent' => 100,
                'priority' => 20,
            ],
            [
                'code' => 'PROMO-MULTI-INDOMIE',
                'name' => 'Paket Hemat 5 Indomie Goreng Rp 15.000',
                'type' => PromotionType::MultibuyPrice,
                'scope' => PromotionScope::Product,
                'funding' => PromotionFunding::Shared,
                'buy_qty' => 5,
                'bundle_price' => 15000,
                'priority' => 25,
            ],
            [
                'code' => 'PROMO-NTH-INDOMIE',
                'name' => 'Indomie Goreng Item Ke-2 Diskon 50%',
                'type' => PromotionType::NthItemDiscount,
                'scope' => PromotionScope::Product,
                'funding' => PromotionFunding::Store,
                'nth_item' => 2,
                'discount_value' => 50,
                'max_qty_per_customer_per_day' => 6,
                'priority' => 18,
            ],
            [
                'code' => 'PROMO-NEAREXP-INDOMIE',
                'name' => 'Near Expiry H-7 Indomie Goreng 25%',
                'type' => PromotionType::NearExpiry,
                'scope' => PromotionScope::Product,
                'funding' => PromotionFunding::Store,
                'near_expiry_days' => 7,
                'discount_value' => 25,
                'priority' => 30,
            ],
        ];

        foreach ($productPromos as $def) {
            $promo = $this->upsertPromotion($def, $startsAt, $endsAt, $admin?->id);
            $promo->products()->sync([$indomieGoreng->id]);
            $promo->categories()->sync([]);
        }

        // 2. Promo Bundel (2x Indomie Goreng + 1x produk pendamping)
        $bundlePromo = $this->upsertPromotion([
            'code' => 'PROMO-BUNDLE-INDOMIE',
            'name' => $bundleCompanion instanceof Product
                ? "Paket Bundel 2x Indomie Goreng + {$bundleCompanion->name}"
                : 'Paket Bundel 3x Indomie Goreng',
            'type' => PromotionType::Bundle,
            'scope' => PromotionScope::Product,
            'funding' => PromotionFunding::Shared,
            'bundle_price' => $bundleCompanion instanceof Product ? 9500 : 9000,
            'priority' => 28,
        ], $startsAt, $endsAt, $admin?->id);

        $bundlePromo->products()->sync([]);
        $bundlePromo->categories()->sync([]);
        $bundlePromo->bundleItems()->delete();

        PromotionBundleItem::create([
            'promotion_id' => $bundlePromo->id,
            'product_id' => $indomieGoreng->id,
            'required_qty' => $bundleCompanion instanceof Product ? 2 : 3,
        ]);

        if ($bundleCompanion instanceof Product) {
            PromotionBundleItem::create([
                'promotion_id' => $bundlePromo->id,
                'product_id' => $bundleCompanion->id,
                'required_qty' => 1,
            ]);
        }

        // 3. Promo per Kategori (khusus Makanan & Snack)
        $categoryPromos = [
            [
                'code' => 'PROMO-PCT-SNACK',
                'name' => 'Diskon 12% Kategori Makanan & Snack',
                'type' => PromotionType::PercentageDiscount,
                'scope' => PromotionScope::Category,
                'funding' => PromotionFunding::Store,
                'discount_value' => 12,
                'max_discount_amount' => 15000,
                'min_purchase_amount' => 0,
                'priority' => 8,
            ],
            [
                'code' => 'PROMO-FIX-SNACK',
                'name' => 'Potongan Rp 1.000 Makanan & Snack',
                'type' => PromotionType::FixedDiscount,
                'scope' => PromotionScope::Category,
                'funding' => PromotionFunding::Supplier,
                'discount_value' => 1000,
                'min_purchase_amount' => 0,
                'priority' => 10,
            ],
            [
                'code' => 'PROMO-BXGY-SNACK',
                'name' => 'Beli 2 Gratis 1 Makanan & Snack',
                'type' => PromotionType::BuyXGetY,
                'scope' => PromotionScope::Category,
                'funding' => PromotionFunding::Shared,
                'buy_qty' => 2,
                'get_qty' => 1,
                'get_discount_percent' => 100,
                'priority' => 14,
            ],
            [
                'code' => 'PROMO-MULTI-SNACK',
                'name' => 'Multibuy 3 Pcs Makanan & Snack Rp 25.000',
                'type' => PromotionType::MultibuyPrice,
                'scope' => PromotionScope::Category,
                'funding' => PromotionFunding::Store,
                'buy_qty' => 3,
                'bundle_price' => 25000,
                'priority' => 16,
            ],
            [
                'code' => 'PROMO-NTH-SNACK',
                'name' => 'Makanan & Snack Item Ke-2 Diskon 30%',
                'type' => PromotionType::NthItemDiscount,
                'scope' => PromotionScope::Category,
                'funding' => PromotionFunding::Store,
                'nth_item' => 2,
                'discount_value' => 30,
                'priority' => 12,
            ],
            [
                'code' => 'PROMO-MIXMATCH-SNACK',
                'name' => 'Mix & Match 3 Makanan & Snack Rp 18.000',
                'type' => PromotionType::MixMatch,
                'scope' => PromotionScope::Category,
                'funding' => PromotionFunding::Shared,
                'buy_qty' => 3,
                'bundle_price' => 18000,
                'priority' => 22,
            ],
            [
                'code' => 'PROMO-NEAREXP-SNACK',
                'name' => 'Near Expiry H-14 Makanan & Snack 20%',
                'type' => PromotionType::NearExpiry,
                'scope' => PromotionScope::Category,
                'funding' => PromotionFunding::Store,
                'near_expiry_days' => 14,
                'discount_value' => 20,
                'priority' => 26,
            ],
        ];

        foreach ($categoryPromos as $def) {
            $promo = $this->upsertPromotion($def, $startsAt, $endsAt, $admin?->id);
            $promo->categories()->sync([$makananSnack->id]);
            $promo->products()->sync([]);
        }

        // 4. Promo Level Transaksi & Metode Bayar
        $transactionAndPaymentPromos = [
            [
                'code' => 'PROMO-MINSPEND-RP',
                'name' => 'Belanja Min. Rp 50.000 Potongan Rp 5.000',
                'type' => PromotionType::MinSpendDiscount,
                'scope' => PromotionScope::AllProducts,
                'funding' => PromotionFunding::Store,
                'min_purchase_amount' => 50000,
                'discount_value' => 5000,
                'stackable' => true,
                'priority' => 10,
            ],
            [
                'code' => 'PROMO-MINSPEND-PCT',
                'name' => 'Belanja Min. Rp 100.000 Diskon 10% (Maks Rp 15.000)',
                'type' => PromotionType::MinSpendPercent,
                'scope' => PromotionScope::AllProducts,
                'funding' => PromotionFunding::Shared,
                'min_purchase_amount' => 100000,
                'discount_value' => 10,
                'max_discount_amount' => 15000,
                'stackable' => false,
                'priority' => 15,
            ],
            [
                'code' => 'PROMO-TEBUS-INDOMIE',
                'name' => 'Tebus Murah Indomie Goreng Rp 1.500',
                'type' => PromotionType::TebusMurah,
                'scope' => PromotionScope::AllProducts,
                'funding' => PromotionFunding::Supplier,
                'min_purchase_amount' => 30000,
                'reward_product_id' => $indomieGoreng->id,
                'special_price' => 1500,
                'max_qty_per_transaction' => 1,
                'priority' => 20,
            ],
            [
                'code' => 'PROMO-GWP-INDOMIE',
                'name' => 'Gratis 1 Indomie Goreng Belanja Min. Rp 75.000',
                'type' => PromotionType::GiftWithPurchase,
                'scope' => PromotionScope::AllProducts,
                'funding' => PromotionFunding::Supplier,
                'min_purchase_amount' => 75000,
                'reward_product_id' => $indomieGoreng->id,
                'get_qty' => 1,
                'priority' => 15,
            ],
            [
                'code' => 'PROMO-PAY-DEBIT',
                'name' => 'Promo Kartu Debit (BIN 411111) Diskon 10%',
                'type' => PromotionType::PaymentPromo,
                'scope' => PromotionScope::AllProducts,
                'funding' => PromotionFunding::Shared,
                'payment_method' => PaymentMethod::Debit->value,
                'payment_bin_prefix' => '411111',
                'discount_value' => 10,
                'max_discount_amount' => 10000,
                'min_purchase_amount' => 20000,
                'max_qty_per_customer_per_day' => 5,
                'stackable' => true,
                'priority' => 20,
            ],
            [
                'code' => 'PROMO-CASHBACK',
                'name' => 'Cashback Belanja Rp 2.500',
                'type' => PromotionType::Cashback,
                'scope' => PromotionScope::AllProducts,
                'funding' => PromotionFunding::Store,
                'min_purchase_amount' => 50000,
                'discount_value' => 2500,
                'priority' => 5,
            ],
        ];

        foreach ($transactionAndPaymentPromos as $def) {
            $promo = $this->upsertPromotion($def, $startsAt, $endsAt, $admin?->id);
            $promo->products()->sync([]);
            $promo->categories()->sync([]);
        }
    }

    /**
     * @param  array<string, mixed>  $attributes
     */
    private function upsertPromotion(array $attributes, CarbonInterface $startsAt, CarbonInterface $endsAt, ?int $createdBy): Promotion
    {
        $code = (string) $attributes['code'];
        unset($attributes['code']);

        return Promotion::updateOrCreate(
            ['code' => $code],
            array_merge([
                'discount_value' => null,
                'max_discount_amount' => null,
                'min_purchase_amount' => 0,
                'buy_qty' => null,
                'get_qty' => null,
                'get_discount_percent' => 100,
                'bundle_price' => null,
                'nth_item' => null,
                'reward_product_id' => null,
                'special_price' => null,
                'payment_method' => null,
                'payment_bin_prefix' => null,
                'near_expiry_days' => null,
                'starts_at' => $startsAt,
                'ends_at' => $endsAt,
                'days_mask' => 127,
                'time_start' => null,
                'time_end' => null,
                'quota_total' => null,
                'max_qty_per_transaction' => null,
                'max_qty_per_customer_per_day' => null,
                'stackable' => false,
                'exclusive_group' => null,
                'priority' => 0,
                'member_only' => false,
                'is_active' => true,
                'created_by' => $createdBy,
            ], $attributes)
        );
    }
}

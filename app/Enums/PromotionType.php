<?php

namespace App\Enums;

enum PromotionType: string
{
    case PercentageDiscount = 'percentage_discount';
    case FixedDiscount = 'fixed_discount';
    case BuyXGetY = 'buy_x_get_y';
    case MultibuyPrice = 'multibuy_price';
    case NthItemDiscount = 'nth_item_discount';
    case MixMatch = 'mix_match';
    case Bundle = 'bundle';
    case NearExpiry = 'near_expiry';
    case MinSpendDiscount = 'min_spend_discount';
    case MinSpendPercent = 'min_spend_percent';
    case TebusMurah = 'tebus_murah';
    case GiftWithPurchase = 'gift_with_purchase';
    case PaymentPromo = 'payment_promo';
    case Cashback = 'cashback';

    public function label(): string
    {
        return match ($this) {
            self::PercentageDiscount => 'Diskon Persentase (%)',
            self::FixedDiscount => 'Diskon Nominal (Rp)',
            self::BuyXGetY => 'Beli X Gratis Y',
            self::MultibuyPrice => 'Harga Paket (Multibuy)',
            self::NthItemDiscount => 'Diskon Item Ke-N',
            self::MixMatch => 'Mix & Match',
            self::Bundle => 'Paket Bundel',
            self::NearExpiry => 'Diskon Near Expiry',
            self::MinSpendDiscount => 'Potongan Min. Belanja (Rp)',
            self::MinSpendPercent => 'Potongan Min. Belanja (%)',
            self::TebusMurah => 'Tebus Murah',
            self::GiftWithPurchase => 'Hadiah Pembelian (GWP)',
            self::PaymentPromo => 'Promo Metode Bayar',
            self::Cashback => 'Cashback',
        };
    }

    public function shortLabel(): string
    {
        return match ($this) {
            self::PercentageDiscount => 'Diskon %',
            self::FixedDiscount => 'Potongan Rp',
            self::BuyXGetY => 'Beli X Gratis Y',
            self::MultibuyPrice => 'Multibuy',
            self::NthItemDiscount => 'Item Ke-N',
            self::MixMatch => 'Mix & Match',
            self::Bundle => 'Bundel',
            self::NearExpiry => 'Near Expiry',
            self::MinSpendDiscount => 'Min. Belanja Rp',
            self::MinSpendPercent => 'Min. Belanja %',
            self::TebusMurah => 'Tebus Murah',
            self::GiftWithPurchase => 'GWP',
            self::PaymentPromo => 'Promo Bayar',
            self::Cashback => 'Cashback',
        };
    }

    public function badgeVariant(): string
    {
        return match ($this) {
            self::PercentageDiscount, self::MinSpendPercent => 'blue',
            self::FixedDiscount, self::MinSpendDiscount => 'emerald',
            self::BuyXGetY, self::MultibuyPrice, self::Bundle, self::MixMatch => 'amber',
            self::NearExpiry, self::NthItemDiscount => 'rose',
            self::TebusMurah, self::GiftWithPurchase, self::PaymentPromo, self::Cashback => 'violet',
        };
    }

    public function isItemLevel(): bool
    {
        return in_array($this, [
            self::PercentageDiscount,
            self::FixedDiscount,
            self::BuyXGetY,
            self::MultibuyPrice,
            self::NthItemDiscount,
            self::MixMatch,
            self::Bundle,
            self::NearExpiry,
        ], true);
    }

    public function isTransactionLevel(): bool
    {
        return in_array($this, [
            self::MinSpendDiscount,
            self::MinSpendPercent,
            self::TebusMurah,
            self::GiftWithPurchase,
            self::Cashback,
        ], true);
    }

    public function isPaymentLevel(): bool
    {
        return $this === self::PaymentPromo;
    }

    /**
     * Tipe promo yang aktif di UI manajemen Fase 1.
     *
     * @return array<int, array{value: string, label: string}>
     */
    public static function phase1Options(): array
    {
        return array_map(
            fn (self $case): array => [
                'value' => $case->value,
                'label' => $case->label(),
            ],
            [
                self::PercentageDiscount,
                self::FixedDiscount,
                self::BuyXGetY,
                self::MultibuyPrice,
            ]
        );
    }

    /**
     * @return array<int, array{value: string, label: string}>
     */
    public static function options(): array
    {
        return array_map(
            fn (self $case): array => [
                'value' => $case->value,
                'label' => $case->label(),
            ],
            self::cases()
        );
    }
}

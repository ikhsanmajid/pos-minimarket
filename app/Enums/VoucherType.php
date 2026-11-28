<?php

namespace App\Enums;

enum VoucherType: string
{
    case FixedAmount = 'fixed_amount';
    case Percentage = 'percentage';
    case FreeItem = 'free_item';
    case ProductSpecific = 'product_specific';
    case CashVoucher = 'cash_voucher';

    public function label(): string
    {
        return match ($this) {
            self::FixedAmount => 'Potongan Nominal (Rp)',
            self::Percentage => 'Diskon Persentase (%)',
            self::FreeItem => 'Gratis Produk',
            self::ProductSpecific => 'Potongan Produk Tertentu',
            self::CashVoucher => 'Voucher Tunai (Gift Voucher)',
        };
    }

    public function shortLabel(): string
    {
        return match ($this) {
            self::FixedAmount => 'Nominal',
            self::Percentage => 'Persen',
            self::FreeItem => 'Gratis Item',
            self::ProductSpecific => 'Produk Tertentu',
            self::CashVoucher => 'Voucher Tunai',
        };
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

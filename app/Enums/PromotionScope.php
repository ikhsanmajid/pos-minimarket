<?php

namespace App\Enums;

enum PromotionScope: string
{
    case AllProducts = 'all_products';
    case Category = 'category';
    case Product = 'product';

    public function label(): string
    {
        return match ($this) {
            self::AllProducts => 'Semua Produk',
            self::Category => 'Kategori Tertentu',
            self::Product => 'Produk Tertentu',
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

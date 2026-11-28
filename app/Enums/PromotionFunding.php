<?php

namespace App\Enums;

enum PromotionFunding: string
{
    case Store = 'store';
    case Supplier = 'supplier';
    case Shared = 'shared';

    public function label(): string
    {
        return match ($this) {
            self::Store => 'Ditanggung Toko',
            self::Supplier => 'Ditanggung Supplier',
            self::Shared => 'Patungan (Toko & Supplier)',
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

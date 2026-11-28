<?php

namespace App\Enums;

enum ProductTaxMode: string
{
    case Exclusive = 'exclusive';
    case Inclusive = 'inclusive';
    case Exempt = 'exempt';

    public function label(): string
    {
        return match ($this) {
            self::Exclusive => 'PPN Ditambahkan (Exclusive)',
            self::Inclusive => 'Harga Termasuk PPN (Inclusive)',
            self::Exempt => 'Bebas PPN (0%)',
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

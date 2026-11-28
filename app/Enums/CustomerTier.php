<?php

namespace App\Enums;

enum CustomerTier: string
{
    case Silver = 'silver';
    case Gold = 'gold';
    case Platinum = 'platinum';

    public function label(): string
    {
        return match ($this) {
            self::Silver => 'Silver',
            self::Gold => 'Gold',
            self::Platinum => 'Platinum',
        };
    }

    public function multiplier(): float
    {
        return match ($this) {
            self::Silver => 1.0,
            self::Gold => 1.5,
            self::Platinum => 2.0,
        };
    }

    /**
     * @return array<int, array{value: string, label: string, multiplier: float}>
     */
    public static function options(): array
    {
        return array_map(
            fn (self $case): array => [
                'value' => $case->value,
                'label' => $case->label(),
                'multiplier' => $case->multiplier(),
            ],
            self::cases()
        );
    }
}

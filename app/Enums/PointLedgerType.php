<?php

namespace App\Enums;

enum PointLedgerType: string
{
    case Earn = 'earn';
    case Redeem = 'redeem';
    case Expire = 'expire';
    case VoidReversal = 'void_reversal';
    case ReturnReversal = 'return_reversal';
    case Adjustment = 'adjustment';

    public function label(): string
    {
        return match ($this) {
            self::Earn => 'Perolehan Poin',
            self::Redeem => 'Penukaran Poin',
            self::Expire => 'Kedaluwarsa',
            self::VoidReversal => 'Pembalikan Void',
            self::ReturnReversal => 'Pembalikan Retur',
            self::Adjustment => 'Penyesuaian Manual',
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

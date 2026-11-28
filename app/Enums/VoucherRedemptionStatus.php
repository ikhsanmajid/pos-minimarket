<?php

namespace App\Enums;

enum VoucherRedemptionStatus: string
{
    case Reserved = 'reserved';
    case Redeemed = 'redeemed';
    case Released = 'released';
    case Refunded = 'refunded';

    public function label(): string
    {
        return match ($this) {
            self::Reserved => 'Direservasi',
            self::Redeemed => 'Terpakai',
            self::Released => 'Dilepas',
            self::Refunded => 'Dikembalikan',
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

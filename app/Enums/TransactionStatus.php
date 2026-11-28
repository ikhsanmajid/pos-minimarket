<?php

namespace App\Enums;

enum TransactionStatus: string
{
    case Completed = 'completed';
    case Voided = 'voided';
    case PartiallyRefunded = 'partially_refunded';
    case Refunded = 'refunded';

    public function label(): string
    {
        return match ($this) {
            self::Completed => 'Selesai',
            self::Voided => 'Dibatalkan (Void)',
            self::PartiallyRefunded => 'Retur Sebagian',
            self::Refunded => 'Retur Penuh',
        };
    }

    public function badgeVariant(): string
    {
        return match ($this) {
            self::Completed => 'success',
            self::Voided => 'destructive',
            self::PartiallyRefunded => 'warning',
            self::Refunded => 'secondary',
        };
    }

    /**
     * @return array<int, array{value: string, label: string}>
     */
    public static function options(): array
    {
        return array_map(
            fn (self $status): array => [
                'value' => $status->value,
                'label' => $status->label(),
            ],
            self::cases()
        );
    }
}

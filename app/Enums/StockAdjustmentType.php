<?php

namespace App\Enums;

enum StockAdjustmentType: string
{
    case In = 'in';
    case Out = 'out';

    public function label(): string
    {
        return match ($this) {
            self::In => 'Penambahan Stok',
            self::Out => 'Pengurangan Stok',
        };
    }

    public function shortLabel(): string
    {
        return match ($this) {
            self::In => 'Masuk (+)',
            self::Out => 'Keluar (-)',
        };
    }

    public function badgeVariant(): string
    {
        return match ($this) {
            self::In => 'emerald',
            self::Out => 'rose',
        };
    }
}

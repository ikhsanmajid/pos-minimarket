<?php

namespace App\Enums;

enum StockAdjustmentReason: string
{
    case Damaged = 'damaged';
    case Expired = 'expired';
    case Lost = 'lost';
    case InternalUse = 'internal_use';
    case Correction = 'correction';

    public function label(): string
    {
        return match ($this) {
            self::Damaged => 'Barang Rusak',
            self::Expired => 'Kedaluwarsa',
            self::Lost => 'Barang Hilang / Shrinkage',
            self::InternalUse => 'Pemakaian Internal Toko',
            self::Correction => 'Koreksi Kesalahan Input',
        };
    }

    public function badgeVariant(): string
    {
        return match ($this) {
            self::Damaged => 'rose',
            self::Expired => 'amber',
            self::Lost => 'rose',
            self::InternalUse => 'blue',
            self::Correction => 'slate',
        };
    }
}

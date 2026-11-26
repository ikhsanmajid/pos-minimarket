<?php

namespace App\Enums;

enum CashierShiftStatus: string
{
    case Open = 'open';
    case Closed = 'closed';

    public function label(): string
    {
        return match ($this) {
            self::Open => 'Aktif / Berjalan',
            self::Closed => 'Ditutup',
        };
    }
}

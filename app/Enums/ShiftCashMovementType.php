<?php

namespace App\Enums;

enum ShiftCashMovementType: string
{
    case CashIn = 'cash_in';
    case CashOut = 'cash_out';
    case CashDrop = 'cash_drop';

    public function label(): string
    {
        return match ($this) {
            self::CashIn => 'Kas Masuk (Cash In)',
            self::CashOut => 'Kas Keluar (Cash Out)',
            self::CashDrop => 'Setor Brankas (Cash Drop)',
        };
    }

    public function shortLabel(): string
    {
        return match ($this) {
            self::CashIn => 'Cash In',
            self::CashOut => 'Cash Out',
            self::CashDrop => 'Cash Drop',
        };
    }
}

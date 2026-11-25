<?php

namespace App\Enums;

enum FinancialAccountType: string
{
    case Cash = 'cash';
    case Bank = 'bank';
    case Ewallet = 'ewallet';

    public function label(): string
    {
        return match ($this) {
            self::Cash => 'Kas Tunai',
            self::Bank => 'Rekening Bank',
            self::Ewallet => 'Dompet Digital (E-Wallet)',
        };
    }
}

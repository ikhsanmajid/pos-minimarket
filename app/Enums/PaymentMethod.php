<?php

namespace App\Enums;

enum PaymentMethod: string
{
    case Cash = 'cash';
    case Transfer = 'transfer';
    case Qris = 'qris';
    case Giro = 'giro';
    case Other = 'other';

    public function label(): string
    {
        return match ($this) {
            self::Cash => 'Tunai',
            self::Transfer => 'Transfer Bank',
            self::Qris => 'QRIS / E-Wallet',
            self::Giro => 'Giro / Cek',
            self::Other => 'Lainnya',
        };
    }
}

<?php

namespace App\Enums;

enum PaymentMethod: string
{
    case Cash = 'cash';
    case Qris = 'qris';
    case Debit = 'debit';
    case Transfer = 'transfer';
    case Giro = 'giro';
    case Other = 'other';

    public function label(): string
    {
        return match ($this) {
            self::Cash => 'Tunai',
            self::Qris => 'QRIS / E-Wallet',
            self::Debit => 'Kartu Debit / EDC',
            self::Transfer => 'Transfer Bank',
            self::Giro => 'Giro / Cek',
            self::Other => 'Lainnya',
        };
    }
}

<?php

namespace App\Enums;

enum ReceivingStatus: string
{
    case Unreceived = 'unreceived';
    case Partial = 'partial';
    case Received = 'received';

    public function label(): string
    {
        return match ($this) {
            self::Unreceived => 'Belum Diterima',
            self::Partial => 'Diterima Sebagian',
            self::Received => 'Diterima Penuh',
        };
    }
}

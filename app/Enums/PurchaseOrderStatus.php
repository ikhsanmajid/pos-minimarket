<?php

namespace App\Enums;

enum PurchaseOrderStatus: string
{
    case Draft = 'draft';
    case Ordered = 'ordered';
    case PartiallyReceived = 'partially_received';
    case Received = 'received';
    case Cancelled = 'cancelled';

    public function label(): string
    {
        return match ($this) {
            self::Draft => 'Draft',
            self::Ordered => 'Dipesan',
            self::PartiallyReceived => 'Diterima Sebagian',
            self::Received => 'Selesai / Diterima Penuh',
            self::Cancelled => 'Dibatalkan',
        };
    }
}

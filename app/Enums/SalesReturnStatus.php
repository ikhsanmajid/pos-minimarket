<?php

namespace App\Enums;

enum SalesReturnStatus: string
{
    case Completed = 'completed';

    public function label(): string
    {
        return match ($this) {
            self::Completed => 'Selesai',
        };
    }
}

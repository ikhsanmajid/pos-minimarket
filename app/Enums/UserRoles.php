<?php

namespace App\Enums;

enum UserRoles: string
{
    //
    case Admin = 'admin';
    case Cashier = 'cashier';
    case Warehouse = 'warehouse';
    case Supervisor = 'supervisor';

    public function label(): string
    {
        return match ($this) {
            self::Admin => 'Admin',
            self::Cashier => 'Kasir',
            self::Warehouse => 'Staff Gudang',
            self::Supervisor => 'Supervisor'
        };
    }
}

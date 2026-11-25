<?php

namespace App\Enums;

enum StockMovementType: string
{
    case PurchaseIn = 'purchase_in';
    case SaleOut = 'sale_out';
    case AdjustmentIn = 'adjustment_in';
    case AdjustmentOut = 'adjustment_out';
    case PurchaseReturnOut = 'purchase_return_out';
    case SaleReturnIn = 'sale_return_in';

    public function label(): string
    {
        return match ($this) {
            self::PurchaseIn => 'Penerimaan PO',
            self::SaleOut => 'Penjualan Kasir',
            self::AdjustmentIn => 'Penyesuaian Masuk',
            self::AdjustmentOut => 'Penyesuaian Keluar',
            self::PurchaseReturnOut => 'Retur Pembelian',
            self::SaleReturnIn => 'Retur Penjualan',
        };
    }
}

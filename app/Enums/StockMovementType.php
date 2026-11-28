<?php

namespace App\Enums;

enum StockMovementType: string
{
    case PurchaseIn = 'purchase_in';
    case Sale = 'sale';
    case SaleOut = 'sale_out';
    case SaleVoid = 'sale_void';
    case SaleReturn = 'sale_return';
    case AdjustmentIn = 'adjustment_in';
    case AdjustmentOut = 'adjustment_out';
    case PurchaseReturnOut = 'purchase_return_out';
    case SaleReturnIn = 'sale_return_in';
    case Opname = 'opname';

    public function label(): string
    {
        return match ($this) {
            self::PurchaseIn => 'Penerimaan PO',
            self::Sale, self::SaleOut => 'Penjualan Kasir',
            self::SaleVoid => 'Pembatalan (Void) Penjualan',
            self::SaleReturn, self::SaleReturnIn => 'Retur Penjualan',
            self::AdjustmentIn => 'Penyesuaian Masuk',
            self::AdjustmentOut => 'Penyesuaian Keluar',
            self::PurchaseReturnOut => 'Retur Pembelian',
            self::Opname => 'Stock Opname',
        };
    }
}

<?php

namespace App\Enums;

use App\Models\AccountPayable;
use App\Models\CashRegister;
use App\Models\CashierShift;
use App\Models\Category;
use App\Models\Customer;
use App\Models\CustomerPointLedger;
use App\Models\FinancialAccount;
use App\Models\FinancialCategory;
use App\Models\FinancialTransaction;
use App\Models\PayablePayment;
use App\Models\Product;
use App\Models\ProductMemberPrice;
use App\Models\ProductPriceTier;
use App\Models\Promotion;
use App\Models\PurchaseOrder;
use App\Models\PurchaseOrderReceipt;
use App\Models\SalesReturn;
use App\Models\ShiftCashMovement;
use App\Models\StockAdjustment;
use App\Models\StockOpname;
use App\Models\StoreSetting;
use App\Models\Supplier;
use App\Models\Transaction;
use App\Models\User;
use App\Models\Voucher;
use App\Models\VoucherRedemption;

enum ActivityLogCategory: string
{
    case Auth = 'auth';
    case Product = 'product';
    case User = 'user';
    case Category = 'category';
    case Transaction = 'transaction';
    case CashierShift = 'cashier_shift';
    case CashRegister = 'cash_register';
    case Customer = 'customer';
    case Promotion = 'promotion';
    case Supplier = 'supplier';
    case PurchaseOrder = 'purchase_order';
    case Finance = 'finance';
    case StockAdjustment = 'stock_adjustment';
    case StockOpname = 'stock_opname';
    case StoreSetting = 'store_setting';
    case Report = 'report';
    case Default = 'default';

    /**
     * Label deskriptif untuk filter dan dropdown
     */
    public function label(): string
    {
        return match ($this) {
            self::Auth => 'Autentikasi (Login / Logout)',
            self::Product => 'Produk (Master Data)',
            self::User => 'Pengguna & Akun',
            self::Category => 'Kategori Produk',
            self::Transaction => 'Transaksi Penjualan',
            self::CashierShift => 'Sesi Shift Kasir',
            self::CashRegister => 'Kasir Fisik (Mesin Kasir)',
            self::Customer => 'Pelanggan / Member',
            self::Promotion => 'Promo & Harga Grosir',
            self::Supplier => 'Pemasok / Supplier',
            self::PurchaseOrder => 'Purchase Order (Pengadaan)',
            self::Finance => 'Keuangan & Hutang Dagang',
            self::StockAdjustment => 'Penyesuaian Stok (Adjustment)',
            self::StockOpname => 'Stock Opname (Audit Stok)',
            self::StoreSetting => 'Pengaturan Toko',
            self::Report => 'Laporan Bisnis & Ekspor',
            self::Default => 'Master Data (Lainnya)',
        };
    }

    /**
     * Label singkat untuk badge tabel dan modal
     */
    public function shortLabel(): string
    {
        return match ($this) {
            self::Auth => 'Autentikasi',
            self::Product => 'Produk',
            self::User => 'Pengguna',
            self::Category => 'Kategori',
            self::Transaction => 'Transaksi',
            self::CashierShift => 'Sesi Shift',
            self::CashRegister => 'Kasir Fisik',
            self::Customer => 'Pelanggan',
            self::Promotion => 'Promo & Grosir',
            self::Supplier => 'Supplier',
            self::PurchaseOrder => 'Purchase Order',
            self::Finance => 'Keuangan',
            self::StockAdjustment => 'Stock Adjustment',
            self::StockOpname => 'Stock Opname',
            self::StoreSetting => 'Pengaturan Toko',
            self::Report => 'Laporan',
            self::Default => 'Master Data',
        };
    }

    /**
     * Class model yang terkait dengan kategori ini (jika ada)
     */
    public function modelClass(): ?string
    {
        return match ($this) {
            self::Product => Product::class,
            self::User => User::class,
            self::Category => Category::class,
            self::Transaction => Transaction::class,
            self::CashierShift => CashierShift::class,
            self::CashRegister => CashRegister::class,
            self::Customer => Customer::class,
            self::Promotion => Promotion::class,
            self::Supplier => Supplier::class,
            self::PurchaseOrder => PurchaseOrder::class,
            self::Finance => FinancialAccount::class,
            self::StockAdjustment => StockAdjustment::class,
            self::StockOpname => StockOpname::class,
            self::StoreSetting => StoreSetting::class,
            default => null,
        };
    }

    /**
     * Petakan subject_type (nama class model) ke kategori log
     */
    public static function fromSubjectType(?string $subjectType): ?self
    {
        if (empty($subjectType)) {
            return null;
        }

        $baseName = class_basename($subjectType);

        if (in_array($baseName, [
            class_basename(FinancialAccount::class),
            class_basename(FinancialCategory::class),
            class_basename(FinancialTransaction::class),
            class_basename(AccountPayable::class),
            class_basename(PayablePayment::class),
        ], true)) {
            return self::Finance;
        }

        if (in_array($baseName, [
            class_basename(CashierShift::class),
            class_basename(ShiftCashMovement::class),
        ], true)) {
            return self::CashierShift;
        }

        if ($baseName === class_basename(PurchaseOrderReceipt::class)) {
            return self::PurchaseOrder;
        }

        if (in_array($baseName, [
            class_basename(Transaction::class),
            class_basename(SalesReturn::class),
        ], true)) {
            return self::Transaction;
        }

        if (in_array($baseName, [
            class_basename(Customer::class),
            class_basename(CustomerPointLedger::class),
        ], true)) {
            return self::Customer;
        }

        if (in_array($baseName, [
            class_basename(Promotion::class),
            class_basename(ProductPriceTier::class),
            class_basename(ProductMemberPrice::class),
            class_basename(Voucher::class),
            class_basename(VoucherRedemption::class),
        ], true)) {
            return self::Promotion;
        }

        foreach (self::cases() as $case) {
            $model = $case->modelClass();
            if ($model && ($subjectType === $model || $baseName === class_basename($model))) {
                return $case;
            }
        }

        return null;
    }

    /**
     * Selesaikan label kategori dari log_name dan subject_type
     */
    public static function resolveLabel(string $logName, ?string $subjectType = null): string
    {
        $category = self::tryFrom($logName);

        if ($category && $category !== self::Default) {
            return $category->shortLabel();
        }

        if ($subjectType) {
            $fromSubject = self::fromSubjectType($subjectType);
            if ($fromSubject) {
                return $fromSubject->shortLabel();
            }
        }

        return $category ? $category->shortLabel() : ucfirst($logName);
    }
}

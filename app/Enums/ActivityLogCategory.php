<?php

namespace App\Enums;

use App\Models\Category;
use App\Models\Product;
use App\Models\PurchaseOrder;
use App\Models\Supplier;
use App\Models\User;

enum ActivityLogCategory: string
{
    case Auth = 'auth';
    case Product = 'product';
    case User = 'user';
    case Category = 'category';
    case Transaction = 'transaction';
    case Supplier = 'supplier';
    case PurchaseOrder = 'purchase_order';
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
            self::Supplier => 'Pemasok / Supplier',
            self::PurchaseOrder => 'Purchase Order (Pengadaan)',
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
            self::Supplier => 'Supplier',
            self::PurchaseOrder => 'Purchase Order',
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
            self::Supplier => Supplier::class,
            self::PurchaseOrder => PurchaseOrder::class,
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

        foreach (self::cases() as $case) {
            $model = $case->modelClass();
            if ($model && ($subjectType === $model || class_basename($subjectType) === class_basename($model))) {
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

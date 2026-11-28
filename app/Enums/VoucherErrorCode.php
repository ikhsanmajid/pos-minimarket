<?php

namespace App\Enums;

enum VoucherErrorCode: string
{
    case VoucherInvalidFormat = 'VOUCHER_INVALID_FORMAT';
    case VoucherNotFound = 'VOUCHER_NOT_FOUND';
    case VoucherInactive = 'VOUCHER_INACTIVE';
    case VoucherNotYetValid = 'VOUCHER_NOT_YET_VALID';
    case VoucherExpired = 'VOUCHER_EXPIRED';
    case VoucherStoreNotAllowed = 'VOUCHER_STORE_NOT_ALLOWED';
    case VoucherQuotaExhausted = 'VOUCHER_QUOTA_EXHAUSTED';
    case VoucherCustomerLimit = 'VOUCHER_CUSTOMER_LIMIT';
    case VoucherMemberOnly = 'VOUCHER_MEMBER_ONLY';
    case VoucherMinSpendNotMet = 'VOUCHER_MIN_SPEND_NOT_MET';
    case VoucherNoEligibleItem = 'VOUCHER_NO_ELIGIBLE_ITEM';
    case VoucherNotStackable = 'VOUCHER_NOT_STACKABLE';

    public function defaultMessage(): string
    {
        return match ($this) {
            self::VoucherInvalidFormat => 'Format kode voucher tidak valid.',
            self::VoucherNotFound => 'Kode voucher tidak ditemukan.',
            self::VoucherInactive => 'Voucher sedang tidak aktif.',
            self::VoucherNotYetValid => 'Voucher belum berlaku pada waktu ini.',
            self::VoucherExpired => 'Voucher sudah kedaluwarsa atau di luar jadwal berlaku.',
            self::VoucherStoreNotAllowed => 'Voucher tidak berlaku untuk toko atau kanal ini.',
            self::VoucherQuotaExhausted => 'Kuota voucher sudah habis.',
            self::VoucherCustomerLimit => 'Batas penggunaan voucher untuk pelanggan ini sudah tercapai.',
            self::VoucherMemberOnly => 'Voucher ini hanya berlaku untuk pelanggan member terdaftar.',
            self::VoucherMinSpendNotMet => 'Minimal belanja produk eligible belum terpenuhi untuk voucher ini.',
            self::VoucherNoEligibleItem => 'Tidak ada produk eligible di keranjang untuk voucher ini.',
            self::VoucherNotStackable => 'Voucher tidak dapat digabung dengan promo atau voucher lain yang sedang aktif.',
        };
    }
}

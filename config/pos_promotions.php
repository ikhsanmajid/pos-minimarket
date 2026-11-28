<?php

return [
    /*
    |--------------------------------------------------------------------------
    | Zona Waktu Evaluasi Promo
    |--------------------------------------------------------------------------
    |
    | Timestamp disimpan dalam UTC di database, sedangkan aturan hari (days_mask)
    | dan jam berlaku (time_start/time_end) dievaluasi pada zona waktu ini.
    |
    */
    'timezone' => env('POS_PROMOTION_TIMEZONE', 'Asia/Jakarta'),

    /*
    |--------------------------------------------------------------------------
    | Kata Kunci Kategori Default yang Dikecualikan dari Promo / Voucher
    |--------------------------------------------------------------------------
    |
    | Selain flag database `products.is_promo_excluded` dan `categories.is_promo_excluded`,
    | kategori yang nama/slug-nya cocok dengan kata kunci berikut otomatis dianggap
    | dikecualikan (rokok, susu formula, obat/farmasi, pulsa/PPOB, elpiji subsidi,
    | produk HET, kantong plastik/jasa, gift card).
    |
    */
    'excluded_category_keywords' => [
        'rokok',
        'tembakau',
        'susu formula',
        'susu-formula',
        'obat',
        'farmasi',
        'pulsa',
        'token',
        'ppob',
        'voucher game',
        'voucher-game',
        'elpiji',
        'lpg',
        'gas subsidi',
        'produk het',
        'het',
        'kantong plastik',
        'kantong-plastik',
        'jasa',
        'gift card',
        'gift-card',
    ],
];

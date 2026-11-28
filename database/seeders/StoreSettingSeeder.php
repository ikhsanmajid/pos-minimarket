<?php

namespace Database\Seeders;

use App\Enums\RoundingMode;
use App\Models\StoreSetting;
use Illuminate\Database\Seeder;

class StoreSettingSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        if (StoreSetting::query()->exists()) {
            return;
        }

        StoreSetting::create([
            'store_name' => 'POS Minimarket',
            'store_address' => 'Jl. Raya Minimarket No. 1, Indonesia',
            'store_phone' => '0812-3456-7890',
            'store_logo' => null,
            'receipt_header' => 'Selamat Datang di POS Minimarket',
            'receipt_footer' => 'Terima kasih atas kunjungan Anda. Barang yang sudah dibeli tidak dapat ditukar/dikembalikan.',
            'default_tax_rate' => 0.00,
            'rounding_mode' => RoundingMode::None,
            'shift_variance_tolerance' => 10000.00,
        ]);
    }
}

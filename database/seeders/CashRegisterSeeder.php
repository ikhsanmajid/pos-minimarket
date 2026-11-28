<?php

namespace Database\Seeders;

use App\Models\CashRegister;
use Illuminate\Database\Seeder;

class CashRegisterSeeder extends Seeder
{
    public function run(): void
    {
        $registers = [
            [
                'code' => 'KSR-01',
                'name' => 'Kasir 1',
                'location' => 'Meja Kasir Utama (Kiri)',
                'description' => 'Terminal kasir utama dekat pintu masuk.',
                'is_active' => true,
            ],
            [
                'code' => 'KSR-02',
                'name' => 'Kasir 2',
                'location' => 'Meja Kasir Utama (Tengah)',
                'description' => 'Terminal kasir reguler untuk antrean ramai.',
                'is_active' => true,
            ],
            [
                'code' => 'KSR-03',
                'name' => 'Kasir 3',
                'location' => 'Meja Kasir Express (Kanan)',
                'description' => 'Terminal kasir cepat untuk transaksi sedikit item.',
                'is_active' => true,
            ],
        ];

        foreach ($registers as $register) {
            CashRegister::firstOrCreate(
                ['code' => $register['code']],
                $register
            );
        }
    }
}

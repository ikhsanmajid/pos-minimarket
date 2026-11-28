<?php

namespace Database\Seeders;

use App\Models\Customer;
use Illuminate\Database\Seeder;

class CustomerSeeder extends Seeder
{
    /**
     * Seed data pelanggan / member contoh secara idempoten.
     */
    public function run(): void
    {
        $customers = [
            [
                'member_code' => 'MBR-00001',
                'name' => 'Budi Santoso',
                'phone' => '081234567801',
                'email' => 'budi.santoso@example.com',
                'address' => 'Jl. Merdeka No. 12, Jakarta',
                'points' => 150,
                'is_active' => true,
                'notes' => 'Member reguler belanja harian.',
            ],
            [
                'member_code' => 'MBR-00002',
                'name' => 'Siti Aminah',
                'phone' => '081234567802',
                'email' => 'siti.aminah@example.com',
                'address' => 'Jl. Sudirman No. 45, Bandung',
                'points' => 320,
                'is_active' => true,
                'notes' => 'Member prioritas belanja mingguan.',
            ],
            [
                'member_code' => 'MBR-00003',
                'name' => 'Andi Wijaya',
                'phone' => '081234567803',
                'email' => 'andi.wijaya@example.com',
                'address' => 'Jl. Diponegoro No. 8, Surabaya',
                'points' => 50,
                'is_active' => true,
                'notes' => null,
            ],
        ];

        foreach ($customers as $data) {
            Customer::withTrashed()->firstOrCreate(
                ['member_code' => $data['member_code']],
                $data
            );
        }
    }
}

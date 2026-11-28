<?php

namespace Database\Seeders;

use App\Enums\UserRoles;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class UserSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $password = Hash::make('password');
        $verifiedAt = now()->subMonths(6);

        $users = [
            [
                'name' => 'Budi Santoso',
                'email' => 'admin@minimarket.test',
                'password' => $password,
                'role' => UserRoles::Admin,
                'phone' => '0812-1000-0001',
                'pin' => Hash::make('123456'),
                'is_active' => true,
                'email_verified_at' => $verifiedAt,
            ],
            [
                'name' => 'Rina Kartika',
                'email' => 'supervisor@minimarket.test',
                'password' => $password,
                'role' => UserRoles::Supervisor,
                'phone' => '0812-1000-0002',
                'pin' => Hash::make('234567'),
                'is_active' => true,
                'email_verified_at' => $verifiedAt,
            ],
            [
                'name' => 'Dedi Kurniawan',
                'email' => 'warehouse@minimarket.test',
                'password' => $password,
                'role' => UserRoles::Warehouse,
                'phone' => '0812-1000-0003',
                'pin' => Hash::make('345678'),
                'is_active' => true,
                'email_verified_at' => $verifiedAt,
            ],
            [
                'name' => 'Siti Rahmawati',
                'email' => 'kasir@minimarket.test',
                'password' => $password,
                'role' => UserRoles::Cashier,
                'phone' => '0812-1000-0004',
                'pin' => Hash::make('456789'),
                'is_active' => true,
                'email_verified_at' => $verifiedAt,
            ],
            [
                'name' => 'Andi Pratama',
                'email' => 'kasir2@minimarket.test',
                'password' => $password,
                'role' => UserRoles::Cashier,
                'phone' => '0812-1000-0005',
                'pin' => Hash::make('567890'),
                'is_active' => true,
                'email_verified_at' => $verifiedAt,
            ],
            [
                'name' => 'Dewi Lestari',
                'email' => 'kasir3@minimarket.test',
                'password' => $password,
                'role' => UserRoles::Cashier,
                'phone' => '0812-1000-0006',
                'pin' => Hash::make('678901'),
                'is_active' => true,
                'email_verified_at' => $verifiedAt,
            ],
        ];

        foreach ($users as $userData) {
            User::withTrashed()->updateOrCreate(
                ['email' => $userData['email']],
                $userData
            );
        }
    }
}

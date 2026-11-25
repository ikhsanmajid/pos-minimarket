<?php

namespace Database\Seeders;

use App\Enums\FinancialAccountType;
use App\Enums\FinancialCategoryType;
use App\Models\FinancialAccount;
use App\Models\FinancialCategory;
use Illuminate\Database\Seeder;

class FinanceSeeder extends Seeder
{
    /**
     * Seed akun kas/bank dan kategori keuangan bawaan toko (idempoten).
     */
    public function run(): void
    {
        $accounts = [
            [
                'code' => 'KAS-001',
                'name' => 'Kas Kasir (Laci POS)',
                'type' => FinancialAccountType::Cash,
                'account_number' => null,
                'bank_name' => null,
                'opening_balance' => 0,
                'current_balance' => 0,
                'is_default' => false,
                'is_active' => true,
                'notes' => 'Kas operasional harian di meja kasir untuk rekonsiliasi shift POS.',
            ],
            [
                'code' => 'KAS-002',
                'name' => 'Brankas Toko',
                'type' => FinancialAccountType::Cash,
                'account_number' => null,
                'bank_name' => null,
                'opening_balance' => 10000000,
                'current_balance' => 10000000,
                'is_default' => true,
                'is_active' => true,
                'notes' => 'Kas tunai utama penyimpanan toko.',
            ],
            [
                'code' => 'BNK-001',
                'name' => 'Rekening Bank BCA Toko',
                'type' => FinancialAccountType::Bank,
                'account_number' => '1234567890',
                'bank_name' => 'BCA',
                'opening_balance' => 25000000,
                'current_balance' => 25000000,
                'is_default' => false,
                'is_active' => true,
                'notes' => 'Rekening bank utama untuk transfer supplier dan setoran penjualan.',
            ],
        ];

        foreach ($accounts as $account) {
            FinancialAccount::withTrashed()->firstOrCreate(
                ['code' => $account['code']],
                $account
            );
        }

        $categories = [
            [
                'code' => 'INC-SALES',
                'name' => 'Penjualan Kasir (POS)',
                'type' => FinancialCategoryType::Income,
                'is_system' => true,
                'is_active' => true,
                'description' => 'Pemasukan dari transaksi penjualan kasir minimarket.',
            ],
            [
                'code' => 'INC-REFUND',
                'name' => 'Pengembalian / Retur Supplier',
                'type' => FinancialCategoryType::Income,
                'is_system' => true,
                'is_active' => true,
                'description' => 'Dana masuk dari retur pembelian / nota debit supplier.',
            ],
            [
                'code' => 'INC-OTHER',
                'name' => 'Pendapatan Lain-lain',
                'type' => FinancialCategoryType::Income,
                'is_system' => false,
                'is_active' => true,
                'description' => 'Pendapatan operasional di luar penjualan barang dagangan.',
            ],
            [
                'code' => 'EXP-PO',
                'name' => 'Pembelian Stok / Pelunasan Hutang Supplier',
                'type' => FinancialCategoryType::Expense,
                'is_system' => true,
                'is_active' => true,
                'description' => 'Pengeluaran untuk pembayaran Purchase Order dan hutang dagang supplier.',
            ],
            [
                'code' => 'EXP-OPEX',
                'name' => 'Biaya Operasional Toko',
                'type' => FinancialCategoryType::Expense,
                'is_system' => true,
                'is_active' => true,
                'description' => 'Kebutuhan operasional rutin toko (plastik, struk, perlengkapan).',
            ],
            [
                'code' => 'EXP-UTILITY',
                'name' => 'Listrik, Air & Internet',
                'type' => FinancialCategoryType::Expense,
                'is_system' => false,
                'is_active' => true,
                'description' => 'Tagihan utilitas bulanan toko.',
            ],
            [
                'code' => 'EXP-SALARY',
                'name' => 'Gaji & Tunjangan Karyawan',
                'type' => FinancialCategoryType::Expense,
                'is_system' => false,
                'is_active' => true,
                'description' => 'Pembayaran gaji staf kasir, gudang, dan supervisor.',
            ],
            [
                'code' => 'EXP-RENT',
                'name' => 'Sewa Tempat & Pemeliharaan',
                'type' => FinancialCategoryType::Expense,
                'is_system' => false,
                'is_active' => true,
                'description' => 'Biaya sewa ruko/toko serta perbaikan fasilitas.',
            ],
            [
                'code' => 'EXP-OTHER',
                'name' => 'Pengeluaran Lain-lain',
                'type' => FinancialCategoryType::Expense,
                'is_system' => false,
                'is_active' => true,
                'description' => 'Pengeluaran lain yang tidak termasuk kategori utama.',
            ],
        ];

        foreach ($categories as $category) {
            FinancialCategory::withTrashed()->firstOrCreate(
                ['code' => $category['code']],
                $category
            );
        }
    }
}

<?php

namespace Database\Seeders;

use App\Enums\CashierShiftStatus;
use App\Enums\FinancialTransactionType;
use App\Enums\PaymentMethod;
use App\Enums\PaymentStatus;
use App\Enums\PurchaseOrderStatus;
use App\Enums\ReceivingStatus;
use App\Enums\SalesReturnStatus;
use App\Enums\ShiftCashMovementType;
use App\Enums\StockAdjustmentReason;
use App\Enums\StockAdjustmentStatus;
use App\Enums\StockAdjustmentType;
use App\Enums\StockMovementType;
use App\Enums\StockOpnameStatus;
use App\Enums\TransactionStatus;
use App\Models\AccountPayable;
use App\Models\CashierShift;
use App\Models\CashRegister;
use App\Models\Category;
use App\Models\Customer;
use App\Models\FinancialAccount;
use App\Models\FinancialCategory;
use App\Models\PayablePayment;
use App\Models\Product;
use App\Models\ProductUnit;
use App\Models\PurchaseOrder;
use App\Models\PurchaseOrderItem;
use App\Models\PurchaseOrderReceipt;
use App\Models\PurchaseOrderReceiptItem;
use App\Models\SalesReturn;
use App\Models\SalesReturnItem;
use App\Models\ShiftCashMovement;
use App\Models\StockAdjustment;
use App\Models\StockOpname;
use App\Models\StockOpnameItem;
use App\Models\Supplier;
use App\Models\Transaction;
use App\Models\TransactionDetail;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Database\Seeder;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class SixMonthSimulationSeeder extends Seeder
{
    /** @var array<int, int> */
    private array $productStock = [];

    /** @var array<int, float> */
    private array $accountBalances = [];

    /** @var array<int, array<string, mixed>> */
    private array $stockMovementBuffer = [];

    /** @var array<int, array<string, mixed>> */
    private array $finTxBuffer = [];

    private int $finTxSeq = 1;

    private int $poSeq = 1;

    private int $receiptSeq = 1;

    private int $payableSeq = 1;

    private int $paymentSeq = 1;

    private int $returnSeq = 1;

    private int $adjSeq = 1;

    private int $opnameSeq = 1;

    public function run(): void
    {
        mt_srand(20260601);

        if (function_exists('activity')) {
            activity()->disableLogging();
        }

        try {
            DB::transaction(function (): void {
                $this->simulate();
            });
        } finally {
            if (function_exists('activity')) {
                activity()->enableLogging();
            }
        }
    }

    private function simulate(): void
    {
        $now = CarbonImmutable::now();
        $startDate = $now->subDays(180)->startOfDay();

        // 1. Load seeded master records
        $admin = User::where('email', 'admin@minimarket.test')->firstOrFail();
        $supervisor = User::where('email', 'supervisor@minimarket.test')->firstOrFail();
        $warehouse = User::where('email', 'warehouse@minimarket.test')->firstOrFail();
        $kasir1 = User::where('email', 'kasir@minimarket.test')->firstOrFail();
        $kasir2 = User::where('email', 'kasir2@minimarket.test')->firstOrFail();
        $kasir3 = User::where('email', 'kasir3@minimarket.test')->firstOrFail();

        $cashierPool = [$kasir1, $kasir2, $kasir3];
        $registers = CashRegister::query()->orderBy('code')->get()->values();
        $reg1 = $registers[0];
        $reg2 = $registers[1];

        $kasKasir = FinancialAccount::where('code', 'KAS-001')->firstOrFail();
        $brankas = FinancialAccount::where('code', 'KAS-002')->firstOrFail();
        $bankBca = FinancialAccount::where('code', 'BNK-001')->firstOrFail();

        $this->accountBalances = [
            $kasKasir->id => (float) $kasKasir->opening_balance,
            $brankas->id => (float) $brankas->opening_balance,
            $bankBca->id => (float) $bankBca->opening_balance,
        ];

        $finCats = FinancialCategory::query()->get()->keyBy('code');

        // 2. Categories, Suppliers, Products, ProductUnits, Customers
        $categories = $this->seedCategories($startDate);
        $suppliers = $this->seedSuppliers($startDate);
        [$products, $productUnitsByProduct, $fastIds, $slowIds, $deadIds, $lowStockIds] = $this->seedProducts($categories, $startDate);
        $customers = $this->seedCustomers($startDate);

        $productsById = [];
        foreach ($products as $product) {
            $productsById[$product->id] = $product;
            $this->productStock[$product->id] = 0;
        }

        // 3. Initial opening stock POs (day 0) + monthly replenishment POs across 6 months
        $this->seedInitialStockPurchaseOrders(
            $suppliers,
            $products,
            $productUnitsByProduct,
            $warehouse,
            $admin,
            $bankBca,
            $finCats['EXP-PO'],
            $startDate
        );

        // Build replenishment PO schedule across 6 months (months 1..6)
        $this->seedMonthlyPurchaseOrders(
            $suppliers,
            $products,
            $productUnitsByProduct,
            $warehouse,
            $supervisor,
            $admin,
            $bankBca,
            $finCats['EXP-PO'],
            $startDate,
            $now
        );

        // 4. Daily Operations across 180 days (Shifts, Transactions, Payments, Voids, Returns, Cash Drops)
        $this->seedDailyOperations(
            $startDate,
            $now,
            $cashierPool,
            $supervisor,
            $admin,
            $reg1,
            $reg2,
            $productsById,
            $fastIds,
            $slowIds,
            $deadIds,
            $customers,
            $brankas,
            $bankBca,
            $finCats['INC-SALES'],
            $finCats['EXP-OPEX']
        );

        // 5. Monthly Operational Expenses & Other Income (6 months)
        $this->seedMonthlyFinancialEntries(
            $startDate,
            $now,
            $admin,
            $brankas,
            $bankBca,
            $finCats
        );

        // 6. Stock Adjustments & Monthly Stock Opnames across 6 months
        $this->seedStockAdjustments(
            $startDate,
            $now,
            $products,
            $warehouse,
            $supervisor,
            $admin
        );

        $this->seedStockOpnames(
            $startDate,
            $now,
            $categories,
            $products,
            $warehouse,
            $supervisor,
            $admin
        );

        // 7. Ensure realistic final stock levels (avoid negative stock, keep low-stock & dead-stock realistic)
        foreach ($products as $product) {
            $finalStock = $this->productStock[$product->id];
            if (in_array($product->id, $lowStockIds, true)) {
                $finalStock = max(1, min((int) $product->min_stock - 2, max(2, $finalStock)));
            } elseif (in_array($product->id, $deadIds, true)) {
                $finalStock = max(12, $finalStock);
            } elseif ($finalStock < (int) $product->min_stock + 8) {
                $finalStock = (int) $product->min_stock + mt_rand(15, 60);
            }

            $product->updateQuietly(['stock' => $finalStock]);
        }

        // 8. Flush buffered stock movements & financial transactions + sync account balances
        $this->flushBuffers();

        foreach ($this->accountBalances as $accountId => $balance) {
            FinancialAccount::whereKey($accountId)->update([
                'current_balance' => round($balance, 2),
            ]);
        }

        // 9. Open 1 active shift today for demo cashier (kasir@minimarket.test) on Kasir 1
        // so logging in as Kasir can immediately use POS Terminal without being blocked
        CashierShift::create([
            'shift_number' => 'SHF-'.$now->format('Ymd').'-LIVE',
            'user_id' => $kasir1->id,
            'cash_register_id' => $reg1->id,
            'register_name' => $reg1->name,
            'status' => CashierShiftStatus::Open,
            'opened_at' => $now->copy()->setTime(8, 0),
            'starting_cash' => 500000,
            'total_cash_sales' => 0,
            'total_non_cash_sales' => 0,
            'total_refunds' => 0,
            'total_cash_in' => 0,
            'total_cash_out' => 0,
            'total_cash_drop' => 0,
            'total_transactions' => 0,
        ]);
    }

    /**
     * @return array<string, Category>
     */
    private function seedCategories(CarbonImmutable $createdAt): array
    {
        $defs = [
            ['code' => 'MKN', 'name' => 'Makanan & Snack', 'description' => 'Mi instan, biskuit, keripik, roti, dan makanan ringan.'],
            ['code' => 'MNM', 'name' => 'Minuman', 'description' => 'Air mineral, teh kemasan, kopi siap minum, susu, dan minuman isotonik.'],
            ['code' => 'SMB', 'name' => 'Sembako & Bahan Pokok', 'description' => 'Beras, minyak goreng, gula pasir, tepung terigu, telur, dan bumbu dapur.'],
            ['code' => 'RMT', 'name' => 'Kebutuhan Rumah Tangga', 'description' => 'Detergen, pewangi, sabun cuci piring, tisu, dan pembersih lantai.'],
            ['code' => 'PRW', 'name' => 'Perawatan Diri', 'description' => 'Sabun mandi, sampo, pasta gigi, deodoran, dan perawatan kulit.'],
            ['code' => 'OBT', 'name' => 'Obat & Kesehatan', 'description' => 'Obat bebas, vitamin, minyak angin, plester, dan masker kesehatan.'],
            ['code' => 'ATK', 'name' => 'Alat Tulis & Kantor', 'description' => 'Pulpen, buku tulis, kertas HVS, lakban, dan baterai.'],
            ['code' => 'BYI', 'name' => 'Perlengkapan Bayi', 'description' => 'Popok bayi, tisu basah, minyak telon, dan bedak bayi.'],
        ];

        $result = [];
        foreach ($defs as $def) {
            $cat = Category::create([
                'code' => $def['code'],
                'name' => $def['name'],
                'slug' => Str::slug($def['name']),
                'description' => $def['description'],
                'is_active' => true,
                'created_at' => $createdAt,
                'updated_at' => $createdAt,
            ]);
            $result[$def['code']] = $cat;
        }

        return $result;
    }

    /**
     * @return array<int, Supplier>
     */
    private function seedSuppliers(CarbonImmutable $createdAt): array
    {
        $defs = [
            [
                'code' => 'SUP-001',
                'name' => 'PT Indomarco Adi Prima',
                'contact_person' => 'Hendra Wijaya',
                'phone' => '021-54391201',
                'email' => 'order@indomarco-dist.co.id',
                'address' => 'Jl. Raya Bekasi KM 22, Cakung',
                'city' => 'Jakarta Timur',
                'npwp' => '01.234.567.8-001.000',
                'payment_term_days' => 30,
                'bank_name' => 'BCA',
                'bank_account_number' => '5210981122',
                'bank_account_name' => 'PT Indomarco Adi Prima',
            ],
            [
                'code' => 'SUP-002',
                'name' => 'PT Tirta Investama Distributor',
                'contact_person' => 'Lina Marlina',
                'phone' => '021-88902344',
                'email' => 'sales@tirtadist.co.id',
                'address' => 'Kawasan Industri Jababeka Blok C-12',
                'city' => 'Bekasi',
                'npwp' => '01.456.789.2-413.000',
                'payment_term_days' => 14,
                'bank_name' => 'Mandiri',
                'bank_account_number' => '1330004455667',
                'bank_account_name' => 'PT Tirta Investama Distributor',
            ],
            [
                'code' => 'SUP-003',
                'name' => 'CV Sumber Pangan Nusantara',
                'contact_person' => 'Haji Sulaiman',
                'phone' => '022-7312440',
                'email' => 'admin@sumberpangan.co.id',
                'address' => 'Jl. Soekarno Hatta No. 418',
                'city' => 'Bandung',
                'npwp' => '02.311.209.4-424.000',
                'payment_term_days' => 30,
                'bank_name' => 'BRI',
                'bank_account_number' => '001201009988301',
                'bank_account_name' => 'CV Sumber Pangan Nusantara',
            ],
            [
                'code' => 'SUP-004',
                'name' => 'PT Unilever Niaga Sejahtera',
                'contact_person' => 'Agus Setiawan',
                'phone' => '021-89831100',
                'email' => 'b2b@unileverniaga.co.id',
                'address' => 'Kawasan Industri MM2100, Cikarang',
                'city' => 'Bekasi',
                'npwp' => '01.100.889.1-092.000',
                'payment_term_days' => 45,
                'bank_name' => 'BCA',
                'bank_account_number' => '8800112233',
                'bank_account_name' => 'PT Unilever Niaga Sejahtera',
            ],
            [
                'code' => 'SUP-005',
                'name' => 'PT Kalbe Farma Distribusi',
                'contact_person' => 'dr. Yulia Putri',
                'phone' => '021-42873888',
                'email' => 'distribusi@kalbefarma-demo.co.id',
                'address' => 'Jl. Letjen Suprapto Kav. 4',
                'city' => 'Jakarta Pusat',
                'npwp' => '01.309.445.6-073.000',
                'payment_term_days' => 30,
                'bank_name' => 'BNI',
                'bank_account_number' => '0219988776',
                'bank_account_name' => 'PT Kalbe Farma Distribusi',
            ],
            [
                'code' => 'SUP-006',
                'name' => 'CV Karya Stationary Mandiri',
                'contact_person' => 'Bambang Hermanto',
                'phone' => '024-3541209',
                'email' => 'order@karyastationary.co.id',
                'address' => 'Jl. Majapahit No. 112',
                'city' => 'Semarang',
                'npwp' => '03.778.120.5-504.000',
                'payment_term_days' => 45,
                'bank_name' => 'BCA',
                'bank_account_number' => '2460991188',
                'bank_account_name' => 'CV Karya Stationary Mandiri',
            ],
        ];

        $suppliers = [];
        foreach ($defs as $def) {
            $suppliers[] = Supplier::create([
                ...$def,
                'is_active' => true,
                'notes' => 'Distributor resmi rekanan minimarket.',
                'created_at' => $createdAt,
                'updated_at' => $createdAt,
            ]);
        }

        return $suppliers;
    }

    /**
     * @param  array<string, Category>  $categories
     * @return array{0: array<int, Product>, 1: array<int, ProductUnit>, 2: array<int, int>, 3: array<int, int>, 4: array<int, int>, 5: array<int, int>}
     */
    private function seedProducts(array $categories, CarbonImmutable $createdAt): array
    {
        // Format: [cat, barcode, name, base_unit, buy, sell, min_stock, tier(fast|slow|dead), unit_name, conv, is_low_stock]
        $catalog = [
            // Fast-moving Makanan & Minuman
            ['MKN', '8990001001', 'Indomie Goreng Original 85g', 'pcs', 2700, 3500, 40, 'fast', 'Dus', 40, false],
            ['MKN', '8990001002', 'Indomie Kuah Soto Mie 70g', 'pcs', 2600, 3400, 30, 'fast', 'Dus', 40, false],
            ['MKN', '8990001003', 'Chitato Sapi Panggang 68g', 'pcs', 8500, 11500, 15, 'fast', 'Dus', 20, false],
            ['MKN', '8990001004', 'Oreo Vanilla 133g', 'pcs', 7200, 9500, 15, 'fast', 'Pack', 12, false],
            ['MKN', '8990001005', 'Sari Roti Tawar Kupas', 'pcs', 12500, 16000, 10, 'fast', 'Pack', 6, true],
            ['MKN', '8990001006', 'SilverQueen Chunky Bar 30g', 'pcs', 8000, 11000, 12, 'slow', 'Box', 12, false],

            ['MNM', '8990002001', 'Aqua Air Mineral 600ml', 'btl', 2500, 4000, 48, 'fast', 'Dus', 24, false],
            ['MNM', '8990002002', 'Le Minerale 600ml', 'btl', 2400, 3800, 48, 'fast', 'Dus', 24, false],
            ['MNM', '8990002003', 'Teh Pucuk Harum 350ml', 'btl', 2800, 4200, 36, 'fast', 'Dus', 24, false],
            ['MNM', '8990002004', 'Ultra Milk Full Cream 250ml', 'pcs', 5500, 7500, 24, 'fast', 'Dus', 24, false],
            ['MNM', '8990002005', 'Kopi Kapal Api Special 165g', 'pcs', 13500, 17500, 15, 'fast', 'Pack', 10, false],
            ['MNM', '8990002006', 'Pocari Sweat 500ml', 'btl', 6200, 8500, 20, 'fast', 'Dus', 24, false],
            ['MNM', '8990002007', 'Good Day Cappuccino 250ml', 'btl', 5800, 8000, 20, 'slow', 'Dus', 24, false],

            // Sembako
            ['SMB', '8990003001', 'Beras Premium Rojolele 5kg', 'sak', 64000, 76000, 10, 'fast', 'Bal', 4, false],
            ['SMB', '8990003002', 'Minyak Goreng Bimoli 1L', 'pcs', 16500, 20500, 20, 'fast', 'Dus', 12, false],
            ['SMB', '8990003003', 'Gula Pasir Gulaku 1kg', 'pcs', 15000, 18500, 20, 'fast', 'Dus', 20, false],
            ['SMB', '8990003004', 'Telur Ayam Negeri 1kg', 'kg', 25000, 31000, 12, 'fast', 'Tray', 10, true],
            ['SMB', '8990003005', 'Kecap Manis Bango 520ml', 'pcs', 19500, 24500, 12, 'slow', 'Dus', 12, false],
            ['SMB', '8990003006', 'Tepung Terigu Segitiga Biru 1kg', 'pcs', 11000, 14000, 15, 'slow', 'Dus', 12, false],

            // Kebutuhan Rumah Tangga
            ['RMT', '8990004001', 'Rinso Anti Noda 770g', 'pcs', 21000, 27000, 12, 'fast', 'Dus', 12, false],
            ['RMT', '8990004002', 'Sunlight Jeruk Nipis 650ml', 'pcs', 13500, 17500, 15, 'fast', 'Dus', 12, false],
            ['RMT', '8990004003', 'Tisu Paseo Smart 250s', 'pcs', 11500, 15500, 15, 'fast', 'Pack', 12, false],
            ['RMT', '8990004004', 'Wipol Karbol Cemara 750ml', 'pcs', 15000, 19500, 10, 'slow', 'Dus', 12, false],
            ['RMT', '8990004005', 'Baygon Aerosol Lavender 600ml', 'pcs', 34000, 43000, 8, 'dead', 'Dus', 12, false],

            // Perawatan Diri
            ['PRW', '8990005001', 'Sabun Lifebuoy Total 10 110g', 'pcs', 4200, 5800, 24, 'fast', 'Lusin', 12, false],
            ['PRW', '8990005002', 'Pasta Gigi Pepsodent 190g', 'pcs', 11500, 15000, 18, 'fast', 'Lusin', 12, false],
            ['PRW', '8990005003', 'Sampo Clear Menthol 160ml', 'btl', 23000, 29500, 10, 'slow', 'Dus', 12, false],
            ['PRW', '8990005004', 'Rexona Men Roll On 45ml', 'pcs', 18000, 23500, 10, 'slow', 'Lusin', 12, false],
            ['PRW', '8990005005', 'Sikat Gigi Formula Soft', 'pcs', 6500, 9500, 12, 'slow', 'Lusin', 12, false],

            // Obat & Kesehatan
            ['OBT', '8990006001', 'Tolak Angin Cair Box 12s', 'box', 42000, 52000, 8, 'slow', 'Box', 6, false],
            ['OBT', '8990006002', 'Panadol Biru Strip 10s', 'strip', 10500, 14000, 15, 'slow', 'Box', 10, false],
            ['OBT', '8990006003', 'Minyak Kayu Putih Cap Lang 60ml', 'btl', 21000, 27500, 10, 'slow', 'Lusin', 12, true],
            ['OBT', '8990006004', 'Hansaplast Plester Box 10s', 'box', 7500, 10500, 10, 'dead', 'Box', 12, false],

            // ATK & Bayi
            ['ATK', '8990007001', 'Pulpen Pilot BPT-P Hitam', 'pcs', 2800, 4500, 20, 'slow', 'Lusin', 12, false],
            ['ATK', '8990007002', 'Buku Tulis Sinar Dunia 38 Lbr', 'pcs', 3500, 5500, 20, 'slow', 'Pack', 10, false],
            ['ATK', '8990007003', 'Baterai ABC Alkaline AA 2s', 'pack', 11000, 15000, 12, 'dead', 'Box', 12, false],
            ['BYI', '8990008001', 'Popok MamyPoko Pants M-34', 'pack', 52000, 65000, 10, 'fast', 'Dus', 6, false],
            ['BYI', '8990008002', 'Tisu Basah Mitu Baby 50s', 'pack', 12500, 16500, 12, 'slow', 'Dus', 12, false],
            ['BYI', '8990008003', 'Bedak Bayi Zwitsal 300g', 'pcs', 24000, 31000, 8, 'dead', 'Lusin', 12, false],
        ];

        $products = [];
        $productUnitsByProduct = [];
        $fastIds = [];
        $slowIds = [];
        $deadIds = [];
        $lowStockIds = [];

        foreach ($catalog as [$catCode, $barcode, $name, $baseUnit, $buy, $sell, $minStock, $tier, $unitName, $conv, $isLow]) {
            $product = Product::create([
                'category_id' => $categories[$catCode]->id,
                'barcode' => $barcode,
                'name' => $name,
                'base_unit' => $baseUnit,
                'buy_price' => $buy,
                'sell_price' => $sell,
                'stock' => 0,
                'min_stock' => $minStock,
                'active' => true,
                'is_tax_exempt' => $catCode === 'SMB',
                'is_donation' => false,
                'created_at' => $createdAt,
                'updated_at' => $createdAt,
            ]);

            $unit = ProductUnit::create([
                'product_id' => $product->id,
                'unit_name' => $unitName,
                'conversion_factor' => $conv,
                'barcode' => $barcode.'-U',
                'buy_price' => $buy * $conv,
                'sell_price' => round($sell * $conv * 0.96, -2),
                'is_default_purchase' => true,
                'is_active' => true,
                'created_at' => $createdAt,
                'updated_at' => $createdAt,
            ]);

            $products[] = $product;
            $productUnitsByProduct[$product->id] = $unit;

            if ($tier === 'fast') {
                $fastIds[] = $product->id;
            } elseif ($tier === 'slow') {
                $slowIds[] = $product->id;
            } else {
                $deadIds[] = $product->id;
            }

            if ($isLow) {
                $lowStockIds[] = $product->id;
            }
        }

        return [$products, $productUnitsByProduct, $fastIds, $slowIds, $deadIds, $lowStockIds];
    }

    /**
     * @return array<int, Customer>
     */
    private function seedCustomers(CarbonImmutable $createdAt): array
    {
        $names = [
            ['Pelanggan Umum', '0800-0000-0000', 'Walk-in Customer', 'umum@minimarket.test'],
            ['Ibu Suryani', '0813-2201-4411', 'Perum Griya Asri Blok B4', 'suryani@mail.test'],
            ['Pak Hendro', '0815-7721-9032', 'Jl. Melati No. 18', 'hendro@mail.test'],
            ['Warung Mbak Yanti', '0812-8834-1200', 'Jl. Kenanga No. 5', 'yanti.warung@mail.test'],
            ['Ibu Kartini', '0856-9102-3318', 'Komplek Permata Hijau C2', 'kartini@mail.test'],
            ['Pak Joko Susilo', '0819-4412-8876', 'Jl. Flamboyan No. 27', 'joko.s@mail.test'],
            ['Nadia Putri', '0821-5509-1123', 'Kost Sakura Kamar 12', 'nadia.p@mail.test'],
            ['Kantin Sekolah Harapan', '0811-2901-7765', 'Jl. Pendidikan No. 10', 'kantin@harapan.test'],
            ['Pak Darmawan', '0817-6632-4490', 'Perum Taman Kota A9', 'darmawan@mail.test'],
            ['Ibu Ratna Dewi', '0813-9087-2314', 'Jl. Anggrek No. 31', 'ratnadewi@mail.test'],
        ];

        $customers = [];
        foreach ($names as [$name, $phone, $address, $email]) {
            $customers[] = Customer::create([
                'name' => $name,
                'phone' => $phone,
                'address' => $address,
                'email' => $email,
                'created_at' => $createdAt,
                'updated_at' => $createdAt,
            ]);
        }

        return $customers;
    }

    /**
     * @param  array<int, Supplier>  $suppliers
     * @param  array<int, Product>  $products
     * @param  array<int, ProductUnit>  $units
     */
    private function seedInitialStockPurchaseOrders(
        array $suppliers,
        array $products,
        array $units,
        User $warehouse,
        User $admin,
        FinancialAccount $bankBca,
        FinancialCategory $expPoCat,
        CarbonImmutable $startDate
    ): void {
        $chunks = array_chunk($products, (int) ceil(count($products) / count($suppliers)));

        foreach ($chunks as $idx => $chunk) {
            $supplier = $suppliers[$idx % count($suppliers)];
            $orderDate = $startDate->subDays(2);
            $receivedAt = $startDate->setTime(9, 30);

            $this->createCompletedPurchaseOrder(
                $supplier,
                $chunk,
                $units,
                $warehouse,
                $admin,
                $bankBca,
                $expPoCat,
                $orderDate,
                $receivedAt,
                $orderDate->addDays((int) $supplier->payment_term_days),
                PaymentStatus::Paid,
                1.0,
                $receivedAt->addDays(10),
                'Stok pembukaan operasional minimarket.'
            );
        }
    }

    /**
     * @param  array<int, Supplier>  $suppliers
     * @param  array<int, Product>  $products
     * @param  array<int, ProductUnit>  $units
     */
    private function seedMonthlyPurchaseOrders(
        array $suppliers,
        array $products,
        array $units,
        User $warehouse,
        User $supervisor,
        User $admin,
        FinancialAccount $bankBca,
        FinancialCategory $expPoCat,
        CarbonImmutable $startDate,
        CarbonImmutable $now
    ): void {
        // Months 1 to 4: regular restock POs (all paid)
        for ($month = 0; $month < 4; $month++) {
            $baseMonthDate = $startDate->addMonths($month)->addDays(12);
            foreach ($suppliers as $sIdx => $supplier) {
                $picked = $this->pickRandomProducts($products, 5, 8);
                $orderDate = $baseMonthDate->addDays($sIdx * 3);
                $receivedAt = $orderDate->addDays(2)->setTime(10, 15);
                $dueDate = $receivedAt->addDays((int) $supplier->payment_term_days);

                $this->createCompletedPurchaseOrder(
                    $supplier,
                    $picked,
                    $units,
                    $warehouse,
                    $month % 2 === 0 ? $admin : $supervisor,
                    $bankBca,
                    $expPoCat,
                    $orderDate,
                    $receivedAt,
                    $dueDate,
                    PaymentStatus::Paid,
                    1.0,
                    $dueDate->subDays(3),
                    'Restok rutin bulan ke-'.($month + 1)
                );
            }
        }

        // Aging payables scenarios across all buckets (current, 1-30, 31-60, 61-90, >90)
        $agingConfigs = [
            // Overdue > 90 days (unpaid)
            [$suppliers[0], $now->subDays(125), $now->subDays(100), PaymentStatus::Unpaid, 0.0, 'Tagihan supplier tertunda > 90 hari'],
            // Overdue 61-90 days (partial)
            [$suppliers[1], $now->subDays(95), $now->subDays(72), PaymentStatus::Partial, 0.4, 'Pembayaran termin bertahap (61-90 hari)'],
            // Overdue 31-60 days (unpaid)
            [$suppliers[2], $now->subDays(70), $now->subDays(45), PaymentStatus::Unpaid, 0.0, 'Hutang dagang jatuh tempo 31-60 hari'],
            // Overdue 1-30 days (partial)
            [$suppliers[3], $now->subDays(45), $now->subDays(18), PaymentStatus::Partial, 0.5, 'Pelunasan sebagian 50% (1-30 hari)'],
            // Overdue 1-30 days (unpaid)
            [$suppliers[4], $now->subDays(38), $now->subDays(9), PaymentStatus::Unpaid, 0.0, 'Hutang dagang baru melewati jatuh tempo'],
            // Current (belum jatuh tempo)
            [$suppliers[5], $now->subDays(10), $now->addDays(14), PaymentStatus::Unpaid, 0.0, 'PO restok terbaru, belum jatuh tempo'],
            [$suppliers[0], $now->subDays(5), $now->addDays(25), PaymentStatus::Partial, 0.3, 'DP 30% pembelian stok bulan berjalan'],
        ];

        foreach ($agingConfigs as [$supplier, $orderDate, $dueDate, $payStatus, $paidRatio, $note]) {
            $picked = $this->pickRandomProducts($products, 4, 6);
            $receivedAt = $orderDate->addDays(2)->setTime(11, 0);
            $payDate = $paidRatio > 0 ? $receivedAt->addDays(5) : null;

            $this->createCompletedPurchaseOrder(
                $supplier,
                $picked,
                $units,
                $warehouse,
                $admin,
                $bankBca,
                $expPoCat,
                $orderDate,
                $receivedAt,
                $dueDate,
                $payStatus,
                $paidRatio,
                $payDate,
                $note
            );
        }

        // Extra workflow POs for UI completeness: 1 Draft, 1 Pending Approval
        $draftPo = PurchaseOrder::create([
            'po_number' => sprintf('PO-%s-%04d', $now->format('Ym'), $this->poSeq++),
            'supplier_id' => $suppliers[2]->id,
            'user_id' => $warehouse->id,
            'order_date' => $now->toDateString(),
            'expected_date' => $now->addDays(4)->toDateString(),
            'status' => PurchaseOrderStatus::Draft,
            'receiving_status' => ReceivingStatus::Unreceived,
            'payment_status' => PaymentStatus::Unpaid,
            'subtotal' => 2450000,
            'discount_amount' => 0,
            'tax_amount' => 0,
            'total_amount' => 2450000,
            'notes' => 'Draft rencana restok akhir pekan.',
            'created_at' => $now->subHours(3),
            'updated_at' => $now->subHours(3),
        ]);

        foreach (array_slice($products, 0, 3) as $prod) {
            $unit = $units[$prod->id];
            $qty = 3;
            PurchaseOrderItem::create([
                'purchase_order_id' => $draftPo->id,
                'product_id' => $prod->id,
                'product_unit_id' => $unit->id,
                'unit_name' => $unit->unit_name,
                'conversion_factor' => $unit->conversion_factor,
                'quantity_ordered' => $qty,
                'quantity_received' => 0,
                'free_qty_ordered' => 0,
                'free_qty_received' => 0,
                'base_qty_ordered' => $qty * $unit->conversion_factor,
                'base_qty_received' => 0,
                'unit_cost' => $unit->buy_price,
                'discount_amount' => 0,
                'subtotal' => $qty * (float) $unit->buy_price,
            ]);
        }

        $pendingPo = PurchaseOrder::create([
            'po_number' => sprintf('PO-%s-%04d', $now->format('Ym'), $this->poSeq++),
            'supplier_id' => $suppliers[1]->id,
            'user_id' => $warehouse->id,
            'order_date' => $now->subDay()->toDateString(),
            'expected_date' => $now->addDays(3)->toDateString(),
            'status' => PurchaseOrderStatus::PendingApproval,
            'receiving_status' => ReceivingStatus::Unreceived,
            'payment_status' => PaymentStatus::Unpaid,
            'submitted_at' => $now->subDay()->setTime(14, 0),
            'subtotal' => 3800000,
            'discount_amount' => 0,
            'tax_amount' => 0,
            'total_amount' => 3800000,
            'notes' => 'Menunggu persetujuan supervisor/admin untuk restok minuman.',
            'created_at' => $now->subDay(),
            'updated_at' => $now->subDay(),
        ]);

        foreach (array_slice($products, 6, 3) as $prod) {
            $unit = $units[$prod->id];
            $qty = 5;
            PurchaseOrderItem::create([
                'purchase_order_id' => $pendingPo->id,
                'product_id' => $prod->id,
                'product_unit_id' => $unit->id,
                'unit_name' => $unit->unit_name,
                'conversion_factor' => $unit->conversion_factor,
                'quantity_ordered' => $qty,
                'quantity_received' => 0,
                'free_qty_ordered' => 0,
                'free_qty_received' => 0,
                'base_qty_ordered' => $qty * $unit->conversion_factor,
                'base_qty_received' => 0,
                'unit_cost' => $unit->buy_price,
                'discount_amount' => 0,
                'subtotal' => $qty * (float) $unit->buy_price,
            ]);
        }
    }

    /**
     * @param  array<int, Product>  $itemsProducts
     * @param  array<int, ProductUnit>  $units
     */
    private function createCompletedPurchaseOrder(
        Supplier $supplier,
        array $itemsProducts,
        array $units,
        User $warehouse,
        User $approver,
        FinancialAccount $bankBca,
        FinancialCategory $expPoCat,
        CarbonImmutable $orderDate,
        CarbonImmutable $receivedAt,
        CarbonImmutable $dueDate,
        PaymentStatus $paymentStatus,
        float $paidRatio,
        ?CarbonImmutable $paidDate,
        string $notes
    ): void {
        $subtotal = 0.0;
        $lineDefs = [];

        foreach ($itemsProducts as $prod) {
            $unit = $units[$prod->id];
            $qty = mt_rand(2, 6);
            $lineSub = round($qty * (float) $unit->buy_price, 2);
            $subtotal += $lineSub;
            $lineDefs[] = [$prod, $unit, $qty, $lineSub];
        }

        $po = PurchaseOrder::create([
            'po_number' => sprintf('PO-%s-%04d', $orderDate->format('Ym'), $this->poSeq++),
            'supplier_id' => $supplier->id,
            'user_id' => $warehouse->id,
            'received_by' => $warehouse->id,
            'order_date' => $orderDate->toDateString(),
            'expected_date' => $receivedAt->toDateString(),
            'received_at' => $receivedAt,
            'due_date' => $dueDate->toDateString(),
            'status' => PurchaseOrderStatus::Approved,
            'receiving_status' => ReceivingStatus::Received,
            'payment_status' => $paymentStatus,
            'subtotal' => $subtotal,
            'discount_amount' => 0,
            'tax_amount' => 0,
            'total_amount' => $subtotal,
            'submitted_at' => $orderDate->setTime(9, 0),
            'approved_by' => $approver->id,
            'approved_at' => $orderDate->setTime(11, 0),
            'notes' => $notes,
            'created_at' => $orderDate->setTime(8, 30),
            'updated_at' => $receivedAt,
        ]);

        $receipt = PurchaseOrderReceipt::create([
            'receipt_number' => sprintf('GRN-%s-%04d', $receivedAt->format('Ym'), $this->receiptSeq++),
            'purchase_order_id' => $po->id,
            'supplier_delivery_note' => 'SJ-'.$supplier->code.'-'.mt_rand(1000, 9999),
            'received_date' => $receivedAt->toDateString(),
            'received_by' => $warehouse->id,
            'notes' => 'Barang diterima lengkap sesuai surat jalan.',
            'created_at' => $receivedAt,
            'updated_at' => $receivedAt,
        ]);

        foreach ($lineDefs as [$prod, $unit, $qty, $lineSub]) {
            $baseQty = $qty * (int) $unit->conversion_factor;

            $poItem = PurchaseOrderItem::create([
                'purchase_order_id' => $po->id,
                'product_id' => $prod->id,
                'product_unit_id' => $unit->id,
                'unit_name' => $unit->unit_name,
                'conversion_factor' => $unit->conversion_factor,
                'quantity_ordered' => $qty,
                'quantity_received' => $qty,
                'free_qty_ordered' => 0,
                'free_qty_received' => 0,
                'base_qty_ordered' => $baseQty,
                'base_qty_received' => $baseQty,
                'unit_cost' => $unit->buy_price,
                'discount_amount' => 0,
                'subtotal' => $lineSub,
                'expired_date' => $receivedAt->addMonths(mt_rand(8, 18))->toDateString(),
                'created_at' => $orderDate,
                'updated_at' => $receivedAt,
            ]);

            PurchaseOrderReceiptItem::create([
                'purchase_order_receipt_id' => $receipt->id,
                'purchase_order_item_id' => $poItem->id,
                'product_id' => $prod->id,
                'unit_name' => $unit->unit_name,
                'conversion_factor' => $unit->conversion_factor,
                'qty_received' => $qty,
                'free_qty_received' => 0,
                'base_qty_received' => $baseQty,
                'unit_cost' => $unit->buy_price,
                'base_unit_cost' => $prod->buy_price,
                'batch_number' => 'BCH-'.$receivedAt->format('ym').'-'.mt_rand(100, 999),
                'expired_date' => $poItem->expired_date,
                'created_at' => $receivedAt,
                'updated_at' => $receivedAt,
            ]);

            $this->recordStockMovement(
                $prod->id,
                StockMovementType::PurchaseIn,
                PurchaseOrderReceipt::class,
                $receipt->id,
                $baseQty,
                (float) $prod->buy_price,
                "Penerimaan {$receipt->receipt_number}",
                $warehouse->id,
                $receivedAt
            );
        }

        $paidAmount = $paymentStatus === PaymentStatus::Paid
            ? $subtotal
            : ($paymentStatus === PaymentStatus::Partial ? round($subtotal * $paidRatio, 2) : 0.0);
        $remaining = round($subtotal - $paidAmount, 2);

        $payable = AccountPayable::create([
            'payable_number' => sprintf('AP-%s-%04d', $receivedAt->format('Ym'), $this->payableSeq++),
            'purchase_order_id' => $po->id,
            'supplier_id' => $supplier->id,
            'invoice_number' => 'FKT-'.$supplier->code.'-'.mt_rand(10000, 99999),
            'total_amount' => $subtotal,
            'paid_amount' => $paidAmount,
            'remaining_amount' => $remaining,
            'due_date' => $dueDate->toDateString(),
            'status' => $paymentStatus,
            'notes' => $notes,
            'created_at' => $receivedAt,
            'updated_at' => $paidDate ?? $receivedAt,
        ]);

        if ($paidAmount > 0 && $paidDate !== null) {
            $payment = PayablePayment::create([
                'payment_number' => sprintf('PAY-%s-%04d', $paidDate->format('Ym'), $this->paymentSeq++),
                'account_payable_id' => $payable->id,
                'financial_account_id' => $bankBca->id,
                'amount' => $paidAmount,
                'payment_date' => $paidDate->toDateString(),
                'payment_method' => PaymentMethod::Transfer->value,
                'reference_number' => 'TRF-BCA-'.mt_rand(100000, 999999),
                'notes' => $paymentStatus === PaymentStatus::Paid ? 'Pelunasan PO '.$po->po_number : 'Cicilan PO '.$po->po_number,
                'paid_by' => $approver->id,
                'created_at' => $paidDate,
                'updated_at' => $paidDate,
            ]);

            $this->recordFinancialTransaction(
                $bankBca->id,
                $expPoCat->id,
                FinancialTransactionType::Out,
                $paidAmount,
                $paidDate,
                PayablePayment::class,
                $payment->id,
                "Pembayaran hutang {$supplier->name} ({$po->po_number})",
                $approver->id
            );
        }
    }

    /**
     * @param  array<int, User>  $cashierPool
     * @param  array<int, Product>  $productsById
     * @param  array<int, int>  $fastIds
     * @param  array<int, int>  $slowIds
     * @param  array<int, int>  $deadIds
     * @param  array<int, Customer>  $customers
     */
    private function seedDailyOperations(
        CarbonImmutable $startDate,
        CarbonImmutable $now,
        array $cashierPool,
        User $supervisor,
        User $admin,
        CashRegister $reg1,
        CashRegister $reg2,
        array $productsById,
        array $fastIds,
        array $slowIds,
        array $deadIds,
        array $customers,
        FinancialAccount $brankas,
        FinancialAccount $bankBca,
        FinancialCategory $incSalesCat,
        FinancialCategory $expOpexCat
    ): void {
        $txDetailBuffer = [];
        $txPaymentBuffer = [];
        $txGlobalSeq = 1;
        $deadCutoff = $now->subDays(35);

        $totalDays = (int) $startDate->diffInDays($now);

        for ($dayIdx = 0; $dayIdx < $totalDays; $dayIdx++) {
            $day = $startDate->addDays($dayIdx);
            $isWeekend = $day->isWeekend();
            // Gentle growth trend from month 1 to month 6
            $growthFactor = 1.0 + ($dayIdx / max(1, $totalDays)) * 0.25;

            $dailyCashTotal = 0.0;
            $dailyNonCashTotal = 0.0;

            for ($shiftSlot = 0; $shiftSlot < 2; $shiftSlot++) {
                $cashier = $cashierPool[($dayIdx + $shiftSlot) % count($cashierPool)];
                $register = $shiftSlot === 0 ? $reg1 : $reg2;
                $openedAt = $shiftSlot === 0 ? $day->setTime(7, 0) : $day->setTime(14, 30);
                $closedAt = $shiftSlot === 0 ? $day->setTime(14, 30) : $day->setTime(22, 0);

                $startingCash = 500000.0;
                $shiftCashSales = 0.0;
                $shiftNonCashSales = 0.0;
                $shiftRefunds = 0.0;
                $shiftCashOut = 0.0;
                $shiftCashDrop = 0.0;

                $txCount = (int) round((($isWeekend ? mt_rand(6, 10) : mt_rand(4, 8)) * $growthFactor));

                $shift = CashierShift::create([
                    'shift_number' => sprintf('SHF-%s-%d', $day->format('Ymd'), $shiftSlot + 1),
                    'user_id' => $cashier->id,
                    'cash_register_id' => $register->id,
                    'register_name' => $register->name,
                    'status' => CashierShiftStatus::Closed,
                    'opened_at' => $openedAt,
                    'closed_at' => $closedAt,
                    'starting_cash' => $startingCash,
                    'expected_cash' => $startingCash,
                    'actual_cash' => $startingCash,
                    'cash_variance' => 0,
                    'total_cash_sales' => 0,
                    'total_non_cash_sales' => 0,
                    'total_refunds' => 0,
                    'total_cash_in' => 0,
                    'total_cash_out' => 0,
                    'total_cash_drop' => 0,
                    'total_transactions' => 0,
                    'verified_by' => $dayIdx % 2 === 0 ? $supervisor->id : $admin->id,
                    'created_at' => $openedAt,
                    'updated_at' => $closedAt,
                ]);

                $validTxCount = 0;

                for ($t = 0; $t < $txCount; $t++) {
                    $txTime = $openedAt->addMinutes(mt_rand(15, 420));
                    $itemCount = mt_rand(1, 5);
                    $pickedIds = $this->pickSaleProductIds($fastIds, $slowIds, $deadIds, $itemCount, $day->greaterThan($deadCutoff));

                    $subtotal = 0.0;
                    $lineItems = [];
                    foreach ($pickedIds as $pid) {
                        $prod = $productsById[$pid];
                        $qty = mt_rand(1, 4);
                        $unitPrice = (float) $prod->sell_price;
                        $costPrice = (float) $prod->buy_price;
                        $lineSub = round($qty * $unitPrice, 2);
                        $subtotal += $lineSub;

                        $lineItems[] = [
                            'product' => $prod,
                            'qty' => $qty,
                            'unit_price' => $unitPrice,
                            'cost_price' => $costPrice,
                            'subtotal' => $lineSub,
                        ];
                    }

                    $discount = mt_rand(1, 100) <= 12 ? round($subtotal * 0.05, -2) : 0.0;
                    $grandTotal = max(0.0, round($subtotal - $discount, 2));

                    $methodRoll = mt_rand(1, 100);
                    if ($methodRoll <= 52) {
                        $method = PaymentMethod::Cash;
                        $payAccountId = $brankas->id;
                    } elseif ($methodRoll <= 78) {
                        $method = PaymentMethod::Qris;
                        $payAccountId = $bankBca->id;
                    } elseif ($methodRoll <= 92) {
                        $method = PaymentMethod::Debit;
                        $payAccountId = $bankBca->id;
                    } else {
                        $method = PaymentMethod::Transfer;
                        $payAccountId = $bankBca->id;
                    }

                    $isVoided = mt_rand(1, 100) <= 2;
                    $paidAmount = $method === PaymentMethod::Cash
                        ? ceil($grandTotal / 5000) * 5000
                        : $grandTotal;
                    $changeAmount = max(0.0, round($paidAmount - $grandTotal, 2));

                    $customer = mt_rand(1, 100) <= 30
                        ? $customers[mt_rand(1, count($customers) - 1)]
                        : $customers[0];

                    $tx = Transaction::create([
                        'invoice_number' => sprintf('INV-%s-%05d', $day->format('Ymd'), $txGlobalSeq++),
                        'user_id' => $cashier->id,
                        'customer_id' => $customer->id,
                        'cashier_shift_id' => $shift->id,
                        'subtotal' => $subtotal,
                        'discount' => $discount,
                        'discount_amount' => $discount,
                        'tax_amount' => 0,
                        'rounding_amount' => 0,
                        'donation_amount' => 0,
                        'total_amount' => $grandTotal,
                        'grand_total' => $grandTotal,
                        'paid_amount' => $paidAmount,
                        'pay_amount' => $paidAmount,
                        'change_amount' => $changeAmount,
                        'payment_method' => $method->value,
                        'status' => $isVoided ? TransactionStatus::Voided : TransactionStatus::Completed,
                        'voided_by' => $isVoided ? $supervisor->id : null,
                        'voided_at' => $isVoided ? $txTime->addMinutes(5) : null,
                        'void_reason' => $isVoided ? 'Salah input item oleh kasir' : null,
                        'created_at' => $txTime,
                        'updated_at' => $txTime,
                    ]);

                    $firstDetailForReturn = null;
                    foreach ($lineItems as $itemIdx => $line) {
                        /** @var Product $prod */
                        $prod = $line['product'];
                        $detailRow = [
                            'transaction_id' => $tx->id,
                            'product_id' => $prod->id,
                            'product_unit_id' => null,
                            'unit_name_snapshot' => $prod->base_unit,
                            'conversion_factor' => 1,
                            'qty' => $line['qty'],
                            'base_qty' => $line['qty'],
                            'quantity' => (string) $line['qty'],
                            'unit_price' => $line['unit_price'],
                            'cost_price_snapshot' => $line['cost_price'],
                            'buy_price' => $line['cost_price'],
                            'sell_price' => $line['unit_price'],
                            'discount_amount' => 0,
                            'subtotal' => $line['subtotal'],
                            'is_tax_exempt' => (bool) $prod->is_tax_exempt,
                            'is_donation' => false,
                            'created_at' => $txTime,
                            'updated_at' => $txTime,
                        ];

                        if (! $isVoided) {
                            $this->productStock[$prod->id] = max(0, $this->productStock[$prod->id] - $line['qty']);
                        }

                        // Only insert directly via Eloquent if we'll attach a return to this tx (approx 2.5%)
                        if (! $isVoided && $itemIdx === 0 && mt_rand(1, 1000) <= 25) {
                            $firstDetailForReturn = TransactionDetail::create($detailRow);
                        } else {
                            $txDetailBuffer[] = $detailRow;
                        }
                    }

                    $txPaymentBuffer[] = [
                        'transaction_id' => $tx->id,
                        'payment_method' => $method->value,
                        'financial_account_id' => $payAccountId,
                        'amount' => $grandTotal,
                        'reference_number' => $method === PaymentMethod::Cash ? null : strtoupper($method->value).'-'.mt_rand(100000, 999999),
                        'created_at' => $txTime,
                        'updated_at' => $txTime,
                    ];

                    if (! $isVoided) {
                        $validTxCount++;
                        if ($method === PaymentMethod::Cash) {
                            $shiftCashSales += $grandTotal;
                            $dailyCashTotal += $grandTotal;
                        } else {
                            $shiftNonCashSales += $grandTotal;
                            $dailyNonCashTotal += $grandTotal;
                        }

                        // Occasional sales return (~2.5% of completed transactions)
                        if ($firstDetailForReturn !== null) {
                            $retQty = 1;
                            $refundAmt = (float) $firstDetailForReturn->unit_price;
                            $isRestockable = mt_rand(1, 100) <= 75;
                            $retTime = $txTime->addMinutes(mt_rand(20, 90));

                            $salesReturn = SalesReturn::create([
                                'return_number' => sprintf('RET-%s-%04d', $day->format('Ym'), $this->returnSeq++),
                                'transaction_id' => $tx->id,
                                'cashier_shift_id' => $shift->id,
                                'processed_by' => $cashier->id,
                                'approved_by' => $supervisor->id,
                                'status' => SalesReturnStatus::Completed,
                                'refund_method' => PaymentMethod::Cash->value,
                                'financial_account_id' => $brankas->id,
                                'total_refund_amount' => $refundAmt,
                                'reason' => $isRestockable ? 'Pelanggan salah beli varian' : 'Kemasan rusak saat dibuka',
                                'created_at' => $retTime,
                                'updated_at' => $retTime,
                            ]);

                            SalesReturnItem::create([
                                'sales_return_id' => $salesReturn->id,
                                'transaction_detail_id' => $firstDetailForReturn->id,
                                'product_id' => $firstDetailForReturn->product_id,
                                'unit_name_snapshot' => $firstDetailForReturn->unit_name_snapshot,
                                'conversion_factor' => 1,
                                'qty' => $retQty,
                                'base_qty' => $retQty,
                                'unit_price_snapshot' => $refundAmt,
                                'subtotal_refund' => $refundAmt,
                                'is_restockable' => $isRestockable,
                                'created_at' => $retTime,
                                'updated_at' => $retTime,
                            ]);

                            $tx->updateQuietly([
                                'status' => count($lineItems) === 1 && $firstDetailForReturn->qty === 1
                                    ? TransactionStatus::Refunded
                                    : TransactionStatus::PartiallyRefunded,
                            ]);

                            $shiftRefunds += $refundAmt;
                            $dailyCashTotal = max(0.0, $dailyCashTotal - $refundAmt);

                            if ($isRestockable) {
                                $this->recordStockMovement(
                                    $firstDetailForReturn->product_id,
                                    StockMovementType::SaleReturnIn,
                                    SalesReturn::class,
                                    $salesReturn->id,
                                    $retQty,
                                    (float) $firstDetailForReturn->cost_price_snapshot,
                                    "Retur penjualan {$salesReturn->return_number}",
                                    $cashier->id,
                                    $retTime
                                );
                            }
                        }
                    }

                    if (count($txDetailBuffer) >= 500) {
                        DB::table('transaction_details')->insert($txDetailBuffer);
                        $txDetailBuffer = [];
                    }
                    if (count($txPaymentBuffer) >= 500) {
                        DB::table('transaction_payments')->insert($txPaymentBuffer);
                        $txPaymentBuffer = [];
                    }
                }

                // Occasional shift cash out or cash drop
                if ($shiftCashSales > 400000 && $dayIdx % 3 === 0) {
                    $dropAmt = 300000.0;
                    $shiftCashDrop += $dropAmt;
                    ShiftCashMovement::create([
                        'cashier_shift_id' => $shift->id,
                        'type' => ShiftCashMovementType::CashDrop,
                        'amount' => $dropAmt,
                        'reason' => 'Setor uang tunai ke brankas toko',
                        'financial_account_id' => $brankas->id,
                        'approved_by' => $supervisor->id,
                        'created_by' => $cashier->id,
                        'created_at' => $closedAt->subMinutes(30),
                        'updated_at' => $closedAt->subMinutes(30),
                    ]);
                }

                if ($dayIdx % 10 === 0 && $shiftSlot === 0) {
                    $outAmt = 35000.0;
                    $shiftCashOut += $outAmt;
                    ShiftCashMovement::create([
                        'cashier_shift_id' => $shift->id,
                        'type' => ShiftCashMovementType::CashOut,
                        'amount' => $outAmt,
                        'reason' => 'Beli air galon & kantong plastik darurat',
                        'financial_account_id' => $brankas->id,
                        'approved_by' => $supervisor->id,
                        'created_by' => $cashier->id,
                        'created_at' => $openedAt->addHours(3),
                        'updated_at' => $openedAt->addHours(3),
                    ]);

                    $this->recordFinancialTransaction(
                        $brankas->id,
                        $expOpexCat->id,
                        FinancialTransactionType::Out,
                        $outAmt,
                        $day,
                        CashierShift::class,
                        $shift->id,
                        'Kas keluar shift: beli perlengkapan toko',
                        $cashier->id
                    );
                }

                $expectedCash = round($startingCash + $shiftCashSales - $shiftRefunds - $shiftCashOut - $shiftCashDrop, 2);
                $variance = mt_rand(1, 100) <= 10 ? (mt_rand(0, 1) === 0 ? -2000.0 : 2000.0) : 0.0;
                $actualCash = max(0.0, round($expectedCash + $variance, 2));

                $shift->updateQuietly([
                    'expected_cash' => $expectedCash,
                    'actual_cash' => $actualCash,
                    'cash_variance' => $variance,
                    'total_cash_sales' => round($shiftCashSales, 2),
                    'total_non_cash_sales' => round($shiftNonCashSales, 2),
                    'total_refunds' => round($shiftRefunds, 2),
                    'total_cash_out' => round($shiftCashOut, 2),
                    'total_cash_drop' => round($shiftCashDrop, 2),
                    'total_transactions' => $validTxCount,
                    'closing_notes' => $variance === 0.0 ? 'Rekonsiliasi kas sesuai.' : 'Selisih kecil uang kembalian.',
                ]);
            }

            // Record daily sales cash & non-cash income into financial_transactions
            if ($dailyCashTotal > 0) {
                $this->recordFinancialTransaction(
                    $brankas->id,
                    $incSalesCat->id,
                    FinancialTransactionType::In,
                    round($dailyCashTotal, 2),
                    $day,
                    null,
                    null,
                    'Setoran penjualan tunai POS '.$day->format('d M Y'),
                    $admin->id
                );
            }

            if ($dailyNonCashTotal > 0) {
                $this->recordFinancialTransaction(
                    $bankBca->id,
                    $incSalesCat->id,
                    FinancialTransactionType::In,
                    round($dailyNonCashTotal, 2),
                    $day,
                    null,
                    null,
                    'Settlement QRIS/Debit/Transfer POS '.$day->format('d M Y'),
                    $admin->id
                );
            }
        }

        if ($txDetailBuffer !== []) {
            DB::table('transaction_details')->insert($txDetailBuffer);
        }
        if ($txPaymentBuffer !== []) {
            DB::table('transaction_payments')->insert($txPaymentBuffer);
        }
    }

    /**
     * @param  Collection<string, FinancialCategory>  $finCats
     */
    private function seedMonthlyFinancialEntries(
        CarbonImmutable $startDate,
        CarbonImmutable $now,
        User $admin,
        FinancialAccount $brankas,
        FinancialAccount $bankBca,
        $finCats
    ): void {
        for ($m = 0; $m < 6; $m++) {
            $monthStart = $startDate->addMonths($m)->startOfMonth();
            if ($monthStart->greaterThan($now)) {
                continue;
            }

            $rentDate = $monthStart->addDays(1);
            if ($rentDate->lessThanOrEqualTo($now)) {
                $this->recordFinancialTransaction(
                    $bankBca->id,
                    $finCats['EXP-RENT']->id,
                    FinancialTransactionType::Out,
                    4500000,
                    $rentDate,
                    null,
                    null,
                    'Sewa ruko & pemeliharaan bulan '.$rentDate->format('F Y'),
                    $admin->id
                );
            }

            $utilDate = $monthStart->addDays(5);
            if ($utilDate->lessThanOrEqualTo($now)) {
                $this->recordFinancialTransaction(
                    $bankBca->id,
                    $finCats['EXP-UTILITY']->id,
                    FinancialTransactionType::Out,
                    mt_rand(1650, 2150) * 1000,
                    $utilDate,
                    null,
                    null,
                    'Tagihan listrik, air & internet '.$utilDate->format('F Y'),
                    $admin->id
                );
            }

            $opexDate = $monthStart->addDays(14);
            if ($opexDate->lessThanOrEqualTo($now)) {
                $this->recordFinancialTransaction(
                    $brankas->id,
                    $finCats['EXP-OPEX']->id,
                    FinancialTransactionType::Out,
                    mt_rand(450, 850) * 1000,
                    $opexDate,
                    null,
                    null,
                    'Kertas struk, kantong belanja & kebersihan '.$opexDate->format('F Y'),
                    $admin->id
                );
            }

            $otherIncDate = $monthStart->addDays(18);
            if ($otherIncDate->lessThanOrEqualTo($now)) {
                $this->recordFinancialTransaction(
                    $brankas->id,
                    $finCats['INC-OTHER']->id,
                    FinancialTransactionType::In,
                    750000,
                    $otherIncDate,
                    null,
                    null,
                    'Sewa space display promosi & parkir '.$otherIncDate->format('F Y'),
                    $admin->id
                );
            }

            $salaryDate = $monthStart->addDays(24);
            if ($salaryDate->lessThanOrEqualTo($now)) {
                $this->recordFinancialTransaction(
                    $bankBca->id,
                    $finCats['EXP-SALARY']->id,
                    FinancialTransactionType::Out,
                    14500000,
                    $salaryDate,
                    null,
                    null,
                    'Gaji karyawan kasir, gudang & supervisor '.$salaryDate->format('F Y'),
                    $admin->id
                );
            }

            // Setoran tunai berkala dari Brankas Toko ke Rekening Bank BCA agar saldo bank sehat
            $depositDate = $monthStart->addDays(20);
            if ($depositDate->lessThanOrEqualTo($now)) {
                $this->recordFinancialTransaction(
                    $brankas->id,
                    $finCats['EXP-OTHER']->id,
                    FinancialTransactionType::Out,
                    20000000,
                    $depositDate,
                    null,
                    null,
                    'Setoran tunai Brankas ke Rekening Bank BCA '.$depositDate->format('F Y'),
                    $admin->id
                );
                $this->recordFinancialTransaction(
                    $bankBca->id,
                    $finCats['INC-OTHER']->id,
                    FinancialTransactionType::In,
                    20000000,
                    $depositDate,
                    null,
                    null,
                    'Penerimaan setoran tunai dari Brankas Toko '.$depositDate->format('F Y'),
                    $admin->id
                );
            }
        }
    }

    /**
     * @param  array<int, Product>  $products
     */
    private function seedStockAdjustments(
        CarbonImmutable $startDate,
        CarbonImmutable $now,
        array $products,
        User $warehouse,
        User $supervisor,
        User $admin
    ): void {
        $reasonsOut = [
            StockAdjustmentReason::Damaged,
            StockAdjustmentReason::Expired,
            StockAdjustmentReason::Lost,
            StockAdjustmentReason::InternalUse,
        ];

        // 15 historical approved adjustments across 6 months
        for ($i = 0; $i < 15; $i++) {
            $prod = $products[($i * 2) % count($products)];
            $date = $startDate->addDays(10 + ($i * 11));
            if ($date->greaterThan($now)) {
                $date = $now->subDays(2);
            }

            $isOut = $i % 5 !== 0;
            $qty = mt_rand(1, 5);
            $before = max($qty + 5, $this->productStock[$prod->id]);
            $after = $isOut ? $before - $qty : $before + $qty;
            $cost = (float) $prod->buy_price;
            $impact = $isOut ? -($qty * $cost) : ($qty * $cost);
            $reason = $isOut ? $reasonsOut[$i % count($reasonsOut)] : StockAdjustmentReason::Correction;

            $adj = StockAdjustment::create([
                'adjustment_number' => sprintf('ADJ-%s-%04d', $date->format('Ym'), $this->adjSeq++),
                'product_id' => $prod->id,
                'type' => $isOut ? StockAdjustmentType::Out : StockAdjustmentType::In,
                'reason' => $reason,
                'status' => StockAdjustmentStatus::Approved,
                'qty_before' => $before,
                'qty_change' => $qty,
                'qty_after' => $after,
                'unit_cost_snapshot' => $cost,
                'total_cost_impact' => $impact,
                'notes' => $isOut ? 'Penyesuaian stok rutin: '.$reason->label() : 'Koreksi kelebihan stok fisik di rak',
                'created_by' => $warehouse->id,
                'approved_by' => $i % 2 === 0 ? $supervisor->id : $admin->id,
                'approved_at' => $date->setTime(16, 0),
                'created_at' => $date->setTime(14, 0),
                'updated_at' => $date->setTime(16, 0),
            ]);

            $this->recordStockMovement(
                $prod->id,
                $isOut ? StockMovementType::AdjustmentOut : StockMovementType::AdjustmentIn,
                StockAdjustment::class,
                $adj->id,
                $isOut ? -$qty : $qty,
                $cost,
                "Stock Adjustment {$adj->adjustment_number}",
                $warehouse->id,
                $date->setTime(16, 0)
            );
        }

        // 2 Pending adjustments for demo approval workflow
        foreach ([$products[4], $products[14]] as $idx => $prod) {
            $qty = $idx === 0 ? 2 : 3;
            $before = max(10, $this->productStock[$prod->id]);
            StockAdjustment::create([
                'adjustment_number' => sprintf('ADJ-%s-%04d', $now->format('Ym'), $this->adjSeq++),
                'product_id' => $prod->id,
                'type' => StockAdjustmentType::Out,
                'reason' => $idx === 0 ? StockAdjustmentReason::Expired : StockAdjustmentReason::Damaged,
                'status' => StockAdjustmentStatus::Pending,
                'qty_before' => $before,
                'qty_change' => $qty,
                'qty_after' => $before - $qty,
                'unit_cost_snapshot' => $prod->buy_price,
                'total_cost_impact' => -($qty * (float) $prod->buy_price),
                'notes' => 'Menunggu verifikasi & persetujuan supervisor.',
                'created_by' => $warehouse->id,
                'created_at' => $now->subHours(4 + $idx),
                'updated_at' => $now->subHours(4 + $idx),
            ]);
        }
    }

    /**
     * @param  array<string, Category>  $categories
     * @param  array<int, Product>  $products
     */
    private function seedStockOpnames(
        CarbonImmutable $startDate,
        CarbonImmutable $now,
        array $categories,
        array $products,
        User $warehouse,
        User $supervisor,
        User $admin
    ): void {
        // 5 Completed monthly opnames
        for ($m = 0; $m < 5; $m++) {
            $opDate = $startDate->addMonths($m)->endOfMonth()->setTime(21, 0);
            if ($opDate->greaterThan($now->subDays(3))) {
                $opDate = $now->subDays(10 - $m);
            }

            $sampleProducts = array_slice($products, ($m * 5) % 15, 10);
            $varianceItems = 0;
            $totalVarianceValue = 0.0;

            $opname = StockOpname::create([
                'opname_number' => sprintf('OPN-%s-%04d', $opDate->format('Ym'), $this->opnameSeq++),
                'status' => StockOpnameStatus::Completed,
                'category_id' => null,
                'is_blind_count' => true,
                'notes' => 'Stock opname bulanan periode '.$opDate->format('F Y'),
                'started_at' => $opDate->subHours(2),
                'completed_at' => $opDate,
                'created_by' => $warehouse->id,
                'approved_by' => $m % 2 === 0 ? $supervisor->id : $admin->id,
                'total_items_counted' => count($sampleProducts),
                'total_variance_items' => 0,
                'total_variance_value' => 0,
                'created_at' => $opDate->subHours(2),
                'updated_at' => $opDate,
            ]);

            foreach ($sampleProducts as $pIdx => $prod) {
                $sysStock = max(15, $this->productStock[$prod->id]);
                $varianceQty = $pIdx % 4 === 0 ? -mt_rand(1, 3) : ($pIdx === 7 ? 1 : 0);
                $physStock = max(0, $sysStock + $varianceQty);
                $cost = (float) $prod->buy_price;
                $varVal = round($varianceQty * $cost, 2);

                if ($varianceQty !== 0) {
                    $varianceItems++;
                    $totalVarianceValue += $varVal;
                }

                StockOpnameItem::create([
                    'stock_opname_id' => $opname->id,
                    'product_id' => $prod->id,
                    'system_stock' => $sysStock,
                    'physical_stock' => $physStock,
                    'variance_qty' => $varianceQty,
                    'unit_cost_snapshot' => $cost,
                    'variance_value' => $varVal,
                    'notes' => $varianceQty === 0 ? 'Sesuai' : ($varianceQty < 0 ? 'Selisih kurang saat hitung fisik' : 'Kelebihan stok di gudang'),
                    'counted_by' => $warehouse->id,
                    'counted_at' => $opDate->subMinutes(30),
                    'created_at' => $opDate->subHours(2),
                    'updated_at' => $opDate,
                ]);
            }

            $opname->updateQuietly([
                'total_variance_items' => $varianceItems,
                'total_variance_value' => round($totalVarianceValue, 2),
            ]);
        }

        // 1 In-Progress opname for current month (demo active session)
        $catMnm = $categories['MNM'];
        $activeOpname = StockOpname::create([
            'opname_number' => sprintf('OPN-%s-%04d', $now->format('Ym'), $this->opnameSeq++),
            'status' => StockOpnameStatus::InProgress,
            'category_id' => $catMnm->id,
            'is_blind_count' => true,
            'notes' => 'Stock opname kategori Minuman bulan berjalan (sedang dihitung).',
            'started_at' => $now->subHours(2),
            'created_by' => $warehouse->id,
            'total_items_counted' => 2,
            'total_variance_items' => 0,
            'total_variance_value' => 0,
            'created_at' => $now->subHours(2),
            'updated_at' => $now->subHour(),
        ]);

        $mnmProducts = array_values(array_filter($products, fn (Product $p): bool => $p->category_id === $catMnm->id));
        foreach ($mnmProducts as $idx => $prod) {
            $sysStock = max(20, $this->productStock[$prod->id]);
            $counted = $idx < 2;
            StockOpnameItem::create([
                'stock_opname_id' => $activeOpname->id,
                'product_id' => $prod->id,
                'system_stock' => $sysStock,
                'physical_stock' => $counted ? $sysStock : null,
                'variance_qty' => 0,
                'unit_cost_snapshot' => $prod->buy_price,
                'variance_value' => 0,
                'counted_by' => $counted ? $warehouse->id : null,
                'counted_at' => $counted ? $now->subHour() : null,
                'created_at' => $now->subHours(2),
                'updated_at' => $now->subHour(),
            ]);
        }
    }

    /**
     * @param  array<int, Product>  $products
     * @return array<int, Product>
     */
    private function pickRandomProducts(array $products, int $min, int $max): array
    {
        $count = mt_rand($min, min($max, count($products)));
        $keys = array_rand($products, $count);
        $keys = is_array($keys) ? $keys : [$keys];

        $picked = [];
        foreach ($keys as $key) {
            $picked[] = $products[$key];
        }

        return $picked;
    }

    /**
     * @param  array<int, int>  $fastIds
     * @param  array<int, int>  $slowIds
     * @param  array<int, int>  $deadIds
     * @return array<int, int>
     */
    private function pickSaleProductIds(array $fastIds, array $slowIds, array $deadIds, int $count, bool $excludeDead): array
    {
        $picked = [];
        $attempts = 0;

        while (count($picked) < $count && $attempts < 30) {
            $attempts++;
            $roll = mt_rand(1, 100);
            if ($roll <= 75) {
                $id = $fastIds[mt_rand(0, count($fastIds) - 1)];
            } elseif ($roll <= 97 || $excludeDead) {
                $id = $slowIds[mt_rand(0, count($slowIds) - 1)];
            } else {
                $id = $deadIds[mt_rand(0, count($deadIds) - 1)];
            }

            if (! in_array($id, $picked, true)) {
                $picked[] = $id;
            }
        }

        return $picked;
    }

    private function recordStockMovement(
        int $productId,
        StockMovementType $type,
        ?string $refType,
        ?int $refId,
        int $qtyChange,
        float $unitCost,
        string $notes,
        int $userId,
        CarbonImmutable $at
    ): void {
        $before = $this->productStock[$productId] ?? 0;
        $after = max(0, $before + $qtyChange);
        $this->productStock[$productId] = $after;

        $this->stockMovementBuffer[] = [
            'product_id' => $productId,
            'type' => $type->value,
            'reference_type' => $refType,
            'reference_id' => $refId,
            'stock_before' => $before,
            'qty_change' => $qtyChange,
            'stock_after' => $after,
            'unit_cost' => $unitCost,
            'notes' => $notes,
            'created_by' => $userId,
            'created_at' => $at,
            'updated_at' => $at,
        ];

        if (count($this->stockMovementBuffer) >= 500) {
            DB::table('stock_movements')->insert($this->stockMovementBuffer);
            $this->stockMovementBuffer = [];
        }
    }

    private function recordFinancialTransaction(
        int $accountId,
        int $categoryId,
        FinancialTransactionType $type,
        float $amount,
        CarbonImmutable $date,
        ?string $refType,
        ?int $refId,
        string $description,
        int $userId
    ): void {
        $before = $this->accountBalances[$accountId] ?? 0.0;
        $after = $type === FinancialTransactionType::In
            ? round($before + $amount, 2)
            : round($before - $amount, 2);
        $this->accountBalances[$accountId] = $after;

        $this->finTxBuffer[] = [
            'transaction_number' => sprintf('FIN-%s-%05d', $date->format('Ym'), $this->finTxSeq++),
            'financial_account_id' => $accountId,
            'financial_category_id' => $categoryId,
            'type' => $type->value,
            'amount' => round($amount, 2),
            'balance_before' => $before,
            'balance_after' => $after,
            'transaction_date' => $date->toDateString(),
            'reference_type' => $refType,
            'reference_id' => $refId,
            'description' => $description,
            'created_by' => $userId,
            'created_at' => $date->setTime(22, 15),
            'updated_at' => $date->setTime(22, 15),
        ];

        if (count($this->finTxBuffer) >= 500) {
            DB::table('financial_transactions')->insert($this->finTxBuffer);
            $this->finTxBuffer = [];
        }
    }

    private function flushBuffers(): void
    {
        if ($this->stockMovementBuffer !== []) {
            DB::table('stock_movements')->insert($this->stockMovementBuffer);
            $this->stockMovementBuffer = [];
        }

        if ($this->finTxBuffer !== []) {
            DB::table('financial_transactions')->insert($this->finTxBuffer);
            $this->finTxBuffer = [];
        }
    }
}

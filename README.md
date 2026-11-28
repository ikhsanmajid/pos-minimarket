# Minimarket POS & Sistem Operasional Ritel (Mini-ERP)

[![Tests](https://github.com/ikhsanmajid/pos-minimarket/actions/workflows/tests.yml/badge.svg)](https://github.com/ikhsanmajid/pos-minimarket/actions/workflows/tests.yml)
![Laravel](https://img.shields.io/badge/Laravel-12.x-FF2D20?logo=laravel&logoColor=white)
![React](https://img.shields.io/badge/React-19.x-61DAFB?logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white)
![Inertia.js](https://img.shields.io/badge/Inertia.js-2.x-9553E9?logo=inertia&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4.x-06B6D4?logo=tailwindcss&logoColor=white)
![Pest](https://img.shields.io/badge/Tested_with-Pest-F472B6)

Aplikasi **Point of Sale (POS) dan Manajemen Operasional Ritel** *full-stack* yang dirancang khusus untuk kebutuhan bisnis minimarket modern. Dibangun menggunakan **Laravel, Inertia.js, React (TypeScript), Tailwind CSS, dan shadcn/ui**, sistem ini melampaui aplikasi kasir CRUD sederhana dengan mengintegrasikan manajemen shift kasir, inventaris multi-satuan (*Multi-UOM*), alur pengadaan barang (*Procurement*), utang usaha (*Accounts Payable*), pembukuan keuangan, analitik berbasis peran (*Role-Based Dashboard*), serta pencatatan audit aktivitas yang komprehensif.

> **[Opsional] Live Demo:** `[https://url-demo-anda.com]` *(Lihat daftar [Akun Demo](#akun-demo) di bawah)*

---

## Pratinjau Aplikasi

| Terminal Kasir (POS) & Split Payment | Dashboard Analitik Berbasis Peran |
| :---: | :---: |
| ![Terminal POS](docs/screenshots/pos-terminal.png) | ![Dashboard](docs/screenshots/dashboard.png) |

| Purchase Order & Penerimaan Barang | Manajemen Shift Kasir & Z-Report |
| :---: | :---: |
| ![Purchase Order](docs/screenshots/purchase-order.png) | ![Shift Z-Report](docs/screenshots/shift-z-report.png) |

*(Catatan: Simpan tangkapan layar aplikasi Anda di folder `docs/screenshots/` agar pratinjau di atas tampil otomatis di GitHub.)*

---

## Keunggulan Arsitektur & Engineering

Proyek ini dirancang mengikuti praktik rekayasa perangkat lunak standar produksi untuk menyelesaikan tantangan nyata di operasional ritel:

* **Arsitektur Berlapis (*Service-Layer Architecture*):** Logika bisnis inti dipisahkan secara tegas dari *controller* ke dalam **12 Domain Services** terdedikasi (`PosTransactionService`, `PurchaseOrderService`, `FinanceService`, `CashierShiftService`, `StockOpnameService`, `SalesReturnService`, `GoodsReceiptService`, dan lainnya) sehingga mudah diuji dan dipelihara.
* **Keamanan Tipe End-to-End (*Type Safety*):** Menggunakan **19 PHP Enums** di sisi *backend* untuk memodelkan status transaksi, metode pembayaran, peran pengguna, hingga mode pembulatan, dipadukan dengan definisi **TypeScript** yang ketat di sisi *frontend*.
* **Keamanan Berlapis (*Defense-in-Depth*):** Perlindungan akses ditegakkan melalui **14 Laravel Policies** (RBAC), **31 Form Request** untuk isolasi validasi, *custom validation rules* (`BarcodeExists`, `CategoryExists`), middleware khusus (`EnsureHasOpenShift`) untuk mencegah transaksi di luar sesi shift aktif, serta **Verifikasi PIN Supervisor** untuk aksi sensitif (pembatalan transaksi, retur, dan otorisasi khusus).
* **Standar Kualitas & Pengujian Otomatis:** Dilengkapi **13 Pest Feature Test Suites** yang memverifikasi integritas stok dan keuangan, analisis statis (**PHPStan**), standar pemformatan kode (**Laravel Pint**), **Dependabot**, serta pipeline CI otomatis via **GitHub Actions**.
* **Auditabilitas Penuh (*Audit Trail*):** Pencatatan log aktivitas terstruktur menggunakan `Spatie Activitylog` yang mengacu pada [Panduan Activity Log](./ACTIVITY_LOG_GUIDELINES.md), lengkap dengan fitur perbandingan perubahan (*diff viewer*) pada pengguna, produk, pemasok, hingga transaksi operasional.

---

## Modul & Fitur Utama

### 1. Terminal Kasir (*Point of Sale*)
* Antarmuka kasir responsif dengan pencarian produk/barcode cepat dan pemilihan satuan produk (*Multi-UOM*).
* **Pembayaran Ganda & Terpisah (*Split / Multi-Method Payment*)** melalui `transaction_payments`, dukungan produk bebas pajak (*tax-exempt*), konfigurasi mode pembulatan harga, serta fitur donasi pelanggan.
* **Tahan & Lanjutkan Transaksi (*Hold & Resume Bills*)** untuk menangani antrean pelanggan yang tertunda tanpa menghapus keranjang belanja.
* **Pembatalan (*Void*) & Retur Penjualan (*Sales Return*)** dengan pengembalian stok otomatis, penyesuaian jurnal keuangan, serta wajib otorisasi **PIN Supervisor**.
* **Cetak Struk Thermal (`58mm` / `80mm`)** dilengkapi pratinjau langsung (*live receipt preview*) pada halaman Pengaturan Toko.

### 2. Mesin Kasir & Manajemen Shift (*Cashier Shifts*)
* Pengelolaan beberapa terminal/mesin kasir (`CashRegister`) dengan proteksi middleware `EnsureHasOpenShift` agar kasir tidak dapat melakukan *checkout* sebelum membuka shift.
* Siklus shift lengkap: pencatatan modal awal (*opening float*), arus kas masuk/keluar di tengah shift (`ShiftCashMovement`), perhitungan selisih kas sistem vs. fisik (*variance*), serta cetak **Laporan Tutup Shift (Z-Report)**.

### 3. Manajemen Inventaris & Multi-Satuan (*Multi-UOM*)
* Pengelolaan satuan dasar (*base unit*) dan satuan konversi (`ProductUnit`), memungkinkan pembelian dalam jumlah besar (karton/dus/pak) dan penjualan eceran (pcs) dengan konversi stok otomatis.
* **Buku Besar Mutasi Stok (*Stock Movement Ledger*)** yang mencatat setiap pergerakan barang dari penjualan, penerimaan PO, retur, penyesuaian stok, hingga hasil opname.
* **Penyesuaian Stok (*Stock Adjustment*)** dilengkapi kategori alasan serta alur persetujuan (*approve/reject*).
* **Sesi Stock Opname** lengkap dengan pencatatan hitung fisik, kalkulasi selisih secara *real-time*, finalisasi penyesuaian stok otomatis, serta ekspor **Laporan PDF Stock Opname**.

### 4. Pengadaan Barang (*Procurement*) & Utang Usaha (*Accounts Payable*)
* Alur lengkap **Purchase Order (PO)**: pembuatan draf, persetujuan/penolakan, perhitungan diskon & pajak, serta ekspor dokumen **PDF Purchase Order**.
* **Penerimaan Barang (*Goods Receiving*)** parsial maupun penuh (`PurchaseOrderReceipt`) yang langsung memperbarui stok inventaris dan menghasilkan dokumen **PDF Bukti Penerimaan Barang**.
* Pencatatan **Utang Usaha (*Account Payable*)** otomatis dari penerimaan PO beserta riwayat pembayaran ke pemasok (`PayablePayment`).

### 5. Manajemen Keuangan (*Finance*)
* Pelacakan saldo multi-akun keuangan (`FinancialAccount`), pengelompokan kategori pemasukan/pengeluaran (`FinancialCategory`), dan pencatatan transaksi buku besar (`FinancialTransaction`) yang terintegrasi otomatis dengan penjualan POS, rekonsiliasi shift, dan pembayaran pemasok.

### 6. Dashboard Berbasis Peran & Log Aktivitas
* Tampilan *dashboard* yang disesuaikan untuk **4 peran pengguna**: `Admin`, `Supervisor`, `Cashier` (Kasir), dan `Warehouse` (Gudang)—lengkap dengan grafik interaktif serta kartu peringatan yang dapat langsung ditindaklanjuti (*actionable alerts*).
* Halaman **Log Aktivitas** terpusat dengan filter pencarian lanjutan, dialog detail perubahan data, dan tab riwayat perubahan di masing-masing modul master data.

---

## Teknologi yang Digunakan (*Tech Stack*)

| Lapisan | Teknologi |
| :--- | :--- |
| **Backend** | PHP, Laravel, Eloquent ORM, MySQL / PostgreSQL |
| **Frontend** | Inertia.js, React, TypeScript, Vite |
| **UI & Styling** | Tailwind CSS, shadcn/ui, Lucide Icons, TanStack Table, Mode Terang/Gelap (*Dark/Light Mode*) |
| **Dokumen & Cetak** | Template Blade PDF (PO, Goods Receipt, Stock Opname), Cetak Struk Thermal & Z-Report |
| **Audit & Keamanan** | Spatie Activitylog, Laravel Policies (RBAC), Supervisor PIN Service |
| **Testing & QA** | Pest PHP, PHPStan, Laravel Pint, GitHub Actions CI, Dependabot |

---

## Gambaran Arsitektur Direktori

```text
app/
├── Enums/               # 19 domain enum (status alur kerja, metode bayar, pembulatan, peran)
├── Http/
│   ├── Controllers/     # 20 controller ramping yang mendelegasikan proses ke lapisan service
│   ├── Middleware/      # Shared props Inertia & proteksi shift (EnsureHasOpenShift)
│   └── Requests/        # 31 class Form Request untuk validasi input terisolasi
├── Models/              # 29 Eloquent model (POS, inventaris, PO, shift, utang, & keuangan)
├── Policies/            # 14 policy otorisasi granular berbasis peran (RBAC)
├── Rules/               # Aturan validasi kustom (BarcodeExists, CategoryExists)
└── Services/            # 12 domain service yang membungkus logika bisnis & transaksi DB

resources/
├── js/
│   ├── components/      # Komponen reusable (DataTable, ShiftGuard, ReceiptPrint, SupervisorPin, shadcn/ui)
│   ├── pages/POS/       # Halaman modular per domain (Cashier, Dashboard, Inventory, PO, Shifts, Finance, dll.)
│   └── types/           # Definisi tipe TypeScript bersama
└── views/pdf/           # Template Blade PDF untuk Purchase Order, Goods Receipt, dan Stock Opname

tests/
└── Feature/             # 13 Pest feature test suite untuk seluruh alur kerja kritis
```

---

## Pengujian & Kualitas Kode

Rangkaian pengujian difokuskan pada integritas data transaksional—memastikan akurasi mutasi stok, keseimbangan catatan keuangan, kepatuhan aturan shift, dan batasan hak akses antar peran.

| Test Suite | Fokus Pengujian |
| :--- | :--- |
| `PosCheckoutTest` | Kalkulasi checkout, split payment, produk bebas pajak, pembulatan, donasi, & hold bill |
| `TransactionVoidAndReturnTest` | Otorisasi void, retur penjualan parsial/penuh, pengembalian stok & pembalikan kas |
| `CashierShiftTest` & `CashRegisterTest` | Siklus buka/tutup shift, mutasi kas shift, & penegakan middleware shift aktif |
| `PurchaseOrderWorkflowTest` & `PurchaseOrderReceivingAndFinanceTest` | Persetujuan PO, penerimaan barang, pembaruan stok multi-UOM, utang usaha & pembayaran |
| `StockOpnameAndAdjustmentTest` | Sesi hitung fisik opname, finalisasi selisih stok, & alur persetujuan adjustment |
| `ProductMultiUomTest` & `ProductActivityHistoryTest` | Logika konversi multi-satuan produk & verifikasi log audit produk |
| `RoleAccessControlTest` & `DashboardRoleBasedTest` | Penegakan hak akses policy (RBAC) & metrik dashboard per peran pengguna |
| `StoreSettingTest` & `ModuleSummaryStatsTest` | Pengaturan toko/struk serta validasi agregasi kartu ringkasan KPI modul |

Jalankan pemeriksaan kualitas secara lokal:

```bash
# Menjalankan seluruh feature test dengan Pest
php artisan test

# Menjalankan analisis statis dengan PHPStan
./vendor/bin/phpstan analyse

# Memeriksa standar penulisan kode dengan Laravel Pint
./vendor/bin/pint --test

# Memeriksa tipe TypeScript pada frontend
npx tsc --noEmit
```

---

## Panduan Instalasi Lokal

### Prasyarat
* PHP >= 8.2 & Composer
* Node.js >= 20 & npm
* Database MySQL atau PostgreSQL

### Langkah Instalasi

1. **Kloning repositori**
   ```bash
   git clone https://github.com/ikhsanmajid/pos-minimarket.git
   cd pos-minimarket
   ```

2. **Instal dependensi backend & frontend**
   ```bash
   composer install
   npm install
   ```

3. **Konfigurasi file environment**
   ```bash
   cp .env.example .env
   php artisan key:generate
   ```
   Sesuaikan konfigurasi database di file `.env` (`DB_CONNECTION`, `DB_HOST`, `DB_DATABASE`, `DB_USERNAME`, `DB_PASSWORD`).

4. **Jalankan migrasi & seeder database**
   ```bash
   php artisan migrate --seed
   php artisan storage:link
   ```

5. **Jalankan server pengembangan**
   ```bash
   # Terminal 1 - Server backend Laravel
   php artisan serve

   # Terminal 2 - Server frontend Vite
   npm run dev
   ```
   Buka aplikasi di browser melalui `http://localhost:8000`.

---

## Akun Demo

*(Dibuat otomatis melalui `database/seeders/UserSeeder.php` — silakan sesuaikan dengan data seeder aktual Anda)*

| Peran | Email | Kata Sandi | PIN Supervisor |
| :--- | :--- | :--- | :--- |
| **Admin** | `admin@example.com` | `password` | `123456` |
| **Supervisor** | `supervisor@example.com` | `password` | `123456` |
| **Kasir (Cashier)** | `cashier@example.com` | `password` | `—` |
| **Gudang (Warehouse)** | `warehouse@example.com` | `password` | `—` |

---

## Dokumentasi Tambahan

* [Panduan Activity Log](./ACTIVITY_LOG_GUIDELINES.md) — Standar penulisan, kategori, dan praktik terbaik pencatatan *audit trail* pada aplikasi.

---

## Pengembang

**Ikhsan Majid**  
Full-Stack Web Developer (Laravel · React · TypeScript)  
* GitHub: [@ikhsanmajid](https://github.com/ikhsanmajid)
* LinkedIn: `[https://linkedin.com/in/profil-anda]`
* Email: `[email.anda@example.com]`

## Lisensi

Proyek ini bersifat *open-source* di bawah lisensi [MIT License](LICENSE).
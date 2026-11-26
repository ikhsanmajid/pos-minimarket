# POS Minimarket — Retail Operations & Point of Sale System

![Laravel](https://img.shields.io/badge/Laravel-13-FF2D20?style=flat-square&logo=laravel&logoColor=white)
![React](https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178C6?style=flat-square&logo=typescript&logoColor=white)
![Inertia.js](https://img.shields.io/badge/Inertia.js-v3-9553E9?style=flat-square&logo=inertia&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-v4-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white)
![Pest](https://img.shields.io/badge/Pest-v5-F28D1A?style=flat-square)
![License](https://img.shields.io/badge/License-MIT-green?style=flat-square)

> **Status:** Active Development (*Work in Progress*) — README ini bersifat sementara dan akan terus diperbarui seiring penyelesaian modul berikutnya.

Aplikasi **Point of Sale (POS) & Retail Operations** berbasis web untuk operasional minimarket modern. Dirancang bukan hanya sebagai layar kasir, melainkan sebagai sistem terintegrasi yang menghubungkan **pengadaan barang (Purchase Order Multi-UOM)**, **kontrol stok**, **manajemen shift kasir dengan Blind Closing**, **buku besar keuangan & hutang usaha**, serta **audit trail menyeluruh**.

---

## Mengapa Proyek Ini Dibangun?

Operasional minimarket di lapangan sering menghadapi celah pada empat titik kritis:
1. **Selisih kas (*cash variance*) saat pergantian shift** karena kasir dapat melihat ekspektasi kas sistem sebelum menghitung uang fisik.
2. **Ketidaksinkronan satuan beli dan satuan jual** (beli dalam *karton/dus*, jual dalam *pcs/renteng*).
3. **Proses pengadaan tanpa kontrol persetujuan** dan pencatatan penerimaan parsial yang terpisah dari hutang supplier.
4. **Minimnya jejak audit** ketika terjadi perubahan harga, stok, atau status dokumen.

Proyek ini menjawab keempat masalah tersebut dalam satu arsitektur full-stack yang *type-safe* dan terstruktur.

---

## Sorotan Teknis (*Engineering Highlights*)

- **Blind Closing & Kontrol Selisih Kas:** Saat shift berjalan, ekspektasi kas sistem disembunyikan dari kasir. Penutupan shift mencatat rincian pecahan uang (*denomination breakdown*), menerapkan ambang batas otorisasi **PIN Supervisor** untuk *Cash Out* dan selisih kas, menghasilkan **Z-Report**, serta menyinkronkan arus kas otomatis ke modul Keuangan.
- **Siklus Pengadaan Multi-UOM End-to-End:** Mendukung konversi satuan bertingkat dari pembuatan **Purchase Order** → alur **Approval** (*Submit, Approve, Reject, Revise, Cancel*) → **Penerimaan Barang Parsial/Penuh (LPB)** → pembentukan **Hutang Usaha (AP)** → **Pelunasan bertahap**, lengkap dengan ekspor dokumen **PDF** (PO & LPB).
- **Type-Safe Full-Stack dengan Inertia v3 & Wayfinder:** Menggabungkan Laravel 13, Inertia.js v3, React 19, TypeScript, dan **Laravel Wayfinder** untuk pemanggilan route/controller yang sepenuhnya *typed* dari frontend tanpa hardcoded URL.
- **Arsitektur DataTable & Design System Konsisten:** Menggunakan TanStack Table v9 (*fixed layout*), *dual sorting* (header tabel + toolbar dropdown dengan resolusi konflik), filter server-side dengan debounce, serta panduan UI terdokumentasi di [rules.md](rules.md).
- **Audit Trail Terpadu:** Seluruh perubahan data lintas modul dicatat dengan `spatie/laravel-activitylog` dan ditampilkan dalam dialog perbandingan *Old vs New* yang seragam.

---

## Fitur Lengkap

### 1. Autentikasi, Profil, & Hak Akses (RBAC)
- Login dengan proteksi *rate-limiting* (`throttle:5,1`) dan manajemen sesi.
- Pengaturan hak akses berbasis peran (*Role-Based Access Control*) untuk **Admin**, **Supervisor**, **Gudang (*Warehouse*)**, dan **Kasir (*Cashier*)**.
- Halaman profil pribadi untuk memperbarui informasi akun dan kata sandi.

| Peran | Fokus Operasional Utama |
| :--- | :--- |
| **Admin** | Kontrol penuh seluruh modul, persetujuan PO, manajemen pengguna, keuangan, dan audit log |
| **Supervisor** | Pemantauan shift aktif toko, otorisasi PIN (Cash Out & selisih kas), riwayat shift, dan pengawasan operasional |
| **Warehouse** | Manajemen master produk & Multi-UOM, kategori, supplier, pembuatan PO, dan penerimaan barang (LPB) |
| **Cashier** | Buka/tutup shift (*Blind Closing*), mutasi kas shift, dan operasional terminal kasir POS |

### 2. Dashboard Berbasis Peran
- Tampilan dashboard khusus yang menyesuaikan peran pengguna (Admin, Supervisor, Gudang, Kasir).
- Ringkasan metrik operasional, visualisasi grafik (*Recharts*), dan kartu peringatan aksi cepat (*Actionable Alerts*).

### 3. Sesi Shift Kasir, Terminal POS, & Rekonsiliasi Kas
- **Shift Guard pada Terminal Kasir:** Memastikan kasir membuka sesi shift aktif sebelum melakukan transaksi.
- **Buka Shift:** Pencatatan mesin kasir (*register*) dan modal awal (*starting cash*).
- **Mutasi Kas Tengah Shift:** Pencatatan **Cash In**, **Cash Out**, dan **Cash Drop** terhubung ke akun keuangan, lengkap dengan otorisasi PIN Supervisor pada nominal tertentu.
- **Blind Closing & Z-Report:** Input rincian pecahan uang, perhitungan otomatis *cash variance*, riwayat shift dengan filter kasir/status/tanggal/hanya selisih, serta cetak laporan **Z-Report**.

### 4. Manajemen Produk, Kategori, & Multi-UOM
- CRUD produk lengkap dengan barcode, harga beli/jual, stok minimum, gambar produk, dan status aktif/nonaktif.
- **Konversi Multi-UOM:** Satuan tambahan (*unit of measure*), faktor konversi, barcode per satuan, harga beli/jual per satuan, dan satuan default pembelian.
- **Detail Produk:** Tab informasi produk, riwayat mutasi stok, dan riwayat perubahan data.
- **Manajemen Kategori:** CRUD kategori produk dengan pencarian, filter status, dan jumlah produk per kategori.

### 5. Manajemen Supplier & Purchase Order (PO)
- **Master Supplier:** CRUD supplier, detail supplier, riwayat perubahan, serta pencarian asinkron.
- **Purchase Order Multi-UOM:** Pembuatan & pengeditan PO dengan pemilihan produk/satuan, diskon, pajak, dan tanggal jatuh tempo.
- **Approval Workflow:** `Submit`, `Approve`, `Reject` (dengan alasan), `Revise`, `Close Remaining`, dan `Cancel`.
- **Penerimaan Barang (LPB) & Pembayaran:** Pencatatan penerimaan parsial/penuh dengan progres penerimaan, pencatatan pembayaran bertahap/lunas, serta ekspor **PDF** untuk dokumen PO dan LPB (`barryvdh/laravel-dompdf`).

### 6. Keuangan (*Finance*)
- **Akun Keuangan (*Financial Accounts*):** Pengelolaan akun kas/bank, akun default, status aktif, dan saldo.
- **Hutang Usaha (*Account Payables*):** Pelacakan hutang supplier dari PO, status pembayaran, jatuh tempo, dan pencatatan cicilan/pelunasan.
- **Transaksi Keuangan (*Financial Transactions*):** Buku besar arus kas masuk/keluar dari shift kasir dan pembayaran PO dengan filter akun, kategori, tipe, dan rentang tanggal.

### 7. Manajemen Pengguna & Log Aktivitas
- **Manajemen Users:** CRUD pengguna, penetapan peran, status aktif/nonaktif, detail pengguna, dan riwayat perubahan.
- **Log Aktivitas (*Audit Trail*):** Pencatatan otomatis `created`, `updated`, `deleted`, `restored` lintas modul dengan filter modul, kategori log, rentang tanggal, serta dialog perbandingan nilai sebelum dan sesudah.

---

## Cuplikan Antarmuka (*Screenshots*)

> *[Placeholder — tambahkan screenshot halaman Dashboard, Produk Multi-UOM, Purchase Order, dan Riwayat Shift / Z-Report di sini]*

---

## Tech Stack

| Lapisan | Teknologi |
| :--- | :--- |
| **Backend** | PHP 8.3+, Laravel 13, Inertia Laravel v3, Laravel Wayfinder |
| **Frontend** | React 19, TypeScript 5.7, Inertia React v3, Tailwind CSS v4 |
| **UI & Visualisasi** | Base UI / shadcn/ui, TanStack Table v9, Recharts, Lucide React |
| **Integrasi & Paket** | Spatie Laravel Activitylog v5, Laravel DomPDF, Midtrans PHP |
| **Quality & Testing** | Pest v5, Larastan (PHPStan), Laravel Pint, Vite+ |

---

## Instalasi & Menjalankan Secara Lokal

### Prasyarat
- PHP >= 8.3 & Composer
- Node.js >= 22 & npm
- Database (SQLite / MySQL / PostgreSQL)

### Langkah Setup
1. **Clone repository:**
   ```bash
   git clone <url-repository>
   cd pos-minimarket
   ```

2. **Jalankan setup otomatis** (install dependency PHP & JS, salin `.env`, generate app key, migrasi, build aset):
   ```bash
   composer run setup
   ```

3. **Sesuaikan konfigurasi database** pada `.env`, lalu jalankan migrasi jika mengganti koneksi database:
   ```bash
   php artisan migrate
   ```

4. **Jalankan server pengembangan:**
   ```bash
   composer run dev
   ```

---

## Pengujian & Kualitas Kode

```bash
# Typecheck frontend (TypeScript)
npm run types:check

# Build aset produksi
npm run build

# Format kode PHP (Laravel Pint)
composer run lint

# Analisis statis PHP (Larastan / PHPStan)
composer run types:check

# Menjalankan test suite (Pest)
php artisan test

# Menjalankan seluruh pemeriksaan CI (frontend + backend)
composer run ci:check
```

---

## Dokumentasi Internal

- [rules.md](rules.md) — Standar arsitektur `DataTable`, sorting kolom, toolbar pencarian, komponen `Select`, dialog modal, dan konvensi penamaan halaman.

## Lisensi

Proyek ini dirilis di bawah lisensi [MIT](https://opensource.org/licenses/MIT).

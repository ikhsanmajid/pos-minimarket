# Panduan Standar Implementasi Log Aktivitas (Audit Trail)
### Aplikasi POS Minimarket

Dokumen ini adalah pedoman wajib bagi pengembang saat menambahkan fitur baru, model baru, atau alur transaksi pada aplikasi POS Minimarket, agar seluruh aktivitas dan riwayat perubahan data tercatat secara konsisten dan otomatis terintegrasi ke dalam modul **Log Aktivitas** (`/pos/activity-logs`).

---

## 1. Arsitektur & Prinsip Utama

Sistem log aktivitas menggunakan package **`spatie/laravel-activitylog`** dengan arsitektur terpusat:
1. **Enum Kategori Terpusat (`App\Enums\ActivityLogCategory`):** Semua kategori log dikelola melalui Enum ini, bukan ditulis string mentah (*hardcoded*).
2. **Auto-Logging Perubahan Data:** Setiap model master dan transaksi harus mencatat perubahan data atribut penting saat terjadi *create*, *update*, atau *delete*.
3. **Keamanan & Privasi:** Kolom sensitif (seperti `password`, `pin`, `remember_token`) **HARUS DIKECUALIKAN** dari pencatatan log.
4. **Lazy Loading pada Detail:** Tab riwayat perubahan di halaman detail fitur harus dimuat secara *lazy* (`Inertia::optional()`) agar performa halaman utama tetap ringan.

---

## 2. Langkah Demi Langkah Menambahkan Fitur Baru

Misalkan Anda menambahkan fitur baru: **Manajemen Supplier (Pemasok)** atau **Pelanggan (Customer)**.

### Langkah 1: Daftarkan Kategori pada Enum `ActivityLogCategory`
Buka file `app/Enums/ActivityLogCategory.php`, tambahkan case baru:

```php
enum ActivityLogCategory: string
{
    case Auth = 'auth';
    case Product = 'product';
    case User = 'user';
    case Category = 'category';
    case Transaction = 'transaction';
    case Supplier = 'supplier'; // <-- TAMBAHKAN DI SINI
    case Default = 'default';

    public function label(): string
    {
        return match ($this) {
            self::Auth => 'Autentikasi (Login / Logout)',
            self::Product => 'Produk (Master Data)',
            self::User => 'Pengguna & Akun',
            self::Category => 'Kategori Produk',
            self::Transaction => 'Transaksi Penjualan',
            self::Supplier => 'Pemasok / Supplier', // <-- Label deskriptif
            self::Default => 'Master Data (Lainnya)',
        };
    }

    public function shortLabel(): string
    {
        return match ($this) {
            self::Auth => 'Autentikasi',
            self::Product => 'Produk',
            self::User => 'Pengguna',
            self::Category => 'Kategori',
            self::Transaction => 'Transaksi',
            self::Supplier => 'Supplier', // <-- Label singkat untuk badge
            self::Default => 'Master Data',
        };
    }

    public function modelClass(): ?string
    {
        return match ($this) {
            self::Product => Product::class,
            self::User => User::class,
            self::Category => Category::class,
            self::Supplier => Supplier::class, // <-- Class model
            default => null,
        };
    }
}
```

> **Keuntungan:** Begitu didaftarkan di Enum ini, halaman **Log Aktivitas** (`ActivityLogController`) secara otomatis menampilkan kategori ini di filter dropdown lengkap dengan counter jumlah log, tanpa perlu mengubah kode controller sama sekali!

---

### Langkah 2: Terapkan Trait `LogsActivity` pada Model Baru
Buka file model Anda (misalnya `app/Models/Supplier.php`):

```php
<?php

namespace App\Models;

use App\Enums\ActivityLogCategory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Spatie\Activitylog\Models\Concerns\LogsActivity;
use Spatie\Activitylog\Support\LogOptions;

class Supplier extends Model
{
    use LogsActivity, SoftDeletes;

    protected $fillable = [
        'name',
        'phone',
        'email',
        'address',
        'is_active',
    ];

    /**
     * Konfigurasi Log Aktivitas Spatie
     */
    public function getActivitylogOptions(): LogOptions
    {
        return LogOptions::defaults()
            ->useLogName(ActivityLogCategory::Supplier->value) // <-- Gunakan Enum
            ->logOnly(['name', 'phone', 'email', 'address', 'is_active']) // Atribut yang dicatat
            ->logOnlyDirty() // Hanya log jika ada nilai yang benar-benar berubah
            ->dontLogEmptyChanges(); // Jangan buat entri log jika tidak ada perubahan
    }
}
```

---

### Langkah 3: Mencatat Log Aktivitas Kustom (Manual Events)
Untuk peristiwa bisnis yang bukan sekadar CRUD model biasa (contoh: Login/Logout, Buka/Tutup Kasir Shift, Void Transaksi, Cetak Ulang Struk):

Gunakan helper `activity()`:

```php
use App\Enums\ActivityLogCategory;

// Contoh: Saat Void Transaksi Kasir
activity(ActivityLogCategory::Transaction->value)
    ->causedBy(auth()->user())
    ->performedOn($transaction)
    ->withProperties([
        'reason' => $request->input('reason'),
        'total_amount' => $transaction->total_amount,
        'supervisor_id' => $supervisor->id,
    ])
    ->log('Void transaksi kasir');
```

---

### Langkah 4: Menambahkan Tab "Riwayat Perubahan" di Halaman Detail Fitur Baru

Jika fitur Anda memiliki halaman detail (misalnya `DetailSupplier.tsx` atau `DetailProduct.tsx`), tampilkan riwayat perubahannya menggunakan pola **Lazy Loading & DataTable**:

#### A. Controller (`SupplierController@show`):
```php
use Inertia\Inertia;
use Spatie\Activitylog\Models\Activity;

public function show(Request $request, Supplier $supplier): Response
{
    return Inertia::render('POS/Suppliers/DetailSupplier', [
        'supplier' => $supplier,
        // Lazy load menggunakan Inertia::optional()
        'activities' => Inertia::optional(function () use ($request, $supplier) {
            $perPage = $request->integer('per_page', 10);

            $paginated = Activity::forSubject($supplier)
                ->with('causer')
                ->latest('id')
                ->paginate($perPage)
                ->withQueryString();

            return [
                'data' => collect($paginated->items())->map(fn (Activity $act) => [
                    'id' => $act->id,
                    'description' => $act->description,
                    'event' => $act->event,
                    'causer_name' => $act->causer?->name ?? 'Sistem',
                    'causer_role' => $act->causer?->role?->label() ?? null,
                    'attribute_changes' => $act->attribute_changes?->toArray() ?? [],
                    'properties' => $act->properties?->toArray() ?? [],
                    'created_at' => $act->created_at?->format('d M Y H:i:s'),
                    'created_at_human' => $act->created_at?->diffForHumans(),
                ])->all(),
                'current_page' => $paginated->currentPage(),
                'last_page' => $paginated->lastPage(),
                'per_page' => $paginated->perPage(),
                'total' => $paginated->total(),
                'from' => $paginated->firstItem(),
                'to' => $paginated->lastItem(),
            ];
        }),
    ]);
}
```

#### B. Frontend Component:
Gunakan `router.reload({ only: ['activities'] })` saat tab riwayat diklik oleh pengguna, sehingga query log hanya dijalankan saat dibutuhkan saja.

---

## 3. Aturan Keamanan & Best Practices

1. **JANGAN PERNAH** mencatat kolom berikut:
   - `password`
   - `pin`
   - `remember_token`
   - Kredensial API eksternal / kartu pembayaran
2. **Gunakan `logOnlyDirty()` dan `dontLogEmptyChanges()`:**
   - Mencegah tabel `activity_log` bengkak oleh query update yang tidak mengubah nilai apapun.
3. **Format Perubahan Lama vs Baru (`attribute_changes`):**
   - Pada Spatie v5, perbandingan nilai lama dan baru disimpan pada accessor `attribute_changes` (`attribute_changes.old` dan `attribute_changes.attributes`).

---

## 4. Checklist Pengembang

Sebelum menyelesaikan implementasi fitur baru, pastikan:
- [ ] Kategori modul baru telah didaftarkan di `App\Enums\ActivityLogCategory`.
- [ ] Model baru menggunakan trait `LogsActivity`.
- [ ] Method `getActivitylogOptions()` terkonfigurasi dengan `->useLogName()`, `->logOnly()`, `->logOnlyDirty()`, dan `->dontLogEmptyChanges()`.
- [ ] Atribut sensitif tidak dimasukkan ke dalam `logOnly()`.
- [ ] Jika ada halaman detail, tab riwayat perubahan menggunakan `Inertia::optional()`.
- [ ] Buka halaman `/pos/activity-logs` dan pastikan kategori baru muncul di dropdown filter dengan counter yang akurat.

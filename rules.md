# Standard Guidelines & UI Rules: POS Minimarket

Dokumen ini berisi pedoman arsitektur dan konvensi antarmuka pengguna (UI/UX) untuk aplikasi POS Minimarket, khususnya mengenai **DataTable**, **Header & Sorting Kolom**, **Toolbar/Search**, serta **Modal/Dialog**.

Semua pengembang dan modul baru **WAJIB** mematuhi pedoman ini agar konsistensi desain dan pengalaman pengguna terjaga di seluruh sistem.

---

## 1. DataTable & Table Header Architecture

### 1.1 Komponen Bersama (*Single Source of Truth*)
Semua tabel data di antarmuka web dibangun di atas **TanStack Table v9** dengan pembungkus shadcn/ui.
- **Tabel Wrapper:** `@/components/dataTable.tsx` (`DataTable`, `type DataTableColumn`)
- **Pagination:** `@/components/dataTablePagination.tsx` (`DataTablePagination`, `type PaginationMeta`)
- **Sortable Header:** `@/components/dataTableSortHeader.tsx` (`DataTableSortHeader`)

> **ATURAN WAJIB:** Dilarang membuat komponen `SortHeader` lokal di dalam file page/tabel. Selalu impor dan gunakan `DataTableSortHeader` dari `@/components/dataTableSortHeader`.

### 1.2 Lebar Kolom & Header Tetap (*Fixed Table Layout*)
Agar ukuran header dan kolom tabel **tidak berubah-ubah (membesar/mengecil)** saat berpindah halaman paginasi, mengubah filter, atau saat data kosong:
- **Komponen `DataTable` (`@/components/dataTable.tsx`):**
  - Wajib menggunakan `table-fixed w-full` dengan `style={{ minWidth: `${totalSize}px` }}`.
  - Lebar setiap `<TableHead>` dihitung secara proporsional dari `header.getSize() / totalSize * 100%` agar tetap konsisten di semua halaman dan mengisi layar secara proporsional tanpa loncatan layout.
  - Setiap `<TableCell>` wajib menggunakan `overflow-hidden text-ellipsis` (dan gunakan `truncate` atau `whitespace-normal line-clamp-*` pada konten teks panjang di dalam cell).
- **Definisi Kolom (`getColumns`):**
  - **SETIAP kolom wajib mendefinisikan properti `size` dalam satuan piksel realistis** (misalnya `55`, `130`, `170`, `220`, `385`).
  - **Dilarang** mengisi `size` dengan angka terlalu kecil/seperti persentase (misalnya `10`, `14`, `15`, `18`, `20`) atau membiarkan `size` kosong.
- **Tabel HTML Biasa (`<table>` di halaman detail / modal):**
  - Wajib menggunakan `table-fixed w-full` disertai `min-w-[...]` dan lebar `w-[...%]` eksplisit pada setiap `<th>` yang totalnya 100%.

---

## 2. Standar Struktur Kolom Tabel

### 2.1 Kolom Nomor Urut (`No`)
Kolom pertama wajib menampilkan nomor urut yang memperhitungkan halaman paginasi aktif:
```tsx
{
    id: 'no',
    header: 'No',
    cell: (info) => (from ?? 1) + info.row.index,
    size: 55,
}
```
- **Ukuran Lebar:** Wajib `size: 55` (konsisten di semua halaman).
- **Align:** Rata kiri default atau tengah rapi dengan font mono kecil jika diperlukan (`font-mono text-xs`).

---

### 2.2 Kolom Data dengan Sorting (`DataTableSortHeader`)
Setiap kolom yang mendukung pengurutan server-side harus dirender menggunakan `DataTableSortHeader`:

```tsx
{
    accessorKey: 'name',
    header: () => (
        <DataTableSortHeader
            label="Nama Produk"
            field="name"
            tableSort={filters.table_sort}
            tableDirection={filters.table_direction}
            toolbarSort={filters.sort}
            toolbarDirection={filters.direction}
            onSort={onSort}
        />
    ),
    cell: (info) => (
        <span className="font-medium text-foreground">
            {info.getValue<string>()}
        </span>
    ),
}
```

#### Perilaku Standar `DataTableSortHeader`:
1. **Siklus 3-Status (*Tri-State Sorting*):**
   - Klik 1: `asc` (Menaik / A-Z / Terendah) -> Ikon `ArrowUp` berwarna `text-primary`.
   - Klik 2: `desc` (Menurun / Z-A / Tertinggi) -> Ikon `ArrowDown` berwarna `text-primary`.
   - Klik 3: `undefined` (Batal Urutkan / Kembali ke urutan default) -> Ikon `ArrowUpDown` abu-abu transparan (`opacity-30 group-hover:opacity-100`).
2. **Indikator Konflik Toolbar (*Toolbar Priority*):**
   - Jika kolom tersebut sedang diurutkan via dropdown Toolbar (`filters.sort === field`), header kolom tabel akan otomatis **nonaktif** (`cursor-not-allowed`, teks pudar).
   - Menampilkan badge kecil berlabel `Toolbar` dan ikon arah panah toolbar.
   - Menampilkan tooltip penjelasan bahwa kolom sedang dikontrol oleh toolbar untuk mencegah konflik sorting ganda.
3. **Indikator Prioritas Dual Sort:**
   - Jika header tabel dan toolbar sama-sama mengurutkan kolom berbeda, header tabel menampilkan badge angka `1` (`Urutan Utama (Ke-1)`).
4. **Aksesibilitas & Tooltip:**
   - Wajib menyertakan atribut `title` yang dinamis dan deskriptif sesuai kondisi arah sort berikutnya.

---

### 2.3 Kolom Data Khusus (Format Angka, Kode, & Status)

- **Kode / Barcode / Nomor Transaksi:**
  - Font: `font-mono text-xs font-semibold`
  - Warna: `text-primary` jika ada navigasi detail, atau `text-foreground` jika teks biasa.
- **Nilai Uang (Currency IDR):**
  - Font: `font-mono text-xs font-semibold text-foreground`
  - Format: Wajib menggunakan `Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 })`.
- **Status Boolean (Aktif / Nonaktif):**
  - Menggunakan komponen `<Badge>` dari `@/components/ui/badge`.
  - `Aktif`: `<Badge variant="success">Aktif</Badge>`
  - `Nonaktif`: `<Badge variant="secondary">Nonaktif</Badge>`
- **Status Workflow (PO, Order, dll.):**
  - Gunakan badge bergaris halus dengan warna semantik:
    - *Draft*: Slate / Abu-abu
    - *Ordered / Dipesan*: Blue
    - *Partial / Sebagian*: Amber / Orange
    - *Received / Selesai*: Emerald / Green
    - *Cancelled / Dibatalkan*: Rose / Red

---

### 2.4 Kolom Aksi (`Aksi`)
Kolom terakhir untuk aksi baris data (Detail, Edit, Hapus):
```tsx
{
    id: 'actions',
    header: () => <span className="text-right block w-full pr-2">Aksi</span>,
    size: 70, // atau 80 jika berupa button teks
    cell: ({ row }) => (
        <div className="flex justify-end pr-2">
            <RowActionsCell
                data={row.original}
                canEdit={canEdit}
                canDelete={canDelete}
            />
        </div>
    ),
}
```
- **Ukuran Lebar:** `size: 70` (untuk icon dropdown) atau `size: 80` (untuk tombol teks seperti *Detail*).
- **Perataan:** Wajib rata kanan (`text-right` pada header dan `justify-end` pada cell) agar sejajar dengan margin kanan tabel.

---

## 3. Standar Filter, Toolbar Pencarian (`*Search.tsx`), & Komponen `Select`

Semua halaman tabel **WAJIB** menggunakan pola toolbar pencarian yang seragam seperti `ProductSearch.tsx`, `PurchaseOrderSearch.tsx`, dan `ShiftHistorySearch.tsx`.

### 3.1 Struktur & Layout Toolbar
- **Komponen Terpisah:** Letakkan toolbar pada file terpisah di subfolder `component/<Modul>Search.tsx` (bukan ditulis inline di dalam file page utama).
- **Tanpa Card Pembungkus:** Dilarang membungkus toolbar dengan card (`rounded-xl border bg-card p-4`). Gunakan kontainer inline langsung di atas `DataTable`:
  ```tsx
  <div className="mb-4 space-y-3">
      <div className="flex flex-wrap items-center gap-2.5">
          {/* Search Input, Select Filter, Date Input, Urutan, Chip Tabel, Reset */}
      </div>
  </div>
  ```
- **Tinggi Seragam:** Seluruh kontrol di dalam toolbar (input pencarian, `SelectTrigger`, input tanggal, toggle, chip sortir tabel, dan tombol reset) wajib menggunakan tinggi `h-9`.

### 3.2 Input Pencarian Utama
- Wrapper `relative w-full sm:w-64 lg:w-72` dengan ikon `Search` di sebelah kiri (`pointer-events-none`) dan `<Input className="pl-9 pr-8 h-9 text-sm" />`.
- Wajib menggunakan **debounce 300ms** sebelum mengirim `router.visit(..., { preserveState: true, preserveScroll: true, replace: true })` dengan `mergeQuery: { ..., page: 1 }`.
- Wajib menampilkan tombol hapus (`X`) di sisi kanan saat `search && !isLoading`, dan indikator `Loader2` (`animate-spin`) saat `isLoading`.
- Gunakan placeholder spesifik sesuai cakupan pencarian (misal: `"Cari nama atau barcode…"`).

### 3.3 Ketentuan Komponen `Select` (Anti Label Terpotong)
> **ATURAN WAJIB:** Dilarang menggunakan lebar tetap `sm:w-[...]` pada `<SelectTrigger>` di toolbar atau halaman mana pun karena akan memotong label opsi yang panjang.

- **`SelectTrigger`:** Wajib menggunakan lebar fleksibel `w-full sm:w-auto sm:min-w-[...]` dengan tinggi `h-9` (misal `w-full sm:w-auto sm:min-w-[155px] h-9`) agar tombol otomatis menyesuaikan panjang label yang sedang dipilih.
- **`SelectContent`:** Pada komponen bersama `@/components/ui/select.tsx`, `SelectContent` wajib menggunakan `w-auto min-w-(--anchor-width)` (bukan `w-(--anchor-width)`) sehingga popup dropdown ikut melebar mengikuti opsi terpanjang saat dibuka.
- **Render Label Base UI:** Selalu teruskan prop `items={...}` pada `<Select>` dan render label aktif di dalam `<SelectValue>` menggunakan fungsi render `{(val) => items.find((item) => item.value === val)?.label}` agar label tidak menampilkan raw value.
- **State Loading:** Selalu teruskan `disabled={isLoading}` pada setiap `Select` dan kontrol filter.

### 3.4 Filter Tambahan (Relasi, Tanggal, & Toggle)
- **Filter Relasi (Async Select):** Untuk data relasional berjumlah besar (Kategori, Supplier), gunakan async select (`react-select/async`) dengan endpoint pencarian ringan (`limit: 20`).
- **Filter Rentang Tanggal (`Dari` / `Sampai`):** Tampilkan inline dalam baris toolbar dengan pola:
  ```tsx
  <div className="flex items-center gap-1.5">
      <Label htmlFor="date-from" className="text-xs text-muted-foreground whitespace-nowrap">
          Dari:
      </Label>
      <Input id="date-from" type="date" className="h-9 w-[135px] text-xs" />
  </div>
  ```
- **Filter Toggle Boolean (Switch):** Jika ada filter boolean (misal `Hanya Selisih`), sejajarkan dengan tinggi `h-9` menggunakan container `flex h-9 w-full sm:w-auto items-center justify-between gap-2.5 rounded-md border border-input bg-transparent px-3 shadow-xs dark:bg-input/30`.

### 3.5 Dropdown Urutan, Chip Sortir Tabel, & Tombol Reset
- **Dropdown Urutan (`Urutan: Default`):** Dukung pemilihan `sort` + `direction` dan otomatis bersihkan `table_sort`/`table_direction` jika kolom yang dipilih sama dengan header tabel yang sedang aktif.
- **Active Table Sort Chip:** Saat `filters.table_sort` aktif, tampilkan chip `Tabel: <Label> ↑/↓` (`flex h-9 items-center gap-1.5 rounded-md border border-primary/20 bg-primary/5 px-2.5 text-xs text-primary`) dengan tombol `X` untuk menghapus sortir header.
- **Tombol Reset Filter:** Tampilkan saat ada minimal 1 filter/sort aktif menggunakan `<Button variant="outline" size="sm" className="h-9 px-3 text-xs gap-1.5 text-muted-foreground hover:text-foreground border-dashed">` dengan ikon `X`, teks `Reset Filter`, dan badge jumlah filter aktif (`rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary`).
- **Integrasi Paginasi:** `<DataTablePagination>` pada halaman wajib meneruskan `routeUrl` (Wayfinder action) dan `isLoading={isLoading}` agar navigasi halaman tetap mempertahankan query filter.

---

## 4. Standar Modal & Dialog (`Dialog*.tsx`)

Untuk menghindari bug overflow atau isi dialog yang terpotong saat layar kecil atau tabel lebar dirender di dalam dialog:

1. **Struktur Kontainer Dialog (`DialogContent`):**
   - Batasi tinggi maksimal dan gunakan flex vertikal:
     ```tsx
     <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col p-0 gap-0 overflow-hidden">
     ```
2. **Pinned Header (Header Terkunci):**
   ```tsx
   <DialogHeader className="p-6 pb-4 border-b shrink-0">
       <DialogTitle>Judul Modal</DialogTitle>
       <DialogDescription>Deskripsi aksi atau informasi.</DialogDescription>
   </DialogHeader>
   ```
3. **Scrollable Content (Area Isi):**
   ```tsx
   <div className="flex-1 overflow-y-auto overflow-x-hidden p-6 space-y-4">
       {/* Isi Form atau Riwayat Tabel */}
   </div>
   ```
4. **Pinned Footer (Tombol Aksi Terkunci):**
   ```tsx
   <DialogFooter className="p-6 pt-4 border-t shrink-0 flex items-center justify-end gap-2 bg-muted/20">
       <Button variant="outline" onClick={onClose}>Batal</Button>
       <Button type="submit" disabled={isSubmitting}>Simpan</Button>
   </DialogFooter>
   ```

---

## 5. Konvensi Penamaan File Halaman (`resources/js/pages/POS/`)

- **Dilarang menggunakan `Index.tsx`** untuk file halaman utama modul.
- **Gunakan nama file `PascalCase` sesuai nama modul/domain**, contoh:
  - `POS/Product/Product.tsx`
  - `POS/Categories/Category.tsx`
  - `POS/Suppliers/Supplier.tsx`
  - `POS/Users/Users.tsx`
  - `POS/ActivityLogs/ActivityLog.tsx`
  - `POS/Profile/Profile.tsx`
- **Halaman detail** menggunakan pola `Detail<Modul>.tsx` (misalnya `DetailProduct.tsx`, `DetailSupplier.tsx`, `DetailUser.tsx`).
- **Nama komponen `export default`** dan **path `Inertia::render()`** di controller harus selaras dengan nama file tersebut (misalnya `Inertia::render('POS/ActivityLogs/ActivityLog', [...])`).
- **Komponen lokal modul** diletakkan di subfolder `component/` (misalnya `POS/ActivityLogs/component/ActivityLogSearch.tsx`).

---

## 6. Standar Detail Log Aktivitas & Pemisahan Komponen

### 6.1 Tampilan Detail Log Aktivitas Seragam (`ActivityLogDetailDialog`)
> **ATURAN WAJIB:** Dilarang membuat renderer, card berwarna, atau layout khusus per modul/event di dalam `ActivityLogDetailDialog.tsx`. Seluruh modul (Produk, Kategori, Pengguna, Supplier, Purchase Order, Auth, dll.) **WAJIB** menggunakan satu format tampilan detail yang seragam.

Struktur standar dialog detail aktivitas:
1. **Header Dialog:** Judul `Detail Log Aktivitas #{id}` disertai badge `event` (jika tersedia).
2. **Metadata Grid (4 Kolom):** `Waktu`, `Pengguna`, `Kategori Log`, dan `Objek / Modul`.
3. **Blok Deskripsi:** Menampilkan `activity.description` apa adanya.
4. **Tabel Perubahan Data Seragam (3 Kolom):**
   - Kolom: `Field / Kolom` | `Nilai Sebelumnya (Old)` | `Nilai Sesudahnya (New)`.
   - Data dinormalisasi secara generik dari `attribute_changes` dan `properties`, termasuk pairing otomatis untuk kunci `old_*` / `previous_*` dengan `new_*`.
   - Jika terdapat properti berbentuk array of objects (misalnya daftar item transaksi/penerimaan), render menggunakan **sub-tabel generik** dengan gaya tabel yang sama — bukan layout custom per modul.
5. **Konfigurasi Terpusat:**
   - Saat menambah modul atau field baru yang dicatat di activity log, cukup daftarkan label field (`fieldLabels`), field mata uang (`CURRENCY_FIELDS`), atau label status (`STATUS_LABELS`) di `resources/js/pages/POS/ActivityLogs/component/activityLogDetailUtils.ts` tanpa mengubah struktur JSX dialog.

### 6.2 Deskripsi Log Aktivitas Seragam di Semua Modul
> **ATURAN WAJIB:** Dilarang membiarkan deskripsi log aktivitas hanya berupa nama event mentah (misalnya `created`, `updated`, `deleted`) sehingga tampil berulang seperti `[DELETED] deleted`.

- Setiap model Laravel yang menggunakan `LogsActivity` wajib mendefinisikan `->setDescriptionForEvent(...)` dengan pola kalimat deskriptif Bahasa Indonesia yang sama seperti `PurchaseOrder`:
  - `created`: `"{Modul} {nama/kode} berhasil dibuat."`
  - `updated`: `"{Modul} {nama/kode} diperbarui."`
  - `deleted`: `"{Modul} {nama/kode} dihapus."`
  - `restored`: `"{Modul} {nama/kode} dipulihkan."`
- Di `ActivityLogController`, data log lama yang masih menyimpan deskripsi mentah (`created`, `updated`, `deleted`, `restored`) wajib dinormalisasi oleh `resolveDescription()` ke pola kalimat di atas.

### 6.3 Pemisahan Logika & Sub-Komponen (*Separation of Concerns*)
- **Logika Murni (`*Utils.ts`):** Pisahkan konstanta mapping, formatter, normalizer data, dan tipe bantu yang tidak bergantung pada React ke file `.ts` terpisah di folder `component/` (contoh: `activityLogDetailUtils.ts`).
- **Komponen Stateful:** Pisahkan sub-komponen yang mengelola state lokal sendiri atau dapat digunakan ulang ke file `.tsx` terpisah (contoh: `ActivityLogImagePreview.tsx`).
- **Hindari Over-Splitting:** Jangan memecah potongan JSX sederhana yang hanya dipakai satu kali dan tidak memiliki state/logika kompleks ke file terpisah.

### 6.4 Standar Penggunaan Ikon
> **ATURAN WAJIB:** Setiap ikon pada antarmuka pengguna **WAJIB** menggunakan library **`lucide-react`**. Dilarang membuat SVG ikon kustom secara manual, menggunakan emoji sebagai ikon UI, atau mengimpor library ikon lain.

---

## 7. Ringkasan Checklist Setiap Membuat / Mengubah Modul Tabel

- [ ] Apakah nama file halaman utama menggunakan nama modul `PascalCase` (bukan `Index.tsx`) dan selaras dengan `Inertia::render()`?
- [ ] Apakah komponen sorting menggunakan `DataTableSortHeader` dari `@/components/dataTableSortHeader`?
- [ ] Apakah setiap kolom memiliki `size` piksel yang realistis (bukan angka kecil seperti `10`/`15`/`18`) dan tabel menggunakan `table-fixed` agar header tidak membesar/mengecil antar halaman?
- [ ] Apakah kolom `No` memiliki `size: 55` dan menghitung offset `from + index`?
- [ ] Apakah kolom `Aksi` memiliki header rata kanan (`text-right pr-2`) dan cell rata kanan (`justify-end pr-2`)?
- [ ] Apakah seluruh format rupiah menggunakan `Intl.NumberFormat('id-ID', ...)`?
- [ ] Apakah dialog modal memiliki header dan footer terkunci (`shrink-0`) serta body `overflow-y-auto overflow-x-hidden`?
- [ ] Apakah setiap model `LogsActivity` sudah mendefinisikan `setDescriptionForEvent(...)` agar keterangan aktivitas deskriptif dan seragam?
- [ ] Apakah detail log aktivitas mengikuti format seragam tanpa renderer khusus per modul, dan field baru didaftarkan di `activityLogDetailUtils.ts`?
- [ ] Apakah logika murni (`*Utils.ts`) dan sub-komponen stateful sudah dipisahkan secara proporsional tanpa *over-splitting*?
- [ ] Apakah toolbar pencarian dipisah di `component/<Modul>Search.tsx` menggunakan layout inline `flex flex-wrap items-center gap-2.5` (tanpa card pembungkus), tinggi seragam `h-9`, chip sortir tabel, dan tombol `Reset Filter` bergaya `border-dashed`?
- [ ] Apakah semua `<SelectTrigger>` menggunakan `w-full sm:w-auto sm:min-w-[...]` (bukan lebar tetap `sm:w-[...]`) dan `SelectContent` memakai `w-auto min-w-(--anchor-width)` agar label tidak terpotong?
- [ ] Apakah `<DataTablePagination>` sudah menerima `routeUrl` dan `isLoading`?
- [ ] Apakah tipe TypeScript lolos verifikasi `npm run types:check` tanpa error?

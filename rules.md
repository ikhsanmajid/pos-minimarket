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

---

## 2. Standar Struktur Kolom Tabel

### 2.1 Kolom Nomor Urut (`No`)
Kolom pertama wajib menampilkan nomor urut yang memperhitungkan halaman paginasi aktif:
```tsx
{
    id: 'no',
    header: 'No',
    cell: (info) => (from ?? 1) + info.row.index,
    size: 50,
}
```
- **Ukuran Lebar:** Wajib `size: 50`.
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

## 3. Standar Filter & Toolbar Pencarian (`*Search.tsx` / `*Toolbar.tsx`)

1. **Input Pencarian Utama:**
   - Berupa text input dengan icon `Search` di sebelah kiri.
   - Wajib menggunakan debounce (300ms - 400ms) sebelum mengirimkan request ke backend agar tidak membebani server saat mengetik.
   - Batasi placeholder sesuai cakupan (misal: `"Cari no PO..."`, `"Cari supplier / telepon..."`).
2. **Filter Relasi (Async Select):**
   - Untuk filter data relasional (Kategori, Supplier, User/Kasir), gunakan async select (`react-select/async` atau shadcn combobox) dengan endpoint pencarian ringan (`limit: 20`).
3. **Tombol Reset Filter:**
   - Tampilkan tombol reset atau icon silang (`RotateCcw` / `X`) ketika ada filter aktif untuk mengembalikan tabel ke kondisi awal dalam satu klik.

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

## 5. Ringkasan Checklist Setiap Membuat / Mengubah Modul Tabel

- [ ] Apakah komponen sorting menggunakan `DataTableSortHeader` dari `@/components/dataTableSortHeader`?
- [ ] Apakah kolom `No` memiliki `size: 50` dan menghitung offset `from + index`?
- [ ] Apakah kolom `Aksi` memiliki header rata kanan (`text-right pr-2`) dan cell rata kanan (`justify-end pr-2`)?
- [ ] Apakah seluruh format rupiah menggunakan `Intl.NumberFormat('id-ID', ...)`?
- [ ] Apakah dialog modal memiliki header dan footer terkunci (`shrink-0`) serta body `overflow-y-auto overflow-x-hidden`?
- [ ] Apakah tipe TypeScript lolos verifikasi `npm run types:check` tanpa error?

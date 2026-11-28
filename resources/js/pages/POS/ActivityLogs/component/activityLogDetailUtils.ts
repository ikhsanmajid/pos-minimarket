import type { ActivityRow } from '../ActivityLog'

export interface DiffRow {
    key: string
    oldVal: unknown
    newVal: unknown
    isChanged: boolean
}

export interface TableCollection {
    key: string
    rows: Record<string, unknown>[]
}

const fieldLabels: Record<string, string> = {
    name: 'Nama',
    email: 'Email',
    phone: 'No. HP',
    role: 'Role',
    is_active: 'Status Aktif',
    active: 'Status Aktif',
    is_tax_exempt: 'Status PPN',
    is_donation: 'Produk Donasi',
    barcode: 'Barcode',
    base_unit: 'Satuan Dasar',
    category_id: 'Kategori Produk',
    category_name: 'Kategori Produk',
    buy_price: 'Harga Beli (HPP)',
    sell_price: 'Harga Jual',
    stock: 'Stok',
    min_stock: 'Minimum Stok',
    image: 'Foto Produk',
    code: 'Kode',
    slug: 'Slug',
    description: 'Deskripsi',
    contact_person: 'Kontak Person',
    address: 'Alamat',
    city: 'Kota',
    npwp: 'NPWP',
    payment_term_days: 'Tempo Pembayaran (Hari)',
    bank_name: 'Nama Bank',
    bank_account_number: 'No. Rekening',
    bank_account_name: 'Atas Nama Rekening',
    notes: 'Catatan',
    po_number: 'No. PO',
    supplier_id: 'Supplier',
    status: 'Status',
    receiving_status: 'Status Penerimaan',
    payment_status: 'Status Pembayaran',
    approved_by: 'Disetujui Oleh',
    approved_at: 'Waktu Disetujui',
    rejected_by: 'Ditolak Oleh',
    rejected_at: 'Waktu Ditolak',
    rejection_reason: 'Alasan Penolakan',
    receipt_number: 'No. LPB',
    supplier_delivery_note: 'No. Surat Jalan',
    received_date: 'Tanggal Terima',
    payable_number: 'No. Hutang (AP)',
    payment_number: 'No. Bukti Bayar',
    payment_method: 'Metode Pembayaran',
    payment_amount: 'Nominal Pembayaran',
    paid_amount: 'Total Terbayar',
    remaining_amount: 'Sisa Hutang',
    financial_account: 'Akun Kas / Bank',
    reference_number: 'No. Referensi',
    old_balance: 'Saldo Sebelumnya',
    new_balance: 'Saldo Sesudahnya',
    amount: 'Nominal',
    opening_balance: 'Saldo Awal',
    subtotal: 'Subtotal',
    discount_type: 'Tipe Diskon',
    discount_value: 'Nilai Diskon',
    discount_amount: 'Nominal Diskon',
    tax_type: 'Tipe Pajak',
    tax_value: 'Nilai Pajak',
    tax_percentage: 'Persentase Pajak (%)',
    taxable_amount: 'DPP (Kena PPN)',
    tax_exempt_amount: 'Subtotal Bebas PPN',
    tax_amount: 'Nominal Pajak',
    total_amount: 'Total Nilai',
    adjusted_total_amount: 'Penyesuaian Total Tagihan',
    items_count: 'Jumlah Item',
    received_at: 'Waktu Penerimaan',
    received_by: 'Diterima Oleh',
    due_date: 'Jatuh Tempo',
    reason: 'Alasan',
    received_items: 'Rincian Barang Diterima',
    product_name: 'Produk',
    unit_name: 'Satuan',
    conversion_factor: 'Faktor Konversi',
    quantity_ordered: 'Qty Dipesan',
    quantity_received_now: 'Diterima Kali Ini',
    free_qty_received: 'Bonus Diterima',
    base_qty_received: 'Masuk Stok Dasar',
    total_quantity_received: 'Total Diterima',
    unit_cost: 'Harga Satuan',
    old_stock: 'Stok Sebelumnya',
    new_stock: 'Stok Sesudahnya',
    old_buy_price: 'Harga Beli Lama',
    new_weighted_buy_price: 'Harga Beli Baru (Weighted)',
    batch_number: 'No. Batch',
    expired_date: 'Tanggal Kedaluwarsa',
    shift_number: 'No. Shift',
    cash_register_id: 'Kasir Fisik',
    register_name: 'Mesin Kasir',
    location: 'Lokasi',
    starting_cash: 'Modal Awal Laci',
    expected_cash: 'Ekspektasi Kas Sistem',
    actual_cash: 'Uang Fisik (Actual)',
    cash_variance: 'Selisih Kas (Variance)',
    variance_status: 'Status Rekonsiliasi',
    total_cash_sales: 'Penjualan Tunai',
    total_non_cash_sales: 'Penjualan Non-Tunai',
    total_refunds: 'Total Refund',
    total_cash_in: 'Total Cash In',
    total_cash_out: 'Total Cash Out',
    total_cash_drop: 'Total Cash Drop',
    total_transactions: 'Jumlah Transaksi',
    movement_type: 'Jenis Mutasi Shift',
    closing_notes: 'Catatan Penutupan Shift',
    report_name: 'Nama Laporan',
    export_format: 'Format Ekspor',
    filename: 'Nama File',
    start_date: 'Tanggal Mulai',
    end_date: 'Tanggal Selesai',
    verified_by: 'Diverifikasi Oleh',
    cash_deposited: 'Setoran Tunai ke Kas/Brankas',
    non_cash_deposited: 'Setoran Non-Tunai ke Bank',
    financial_transaction_number: 'No. Transaksi Keuangan',
    store_name: 'Nama Toko',
    store_address: 'Alamat Toko',
    store_phone: 'Telepon Toko',
    store_logo: 'Logo Toko',
    receipt_header: 'Header Struk',
    receipt_footer: 'Footer Struk',
    default_tax_rate: 'Tarif PPN Default (%)',
    rounding_mode: 'Mode Pembulatan Kasir',
    shift_variance_tolerance: 'Toleransi Selisih Kas Shift',
    invoice_number: 'No. Invoice',
    return_number: 'No. Retur',
    grand_total: 'Grand Total',
    rounding_amount: 'Pembulatan',
    donation_amount: 'Donasi',
    change_amount: 'Kembalian',
    void_reason: 'Alasan Void',
    voided_by: 'Di-void Oleh',
    voided_at: 'Waktu Void',
    discount_approved_by: 'Persetujuan Diskon',
    refund_method: 'Metode Refund',
    total_refund_amount: 'Total Refund',
    returned_items: 'Rincian Barang Diretur',
    is_restockable: 'Kondisi Stok Retur',
    subtotal_refund: 'Subtotal Refund',
    qty: 'Qty',
    base_qty: 'Qty Satuan Dasar',
    adjustment_number: 'No. Penyesuaian Stok',
    opname_number: 'No. Stock Opname',
    qty_change: 'Perubahan Qty',
    unit_cost_snapshot: 'HPP Snapshot',
    total_cost_impact: 'Dampak Nilai (Rp)',
    is_blind_count: 'Mode Blind Count',
    total_items_counted: 'Total Produk Dihitung',
    total_variance_items: 'Total Item Berselisih',
    total_variance_value: 'Total Nilai Selisih',
    member_code: 'Kode Member',
    points: 'Poin Member',
    tier: 'Tier Member',
    birth_date: 'Tanggal Lahir',
    member_price: 'Harga Member',
    points_redeemed: 'Poin Ditukar',
    points_redeem_amount: 'Nominal Tukar Poin',
    points_earned: 'Poin Diperoleh',
    points_reversed: 'Poin Ditarik (Retur)',
    remaining_points: 'Sisa Poin Lot FIFO',
    expires_at: 'Kedaluwarsa Poin',
    is_system: 'Kategori Sistem',
    financial_category: 'Kategori Keuangan',
    transaction_number: 'No. Mutasi Keuangan',
    transaction_date: 'Tanggal Transaksi',
    min_qty: 'Minimal Qty Grosir',
    unit_price: 'Harga Satuan',
    product_unit_id: 'Satuan Multi-UOM',
    pricing_source: 'Sumber Harga',
    applied_promotion_name: 'Promo Diterapkan',
    allocated_header_discount: 'Alokasi Diskon Nota',
    free_qty: 'Qty Gratis (Bonus)',
    is_promo_excluded: 'Dikecualikan dari Promo',
    tax_mode: 'Mode PPN Produk',
    funding: 'Penanggung Promo',
    max_discount_amount: 'Plafon Maks. Diskon',
    min_purchase_amount: 'Minimal Belanja',
    buy_qty: 'Qty Beli',
    get_qty: 'Qty Gratis',
    get_discount_percent: 'Persen Potongan Bonus (%)',
    bundle_price: 'Harga Paket (Multibuy)',
    nth_item: 'Item Ke-N',
    reward_product_id: 'Produk Hadiah / Tebus Murah',
    special_price: 'Harga Tebus Murah',
    payment_bin_prefix: 'Prefix BIN Kartu',
    near_expiry_days: 'Batas Hari Near Expiry',
    promo_clawback_amount: 'Penyesuaian Retur Promo',
    starts_at: 'Mulai Berlaku',
    ends_at: 'Berakhir Pada',
    days_mask: 'Hari Berlaku (Bitmask)',
    time_start: 'Jam Mulai (WIB)',
    time_end: 'Jam Selesai (WIB)',
    quota_total: 'Total Kuota Promo',
    quota_used: 'Kuota Terpakai',
    max_qty_per_transaction: 'Maks. Qty / Transaksi',
    max_qty_per_customer_per_day: 'Maks. Qty / Pelanggan / Hari',
    stackable: 'Dapat Digabung (Stackable)',
    exclusive_group: 'Grup Eksklusif',
    priority: 'Prioritas',
    member_only: 'Khusus Member',
    scope: 'Lingkup Promo',
    voucher_id: 'ID Voucher',
    voucher_code: 'Kode Voucher',
    voucher_discount_amount: 'Potongan Voucher',
    voucher_clawback_amount: 'Penyesuaian Retur Voucher',
    special_price: 'Harga Tebus Murah',
    promo_clawback_amount: 'Penyesuaian Retur Promo',
    max_discount: 'Plafon Maks. Diskon',
    min_spend: 'Minimal Belanja',
    valid_from: 'Berlaku Dari',
    valid_until: 'Berlaku Sampai',
    allowed_days: 'Hari Berlaku (Bitmask)',
    allowed_hours_start: 'Jam Mulai (WIB)',
    allowed_hours_end: 'Jam Selesai (WIB)',
    total_quota: 'Kuota Total',
    used_count: 'Jumlah Terpakai',
    per_customer_limit: 'Batas / Pelanggan',
    per_day_limit: 'Batas / Hari',
    store_ids: 'Cabang / Toko Diizinkan',
    channel: 'Kanal Transaksi',
    member_tiers: 'Tier Member',
    applicable_skus: 'SKU / Produk Berlaku',
    applicable_categories: 'Kategori Berlaku',
    excluded_skus: 'SKU Dikecualikan',
    excluded_categories: 'Kategori Dikecualikan',
    free_product_id: 'Produk Gratis',
    stackable_with_promo: 'Gabung Promo Otomatis',
    stackable_with_voucher: 'Gabung Voucher Lain',
    reservation_token: 'Token Reservasi',
    reserved_until: 'Batas Reservasi',
    redeemed_at: 'Waktu Redeem',
    released_at: 'Waktu Dilepas',
}

const CURRENCY_FIELDS = new Set([
    'buy_price',
    'sell_price',
    'subtotal',
    'discount_amount',
    'taxable_amount',
    'tax_exempt_amount',
    'tax_amount',
    'total_amount',
    'adjusted_total_amount',
    'unit_cost',
    'old_buy_price',
    'new_weighted_buy_price',
    'payment_amount',
    'paid_amount',
    'remaining_amount',
    'amount',
    'opening_balance',
    'old_balance',
    'new_balance',
    'starting_cash',
    'expected_cash',
    'actual_cash',
    'cash_variance',
    'total_cash_sales',
    'total_non_cash_sales',
    'total_refunds',
    'total_cash_in',
    'total_cash_out',
    'total_cash_drop',
    'cash_deposited',
    'non_cash_deposited',
    'shift_variance_tolerance',
    'grand_total',
    'rounding_amount',
    'donation_amount',
    'change_amount',
    'total_refund_amount',
    'subtotal_refund',
    'unit_cost_snapshot',
    'total_cost_impact',
    'total_variance_value',
    'unit_price',
    'max_discount_amount',
    'min_purchase_amount',
    'bundle_price',
    'allocated_header_discount',
    'max_discount',
    'min_spend',
    'voucher_discount_amount',
    'voucher_clawback_amount',
    'special_price',
    'promo_clawback_amount',
    'member_price',
    'points_redeem_amount',
])

const STATUS_LABELS: Record<string, string> = {
    draft: 'Draft',
    pending_approval: 'Menunggu Persetujuan',
    approved: 'Disetujui / Dipesan',
    ordered: 'Dipesan',
    rejected: 'Ditolak',
    unreceived: 'Belum Diterima',
    partially_received: 'Diterima Sebagian',
    received: 'Diterima Penuh',
    cancelled: 'Dibatalkan',
    unpaid: 'Belum Dibayar',
    partial: 'Sebagian',
    paid: 'Lunas',
    percentage: 'Persentase (%)',
    percent: 'Persentase (%)',
    fixed: 'Nominal Tetap',
    open: 'Aktif / Berjalan',
    closed: 'Ditutup',
    cash_in: 'Kas Masuk (Cash In)',
    cash_out: 'Kas Keluar (Cash Out)',
    cash_drop: 'Setor Brankas (Cash Drop)',
    none: 'Tanpa Pembulatan',
    nearest_100: 'Bulatkan ke Rp 100 Terdekat',
    down_100: 'Bulatkan ke Bawah (Rp 100)',
    up_100: 'Bulatkan ke Atas (Rp 100)',
    nearest_500: 'Bulatkan ke Rp 500 Terdekat',
    completed: 'Selesai',
    voided: 'Dibatalkan (Void)',
    partially_refunded: 'Retur Sebagian',
    refunded: 'Retur Penuh',
    pending: 'Menunggu Persetujuan',
    in_progress: 'Berlangsung',
    in: 'Penambahan Stok (+)',
    out: 'Pengurangan Stok (-)',
    damaged: 'Barang Rusak',
    expired: 'Kedaluwarsa',
    lost: 'Barang Hilang / Shrinkage',
    internal_use: 'Pemakaian Internal Toko',
    correction: 'Koreksi Kesalahan Input',
    regular: 'Harga Reguler',
    member_price: 'Harga Member',
    wholesale_tier: 'Harga Grosir (Tiered)',
    promotion: 'Promo Otomatis',
    percentage_discount: 'Diskon Persentase (%)',
    fixed_discount: 'Diskon Nominal (Rp)',
    buy_x_get_y: 'Beli X Gratis Y',
    multibuy_price: 'Harga Paket (Multibuy)',
    nth_item_discount: 'Diskon Item Ke-N',
    mix_match: 'Mix & Match',
    bundle: 'Paket Bundel',
    near_expiry: 'Diskon Near Expiry',
    min_spend_discount: 'Potongan Min. Belanja (Rp)',
    min_spend_percent: 'Potongan Min. Belanja (%)',
    tebus_murah: 'Tebus Murah',
    gift_with_purchase: 'Hadiah Pembelian (GWP)',
    payment_promo: 'Promo Metode Bayar',
    cashback: 'Cashback',
    birthday: 'Promo Ulang Tahun Member',
    first_purchase: 'Promo Pembelian Pertama',
    silver: 'Silver',
    gold: 'Gold',
    platinum: 'Platinum',
    earn: 'Perolehan Poin',
    redeem: 'Penukaran Poin',
    expire: 'Kedaluwarsa Poin',
    void_reversal: 'Pembalikan Void',
    return_reversal: 'Pembalikan Retur',
    adjustment: 'Penyesuaian Manual',
    all_products: 'Semua Produk',
    category: 'Kategori Tertentu',
    product: 'Produk Tertentu',
    store: 'Ditanggung Toko',
    supplier: 'Ditanggung Supplier',
    shared: 'Patungan (Toko & Supplier)',
    exclusive: 'PPN Ditambahkan (Exclusive)',
    inclusive: 'Harga Termasuk PPN (Inclusive)',
    exempt: 'Bebas PPN (0%)',
    active: 'Aktif',
    paused: 'Dijeda',
    exhausted: 'Kuota Habis',
    reserved: 'Direservasi',
    redeemed: 'Terpakai',
    released: 'Dilepas',
    fixed_amount: 'Potongan Nominal (Rp)',
    free_item: 'Gratis Produk',
    product_specific: 'Potongan Produk Tertentu',
    cash_voucher: 'Voucher Tunai (Gift Voucher)',
}

export const isPlainObject = (val: unknown): val is Record<string, unknown> =>
    typeof val === 'object' && val !== null && !Array.isArray(val)

export const formatKeyToLabel = (key: string): string => {
    if (fieldLabels[key]) {
        return fieldLabels[key]
    }

    return key
        .replace(/_/g, ' ')
        .replace(/\b\w/g, (char) => char.toUpperCase())
}

export const formatRupiah = (val: number | string | undefined | null): string => {
    const num = Number(val)
    if (Number.isNaN(num)) {
        return String(val ?? '-')
    }

    return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0,
    }).format(num)
}

export const formatDiffValue = (
    key: string,
    val: unknown,
    categoryMap?: Record<string | number, string> | null
): string => {
    if (val === undefined || val === null || val === '') {
        return '-'
    }

    if (key === 'category_id') {
        const lookupKey = typeof val === 'string' || typeof val === 'number' ? val : String(val)
        const catName = categoryMap?.[lookupKey]
        return catName ? `${catName} (#${lookupKey})` : `Kategori #${lookupKey}`
    }

    if (key === 'image' || key === 'store_logo') {
        const filename = String(val).split('/').pop()
        return val ? `File: ${filename}` : 'Tidak ada foto'
    }

    if (CURRENCY_FIELDS.has(key)) {
        const num = Number(val)
        if (!Number.isNaN(num)) {
            return formatRupiah(num)
        }
    }

    if (key === 'is_active' || key === 'active') {
        return val ? 'Aktif' : 'Nonaktif'
    }

    if (key === 'is_tax_exempt') {
        return val ? 'Bebas PPN' : 'Kena PPN'
    }

    if (typeof val === 'boolean') {
        return val ? 'Ya' : 'Tidak'
    }

    if (typeof val === 'string' && STATUS_LABELS[val]) {
        return STATUS_LABELS[val]
    }

    if (Array.isArray(val)) {
        return val.length > 0 ? val.map((item) => String(item)).join(', ') : '-'
    }

    if (isPlainObject(val)) {
        return JSON.stringify(val)
    }

    return String(val)
}

export const getImageUrl = (path: unknown): string | null => {
    if (!path || typeof path !== 'string') {
        return null
    }
    if (path.startsWith('http://') || path.startsWith('https://') || path.startsWith('/')) {
        return path
    }
    return `/storage/${path}`
}

export function normalizeActivityData(activity: ActivityRow): {
    diffRows: DiffRow[]
    tableCollections: TableCollection[]
} {
    const changes = activity.attribute_changes || {}
    const properties = activity.properties || {}
    const oldData: Record<string, unknown> = changes.old || properties.old || {}
    const newData: Record<string, unknown> = changes.attributes || properties.attributes || {}

    const diffMap = new Map<string, DiffRow>()

    // 1. Perubahan atribut standar (old vs attributes)
    const attributeKeys = Array.from(new Set([...Object.keys(oldData), ...Object.keys(newData)]))
    for (const key of attributeKeys) {
        const oldVal = oldData[key]
        const newVal = newData[key]
        diffMap.set(key, {
            key,
            oldVal,
            newVal,
            isChanged: oldVal !== newVal,
        })
    }

    // 2. Normalisasi properti tambahan (pasangan old_/previous_ + new_, skalar, dan koleksi tabel)
    const extraProps: Record<string, unknown> = { ...properties }
    delete extraProps.old
    delete extraProps.attributes
    delete extraProps.event

    if (diffMap.has('category_id')) {
        delete extraProps.category_name
    }

    const tableCollections: TableCollection[] = []
    const consumedKeys = new Set<string>()

    for (const key of Object.keys(extraProps)) {
        if (consumedKeys.has(key)) {
            continue
        }

        const oldMatch = key.match(/^(?:old|previous)_(.+)$/)
        if (oldMatch) {
            const baseKey = oldMatch[1]
            const newKey = `new_${baseKey}`
            if (Object.prototype.hasOwnProperty.call(extraProps, newKey)) {
                consumedKeys.add(key)
                consumedKeys.add(newKey)
                if (!diffMap.has(baseKey)) {
                    const oldVal = extraProps[key]
                    const newVal = extraProps[newKey]
                    diffMap.set(baseKey, {
                        key: baseKey,
                        oldVal,
                        newVal,
                        isChanged: oldVal !== newVal,
                    })
                }
            }
        }
    }

    for (const [key, value] of Object.entries(extraProps)) {
        if (consumedKeys.has(key) || diffMap.has(key)) {
            continue
        }

        if (Array.isArray(value) && value.length > 0 && value.every((item) => isPlainObject(item))) {
            tableCollections.push({
                key,
                rows: value as Record<string, unknown>[],
            })
            continue
        }

        diffMap.set(key, {
            key,
            oldVal: undefined,
            newVal: value,
            isChanged: value !== undefined && value !== null && value !== '',
        })
    }

    return {
        diffRows: Array.from(diffMap.values()),
        tableCollections,
    }
}

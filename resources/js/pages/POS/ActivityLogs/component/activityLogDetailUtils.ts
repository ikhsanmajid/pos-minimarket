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
}

const CURRENCY_FIELDS = new Set([
    'buy_price',
    'sell_price',
    'subtotal',
    'discount_amount',
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
    'change_amount',
    'total_refund_amount',
    'subtotal_refund',
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

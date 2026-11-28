export type ReportPreset =
    | 'today'
    | '7d'
    | '30d'
    | 'this_month'
    | 'last_month'
    | 'this_year'
    | 'custom'

export interface ReportPeriod {
    preset: ReportPreset | string
    start_date: string
    end_date: string
    label: string
    days: number
}

export interface ReportFilters {
    preset?: string
    start_date?: string
    end_date?: string
    cashier_id?: string | number
    category_id?: string | number
    product_id?: string | number
    payment_method?: string
    movement_class?: string
    financial_account_id?: string | number
    supplier_id?: string | number
    search?: string
    sort?: string
    direction?: string
    table_sort?: string
    table_direction?: string
}

export const REPORT_PRESETS: { value: ReportPreset; label: string }[] = [
    { value: 'today', label: 'Hari Ini' },
    { value: '7d', label: '7 Hari' },
    { value: '30d', label: '30 Hari' },
    { value: 'this_month', label: 'Bulan Ini' },
    { value: 'last_month', label: 'Bulan Lalu' },
    { value: 'this_year', label: 'Tahun Ini' },
    { value: 'custom', label: 'Kustom' },
]

export function formatIdr(value: number): string {
    return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(Number.isFinite(value) ? value : 0)
}

export function formatCompactIdr(value: number): string {
    const abs = Math.abs(value)
    const sign = value < 0 ? '-' : ''
    if (abs >= 1_000_000_000) {
        return `${sign}Rp ${(abs / 1_000_000_000).toFixed(1)}M`
    }
    if (abs >= 1_000_000) {
        return `${sign}Rp ${(abs / 1_000_000).toFixed(1)}jt`
    }
    if (abs >= 1_000) {
        return `${sign}Rp ${Math.round(abs / 1_000)}rb`
    }
    return `${sign}Rp ${Math.round(abs)}`
}

export function formatQty(value: number): string {
    return new Intl.NumberFormat('id-ID').format(Number.isFinite(value) ? value : 0)
}

export function buildExportUrl(baseUrl: string, filters: ReportFilters): string {
    const params = new URLSearchParams()
    Object.entries(filters).forEach(([key, val]) => {
        if (val !== undefined && val !== null && String(val).trim() !== '' && val !== 'all') {
            params.set(key, String(val))
        }
    })
    const query = params.toString()
    return query ? `${baseUrl}?${query}` : baseUrl
}

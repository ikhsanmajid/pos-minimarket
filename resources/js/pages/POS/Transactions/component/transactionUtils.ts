export const formatRupiah = (val: number | string | undefined | null): string => {
    const num = Number(val ?? 0)
    if (Number.isNaN(num)) {
        return 'Rp 0'
    }

    return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0,
    }).format(num)
}

export const TRANSACTION_SORT_LABELS: Record<string, string> = {
    invoice_number: 'No. Invoice',
    created_at: 'Waktu',
    grand_total: 'Grand Total',
    status: 'Status',
}

export const TRANSACTION_SORT_OPTIONS = [
    { value: 'default', label: 'Urutan: Default (Terbaru)' },
    { value: 'created_at:desc', label: 'Waktu: Terbaru' },
    { value: 'created_at:asc', label: 'Waktu: Terlama' },
    { value: 'grand_total:desc', label: 'Total: Tertinggi' },
    { value: 'grand_total:asc', label: 'Total: Terendah' },
    { value: 'invoice_number:asc', label: 'Invoice: A-Z' },
    { value: 'invoice_number:desc', label: 'Invoice: Z-A' },
]

export function getTransactionStatusBadgeClass(status: string): string {
    switch (status) {
        case 'completed':
            return 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300'
        case 'partially_refunded':
            return 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-300'
        case 'refunded':
            return 'border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
        case 'voided':
            return 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-800 dark:bg-rose-950/50 dark:text-rose-300'
        default:
            return 'border-border bg-muted text-muted-foreground'
    }
}

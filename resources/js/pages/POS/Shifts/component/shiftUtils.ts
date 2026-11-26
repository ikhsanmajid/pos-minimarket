export interface ShiftMovementItem {
    id: number
    type: 'cash_in' | 'cash_out' | 'cash_drop' | string
    type_label: string
    type_short: string
    amount: number
    reason: string
    financial_account_name: string | null
    approved_by_name: string | null
    created_by_name: string
    created_at: string | null
}

export interface FinancialAccountSelectOption {
    id: number
    code: string
    name: string
    type: string
    type_label: string
    is_default: boolean
}

export interface DenominationRow {
    denomination: number
    qty: number
    subtotal: number
}

export interface PaymentBreakdownRow {
    method: string
    label: string
    count: number
    total: number
}

export interface ShiftPolicyRules {
    cash_out_pin_threshold: number
    variance_pin_threshold: number
    is_privileged: boolean
    can_view_all_history?: boolean
}

export const DEFAULT_DENOMINATIONS: number[] = [
    100000,
    50000,
    20000,
    10000,
    5000,
    2000,
    1000,
    500,
    200,
    100,
]

export const formatRupiah = (amount: number | string | null | undefined): string => {
    const value = Number(amount ?? 0)
    if (Number.isNaN(value)) {
        return 'Rp0'
    }

    return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0,
    }).format(value)
}

export const formatSignedRupiah = (amount: number | null | undefined): string => {
    if (amount === null || amount === undefined) {
        return '-'
    }
    const formatted = formatRupiah(Math.abs(amount))
    if (Math.abs(amount) < 0.01) {
        return formatted
    }
    return amount > 0 ? `+${formatted}` : `-${formatted}`
}

export const getVarianceBadgeMeta = (variance: number | null | undefined): {
    label: string
    className: string
    status: 'matched' | 'shortage' | 'surplus' | 'open'
} => {
    if (variance === null || variance === undefined) {
        return {
            label: 'Berjalan',
            className: 'bg-blue-500/10 text-blue-700 border-blue-200 dark:bg-blue-500/20 dark:text-blue-300 dark:border-blue-800',
            status: 'open',
        }
    }

    if (Math.abs(variance) < 0.01) {
        return {
            label: 'Klop',
            className: 'bg-emerald-500/10 text-emerald-700 border-emerald-200 dark:bg-emerald-500/20 dark:text-emerald-300 dark:border-emerald-800',
            status: 'matched',
        }
    }

    if (variance < 0) {
        return {
            label: `Minus ${formatRupiah(Math.abs(variance))}`,
            className: 'bg-rose-500/10 text-rose-700 border-rose-200 dark:bg-rose-500/20 dark:text-rose-300 dark:border-rose-800',
            status: 'shortage',
        }
    }

    return {
        label: `Surplus +${formatRupiah(variance)}`,
        className: 'bg-amber-500/10 text-amber-700 border-amber-200 dark:bg-amber-500/20 dark:text-amber-300 dark:border-amber-800',
        status: 'surplus',
    }
}

export const getMovementTypeBadgeClass = (type: string): string => {
    switch (type) {
        case 'cash_in':
            return 'bg-emerald-500/10 text-emerald-700 border-emerald-200 dark:bg-emerald-500/20 dark:text-emerald-300 dark:border-emerald-800'
        case 'cash_out':
            return 'bg-rose-500/10 text-rose-700 border-rose-200 dark:bg-rose-500/20 dark:text-rose-300 dark:border-rose-800'
        case 'cash_drop':
            return 'bg-blue-500/10 text-blue-700 border-blue-200 dark:bg-blue-500/20 dark:text-blue-300 dark:border-blue-800'
        default:
            return 'bg-muted text-muted-foreground border-border'
    }
}

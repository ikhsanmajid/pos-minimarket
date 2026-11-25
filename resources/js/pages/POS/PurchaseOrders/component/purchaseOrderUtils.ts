export const formatRupiah = (val: number | string | null | undefined): string => {
    const num = Number(val) || 0
    return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0,
    }).format(num)
}

export const poStatusBadgeConfig: Record<string, { label: string; className: string }> = {
    draft: {
        label: 'Draft',
        className: 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300 border-slate-300 dark:border-slate-700',
    },
    pending_approval: {
        label: 'Menunggu ACC',
        className: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border-amber-300 dark:border-amber-800',
    },
    approved: {
        label: 'Disetujui / Dipesan',
        className: 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 border-blue-200 dark:border-blue-800',
    },
    rejected: {
        label: 'Ditolak',
        className: 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 border-rose-200 dark:border-rose-800',
    },
    cancelled: {
        label: 'Dibatalkan',
        className: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-400 border-zinc-300 dark:border-zinc-700',
    },
}

export const receivingStatusBadgeConfig: Record<string, { label: string; className: string }> = {
    unreceived: {
        label: 'Belum Diterima',
        className: 'bg-slate-50 text-slate-700 dark:bg-slate-900 dark:text-slate-400 border-slate-200 dark:border-slate-700',
    },
    partial: {
        label: 'Diterima Sebagian',
        className: 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border-amber-200 dark:border-amber-800',
    },
    received: {
        label: 'Diterima Penuh',
        className: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
    },
}

export const paymentStatusBadgeConfig: Record<string, { label: string; className: string }> = {
    unpaid: {
        label: 'Belum Dibayar',
        className: 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400 border-rose-200 dark:border-rose-900',
    },
    partial: {
        label: 'Dibayar Sebagian',
        className: 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400 border-amber-200 dark:border-amber-900',
    },
    paid: {
        label: 'Lunas',
        className: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900',
    },
}

export interface ProductUnitOption {
    id: number
    unit_name: string
    conversion_factor: number
    barcode?: string | null
    buy_price: number
    sell_price?: number | null
    is_default_purchase?: boolean
}

export interface FinancialAccountOption {
    id: number
    code: string
    name: string
    type: string
    type_label: string
    current_balance: number
    is_default: boolean
}

export interface SelectOptionItem {
    value: string
    label: string
}

export function calculateItemLine(item: {
    quantity_ordered: number
    unit_cost: number
    discount_type: 'fixed' | 'percent'
    discount_value: number
}): { gross: number; discountAmount: number; subtotal: number } {
    const qty = Math.max(0, Number(item.quantity_ordered) || 0)
    const unitCost = Math.max(0, Number(item.unit_cost) || 0)
    const gross = Math.round(qty * unitCost * 100) / 100

    const rawDisc = Math.max(0, Number(item.discount_value) || 0)
    const discountAmount =
        item.discount_type === 'percent'
            ? Math.round(gross * (Math.min(100, rawDisc) / 100) * 100) / 100
            : Math.round(Math.min(gross, rawDisc) * 100) / 100

    return {
        gross,
        discountAmount,
        subtotal: Math.max(0, Math.round((gross - discountAmount) * 100) / 100),
    }
}

export function calculateOrderSummary(
    subtotal: number,
    discountType: 'fixed' | 'percent',
    discountValue: number,
    taxType: 'percent' | 'fixed',
    taxValue: number
): {
    discountAmount: number
    taxableAmount: number
    taxAmount: number
    grandTotal: number
} {
    const rawDisc = Math.max(0, Number(discountValue) || 0)
    const discountAmount =
        discountType === 'percent'
            ? Math.round(subtotal * (Math.min(100, rawDisc) / 100) * 100) / 100
            : Math.round(Math.min(subtotal, rawDisc) * 100) / 100

    const taxableAmount = Math.max(0, Math.round((subtotal - discountAmount) * 100) / 100)

    const rawTax = Math.max(0, Number(taxValue) || 0)
    const taxAmount =
        taxType === 'percent'
            ? Math.round(taxableAmount * (Math.min(100, rawTax) / 100) * 100) / 100
            : Math.round(rawTax * 100) / 100

    return {
        discountAmount,
        taxableAmount,
        taxAmount,
        grandTotal: Math.round((taxableAmount + taxAmount) * 100) / 100,
    }
}

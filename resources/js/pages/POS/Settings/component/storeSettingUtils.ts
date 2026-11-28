import type { RoundingModeValue } from '@/types/store-setting'

export interface SampleReceiptItem {
    name: string
    qty: number
    unitPrice: number
}

export const SAMPLE_RECEIPT_ITEMS: SampleReceiptItem[] = [
    { name: 'Indomie Goreng 85g', qty: 3, unitPrice: 3150 },
    { name: 'Aqua Botol 600ml', qty: 2, unitPrice: 3750 },
    { name: 'Sari Roti Tawar Kupas', qty: 1, unitPrice: 15800 },
    { name: 'Teh Pucuk Harum 350ml', qty: 2, unitPrice: 4125 },
]

export function formatRupiah(amount: number): string {
    const safeAmount = Number.isFinite(amount) ? amount : 0

    return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(Math.round(safeAmount))
}

export function formatSignedRupiah(amount: number): string {
    const rounded = Math.round(Number.isFinite(amount) ? amount : 0)
    if (rounded === 0) {
        return formatRupiah(0)
    }

    const formatted = formatRupiah(Math.abs(rounded))
    return rounded > 0 ? `+${formatted}` : `-${formatted}`
}

export function applyRounding(amount: number, mode: RoundingModeValue): number {
    const safeAmount = Number.isFinite(amount) ? amount : 0

    switch (mode) {
        case 'nearest_100':
            return Math.round(safeAmount / 100) * 100
        case 'down_100':
            return Math.floor(safeAmount / 100) * 100
        case 'up_100':
            return Math.ceil(safeAmount / 100) * 100
        case 'nearest_500':
            return Math.round(safeAmount / 500) * 500
        case 'none':
        default:
            return Math.round(safeAmount)
    }
}

export interface ReceiptCalculationResult {
    subtotal: number
    taxRate: number
    taxAmount: number
    totalBeforeRounding: number
    roundingAdjustment: number
    grandTotal: number
    paidAmount: number
    changeAmount: number
}

export function calculateReceiptPreview(
    taxRateInput: number,
    roundingMode: RoundingModeValue
): ReceiptCalculationResult {
    const subtotal = SAMPLE_RECEIPT_ITEMS.reduce(
        (sum, item) => sum + item.qty * item.unitPrice,
        0
    )

    const taxRate = Math.min(100, Math.max(0, Number.isFinite(taxRateInput) ? taxRateInput : 0))
    const taxAmount = Math.round((subtotal * taxRate) / 100)
    const totalBeforeRounding = subtotal + taxAmount
    const grandTotal = applyRounding(totalBeforeRounding, roundingMode)
    const roundingAdjustment = grandTotal - totalBeforeRounding
    const paidAmount = Math.ceil(grandTotal / 50000) * 50000 || 50000
    const changeAmount = Math.max(0, paidAmount - grandTotal)

    return {
        subtotal,
        taxRate,
        taxAmount,
        totalBeforeRounding,
        roundingAdjustment,
        grandTotal,
        paidAmount,
        changeAmount,
    }
}

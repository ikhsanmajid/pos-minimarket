import type { PosCartItem, PosFinancialAccount } from '@/types'

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

export function applyClientRounding(
    amount: number,
    mode: string
): { rounded: number; roundingAmount: number } {
    const clean = Math.round(amount * 100) / 100
    let rounded = clean

    switch (mode) {
        case 'nearest_100':
            rounded = Math.round(clean / 100) * 100
            break
        case 'down_100':
            rounded = Math.floor(clean / 100) * 100
            break
        case 'up_100':
            rounded = Math.ceil(clean / 100) * 100
            break
        case 'nearest_500':
            rounded = Math.round(clean / 500) * 500
            break
        default:
            rounded = clean
            break
    }

    rounded = Math.round(rounded * 100) / 100
    const roundingAmount = Math.round((rounded - clean) * 100) / 100

    return { rounded, roundingAmount }
}

export interface CartSummary {
    grossSubtotal: number
    itemDiscountTotal: number
    transactionDiscount: number
    totalDiscount: number
    netSubtotal: number
    taxableAmount: number
    taxExemptAmount: number
    taxAmount: number
    roundingAmount: number
    grandTotal: number
    totalItemsQty: number
    hasTaxExemptItems: boolean
}

export function calculateCartSummary(
    items: PosCartItem[],
    transactionDiscount: number,
    taxRate: number,
    roundingMode: string
): CartSummary {
    let grossSubtotal = 0
    let itemDiscountTotal = 0
    let taxableLineSubtotal = 0
    let taxExemptLineSubtotal = 0
    let totalItemsQty = 0
    let hasTaxExemptItems = false

    for (const item of items) {
        const lineGross = Math.round(item.unit_price * item.qty * 100) / 100
        const lineDiscount = Math.round(Math.min(item.discount_amount, lineGross) * 100) / 100
        const lineSubtotal = Math.round((lineGross - lineDiscount) * 100) / 100

        grossSubtotal += lineGross
        itemDiscountTotal += lineDiscount
        totalItemsQty += item.qty

        if (item.product.is_tax_exempt) {
            taxExemptLineSubtotal += lineSubtotal
            hasTaxExemptItems = true
        } else {
            taxableLineSubtotal += lineSubtotal
        }
    }

    grossSubtotal = Math.round(grossSubtotal * 100) / 100
    itemDiscountTotal = Math.round(itemDiscountTotal * 100) / 100
    taxableLineSubtotal = Math.round(taxableLineSubtotal * 100) / 100
    taxExemptLineSubtotal = Math.round(taxExemptLineSubtotal * 100) / 100

    const subtotalAfterItemDiscounts = Math.round(Math.max(0, grossSubtotal - itemDiscountTotal) * 100) / 100
    const safeTxDiscount = Math.max(
        0,
        Math.min(Math.round(transactionDiscount * 100) / 100, subtotalAfterItemDiscounts)
    )
    const totalDiscount = Math.round((itemDiscountTotal + safeTxDiscount) * 100) / 100
    const netSubtotal = Math.round(Math.max(0, grossSubtotal - totalDiscount) * 100) / 100

    const taxableTxDiscount =
        subtotalAfterItemDiscounts > 0 && taxableLineSubtotal > 0
            ? Math.round(safeTxDiscount * (taxableLineSubtotal / subtotalAfterItemDiscounts) * 100) / 100
            : 0
    const taxableAmount = Math.round(Math.max(0, taxableLineSubtotal - taxableTxDiscount) * 100) / 100
    const taxExemptAmount = Math.round(Math.max(0, netSubtotal - taxableAmount) * 100) / 100

    const taxAmount = Math.round(taxableAmount * (Math.max(0, taxRate) / 100) * 100) / 100
    const beforeRounding = Math.round((netSubtotal + taxAmount) * 100) / 100

    const { rounded: grandTotal, roundingAmount } = applyClientRounding(beforeRounding, roundingMode)

    return {
        grossSubtotal,
        itemDiscountTotal,
        transactionDiscount: safeTxDiscount,
        totalDiscount,
        netSubtotal,
        taxableAmount,
        taxExemptAmount,
        taxAmount,
        roundingAmount,
        grandTotal,
        totalItemsQty,
        hasTaxExemptItems,
    }
}

export function getDefaultAccountIdForMethod(
    method: string,
    accounts: PosFinancialAccount[]
): number | null {
    if (accounts.length === 0) {
        return null
    }

    if (method === 'cash') {
        const drawer = accounts.find((a) => a.code === 'KAS-001')
        if (drawer) return drawer.id
        const anyCash = accounts.find((a) => a.type === 'cash')
        if (anyCash) return anyCash.id
    } else if (method === 'qris') {
        const ewallet = accounts.find((a) => a.type === 'ewallet')
        if (ewallet) return ewallet.id
        const bank = accounts.find((a) => a.type === 'bank')
        if (bank) return bank.id
    } else {
        const bank = accounts.find((a) => a.type === 'bank')
        if (bank) return bank.id
    }

    return accounts[0].id
}

export function getXsrfToken(): string {
    const match = document.cookie.match(/(?:^|; )XSRF-TOKEN=([^;]*)/)
    return match ? decodeURIComponent(match[1]) : ''
}

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
    taxableAmount: number
    taxAmount: number
    roundingAmount: number
    grandTotal: number
    totalItemsQty: number
}

export function calculateCartSummary(
    items: PosCartItem[],
    transactionDiscount: number,
    taxRate: number,
    roundingMode: string
): CartSummary {
    let grossSubtotal = 0
    let itemDiscountTotal = 0
    let totalItemsQty = 0

    for (const item of items) {
        grossSubtotal += item.unit_price * item.qty
        itemDiscountTotal += Math.min(item.discount_amount, item.unit_price * item.qty)
        totalItemsQty += item.qty
    }

    grossSubtotal = Math.round(grossSubtotal * 100) / 100
    itemDiscountTotal = Math.round(itemDiscountTotal * 100) / 100

    const safeTxDiscount = Math.max(
        0,
        Math.min(Math.round(transactionDiscount * 100) / 100, Math.max(0, grossSubtotal - itemDiscountTotal))
    )
    const totalDiscount = Math.round((itemDiscountTotal + safeTxDiscount) * 100) / 100
    const taxableAmount = Math.round(Math.max(0, grossSubtotal - totalDiscount) * 100) / 100
    const taxAmount = Math.round(taxableAmount * (Math.max(0, taxRate) / 100) * 100) / 100
    const beforeRounding = Math.round((taxableAmount + taxAmount) * 100) / 100

    const { rounded: grandTotal, roundingAmount } = applyClientRounding(beforeRounding, roundingMode)

    return {
        grossSubtotal,
        itemDiscountTotal,
        transactionDiscount: safeTxDiscount,
        totalDiscount,
        taxableAmount,
        taxAmount,
        roundingAmount,
        grandTotal,
        totalItemsQty,
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

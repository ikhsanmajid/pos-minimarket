import type { CashRegisterOption } from '../../Shifts/component/OpenShiftDialog'

export interface PeriodMeta {
    preset: 'today' | '7d' | 'month' | 'custom' | string
    start_date: string
    end_date: string
    label: string
}

export interface SalesTrendPoint {
    date: string
    label: string
    net_sales: number
    gross_profit: number
    transactions_count: number
}

export interface PaymentCompositionItem {
    method: string
    label: string
    count: number
    amount: number
    percentage: number
}

export interface PaymentCompositionData {
    total: number
    transactions_count: number
    items: PaymentCompositionItem[]
}

export interface ActiveShiftSnapshot {
    id: number
    shift_number: string
    register_name: string
    cashier_name: string
    opened_at: string
    opened_at_human: string
    transactions_count: number
}

export interface TopProductItem {
    product_id: number
    name: string
    base_unit: string
    qty_sold: number
    revenue: number
    share_pct: number
}

export interface RecentActivityItem {
    id: number
    log_name: string
    event: string | null
    description: string
    causer_name: string
    created_at: string
    created_at_human: string
}

export interface PendingPoAlert {
    id: number
    po_number: string
    supplier_name: string
    total_amount: number
    order_date: string
}

export interface LowStockAlert {
    id: number
    name: string
    barcode: string | null
    stock: number
    min_stock: number
    base_unit: string
}

export interface DuePayableAlert {
    id: number
    payable_number: string
    po_number: string
    supplier_name: string
    remaining_amount: number
    due_date: string
    is_overdue: boolean
}

export interface ShiftAnomalyAlert {
    id: number
    shift_number: string
    register_name: string
    cashier_name: string
    closed_at: string
    cash_variance: number
}

export interface ActionableAlertsData {
    pending_pos: PendingPoAlert[]
    low_stock_products: LowStockAlert[]
    due_payables?: DuePayableAlert[]
    shift_anomalies: ShiftAnomalyAlert[]
}

export interface StockMovementTrendPoint {
    date: string
    label: string
    stock_in: number
    stock_out: number
}

export interface PendingReceivingPoItem {
    id: number
    po_number: string
    supplier_name: string
    receiving_status: string
    receiving_status_label: string
    order_date: string
    expected_date: string | null
}

export interface RejectedPoItem {
    id: number
    po_number: string
    supplier_name: string
    rejection_reason: string
    rejected_at: string
}

export interface WarehouseWidgetsData {
    stockMovementTrend: StockMovementTrendPoint[]
    pendingReceivingPos: PendingReceivingPoItem[]
    rejectedPos: RejectedPoItem[]
    lowStockProducts: LowStockAlert[]
}

export interface CashierDashboardData {
    myShift: {
        id: number
        shift_number: string
        register_name: string
        opened_at: string
        opened_at_human: string
        starting_cash: number
        transactions_count: number
    } | null
    myTodayTransactionsCount: number
    myRecentShifts: {
        id: number
        shift_number: string
        register_name: string
        opened_at: string
        closed_at: string
        total_transactions: number
        cash_variance: number
    }[]
    cashRegisters: CashRegisterOption[]
}

export const formatRupiah = (amount: number | string | null | undefined): string => {
    const num = Number(amount ?? 0)
    if (Number.isNaN(num)) {
        return 'Rp0'
    }
    return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0,
    }).format(num)
}

export const formatCompactRupiah = (value: number): string => {
    const abs = Math.abs(value)
    if (abs >= 1_000_000_000) {
        return `Rp${(value / 1_000_000_000).toFixed(1)}M`
    }
    if (abs >= 1_000_000) {
        return `Rp${(value / 1_000_000).toFixed(1)}jt`
    }
    if (abs >= 1_000) {
        return `Rp${Math.round(value / 1_000)}rb`
    }
    return `Rp${value}`
}

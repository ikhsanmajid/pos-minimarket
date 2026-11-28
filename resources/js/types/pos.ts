export interface PosProductUnit {
    id: number
    unit_name: string
    conversion_factor: number
    barcode: string | null
    sell_price: number
}

export interface PosLookupProduct {
    id: number
    barcode: string
    name: string
    base_unit: string
    sell_price: number
    stock: number
    image: string | null
    is_tax_exempt: boolean
    is_donation?: boolean
    matched_unit_id: number | null
    units: PosProductUnit[]
}

export interface PosDonationProduct {
    id: number
    barcode: string
    name: string
    base_unit: string
    sell_price: number
}

export interface PosCartItem {
    line_id: string
    product: PosLookupProduct
    product_unit_id: number | null
    unit_name: string
    conversion_factor: number
    unit_price: number
    qty: number
    discount_amount: number
}

export interface PosFinancialAccount {
    id: number
    code: string
    name: string
    type: string
    type_label: string
    is_default: boolean
}

export interface PosPaymentMethodOption {
    value: string
    label: string
}

export interface PosCustomerOption {
    id: number
    name: string
    phone: string | null
}

export interface PosHeldItem {
    product: PosLookupProduct
    product_unit_id: number | null
    qty: number
    discount_amount: number
}

export interface PosHeldTransaction {
    id: number
    hold_code: string
    label: string | null
    customer_id: number | null
    customer_name: string | null
    discount_amount: number
    notes: string | null
    items_count: number
    estimated_total: number
    items: PosHeldItem[]
    created_at: string
    created_at_human: string
}

export interface PosReceiptItem {
    id: number
    product_name: string
    unit_name: string
    qty: number
    unit_price: number
    discount_amount: number
    is_tax_exempt?: boolean
    is_donation?: boolean
    subtotal: number
}

export interface PosReceiptPayment {
    id: number
    payment_method: string
    payment_method_label: string
    account_name: string
    amount: number
    reference_number: string | null
}

export interface PosReceiptData {
    id: number
    invoice_number: string
    status: string
    status_label: string
    created_at: string
    cashier_name: string
    register_name: string
    shift_number: string
    customer_name: string | null
    subtotal: number
    discount_amount: number
    tax_amount: number
    rounding_amount: number
    donation_amount?: number
    grand_total: number
    paid_amount: number
    change_amount: number
    items: PosReceiptItem[]
    payments: PosReceiptPayment[]
}

export interface TransactionRow {
    id: number
    invoice_number: string
    created_at: string
    cashier_name: string
    customer_name: string
    items_count: number
    grand_total: number
    payment_methods: string[]
    status: string
    status_label: string
}

export interface TransactionDetailLine {
    id: number
    product_id: number
    product_name: string
    product_barcode: string
    unit_name: string
    conversion_factor: number
    qty: number
    base_qty: number
    returned_qty: number
    returnable_qty: number
    unit_price: number
    discount_amount: number
    is_tax_exempt?: boolean
    is_donation?: boolean
    subtotal: number
}

export interface SalesReturnItemRow {
    id: number
    product_name: string
    unit_name: string
    qty: number
    base_qty: number
    unit_price_snapshot: number
    subtotal_refund: number
    is_restockable: boolean
}

export interface SalesReturnRow {
    id: number
    return_number: string
    created_at: string
    refund_method: string
    refund_method_label: string
    account_name: string
    total_refund_amount: number
    reason: string
    processed_by_name: string
    approved_by_name: string
    items: SalesReturnItemRow[]
}

export interface TransactionDetailData {
    id: number
    invoice_number: string
    status: string
    status_label: string
    created_at: string
    cashier_name: string
    cashier_role: string
    shift_number: string | null
    register_name: string | null
    customer_name: string
    customer_phone: string | null
    subtotal: number
    discount_amount: number
    tax_amount: number
    rounding_amount: number
    donation_amount?: number
    grand_total: number
    paid_amount: number
    change_amount: number
    total_returned_amount: number
    voided_by_name: string | null
    voided_at: string | null
    void_reason: string | null
    discount_approved_by_name: string | null
    details: TransactionDetailLine[]
    payments: PosReceiptPayment[]
    sales_returns: SalesReturnRow[]
}

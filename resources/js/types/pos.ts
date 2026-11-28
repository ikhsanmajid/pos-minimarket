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

export interface PosCartPricingLine {
    index: number
    product_id: number
    product_unit_id: number | null
    qty: number
    base_unit_price: number
    member_unit_price?: number | null
    member_discount_amount?: number
    effective_unit_price: number
    line_gross: number
    auto_discount_amount: number
    manual_discount_amount: number
    discount_amount: number
    allocated_header_discount: number
    line_subtotal: number
    line_net_after_header: number
    free_qty: number
    pricing_source: 'regular' | 'member_price' | 'wholesale_tier' | 'promotion' | string
    applied_promotion_id: number | null
    applied_promotion_name: string | null
    applied_promotion_type: string | null
    applied_promotion_funding: string | null
    applied_tier_min_qty: number | null
    quota_consumed: number
    badge_label: string | null
    is_near_expiry_promo?: boolean
    is_promo_excluded: boolean
    tax_mode: 'exclusive' | 'inclusive' | 'exempt' | string
    is_tax_exempt: boolean
    is_donation: boolean
}

export interface PosCartLoyaltyInfo {
    customer_id: number | null
    tier: 'silver' | 'gold' | 'platinum' | string | null
    tier_label: string | null
    tier_multiplier: number
    active_point_balance: number
    max_redeemable_points: number
    max_redeemable_amount: number
    points_redeemed: number
    points_redeem_amount: number
    net_payable_after_points: number
    estimated_points_earned: number
    is_birthday: boolean
    is_first_purchase: boolean
}

export interface PosCartPricingSummary {
    gross_subtotal: number
    member_discount_total?: number
    auto_discount_total: number
    manual_item_discount_total: number
    item_discount_total: number
    transaction_promo_discount_total?: number
    voucher_discount_total?: number
    transaction_discount: number
    payment_promo_discount_total?: number
    cashback_total?: number
    manual_discount_total: number
    total_discount: number
    eligible_subtotal_after_item_auto: number
    net_subtotal: number
    taxable_amount: number
    tax_exempt_amount: number
    tax_amount: number
    rounding_amount: number
    grand_total: number
    points_redeemed?: number
    points_redeem_amount?: number
    net_payable_after_points?: number
    estimated_points_earned?: number
    total_items_qty: number
    has_tax_exempt_items: boolean
}

export interface PosAppliedVoucherInfo {
    applied: boolean
    auto_removed: boolean
    voucher_id: number | null
    code: string | null
    name: string | null
    type: string | null
    type_label: string | null
    funding: string | null
    min_spend: number
    discount_amount: number
    error_code: string | null
    message: string | null
}

export interface PosTebusMurahOffer {
    promotion_id: number
    name: string
    funding: string
    min_purchase_amount: number
    reward_product_id: number
    reward_product_name: string
    reward_product_barcode: string
    reward_product_unit: string
    normal_price: number
    special_price: number
    savings: number
    stock: number
    is_applied: boolean
}

export interface PosAppliedTransactionPromotion {
    promotion_id: number
    code: string | null
    name: string
    type: string
    type_label: string
    funding: string
    min_purchase_amount: number
    discount_amount: number
    stackable: boolean
    quota_consumed: number
}

export interface PosAppliedPaymentPromotion {
    promotion_id: number
    code: string | null
    name: string
    funding: string
    payment_method: string
    payment_bin_prefix: string | null
    matched_bin: string | null
    eligible_payment_amount: number
    discount_amount: number
    stackable: boolean
    quota_consumed: number
}

export interface PosCashbackPromotion {
    promotion_id: number
    name: string
    funding: string
    min_purchase_amount: number
    cashback_amount: number
    quota_consumed: number
}

export interface PosCartCalculationResponse {
    evaluated_at: string
    items: PosCartPricingLine[]
    summary: PosCartPricingSummary
    loyalty?: PosCartLoyaltyInfo
    voucher?: PosAppliedVoucherInfo | null
    vouchers?: PosAppliedVoucherInfo[]
    voucher_line_allocations?: Record<string, number>
    transaction_promotion?: PosAppliedTransactionPromotion | null
    tebus_murah_offers?: PosTebusMurahOffer[]
    applied_tebus_murah?: {
        promotion_id: number
        name: string
        reward_product_id: number
        reward_product_name: string
        normal_price: number
        special_price: number
        discount_amount: number
    } | null
    cashback_promotions?: PosCashbackPromotion[]
    payment_promotion?: PosAppliedPaymentPromotion | null
    promotion_quota_usage: Record<string, number>
}

export interface VoucherRow {
    id: number
    code: string
    name: string
    type: string
    type_label: string
    type_short_label: string
    value: number
    max_discount: number | null
    min_spend: number
    valid_from: string
    valid_until: string
    valid_from_display: string
    valid_until_display: string
    allowed_days: number
    allowed_hours_start: string | null
    allowed_hours_end: string | null
    total_quota: number | null
    used_count: number
    per_customer_limit: number | null
    per_day_limit: number | null
    store_ids: number[]
    channel: string
    member_only: boolean
    member_tiers: string[]
    applicable_skus: string[]
    applicable_products?: Array<{ id: number; name: string; barcode: string }>
    applicable_categories: number[]
    excluded_skus: string[]
    excluded_categories: number[]
    free_product_id: number | null
    free_product_name: string | null
    stackable_with_promo: boolean
    stackable_with_voucher: boolean
    funding: string
    funding_label: string
    supplier_id?: number | null
    supplier_name?: string | null
    store_share_percent?: number
    supplier_share_percent?: number
    status: string
    status_label: string
    computed_status: 'draft' | 'active' | 'paused' | 'expired' | 'exhausted' | string
    computed_status_label: string
    creator_name: string
}

export interface CustomerTierOption {
    value: string
    label: string
    multiplier: number
}

export interface ProductMemberPriceRow {
    id: number
    product_id: number
    product_unit_id: number | null
    unit_name: string
    tier: string | null
    tier_label: string
    member_price: number
    is_active: boolean
}

export interface CustomerPointLedgerRow {
    id: number
    type: string
    type_label: string
    points: number
    remaining_points: number
    expires_at: string | null
    is_expired: boolean
    description: string
    invoice_number: string | null
    return_number: string | null
    creator_name: string
    created_at: string
}

export interface ProductPriceTierRow {
    id: number
    product_id: number
    product_unit_id: number | null
    unit_name: string
    min_qty: number
    unit_price: number
    is_active: boolean
}

export interface PromotionRow {
    id: number
    code: string | null
    name: string
    type: string
    type_label: string
    type_short_label: string
    scope: string
    scope_label: string
    funding: string
    funding_label: string
    supplier_id?: number | null
    supplier_name?: string | null
    store_share_percent?: number
    supplier_share_percent?: number
    discount_value: number | null
    max_discount_amount: number | null
    min_purchase_amount: number
    buy_qty: number | null
    get_qty: number | null
    get_discount_percent: number
    bundle_price: number | null
    nth_item?: number | null
    reward_product_id?: number | null
    reward_product?: {
        id: number
        name: string
        barcode: string
        sell_price: number
    } | null
    special_price?: number | null
    payment_method?: string | null
    payment_bin_prefix?: string | null
    near_expiry_days?: number | null
    bundle_items?: Array<{
        product_id: number
        product_name: string
        product_barcode: string
        required_qty: number
    }>
    starts_at: string
    ends_at: string
    starts_at_display: string
    ends_at_display: string
    days_mask: number
    time_start: string | null
    time_end: string | null
    quota_total: number | null
    quota_used: number
    max_qty_per_transaction: number | null
    max_qty_per_customer_per_day: number | null
    stackable: boolean
    exclusive_group: string | null
    priority: number
    member_only: boolean
    is_active: boolean
    computed_status: 'active' | 'scheduled' | 'expired' | 'inactive' | string
    creator_name: string
    product_ids: number[]
    selected_products?: Array<{ id: number; name: string; barcode: string }>
    category_ids: number[]
    products_count: number
    categories_count: number
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
    member_code?: string
    name: string
    phone: string | null
    points?: number
    tier?: string
    tier_label?: string
    tier_multiplier?: number
    birth_date?: string | null
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
    effective_unit_price?: number
    discount_amount: number
    pricing_source?: 'regular' | 'wholesale_tier' | 'promotion' | string
    applied_promotion_name?: string | null
    free_qty?: number
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
    customer_tier?: string | null
    customer_tier_label?: string | null
    customer_points_balance?: number | null
    points_redeemed?: number
    points_redeem_amount?: number
    points_earned?: number
    subtotal: number
    discount_amount: number
    voucher_code?: string | null
    voucher_name?: string | null
    voucher_discount_amount?: number
    transaction_promotions?: Array<{
        type: string
        name: string
        discount_amount: number
    }>
    payment_promotion?: {
        name: string
        discount_amount: number
        payment_method?: string | null
    } | null
    cashback_promotions?: Array<{
        name: string
        cashback_amount: number
    }>
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
    pricing_source?: string
    applied_promotion_name?: string | null
    allocated_header_discount?: number
    free_qty?: number
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
    voucher_code?: string | null
    voucher_name?: string | null
    voucher_discount_amount?: number
    transaction_promotions?: Array<{
        type: string
        name: string
        discount_amount: number
    }>
    payment_promotion?: {
        name: string
        discount_amount: number
        payment_method?: string | null
    } | null
    cashback_promotions?: Array<{
        name: string
        cashback_amount: number
    }>
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

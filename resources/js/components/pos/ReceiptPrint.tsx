import React from 'react'
import { usePage } from '@inertiajs/react'
import type { PageProps, PosReceiptData } from '@/types'

interface ReceiptPrintProps {
    receipt: PosReceiptData
    paperWidth?: '58mm' | '80mm'
    isReprint?: boolean
}

const formatRp = (val: number): string =>
    new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0,
    }).format(val)

export function ReceiptPrint({
    receipt,
    paperWidth = '80mm',
    isReprint = false,
}: ReceiptPrintProps) {
    const { storeSettings } = usePage<PageProps>().props
    const storeName = storeSettings?.store_name || 'POS MINIMARKET'
    const isVoided = receipt.status === 'voided'

    return (
        <div
            className={`receipt-print-area ${
                paperWidth === '58mm' ? 'receipt-width-58' : 'receipt-width-80'
            } hidden print:block font-mono text-black bg-white`}
        >
            <div className="text-center border-b border-dashed border-black pb-2 mb-2">
                {storeSettings?.store_logo_url && (
                    <img
                        src={storeSettings.store_logo_url}
                        alt={storeName}
                        className="mx-auto mb-1 max-h-12 object-contain grayscale"
                    />
                )}
                <h1 className="text-sm font-bold uppercase tracking-wide">{storeName}</h1>
                {storeSettings?.store_address && (
                    <p className="text-[10px] leading-tight">{storeSettings.store_address}</p>
                )}
                {storeSettings?.store_phone && (
                    <p className="text-[10px]">Telp: {storeSettings.store_phone}</p>
                )}
                {storeSettings?.receipt_header && (
                    <p className="mt-1 text-[10px] whitespace-pre-line">{storeSettings.receipt_header}</p>
                )}
                {isVoided && (
                    <p className="mt-1 border border-black py-0.5 text-xs font-bold uppercase">
                        *** VOID / DIBATALKAN ***
                    </p>
                )}
                {isReprint && !isVoided && (
                    <p className="mt-1 text-[10px] font-bold uppercase">*** CETAK ULANG ***</p>
                )}
            </div>

            <div className="space-y-0.5 text-[10px] border-b border-dashed border-black pb-2 mb-2">
                <div className="flex justify-between gap-2">
                    <span>No. Inv</span>
                    <span className="font-semibold">{receipt.invoice_number}</span>
                </div>
                <div className="flex justify-between gap-2">
                    <span>Tanggal</span>
                    <span>{receipt.created_at}</span>
                </div>
                <div className="flex justify-between gap-2">
                    <span>Kasir</span>
                    <span>{receipt.cashier_name}</span>
                </div>
                {receipt.customer_name && (
                    <div className="flex justify-between gap-2">
                        <span>Pelanggan</span>
                        <span>
                            {receipt.customer_name}
                            {receipt.customer_tier_label ? ` (${receipt.customer_tier_label})` : ''}
                        </span>
                    </div>
                )}
            </div>

            <div className="space-y-1.5 text-[10px] border-b border-dashed border-black pb-2 mb-2">
                {receipt.items.map((item) => (
                    <div key={item.id}>
                        <div className="font-semibold leading-tight">
                            {item.product_name}
                            {item.is_donation ? ' (Donasi)' : item.is_tax_exempt ? ' (Bebas PPN)' : ''}
                        </div>
                        <div className="flex justify-between gap-2">
                            <span>
                                {item.qty} {item.unit_name} x {formatRp(item.unit_price)}
                            </span>
                            <span className="font-semibold">{formatRp(item.subtotal)}</span>
                        </div>
                        {item.discount_amount > 0 && (
                            <div className="flex justify-between gap-2 text-[9px] italic">
                                <span className="truncate">
                                    {item.pricing_source === 'member_price'
                                        ? 'Harga Member'
                                        : item.pricing_source === 'wholesale_tier'
                                          ? 'Harga Grosir'
                                          : item.pricing_source === 'promotion' && item.applied_promotion_name
                                            ? `Promo: ${item.applied_promotion_name}`
                                            : 'Diskon item'}
                                </span>
                                <span className="shrink-0">-{formatRp(item.discount_amount)}</span>
                            </div>
                        )}
                    </div>
                ))}
            </div>

            <div className="space-y-0.5 text-[10px] border-b border-dashed border-black pb-2 mb-2">
                <div className="flex justify-between">
                    <span>Subtotal</span>
                    <span>{formatRp(receipt.subtotal)}</span>
                </div>
                {(receipt.transaction_promotions ?? []).map((tp, idx) => (
                    <div key={`${tp.type}-${idx}`} className="flex justify-between gap-2">
                        <span className="truncate">{tp.name}</span>
                        <span className="shrink-0">-{formatRp(tp.discount_amount)}</span>
                    </div>
                ))}
                {(receipt.voucher_discount_amount ?? 0) > 0 && (
                    <div className="flex justify-between gap-2">
                        <span className="truncate">
                            Voucher{receipt.voucher_code ? ` (${receipt.voucher_code})` : ''}
                        </span>
                        <span className="shrink-0">-{formatRp(receipt.voucher_discount_amount ?? 0)}</span>
                    </div>
                )}
                {receipt.payment_promotion && receipt.payment_promotion.discount_amount > 0 && (
                    <div className="flex justify-between gap-2">
                        <span className="truncate">Promo Bayar: {receipt.payment_promotion.name}</span>
                        <span className="shrink-0">-{formatRp(receipt.payment_promotion.discount_amount)}</span>
                    </div>
                )}
                {receipt.discount_amount > 0 && (
                    <div className="flex justify-between">
                        <span>Total Diskon</span>
                        <span>-{formatRp(receipt.discount_amount)}</span>
                    </div>
                )}
                {(receipt.cashback_promotions ?? []).map((cb, idx) => (
                    <div key={`cb-${idx}`} className="flex justify-between gap-2 text-[9px] italic">
                        <span className="truncate">{cb.name}</span>
                        <span className="shrink-0">+{formatRp(cb.cashback_amount)}</span>
                    </div>
                ))}
                {receipt.tax_amount > 0 && (
                    <div className="flex justify-between">
                        <span>PPN</span>
                        <span>{formatRp(receipt.tax_amount)}</span>
                    </div>
                )}
                {receipt.rounding_amount !== 0 && (
                    <div className="flex justify-between">
                        <span>Pembulatan</span>
                        <span>
                            {receipt.rounding_amount > 0 ? '+' : ''}
                            {formatRp(receipt.rounding_amount)}
                        </span>
                    </div>
                )}
                {(receipt.donation_amount ?? 0) > 0 && (
                    <div className="flex justify-between">
                        <span>Donasi</span>
                        <span>{formatRp(receipt.donation_amount ?? 0)}</span>
                    </div>
                )}
                <div className="flex justify-between text-xs font-bold border-t border-dotted border-black pt-1 mt-1">
                    <span>TOTAL</span>
                    <span>{formatRp(receipt.grand_total)}</span>
                </div>
            </div>

            <div className="space-y-0.5 text-[10px] border-b border-dashed border-black pb-2 mb-2">
                {(receipt.points_redeemed ?? 0) > 0 && (
                    <div className="flex justify-between gap-2">
                        <span>Tukar Poin ({receipt.points_redeemed} pt)</span>
                        <span>{formatRp(receipt.points_redeem_amount ?? 0)}</span>
                    </div>
                )}
                {receipt.payments.map((payment) => (
                    <div key={payment.id} className="flex justify-between gap-2">
                        <span>
                            {payment.payment_method_label}
                            {payment.reference_number ? ` (${payment.reference_number})` : ''}
                        </span>
                        <span>{formatRp(payment.amount)}</span>
                    </div>
                ))}
                <div className="flex justify-between font-semibold">
                    <span>Total Bayar</span>
                    <span>{formatRp(receipt.paid_amount + (receipt.points_redeem_amount ?? 0))}</span>
                </div>
                <div className="flex justify-between font-bold">
                    <span>Kembalian</span>
                    <span>{formatRp(receipt.change_amount)}</span>
                </div>
            </div>

            {receipt.customer_name &&
                ((receipt.points_redeemed ?? 0) > 0 ||
                    (receipt.points_earned ?? 0) > 0 ||
                    receipt.customer_points_balance !== null && receipt.customer_points_balance !== undefined) && (
                    <div className="space-y-0.5 text-[10px] border-b border-dashed border-black pb-2 mb-2">
                        <div className="font-semibold">INFO POIN MEMBER</div>
                        {(receipt.points_redeemed ?? 0) > 0 && (
                            <div className="flex justify-between gap-2">
                                <span>Poin Ditukar</span>
                                <span>-{receipt.points_redeemed} pt</span>
                            </div>
                        )}
                        {(receipt.points_earned ?? 0) > 0 && (
                            <div className="flex justify-between gap-2">
                                <span>Poin Diperoleh</span>
                                <span>+{receipt.points_earned} pt</span>
                            </div>
                        )}
                        {receipt.customer_points_balance !== null &&
                            receipt.customer_points_balance !== undefined && (
                                <div className="flex justify-between gap-2 font-semibold">
                                    <span>Sisa Saldo Poin</span>
                                    <span>{receipt.customer_points_balance} pt</span>
                                </div>
                            )}
                    </div>
                )}

            <div className="text-center text-[10px] pt-1 space-y-1">
                <p className="whitespace-pre-line">
                    {storeSettings?.receipt_footer || 'Terima kasih telah berbelanja.'}
                </p>
                <p className="text-[9px]">{receipt.shift_number}</p>
            </div>
        </div>
    )
}

import React from 'react'
import { usePage } from '@inertiajs/react'
import type { PageProps } from '@/types'
import {
    formatRupiah,
    formatSignedRupiah,
    type DenominationRow,
    type PaymentBreakdownRow,
    type ShiftMovementItem,
} from './shiftUtils'

export interface ShiftDetailData {
    id: number
    shift_number: string
    register_name: string
    status: string
    status_label: string
    cashier_name: string
    cashier_email: string
    cashier_role: string
    opened_at: string
    closed_at: string | null
    starting_cash: number
    expected_cash: number | null
    actual_cash: number | null
    cash_variance: number | null
    total_cash_sales: number | null
    total_non_cash_sales: number | null
    total_refunds: number | null
    total_cash_in: number
    total_cash_out: number
    total_cash_drop: number
    total_transactions: number
    denomination_breakdown: DenominationRow[]
    closing_notes: string | null
    verified_by_name: string | null
    verified_by_role: string | null
    payment_breakdown: PaymentBreakdownRow[]
    movements: ShiftMovementItem[]
}

export function ShiftZReportPrint({ shift }: { shift: ShiftDetailData }) {
    const { storeSettings } = usePage<PageProps>().props
    const totalSales = (shift.total_cash_sales ?? 0) + (shift.total_non_cash_sales ?? 0)
    const filledDenominations = (shift.denomination_breakdown ?? []).filter((d) => d.qty > 0)
    const storeName = storeSettings?.store_name || 'POS MINIMARKET'

    return (
        <div className="zreport-print-area hidden print:block font-mono text-black">
            <div className="text-center border-b border-dashed border-black pb-3 mb-3">
                <h1 className="text-base font-bold uppercase tracking-wide">{storeName}</h1>
                {storeSettings?.store_address && (
                    <p className="text-[10px]">{storeSettings.store_address}</p>
                )}
                {storeSettings?.store_phone && (
                    <p className="text-[10px]">Telp: {storeSettings.store_phone}</p>
                )}
                <p className="text-xs font-semibold">Z-REPORT / LAPORAN TUTUP SHIFT</p>
                <p className="text-xs">{shift.shift_number}</p>
            </div>

            <div className="space-y-1 text-xs border-b border-dashed border-black pb-3 mb-3">
                <div className="flex justify-between">
                    <span>Kasir:</span>
                    <span className="font-semibold">{shift.cashier_name}</span>
                </div>
                <div className="flex justify-between">
                    <span>Mesin Kasir:</span>
                    <span>{shift.register_name}</span>
                </div>
                <div className="flex justify-between">
                    <span>Buka Shift:</span>
                    <span>{shift.opened_at}</span>
                </div>
                <div className="flex justify-between">
                    <span>Tutup Shift:</span>
                    <span>{shift.closed_at ?? 'Masih Aktif'}</span>
                </div>
                <div className="flex justify-between">
                    <span>Total Transaksi:</span>
                    <span>{shift.total_transactions} trx</span>
                </div>
            </div>

            <div className="space-y-1 text-xs border-b border-dashed border-black pb-3 mb-3">
                <p className="font-bold uppercase mb-1">Ringkasan Penjualan</p>
                <div className="flex justify-between">
                    <span>Penjualan Tunai</span>
                    <span>{formatRupiah(shift.total_cash_sales ?? 0)}</span>
                </div>
                <div className="flex justify-between">
                    <span>Penjualan Non-Tunai</span>
                    <span>{formatRupiah(shift.total_non_cash_sales ?? 0)}</span>
                </div>
                <div className="flex justify-between">
                    <span>Total Refund</span>
                    <span>-{formatRupiah(shift.total_refunds ?? 0)}</span>
                </div>
                <div className="flex justify-between font-bold border-t border-dotted border-black pt-1">
                    <span>Total Omzet</span>
                    <span>{formatRupiah(totalSales)}</span>
                </div>
            </div>

            {shift.payment_breakdown.length > 0 && (
                <div className="space-y-1 text-xs border-b border-dashed border-black pb-3 mb-3">
                    <p className="font-bold uppercase mb-1">Per Metode Pembayaran</p>
                    {shift.payment_breakdown.map((p) => (
                        <div key={p.method} className="flex justify-between">
                            <span>
                                {p.label} ({p.count}x)
                            </span>
                            <span>{formatRupiah(p.total)}</span>
                        </div>
                    ))}
                </div>
            )}

            <div className="space-y-1 text-xs border-b border-dashed border-black pb-3 mb-3">
                <p className="font-bold uppercase mb-1">Rekonsiliasi Laci Kas</p>
                <div className="flex justify-between">
                    <span>Modal Awal</span>
                    <span>{formatRupiah(shift.starting_cash)}</span>
                </div>
                <div className="flex justify-between">
                    <span>(+) Penjualan Tunai</span>
                    <span>{formatRupiah(shift.total_cash_sales ?? 0)}</span>
                </div>
                <div className="flex justify-between">
                    <span>(+) Cash In</span>
                    <span>{formatRupiah(shift.total_cash_in)}</span>
                </div>
                <div className="flex justify-between">
                    <span>(-) Cash Out</span>
                    <span>-{formatRupiah(shift.total_cash_out)}</span>
                </div>
                <div className="flex justify-between">
                    <span>(-) Cash Drop</span>
                    <span>-{formatRupiah(shift.total_cash_drop)}</span>
                </div>
                <div className="flex justify-between font-bold border-t border-dotted border-black pt-1">
                    <span>Ekspektasi Kas</span>
                    <span>{formatRupiah(shift.expected_cash ?? 0)}</span>
                </div>
                <div className="flex justify-between font-bold">
                    <span>Fisik Dihitung</span>
                    <span>{formatRupiah(shift.actual_cash ?? 0)}</span>
                </div>
                <div className="flex justify-between font-bold">
                    <span>Selisih (Variance)</span>
                    <span>{formatSignedRupiah(shift.cash_variance)}</span>
                </div>
            </div>

            {filledDenominations.length > 0 && (
                <div className="space-y-1 text-xs border-b border-dashed border-black pb-3 mb-3">
                    <p className="font-bold uppercase mb-1">Rincian Pecahan Uang</p>
                    {filledDenominations.map((d) => (
                        <div key={d.denomination} className="flex justify-between">
                            <span>
                                {formatRupiah(d.denomination)} x {d.qty}
                            </span>
                            <span>{formatRupiah(d.subtotal)}</span>
                        </div>
                    ))}
                </div>
            )}

            {shift.closing_notes && (
                <div className="text-xs border-b border-dashed border-black pb-3 mb-3">
                    <p className="font-bold uppercase mb-0.5">Catatan:</p>
                    <p>{shift.closing_notes}</p>
                </div>
            )}

            <div className="text-xs text-center pt-2 space-y-6">
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <p>Kasir,</p>
                        <div className="h-12" />
                        <p className="border-t border-black pt-1 font-semibold">{shift.cashier_name}</p>
                    </div>
                    <div>
                        <p>Verifikasi,</p>
                        <div className="h-12" />
                        <p className="border-t border-black pt-1 font-semibold">
                            {shift.verified_by_name ?? 'Supervisor / Admin'}
                        </p>
                    </div>
                </div>
                <p className="text-[10px]">Dicetak pada {new Date().toLocaleString('id-ID')}</p>
            </div>
        </div>
    )
}

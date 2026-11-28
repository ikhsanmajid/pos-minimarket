import React, { useMemo, useState } from 'react'
import { Link } from '@inertiajs/react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import financeSupplierClaims from '@/routes/pos/finance/supplier-claims'
import { ArrowRight, CheckCircle2, ReceiptText, Store, TicketPercent, Truck } from 'lucide-react'
import { formatIdr } from './reportUtils'

export interface PromoFinanceSummary {
    total_discount: number
    store_burden: number
    supplier_burden: number
    supplier_pending_claim: number
    supplier_claimed_amount: number
    supplier_paid_amount: number
    transactions_count: number
}

export interface SupplierPromoClaimRow {
    supplier_id: number | null
    supplier_name: string
    pending_count: number
    pending_amount: number
    claimed_amount: number
    paid_amount: number
    total_supplier_burden: number
}

export interface PromoHistoryRow {
    id: number
    transaction_id: number
    invoice_number: string
    transaction_date: string
    transaction_grand_total: number
    description: string
    type: string
    funding: string
    funding_label: string
    supplier_id: number | null
    supplier_name: string | null
    discount_amount: number
    store_discount_amount: number
    supplier_discount_amount: number
    claim_status: 'not_applicable' | 'pending' | 'claimed' | 'paid' | string
    settlement_method_label?: string | null
    claimed_at: string | null
    claim_reference: string | null
    claim_notes: string | null
}

interface FinancePromoClaimsSectionProps {
    promoSummary: PromoFinanceSummary
    supplierPromoClaims: SupplierPromoClaimRow[]
    promoHistory: PromoHistoryRow[]
}

const FILTER_ITEMS = [
    { value: 'all', label: 'Semua Status' },
    { value: 'pending', label: 'Belum Diklaim' },
    { value: 'claimed', label: 'Sudah Diajukan' },
    { value: 'paid', label: 'Lunas / Selesai' },
    { value: 'store_only', label: 'Beban Toko Saja' },
]

function renderClaimBadge(status: string, supplierAmt: number) {
    if (supplierAmt <= 0 || status === 'not_applicable') {
        return (
            <Badge variant="outline" className="text-[10px] text-muted-foreground">
                Beban Toko
            </Badge>
        )
    }
    if (status === 'paid') {
        return (
            <Badge variant="success" className="text-[10px]">
                Lunas / Selesai
            </Badge>
        )
    }
    if (status === 'claimed') {
        return (
            <Badge
                variant="secondary"
                className="text-[10px] border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950/60 dark:text-blue-300"
            >
                Diajukan Klaim
            </Badge>
        )
    }
    return (
        <Badge
            variant="outline"
            className="text-[10px] border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/60 dark:text-amber-300"
        >
            Belum Diklaim
        </Badge>
    )
}

export function FinancePromoClaimsSection({
    promoSummary,
    supplierPromoClaims,
    promoHistory,
}: FinancePromoClaimsSectionProps) {
    const [statusFilter, setStatusFilter] = useState<string>('all')

    const filteredHistory = useMemo(() => {
        if (statusFilter === 'all') return promoHistory
        if (statusFilter === 'store_only') {
            return promoHistory.filter((r) => r.supplier_discount_amount <= 0)
        }
        return promoHistory.filter(
            (r) => r.supplier_discount_amount > 0 && r.claim_status === statusFilter
        )
    }, [promoHistory, statusFilter])

    return (
        <div className="space-y-4">
            {/* Ringkasan Beban Promo (Toko vs Supplier) */}
            <Card>
                <CardHeader className="pb-3">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <CardTitle className="text-base flex items-center gap-2">
                                <TicketPercent className="h-4 w-4 text-primary" />
                                Detail Beban Promo &amp; Klaim Supplier
                            </CardTitle>
                            <CardDescription className="text-xs">
                                Rincian potongan promo/voucher pada periode laporan berdasarkan penanggung biaya (Toko vs Supplier/Patungan).
                            </CardDescription>
                        </div>
                        <Link href={financeSupplierClaims.index.url()}>
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="h-8 gap-1.5 text-xs cursor-pointer"
                            >
                                Kelola Klaim Supplier
                                <ArrowRight className="h-3.5 w-3.5" />
                            </Button>
                        </Link>
                    </div>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                        <div className="rounded-lg border bg-muted/30 p-3">
                            <div className="flex items-center justify-between text-xs text-muted-foreground">
                                <span>Total Diskon Promo</span>
                                <ReceiptText className="h-3.5 w-3.5" />
                            </div>
                            <div className="mt-1 font-mono text-lg font-bold text-foreground">
                                {formatIdr(promoSummary.total_discount)}
                            </div>
                            <div className="text-[11px] text-muted-foreground mt-0.5">
                                {promoSummary.transactions_count} transaksi berpromo
                            </div>
                        </div>

                        <div className="rounded-lg border bg-muted/30 p-3">
                            <div className="flex items-center justify-between text-xs text-muted-foreground">
                                <span>Ditanggung Toko</span>
                                <Store className="h-3.5 w-3.5 text-amber-600" />
                            </div>
                            <div className="mt-1 font-mono text-lg font-bold text-amber-600 dark:text-amber-400">
                                {formatIdr(promoSummary.store_burden)}
                            </div>
                            <div className="text-[11px] text-muted-foreground mt-0.5">
                                Beban margin toko langsung
                            </div>
                        </div>

                        <div className="rounded-lg border bg-muted/30 p-3">
                            <div className="flex items-center justify-between text-xs text-muted-foreground">
                                <span>Ditanggung Supplier</span>
                                <Truck className="h-3.5 w-3.5 text-blue-600" />
                            </div>
                            <div className="mt-1 font-mono text-lg font-bold text-blue-600 dark:text-blue-400">
                                {formatIdr(promoSummary.supplier_burden)}
                            </div>
                            <div className="text-[11px] text-muted-foreground mt-0.5">
                                Belum diklaim: {formatIdr(promoSummary.supplier_pending_claim)}
                            </div>
                        </div>

                        <div className="rounded-lg border bg-muted/30 p-3">
                            <div className="flex items-center justify-between text-xs text-muted-foreground">
                                <span>Klaim Supplier Lunas</span>
                                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                            </div>
                            <div className="mt-1 font-mono text-lg font-bold text-emerald-600 dark:text-emerald-400">
                                {formatIdr(promoSummary.supplier_paid_amount)}
                            </div>
                            <div className="text-[11px] text-muted-foreground mt-0.5">
                                Diajukan: {formatIdr(promoSummary.supplier_claimed_amount)}
                            </div>
                        </div>
                    </div>

                    {/* Rekap per Supplier */}
                    {supplierPromoClaims.length > 0 && (
                        <div className="space-y-2 pt-2 border-t">
                            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                Rekap Klaim Promo per Supplier
                            </p>
                            <div className="overflow-x-auto">
                                <table className="table-fixed w-full min-w-[640px] text-sm">
                                    <thead>
                                        <tr className="border-b text-xs text-muted-foreground">
                                            <th className="w-[32%] py-2 text-left font-medium">Supplier</th>
                                            <th className="w-[17%] py-2 text-right font-medium">Belum Diklaim</th>
                                            <th className="w-[17%] py-2 text-right font-medium">Diajukan Klaim</th>
                                            <th className="w-[17%] py-2 text-right font-medium">Lunas / Selesai</th>
                                            <th className="w-[17%] py-2 text-right font-medium">Total Porsi Supplier</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y">
                                        {supplierPromoClaims.map((row, idx) => (
                                            <tr key={`${row.supplier_id ?? 'none'}-${idx}`}>
                                                <td className="py-2 font-medium text-foreground truncate">
                                                    {row.supplier_name}
                                                </td>
                                                <td className="py-2 text-right font-mono text-xs text-amber-600 dark:text-amber-400">
                                                    {formatIdr(row.pending_amount)}{' '}
                                                    {row.pending_count > 0 && (
                                                        <span className="text-muted-foreground">({row.pending_count})</span>
                                                    )}
                                                </td>
                                                <td className="py-2 text-right font-mono text-xs text-blue-600 dark:text-blue-400">
                                                    {formatIdr(row.claimed_amount)}
                                                </td>
                                                <td className="py-2 text-right font-mono text-xs text-emerald-600 dark:text-emerald-400">
                                                    {formatIdr(row.paid_amount)}
                                                </td>
                                                <td className="py-2 text-right font-mono text-xs font-semibold">
                                                    {formatIdr(row.total_supplier_burden)}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Riwayat Transaksi Promo (Read-Only) */}
            <Card>
                <CardHeader className="pb-3">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <CardTitle className="text-base">Riwayat Transaksi Promo</CardTitle>
                            <CardDescription className="text-xs">
                                Daftar detail transaksi yang menggunakan promo/voucher beserta pembagian biaya dan status penyelesaian klaim.
                            </CardDescription>
                        </div>

                        <Select
                            items={FILTER_ITEMS}
                            value={statusFilter}
                            onValueChange={(v) => v && setStatusFilter(v)}
                        >
                            <SelectTrigger className="w-full sm:w-auto sm:min-w-[165px] h-9 text-xs">
                                <SelectValue>
                                    {(val) =>
                                        FILTER_ITEMS.find((i) => i.value === val)?.label ?? 'Semua Status'
                                    }
                                </SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                                {FILTER_ITEMS.map((item) => (
                                    <SelectItem key={item.value} value={item.value}>
                                        {item.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </CardHeader>
                <CardContent>
                    {filteredHistory.length === 0 ? (
                        <p className="py-8 text-center text-sm text-muted-foreground">
                            Belum ada riwayat transaksi promo pada periode / filter ini.
                        </p>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="table-fixed w-full min-w-[880px] text-sm">
                                <thead>
                                    <tr className="border-b text-xs text-muted-foreground">
                                        <th className="w-[17%] py-2 text-left font-medium">Invoice &amp; Tanggal</th>
                                        <th className="w-[23%] py-2 text-left font-medium">Promo / Voucher</th>
                                        <th className="w-[16%] py-2 text-left font-medium">Penanggung &amp; Supplier</th>
                                        <th className="w-[11%] py-2 text-right font-medium">Total Diskon</th>
                                        <th className="w-[11%] py-2 text-right font-medium">Porsi Toko</th>
                                        <th className="w-[11%] py-2 text-right font-medium">Porsi Supplier</th>
                                        <th className="w-[11%] py-2 text-left font-medium pl-3">Status Klaim</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y">
                                    {filteredHistory.map((row) => (
                                        <tr key={row.id} className="hover:bg-muted/20">
                                            <td className="py-2.5 pr-2">
                                                <div className="font-mono text-xs font-semibold text-foreground truncate">
                                                    {row.invoice_number}
                                                </div>
                                                <div className="font-mono text-[11px] text-muted-foreground truncate">
                                                    {row.transaction_date}
                                                </div>
                                            </td>
                                            <td className="py-2.5 pr-2">
                                                <div
                                                    className="text-xs font-medium text-foreground truncate"
                                                    title={row.description}
                                                >
                                                    {row.description}
                                                </div>
                                                <div className="text-[11px] text-muted-foreground font-mono">
                                                    Total Struk: {formatIdr(row.transaction_grand_total)}
                                                </div>
                                            </td>
                                            <td className="py-2.5 pr-2">
                                                <Badge variant="outline" className="text-[10px]">
                                                    {row.funding_label}
                                                </Badge>
                                                {row.supplier_name && (
                                                    <div
                                                        className="text-[11px] text-muted-foreground mt-0.5 truncate"
                                                        title={row.supplier_name}
                                                    >
                                                        {row.supplier_name}
                                                    </div>
                                                )}
                                            </td>
                                            <td className="py-2.5 text-right font-mono text-xs font-semibold">
                                                {formatIdr(row.discount_amount)}
                                            </td>
                                            <td className="py-2.5 text-right font-mono text-xs text-amber-600 dark:text-amber-400">
                                                {formatIdr(row.store_discount_amount)}
                                            </td>
                                            <td className="py-2.5 text-right font-mono text-xs text-blue-600 dark:text-blue-400 font-medium">
                                                {formatIdr(row.supplier_discount_amount)}
                                            </td>
                                            <td className="py-2.5 pl-3">
                                                {renderClaimBadge(row.claim_status, row.supplier_discount_amount)}
                                                {row.settlement_method_label && (
                                                    <div
                                                        className="text-[10px] text-muted-foreground mt-0.5 truncate"
                                                        title={row.settlement_method_label}
                                                    >
                                                        {row.settlement_method_label}
                                                    </div>
                                                )}
                                                {row.claim_reference && (
                                                    <div
                                                        className="font-mono text-[10px] text-muted-foreground truncate"
                                                        title={row.claim_reference}
                                                    >
                                                        Ref: {row.claim_reference}
                                                    </div>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}

export default FinancePromoClaimsSection

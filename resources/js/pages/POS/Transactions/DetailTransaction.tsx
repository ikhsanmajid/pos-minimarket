import React, { useState } from 'react'
import { Link, router, usePage } from '@inertiajs/react'
import {
    AlertTriangle,
    ArrowLeft,
    Heart,
    History,
    Printer,
    ReceiptText,
    RotateCcw,
} from 'lucide-react'
import AuthenticatedLayout from '@/layouts/AuthenticatedLayout'
import { ReceiptPrint } from '@/components/pos/ReceiptPrint'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import transactions from '@/routes/pos/transactions'
import type {
    PageProps,
    PosFinancialAccount,
    PosPaymentMethodOption,
    PosReceiptData,
    TransactionDetailData,
} from '@/types'
import { SalesReturnDialog } from './component/SalesReturnDialog'
import { VoidTransactionDialog } from './component/VoidTransactionDialog'
import { formatRupiah, getTransactionStatusBadgeClass } from './component/transactionUtils'

interface ActivityItem {
    id: number
    description: string
    event: string | null
    causer_name: string
    causer_role: string | null
    created_at: string | null
    created_at_human: string | null
}

type DetailTransactionProps = PageProps<{
    transaction: TransactionDetailData
    receipt: PosReceiptData
    financialAccounts: PosFinancialAccount[]
    paymentMethods: PosPaymentMethodOption[]
    canVoid: boolean
    canReturn: boolean
    activities?: {
        data: ActivityItem[]
        total: number
    }
}>

const DetailTransaction = () => {
    const {
        transaction,
        receipt,
        financialAccounts,
        paymentMethods,
        canVoid,
        canReturn,
        activities,
    } = usePage<DetailTransactionProps>().props

    const [activeTab, setActiveTab] = useState<'detail' | 'activities'>('detail')
    const [paperWidth, setPaperWidth] = useState<'58mm' | '80mm'>('80mm')
    const [voidOpen, setVoidOpen] = useState(false)
    const [returnOpen, setReturnOpen] = useState(false)
    const [loadingActivities, setLoadingActivities] = useState(false)

    const handleTabChange = (tab: 'detail' | 'activities') => {
        setActiveTab(tab)
        if (tab === 'activities' && !activities) {
            setLoadingActivities(true)
            router.reload({
                only: ['activities'],
                onFinish: () => setLoadingActivities(false),
            })
        }
    }

    const handleReprint = (width: '58mm' | '80mm') => {
        setPaperWidth(width)
        window.setTimeout(() => {
            window.print()
        }, 80)
    }

    return (
        <>
            <div className="no-print space-y-6">
                {/* Header */}
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                            <Link href={transactions.index.url()}>
                                <Button variant="ghost" size="icon" className="h-8 w-8 cursor-pointer">
                                    <ArrowLeft className="h-4 w-4" />
                                </Button>
                            </Link>
                            <h1 className="font-mono text-2xl font-bold tracking-tight text-foreground">
                                {transaction.invoice_number}
                            </h1>
                            <span
                                className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${getTransactionStatusBadgeClass(transaction.status)}`}
                            >
                                {transaction.status_label}
                            </span>
                        </div>
                        <p className="text-xs text-muted-foreground pl-10">
                            {transaction.created_at} • Kasir: {transaction.cashier_name} ({transaction.cashier_role})
                            {transaction.shift_number ? ` • Shift ${transaction.shift_number}` : ''}
                        </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => handleReprint('58mm')}
                            className="gap-1.5 cursor-pointer"
                        >
                            <Printer className="h-4 w-4" />
                            Cetak 58mm
                        </Button>
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => handleReprint('80mm')}
                            className="gap-1.5 cursor-pointer"
                        >
                            <Printer className="h-4 w-4" />
                            Cetak 80mm
                        </Button>
                        {canReturn && (
                            <Button
                                type="button"
                                variant="secondary"
                                size="sm"
                                onClick={() => setReturnOpen(true)}
                                className="gap-1.5 cursor-pointer"
                            >
                                <RotateCcw className="h-4 w-4" />
                                Proses Retur
                            </Button>
                        )}
                        {canVoid && (
                            <Button
                                type="button"
                                variant="destructive"
                                size="sm"
                                onClick={() => setVoidOpen(true)}
                                className="gap-1.5 cursor-pointer"
                            >
                                <AlertTriangle className="h-4 w-4" />
                                Void Transaksi
                            </Button>
                        )}
                    </div>
                </div>

                {/* Void Banner if Voided */}
                {transaction.status === 'voided' && (
                    <Card className="border-rose-300 bg-rose-50/70 dark:border-rose-800 dark:bg-rose-950/30">
                        <CardContent className="p-4 flex items-start gap-3">
                            <AlertTriangle className="h-5 w-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                            <div className="text-sm space-y-0.5">
                                <p className="font-semibold text-rose-700 dark:text-rose-300">
                                    Transaksi Dibatalkan (Void) pada {transaction.voided_at}
                                </p>
                                <p className="text-muted-foreground">
                                    Disetujui oleh: <span className="font-medium text-foreground">{transaction.voided_by_name ?? '-'}</span> • Alasan: {transaction.void_reason ?? '-'}
                                </p>
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* Tabs */}
                <div className="flex items-center gap-2 border-b">
                    <button
                        type="button"
                        onClick={() => handleTabChange('detail')}
                        className={`inline-flex items-center gap-1.5 border-b-2 px-4 py-2 text-sm font-medium transition-colors cursor-pointer ${
                            activeTab === 'detail'
                                ? 'border-primary text-primary'
                                : 'border-transparent text-muted-foreground hover:text-foreground'
                        }`}
                    >
                        <ReceiptText className="h-4 w-4" />
                        Rincian Transaksi
                    </button>
                    <button
                        type="button"
                        onClick={() => handleTabChange('activities')}
                        className={`inline-flex items-center gap-1.5 border-b-2 px-4 py-2 text-sm font-medium transition-colors cursor-pointer ${
                            activeTab === 'activities'
                                ? 'border-primary text-primary'
                                : 'border-transparent text-muted-foreground hover:text-foreground'
                        }`}
                    >
                        <History className="h-4 w-4" />
                        Riwayat Aktivitas
                    </button>
                </div>

                {activeTab === 'detail' ? (
                    <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
                        {/* Left: Items & Returns */}
                        <div className="lg:col-span-8 space-y-6">
                            <Card>
                                <CardHeader className="border-b py-3.5 px-5">
                                    <CardTitle className="text-base">Daftar Item Belanja</CardTitle>
                                    <CardDescription>
                                        Pelanggan: {transaction.customer_name}
                                        {transaction.customer_phone ? ` (${transaction.customer_phone})` : ''}
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="p-0 overflow-x-auto">
                                    <table className="table-fixed w-full min-w-[600px] text-sm">
                                        <thead>
                                            <tr className="border-b bg-muted/40 text-xs text-muted-foreground">
                                                <th className="w-[34%] px-4 py-2.5 text-left">Produk</th>
                                                <th className="w-[14%] px-2 py-2.5 text-left">Satuan</th>
                                                <th className="w-[12%] px-2 py-2.5 text-right">Qty</th>
                                                <th className="w-[14%] px-2 py-2.5 text-right">Harga</th>
                                                <th className="w-[12%] px-2 py-2.5 text-right">Diskon</th>
                                                <th className="w-[14%] px-4 py-2.5 text-right">Subtotal</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y">
                                            {transaction.details.map((line) => (
                                                <tr key={line.id}>
                                                    <td className="px-4 py-3">
                                                        <div className="flex items-center gap-1.5 min-w-0">
                                                            <p className="font-medium text-foreground truncate">
                                                                {line.product_name}
                                                            </p>
                                                            {line.is_donation ? (
                                                                <Badge
                                                                    variant="outline"
                                                                    className="h-4 px-1.5 py-0 text-[10px] gap-0.5 shrink-0 border-pink-300 bg-pink-50 text-pink-700 dark:border-pink-800 dark:bg-pink-950/60 dark:text-pink-300"
                                                                >
                                                                    <Heart className="h-2.5 w-2.5" />
                                                                    Donasi
                                                                </Badge>
                                                            ) : line.is_tax_exempt ? (
                                                                <Badge
                                                                    variant="outline"
                                                                    className="h-4 px-1.5 py-0 text-[10px] shrink-0 border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
                                                                >
                                                                    Bebas PPN
                                                                </Badge>
                                                            ) : null}
                                                        </div>
                                                        <p className="font-mono text-[11px] text-muted-foreground">
                                                            {line.product_barcode}
                                                            {line.returned_qty > 0 && (
                                                                <span className="ml-2 text-amber-600 dark:text-amber-400">
                                                                    (Diretur: {line.returned_qty} {line.unit_name})
                                                                </span>
                                                            )}
                                                        </p>
                                                    </td>
                                                    <td className="px-2 py-3 text-xs text-muted-foreground">
                                                        {line.unit_name}
                                                        {line.conversion_factor > 1 && ` (x${line.conversion_factor})`}
                                                    </td>
                                                    <td className="px-2 py-3 text-right font-mono text-xs">
                                                        {line.qty}
                                                    </td>
                                                    <td className="px-2 py-3 text-right font-mono text-xs">
                                                        {formatRupiah(line.unit_price)}
                                                    </td>
                                                    <td className="px-2 py-3 text-right font-mono text-xs text-muted-foreground">
                                                        {line.discount_amount > 0
                                                            ? `-${formatRupiah(line.discount_amount)}`
                                                            : '-'}
                                                    </td>
                                                    <td className="px-4 py-3 text-right font-mono text-xs font-semibold">
                                                        {formatRupiah(line.subtotal)}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </CardContent>
                            </Card>

                            {/* Sales Returns History */}
                            {transaction.sales_returns.length > 0 && (
                                <Card>
                                    <CardHeader className="border-b py-3.5 px-5">
                                        <CardTitle className="text-base">Riwayat Retur Penjualan</CardTitle>
                                    </CardHeader>
                                    <CardContent className="p-4 space-y-4">
                                        {transaction.sales_returns.map((ret) => (
                                            <div key={ret.id} className="rounded-lg border p-4 space-y-3">
                                                <div className="flex flex-wrap items-center justify-between gap-2">
                                                    <div>
                                                        <span className="font-mono text-xs font-semibold text-primary">
                                                            {ret.return_number}
                                                        </span>
                                                        <span className="ml-2 text-xs text-muted-foreground">
                                                            {ret.created_at}
                                                        </span>
                                                    </div>
                                                    <span className="font-mono text-sm font-bold text-rose-600 dark:text-rose-400">
                                                        -{formatRupiah(ret.total_refund_amount)}
                                                    </span>
                                                </div>
                                                <p className="text-xs text-muted-foreground">
                                                    Metode: <span className="text-foreground font-medium">{ret.refund_method_label}</span> ({ret.account_name}) •
                                                    Diproses: {ret.processed_by_name} • Disetujui: {ret.approved_by_name}
                                                </p>
                                                <p className="text-xs text-muted-foreground">Alasan: {ret.reason}</p>
                                                <div className="space-y-1 border-t pt-2">
                                                    {ret.items.map((item) => (
                                                        <div key={item.id} className="flex items-center justify-between text-xs">
                                                            <div className="flex items-center gap-2">
                                                                <span className="font-medium text-foreground">
                                                                    {item.product_name} ({item.qty} {item.unit_name})
                                                                </span>
                                                                <Badge variant={item.is_restockable ? 'success' : 'destructive'} className="text-[10px]">
                                                                    {item.is_restockable ? 'Masuk Stok' : 'Rusak'}
                                                                </Badge>
                                                            </div>
                                                            <span className="font-mono">{formatRupiah(item.subtotal_refund)}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        ))}
                                    </CardContent>
                                </Card>
                            )}
                        </div>

                        {/* Right: Financial Summary & Payments */}
                        <div className="lg:col-span-4 space-y-6">
                            <Card>
                                <CardHeader className="border-b py-3.5 px-5">
                                    <CardTitle className="text-base">Ringkasan Finansial</CardTitle>
                                </CardHeader>
                                <CardContent className="p-5 space-y-2.5 text-sm">
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">Subtotal</span>
                                        <span className="font-mono">{formatRupiah(transaction.subtotal)}</span>
                                    </div>
                                    {transaction.discount_amount > 0 && (
                                        <div className="flex justify-between text-rose-600 dark:text-rose-400">
                                            <span>Diskon</span>
                                            <span className="font-mono">-{formatRupiah(transaction.discount_amount)}</span>
                                        </div>
                                    )}
                                    {transaction.discount_approved_by_name && (
                                        <p className="text-[11px] text-muted-foreground text-right">
                                            Diskon disetujui oleh: {transaction.discount_approved_by_name}
                                        </p>
                                    )}
                                    {transaction.tax_amount > 0 && (
                                        <div className="flex justify-between">
                                            <span className="text-muted-foreground">PPN</span>
                                            <span className="font-mono">{formatRupiah(transaction.tax_amount)}</span>
                                        </div>
                                    )}
                                    {transaction.rounding_amount !== 0 && (
                                        <div className="flex justify-between">
                                            <span className="text-muted-foreground">Pembulatan</span>
                                            <span className="font-mono">
                                                {transaction.rounding_amount > 0 ? '+' : ''}
                                                {formatRupiah(transaction.rounding_amount)}
                                            </span>
                                        </div>
                                    )}
                                    {(transaction.donation_amount ?? 0) > 0 && (
                                        <div className="flex justify-between text-pink-600 dark:text-pink-400">
                                            <span>Donasi</span>
                                            <span className="font-mono">
                                                {formatRupiah(transaction.donation_amount)}
                                            </span>
                                        </div>
                                    )}
                                    <div className="flex justify-between border-t pt-2.5 font-semibold text-base">
                                        <span>Grand Total</span>
                                        <span className="font-mono text-primary">
                                            {formatRupiah(transaction.grand_total)}
                                        </span>
                                    </div>
                                    <div className="flex justify-between text-xs pt-1">
                                        <span className="text-muted-foreground">Total Dibayar</span>
                                        <span className="font-mono font-medium">{formatRupiah(transaction.paid_amount)}</span>
                                    </div>
                                    <div className="flex justify-between text-xs">
                                        <span className="text-muted-foreground">Kembalian</span>
                                        <span className="font-mono font-medium">{formatRupiah(transaction.change_amount)}</span>
                                    </div>
                                    {transaction.total_returned_amount > 0 && (
                                        <div className="flex justify-between border-t pt-2 text-xs text-amber-600 dark:text-amber-400 font-semibold">
                                            <span>Total Diretur</span>
                                            <span className="font-mono">-{formatRupiah(transaction.total_returned_amount)}</span>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>

                            <Card>
                                <CardHeader className="border-b py-3.5 px-5">
                                    <CardTitle className="text-base">Rincian Pembayaran</CardTitle>
                                </CardHeader>
                                <CardContent className="p-5 space-y-3">
                                    {transaction.payments.length === 0 ? (
                                        <p className="text-xs text-muted-foreground">
                                            Tidak ada rincian split payment (transaksi legacy).
                                        </p>
                                    ) : (
                                        transaction.payments.map((p) => (
                                            <div
                                                key={p.id}
                                                className="flex items-start justify-between gap-2 rounded-lg border bg-muted/20 p-3 text-sm"
                                            >
                                                <div className="min-w-0">
                                                    <p className="font-medium text-foreground">
                                                        {p.payment_method_label}
                                                    </p>
                                                    <p className="text-xs text-muted-foreground truncate">
                                                        {p.account_name}
                                                    </p>
                                                    {p.reference_number && (
                                                        <p className="font-mono text-[11px] text-muted-foreground mt-0.5">
                                                            Ref: {p.reference_number}
                                                        </p>
                                                    )}
                                                </div>
                                                <span className="font-mono text-xs font-semibold shrink-0">
                                                    {formatRupiah(p.amount)}
                                                </span>
                                            </div>
                                        ))
                                    )}
                                </CardContent>
                            </Card>
                        </div>
                    </div>
                ) : (
                    <Card>
                        <CardHeader className="border-b py-3.5 px-5">
                            <CardTitle className="text-base">Riwayat Aktivitas (Audit Trail)</CardTitle>
                        </CardHeader>
                        <CardContent className="p-5">
                            {loadingActivities ? (
                                <p className="text-sm text-muted-foreground py-6 text-center">
                                    Memuat riwayat aktivitas...
                                </p>
                            ) : !activities || activities.data.length === 0 ? (
                                <p className="text-sm text-muted-foreground py-6 text-center">
                                    Belum ada log aktivitas untuk transaksi ini.
                                </p>
                            ) : (
                                <div className="space-y-3">
                                    {activities.data.map((act) => (
                                        <div key={act.id} className="rounded-lg border p-3.5 space-y-1">
                                            <div className="flex flex-wrap items-center justify-between gap-2">
                                                <div className="flex items-center gap-2">
                                                    {act.event && (
                                                        <Badge variant="outline" className="uppercase text-[10px]">
                                                            {act.event}
                                                        </Badge>
                                                    )}
                                                    <span className="text-xs font-medium text-foreground">
                                                        {act.causer_name}
                                                    </span>
                                                </div>
                                                <span className="text-xs text-muted-foreground">
                                                    {act.created_at}
                                                </span>
                                            </div>
                                            <p className="text-sm text-muted-foreground">{act.description}</p>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                )}
            </div>

            <VoidTransactionDialog
                open={voidOpen}
                onOpenChange={setVoidOpen}
                transactionId={transaction.id}
                invoiceNumber={transaction.invoice_number}
            />

            <SalesReturnDialog
                open={returnOpen}
                onOpenChange={setReturnOpen}
                transactionId={transaction.id}
                invoiceNumber={transaction.invoice_number}
                details={transaction.details}
                paymentMethods={paymentMethods}
                financialAccounts={financialAccounts}
            />

            <ReceiptPrint receipt={receipt} paperWidth={paperWidth} isReprint />
        </>
    )
}

DetailTransaction.layout = (page: React.ReactNode) => (
    <AuthenticatedLayout>{page}</AuthenticatedLayout>
)

export default DetailTransaction

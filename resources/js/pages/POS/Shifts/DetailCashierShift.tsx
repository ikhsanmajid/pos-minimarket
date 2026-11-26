import React, { useEffect, useState } from 'react'
import { Link, usePage } from '@inertiajs/react'
import AuthenticatedLayout from '@/layouts/AuthenticatedLayout'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
    ArrowLeft,
    Calculator,
    CheckCircle2,
    EyeOff,
    Lock,
    Printer,
    ReceiptText,
    ShieldCheck,
} from 'lucide-react'
import { toast } from 'react-toastify'
import type { PageProps } from '@/types'
import { useAuth } from '@/hooks/use-auth'
import shifts from '@/routes/pos/shifts'
import { CloseShiftDialog } from './component/CloseShiftDialog'
import { ShiftZReportPrint, type ShiftDetailData } from './component/ShiftZReportPrint'
import {
    formatRupiah,
    formatSignedRupiah,
    getMovementTypeBadgeClass,
    getVarianceBadgeMeta,
    type FinancialAccountSelectOption,
    type ShiftPolicyRules,
} from './component/shiftUtils'

type DetailCashierShiftPageProps = PageProps<{
    shift: ShiftDetailData
    canRevealFinancials: boolean
    canManage: boolean
    financialAccounts: FinancialAccountSelectOption[]
    denominations: number[]
    policyRules: ShiftPolicyRules
}>

const DetailCashierShift = () => {
    const {
        shift,
        canRevealFinancials,
        canManage,
        financialAccounts = [],
        denominations = [],
        policyRules,
    } = usePage<DetailCashierShiftPageProps>().props
    const { flash } = useAuth()
    const [closeDialogOpen, setCloseDialogOpen] = useState(false)

    useEffect(() => {
        if (flash?.success) toast.success(flash.success)
        if (flash?.error) toast.error(flash.error)
    }, [flash?.success, flash?.error])

    const handlePrint = (mode: 'a4' | 'thermal') => {
        if (mode === 'thermal') {
            document.documentElement.classList.add('zreport-thermal-mode')
        } else {
            document.documentElement.classList.remove('zreport-thermal-mode')
        }
        window.print()
        setTimeout(() => {
            document.documentElement.classList.remove('zreport-thermal-mode')
        }, 500)
    }

    const varianceMeta = getVarianceBadgeMeta(shift.cash_variance)
    const filledDenominations = (shift.denomination_breakdown ?? []).filter((d) => d.qty > 0)

    return (
        <div className="space-y-6">
            {/* Screen View (hidden on print) */}
            <div className="no-print space-y-6">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                            <Link href={shifts.history.url()}>
                                <Button variant="ghost" size="sm" className="h-8 gap-1 px-2 cursor-pointer">
                                    <ArrowLeft className="h-4 w-4" />
                                    Kembali
                                </Button>
                            </Link>
                            <h1 className="text-2xl font-bold tracking-tight font-mono text-foreground">
                                {shift.shift_number}
                            </h1>
                            <Badge variant={shift.status === 'open' ? 'success' : 'secondary'}>
                                {shift.status_label}
                            </Badge>
                            {shift.status === 'closed' && (
                                <Badge variant="outline" className={varianceMeta.className}>
                                    {varianceMeta.label}
                                </Badge>
                            )}
                        </div>
                        <p className="text-sm text-muted-foreground">
                            {shift.register_name} • Kasir: <strong className="text-foreground">{shift.cashier_name}</strong> ({shift.cashier_role})
                        </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        {shift.status === 'open' && canManage && (
                            <Button
                                variant="destructive"
                                onClick={() => setCloseDialogOpen(true)}
                                className="gap-2 cursor-pointer"
                            >
                                <Lock className="h-4 w-4" />
                                Tutup Shift
                            </Button>
                        )}
                        {canRevealFinancials && (
                            <>
                                <Button
                                    variant="outline"
                                    onClick={() => handlePrint('thermal')}
                                    className="gap-2 cursor-pointer"
                                >
                                    <ReceiptText className="h-4 w-4" />
                                    Cetak 80mm
                                </Button>
                                <Button onClick={() => handlePrint('a4')} className="gap-2 cursor-pointer">
                                    <Printer className="h-4 w-4" />
                                    Cetak Z-Report (A4)
                                </Button>
                            </>
                        )}
                    </div>
                </div>

                {/* Metadata Grid */}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <Card>
                        <CardContent className="p-4">
                            <p className="text-xs text-muted-foreground">Waktu Buka</p>
                            <p className="mt-1 text-sm font-semibold">{shift.opened_at}</p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="p-4">
                            <p className="text-xs text-muted-foreground">Waktu Tutup</p>
                            <p className="mt-1 text-sm font-semibold">{shift.closed_at ?? 'Masih Berjalan'}</p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="p-4">
                            <p className="text-xs text-muted-foreground">Total Transaksi</p>
                            <p className="mt-1 font-mono text-lg font-bold">{shift.total_transactions} trx</p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="p-4">
                            <p className="text-xs text-muted-foreground">Otorisasi / Verifikasi</p>
                            <p className="mt-1 text-sm font-semibold flex items-center gap-1.5">
                                {shift.verified_by_name ? (
                                    <>
                                        <ShieldCheck className="h-4 w-4 text-emerald-600" />
                                        {shift.verified_by_name}
                                    </>
                                ) : (
                                    <span className="text-muted-foreground font-normal">Tidak diperlukan / Belum</span>
                                )}
                            </p>
                        </CardContent>
                    </Card>
                </div>

                {!canRevealFinancials ? (
                    <Card className="border-blue-200 bg-blue-50/50 dark:border-blue-800 dark:bg-blue-950/20">
                        <CardContent className="flex items-start gap-3 p-5 text-sm">
                            <EyeOff className="h-5 w-5 shrink-0 text-blue-600 dark:text-blue-400 mt-0.5" />
                            <div>
                                <p className="font-semibold text-foreground">Mode Blind Closing Aktif</p>
                                <p className="text-muted-foreground">
                                    Angka ekspektasi kas dan rincian penjualan akan ditampilkan secara lengkap setelah sesi shift ini resmi ditutup.
                                </p>
                            </div>
                        </CardContent>
                    </Card>
                ) : (
                    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                        {/* Rekonsiliasi Kas */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-base">Rekonsiliasi Laci Kas (Z-Report)</CardTitle>
                                <CardDescription>
                                    Perbandingan ekspektasi sistem dengan uang fisik yang dihitung kasir.
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-2.5 text-sm">
                                <div className="flex justify-between py-1">
                                    <span className="text-muted-foreground">Modal Awal Laci</span>
                                    <span className="font-mono font-semibold">{formatRupiah(shift.starting_cash)}</span>
                                </div>
                                <div className="flex justify-between py-1">
                                    <span className="text-muted-foreground">(+) Penjualan Tunai</span>
                                    <span className="font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                                        {formatRupiah(shift.total_cash_sales)}
                                    </span>
                                </div>
                                <div className="flex justify-between py-1">
                                    <span className="text-muted-foreground">(-) Total Refund</span>
                                    <span className="font-mono font-semibold text-rose-600 dark:text-rose-400">
                                        -{formatRupiah(shift.total_refunds)}
                                    </span>
                                </div>
                                <div className="flex justify-between py-1">
                                    <span className="text-muted-foreground">(+) Cash In</span>
                                    <span className="font-mono font-semibold">{formatRupiah(shift.total_cash_in)}</span>
                                </div>
                                <div className="flex justify-between py-1">
                                    <span className="text-muted-foreground">(-) Cash Out</span>
                                    <span className="font-mono font-semibold text-rose-600 dark:text-rose-400">
                                        -{formatRupiah(shift.total_cash_out)}
                                    </span>
                                </div>
                                <div className="flex justify-between py-1">
                                    <span className="text-muted-foreground">(-) Cash Drop (Setor Brankas)</span>
                                    <span className="font-mono font-semibold text-blue-600 dark:text-blue-400">
                                        -{formatRupiah(shift.total_cash_drop)}
                                    </span>
                                </div>
                                <div className="border-t pt-2.5 flex justify-between font-semibold">
                                    <span>Ekspektasi Kas Sistem</span>
                                    <span className="font-mono">{formatRupiah(shift.expected_cash)}</span>
                                </div>
                                <div className="flex justify-between font-semibold">
                                    <span>Uang Fisik Dihitung (Actual)</span>
                                    <span className="font-mono text-primary">
                                        {shift.actual_cash !== null ? formatRupiah(shift.actual_cash) : '-'}
                                    </span>
                                </div>
                                <div className="border-t pt-2.5 flex items-center justify-between">
                                    <span className="font-bold">Selisih Kas (Variance)</span>
                                    <Badge variant="outline" className={`font-mono text-xs ${varianceMeta.className}`}>
                                        {shift.cash_variance !== null
                                            ? formatSignedRupiah(shift.cash_variance)
                                            : 'Menunggu Tutup Shift'}
                                    </Badge>
                                </div>

                                {shift.closing_notes && (
                                    <div className="mt-3 rounded-lg border bg-muted/30 p-3 text-xs">
                                        <p className="font-semibold text-foreground mb-1">Catatan Penutupan:</p>
                                        <p className="text-muted-foreground">{shift.closing_notes}</p>
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        {/* Ringkasan Per Metode Pembayaran */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-base">Ringkasan Metode Pembayaran</CardTitle>
                                <CardDescription>
                                    Distribusi penerimaan penjualan selama shift berlangsung.
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="overflow-x-auto rounded-lg border">
                                    <table className="table-fixed w-full min-w-[380px] text-sm">
                                        <thead className="bg-muted/50 border-b text-xs text-muted-foreground">
                                            <tr>
                                                <th className="w-[45%] px-3 py-2 text-left font-medium">Metode</th>
                                                <th className="w-[20%] px-3 py-2 text-right font-medium">Trx</th>
                                                <th className="w-[35%] px-3 py-2 text-right font-medium">Total</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y">
                                            {shift.payment_breakdown.length === 0 ? (
                                                <tr>
                                                    <td colSpan={3} className="px-3 py-6 text-center text-xs text-muted-foreground">
                                                        Belum ada transaksi penjualan pada shift ini.
                                                    </td>
                                                </tr>
                                            ) : (
                                                shift.payment_breakdown.map((p) => (
                                                    <tr key={p.method}>
                                                        <td className="px-3 py-2 text-xs font-medium">{p.label}</td>
                                                        <td className="px-3 py-2 text-right font-mono text-xs">{p.count}x</td>
                                                        <td className="px-3 py-2 text-right font-mono text-xs font-semibold">
                                                            {formatRupiah(p.total)}
                                                        </td>
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <div className="rounded-lg border bg-muted/20 p-3">
                                        <p className="text-xs text-muted-foreground">Total Tunai</p>
                                        <p className="mt-0.5 font-mono text-sm font-bold">
                                            {formatRupiah(shift.total_cash_sales)}
                                        </p>
                                    </div>
                                    <div className="rounded-lg border bg-muted/20 p-3">
                                        <p className="text-xs text-muted-foreground">Total Non-Tunai</p>
                                        <p className="mt-0.5 font-mono text-sm font-bold">
                                            {formatRupiah(shift.total_non_cash_sales)}
                                        </p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                )}

                {/* Rincian Pecahan Uang */}
                {filledDenominations.length > 0 && (
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-base">
                                <Calculator className="h-4 w-4 text-primary" />
                                Rincian Pecahan Uang Fisik (Denomination Breakdown)
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="overflow-x-auto rounded-lg border">
                                <table className="table-fixed w-full min-w-[460px] text-sm">
                                    <thead className="bg-muted/50 border-b text-xs text-muted-foreground">
                                        <tr>
                                            <th className="w-[40%] px-3 py-2 text-left font-medium">Pecahan</th>
                                            <th className="w-[25%] px-3 py-2 text-right font-medium">Jumlah Lembar/Keping</th>
                                            <th className="w-[35%] px-3 py-2 text-right font-medium">Subtotal</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y">
                                        {filledDenominations.map((d) => (
                                            <tr key={d.denomination}>
                                                <td className="px-3 py-2 font-mono text-xs font-semibold">
                                                    {formatRupiah(d.denomination)}
                                                </td>
                                                <td className="px-3 py-2 text-right font-mono text-xs">{d.qty}</td>
                                                <td className="px-3 py-2 text-right font-mono text-xs font-semibold">
                                                    {formatRupiah(d.subtotal)}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* Riwayat Mutasi Kas */}
                <Card>
                    <CardHeader>
                        <CardTitle className="text-base">Rincian Mutasi Kas Tengah Shift</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="overflow-x-auto rounded-lg border">
                            <table className="table-fixed w-full min-w-[740px] text-sm">
                                <thead className="bg-muted/50 border-b text-xs text-muted-foreground">
                                    <tr>
                                        <th className="w-[16%] px-3 py-2.5 text-left font-medium">Waktu</th>
                                        <th className="w-[14%] px-3 py-2.5 text-left font-medium">Jenis</th>
                                        <th className="w-[16%] px-3 py-2.5 text-right font-medium">Nominal</th>
                                        <th className="w-[26%] px-3 py-2.5 text-left font-medium">Keterangan</th>
                                        <th className="w-[15%] px-3 py-2.5 text-left font-medium">Akun Keuangan</th>
                                        <th className="w-[13%] px-3 py-2.5 text-left font-medium">Otorisasi</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y">
                                    {shift.movements.length === 0 ? (
                                        <tr>
                                            <td colSpan={6} className="px-4 py-8 text-center text-xs text-muted-foreground">
                                                Tidak ada mutasi kas tengah shift pada sesi ini.
                                            </td>
                                        </tr>
                                    ) : (
                                        shift.movements.map((m) => (
                                            <tr key={m.id}>
                                                <td className="px-3 py-2.5 text-xs text-muted-foreground truncate">
                                                    {m.created_at ?? '-'}
                                                </td>
                                                <td className="px-3 py-2.5">
                                                    <Badge variant="outline" className={getMovementTypeBadgeClass(m.type)}>
                                                        {m.type_short}
                                                    </Badge>
                                                </td>
                                                <td className="px-3 py-2.5 text-right font-mono text-xs font-semibold">
                                                    {formatRupiah(m.amount)}
                                                </td>
                                                <td className="px-3 py-2.5 text-xs">{m.reason}</td>
                                                <td className="px-3 py-2.5 text-xs text-muted-foreground truncate">
                                                    {m.financial_account_name ?? '-'}
                                                </td>
                                                <td className="px-3 py-2.5 text-xs text-muted-foreground truncate">
                                                    {m.approved_by_name ? (
                                                        <span className="inline-flex items-center gap-1">
                                                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                                                            {m.approved_by_name}
                                                        </span>
                                                    ) : (
                                                        '-'
                                                    )}
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </CardContent>
                </Card>

                {shift.status === 'open' && canManage && (
                    <CloseShiftDialog
                        open={closeDialogOpen}
                        onOpenChange={setCloseDialogOpen}
                        shiftId={shift.id}
                        shiftNumber={shift.shift_number}
                        registerName={shift.register_name}
                        denominations={denominations}
                        financialAccounts={financialAccounts}
                        policyRules={policyRules}
                    />
                )}
            </div>

            {/* Print-Only Z-Report Area */}
            {canRevealFinancials && <ShiftZReportPrint shift={shift} />}
        </div>
    )
}

DetailCashierShift.layout = (page: React.ReactNode) => (
    <AuthenticatedLayout>{page}</AuthenticatedLayout>
)

export default DetailCashierShift

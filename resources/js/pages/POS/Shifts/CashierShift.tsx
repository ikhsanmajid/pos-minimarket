import React, { useEffect, useState } from 'react'
import { Link, usePage } from '@inertiajs/react'
import AuthenticatedLayout from '@/layouts/AuthenticatedLayout'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { formatRupiah } from '@/lib/utils'
import {
    ArrowDownToLine,
    ArrowUpFromLine,
    Banknote,
    Clock,
    Eye,
    History,
    Landmark,
    Lock,
    Monitor,
    PlayCircle,
    Receipt,
    ShoppingCart,
    Users,
} from 'lucide-react'
import { toast } from 'react-toastify'
import type { PageProps } from '@/types'
import { useAuth } from '@/hooks/use-auth'
import shifts from '@/routes/pos/shifts'
import cashier from '@/routes/pos/cashier'
import { OpenShiftDialog, type CashRegisterOption } from './component/OpenShiftDialog'
import { ShiftCashMovementDialog } from './component/ShiftCashMovementDialog'
import { CloseShiftDialog } from './component/CloseShiftDialog'
import {
    getMovementTypeBadgeClass,
    getVarianceBadgeMeta,
    type FinancialAccountSelectOption,
    type ShiftMovementItem,
    type ShiftPolicyRules,
} from './component/shiftUtils'

interface ActiveShiftDetail {
    id: number
    shift_number: string
    register_name: string
    status: string
    status_label: string
    cashier_name: string
    opened_at: string
    opened_at_human: string
    starting_cash: number
    total_cash_in: number
    total_cash_out: number
    total_cash_drop: number
    live_transactions_count: number
    movements: ShiftMovementItem[]
}

interface OpenShiftStoreRow {
    id: number
    shift_number: string
    register_name: string
    cashier_name: string
    cashier_role: string
    opened_at: string
    opened_at_human: string
    starting_cash: number
    total_cash_drop: number
    transactions_count: number
    is_own: boolean
}

interface RecentOwnShiftRow {
    id: number
    shift_number: string
    register_name: string
    opened_at: string
    closed_at: string | null
    actual_cash: number
    expected_cash: number
    cash_variance: number
    total_transactions: number
}

type CashierShiftPageProps = PageProps<{
    activeShiftDetail: ActiveShiftDetail | null
    openShiftsStore: OpenShiftStoreRow[]
    recentOwnShifts: RecentOwnShiftRow[]
    financialAccounts: FinancialAccountSelectOption[]
    cashRegisters: CashRegisterOption[]
    denominations: number[]
    policyRules: ShiftPolicyRules
}>

const CashierShiftPage = () => {
    const {
        activeShiftDetail,
        openShiftsStore = [],
        recentOwnShifts = [],
        financialAccounts = [],
        cashRegisters = [],
        denominations = [],
        policyRules,
    } = usePage<CashierShiftPageProps>().props
    const { flash } = useAuth()

    const [openDialog, setOpenDialog] = useState(false)
    const [movementDialogOpen, setMovementDialogOpen] = useState(false)
    const [movementType, setMovementType] = useState<'cash_in' | 'cash_out' | 'cash_drop'>('cash_drop')
    const [closeDialogOpen, setCloseDialogOpen] = useState(false)

    useEffect(() => {
        if (flash?.success) toast.success(flash.success)
        if (flash?.error) toast.error(flash.error)
    }, [flash?.success, flash?.error])

    const openMovementModal = (type: 'cash_in' | 'cash_out' | 'cash_drop') => {
        setMovementType(type)
        setMovementDialogOpen(true)
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-foreground">
                        Sesi Shift Kasir
                    </h1>
                    <p className="text-sm text-muted-foreground">
                        Kelola buka/tutup laci kasir, mutasi kas tengah shift, setor brankas, dan rekonsiliasi blind closing.
                    </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    <Link href={shifts.history.url()}>
                        <Button variant="outline" className="gap-2 cursor-pointer">
                            <History className="h-4 w-4" />
                            Riwayat Shift
                        </Button>
                    </Link>

                    {!activeShiftDetail ? (
                        <Button onClick={() => setOpenDialog(true)} className="gap-2 cursor-pointer">
                            <PlayCircle className="h-4 w-4" />
                            Buka Shift Baru
                        </Button>
                    ) : (
                        <>
                            <Link href={cashier.index.url()}>
                                <Button variant="outline" className="gap-2 cursor-pointer">
                                    <ShoppingCart className="h-4 w-4" />
                                    Buka Kasir POS
                                </Button>
                            </Link>
                            <Button
                                variant="destructive"
                                onClick={() => setCloseDialogOpen(true)}
                                className="gap-2 cursor-pointer"
                            >
                                <Lock className="h-4 w-4" />
                                Tutup Shift
                            </Button>
                        </>
                    )}
                </div>
            </div>

            {/* Active Shift Section */}
            {!activeShiftDetail ? (
                <Card className="border-dashed border-2">
                    <CardContent className="flex flex-col items-center justify-center py-12 px-6 text-center space-y-4">
                        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                            <Clock className="h-7 w-7" />
                        </div>
                        <div className="space-y-1 max-w-md">
                            <h2 className="text-lg font-semibold text-foreground">
                                Anda Belum Memiliki Sesi Shift Aktif
                            </h2>
                            <p className="text-sm text-muted-foreground">
                                Buka sesi shift terlebih dahulu dengan memasukkan modal awal laci kasir agar dapat memproses transaksi penjualan POS dan mencatat mutasi kas.
                            </p>
                        </div>
                        <Button size="lg" onClick={() => setOpenDialog(true)} className="gap-2 cursor-pointer">
                            <PlayCircle className="h-4 w-4" />
                            Buka Sesi Shift Sekarang
                        </Button>
                    </CardContent>
                </Card>
            ) : (
                <div className="space-y-6">
                    {/* Active Shift Banner + Quick Actions */}
                    <Card className="border-emerald-200 dark:border-emerald-800/70">
                        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b pb-4">
                            <div className="space-y-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <Badge variant="success">Shift Aktif</Badge>
                                    <span className="font-mono text-sm font-bold text-primary">
                                        {activeShiftDetail.shift_number}
                                    </span>
                                    <Badge variant="outline" className="gap-1">
                                        <Monitor className="h-3 w-3" />
                                        {activeShiftDetail.register_name}
                                    </Badge>
                                </div>
                                <CardDescription className="text-xs">
                                    Kasir: <strong className="text-foreground">{activeShiftDetail.cashier_name}</strong> • Dibuka pada{' '}
                                    <strong className="text-foreground">{activeShiftDetail.opened_at}</strong> ({activeShiftDetail.opened_at_human})
                                </CardDescription>
                            </div>

                            <div className="flex flex-wrap items-center gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => openMovementModal('cash_in')}
                                    className="gap-1.5 cursor-pointer"
                                >
                                    <ArrowDownToLine className="h-4 w-4 text-emerald-600" />
                                    Cash In
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => openMovementModal('cash_out')}
                                    className="gap-1.5 cursor-pointer"
                                >
                                    <ArrowUpFromLine className="h-4 w-4 text-rose-600" />
                                    Cash Out
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => openMovementModal('cash_drop')}
                                    className="gap-1.5 cursor-pointer"
                                >
                                    <Landmark className="h-4 w-4 text-blue-600" />
                                    Cash Drop
                                </Button>
                                <Link href={shifts.show.url(activeShiftDetail.id)}>
                                    <Button variant="ghost" size="sm" className="gap-1.5 cursor-pointer">
                                        <Eye className="h-4 w-4" />
                                        Detail
                                    </Button>
                                </Link>
                            </div>
                        </CardHeader>

                        <CardContent className="pt-5">
                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
                                <div className="rounded-lg border bg-muted/20 p-3.5">
                                    <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                                        <Banknote className="h-3.5 w-3.5" /> Modal Awal Laci
                                    </p>
                                    <p className="mt-1 font-mono text-lg font-bold text-foreground">
                                        {formatRupiah(activeShiftDetail.starting_cash)}
                                    </p>
                                </div>
                                <div className="rounded-lg border bg-muted/20 p-3.5">
                                    <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                                        <Receipt className="h-3.5 w-3.5" /> Transaksi Berjalan
                                    </p>
                                    <p className="mt-1 font-mono text-lg font-bold text-foreground">
                                        {activeShiftDetail.live_transactions_count} trx
                                    </p>
                                </div>
                                <div className="rounded-lg border bg-emerald-50/40 dark:bg-emerald-950/20 p-3.5">
                                    <p className="text-xs text-emerald-700 dark:text-emerald-300 flex items-center gap-1.5">
                                        <ArrowDownToLine className="h-3.5 w-3.5" /> Total Cash In
                                    </p>
                                    <p className="mt-1 font-mono text-lg font-bold text-emerald-700 dark:text-emerald-300">
                                        {formatRupiah(activeShiftDetail.total_cash_in)}
                                    </p>
                                </div>
                                <div className="rounded-lg border bg-rose-50/40 dark:bg-rose-950/20 p-3.5">
                                    <p className="text-xs text-rose-700 dark:text-rose-300 flex items-center gap-1.5">
                                        <ArrowUpFromLine className="h-3.5 w-3.5" /> Total Cash Out
                                    </p>
                                    <p className="mt-1 font-mono text-lg font-bold text-rose-700 dark:text-rose-300">
                                        {formatRupiah(activeShiftDetail.total_cash_out)}
                                    </p>
                                </div>
                                <div className="rounded-lg border bg-blue-50/40 dark:bg-blue-950/20 p-3.5">
                                    <p className="text-xs text-blue-700 dark:text-blue-300 flex items-center gap-1.5">
                                        <Landmark className="h-3.5 w-3.5" /> Total Cash Drop
                                    </p>
                                    <p className="mt-1 font-mono text-lg font-bold text-blue-700 dark:text-blue-300">
                                        {formatRupiah(activeShiftDetail.total_cash_drop)}
                                    </p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Running Cash Movements Table */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base">Daftar Mutasi Kas Tengah Shift</CardTitle>
                            <CardDescription>
                                Seluruh pencatatan Cash In, Cash Out, dan Cash Drop pada sesi shift berjalan ini.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="overflow-x-auto rounded-lg border">
                                <table className="table-fixed w-full min-w-[760px] text-sm">
                                    <thead className="bg-muted/50 border-b text-xs text-muted-foreground">
                                        <tr>
                                            <th className="w-[15%] px-3 py-2.5 text-left font-medium">Waktu</th>
                                            <th className="w-[14%] px-3 py-2.5 text-left font-medium">Jenis</th>
                                            <th className="w-[16%] px-3 py-2.5 text-right font-medium">Nominal</th>
                                            <th className="w-[27%] px-3 py-2.5 text-left font-medium">Keterangan</th>
                                            <th className="w-[15%] px-3 py-2.5 text-left font-medium">Akun Keuangan</th>
                                            <th className="w-[13%] px-3 py-2.5 text-left font-medium">Otorisasi</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y">
                                        {activeShiftDetail.movements.length === 0 ? (
                                            <tr>
                                                <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                                                    Belum ada mutasi kas tengah shift pada sesi ini.
                                                </td>
                                            </tr>
                                        ) : (
                                            activeShiftDetail.movements.map((m) => (
                                                <tr key={m.id} className="hover:bg-muted/20">
                                                    <td className="px-3 py-2.5 text-xs text-muted-foreground truncate">
                                                        {m.created_at ?? '-'}
                                                    </td>
                                                    <td className="px-3 py-2.5">
                                                        <Badge variant="outline" className={getMovementTypeBadgeClass(m.type)}>
                                                            {m.type_short}
                                                        </Badge>
                                                    </td>
                                                    <td className="px-3 py-2.5 text-right font-mono text-xs font-semibold text-foreground">
                                                        {formatRupiah(m.amount)}
                                                    </td>
                                                    <td className="px-3 py-2.5 text-xs text-foreground">
                                                        <p className="line-clamp-2">{m.reason}</p>
                                                    </td>
                                                    <td className="px-3 py-2.5 text-xs text-muted-foreground truncate">
                                                        {m.financial_account_name ?? '-'}
                                                    </td>
                                                    <td className="px-3 py-2.5 text-xs text-muted-foreground truncate">
                                                        {m.approved_by_name ?? '-'}
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* Admin/Supervisor Monitor: All Open Shifts */}
            {policyRules.is_privileged && openShiftsStore.length > 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-base">
                            <Users className="h-4 w-4 text-primary" />
                            Monitoring Shift Aktif di Toko ({openShiftsStore.length})
                        </CardTitle>
                        <CardDescription>
                            Daftar seluruh kasir yang sedang bertugas saat ini.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="overflow-x-auto rounded-lg border">
                            <table className="table-fixed w-full min-w-[740px] text-sm">
                                <thead className="bg-muted/50 border-b text-xs text-muted-foreground">
                                    <tr>
                                        <th className="w-[18%] px-3 py-2.5 text-left font-medium">No. Shift</th>
                                        <th className="w-[20%] px-3 py-2.5 text-left font-medium">Kasir</th>
                                        <th className="w-[14%] px-3 py-2.5 text-left font-medium">Mesin Kasir</th>
                                        <th className="w-[18%] px-3 py-2.5 text-left font-medium">Waktu Buka</th>
                                        <th className="w-[12%] px-3 py-2.5 text-right font-medium">Transaksi</th>
                                        <th className="w-[18%] px-3 py-2.5 text-right font-medium">Aksi</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y">
                                    {openShiftsStore.map((s) => (
                                        <tr key={s.id} className="hover:bg-muted/20">
                                            <td className="px-3 py-2.5 font-mono text-xs font-semibold text-primary truncate">
                                                {s.shift_number}
                                            </td>
                                            <td className="px-3 py-2.5 text-xs font-medium truncate">
                                                {s.cashier_name}{' '}
                                                {s.is_own && (
                                                    <Badge variant="secondary" className="ml-1 text-[10px]">
                                                        Anda
                                                    </Badge>
                                                )}
                                            </td>
                                            <td className="px-3 py-2.5 text-xs text-muted-foreground truncate">
                                                {s.register_name}
                                            </td>
                                            <td className="px-3 py-2.5 text-xs text-muted-foreground truncate">
                                                {s.opened_at}
                                            </td>
                                            <td className="px-3 py-2.5 text-right font-mono text-xs font-semibold">
                                                {s.transactions_count} trx
                                            </td>
                                            <td className="px-3 py-2.5 text-right">
                                                <Link href={shifts.show.url(s.id)}>
                                                    <Button variant="outline" size="sm" className="h-7 text-xs cursor-pointer">
                                                        Detail
                                                    </Button>
                                                </Link>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Recent Own Closed Shifts */}
            {recentOwnShifts.length > 0 && (
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between">
                        <div>
                            <CardTitle className="text-base">5 Riwayat Shift Terakhir Anda</CardTitle>
                            <CardDescription>Ringkasan sesi shift yang baru saja Anda tutup.</CardDescription>
                        </div>
                        <Link href={shifts.history.url()}>
                            <Button variant="ghost" size="sm" className="text-xs cursor-pointer">
                                Lihat Semua
                            </Button>
                        </Link>
                    </CardHeader>
                    <CardContent>
                        <div className="overflow-x-auto rounded-lg border">
                            <table className="table-fixed w-full min-w-[700px] text-sm">
                                <thead className="bg-muted/50 border-b text-xs text-muted-foreground">
                                    <tr>
                                        <th className="w-[20%] px-3 py-2.5 text-left font-medium">No. Shift</th>
                                        <th className="w-[14%] px-3 py-2.5 text-left font-medium">Mesin</th>
                                        <th className="w-[20%] px-3 py-2.5 text-left font-medium">Tutup Shift</th>
                                        <th className="w-[14%] px-3 py-2.5 text-right font-medium">Fisik Kas</th>
                                        <th className="w-[20%] px-3 py-2.5 text-left font-medium">Status Selisih</th>
                                        <th className="w-[12%] px-3 py-2.5 text-right font-medium">Aksi</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y">
                                    {recentOwnShifts.map((row) => {
                                        const variance = getVarianceBadgeMeta(row.cash_variance)
                                        return (
                                            <tr key={row.id} className="hover:bg-muted/20">
                                                <td className="px-3 py-2.5 font-mono text-xs font-semibold text-primary truncate">
                                                    {row.shift_number}
                                                </td>
                                                <td className="px-3 py-2.5 text-xs text-muted-foreground truncate">
                                                    {row.register_name}
                                                </td>
                                                <td className="px-3 py-2.5 text-xs text-muted-foreground truncate">
                                                    {row.closed_at ?? '-'}
                                                </td>
                                                <td className="px-3 py-2.5 text-right font-mono text-xs font-semibold">
                                                    {formatRupiah(row.actual_cash)}
                                                </td>
                                                <td className="px-3 py-2.5">
                                                    <Badge variant="outline" className={variance.className}>
                                                        {variance.label}
                                                    </Badge>
                                                </td>
                                                <td className="px-3 py-2.5 text-right">
                                                    <Link href={shifts.show.url(row.id)}>
                                                        <Button variant="outline" size="sm" className="h-7 text-xs cursor-pointer">
                                                            Z-Report
                                                        </Button>
                                                    </Link>
                                                </td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Modals */}
            <OpenShiftDialog
                open={openDialog}
                onOpenChange={setOpenDialog}
                cashRegisters={cashRegisters}
                canManageRegisters={policyRules?.is_privileged ?? false}
            />

            {activeShiftDetail && (
                <>
                    <ShiftCashMovementDialog
                        open={movementDialogOpen}
                        onOpenChange={setMovementDialogOpen}
                        shiftId={activeShiftDetail.id}
                        initialType={movementType}
                        financialAccounts={financialAccounts}
                        policyRules={policyRules}
                    />
                    <CloseShiftDialog
                        open={closeDialogOpen}
                        onOpenChange={setCloseDialogOpen}
                        shiftId={activeShiftDetail.id}
                        shiftNumber={activeShiftDetail.shift_number}
                        registerName={activeShiftDetail.register_name}
                        denominations={denominations}
                        financialAccounts={financialAccounts}
                        policyRules={policyRules}
                    />
                </>
            )}
        </div>
    )
}

CashierShiftPage.layout = (page: React.ReactNode) => (
    <AuthenticatedLayout>{page}</AuthenticatedLayout>
)

export default CashierShiftPage

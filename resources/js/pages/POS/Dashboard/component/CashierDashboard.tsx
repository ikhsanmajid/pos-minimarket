import React, { useState } from 'react'
import { Link } from '@inertiajs/react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { SummaryStatCard, SummaryStatGrid } from '@/components/SummaryStatCard'
import { formatNumber, formatRupiah } from '@/lib/utils'
import {
    Banknote,
    CheckCircle2,
    Clock,
    History,
    Lock,
    Monitor,
    PlayCircle,
    Receipt,
    ShoppingCart,
} from 'lucide-react'
import cashier from '@/routes/pos/cashier'
import shifts from '@/routes/pos/shifts'
import { OpenShiftDialog } from '../../Shifts/component/OpenShiftDialog'
import { getVarianceBadgeMeta } from '../../Shifts/component/shiftUtils'
import type { CashierDashboardData } from './dashboardUtils'

export function CashierDashboard({
    userName,
    cashierData,
}: {
    userName: string
    cashierData: CashierDashboardData
}) {
    const [openDialog, setOpenDialog] = useState(false)
    const activeShift = cashierData.myShift
    const varianceShiftsCount = cashierData.myRecentShifts.filter((s) => s.cash_variance !== 0).length

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold tracking-tight text-foreground">
                    Halo, {userName}
                </h1>
                <p className="text-sm text-muted-foreground">
                    Status kesiapan shift kasir pribadi dan ringkasan tugas harian Anda.
                </p>
            </div>

            <SummaryStatGrid>
                <SummaryStatCard
                    title="Status Shift Saya"
                    value={activeShift ? activeShift.register_name : 'Belum Buka'}
                    icon={Monitor}
                    variant="blue"
                    subInfo={activeShift ? activeShift.shift_number : 'Buka shift untuk mulai bertugas'}
                    periodLabel={activeShift ? 'Aktif' : 'Nonaktif'}
                    href={shifts.index.url()}
                />
                <SummaryStatCard
                    title="Transaksi Hari Ini"
                    value={`${formatNumber(cashierData.myTodayTransactionsCount)} trx`}
                    icon={Receipt}
                    variant="emerald"
                    subInfo={
                        activeShift
                            ? `${formatNumber(activeShift.transactions_count)} trx pada shift aktif`
                            : 'Total transaksi selesai hari ini'
                    }
                    periodLabel="Hari Ini"
                />
                <SummaryStatCard
                    title="Modal Awal Laci"
                    value={activeShift ? formatRupiah(activeShift.starting_cash) : formatRupiah(0)}
                    icon={Banknote}
                    variant="amber"
                    subInfo={activeShift ? `Dibuka ${activeShift.opened_at_human}` : 'Belum ada shift aktif'}
                    periodLabel="Laci Kasir"
                />
                <SummaryStatCard
                    title="Riwayat Shift Terakhir"
                    value={`${formatNumber(cashierData.myRecentShifts.length)} shift`}
                    icon={History}
                    variant="rose"
                    subInfo={`${formatNumber(varianceShiftsCount)} shift berselisih kas`}
                    periodLabel="5 Terakhir"
                    href={shifts.history.url()}
                />
            </SummaryStatGrid>

            {/* Hero Shift Readiness Card */}
            <Card
                className={
                    activeShift
                        ? 'border-emerald-300 bg-emerald-50/40 dark:border-emerald-800 dark:bg-emerald-950/20'
                        : 'border-amber-300 bg-amber-50/50 dark:border-amber-800 dark:bg-amber-950/20'
                }
            >
                <CardContent className="p-6 flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
                    {activeShift ? (
                        <>
                            <div className="space-y-2">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <Badge variant="success" className="gap-1">
                                        <CheckCircle2 className="h-3 w-3" /> Shift Aktif
                                    </Badge>
                                    <span className="font-mono text-sm font-bold text-primary">
                                        {activeShift.shift_number}
                                    </span>
                                    <Badge variant="outline" className="gap-1">
                                        <Monitor className="h-3 w-3" /> {activeShift.register_name}
                                    </Badge>
                                </div>
                                <h2 className="text-lg font-bold text-foreground">
                                    Laci Kasir Terbuka & Siap Melayani
                                </h2>
                                <p className="text-xs text-muted-foreground">
                                    Dibuka pada <strong className="text-foreground">{activeShift.opened_at}</strong> ({activeShift.opened_at_human}) • Modal Awal:{' '}
                                    <strong className="font-mono text-foreground">{formatRupiah(activeShift.starting_cash)}</strong>
                                </p>
                            </div>

                            <div className="flex flex-wrap gap-2 shrink-0">
                                <Link href={cashier.index.url()}>
                                    <Button className="gap-2 cursor-pointer">
                                        <ShoppingCart className="h-4 w-4" />
                                        Lanjut ke Kasir
                                    </Button>
                                </Link>
                                <Link href={shifts.index.url()}>
                                    <Button variant="outline" className="gap-2 cursor-pointer">
                                        <Lock className="h-4 w-4" />
                                        Kelola / Tutup Shift
                                    </Button>
                                </Link>
                            </div>
                        </>
                    ) : (
                        <>
                            <div className="space-y-2">
                                <Badge variant="outline" className="border-amber-300 text-amber-700 dark:text-amber-300">
                                    Belum Bertugas
                                </Badge>
                                <h2 className="text-lg font-bold text-foreground">
                                    Anda Belum Membuka Sesi Shift
                                </h2>
                                <p className="text-xs text-muted-foreground max-w-lg">
                                    Buka sesi shift terlebih dahulu dengan memasukkan modal awal laci kasir agar dapat memproses transaksi POS.
                                </p>
                            </div>

                            <Button size="lg" onClick={() => setOpenDialog(true)} className="gap-2 shrink-0 cursor-pointer">
                                <PlayCircle className="h-4 w-4" />
                                Buka Shift Sekarang
                            </Button>
                        </>
                    )}
                </CardContent>
            </Card>

            {/* 5 Riwayat Shift Terakhir Milik Sendiri */}
            <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-3">
                    <div>
                        <CardTitle className="flex items-center gap-2 text-base">
                            <History className="h-4 w-4 text-primary" />
                            5 Riwayat Shift Terakhir Anda
                        </CardTitle>
                        <CardDescription className="text-xs">
                            Rekap penutupan sesi shift pribadi Anda sebelumnya.
                        </CardDescription>
                    </div>
                    <Link href={shifts.history.url()}>
                        <Button variant="ghost" size="sm" className="h-7 text-xs cursor-pointer">
                            Lihat Semua
                        </Button>
                    </Link>
                </CardHeader>
                <CardContent>
                    <div className="overflow-x-auto rounded-lg border">
                        <table className="table-fixed w-full min-w-[640px] text-sm">
                            <thead className="bg-muted/50 border-b text-xs text-muted-foreground">
                                <tr>
                                    <th className="w-[22%] px-3 py-2.5 text-left font-medium">No. Shift</th>
                                    <th className="w-[14%] px-3 py-2.5 text-left font-medium">Mesin</th>
                                    <th className="w-[22%] px-3 py-2.5 text-left font-medium">Waktu Tutup</th>
                                    <th className="w-[12%] px-3 py-2.5 text-right font-medium">Trx</th>
                                    <th className="w-[18%] px-3 py-2.5 text-left font-medium">Rekonsiliasi</th>
                                    <th className="w-[12%] px-3 py-2.5 text-right font-medium">Aksi</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {cashierData.myRecentShifts.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="px-4 py-8 text-center text-xs text-muted-foreground">
                                            <Clock className="mx-auto mb-2 h-6 w-6 opacity-40" />
                                            Belum ada riwayat shift tertutup sebelumnya.
                                        </td>
                                    </tr>
                                ) : (
                                    cashierData.myRecentShifts.map((row) => {
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
                                                    {row.closed_at}
                                                </td>
                                                <td className="px-3 py-2.5 text-right font-mono text-xs font-semibold">
                                                    {row.total_transactions}
                                                </td>
                                                <td className="px-3 py-2.5">
                                                    <Badge variant="outline" className={variance.className}>
                                                        {variance.label}
                                                    </Badge>
                                                </td>
                                                <td className="px-3 py-2.5 text-right">
                                                    <Link href={shifts.show.url(row.id)}>
                                                        <Button size="sm" variant="outline" className="h-7 text-xs cursor-pointer">
                                                            Z-Report
                                                        </Button>
                                                    </Link>
                                                </td>
                                            </tr>
                                        )
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                </CardContent>
            </Card>

            <OpenShiftDialog open={openDialog} onOpenChange={setOpenDialog} />
        </div>
    )
}

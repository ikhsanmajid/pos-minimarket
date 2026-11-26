import React, { useState } from 'react'
import { Link, usePage } from '@inertiajs/react'
import AuthenticatedLayout from '@/layouts/AuthenticatedLayout'
import { ShiftGuardBanner } from '@/components/ShiftGuardBanner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { CheckCircle2, Clock, Landmark, Lock, Monitor, ShoppingCart } from 'lucide-react'
import type { PageProps } from '@/types'
import shifts from '@/routes/pos/shifts'
import { OpenShiftDialog } from './component/OpenShiftDialog'
import { formatRupiah } from './component/shiftUtils'

type CashierTerminalProps = PageProps<{
    hasActiveShift: boolean
    shiftSummary: {
        id: number
        shift_number: string
        register_name: string
        opened_at: string
        starting_cash: number
        transactions_count: number
    } | null
}>

const CashierTerminal = () => {
    const { hasActiveShift, shiftSummary } = usePage<CashierTerminalProps>().props
    const [openShiftDialog, setOpenShiftDialog] = useState(false)

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-foreground">
                        Terminal Kasir POS
                    </h1>
                    <p className="text-sm text-muted-foreground">
                        Setiap transaksi penjualan POS terikat langsung pada sesi shift kasir yang sedang aktif.
                    </p>
                </div>

                <Link href={shifts.index.url()}>
                    <Button variant="outline" className="gap-2 cursor-pointer">
                        <Clock className="h-4 w-4" />
                        Kelola Sesi Shift
                    </Button>
                </Link>
            </div>

            {!hasActiveShift || !shiftSummary ? (
                <>
                    <ShiftGuardBanner onOpenShiftClick={() => setOpenShiftDialog(true)} />
                    <OpenShiftDialog open={openShiftDialog} onOpenChange={setOpenShiftDialog} />
                </>
            ) : (
                <Card className="border-emerald-200 dark:border-emerald-800/70">
                    <CardHeader className="border-b pb-4">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                    <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                                    <CardTitle className="text-lg">Kasir Siap Bertransaksi</CardTitle>
                                    <Badge variant="success">Shift Terbuka</Badge>
                                </div>
                                <CardDescription>
                                    Shift <span className="font-mono font-semibold text-foreground">{shiftSummary.shift_number}</span> •{' '}
                                    <span className="inline-flex items-center gap-1">
                                        <Monitor className="h-3.5 w-3.5" /> {shiftSummary.register_name}
                                    </span>{' '}
                                    • Dibuka {shiftSummary.opened_at}
                                </CardDescription>
                            </div>

                            <div className="flex flex-wrap gap-2">
                                <Link href={shifts.index.url()}>
                                    <Button variant="outline" size="sm" className="gap-1.5 cursor-pointer">
                                        <Landmark className="h-4 w-4" />
                                        Cash In / Out / Drop
                                    </Button>
                                </Link>
                                <Link href={shifts.index.url()}>
                                    <Button variant="destructive" size="sm" className="gap-1.5 cursor-pointer">
                                        <Lock className="h-4 w-4" />
                                        Tutup Shift
                                    </Button>
                                </Link>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="pt-6 space-y-4">
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                            <div className="rounded-lg border bg-muted/20 p-4">
                                <p className="text-xs text-muted-foreground">Modal Awal Laci</p>
                                <p className="mt-1 font-mono text-lg font-bold">
                                    {formatRupiah(shiftSummary.starting_cash)}
                                </p>
                            </div>
                            <div className="rounded-lg border bg-muted/20 p-4">
                                <p className="text-xs text-muted-foreground">Transaksi Pada Shift Ini</p>
                                <p className="mt-1 font-mono text-lg font-bold">
                                    {shiftSummary.transactions_count} transaksi
                                </p>
                            </div>
                            <div className="rounded-lg border bg-muted/20 p-4">
                                <p className="text-xs text-muted-foreground">Shift Guard</p>
                                <p className="mt-1 text-sm font-semibold text-emerald-700 dark:text-emerald-400">
                                    Tervalidasi (ID #{shiftSummary.id})
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center gap-3 rounded-lg border border-dashed p-5 text-sm text-muted-foreground">
                            <ShoppingCart className="h-5 w-5 shrink-0 text-primary" />
                            <span>
                                Shift Guard aktif dan terhubung dengan middleware <code className="font-mono text-xs text-foreground">shift.open</code>. Seluruh transaksi POS baru akan otomatis ditautkan ke <strong className="font-mono text-foreground">{shiftSummary.shift_number}</strong>.
                            </span>
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    )
}

CashierTerminal.layout = (page: React.ReactNode) => (
    <AuthenticatedLayout>{page}</AuthenticatedLayout>
)

export default CashierTerminal

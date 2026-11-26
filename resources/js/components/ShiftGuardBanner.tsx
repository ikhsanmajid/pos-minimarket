import React from 'react'
import { Link } from '@inertiajs/react'
import { AlertTriangle, PlayCircle, ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import shifts from '@/routes/pos/shifts'

interface ShiftGuardBannerProps {
    onOpenShiftClick?: () => void
    title?: string
    description?: string
}

export function ShiftGuardBanner({
    onOpenShiftClick,
    title = 'Sesi Shift Kasir Belum Dibuka',
    description = 'Anda harus membuka sesi shift dan mencatat modal awal laci kasir terlebih dahulu sebelum dapat memproses transaksi penjualan POS.',
}: ShiftGuardBannerProps) {
    return (
        <Card className="border-amber-300 bg-amber-50/70 dark:border-amber-800 dark:bg-amber-950/30">
            <CardContent className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-4">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-500/15 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300">
                        <AlertTriangle className="h-6 w-6" />
                    </div>
                    <div className="space-y-1">
                        <h3 className="text-base font-semibold text-foreground">{title}</h3>
                        <p className="text-sm text-muted-foreground max-w-2xl">{description}</p>
                    </div>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                    {onOpenShiftClick ? (
                        <Button onClick={onOpenShiftClick} className="gap-2 cursor-pointer">
                            <PlayCircle className="h-4 w-4" />
                            Buka Shift Sekarang
                        </Button>
                    ) : (
                        <Link href={shifts.index.url()}>
                            <Button className="gap-2 cursor-pointer">
                                <PlayCircle className="h-4 w-4" />
                                Buka Shift Sekarang
                                <ArrowRight className="h-4 w-4" />
                            </Button>
                        </Link>
                    )}
                </div>
            </CardContent>
        </Card>
    )
}

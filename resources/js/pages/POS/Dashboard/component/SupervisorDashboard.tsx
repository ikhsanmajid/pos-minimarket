import React from 'react'
import { Link } from '@inertiajs/react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { SummaryStatCard, SummaryStatGrid } from '@/components/SummaryStatCard'
import { formatNumber, formatRupiah } from '@/lib/utils'
import { Activity, Clock, Receipt, Scale, TrendingUp } from 'lucide-react'
import shifts from '@/routes/pos/shifts'
import {
    type ActionableAlertsData,
    type ActiveShiftSnapshot,
    type RecentActivityItem,
    type SalesTrendPoint,
} from './dashboardUtils'
import { SalesProfitChart } from './DashboardCharts'
import { ActionableAlertsCard } from './ActionableAlertsCard'

export interface SupervisorDashboardProps {
    kpis: {
        today_sales: { value: number; previous: number; growth_pct: number | null }
        today_transactions: { count: number; avg_basket_size: number }
        active_shifts_count: number
        shift_anomalies_count: number
    }
    alertCounts: {
        low_stock: number
        pending_po: number
        shift_anomalies: number
    }
    activeShifts: ActiveShiftSnapshot[]
    salesTrend7d?: SalesTrendPoint[]
    actionableAlerts?: ActionableAlertsData
    recentActivities?: RecentActivityItem[]
}

export function SupervisorDashboard({
    kpis,
    alertCounts,
    activeShifts,
    salesTrend7d,
    actionableAlerts,
    recentActivities,
}: SupervisorDashboardProps) {
    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold tracking-tight text-foreground">
                    Dashboard Operasional Supervisor
                </h1>
                <p className="text-sm text-muted-foreground">
                    Pantau omzet harian, kesiapan shift kasir, stok kritis, dan status PO berjalan.
                </p>
            </div>

            <SummaryStatGrid>
                <SummaryStatCard
                    title="Omzet Hari Ini"
                    value={formatRupiah(kpis.today_sales.value)}
                    icon={TrendingUp}
                    variant="blue"
                    subInfo={`vs Kemarin: ${formatRupiah(kpis.today_sales.previous)}`}
                    periodLabel="Hari Ini"
                />
                <SummaryStatCard
                    title="Transaksi Hari Ini"
                    value={`${formatNumber(kpis.today_transactions.count)} trx`}
                    icon={Receipt}
                    variant="emerald"
                    subInfo={`Rata-rata: ${formatRupiah(kpis.today_transactions.avg_basket_size)}`}
                    periodLabel="Hari Ini"
                />
                <SummaryStatCard
                    title="Shift Sedang Aktif"
                    value={`${formatNumber(kpis.active_shifts_count)} shift`}
                    icon={Clock}
                    variant="amber"
                    subInfo="Kasir sedang bertugas"
                    periodLabel="Aktif"
                    href={shifts.index.url()}
                />
                <SummaryStatCard
                    title="Selisih Shift (7 Hari)"
                    value={`${formatNumber(kpis.shift_anomalies_count)} shift`}
                    icon={Scale}
                    variant="rose"
                    subInfo="Memerlukan verifikasi"
                    periodLabel="7 Hari"
                    href={shifts.history.url({ query: { has_variance: 1 } })}
                />
            </SummaryStatGrid>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
                <div className="lg:col-span-8">
                    <SalesProfitChart
                        data={salesTrend7d}
                        showProfit={false}
                        title="Tren Omzet 7 Hari Terakhir"
                        description="Pergerakan omzet harian toko selama 7 hari terakhir."
                    />
                </div>

                <Card className="lg:col-span-4 flex flex-col">
                    <CardHeader className="pb-3">
                        <CardTitle className="flex items-center gap-2 text-base">
                            <Clock className="h-4 w-4 text-emerald-600" />
                            Shift Sedang Aktif
                        </CardTitle>
                        <CardDescription className="text-xs">Daftar mesin kasir aktif</CardDescription>
                    </CardHeader>
                    <CardContent className="flex-1 space-y-2.5">
                        {activeShifts.length === 0 ? (
                            <p className="py-10 text-center text-xs text-muted-foreground">
                                Tidak ada shift terbuka saat ini.
                            </p>
                        ) : (
                            activeShifts.map((s) => (
                                <Link
                                    key={s.id}
                                    href={shifts.show.url(s.id)}
                                    className="flex items-center justify-between rounded-lg border p-3 hover:bg-muted/40"
                                >
                                    <div className="min-w-0">
                                        <p className="text-xs font-semibold truncate">
                                            {s.cashier_name} • {s.register_name}
                                        </p>
                                        <p className="font-mono text-[11px] text-muted-foreground">
                                            {s.shift_number} • {s.opened_at_human}
                                        </p>
                                    </div>
                                    <Badge variant="success">{s.transactions_count} trx</Badge>
                                </Link>
                            ))
                        )}
                    </CardContent>
                </Card>
            </div>

            <ActionableAlertsCard
                counts={alertCounts}
                alerts={actionableAlerts}
                showPayables={false}
            />

            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-base">
                        <Activity className="h-4 w-4 text-primary" />
                        Aktivitas Operasional Terbaru
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {recentActivities === undefined ? (
                        <div className="space-y-2.5">
                            <Skeleton className="h-10 w-full" />
                            <Skeleton className="h-10 w-full" />
                            <Skeleton className="h-10 w-full" />
                        </div>
                    ) : recentActivities.length === 0 ? (
                        <p className="text-xs text-muted-foreground">Belum ada aktivitas operasional terbaru.</p>
                    ) : (
                        <div className="divide-y rounded-lg border">
                            {recentActivities.map((act) => (
                                <div key={act.id} className="flex items-center justify-between gap-4 p-3 text-xs">
                                    <p className="text-foreground">{act.description}</p>
                                    <span className="text-muted-foreground shrink-0">
                                        {act.causer_name} • {act.created_at_human}
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}

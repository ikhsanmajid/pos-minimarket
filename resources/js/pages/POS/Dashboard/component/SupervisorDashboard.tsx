import React from 'react'
import { Link } from '@inertiajs/react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Activity, Clock, Receipt, Scale, TrendingUp } from 'lucide-react'
import shifts from '@/routes/pos/shifts'
import {
    formatRupiah,
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

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <Card>
                    <CardContent className="p-5 space-y-1.5">
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                            <span>Omzet Hari Ini</span>
                            <TrendingUp className="h-4 w-4 text-blue-600" />
                        </div>
                        <p className="font-mono text-xl font-bold">{formatRupiah(kpis.today_sales.value)}</p>
                        <p className="text-xs text-muted-foreground">
                            vs Kemarin: {formatRupiah(kpis.today_sales.previous)}
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="p-5 space-y-1.5">
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                            <span>Transaksi Hari Ini</span>
                            <Receipt className="h-4 w-4 text-emerald-600" />
                        </div>
                        <p className="font-mono text-xl font-bold">{kpis.today_transactions.count} trx</p>
                        <p className="text-xs text-muted-foreground">
                            Rata-rata: {formatRupiah(kpis.today_transactions.avg_basket_size)}
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="p-5 space-y-1.5">
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                            <span>Shift Sedang Aktif</span>
                            <Clock className="h-4 w-4 text-primary" />
                        </div>
                        <p className="font-mono text-xl font-bold">{kpis.active_shifts_count} shift</p>
                        <p className="text-xs text-muted-foreground">Kasir sedang bertugas</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="p-5 space-y-1.5">
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                            <span>Selisih Shift (7 Hari)</span>
                            <Scale className="h-4 w-4 text-amber-600" />
                        </div>
                        <p className="font-mono text-xl font-bold">{kpis.shift_anomalies_count} shift</p>
                        <p className="text-xs text-muted-foreground">Memerlukan verifikasi</p>
                    </CardContent>
                </Card>
            </div>

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

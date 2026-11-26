import React, { useState } from 'react'
import { Link, router } from '@inertiajs/react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import {
    Activity,
    ArrowDownRight,
    ArrowUpRight,
    Calendar,
    CircleDollarSign,
    Clock,
    FileWarning,
    Flame,
    TrendingUp,
    Wallet,
} from 'lucide-react'
import dashboard from '@/routes/pos/dashboard'
import shifts from '@/routes/pos/shifts'
import activityLogs from '@/routes/pos/activity-logs'
import {
    formatRupiah,
    type ActionableAlertsData,
    type ActiveShiftSnapshot,
    type PaymentCompositionData,
    type PeriodMeta,
    type RecentActivityItem,
    type SalesTrendPoint,
    type TopProductItem,
} from './dashboardUtils'
import { PaymentMethodDonutChart, SalesProfitChart } from './DashboardCharts'
import { ActionableAlertsCard } from './ActionableAlertsCard'

export interface AdminDashboardProps {
    period: PeriodMeta
    kpis: {
        net_sales: {
            value: number
            previous: number
            growth_pct: number | null
            transactions_count: number
            avg_basket_size: number
        }
        gross_profit: {
            value: number
            previous: number
            growth_pct: number | null
            margin_pct: number
            cogs: number
        }
        cash_bank_balance: {
            total: number
            cash_total: number
            bank_total: number
            accounts_count: number
        }
        active_payables: {
            total_remaining: number
            unpaid_count: number
            due_soon_count: number
            overdue_count: number
        }
    }
    alertCounts: {
        pending_po: number
        low_stock: number
        due_payables: number
        shift_anomalies: number
    }
    activeShifts: ActiveShiftSnapshot[]
    salesTrend?: SalesTrendPoint[]
    paymentComposition?: PaymentCompositionData
    actionableAlerts?: ActionableAlertsData
    topProducts?: TopProductItem[]
    recentActivities?: RecentActivityItem[]
}

export function AdminDashboard({
    period,
    kpis,
    alertCounts,
    activeShifts,
    salesTrend,
    paymentComposition,
    actionableAlerts,
    topProducts,
    recentActivities,
}: AdminDashboardProps) {
    const [showCustomRange, setShowCustomRange] = useState(period.preset === 'custom')
    const [customStart, setCustomStart] = useState(period.start_date)
    const [customEnd, setCustomEnd] = useState(period.end_date)

    const changePeriod = (preset: 'today' | '7d' | 'month') => {
        setShowCustomRange(false)
        router.get(
            dashboard.index.url(),
            { period: preset },
            { preserveState: true, preserveScroll: true, replace: true }
        )
    }

    const applyCustomPeriod = (e: React.FormEvent) => {
        e.preventDefault()
        if (!customStart || !customEnd) return
        router.get(
            dashboard.index.url(),
            { period: 'custom', start_date: customStart, end_date: customEnd },
            { preserveState: true, preserveScroll: true, replace: true }
        )
    }

    return (
        <div className="space-y-6">
            {/* Header + Global Period Filter */}
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-foreground">
                        Dashboard Eksekutif Toko
                    </h1>
                    <p className="text-sm text-muted-foreground">
                        Ringkasan kinerja penjualan, laba kotor, likuiditas kas/bank, dan operasional periode{' '}
                        <strong className="text-foreground">{period.label}</strong>.
                    </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    <div className="inline-flex rounded-lg border bg-card p-1 gap-1">
                        {[
                            { id: 'today', label: 'Hari Ini' },
                            { id: '7d', label: '7 Hari' },
                            { id: 'month', label: 'Bulan Ini' },
                        ].map((item) => (
                            <Button
                                key={item.id}
                                type="button"
                                size="sm"
                                variant={period.preset === item.id && !showCustomRange ? 'default' : 'ghost'}
                                onClick={() => changePeriod(item.id as 'today' | '7d' | 'month')}
                                className="h-7 px-3 text-xs cursor-pointer"
                            >
                                {item.label}
                            </Button>
                        ))}
                        <Button
                            type="button"
                            size="sm"
                            variant={showCustomRange || period.preset === 'custom' ? 'default' : 'ghost'}
                            onClick={() => setShowCustomRange((prev) => !prev)}
                            className="h-7 gap-1 px-3 text-xs cursor-pointer"
                        >
                            <Calendar className="h-3.5 w-3.5" />
                            Custom
                        </Button>
                    </div>
                </div>
            </div>

            {showCustomRange && (
                <form
                    onSubmit={applyCustomPeriod}
                    className="flex flex-wrap items-end gap-3 rounded-xl border bg-card p-3.5"
                >
                    <div className="space-y-1">
                        <label className="text-xs text-muted-foreground">Tanggal Mulai</label>
                        <Input
                            type="date"
                            value={customStart}
                            onChange={(e) => setCustomStart(e.target.value)}
                            className="h-8 text-xs w-auto"
                            required
                        />
                    </div>
                    <div className="space-y-1">
                        <label className="text-xs text-muted-foreground">Tanggal Akhir</label>
                        <Input
                            type="date"
                            value={customEnd}
                            onChange={(e) => setCustomEnd(e.target.value)}
                            className="h-8 text-xs w-auto"
                            required
                        />
                    </div>
                    <Button type="submit" size="sm" className="h-8 text-xs cursor-pointer">
                        Terapkan Periode
                    </Button>
                </form>
            )}

            {/* 4 KPI Cards */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <Card>
                    <CardContent className="p-5 space-y-2">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-medium text-muted-foreground">
                                Penjualan Bersih
                            </span>
                            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400">
                                <TrendingUp className="h-4 w-4" />
                            </div>
                        </div>
                        <p className="font-mono text-xl font-bold text-foreground">
                            {formatRupiah(kpis.net_sales.value)}
                        </p>
                        <div className="flex items-center justify-between text-xs">
                            <GrowthPill value={kpis.net_sales.growth_pct} />
                            <span className="text-muted-foreground">
                                {kpis.net_sales.transactions_count} trx • Avg {formatRupiah(kpis.net_sales.avg_basket_size)}
                            </span>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="p-5 space-y-2">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-medium text-muted-foreground">
                                Estimasi Laba Kotor
                            </span>
                            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                                <CircleDollarSign className="h-4 w-4" />
                            </div>
                        </div>
                        <p className="font-mono text-xl font-bold text-foreground">
                            {formatRupiah(kpis.gross_profit.value)}
                        </p>
                        <div className="flex items-center justify-between text-xs">
                            <GrowthPill value={kpis.gross_profit.growth_pct} />
                            <span className="text-muted-foreground">
                                Margin <strong className="text-foreground">{kpis.gross_profit.margin_pct}%</strong>
                            </span>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="p-5 space-y-2">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-medium text-muted-foreground">
                                Total Saldo Kas & Bank
                            </span>
                            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-500/10 text-violet-600 dark:text-violet-400">
                                <Wallet className="h-4 w-4" />
                            </div>
                        </div>
                        <p className="font-mono text-xl font-bold text-foreground">
                            {formatRupiah(kpis.cash_bank_balance.total)}
                        </p>
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                            <span>Kas: {formatRupiah(kpis.cash_bank_balance.cash_total)}</span>
                            <span>Bank: {formatRupiah(kpis.cash_bank_balance.bank_total)}</span>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="p-5 space-y-2">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-medium text-muted-foreground">
                                Hutang Dagang Aktif (AP)
                            </span>
                            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
                                <FileWarning className="h-4 w-4" />
                            </div>
                        </div>
                        <p className="font-mono text-xl font-bold text-foreground">
                            {formatRupiah(kpis.active_payables.total_remaining)}
                        </p>
                        <div className="flex items-center justify-between text-xs">
                            <span className="text-muted-foreground">
                                {kpis.active_payables.unpaid_count} tagihan aktif
                            </span>
                            {kpis.active_payables.due_soon_count > 0 ? (
                                <Badge variant="destructive" className="text-[10px]">
                                    {kpis.active_payables.due_soon_count} jatuh tempo ≤7H
                                </Badge>
                            ) : (
                                <Badge variant="success" className="text-[10px]">
                                    Aman
                                </Badge>
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Charts Row (8 cols + 4 cols) */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
                <div className="lg:col-span-8">
                    <SalesProfitChart data={salesTrend} showProfit={true} />
                </div>
                <div className="lg:col-span-4">
                    <PaymentMethodDonutChart data={paymentComposition} />
                </div>
            </div>

            {/* Actionable Alerts */}
            <ActionableAlertsCard
                counts={alertCounts}
                alerts={actionableAlerts}
                showPayables={true}
            />

            {/* Operational Snapshots */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                {/* Shift Sedang Aktif */}
                <Card className="flex flex-col">
                    <CardHeader className="flex flex-row items-center justify-between pb-3">
                        <div>
                            <CardTitle className="flex items-center gap-2 text-base">
                                <Clock className="h-4 w-4 text-emerald-600" />
                                Shift Sedang Aktif
                            </CardTitle>
                            <CardDescription className="text-xs">Kasir bertugas saat ini</CardDescription>
                        </div>
                        <Badge variant="secondary">{activeShifts.length}</Badge>
                    </CardHeader>
                    <CardContent className="flex-1">
                        {activeShifts.length === 0 ? (
                            <p className="py-8 text-center text-xs text-muted-foreground">
                                Tidak ada sesi shift yang sedang terbuka saat ini.
                            </p>
                        ) : (
                            <div className="space-y-2.5">
                                {activeShifts.map((s) => (
                                    <Link
                                        key={s.id}
                                        href={shifts.show.url(s.id)}
                                        className="flex items-center justify-between rounded-lg border p-3 transition-colors hover:bg-muted/40"
                                    >
                                        <div className="min-w-0">
                                            <p className="text-xs font-semibold text-foreground truncate">
                                                {s.cashier_name} • {s.register_name}
                                            </p>
                                            <p className="font-mono text-[11px] text-muted-foreground">
                                                {s.shift_number} • {s.opened_at_human}
                                            </p>
                                        </div>
                                        <Badge variant="success" className="shrink-0 font-mono">
                                            {s.transactions_count} trx
                                        </Badge>
                                    </Link>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Top 5 Produk Terlaris */}
                <Card className="flex flex-col">
                    <CardHeader className="pb-3">
                        <CardTitle className="flex items-center gap-2 text-base">
                            <Flame className="h-4 w-4 text-orange-500" />
                            Top 5 Produk Terlaris
                        </CardTitle>
                        <CardDescription className="text-xs">
                            Fast moving dalam satuan dasar ({period.label})
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="flex-1">
                        {topProducts === undefined ? (
                            <div className="space-y-3">
                                {[1, 2, 3, 4, 5].map((i) => (
                                    <Skeleton key={i} className="h-10 w-full rounded" />
                                ))}
                            </div>
                        ) : topProducts.length === 0 ? (
                            <p className="py-8 text-center text-xs text-muted-foreground">
                                Belum ada produk terjual pada periode terpilih.
                            </p>
                        ) : (
                            <div className="space-y-3.5">
                                {topProducts.map((p, idx) => (
                                    <div key={p.product_id} className="space-y-1">
                                        <div className="flex items-center justify-between gap-2 text-xs">
                                            <span className="font-medium text-foreground truncate">
                                                {idx + 1}. {p.name}
                                            </span>
                                            <span className="font-mono font-semibold shrink-0">
                                                {formatRupiah(p.revenue)}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                                                <div
                                                    className="h-full rounded-full bg-primary transition-all"
                                                    style={{ width: `${Math.max(6, p.share_pct)}%` }}
                                                />
                                            </div>
                                            <span className="font-mono text-[11px] text-muted-foreground shrink-0">
                                                {p.qty_sold} {p.base_unit}
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Aktivitas Kritis Terbaru */}
                <Card className="flex flex-col">
                    <CardHeader className="flex flex-row items-center justify-between pb-3">
                        <div>
                            <CardTitle className="flex items-center gap-2 text-base">
                                <Activity className="h-4 w-4 text-primary" />
                                Aktivitas Terbaru
                            </CardTitle>
                            <CardDescription className="text-xs">Audit trail lintas modul</CardDescription>
                        </div>
                        <Link href={activityLogs.index.url()}>
                            <Button variant="ghost" size="sm" className="h-7 text-xs cursor-pointer">
                                Semua
                            </Button>
                        </Link>
                    </CardHeader>
                    <CardContent className="flex-1">
                        {recentActivities === undefined ? (
                            <div className="space-y-3">
                                {[1, 2, 3, 4, 5].map((i) => (
                                    <Skeleton key={i} className="h-10 w-full rounded" />
                                ))}
                            </div>
                        ) : recentActivities.length === 0 ? (
                            <p className="py-8 text-center text-xs text-muted-foreground">
                                Belum ada catatan aktivitas terbaru.
                            </p>
                        ) : (
                            <div className="space-y-2.5 max-h-[300px] overflow-y-auto custom-scrollbar pr-1">
                                {recentActivities.map((act) => (
                                    <div key={act.id} className="rounded-lg border bg-muted/20 p-2.5 text-xs">
                                        <p className="text-foreground line-clamp-2">{act.description}</p>
                                        <p className="mt-1 text-[11px] text-muted-foreground">
                                            {act.causer_name} • {act.created_at_human}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}

function GrowthPill({ value }: { value: number | null }) {
    if (value === null) {
        return <span className="text-muted-foreground">-</span>
    }
    const positive = value >= 0
    return (
        <span
            className={`inline-flex items-center gap-0.5 font-mono font-semibold ${
                positive ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
            }`}
        >
            {positive ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
            {positive ? '+' : ''}
            {value}%
        </span>
    )
}

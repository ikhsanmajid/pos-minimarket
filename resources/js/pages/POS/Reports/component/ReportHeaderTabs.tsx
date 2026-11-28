import React from 'react'
import { Link } from '@inertiajs/react'
import { BarChart3, Boxes, Landmark, TrendingUp } from 'lucide-react'
import { useAuth } from '@/hooks/use-auth'
import { cn } from '@/lib/utils'
import reports from '@/routes/pos/reports'

export type ReportTabKey = 'sales' | 'profit-loss' | 'stock-valuation' | 'finance-aging'

interface ReportHeaderTabsProps {
    activeTab: ReportTabKey
    title: string
    subtitle: string
    periodLabel: string
}

interface TabDef {
    key: ReportTabKey
    label: string
    href: string
    roles: string[]
    icon: React.ComponentType<{ className?: string }>
}

export function ReportHeaderTabs({
    activeTab,
    title,
    subtitle,
    periodLabel,
}: ReportHeaderTabsProps) {
    const { user } = useAuth()
    const role = (user?.role as string) || ''

    const tabs: TabDef[] = [
        {
            key: 'sales',
            label: 'Penjualan',
            href: reports.sales.url(),
            roles: ['admin', 'supervisor'],
            icon: BarChart3,
        },
        {
            key: 'profit-loss',
            label: 'Laba Kotor (HPP)',
            href: reports.profitLoss.url(),
            roles: ['admin'],
            icon: TrendingUp,
        },
        {
            key: 'stock-valuation',
            label: 'Valuasi & Stok',
            href: reports.stockValuation.url(),
            roles: ['admin', 'supervisor', 'warehouse'],
            icon: Boxes,
        },
        {
            key: 'finance-aging',
            label: 'Keuangan & Aging',
            href: reports.financeAging.url(),
            roles: ['admin'],
            icon: Landmark,
        },
    ].filter((tab) => tab.roles.includes(role))

    return (
        <div className="mb-5 space-y-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-foreground">{title}</h1>
                    <p className="text-sm text-muted-foreground">{subtitle}</p>
                </div>
                <span className="inline-flex w-fit items-center rounded-md border bg-muted/50 px-2.5 py-1 text-xs font-medium text-muted-foreground">
                    Periode: {periodLabel}
                </span>
            </div>

            {tabs.length > 1 && (
                <nav
                    aria-label="Navigasi Laporan Bisnis"
                    className="flex flex-wrap items-center gap-1.5 rounded-lg border bg-card p-1.5 shadow-xs"
                >
                    {tabs.map((tab) => {
                        const Icon = tab.icon
                        const isActive = tab.key === activeTab
                        return (
                            <Link
                                key={tab.key}
                                href={tab.href}
                                className={cn(
                                    'inline-flex h-9 items-center gap-2 rounded-md px-3 text-xs font-medium transition-colors',
                                    isActive
                                        ? 'bg-primary text-primary-foreground shadow-xs'
                                        : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                                )}
                            >
                                <Icon className="h-3.5 w-3.5" />
                                <span>{tab.label}</span>
                            </Link>
                        )
                    })}
                </nav>
            )}
        </div>
    )
}

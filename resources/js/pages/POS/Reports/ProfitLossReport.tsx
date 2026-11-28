import React, { useEffect, useMemo, useState } from 'react'
import { Head, router, usePage } from '@inertiajs/react'
import { AlertTriangle, Banknote, PackageMinus, TrendingUp } from 'lucide-react'
import AuthenticatedLayout from '@/layouts/AuthenticatedLayout'
import { DataTable, type DataTableColumn } from '@/components/dataTable'
import DataTablePagination, { type PaginationMeta } from '@/components/dataTablePagination'
import { DataTableSortHeader } from '@/components/dataTableSortHeader'
import { SummaryStatCard, SummaryStatGrid } from '@/components/SummaryStatCard'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import type { PageProps } from '@/types'
import reports from '@/routes/pos/reports'
import { ReportHeaderTabs } from './component/ReportHeaderTabs'
import ProfitLossReportSearch from './component/ProfitLossReportSearch'
import { ProfitLossTrendChart, type ProfitLossTrendPoint } from './component/ReportCharts'
import {
    formatIdr,
    formatQty,
    type ReportFilters,
    type ReportPeriod,
} from './component/reportUtils'

interface ProfitProductRow {
    product_id: number
    barcode: string
    product_name: string
    base_unit: string
    category_name: string
    qty_sold: number
    qty_returned: number
    net_revenue: number
    net_cogs: number
    gross_profit: number
    margin_pct: number
}

interface CategoryMarginRow {
    category_id: number | null
    category_name: string
    net_revenue: number
    net_cogs: number
    gross_profit: number
    margin_pct: number
}

type ProfitLossPageProps = PageProps<{
    period: ReportPeriod
    summary: {
        gross_revenue: number
        total_returns: number
        net_revenue: number
        gross_cogs: number
        restockable_return_cogs: number
        net_cogs: number
        gross_profit: number
        gross_margin_pct: number
        adjustment_loss: number
        opname_loss: number
        total_shrinkage: number
        operational_expense: number
        estimated_operating_profit: number
    }
    trend: ProfitLossTrendPoint[]
    categoryMargins: CategoryMarginRow[]
    products: PaginationMeta & { data: ProfitProductRow[] }
    filters: ReportFilters
    options: {
        categories: { id: number; name: string }[]
        products: { id: number; name: string; barcode: string }[]
    }
}>

export default function ProfitLossReport() {
    const { period, summary, trend, categoryMargins, products, filters, options } =
        usePage<ProfitLossPageProps>().props

    const [isLoading, setIsLoading] = useState(false)

    useEffect(() => {
        const offStart = router.on('start', () => setIsLoading(true))
        const offFinish = router.on('finish', () => setIsLoading(false))
        return () => {
            offStart()
            offFinish()
        }
    }, [])

    const handleSort = (field: string) => {
        let nextSort: string | undefined = field
        let nextDir: 'asc' | 'desc' | undefined = 'asc'
        if (filters.table_sort === field) {
            if (filters.table_direction === 'asc') {
                nextDir = 'desc'
            } else {
                nextSort = undefined
                nextDir = undefined
            }
        }
        router.visit(
            reports.profitLoss.url({ mergeQuery: { table_sort: nextSort, table_direction: nextDir, page: 1 } }),
            { preserveState: true, preserveScroll: true, replace: true }
        )
    }

    const columns = useMemo<DataTableColumn<ProfitProductRow>[]>(
        () => [
            {
                id: 'no',
                header: 'No',
                size: 55,
                cell: (info) => (
                    <span className="font-mono text-xs text-muted-foreground">
                        {(products.from ?? 1) + info.row.index}
                    </span>
                ),
            },
            {
                accessorKey: 'product_name',
                size: 220,
                header: () => (
                    <DataTableSortHeader
                        label="Produk"
                        field="product_name"
                        tableSort={filters.table_sort}
                        tableDirection={filters.table_direction}
                        toolbarSort={filters.sort}
                        toolbarDirection={filters.direction}
                        onSort={handleSort}
                    />
                ),
                cell: ({ row }) => (
                    <div className="min-w-0">
                        <div className="truncate font-medium text-foreground">{row.original.product_name}</div>
                        <div className="truncate font-mono text-[11px] text-muted-foreground">
                            {row.original.barcode} &bull; {row.original.category_name}
                        </div>
                    </div>
                ),
            },
            {
                accessorKey: 'qty_sold',
                size: 105,
                header: () => (
                    <DataTableSortHeader
                        label="Qty Terjual"
                        field="qty_sold"
                        tableSort={filters.table_sort}
                        tableDirection={filters.table_direction}
                        toolbarSort={filters.sort}
                        toolbarDirection={filters.direction}
                        onSort={handleSort}
                    />
                ),
                cell: ({ row }) => (
                    <span className="font-mono text-xs font-semibold">
                        {formatQty(row.original.qty_sold)} {row.original.base_unit}
                    </span>
                ),
            },
            {
                accessorKey: 'net_revenue',
                size: 140,
                header: () => (
                    <DataTableSortHeader
                        label="Omzet Bersih"
                        field="net_revenue"
                        tableSort={filters.table_sort}
                        tableDirection={filters.table_direction}
                        toolbarSort={filters.sort}
                        toolbarDirection={filters.direction}
                        onSort={handleSort}
                    />
                ),
                cell: (info) => <span className="font-mono text-xs">{formatIdr(info.getValue<number>())}</span>,
            },
            {
                accessorKey: 'net_cogs',
                size: 135,
                header: () => (
                    <DataTableSortHeader
                        label="HPP Bersih"
                        field="net_cogs"
                        tableSort={filters.table_sort}
                        tableDirection={filters.table_direction}
                        toolbarSort={filters.sort}
                        toolbarDirection={filters.direction}
                        onSort={handleSort}
                    />
                ),
                cell: (info) => <span className="font-mono text-xs text-muted-foreground">{formatIdr(info.getValue<number>())}</span>,
            },
            {
                accessorKey: 'gross_profit',
                size: 140,
                header: () => (
                    <DataTableSortHeader
                        label="Laba Kotor"
                        field="gross_profit"
                        tableSort={filters.table_sort}
                        tableDirection={filters.table_direction}
                        toolbarSort={filters.sort}
                        toolbarDirection={filters.direction}
                        onSort={handleSort}
                    />
                ),
                cell: (info) => {
                    const val = info.getValue<number>()
                    return (
                        <span
                            className={
                                val < 0
                                    ? 'font-mono text-xs font-semibold text-rose-600 dark:text-rose-400'
                                    : 'font-mono text-xs font-semibold text-emerald-600 dark:text-emerald-400'
                            }
                        >
                            {formatIdr(val)}
                        </span>
                    )
                },
            },
            {
                accessorKey: 'margin_pct',
                size: 100,
                header: () => (
                    <DataTableSortHeader
                        label="Margin %"
                        field="margin_pct"
                        tableSort={filters.table_sort}
                        tableDirection={filters.table_direction}
                        toolbarSort={filters.sort}
                        toolbarDirection={filters.direction}
                        onSort={handleSort}
                    />
                ),
                cell: (info) => (
                    <span className="font-mono text-xs font-semibold text-foreground">
                        {info.getValue<number>().toFixed(1)}%
                    </span>
                ),
            },
        ],
        [filters, products.from]
    )

    return (
        <AuthenticatedLayout>
            <Head title="Laporan Laba Kotor (HPP)" />
            <div className="p-4 sm:p-6 space-y-5">
                <ReportHeaderTabs
                    activeTab="profit-loss"
                    title="Laporan Laba Kotor & HPP"
                    subtitle="Analisis margin berbasis snapshot HPP historis, retur restockable, dan referensi shrinkage operasional."
                    periodLabel={`${period.start_date} s.d. ${period.end_date}`}
                />

                <SummaryStatGrid>
                    <SummaryStatCard
                        title="Omzet Bersih (Excl. PPN)"
                        value={formatIdr(summary.net_revenue)}
                        icon={Banknote}
                        variant="blue"
                        subInfo={`Retur: -${formatIdr(summary.total_returns)}`}
                        periodLabel={period.label}
                    />
                    <SummaryStatCard
                        title="Laba Kotor & Margin"
                        value={formatIdr(summary.gross_profit)}
                        icon={TrendingUp}
                        variant="emerald"
                        subInfo={`Margin: ${summary.gross_margin_pct.toFixed(2)}%`}
                        periodLabel="Net Rev - HPP"
                    />
                    <SummaryStatCard
                        title="Total HPP Bersih"
                        value={formatIdr(summary.net_cogs)}
                        icon={PackageMinus}
                        variant="amber"
                        subInfo={`Restock Retur: -${formatIdr(summary.restockable_return_cogs)}`}
                        periodLabel="Basis Snapshot"
                    />
                    <SummaryStatCard
                        title="Dampak Kerugian Stok"
                        value={formatIdr(summary.total_shrinkage)}
                        icon={AlertTriangle}
                        variant="rose"
                        subInfo={`Adj: ${formatIdr(summary.adjustment_loss)} | Opn: ${formatIdr(summary.opname_loss)}`}
                        periodLabel="Shrinkage"
                    />
                </SummaryStatGrid>

                <ProfitLossReportSearch
                    filters={filters}
                    categories={options.categories}
                    isLoading={isLoading}
                />

                <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                    <div className="lg:col-span-2">
                        <ProfitLossTrendChart data={trend} />
                    </div>
                    <Card className="h-full flex flex-col">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-base">Estimasi Laba Bersih Operasional</CardTitle>
                            <CardDescription className="text-xs">
                                Referensi terpisah dari Laba Kotor (memperhitungkan shrinkage &amp; beban operasional).
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="flex-1 flex flex-col justify-between space-y-3 text-sm">
                            <div className="space-y-2.5">
                                <div className="flex items-center justify-between border-b pb-2">
                                    <span className="text-muted-foreground">Laba Kotor</span>
                                    <span className="font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                                        {formatIdr(summary.gross_profit)}
                                    </span>
                                </div>
                                <div className="flex items-center justify-between border-b pb-2">
                                    <span className="text-muted-foreground">Shrinkage (Adjustment + Opname)</span>
                                    <span className="font-mono font-semibold text-rose-600 dark:text-rose-400">
                                        - {formatIdr(summary.total_shrinkage)}
                                    </span>
                                </div>
                                <div className="flex items-center justify-between border-b pb-2">
                                    <span className="text-muted-foreground">Beban Operasional (Non-PO)</span>
                                    <span className="font-mono font-semibold text-rose-600 dark:text-rose-400">
                                        - {formatIdr(summary.operational_expense)}
                                    </span>
                                </div>
                            </div>
                            <div className="rounded-lg border bg-muted/40 p-3">
                                <div className="text-xs text-muted-foreground">Estimasi Laba Bersih Operasional</div>
                                <div
                                    className={
                                        summary.estimated_operating_profit < 0
                                            ? 'mt-1 font-mono text-xl font-bold text-rose-600 dark:text-rose-400'
                                            : 'mt-1 font-mono text-xl font-bold text-emerald-600 dark:text-emerald-400'
                                    }
                                >
                                    {formatIdr(summary.estimated_operating_profit)}
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {categoryMargins.length > 0 && (
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-base">Margin per Kategori</CardTitle>
                            <CardDescription className="text-xs">
                                Kontribusi omzet bersih, HPP, dan margin laba kotor per kategori produk.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="overflow-x-auto">
                                <table className="w-full table-fixed min-w-[640px] text-sm">
                                    <thead>
                                        <tr className="border-b text-xs text-muted-foreground">
                                            <th className="w-[30%] py-2 text-left font-medium">Kategori</th>
                                            <th className="w-[20%] py-2 text-right font-medium">Omzet Bersih</th>
                                            <th className="w-[20%] py-2 text-right font-medium">HPP Bersih</th>
                                            <th className="w-[18%] py-2 text-right font-medium">Laba Kotor</th>
                                            <th className="w-[12%] py-2 text-right font-medium">Margin</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y">
                                        {categoryMargins.map((row) => (
                                            <tr key={row.category_name}>
                                                <td className="py-2.5 font-medium text-foreground truncate">{row.category_name}</td>
                                                <td className="py-2.5 text-right font-mono text-xs">{formatIdr(row.net_revenue)}</td>
                                                <td className="py-2.5 text-right font-mono text-xs text-muted-foreground">{formatIdr(row.net_cogs)}</td>
                                                <td className="py-2.5 text-right font-mono text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                                                    {formatIdr(row.gross_profit)}
                                                </td>
                                                <td className="py-2.5 text-right font-mono text-xs font-semibold">
                                                    {row.margin_pct.toFixed(1)}%
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </CardContent>
                    </Card>
                )}

                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-base">Rincian Laba Kotor per Produk</CardTitle>
                        <CardDescription className="text-xs">
                            Dihitung menggunakan cost_price_snapshot historis pada setiap baris transaksi.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <DataTable columns={columns} data={products.data} isLoading={isLoading} />
                        <DataTablePagination
                            meta={products}
                            routeUrl={reports.profitLoss}
                            isLoading={isLoading}
                        />
                    </CardContent>
                </Card>
            </div>
        </AuthenticatedLayout>
    )
}

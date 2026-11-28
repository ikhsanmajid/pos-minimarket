import React, { useEffect, useMemo, useState } from 'react'
import { Head, router, usePage } from '@inertiajs/react'
import { AlertOctagon, Boxes, Flame, Tag } from 'lucide-react'
import AuthenticatedLayout from '@/layouts/AuthenticatedLayout'
import { DataTable, type DataTableColumn } from '@/components/dataTable'
import DataTablePagination, { type PaginationMeta } from '@/components/dataTablePagination'
import { DataTableSortHeader } from '@/components/dataTableSortHeader'
import { SummaryStatCard, SummaryStatGrid } from '@/components/SummaryStatCard'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import type { PageProps } from '@/types'
import reports from '@/routes/pos/reports'
import { ReportHeaderTabs } from './component/ReportHeaderTabs'
import StockValuationReportSearch from './component/StockValuationReportSearch'
import { StockCompositionChart, type StockCompositionItem } from './component/ReportCharts'
import {
    formatIdr,
    formatQty,
    type ReportFilters,
    type ReportPeriod,
} from './component/reportUtils'

interface StockValuationRow {
    product_id: number
    barcode: string
    product_name: string
    category_name: string
    base_unit: string
    stock: number
    min_stock: number
    buy_price: number
    sell_price: number
    asset_value: number
    potential_sales: number
    potential_profit: number
    qty_sold: number
    movement_class: 'fast_moving' | 'slow_moving' | 'dead_stock' | 'out_of_stock' | string
    movement_label: string
}

interface MovementSummaryRow {
    type: string
    label: string
    qty_in: number
    qty_out: number
    movements_count: number
}

type StockValuationPageProps = PageProps<{
    period: ReportPeriod
    summary: {
        total_asset_value: number
        total_potential_sales: number
        total_potential_profit: number
        total_skus: number
        fast_moving_count: number
        slow_moving_count: number
        dead_stock_count: number
        out_of_stock_count: number
        fast_moving_threshold: number
    }
    composition: StockCompositionItem[]
    movementSummary: MovementSummaryRow[]
    products: PaginationMeta & { data: StockValuationRow[] }
    filters: ReportFilters
    options: {
        categories: { id: number; name: string }[]
    }
}>

function renderMovementBadge(movementClass: string, label: string) {
    if (movementClass === 'fast_moving') {
        return <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30">{label}</Badge>
    }
    if (movementClass === 'slow_moving') {
        return <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30">{label}</Badge>
    }
    if (movementClass === 'dead_stock') {
        return <Badge className="bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30">{label}</Badge>
    }
    return <Badge variant="secondary">{label}</Badge>
}

export default function StockValuationReport() {
    const { period, summary, composition, movementSummary, products, filters, options } =
        usePage<StockValuationPageProps>().props

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
            reports.stockValuation.url({ mergeQuery: { table_sort: nextSort, table_direction: nextDir, page: 1 } }),
            { preserveState: true, preserveScroll: true, replace: true }
        )
    }

    const columns = useMemo<DataTableColumn<StockValuationRow>[]>(
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
                size: 225,
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
                accessorKey: 'stock',
                size: 100,
                header: () => (
                    <DataTableSortHeader
                        label="Stok"
                        field="stock"
                        tableSort={filters.table_sort}
                        tableDirection={filters.table_direction}
                        toolbarSort={filters.sort}
                        toolbarDirection={filters.direction}
                        onSort={handleSort}
                    />
                ),
                cell: ({ row }) => (
                    <span className="font-mono text-xs font-semibold">
                        {formatQty(row.original.stock)} {row.original.base_unit}
                    </span>
                ),
            },
            {
                accessorKey: 'buy_price',
                size: 120,
                header: () => (
                    <DataTableSortHeader
                        label="HPP Satuan"
                        field="buy_price"
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
                accessorKey: 'asset_value',
                size: 140,
                header: () => (
                    <DataTableSortHeader
                        label="Nilai Aset"
                        field="asset_value"
                        tableSort={filters.table_sort}
                        tableDirection={filters.table_direction}
                        toolbarSort={filters.sort}
                        toolbarDirection={filters.direction}
                        onSort={handleSort}
                    />
                ),
                cell: (info) => <span className="font-mono text-xs font-semibold text-foreground">{formatIdr(info.getValue<number>())}</span>,
            },
            {
                accessorKey: 'qty_sold',
                size: 110,
                header: () => (
                    <DataTableSortHeader
                        label="Terjual"
                        field="qty_sold"
                        tableSort={filters.table_sort}
                        tableDirection={filters.table_direction}
                        toolbarSort={filters.sort}
                        toolbarDirection={filters.direction}
                        onSort={handleSort}
                    />
                ),
                cell: ({ row }) => (
                    <span className="font-mono text-xs">
                        {formatQty(row.original.qty_sold)} {row.original.base_unit}
                    </span>
                ),
            },
            {
                accessorKey: 'movement_class',
                size: 125,
                header: () => (
                    <DataTableSortHeader
                        label="Klasifikasi"
                        field="movement_class"
                        tableSort={filters.table_sort}
                        tableDirection={filters.table_direction}
                        toolbarSort={filters.sort}
                        toolbarDirection={filters.direction}
                        onSort={handleSort}
                    />
                ),
                cell: ({ row }) => renderMovementBadge(row.original.movement_class, row.original.movement_label),
            },
        ],
        [filters, products.from]
    )

    return (
        <AuthenticatedLayout>
            <Head title="Laporan Valuasi & Pergerakan Stok" />
            <div className="p-4 sm:p-6 space-y-5">
                <ReportHeaderTabs
                    activeTab="stock-valuation"
                    title="Laporan Valuasi & Pergerakan Stok"
                    subtitle="Valuasi aset persediaan aktif, klasifikasi fast/slow/dead stock, dan ringkasan mutasi stok."
                    periodLabel={`${period.start_date} s.d. ${period.end_date}`}
                />

                <SummaryStatGrid>
                    <SummaryStatCard
                        title="Total Nilai Aset Stok (HPP)"
                        value={formatIdr(summary.total_asset_value)}
                        icon={Boxes}
                        variant="blue"
                        subInfo={`${formatQty(summary.total_skus)} SKU aktif`}
                        periodLabel="HPP × Stok"
                    />
                    <SummaryStatCard
                        title="Potensi Nilai Jual"
                        value={formatIdr(summary.total_potential_sales)}
                        icon={Tag}
                        variant="emerald"
                        subInfo={`Potensi Laba: ${formatIdr(summary.total_potential_profit)}`}
                        periodLabel="Harga Jual"
                    />
                    <SummaryStatCard
                        title="Produk Fast-Moving"
                        value={`${formatQty(summary.fast_moving_count)} SKU`}
                        icon={Flame}
                        variant="amber"
                        subInfo={`Ambang ≥ ${summary.fast_moving_threshold} unit`}
                        periodLabel={`Slow: ${summary.slow_moving_count}`}
                    />
                    <SummaryStatCard
                        title="Produk Dead Stock"
                        value={`${formatQty(summary.dead_stock_count)} SKU`}
                        icon={AlertOctagon}
                        variant="rose"
                        subInfo="Stok > 0, terjual 0"
                        periodLabel={`Habis: ${summary.out_of_stock_count}`}
                    />
                </SummaryStatGrid>

                <StockValuationReportSearch
                    filters={filters}
                    categories={options.categories}
                    isLoading={isLoading}
                />

                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                    <StockCompositionChart data={composition} />

                    <Card className="h-full flex flex-col">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-base">Ringkasan Mutasi Stok</CardTitle>
                            <CardDescription className="text-xs">
                                Total barang masuk &amp; keluar per jenis mutasi pada periode evaluasi.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="flex-1">
                            {movementSummary.length === 0 ? (
                                <p className="py-12 text-center text-xs text-muted-foreground">
                                    Belum ada mutasi stok tercatat pada periode ini.
                                </p>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full table-fixed min-w-[440px] text-sm">
                                        <thead>
                                            <tr className="border-b text-xs text-muted-foreground">
                                                <th className="w-[44%] py-2 text-left font-medium">Jenis Mutasi</th>
                                                <th className="w-[16%] py-2 text-right font-medium">Event</th>
                                                <th className="w-[20%] py-2 text-right font-medium">Masuk</th>
                                                <th className="w-[20%] py-2 text-right font-medium">Keluar</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y">
                                            {movementSummary.map((row) => (
                                                <tr key={row.type}>
                                                    <td className="py-2 font-medium text-foreground truncate">{row.label}</td>
                                                    <td className="py-2 text-right font-mono text-xs text-muted-foreground">{formatQty(row.movements_count)}</td>
                                                    <td className="py-2 text-right font-mono text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                                                        {row.qty_in > 0 ? `+${formatQty(row.qty_in)}` : '-'}
                                                    </td>
                                                    <td className="py-2 text-right font-mono text-xs font-semibold text-rose-600 dark:text-rose-400">
                                                        {row.qty_out > 0 ? `-${formatQty(row.qty_out)}` : '-'}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>

                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-base">Valuasi Persediaan per Produk</CardTitle>
                        <CardDescription className="text-xs">
                            Hanya menghitung produk aktif (produk terhapus / soft-deleted dikecualikan).
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <DataTable columns={columns} data={products.data} isLoading={isLoading} />
                        <DataTablePagination
                            meta={products}
                            routeUrl={reports.stockValuation}
                            isLoading={isLoading}
                        />
                    </CardContent>
                </Card>
            </div>
        </AuthenticatedLayout>
    )
}

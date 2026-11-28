import React, { useEffect, useMemo, useState } from 'react'
import { Head, router, usePage } from '@inertiajs/react'
import { Banknote, Receipt, RotateCcw, ShoppingBag } from 'lucide-react'
import AuthenticatedLayout from '@/layouts/AuthenticatedLayout'
import { DataTable, type DataTableColumn } from '@/components/dataTable'
import DataTablePagination, { type PaginationMeta } from '@/components/dataTablePagination'
import { DataTableSortHeader } from '@/components/dataTableSortHeader'
import { SummaryStatCard, SummaryStatGrid } from '@/components/SummaryStatCard'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import type { PageProps } from '@/types'
import reports from '@/routes/pos/reports'
import { ReportHeaderTabs } from './component/ReportHeaderTabs'
import SalesReportSearch from './component/SalesReportSearch'
import {
    SalesPaymentChart,
    SalesTrendChart,
    type PaymentBreakdownRow,
    type SalesDailyPoint,
} from './component/ReportCharts'
import {
    formatIdr,
    formatQty,
    type ReportFilters,
    type ReportPeriod,
} from './component/reportUtils'

interface SalesProductRow {
    product_id: number
    barcode: string
    product_name: string
    base_unit: string
    category_name: string
    transactions_count: number
    qty_sold: number
    qty_returned: number
    total_discount: number
    total_revenue: number
    refund_amount: number
    net_revenue: number
}

interface CashierBreakdownRow {
    cashier_id: number
    cashier_name: string
    transactions_count: number
    gross_sales: number
    returns_count: number
    returns_amount: number
    net_sales: number
}

interface PromotionFundingBreakdownRow {
    funding: 'store' | 'supplier' | 'shared' | string
    label: string
    applications_count: number
    transactions_count: number
    total_discount: number
    percentage: number
}

type SalesReportPageProps = PageProps<{
    period: ReportPeriod
    summary: {
        gross_sales: number
        total_discount: number
        total_tax: number
        total_returns: number
        net_sales: number
        transactions_count: number
        total_items_sold: number
        average_order_value: number
    }
    dailyTrend: SalesDailyPoint[]
    paymentBreakdown: PaymentBreakdownRow[]
    cashierBreakdown: CashierBreakdownRow[]
    promotionFundingBreakdown?: PromotionFundingBreakdownRow[]
    products: PaginationMeta & { data: SalesProductRow[] }
    filters: ReportFilters
    options: {
        cashiers: { id: number; name: string }[]
        categories: { id: number; name: string }[]
        products: { id: number; name: string; barcode: string }[]
        paymentMethods: { value: string; label: string }[]
    }
}>

export default function SalesReport() {
    const {
        period,
        summary,
        dailyTrend,
        paymentBreakdown,
        cashierBreakdown,
        promotionFundingBreakdown = [],
        products,
        filters,
        options,
    } = usePage<SalesReportPageProps>().props

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
            reports.sales.url({ mergeQuery: { table_sort: nextSort, table_direction: nextDir, page: 1 } }),
            { preserveState: true, preserveScroll: true, replace: true }
        )
    }

    const columns = useMemo<DataTableColumn<SalesProductRow>[]>(
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
                size: 240,
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
                            {row.original.barcode} &bull; {row.original.base_unit}
                        </div>
                    </div>
                ),
            },
            {
                accessorKey: 'category_name',
                size: 150,
                header: () => (
                    <DataTableSortHeader
                        label="Kategori"
                        field="category_name"
                        tableSort={filters.table_sort}
                        tableDirection={filters.table_direction}
                        toolbarSort={filters.sort}
                        toolbarDirection={filters.direction}
                        onSort={handleSort}
                    />
                ),
                cell: (info) => <span className="truncate text-sm text-muted-foreground">{info.getValue<string>()}</span>,
            },
            {
                accessorKey: 'qty_sold',
                size: 110,
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
                    <span className="font-mono text-xs font-semibold text-foreground">
                        {formatQty(row.original.qty_sold)} {row.original.base_unit}
                    </span>
                ),
            },
            {
                accessorKey: 'qty_returned',
                size: 95,
                header: 'Retur',
                cell: ({ row }) => (
                    <span
                        className={
                            row.original.qty_returned > 0
                                ? 'font-mono text-xs font-semibold text-rose-600 dark:text-rose-400'
                                : 'font-mono text-xs text-muted-foreground'
                        }
                    >
                        {formatQty(row.original.qty_returned)}
                    </span>
                ),
            },
            {
                accessorKey: 'total_discount',
                size: 125,
                header: () => (
                    <DataTableSortHeader
                        label="Diskon"
                        field="total_discount"
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
                accessorKey: 'total_revenue',
                size: 145,
                header: () => (
                    <DataTableSortHeader
                        label="Omzet Bersih"
                        field="total_revenue"
                        tableSort={filters.table_sort}
                        tableDirection={filters.table_direction}
                        toolbarSort={filters.sort}
                        toolbarDirection={filters.direction}
                        onSort={handleSort}
                    />
                ),
                cell: ({ row }) => (
                    <span className="font-mono text-xs font-semibold text-foreground">
                        {formatIdr(row.original.net_revenue)}
                    </span>
                ),
            },
        ],
        [filters, products.from]
    )

    return (
        <AuthenticatedLayout>
            <Head title="Laporan Penjualan" />
            <div className="p-4 sm:p-6 space-y-5">
                <ReportHeaderTabs
                    activeTab="sales"
                    title="Laporan Penjualan"
                    subtitle="Analisis omzet, metode pembayaran, performa kasir, dan rincian penjualan per produk."
                    periodLabel={`${period.start_date} s.d. ${period.end_date}`}
                />

                <SummaryStatGrid>
                    <SummaryStatCard
                        title="Omzet Bersih"
                        value={formatIdr(summary.net_sales)}
                        icon={Banknote}
                        variant="blue"
                        subInfo={`Kotor: ${formatIdr(summary.gross_sales)}`}
                        periodLabel={period.label}
                    />
                    <SummaryStatCard
                        title="Total Transaksi Valid"
                        value={`${formatQty(summary.transactions_count)} trx`}
                        icon={Receipt}
                        variant="emerald"
                        subInfo={`${formatQty(summary.total_items_sold)} unit terjual`}
                        periodLabel="Non-void"
                    />
                    <SummaryStatCard
                        title="Rata-rata Transaksi (AOV)"
                        value={formatIdr(summary.average_order_value)}
                        icon={ShoppingBag}
                        variant="amber"
                        subInfo={`PPN: ${formatIdr(summary.total_tax)}`}
                        periodLabel={`Diskon: ${formatIdr(summary.total_discount)}`}
                    />
                    <SummaryStatCard
                        title="Total Retur Penjualan"
                        value={formatIdr(summary.total_returns)}
                        icon={RotateCcw}
                        variant="rose"
                        subInfo="Mengurangi omzet bersih"
                        periodLabel={period.label}
                    />
                </SummaryStatGrid>

                <SalesReportSearch
                    filters={filters}
                    cashiers={options.cashiers}
                    categories={options.categories}
                    paymentMethods={options.paymentMethods}
                    isLoading={isLoading}
                />

                <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                    <div className="lg:col-span-2">
                        <SalesTrendChart data={dailyTrend} />
                    </div>
                    <div>
                        <SalesPaymentChart data={paymentBreakdown} />
                    </div>
                </div>

                {promotionFundingBreakdown.some((r) => r.applications_count > 0 || r.total_discount > 0) && (
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-base">Ringkasan Beban Promo per Penanggung Biaya</CardTitle>
                            <CardDescription className="text-xs">
                                Rekapitulasi potongan promo &amp; voucher berdasarkan sumber pendanaan (Toko, Supplier, Patungan).
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="overflow-x-auto">
                                <table className="w-full table-fixed min-w-[600px] text-sm">
                                    <thead>
                                        <tr className="border-b text-xs text-muted-foreground">
                                            <th className="w-[34%] py-2 text-left font-medium">Penanggung Biaya</th>
                                            <th className="w-[16%] py-2 text-right font-medium">Penerapan</th>
                                            <th className="w-[16%] py-2 text-right font-medium">Transaksi</th>
                                            <th className="w-[20%] py-2 text-right font-medium">Total Potongan</th>
                                            <th className="w-[14%] py-2 text-right font-medium">Porsi (%)</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y">
                                        {promotionFundingBreakdown.map((row) => (
                                            <tr key={row.funding}>
                                                <td className="py-2.5 font-medium text-foreground truncate">
                                                    {row.label}
                                                </td>
                                                <td className="py-2.5 text-right font-mono text-xs">
                                                    {formatQty(row.applications_count)}
                                                </td>
                                                <td className="py-2.5 text-right font-mono text-xs">
                                                    {formatQty(row.transactions_count)}
                                                </td>
                                                <td className="py-2.5 text-right font-mono text-xs font-semibold text-foreground">
                                                    {formatIdr(row.total_discount)}
                                                </td>
                                                <td className="py-2.5 text-right font-mono text-xs text-muted-foreground">
                                                    {row.percentage.toFixed(1)}%
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </CardContent>
                    </Card>
                )}

                {cashierBreakdown.length > 0 && (
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-base">Ringkasan Performa Kasir</CardTitle>
                            <CardDescription className="text-xs">
                                Jumlah transaksi valid, omzet kotor, retur, dan omzet bersih per kasir.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="overflow-x-auto">
                                <table className="w-full table-fixed min-w-[640px] text-sm">
                                    <thead>
                                        <tr className="border-b text-xs text-muted-foreground">
                                            <th className="w-[30%] py-2 text-left font-medium">Kasir</th>
                                            <th className="w-[14%] py-2 text-right font-medium">Transaksi</th>
                                            <th className="w-[18%] py-2 text-right font-medium">Omzet Kotor</th>
                                            <th className="w-[18%] py-2 text-right font-medium">Retur</th>
                                            <th className="w-[20%] py-2 text-right font-medium">Omzet Bersih</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y">
                                        {cashierBreakdown.map((row) => (
                                            <tr key={row.cashier_id}>
                                                <td className="py-2.5 font-medium text-foreground truncate">{row.cashier_name}</td>
                                                <td className="py-2.5 text-right font-mono text-xs">{formatQty(row.transactions_count)}</td>
                                                <td className="py-2.5 text-right font-mono text-xs">{formatIdr(row.gross_sales)}</td>
                                                <td className="py-2.5 text-right font-mono text-xs text-rose-600 dark:text-rose-400">
                                                    {row.returns_amount > 0 ? `- ${formatIdr(row.returns_amount)} (${row.returns_count})` : '-'}
                                                </td>
                                                <td className="py-2.5 text-right font-mono text-xs font-semibold text-foreground">
                                                    {formatIdr(row.net_sales)}
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
                        <CardTitle className="text-base">Rincian Penjualan per Produk</CardTitle>
                        <CardDescription className="text-xs">
                            Agregasi penjualan dan retur per produk berdasarkan filter aktif.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <DataTable columns={columns} data={products.data} isLoading={isLoading} />
                        <DataTablePagination
                            meta={products}
                            routeUrl={reports.sales}
                            isLoading={isLoading}
                        />
                    </CardContent>
                </Card>
            </div>
        </AuthenticatedLayout>
    )
}

import React, { useEffect, useMemo, useState } from 'react'
import { Head, router, usePage } from '@inertiajs/react'
import { AlertCircle, ArrowDownLeft, ArrowUpRight, Scale } from 'lucide-react'
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
import FinanceAgingReportSearch from './component/FinanceAgingReportSearch'
import {
    FinanceCashflowChart,
    PayablesAgingChart,
    type AgingBucketRow,
    type CashflowCategoryRow,
} from './component/ReportCharts'
import {
    formatIdr,
    formatQty,
    type ReportFilters,
    type ReportPeriod,
} from './component/reportUtils'

interface AccountBalanceRow {
    id: number
    code: string
    name: string
    type: string
    type_label: string
    current_balance: number
}

interface SupplierAgingRow {
    supplier_id: number
    supplier_name: string
    current: number
    days_1_30: number
    days_31_60: number
    days_61_90: number
    over_90: number
    total: number
}

interface OverduePayableRow {
    id: number
    payable_number: string
    po_number: string
    invoice_number: string
    supplier_name: string
    due_date: string
    due_date_raw: string
    days_overdue: number
    aging_bucket: string
    bucket_key: string
    total_amount: number
    remaining_amount: number
    status: string
    status_label: string
}

type FinanceAgingPageProps = PageProps<{
    period: ReportPeriod
    summary: {
        total_income: number
        total_expense: number
        net_cashflow: number
        total_account_balance: number
        total_ap_remaining: number
        total_overdue_amount: number
        overdue_count: number
    }
    cashflowCategories: CashflowCategoryRow[]
    accountBalances: AccountBalanceRow[]
    agingBuckets: AgingBucketRow[]
    supplierAging: SupplierAgingRow[]
    overduePayables: PaginationMeta & { data: OverduePayableRow[] }
    filters: ReportFilters
    options: {
        accounts: { id: number; code: string; name: string }[]
        suppliers: { id: number; name: string }[]
    }
}>

export default function FinanceAgingReport() {
    const {
        period,
        summary,
        cashflowCategories,
        accountBalances,
        agingBuckets,
        supplierAging,
        overduePayables,
        filters,
        options,
    } = usePage<FinanceAgingPageProps>().props

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
            reports.financeAging.url({ mergeQuery: { table_sort: nextSort, table_direction: nextDir, page: 1 } }),
            { preserveState: true, preserveScroll: true, replace: true }
        )
    }

    const overdueColumns = useMemo<DataTableColumn<OverduePayableRow>[]>(
        () => [
            {
                id: 'no',
                header: 'No',
                size: 55,
                cell: (info) => (
                    <span className="font-mono text-xs text-muted-foreground">
                        {(overduePayables.from ?? 1) + info.row.index}
                    </span>
                ),
            },
            {
                accessorKey: 'payable_number',
                size: 170,
                header: () => (
                    <DataTableSortHeader
                        label="No. Hutang"
                        field="payable_number"
                        tableSort={filters.table_sort}
                        tableDirection={filters.table_direction}
                        toolbarSort={filters.sort}
                        toolbarDirection={filters.direction}
                        onSort={handleSort}
                    />
                ),
                cell: ({ row }) => (
                    <div>
                        <div className="font-mono text-xs font-semibold text-foreground">{row.original.payable_number}</div>
                        <div className="font-mono text-[11px] text-muted-foreground">{row.original.po_number}</div>
                    </div>
                ),
            },
            {
                accessorKey: 'supplier_name',
                size: 200,
                header: () => (
                    <DataTableSortHeader
                        label="Supplier"
                        field="supplier_name"
                        tableSort={filters.table_sort}
                        tableDirection={filters.table_direction}
                        toolbarSort={filters.sort}
                        toolbarDirection={filters.direction}
                        onSort={handleSort}
                    />
                ),
                cell: (info) => <span className="truncate font-medium text-foreground">{info.getValue<string>()}</span>,
            },
            {
                accessorKey: 'due_date_raw',
                size: 120,
                header: () => (
                    <DataTableSortHeader
                        label="Jatuh Tempo"
                        field="due_date_raw"
                        tableSort={filters.table_sort}
                        tableDirection={filters.table_direction}
                        toolbarSort={filters.sort}
                        toolbarDirection={filters.direction}
                        onSort={handleSort}
                    />
                ),
                cell: ({ row }) => <span className="font-mono text-xs">{row.original.due_date}</span>,
            },
            {
                accessorKey: 'days_overdue',
                size: 165,
                header: () => (
                    <DataTableSortHeader
                        label="Keterlambatan"
                        field="days_overdue"
                        tableSort={filters.table_sort}
                        tableDirection={filters.table_direction}
                        toolbarSort={filters.sort}
                        toolbarDirection={filters.direction}
                        onSort={handleSort}
                    />
                ),
                cell: ({ row }) => (
                    <Badge className="bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30 font-mono text-[11px]">
                        {row.original.days_overdue} hr &bull; {row.original.aging_bucket.replace('Terlambat ', '')}
                    </Badge>
                ),
            },
            {
                accessorKey: 'remaining_amount',
                size: 150,
                header: () => (
                    <DataTableSortHeader
                        label="Sisa Hutang"
                        field="remaining_amount"
                        tableSort={filters.table_sort}
                        tableDirection={filters.table_direction}
                        toolbarSort={filters.sort}
                        toolbarDirection={filters.direction}
                        onSort={handleSort}
                    />
                ),
                cell: (info) => (
                    <span className="font-mono text-xs font-semibold text-rose-600 dark:text-rose-400">
                        {formatIdr(info.getValue<number>())}
                    </span>
                ),
            },
        ],
        [filters, overduePayables.from]
    )

    return (
        <AuthenticatedLayout>
            <Head title="Laporan Keuangan & Aging Hutang" />
            <div className="p-4 sm:p-6 space-y-5">
                <ReportHeaderTabs
                    activeTab="finance-aging"
                    title="Laporan Keuangan & Aging Hutang"
                    subtitle="Arus kas per kategori, saldo akun kas/bank, dan analisis umur hutang dagang supplier."
                    periodLabel={`${period.start_date} s.d. ${period.end_date}`}
                />

                <SummaryStatGrid>
                    <SummaryStatCard
                        title="Total Pemasukan"
                        value={formatIdr(summary.total_income)}
                        icon={ArrowDownLeft}
                        variant="blue"
                        subInfo={`Saldo Kas/Bank: ${formatIdr(summary.total_account_balance)}`}
                        periodLabel={period.label}
                    />
                    <SummaryStatCard
                        title="Arus Kas Bersih"
                        value={formatIdr(summary.net_cashflow)}
                        icon={Scale}
                        variant="emerald"
                        subInfo="Pemasukan - Pengeluaran"
                        periodLabel={period.label}
                    />
                    <SummaryStatCard
                        title="Total Pengeluaran"
                        value={formatIdr(summary.total_expense)}
                        icon={ArrowUpRight}
                        variant="amber"
                        subInfo={`Total AP Aktif: ${formatIdr(summary.total_ap_remaining)}`}
                        periodLabel={period.label}
                    />
                    <SummaryStatCard
                        title="Hutang Jatuh Tempo (Overdue)"
                        value={formatIdr(summary.total_overdue_amount)}
                        icon={AlertCircle}
                        variant="rose"
                        subInfo={`${formatQty(summary.overdue_count)} faktur terlambat`}
                        periodLabel="Per Hari Ini"
                    />
                </SummaryStatGrid>

                <FinanceAgingReportSearch
                    filters={filters}
                    accounts={options.accounts}
                    suppliers={options.suppliers}
                    isLoading={isLoading}
                />

                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                    <FinanceCashflowChart data={cashflowCategories} />
                    <PayablesAgingChart data={agingBuckets} />
                </div>

                {accountBalances.length > 0 && (
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-base">Saldo Terkini Akun Kas &amp; Bank</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                                {accountBalances.map((acc) => (
                                    <div key={acc.id} className="rounded-lg border bg-muted/30 p-3">
                                        <div className="flex items-center justify-between gap-2">
                                            <span className="font-mono text-xs text-muted-foreground">{acc.code}</span>
                                            <Badge variant="outline" className="text-[10px]">
                                                {acc.type_label}
                                            </Badge>
                                        </div>
                                        <div className="mt-1 truncate text-sm font-medium text-foreground">{acc.name}</div>
                                        <div className="mt-1.5 font-mono text-base font-bold text-foreground">
                                            {formatIdr(acc.current_balance)}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                )}

                {supplierAging.length > 0 && (
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-base">Breakdown Aging Hutang per Supplier</CardTitle>
                            <CardDescription className="text-xs">
                                Hanya mencakup faktur yang belum lunas (sisa hutang &gt; 0).
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="overflow-x-auto">
                                <table className="w-full table-fixed min-w-[760px] text-sm">
                                    <thead>
                                        <tr className="border-b text-xs text-muted-foreground">
                                            <th className="w-[24%] py-2 text-left font-medium">Supplier</th>
                                            <th className="w-[12%] py-2 text-right font-medium">Current</th>
                                            <th className="w-[12%] py-2 text-right font-medium">1–30 Hr</th>
                                            <th className="w-[12%] py-2 text-right font-medium">31–60 Hr</th>
                                            <th className="w-[12%] py-2 text-right font-medium">61–90 Hr</th>
                                            <th className="w-[12%] py-2 text-right font-medium">&gt; 90 Hr</th>
                                            <th className="w-[16%] py-2 text-right font-medium">Total</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y">
                                        {supplierAging.map((row) => (
                                            <tr key={row.supplier_id}>
                                                <td className="py-2.5 font-medium text-foreground truncate">{row.supplier_name}</td>
                                                <td className="py-2.5 text-right font-mono text-xs">{formatIdr(row.current)}</td>
                                                <td className="py-2.5 text-right font-mono text-xs">{formatIdr(row.days_1_30)}</td>
                                                <td className="py-2.5 text-right font-mono text-xs">{formatIdr(row.days_31_60)}</td>
                                                <td className="py-2.5 text-right font-mono text-xs">{formatIdr(row.days_61_90)}</td>
                                                <td className="py-2.5 text-right font-mono text-xs text-rose-600 dark:text-rose-400">
                                                    {formatIdr(row.over_90)}
                                                </td>
                                                <td className="py-2.5 text-right font-mono text-xs font-semibold text-foreground">
                                                    {formatIdr(row.total)}
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
                        <CardTitle className="text-base">Daftar Faktur Hutang Jatuh Tempo (Overdue)</CardTitle>
                        <CardDescription className="text-xs">
                            Diurutkan dari keterlambatan terlama agar prioritas pelunasan terlihat jelas.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <DataTable columns={overdueColumns} data={overduePayables.data} isLoading={isLoading} />
                        <DataTablePagination
                            meta={overduePayables}
                            routeUrl={reports.financeAging}
                            isLoading={isLoading}
                        />
                    </CardContent>
                </Card>
            </div>
        </AuthenticatedLayout>
    )
}

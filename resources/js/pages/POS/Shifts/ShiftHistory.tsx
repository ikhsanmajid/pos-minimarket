import React, { useEffect, useMemo, useState } from 'react'
import { Link, router, usePage } from '@inertiajs/react'
import AuthenticatedLayout from '@/layouts/AuthenticatedLayout'
import { DataTable, type DataTableColumn } from '@/components/dataTable'
import DataTablePagination, { type PaginationMeta } from '@/components/dataTablePagination'
import { DataTableSortHeader } from '@/components/dataTableSortHeader'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { SummaryStatCard, SummaryStatGrid } from '@/components/SummaryStatCard'
import { formatDateRangeLabel, formatNumber, formatRupiah } from '@/lib/utils'
import { CheckCircle2, Clock, Eye, Scale, TrendingUp } from 'lucide-react'
import type { PageProps } from '@/types'
import CashierShiftController from '@/actions/App/Http/Controllers/CashierShiftController'
import shiftsRoutes from '@/routes/pos/shifts'
import ShiftHistoryTableToolbar, {
    type CashierOption,
    type ShiftHistoryFilters,
} from './component/ShiftHistorySearch'
import { getVarianceBadgeMeta } from './component/shiftUtils'

interface ShiftHistoryRow {
    id: number
    shift_number: string
    register_name: string
    cashier_name: string
    cashier_role: string
    status: string
    status_label: string
    opened_at: string
    closed_at: string | null
    starting_cash: number
    expected_cash: number | null
    actual_cash: number | null
    cash_variance: number | null
    total_transactions: number
    verified_by_name: string | null
}

type ShiftHistoryPageProps = PageProps<{
    shifts: PaginationMeta & { data: ShiftHistoryRow[] }
    filters: ShiftHistoryFilters
    summary: {
        total_shifts: number
        open_shifts: number
        normal_closed_shifts: number
        variance_shifts: number
        total_shift_sales: number
        total_variance_amount: number
    }
    cashiers: CashierOption[]
    canViewAll: boolean
}>

const ShiftHistory = () => {
    const { shifts, filters, summary, cashiers = [], canViewAll } = usePage<ShiftHistoryPageProps>().props
    const [isLoading, setIsLoading] = useState(false)

    const isVarianceActive =
        filters.has_variance === true ||
        String(filters.has_variance) === 'true' ||
        String(filters.has_variance) === '1'

    const handleToggleVariance = () => {
        router.visit(
            CashierShiftController.history({
                mergeQuery: {
                    has_variance: isVarianceActive ? undefined : '1',
                    page: 1,
                },
            }),
            { preserveState: true, preserveScroll: true, replace: true }
        )
    }

    useEffect(() => {
        const removeStart = router.on('start', () => setIsLoading(true))
        const removeFinish = router.on('finish', () => setIsLoading(false))
        return () => {
            removeStart()
            removeFinish()
        }
    }, [])

    const handleTableSort = (field: string) => {
        if (filters.sort === field) {
            return
        }

        const isCurrent = filters.table_sort === field
        let nextSort: string | undefined = field
        let nextDirection: 'asc' | 'desc' | undefined = 'asc'

        if (isCurrent) {
            if (filters.table_direction === 'asc') {
                nextDirection = 'desc'
            } else if (filters.table_direction === 'desc') {
                nextSort = undefined
                nextDirection = undefined
            }
        }

        router.visit(
            CashierShiftController.history({
                mergeQuery: {
                    table_sort: nextSort,
                    table_direction: nextDirection,
                    page: 1,
                },
            }),
            { preserveState: true, preserveScroll: true, replace: true }
        )
    }

    const columns = useMemo<DataTableColumn<ShiftHistoryRow>[]>(
        () => [
            {
                id: 'no',
                header: 'No',
                size: 55,
                cell: (info) => (
                    <span className="font-mono text-xs text-muted-foreground">
                        {(shifts.from ?? 1) + info.row.index}
                    </span>
                ),
            },
            {
                accessorKey: 'shift_number',
                size: 165,
                header: () => (
                    <DataTableSortHeader
                        label="No. Shift"
                        field="shift_number"
                        tableSort={filters.table_sort}
                        tableDirection={filters.table_direction}
                        toolbarSort={filters.sort}
                        toolbarDirection={filters.direction}
                        onSort={handleTableSort}
                    />
                ),
                cell: ({ row }) => (
                    <div className="min-w-0">
                        <Link
                            href={shiftsRoutes.show.url(row.original.id)}
                            className="font-mono text-xs font-semibold text-primary hover:underline block truncate"
                        >
                            {row.original.shift_number}
                        </Link>
                        <span className="text-[11px] text-muted-foreground truncate block">
                            {row.original.register_name}
                        </span>
                    </div>
                ),
            },
            {
                accessorKey: 'cashier_name',
                header: 'Kasir',
                size: 155,
                cell: ({ row }) => (
                    <div className="min-w-0">
                        <p className="text-xs font-medium text-foreground truncate">
                            {row.original.cashier_name}
                        </p>
                        <p className="text-[11px] text-muted-foreground truncate">
                            {row.original.cashier_role}
                        </p>
                    </div>
                ),
            },
            {
                accessorKey: 'opened_at',
                size: 145,
                header: () => (
                    <DataTableSortHeader
                        label="Waktu Buka"
                        field="opened_at"
                        tableSort={filters.table_sort}
                        tableDirection={filters.table_direction}
                        toolbarSort={filters.sort}
                        toolbarDirection={filters.direction}
                        onSort={handleTableSort}
                    />
                ),
                cell: ({ row }) => (
                    <span className="text-xs text-muted-foreground">{row.original.opened_at}</span>
                ),
            },
            {
                accessorKey: 'closed_at',
                size: 145,
                header: () => (
                    <DataTableSortHeader
                        label="Waktu Tutup"
                        field="closed_at"
                        tableSort={filters.table_sort}
                        tableDirection={filters.table_direction}
                        toolbarSort={filters.sort}
                        toolbarDirection={filters.direction}
                        onSort={handleTableSort}
                    />
                ),
                cell: ({ row }) =>
                    row.original.closed_at ? (
                        <span className="text-xs text-muted-foreground">{row.original.closed_at}</span>
                    ) : (
                        <Badge variant="success">Aktif</Badge>
                    ),
            },
            {
                accessorKey: 'actual_cash',
                size: 135,
                header: () => (
                    <DataTableSortHeader
                        label="Fisik Kas"
                        field="actual_cash"
                        tableSort={filters.table_sort}
                        tableDirection={filters.table_direction}
                        toolbarSort={filters.sort}
                        toolbarDirection={filters.direction}
                        onSort={handleTableSort}
                    />
                ),
                cell: ({ row }) => (
                    <span className="font-mono text-xs font-semibold text-foreground">
                        {row.original.actual_cash !== null
                            ? formatRupiah(row.original.actual_cash)
                            : '-'}
                    </span>
                ),
            },
            {
                accessorKey: 'cash_variance',
                size: 170,
                header: () => (
                    <DataTableSortHeader
                        label="Selisih (Variance)"
                        field="cash_variance"
                        tableSort={filters.table_sort}
                        tableDirection={filters.table_direction}
                        toolbarSort={filters.sort}
                        toolbarDirection={filters.direction}
                        onSort={handleTableSort}
                    />
                ),
                cell: ({ row }) => {
                    const meta = getVarianceBadgeMeta(row.original.cash_variance)
                    return (
                        <Badge variant="outline" className={meta.className}>
                            {meta.label}
                        </Badge>
                    )
                },
            },
            {
                accessorKey: 'total_transactions',
                size: 95,
                header: () => (
                    <DataTableSortHeader
                        label="Trx"
                        field="total_transactions"
                        tableSort={filters.table_sort}
                        tableDirection={filters.table_direction}
                        toolbarSort={filters.sort}
                        toolbarDirection={filters.direction}
                        onSort={handleTableSort}
                    />
                ),
                cell: ({ row }) => (
                    <span className="font-mono text-xs font-semibold text-foreground">
                        {row.original.total_transactions}
                    </span>
                ),
            },
            {
                id: 'actions',
                header: () => <span className="text-right block w-full pr-2">Aksi</span>,
                size: 80,
                cell: ({ row }) => (
                    <div className="flex justify-end pr-2">
                        <Link href={shiftsRoutes.show.url(row.original.id)}>
                            <Button variant="outline" size="sm" className="h-7 gap-1 px-2.5 text-xs cursor-pointer">
                                <Eye className="h-3.5 w-3.5" />
                                Detail
                            </Button>
                        </Link>
                    </div>
                ),
            },
        ],
        [filters, shifts.from]
    )

    return (
        <div className="w-full min-w-0 space-y-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-foreground">
                        Riwayat Sesi Shift
                    </h1>
                    <p className="text-sm text-muted-foreground">
                        Audit rekonsiliasi laci kasir, selisih kas (variance), dan akses laporan Z-Report.
                    </p>
                </div>

                <Link href={shiftsRoutes.index.url()}>
                    <Button className="gap-2 cursor-pointer">
                        <Clock className="h-4 w-4" />
                        Ke Shift Aktif
                    </Button>
                </Link>
            </div>

            <SummaryStatGrid>
                <SummaryStatCard
                    title="Total Shift"
                    value={formatNumber(summary.total_shifts)}
                    icon={Clock}
                    variant="blue"
                    subInfo={`${formatNumber(summary.open_shifts)} shift sedang terbuka`}
                    periodLabel={formatDateRangeLabel(
                        filters.start_date,
                        filters.end_date,
                        canViewAll ? 'Semua Kasir' : 'Shift Saya'
                    )}
                    isActive={!filters.status && !isVarianceActive}
                    onClick={() => {
                        router.visit(
                            CashierShiftController.history({
                                mergeQuery: { status: undefined, has_variance: undefined, page: 1 },
                            }),
                            { preserveState: true, preserveScroll: true, replace: true }
                        )
                    }}
                />
                <SummaryStatCard
                    title="Total Penjualan Shift"
                    value={formatRupiah(summary.total_shift_sales)}
                    icon={TrendingUp}
                    variant="emerald"
                    subInfo="Akumulasi shift yang sudah ditutup"
                    periodLabel={formatDateRangeLabel(filters.start_date, filters.end_date, 'Tertutup')}
                />
                <SummaryStatCard
                    title="Shift Selesai Normal"
                    value={formatNumber(summary.normal_closed_shifts)}
                    icon={CheckCircle2}
                    variant="amber"
                    subInfo="Rekonsiliasi seimbang (Rp 0)"
                    periodLabel={formatDateRangeLabel(filters.start_date, filters.end_date, 'Normal')}
                />
                <SummaryStatCard
                    title="Shift Berselisih Kas"
                    value={formatNumber(summary.variance_shifts)}
                    icon={Scale}
                    variant="rose"
                    subInfo={`Total selisih: ${formatRupiah(summary.total_variance_amount)}`}
                    periodLabel={formatDateRangeLabel(filters.start_date, filters.end_date, 'Variance ≠ 0')}
                    isActive={isVarianceActive}
                    onClick={handleToggleVariance}
                />
            </SummaryStatGrid>

            <ShiftHistoryTableToolbar
                filters={filters}
                cashiers={cashiers}
                canViewAll={canViewAll}
                routeUrl={CashierShiftController.history}
                isLoading={isLoading}
            />

            <DataTable
                tableKey="shift-history-table"
                columns={columns}
                data={shifts.data}
                isLoading={isLoading}
                emptyMessage="Belum ada riwayat sesi shift sesuai filter yang dipilih."
            />

            <DataTablePagination
                meta={shifts}
                routeUrl={CashierShiftController.history}
                isLoading={isLoading}
            />
        </div>
    )
}

ShiftHistory.layout = (page: React.ReactNode) => (
    <AuthenticatedLayout>{page}</AuthenticatedLayout>
)

export default ShiftHistory

import React, { useEffect, useMemo, useState } from 'react'
import { Head, Link, router, usePage } from '@inertiajs/react'
import AuthenticatedLayout from '@/layouts/AuthenticatedLayout'
import { DataTable, type DataTableColumn } from '@/components/dataTable'
import DataTablePagination, { type PaginationMeta } from '@/components/dataTablePagination'
import { DataTableSortHeader } from '@/components/dataTableSortHeader'
import { SummaryStatCard, SummaryStatGrid } from '@/components/SummaryStatCard'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn, formatNumber, formatRupiah } from '@/lib/utils'
import {
    CheckCircle2,
    ClipboardCheck,
    Clock,
    EyeOff,
    Plus,
    Scale,
} from 'lucide-react'
import type { PageProps } from '@/types'
import StockOpnameController from '@/actions/App/Http/Controllers/StockOpnameController'
import { StockOpnameSearch, type StockOpnameFilters } from './component/StockOpnameSearch'
import { DialogCreateStockOpname } from './component/DialogCreateStockOpname'
import type { SelectOptionItem } from './component/StockAdjustmentSearch'

export interface StockOpnameRow {
    id: number
    opname_number: string
    status: 'draft' | 'in_progress' | 'completed' | 'cancelled' | string
    status_label: string
    category_id: number | null
    category_name: string
    is_blind_count: boolean
    notes: string | null
    total_items: number
    total_items_counted: number
    total_variance_items?: number
    total_variance_value?: number
    creator_name: string
    approver_name: string | null
    started_at: string | null
    completed_at: string | null
    created_at: string
}

type StockOpnamePageProps = PageProps<{
    opnames: PaginationMeta & { data: StockOpnameRow[] }
    filters: StockOpnameFilters
    summary: {
        total_sessions: number
        in_progress_sessions: number
        completed_sessions: number
        total_variance_value: number
    }
    categories: { id: number; name: string }[]
    canFinalize: boolean
    statusOptions: SelectOptionItem[]
}>

export default function StockOpname() {
    const { opnames, filters, summary, categories, statusOptions } =
        usePage<StockOpnamePageProps>().props

    const [isLoading, setIsLoading] = useState(false)
    const [createOpen, setCreateOpen] = useState(false)

    useEffect(() => {
        const removeStart = router.on('start', () => setIsLoading(true))
        const removeFinish = router.on('finish', () => setIsLoading(false))
        return () => {
            removeStart()
            removeFinish()
        }
    }, [])

    const handleTableSort = (field: string) => {
        if (filters.sort === field) return

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
            StockOpnameController.index({
                mergeQuery: {
                    table_sort: nextSort,
                    table_direction: nextDirection,
                    page: 1,
                },
            }),
            {
                preserveState: true,
                preserveScroll: true,
                replace: true,
            }
        )
    }

    const columns: DataTableColumn<StockOpnameRow>[] = useMemo(
        () => [
            {
                id: 'no',
                header: 'No',
                cell: (info) => (
                    <span className="font-mono text-xs text-muted-foreground">
                        {(opnames.from ?? 1) + info.row.index}
                    </span>
                ),
                size: 55,
            },
            {
                accessorKey: 'opname_number',
                header: () => (
                    <DataTableSortHeader
                        label="No. Opname"
                        field="opname_number"
                        tableSort={filters.table_sort}
                        tableDirection={filters.table_direction}
                        toolbarSort={filters.sort}
                        toolbarDirection={filters.direction}
                        onSort={handleTableSort}
                    />
                ),
                cell: ({ row }) => (
                    <div>
                        <Link
                            href={StockOpnameController.show.url(row.original.id)}
                            className="font-mono text-xs font-semibold text-primary hover:underline"
                        >
                            {row.original.opname_number}
                        </Link>
                        <div className="text-[11px] text-muted-foreground">
                            {row.original.created_at}
                        </div>
                    </div>
                ),
                size: 170,
            },
            {
                accessorKey: 'category_name',
                header: 'Cakupan & Mode',
                cell: ({ row }) => (
                    <div className="space-y-1">
                        <p className="truncate font-medium text-foreground">
                            {row.original.category_name}
                        </p>
                        {row.original.is_blind_count && (
                            <span className="inline-flex items-center gap-1 rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                                <EyeOff className="h-3 w-3" />
                                Blind Count
                            </span>
                        )}
                    </div>
                ),
                size: 170,
            },
            {
                accessorKey: 'total_items_counted',
                header: () => (
                    <DataTableSortHeader
                        label="Progress Hitung"
                        field="total_items_counted"
                        tableSort={filters.table_sort}
                        tableDirection={filters.table_direction}
                        toolbarSort={filters.sort}
                        toolbarDirection={filters.direction}
                        onSort={handleTableSort}
                    />
                ),
                cell: ({ row }) => {
                    const total = row.original.total_items
                    const counted = row.original.total_items_counted
                    const pct = total > 0 ? Math.min(100, Math.round((counted / total) * 100)) : 0
                    return (
                        <div className="space-y-1">
                            <div className="flex items-center justify-between text-xs">
                                <span className="font-mono font-semibold text-foreground">
                                    {counted} / {total}
                                </span>
                                <span className="font-mono text-[11px] text-muted-foreground">
                                    {pct}%
                                </span>
                            </div>
                            <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                                <div
                                    className={cn(
                                        'h-full rounded-full transition-all',
                                        pct === 100 ? 'bg-emerald-500' : 'bg-primary'
                                    )}
                                    style={{ width: `${pct}%` }}
                                />
                            </div>
                        </div>
                    )
                },
                size: 165,
            },
            {
                accessorKey: 'total_variance_value',
                header: () => (
                    <div className="flex justify-end">
                        <DataTableSortHeader
                            label="Selisih Nilai"
                            field="total_variance_value"
                            tableSort={filters.table_sort}
                            tableDirection={filters.table_direction}
                            toolbarSort={filters.sort}
                            toolbarDirection={filters.direction}
                            onSort={handleTableSort}
                        />
                    </div>
                ),
                cell: ({ row }) => {
                    if (row.original.total_variance_value === undefined) {
                        return (
                            <span className="block text-right text-xs italic text-muted-foreground">
                                Tersembunyi (Blind)
                            </span>
                        )
                    }
                    const val = row.original.total_variance_value
                    return (
                        <div className="text-right font-mono text-xs">
                            <p
                                className={cn(
                                    'font-semibold',
                                    val < 0
                                        ? 'text-rose-600 dark:text-rose-400'
                                        : val > 0
                                          ? 'text-emerald-600 dark:text-emerald-400'
                                          : 'text-foreground'
                                )}
                            >
                                {val > 0 ? '+' : ''}
                                {formatRupiah(val)}
                            </p>
                            <p className="text-[11px] text-muted-foreground">
                                {row.original.total_variance_items ?? 0} item selisih
                            </p>
                        </div>
                    )
                },
                size: 155,
            },
            {
                accessorKey: 'status',
                header: () => (
                    <DataTableSortHeader
                        label="Status"
                        field="status"
                        tableSort={filters.table_sort}
                        tableDirection={filters.table_direction}
                        toolbarSort={filters.sort}
                        toolbarDirection={filters.direction}
                        onSort={handleTableSort}
                    />
                ),
                cell: ({ row }) => {
                    const status = row.original.status
                    const badgeClass =
                        status === 'completed'
                            ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                            : status === 'cancelled'
                              ? 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-800 dark:bg-rose-950/60 dark:text-rose-300'
                              : status === 'in_progress'
                                ? 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                                : 'border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300'
                    return (
                        <div>
                            <Badge variant="outline" className={badgeClass}>
                                {row.original.status_label}
                            </Badge>
                            <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                                {row.original.creator_name}
                            </p>
                        </div>
                    )
                },
                size: 140,
            },
            {
                id: 'actions',
                header: () => <span className="block w-full pr-2 text-right">Aksi</span>,
                size: 95,
                cell: ({ row }) => {
                    const isEditable =
                        row.original.status === 'draft' || row.original.status === 'in_progress'
                    return (
                        <div className="flex justify-end pr-2">
                            <Link href={StockOpnameController.show.url(row.original.id)}>
                                <Button
                                    type="button"
                                    variant={isEditable ? 'default' : 'outline'}
                                    size="sm"
                                    className="h-7 px-2.5 text-xs"
                                >
                                    {isEditable ? 'Lanjutkan' : 'Detail'}
                                </Button>
                            </Link>
                        </div>
                    )
                },
            },
        ],
        [
            opnames.from,
            filters.table_sort,
            filters.table_direction,
            filters.sort,
            filters.direction,
        ]
    )

    return (
        <AuthenticatedLayout>
            <Head title="Stock Opname" />
            <div className="space-y-5">
                {/* Header */}
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight text-foreground">
                            Stock Opname (Audit Stok Fisik)
                        </h1>
                        <p className="text-sm text-muted-foreground">
                            Lakukan penghitungan stok fisik secara berkala dengan dukungan scan barcode & mode blind count.
                        </p>
                    </div>
                    <Button type="button" onClick={() => setCreateOpen(true)} className="gap-1.5">
                        <Plus className="h-4 w-4" />
                        Mulai Sesi Opname
                    </Button>
                </div>

                {/* 4 KPI Cards */}
                <SummaryStatGrid>
                    <SummaryStatCard
                        title="Total Sesi Opname"
                        value={formatNumber(summary.total_sessions)}
                        icon={ClipboardCheck}
                        variant="blue"
                        subInfo="Seluruh riwayat sesi"
                        isLoading={isLoading}
                    />
                    <SummaryStatCard
                        title="Sesi Berlangsung"
                        value={formatNumber(summary.in_progress_sessions)}
                        icon={Clock}
                        variant="amber"
                        subInfo="Menunggu selesai / finalisasi"
                        isLoading={isLoading}
                    />
                    <SummaryStatCard
                        title="Sesi Selesai"
                        value={formatNumber(summary.completed_sessions)}
                        icon={CheckCircle2}
                        variant="emerald"
                        subInfo="Stok sudah direkonsiliasi"
                        isLoading={isLoading}
                    />
                    <SummaryStatCard
                        title="Akumulasi Selisih Nilai"
                        value={formatRupiah(summary.total_variance_value)}
                        icon={Scale}
                        variant="rose"
                        subInfo="Total selisih sesi selesai"
                        isLoading={isLoading}
                    />
                </SummaryStatGrid>

                {/* Toolbar Search */}
                <StockOpnameSearch
                    filters={filters}
                    statusOptions={statusOptions}
                    categories={categories}
                    isLoading={isLoading}
                />

                {/* DataTable */}
                <DataTable
                    columns={columns}
                    data={opnames.data}
                    tableKey="stock-opnames-table"
                    emptyMessage="Belum ada sesi stock opname."
                    isLoading={isLoading}
                />

                {/* Pagination */}
                <DataTablePagination
                    meta={opnames}
                    routeUrl={(opts) => StockOpnameController.index(opts)}
                    isLoading={isLoading}
                />
            </div>

            <DialogCreateStockOpname
                open={createOpen}
                onOpenChange={setCreateOpen}
                categories={categories}
            />
        </AuthenticatedLayout>
    )
}

import React, { useEffect, useMemo, useState } from 'react'
import { Head, router, usePage } from '@inertiajs/react'
import AuthenticatedLayout from '@/layouts/AuthenticatedLayout'
import { DataTable, type DataTableColumn } from '@/components/dataTable'
import DataTablePagination, { type PaginationMeta } from '@/components/dataTablePagination'
import { DataTableSortHeader } from '@/components/dataTableSortHeader'
import { SummaryStatCard, SummaryStatGrid } from '@/components/SummaryStatCard'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn, formatNumber, formatRupiah } from '@/lib/utils'
import {
    ArrowDownRight,
    ArrowUpRight,
    ClipboardList,
    Eye,
    Plus,
    TrendingDown,
} from 'lucide-react'
import type { PageProps } from '@/types'
import StockAdjustmentController from '@/actions/App/Http/Controllers/StockAdjustmentController'
import {
    StockAdjustmentSearch,
    type SelectOptionItem,
    type StockAdjustmentFilters,
} from './component/StockAdjustmentSearch'
import { DialogAddStockAdjustment } from './component/DialogAddStockAdjustment'
import { DialogDetailStockAdjustment } from './component/DialogDetailStockAdjustment'

export interface StockAdjustmentRow {
    id: number
    adjustment_number: string
    product_id: number
    product_name: string
    product_barcode: string
    base_unit: string
    current_product_stock: number | null
    type: 'in' | 'out' | string
    type_label: string
    type_short_label: string
    reason: string
    reason_label: string
    status: 'pending' | 'approved' | 'rejected' | string
    status_label: string
    qty_before: number | null
    qty_change: number
    qty_after: number | null
    unit_cost_snapshot: number
    total_cost_impact: number
    notes: string
    creator_name: string
    approver_name: string | null
    approved_at: string | null
    rejecter_name: string | null
    rejected_at: string | null
    rejection_reason: string | null
    created_at: string
}

type StockAdjustmentPageProps = PageProps<{
    adjustments: PaginationMeta & { data: StockAdjustmentRow[] }
    filters: StockAdjustmentFilters
    summary: {
        total_count: number
        pending_count: number
        in_count: number
        in_qty: number
        out_count: number
        out_qty: number
        total_loss_value: number
        net_cost_impact: number
    }
    canApprove: boolean
    typeOptions: SelectOptionItem[]
    reasonOptions: SelectOptionItem[]
    statusOptions: SelectOptionItem[]
}>

export default function StockAdjustment() {
    const {
        adjustments,
        filters,
        summary,
        canApprove,
        typeOptions,
        reasonOptions,
        statusOptions,
    } = usePage<StockAdjustmentPageProps>().props

    const [isLoading, setIsLoading] = useState(false)
    const [addOpen, setAddOpen] = useState(false)
    const [detailItem, setDetailItem] = useState<StockAdjustmentRow | null>(null)

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
            StockAdjustmentController.index({
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

    const columns: DataTableColumn<StockAdjustmentRow>[] = useMemo(
        () => [
            {
                id: 'no',
                header: 'No',
                cell: (info) => (
                    <span className="font-mono text-xs text-muted-foreground">
                        {(adjustments.from ?? 1) + info.row.index}
                    </span>
                ),
                size: 55,
            },
            {
                accessorKey: 'adjustment_number',
                header: () => (
                    <DataTableSortHeader
                        label="No. Dokumen"
                        field="adjustment_number"
                        tableSort={filters.table_sort}
                        tableDirection={filters.table_direction}
                        toolbarSort={filters.sort}
                        toolbarDirection={filters.direction}
                        onSort={handleTableSort}
                    />
                ),
                cell: ({ row }) => (
                    <div>
                        <button
                            type="button"
                            onClick={() => setDetailItem(row.original)}
                            className="font-mono text-xs font-semibold text-primary hover:underline"
                        >
                            {row.original.adjustment_number}
                        </button>
                        <div className="text-[11px] text-muted-foreground">
                            {row.original.created_at}
                        </div>
                    </div>
                ),
                size: 165,
            },
            {
                accessorKey: 'product_name',
                header: 'Produk',
                cell: ({ row }) => (
                    <div className="min-w-0">
                        <p className="truncate font-medium text-foreground">
                            {row.original.product_name}
                        </p>
                        <p className="truncate font-mono text-[11px] text-muted-foreground">
                            {row.original.product_barcode}
                        </p>
                    </div>
                ),
                size: 210,
            },
            {
                accessorKey: 'type',
                header: () => (
                    <DataTableSortHeader
                        label="Tipe & Alasan"
                        field="type"
                        tableSort={filters.table_sort}
                        tableDirection={filters.table_direction}
                        toolbarSort={filters.sort}
                        toolbarDirection={filters.direction}
                        onSort={handleTableSort}
                    />
                ),
                cell: ({ row }) => {
                    const isIn = row.original.type === 'in'
                    return (
                        <div className="space-y-1">
                            <Badge
                                variant="outline"
                                className={
                                    isIn
                                        ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                                        : 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-800 dark:bg-rose-950/60 dark:text-rose-300'
                                }
                            >
                                {row.original.type_short_label}
                            </Badge>
                            <p className="truncate text-xs text-muted-foreground">
                                {row.original.reason_label}
                            </p>
                        </div>
                    )
                },
                size: 170,
            },
            {
                accessorKey: 'qty_change',
                header: () => (
                    <div className="flex justify-end">
                        <DataTableSortHeader
                            label="Perubahan"
                            field="qty_change"
                            tableSort={filters.table_sort}
                            tableDirection={filters.table_direction}
                            toolbarSort={filters.sort}
                            toolbarDirection={filters.direction}
                            onSort={handleTableSort}
                        />
                    </div>
                ),
                cell: ({ row }) => {
                    const isIn = row.original.type === 'in'
                    return (
                        <div className="text-right font-mono text-xs">
                            <p
                                className={cn(
                                    'font-bold',
                                    isIn
                                        ? 'text-emerald-600 dark:text-emerald-400'
                                        : 'text-rose-600 dark:text-rose-400'
                                )}
                            >
                                {isIn ? `+${row.original.qty_change}` : `-${row.original.qty_change}`}{' '}
                                {row.original.base_unit}
                            </p>
                            {row.original.qty_before !== null && row.original.qty_after !== null && (
                                <p className="text-[11px] text-muted-foreground">
                                    {row.original.qty_before} → {row.original.qty_after}
                                </p>
                            )}
                        </div>
                    )
                },
                size: 130,
            },
            {
                accessorKey: 'total_cost_impact',
                header: () => (
                    <div className="flex justify-end">
                        <DataTableSortHeader
                            label="Dampak Nilai"
                            field="total_cost_impact"
                            tableSort={filters.table_sort}
                            tableDirection={filters.table_direction}
                            toolbarSort={filters.sort}
                            toolbarDirection={filters.direction}
                            onSort={handleTableSort}
                        />
                    </div>
                ),
                cell: ({ row }) => (
                    <span
                        className={cn(
                            'block text-right font-mono text-xs font-semibold',
                            row.original.total_cost_impact < 0
                                ? 'text-rose-600 dark:text-rose-400'
                                : 'text-emerald-600 dark:text-emerald-400'
                        )}
                    >
                        {row.original.total_cost_impact > 0 ? '+' : ''}
                        {formatRupiah(row.original.total_cost_impact)}
                    </span>
                ),
                size: 145,
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
                        status === 'approved'
                            ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                            : status === 'rejected'
                                ? 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-800 dark:bg-rose-950/60 dark:text-rose-300'
                                : 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/60 dark:text-amber-300'

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
                size: 155,
            },
            {
                id: 'actions',
                header: () => <span className="block w-full pr-2 text-right">Aksi</span>,
                size: 90,
                cell: ({ row }) => (
                    <div className="flex justify-end pr-2">
                        <Button
                            type="button"
                            variant={
                                canApprove && row.original.status === 'pending' ? 'default' : 'outline'
                            }
                            size="sm"
                            onClick={() => setDetailItem(row.original)}
                            className="h-7 gap-1 px-2.5 text-xs"
                        >
                            <Eye className="h-3.5 w-3.5" />
                            {canApprove && row.original.status === 'pending' ? 'Tinjau' : 'Detail'}
                        </Button>
                    </div>
                ),
            },
        ],
        [
            adjustments.from,
            filters.table_sort,
            filters.table_direction,
            filters.sort,
            filters.direction,
            canApprove,
        ]
    )

    return (
        <AuthenticatedLayout>
            <Head title="Stock Adjustment" />
            <div className="space-y-5">
                {/* Page Header */}
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight text-foreground">
                            Penyesuaian Stok (Stock Adjustment)
                        </h1>
                        <p className="text-sm text-muted-foreground">
                            Catat dan kelola penyesuaian stok rusak, kedaluwarsa, hilang, pemakaian internal, atau koreksi input.
                        </p>
                    </div>
                    <Button type="button" onClick={() => setAddOpen(true)} className="gap-1.5">
                        <Plus className="h-4 w-4" />
                        {canApprove ? 'Tambah Penyesuaian' : 'Ajukan Penyesuaian'}
                    </Button>
                </div>

                {/* 4 KPI Cards */}
                <SummaryStatGrid>
                    <SummaryStatCard
                        title="Total Penyesuaian"
                        value={formatNumber(summary.total_count)}
                        icon={ClipboardList}
                        variant="blue"
                        subInfo={
                            summary.pending_count > 0
                                ? `${summary.pending_count} menunggu persetujuan`
                                : 'Semua sudah diproses'
                        }
                        isLoading={isLoading}
                    />
                    <SummaryStatCard
                        title="Stok Masuk / Koreksi (+)"
                        value={`+${formatNumber(summary.in_qty)}`}
                        icon={ArrowUpRight}
                        variant="emerald"
                        subInfo={`${summary.in_count} dokumen disetujui`}
                        isLoading={isLoading}
                    />
                    <SummaryStatCard
                        title="Stok Keluar / Rusak / Hilang (-)"
                        value={`-${formatNumber(summary.out_qty)}`}
                        icon={ArrowDownRight}
                        variant="amber"
                        subInfo={`${summary.out_count} dokumen disetujui`}
                        isLoading={isLoading}
                    />
                    <SummaryStatCard
                        title="Total Nilai Kerugian (HPP)"
                        value={formatRupiah(summary.total_loss_value)}
                        icon={TrendingDown}
                        variant="rose"
                        subInfo="Beban non-kas persediaan"
                        isLoading={isLoading}
                    />
                </SummaryStatGrid>

                {/* Toolbar Search */}
                <StockAdjustmentSearch
                    filters={filters}
                    typeOptions={typeOptions}
                    reasonOptions={reasonOptions}
                    statusOptions={statusOptions}
                    isLoading={isLoading}
                />

                {/* DataTable */}
                <DataTable
                    columns={columns}
                    data={adjustments.data}
                    tableKey="stock-adjustments-table"
                    emptyMessage="Belum ada data penyesuaian stok."
                    isLoading={isLoading}
                />

                {/* Pagination */}
                <DataTablePagination
                    meta={adjustments}
                    routeUrl={(opts) => StockAdjustmentController.index(opts)}
                    isLoading={isLoading}
                />
            </div>

            <DialogAddStockAdjustment
                open={addOpen}
                onOpenChange={setAddOpen}
                typeOptions={typeOptions}
                reasonOptions={reasonOptions}
                canApprove={canApprove}
            />

            <DialogDetailStockAdjustment
                adjustment={detailItem}
                open={detailItem !== null}
                onOpenChange={(open) => {
                    if (!open) setDetailItem(null)
                }}
                canApprove={canApprove}
            />
        </AuthenticatedLayout>
    )
}

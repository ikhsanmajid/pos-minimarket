import React, { useEffect, useState } from 'react'
import { Link, router, usePage } from '@inertiajs/react'
import AuthenticatedLayout from '@/layouts/AuthenticatedLayout'
import { DataTable, type DataTableColumn } from '@/components/dataTable'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { SummaryStatCard, SummaryStatGrid } from '@/components/SummaryStatCard'
import { formatDateRangeLabel, formatNumber, formatPercent } from '@/lib/utils'
import type { PageProps } from '@/types'
import { useAuth } from '@/hooks/use-auth'
import { toast } from 'react-toastify'
import { Plus, Lock, ShieldAlert, ClipboardList, CheckCircle2, Clock, XCircle } from 'lucide-react'
import DataTablePagination, { type PaginationMeta } from '@/components/dataTablePagination'
import PurchaseOrderTableToolbar, { type PurchaseOrderFilters } from './component/PurchaseOrderSearch'
import { PurchaseOrderActionsCell } from './component/PurchaseOrderActionsCell'
import PurchaseOrderController from '@/actions/App/Http/Controllers/PurchaseOrderController'
import { DataTableSortHeader } from '@/components/dataTableSortHeader'
import {
    formatRupiah,
    poStatusBadgeConfig,
    receivingStatusBadgeConfig,
    paymentStatusBadgeConfig,
} from './component/purchaseOrderUtils'

export type PurchaseOrderRow = {
    id: number
    po_number: string
    supplier_id: number
    supplier_name: string
    creator_name: string
    approver_name: string | null
    order_date: string
    expected_date: string | null
    received_at: string | null
    due_date: string | null
    status: string
    status_label: string
    receiving_status: string
    receiving_status_label: string
    payment_status: string
    payment_status_label: string
    is_locked: boolean
    needs_approval: boolean
    items_count: number
    total_base_qty_ordered: number
    total_base_qty_received: number
    subtotal: string | number
    discount_amount: string | number
    tax_amount: string | number
    total_amount: string | number
    paid_amount: number
    remaining_amount: number
    can_edit: boolean
    can_delete: boolean
    can_cancel: boolean
    created_at?: string
}

interface PaginatedPurchaseOrders extends PaginationMeta {
    data: PurchaseOrderRow[]
}

type PurchaseOrderPageProps = PageProps<{
    purchaseOrders: PaginatedPurchaseOrders
    filters: PurchaseOrderFilters
    summary: {
        total_orders: number
        total_amount: number
        completed_orders: number
        in_progress_orders: number
        pending_approval_count: number
        rejected_or_cancelled_orders: number
        rejected_orders: number
        cancelled_orders: number
    }
    suppliers: { id: number; name: string; code: string | null; is_active: boolean }[]
    pendingApprovalCount: number
    statuses: { value: string; label: string }[]
    receivingStatuses: { value: string; label: string }[]
    paymentStatuses: { value: string; label: string }[]
}>

interface GetColumnsOptions {
    from: number | null
    filters: PurchaseOrderFilters
    onSort: (field: string) => void
}

const getColumns = ({ from, filters, onSort }: GetColumnsOptions): DataTableColumn<PurchaseOrderRow>[] => [
    {
        id: 'no',
        header: 'No',
        cell: (info) => (from ?? 1) + info.row.index,
        size: 55,
    },
    {
        accessorKey: 'po_number',
        header: () => (
            <DataTableSortHeader
                label="No. PO"
                field="po_number"
                tableSort={filters.table_sort}
                tableDirection={filters.table_direction}
                toolbarSort={filters.sort}
                toolbarDirection={filters.direction}
                onSort={onSort}
            />
        ),
        cell: (info) => {
            const po = info.row.original
            return (
                <div className="flex flex-col py-0.5 min-w-0">
                    <div className="flex items-center gap-1.5 min-w-0">
                        <Link
                            href={PurchaseOrderController.show.url(po.id)}
                            className="font-mono text-xs font-bold text-primary hover:underline truncate"
                        >
                            {po.po_number}
                        </Link>
                        {po.is_locked && (
                            <span title="PO Terkunci Permanen (Lunas & Diterima Penuh)">
                                <Lock className="h-3 w-3 text-emerald-600 dark:text-emerald-400 shrink-0" />
                            </span>
                        )}
                    </div>
                    <span className="text-[11px] text-muted-foreground font-mono truncate">
                        {po.order_date}
                    </span>
                </div>
            )
        },
        size: 185,
    },
    {
        accessorKey: 'supplier_name',
        header: 'Supplier',
        cell: (info) => {
            const po = info.row.original
            return (
                <div className="flex flex-col py-0.5 min-w-0">
                    <span className="font-medium text-foreground text-sm truncate">{po.supplier_name}</span>
                    <span className="text-[11px] text-muted-foreground truncate">
                        Oleh: {po.creator_name}
                    </span>
                </div>
            )
        },
        size: 210,
    },
    {
        accessorKey: 'status',
        header: () => (
            <DataTableSortHeader
                label="Status Dokumen"
                field="status"
                tableSort={filters.table_sort}
                tableDirection={filters.table_direction}
                toolbarSort={filters.sort}
                toolbarDirection={filters.direction}
                onSort={onSort}
            />
        ),
        cell: (info) => {
            const po = info.row.original
            const cfg = poStatusBadgeConfig[po.status] || { label: po.status_label, className: '' }
            return (
                <Badge variant="outline" className={`text-[11px] font-medium ${cfg.className}`}>
                    {cfg.label}
                </Badge>
            )
        },
        size: 165,
    },
    {
        accessorKey: 'receiving_status',
        header: () => (
            <DataTableSortHeader
                label="Penerimaan"
                field="receiving_status"
                tableSort={filters.table_sort}
                tableDirection={filters.table_direction}
                toolbarSort={filters.sort}
                toolbarDirection={filters.direction}
                onSort={onSort}
            />
        ),
        cell: (info) => {
            const po = info.row.original
            const cfg = receivingStatusBadgeConfig[po.receiving_status] || {
                label: po.receiving_status_label,
                className: '',
            }
            const ordered = Number(po.total_base_qty_ordered) || 0
            const received = Number(po.total_base_qty_received) || 0
            const percent = ordered > 0 ? Math.min(100, Math.round((received / ordered) * 100)) : 0

            return (
                <div className="flex flex-col gap-1 py-0.5">
                    <Badge variant="outline" className={`text-[10px] w-fit font-medium ${cfg.className}`}>
                        {cfg.label}
                    </Badge>
                    <div className="flex items-center gap-1.5">
                        <div className="h-1.5 flex-1 bg-muted rounded-full overflow-hidden">
                            <div
                                className={`h-full ${
                                    percent >= 100
                                        ? 'bg-emerald-500'
                                        : percent > 0
                                        ? 'bg-amber-500'
                                        : 'bg-muted-foreground/30'
                                }`}
                                style={{ width: `${percent}%` }}
                            />
                        </div>
                        <span className="font-mono text-[10px] text-muted-foreground">{percent}%</span>
                    </div>
                </div>
            )
        },
        size: 165,
    },
    {
        accessorKey: 'payment_status',
        header: () => (
            <DataTableSortHeader
                label="Pembayaran"
                field="payment_status"
                tableSort={filters.table_sort}
                tableDirection={filters.table_direction}
                toolbarSort={filters.sort}
                toolbarDirection={filters.direction}
                onSort={onSort}
            />
        ),
        cell: (info) => {
            const po = info.row.original
            const cfg = paymentStatusBadgeConfig[po.payment_status] || {
                label: po.payment_status_label,
                className: '',
            }
            return (
                <Badge variant="outline" className={`text-[11px] font-medium ${cfg.className}`}>
                    {cfg.label}
                </Badge>
            )
        },
        size: 145,
    },
    {
        accessorKey: 'total_amount',
        header: () => (
            <DataTableSortHeader
                label="Total Nilai"
                field="total_amount"
                tableSort={filters.table_sort}
                tableDirection={filters.table_direction}
                toolbarSort={filters.sort}
                toolbarDirection={filters.direction}
                onSort={onSort}
            />
        ),
        cell: (info) => (
            <span className="font-mono text-xs font-semibold text-foreground">
                {formatRupiah(info.getValue<number | string>())}
            </span>
        ),
        size: 150,
    },
    {
        id: 'actions',
        header: () => <span className="text-right block w-full pr-2">Aksi</span>,
        cell: (info) => (
            <div className="flex justify-end pr-2">
                <PurchaseOrderActionsCell po={info.row.original} />
            </div>
        ),
        size: 70,
    },
]

type PurchaseOrderComponent = React.FC & {
    layout?: (page: React.ReactNode) => React.ReactNode
}

const PurchaseOrderPage: PurchaseOrderComponent = () => {
    const {
        purchaseOrders,
        filters,
        summary,
        suppliers = [],
        pendingApprovalCount = 0,
        statuses = [],
        receivingStatuses = [],
        paymentStatuses = [],
    } = usePage<PurchaseOrderPageProps>().props
    const { flash, user } = useAuth()
    const [isLoading, setIsLoading] = useState(false)

    const userRole = (user?.role as string) || ''
    const canCreate = ['admin', 'supervisor', 'warehouse'].includes(userRole)
    const isAdmin = userRole === 'admin'

    const handleSort = (field: string) => {
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
            PurchaseOrderController.index({
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

    const handleFilterPendingApproval = () => {
        router.visit(
            PurchaseOrderController.index({
                mergeQuery: {
                    status: 'pending_approval',
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

    const columns = React.useMemo(
        () =>
            getColumns({
                from: purchaseOrders.from,
                filters,
                onSort: handleSort,
            }),
        [
            purchaseOrders.from,
            filters.table_sort,
            filters.table_direction,
            filters.sort,
            filters.direction,
        ]
    )

    useEffect(() => {
        if (flash?.success) {
            toast.success(flash.success)
        }
        if (flash?.error) {
            toast.error(flash.error)
        }
    }, [flash?.success, flash?.error])

    useEffect(() => {
        const removeStart = router.on('start', () => setIsLoading(true))
        const removeFinish = router.on('finish', () => setIsLoading(false))

        return () => {
            removeStart()
            removeFinish()
        }
    }, [])

    return (
        <div className="w-full min-w-0 space-y-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Purchase Orders</h1>
                    <p className="text-sm text-muted-foreground">
                        Kelola pesanan pembelian Multi-UOM, persetujuan Admin, penerimaan LPB, dan pelunasan hutang.
                    </p>
                </div>
                {canCreate && (
                    <Button
                        render={
                            <Link href={PurchaseOrderController.create.url()} className="flex items-center gap-1.5">
                                <Plus className="h-4 w-4" />
                                <span>Buat PO Baru</span>
                            </Link>
                        }
                    />
                )}
            </div>

            <SummaryStatGrid>
                <SummaryStatCard
                    title="Total Purchase Order"
                    value={formatNumber(summary.total_orders)}
                    icon={ClipboardList}
                    variant="blue"
                    subInfo={`Nilai total: ${formatRupiah(summary.total_amount)}`}
                    periodLabel={formatDateRangeLabel(filters.start_date, filters.end_date, 'Semua Data')}
                    isActive={!filters.status && !filters.receiving_status}
                    onClick={() => {
                        router.visit(
                            PurchaseOrderController.index({
                                mergeQuery: { status: undefined, receiving_status: undefined, page: 1 },
                            }),
                            { preserveState: true, preserveScroll: true, replace: true }
                        )
                    }}
                />
                <SummaryStatCard
                    title="PO Diterima Penuh"
                    value={formatNumber(summary.completed_orders)}
                    icon={CheckCircle2}
                    variant="emerald"
                    subInfo={`${formatPercent(summary.completed_orders, summary.total_orders)} penyelesaian`}
                    periodLabel={formatDateRangeLabel(filters.start_date, filters.end_date, 'Selesai')}
                    isActive={filters.receiving_status === 'received'}
                    onClick={() => {
                        const next = filters.receiving_status === 'received' ? undefined : 'received'
                        router.visit(
                            PurchaseOrderController.index({
                                mergeQuery: { receiving_status: next, status: undefined, page: 1 },
                            }),
                            { preserveState: true, preserveScroll: true, replace: true }
                        )
                    }}
                />
                <SummaryStatCard
                    title="Menunggu ACC / Proses"
                    value={formatNumber(summary.in_progress_orders)}
                    icon={Clock}
                    variant="amber"
                    subInfo={`${formatNumber(summary.pending_approval_count)} menunggu approval Admin`}
                    periodLabel={formatDateRangeLabel(filters.start_date, filters.end_date, 'Berjalan')}
                    isActive={filters.status === 'pending_approval'}
                    onClick={() => {
                        const next = filters.status === 'pending_approval' ? undefined : 'pending_approval'
                        router.visit(
                            PurchaseOrderController.index({
                                mergeQuery: { status: next, receiving_status: undefined, page: 1 },
                            }),
                            { preserveState: true, preserveScroll: true, replace: true }
                        )
                    }}
                />
                <SummaryStatCard
                    title="Ditolak / Dibatalkan"
                    value={formatNumber(summary.rejected_or_cancelled_orders)}
                    icon={XCircle}
                    variant="rose"
                    subInfo={`${formatNumber(summary.rejected_orders)} ditolak • ${formatNumber(summary.cancelled_orders)} dibatalkan`}
                    periodLabel={formatDateRangeLabel(filters.start_date, filters.end_date, 'Batal/Tolak')}
                    isActive={filters.status === 'rejected'}
                    onClick={() => {
                        const next = filters.status === 'rejected' ? undefined : 'rejected'
                        router.visit(
                            PurchaseOrderController.index({
                                mergeQuery: { status: next, receiving_status: undefined, page: 1 },
                            }),
                            { preserveState: true, preserveScroll: true, replace: true }
                        )
                    }}
                />
            </SummaryStatGrid>

            {pendingApprovalCount > 0 && (
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-lg border border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/40 px-4 py-3 text-xs">
                    <div className="flex items-center gap-2.5 text-amber-900 dark:text-amber-200">
                        <ShieldAlert className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
                        <span>
                            Terdapat <strong>{pendingApprovalCount} Purchase Order</strong> yang sedang menunggu persetujuan Admin
                            {isAdmin ? '. Silakan tinjau dan setujui/tolak agar gudang dapat memproses penerimaan.' : '.'}
                        </span>
                    </div>
                    {filters.status !== 'pending_approval' && (
                        <Button
                            type="button"
                            variant="outline"
                            size="xs"
                            onClick={handleFilterPendingApproval}
                            className="border-amber-400 text-amber-800 hover:bg-amber-100 dark:border-amber-700 dark:text-amber-200 shrink-0"
                        >
                            Filter Menunggu ACC
                        </Button>
                    )}
                </div>
            )}

            <PurchaseOrderTableToolbar
                filters={filters}
                suppliers={suppliers}
                statuses={statuses}
                receivingStatuses={receivingStatuses}
                paymentStatuses={paymentStatuses}
                routeUrl={PurchaseOrderController.index}
                isLoading={isLoading}
            />

            <DataTable
                columns={columns}
                data={purchaseOrders.data ?? []}
                tableKey="purchase-orders-table"
                emptyMessage="Tidak ada data Purchase Order ditemukan."
                isLoading={isLoading}
            />

            <DataTablePagination
                meta={purchaseOrders}
                routeUrl={PurchaseOrderController.index}
                isLoading={isLoading}
            />
        </div>
    )
}

PurchaseOrderPage.layout = (page: React.ReactNode) => (
    <AuthenticatedLayout>{page}</AuthenticatedLayout>
)

export default PurchaseOrderPage

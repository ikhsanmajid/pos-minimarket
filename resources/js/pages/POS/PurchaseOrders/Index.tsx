import React, { useEffect, useState } from 'react'
import { Link, router, usePage } from '@inertiajs/react'
import AuthenticatedLayout from '@/layouts/AuthenticatedLayout'
import { DataTable, type DataTableColumn } from '@/components/dataTable'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { PageProps } from '@/types'
import { useAuth } from '@/hooks/use-auth'
import { toast } from 'react-toastify'
import { Plus, ShoppingBag } from 'lucide-react'
import DataTablePagination, { type PaginationMeta } from '@/components/dataTablePagination'
import PurchaseOrderTableToolbar, { type PurchaseOrderFilters } from './component/PurchaseOrderSearch'
import { PurchaseOrderActionsCell } from './component/PurchaseOrderActionsCell'
import PurchaseOrderController from '@/actions/App/Http/Controllers/PurchaseOrderController'
import { DataTableSortHeader } from '@/components/dataTableSortHeader'

export type PurchaseOrderRow = {
    id: number
    po_number: string
    supplier_id: number
    supplier_name: string
    creator_name: string
    order_date: string
    expected_date: string | null
    received_at: string | null
    due_date: string | null
    status: string
    status_label: string
    payment_status: string
    payment_status_label: string
    items_count: number
    total_quantity_ordered: number
    total_quantity_received: number
    subtotal: string | number
    discount_amount: string | number
    tax_amount: string | number
    total_amount: string | number
    created_at?: string
}

interface PaginatedPurchaseOrders extends PaginationMeta {
    data: PurchaseOrderRow[]
}

type PurchaseOrderPageProps = PageProps<{
    purchaseOrders: PaginatedPurchaseOrders
    filters: PurchaseOrderFilters
    suppliers: { id: number; name: string; code: string | null; is_active: boolean }[]
    statuses: { value: string; label: string }[]
    paymentStatuses: { value: string; label: string }[]
}>

const formatRupiah = (val: number | string) => {
    const num = Number(val) || 0
    return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0,
    }).format(num)
}

const statusBadgeConfig: Record<string, { label: string; className: string }> = {
    draft: {
        label: 'Draft',
        className: 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300 border-slate-300 dark:border-slate-700',
    },
    ordered: {
        label: 'Dipesan',
        className: 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 border-blue-200 dark:border-blue-800',
    },
    partially_received: {
        label: 'Diterima Sebagian',
        className: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border-amber-200 dark:border-amber-800',
    },
    received: {
        label: 'Selesai',
        className: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
    },
    cancelled: {
        label: 'Dibatalkan',
        className: 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 border-rose-200 dark:border-rose-800',
    },
}

const paymentBadgeConfig: Record<string, { label: string; className: string }> = {
    unpaid: {
        label: 'Belum Dibayar',
        className: 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400 border-rose-200 dark:border-rose-900',
    },
    partial: {
        label: 'Dibayar Sebagian',
        className: 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400 border-amber-200 dark:border-amber-900',
    },
    paid: {
        label: 'Lunas',
        className: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900',
    },
}

interface GetColumnsOptions {
    from: number | null
    canEdit: boolean
    canDelete: boolean
    canCancel: boolean
    filters: PurchaseOrderFilters
    onSort: (field: string) => void
}

const getColumns = ({
    from,
    canEdit,
    canDelete,
    canCancel,
    filters,
    onSort,
}: GetColumnsOptions): DataTableColumn<PurchaseOrderRow>[] => [
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
                    <Link
                        href={PurchaseOrderController.show.url(po.id)}
                        className="font-mono text-xs font-bold text-primary hover:underline truncate"
                    >
                        {po.po_number}
                    </Link>
                    <span className="text-[11px] text-muted-foreground font-mono">
                        {po.order_date}
                    </span>
                </div>
            )
        },
        size: 175,
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
                        Dibuat: {po.creator_name}
                    </span>
                </div>
            )
        },
        size: 220,
    },
    {
        accessorKey: 'status',
        header: 'Status PO',
        cell: (info) => {
            const status = info.getValue<string>()
            const cfg = statusBadgeConfig[status] || {
                label: status,
                className: '',
            }
            return (
                <Badge variant="outline" className={`text-[11px] font-medium ${cfg.className}`}>
                    {cfg.label}
                </Badge>
            )
        },
        size: 150,
    },
    {
        accessorKey: 'payment_status',
        header: 'Pembayaran',
        cell: (info) => {
            const pStatus = info.getValue<string>()
            const cfg = paymentBadgeConfig[pStatus] || {
                label: pStatus,
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
        id: 'progress',
        header: 'Progres Penerimaan',
        cell: (info) => {
            const po = info.row.original
            const ordered = Number(po.total_quantity_ordered) || 0
            const received = Number(po.total_quantity_received) || 0
            const percent = ordered > 0 ? Math.min(100, Math.round((received / ordered) * 100)) : 0

            return (
                <div className="flex flex-col py-0.5 gap-1">
                    <div className="flex items-center justify-between text-[11px] font-mono">
                        <span>{received} / {ordered} unit</span>
                        <span className="font-semibold text-muted-foreground">{percent}%</span>
                    </div>
                    <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                        <div
                            className={`h-full transition-all duration-300 ${
                                percent >= 100
                                    ? 'bg-emerald-500'
                                    : percent > 0
                                    ? 'bg-amber-500'
                                    : 'bg-muted-foreground/30'
                            }`}
                            style={{ width: `${percent}%` }}
                        />
                    </div>
                </div>
            )
        },
        size: 170,
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
            <span className="font-mono text-xs font-bold text-foreground">
                {formatRupiah(info.getValue<number | string>())}
            </span>
        ),
        size: 155,
    },
    {
        id: 'actions',
        header: () => <span className="text-right block w-full pr-2">Aksi</span>,
        cell: (info) => (
            <div className="flex justify-end pr-2">
                <PurchaseOrderActionsCell
                    po={info.row.original}
                    canEdit={canEdit}
                    canDelete={canDelete}
                    canCancel={canCancel}
                />
            </div>
        ),
        size: 70,
    },
]

type PurchaseOrderComponent = React.FC & {
    layout?: (page: React.ReactNode) => React.ReactNode
}

const PurchaseOrdersIndex: PurchaseOrderComponent = () => {
    const {
        purchaseOrders,
        filters,
        suppliers = [],
        statuses = [],
        paymentStatuses = [],
    } = usePage<PurchaseOrderPageProps>().props
    const { flash, user } = useAuth()
    const [isLoading, setIsLoading] = useState(false)

    const userRole = (user?.role as string) || ''
    const canCreate = ['admin', 'supervisor', 'warehouse'].includes(userRole)
    const canEdit = ['admin', 'supervisor', 'warehouse'].includes(userRole)
    const canDelete = ['admin', 'supervisor'].includes(userRole)
    const canCancel = ['admin', 'supervisor'].includes(userRole)

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

    const columns = React.useMemo(
        () =>
            getColumns({
                from: purchaseOrders.from,
                canEdit,
                canDelete,
                canCancel,
                filters,
                onSort: handleSort,
            }),
        [
            purchaseOrders.from,
            canEdit,
            canDelete,
            canCancel,
            filters.table_sort,
            filters.table_direction,
            filters.sort,
            filters.direction,
        ]
    )

    useEffect(() => {
        if (flash.success) {
            toast.success(flash.success)
        }
    }, [flash.success])

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
                        Kelola pesanan pembelian ke supplier, penerimaan bertahap, dan harga beli rata-rata tertimbang.
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

            <PurchaseOrderTableToolbar
                filters={filters}
                suppliers={suppliers}
                statuses={statuses}
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

PurchaseOrdersIndex.layout = (page: React.ReactNode) => (
    <AuthenticatedLayout>{page}</AuthenticatedLayout>
)

export default PurchaseOrdersIndex

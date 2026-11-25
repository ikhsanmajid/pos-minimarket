import React, { useEffect, useState } from 'react'
import { Link, router, usePage } from '@inertiajs/react'
import AuthenticatedLayout from '@/layouts/AuthenticatedLayout'
import { DataTable, type DataTableColumn } from '@/components/dataTable'
import { Badge } from '@/components/ui/badge'
import type { PageProps } from '@/types'
import { useAuth } from '@/hooks/use-auth'
import { toast } from 'react-toastify'
import { MapPin, Phone, Building2 } from 'lucide-react'
import DataTablePagination, { type PaginationMeta } from '@/components/dataTablePagination'
import SupplierTableToolbar, { type SupplierFilters } from './component/SupplierSearch'
import { DialogAddSupplier } from './component/DialogAddSupplier'
import { SupplierActionsCell } from './component/SupplierActionsCell'
import SupplierController from '@/actions/App/Http/Controllers/SupplierController'
import { DataTableSortHeader } from '@/components/dataTableSortHeader'

export type SupplierRow = {
    id: number
    code: string | null
    name: string
    contact_person: string | null
    phone: string
    email: string | null
    address: string | null
    city: string | null
    npwp: string | null
    payment_term_days: number
    bank_name: string | null
    bank_account_number: string | null
    bank_account_name: string | null
    is_active: boolean
    notes: string | null
    purchase_orders_count: number
    created_at?: string
    updated_at?: string
}

interface PaginatedSuppliers extends PaginationMeta {
    data: SupplierRow[]
}

type SupplierPageProps = PageProps<{
    suppliers: PaginatedSuppliers
    filters: SupplierFilters
}>

function getColumns({
    from = 1,
    canEdit,
    canDelete,
    filters,
    onSort,
}: {
    from?: number
    canEdit: boolean
    canDelete: boolean
    filters: SupplierFilters
    onSort: (field: string) => void
}): DataTableColumn<SupplierRow>[] {
    const cols: DataTableColumn<SupplierRow>[] = [
        {
            id: 'no',
            header: 'No',
            cell: ({ row }) => (from ?? 1) + row.index,
            size: 55,
        },
        {
            id: 'code',
            accessorKey: 'code',
            header: () => (
                <DataTableSortHeader
                    label="Kode"
                    field="code"
                    tableSort={filters.table_sort}
                    tableDirection={filters.table_direction}
                    toolbarSort={filters.sort}
                    toolbarDirection={filters.direction}
                    onSort={onSort}
                />
            ),
            cell: ({ row }) => {
                const sup = row.original
                return (
                    <Link
                        href={SupplierController.show.url(sup.id)}
                        className="font-mono text-xs font-semibold text-primary hover:underline inline-flex items-center gap-1"
                    >
                        {sup.code || '-'}
                    </Link>
                )
            },
            size: 115,
        },
        {
            id: 'name',
            accessorKey: 'name',
            header: () => (
                <DataTableSortHeader
                    label="Nama Supplier"
                    field="name"
                    tableSort={filters.table_sort}
                    tableDirection={filters.table_direction}
                    toolbarSort={filters.sort}
                    toolbarDirection={filters.direction}
                    onSort={onSort}
                />
            ),
            cell: ({ row }) => {
                const sup = row.original
                return (
                    <div className="space-y-0.5 min-w-0">
                        <Link
                            href={SupplierController.show.url(sup.id)}
                            className="font-semibold text-sm text-foreground hover:text-primary transition-colors hover:underline block truncate"
                        >
                            {sup.name}
                        </Link>
                        {sup.city && (
                            <div className="flex items-center gap-1 text-[11px] text-muted-foreground min-w-0">
                                <MapPin className="h-3 w-3 shrink-0" />
                                <span className="truncate">{sup.city}</span>
                            </div>
                        )}
                    </div>
                )
            },
            size: 220,
        },
        {
            id: 'contact',
            header: 'Kontak PIC & Telepon',
            cell: ({ row }) => {
                const sup = row.original
                return (
                    <div className="space-y-0.5 text-xs min-w-0">
                        <div className="font-medium text-foreground truncate">
                            {sup.contact_person || '-'}
                        </div>
                        <div className="flex items-center gap-1 text-[11px] text-muted-foreground font-mono">
                            <Phone className="h-3 w-3 shrink-0" />
                            <span className="truncate">{sup.phone}</span>
                        </div>
                    </div>
                )
            },
            size: 190,
        },
        {
            id: 'payment_term_days',
            accessorKey: 'payment_term_days',
            header: () => (
                <DataTableSortHeader
                    label="Tempo Bayar"
                    field="payment_term_days"
                    tableSort={filters.table_sort}
                    tableDirection={filters.table_direction}
                    toolbarSort={filters.sort}
                    toolbarDirection={filters.direction}
                    onSort={onSort}
                />
            ),
            cell: ({ row }) => {
                const days = row.original.payment_term_days
                return (
                    <div className="text-xs">
                        {days > 0 ? (
                            <span className="font-semibold text-foreground font-mono">{days} Hari</span>
                        ) : (
                            <span className="text-muted-foreground italic">COD / Tunai</span>
                        )}
                    </div>
                )
            },
            size: 135,
        },
        {
            id: 'purchase_orders_count',
            accessorKey: 'purchase_orders_count',
            header: () => (
                <DataTableSortHeader
                    label="Jumlah PO"
                    field="purchase_orders_count"
                    tableSort={filters.table_sort}
                    tableDirection={filters.table_direction}
                    toolbarSort={filters.sort}
                    toolbarDirection={filters.direction}
                    onSort={onSort}
                />
            ),
            cell: ({ row }) => {
                const count = row.original.purchase_orders_count
                return (
                    <Badge variant="secondary" className="font-mono text-xs">
                        {count} PO
                    </Badge>
                )
            },
            size: 135,
        },
        {
            id: 'is_active',
            accessorKey: 'is_active',
            header: () => (
                <DataTableSortHeader
                    label="Status"
                    field="is_active"
                    tableSort={filters.table_sort}
                    tableDirection={filters.table_direction}
                    toolbarSort={filters.sort}
                    toolbarDirection={filters.direction}
                    onSort={onSort}
                />
            ),
            cell: ({ row }) => {
                const isActive = row.original.is_active
                return isActive ? (
                    <Badge variant="success">Aktif</Badge>
                ) : (
                    <Badge variant="secondary">Nonaktif</Badge>
                )
            },
            size: 125,
        },
    ]

    if (canEdit || canDelete) {
        cols.push({
            id: 'actions',
            header: () => <span className="text-right block w-full pr-2">Aksi</span>,
            cell: ({ row }) => (
                <div className="flex justify-end pr-2">
                    <SupplierActionsCell
                        supplier={row.original}
                        canEdit={canEdit}
                        canDelete={canDelete}
                        detailUrl={SupplierController.show.url(row.original.id)}
                    />
                </div>
            ),
            size: 70,
        })
    }

    return cols
}

export function Supplier() {
    const { suppliers, filters } = usePage<SupplierPageProps>().props
    const { user, flash } = useAuth()
    const [isLoading, setIsLoading] = useState(false)

    const userRole = (user?.role as string) || ''
    const canCreate = ['admin', 'supervisor', 'warehouse'].includes(userRole)
    const canEdit = ['admin', 'supervisor', 'warehouse'].includes(userRole)
    const canDelete = ['admin', 'supervisor'].includes(userRole)

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
            SupplierController.index({
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
                from: suppliers.from ?? 1,
                canEdit,
                canDelete,
                filters,
                onSort: handleSort,
            }),
        [
            suppliers.from,
            canEdit,
            canDelete,
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
    }, [flash?.success])

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
                    <h1 className="text-2xl font-bold tracking-tight">Suppliers</h1>
                    <p className="text-sm text-muted-foreground">
                        Daftar seluruh mitra pemasok dan ketentuan tempo pembayaran.
                    </p>
                </div>
                {canCreate && (
                    <DialogAddSupplier storeUrl={SupplierController.store.url()} />
                )}
            </div>

            <SupplierTableToolbar
                filters={filters}
                routeUrl={SupplierController.index}
                isLoading={isLoading}
            />

            <DataTable
                columns={columns}
                data={suppliers.data ?? []}
                tableKey="suppliers-table"
                emptyMessage="Tidak ada data supplier ditemukan."
                isLoading={isLoading}
            />

            <DataTablePagination
                meta={suppliers}
                routeUrl={SupplierController.index}
                isLoading={isLoading}
            />
        </div>
    )
}

Supplier.layout = (page: React.ReactNode) => (
    <AuthenticatedLayout>{page}</AuthenticatedLayout>
)

export default Supplier

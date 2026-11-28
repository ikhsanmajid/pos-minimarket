import React, { useEffect, useState } from 'react'
import { Link, router, usePage } from '@inertiajs/react'
import AuthenticatedLayout from '@/layouts/AuthenticatedLayout'
import { DataTable, type DataTableColumn } from '@/components/dataTable'
import DataTablePagination, { type PaginationMeta } from '@/components/dataTablePagination'
import { DataTableSortHeader } from '@/components/dataTableSortHeader'
import { Badge } from '@/components/ui/badge'
import { SummaryStatCard, SummaryStatGrid } from '@/components/SummaryStatCard'
import { formatNumber, formatPercent } from '@/lib/utils'
import type { PageProps } from '@/types'
import { useAuth } from '@/hooks/use-auth'
import { toast } from 'react-toastify'
import { Award, CheckCircle2, Mail, Phone, UserCheck, UserPlus, Users } from 'lucide-react'
import CustomerController from '@/actions/App/Http/Controllers/CustomerController'
import CustomerTableToolbar, { type CustomerFilters } from './component/CustomerSearch'
import { DialogAddCustomer } from './component/DialogAddCustomer'
import { CustomerActionsCell } from './component/CustomerActionsCell'

export type CustomerRow = {
    id: number
    member_code: string
    name: string
    phone: string | null
    email: string | null
    address: string | null
    points: number
    is_active: boolean
    notes: string | null
    transactions_count: number
    created_at?: string | null
    updated_at?: string | null
}

interface PaginatedCustomers extends PaginationMeta {
    data: CustomerRow[]
}

type CustomerPageProps = PageProps<{
    customers: PaginatedCustomers
    filters: CustomerFilters
    summary: {
        total_customers: number
        active_customers: number
        inactive_customers: number
        new_this_month: number
        transacted_customers: number
        total_active_points: number
    }
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
    filters: CustomerFilters
    onSort: (field: string) => void
}): DataTableColumn<CustomerRow>[] {
    return [
        {
            id: 'no',
            header: 'No',
            cell: ({ row }) => (from ?? 1) + row.index,
            size: 55,
        },
        {
            id: 'member_code',
            accessorKey: 'member_code',
            header: () => (
                <DataTableSortHeader
                    label="Kode Member"
                    field="member_code"
                    tableSort={filters.table_sort}
                    tableDirection={filters.table_direction}
                    toolbarSort={filters.sort}
                    toolbarDirection={filters.direction}
                    onSort={onSort}
                />
            ),
            cell: ({ row }) => {
                const cust = row.original
                return (
                    <Link
                        href={CustomerController.show.url(cust.id)}
                        className="font-mono text-xs font-semibold text-primary hover:underline inline-flex items-center gap-1 truncate"
                    >
                        {cust.member_code}
                    </Link>
                )
            },
            size: 165,
        },
        {
            id: 'name',
            accessorKey: 'name',
            header: () => (
                <DataTableSortHeader
                    label="Nama Pelanggan"
                    field="name"
                    tableSort={filters.table_sort}
                    tableDirection={filters.table_direction}
                    toolbarSort={filters.sort}
                    toolbarDirection={filters.direction}
                    onSort={onSort}
                />
            ),
            cell: ({ row }) => {
                const cust = row.original
                return (
                    <div className="space-y-0.5 min-w-0">
                        <Link
                            href={CustomerController.show.url(cust.id)}
                            className="font-semibold text-sm text-foreground hover:text-primary transition-colors hover:underline block truncate"
                        >
                            {cust.name}
                        </Link>
                        {cust.email && (
                            <div className="flex items-center gap-1 text-[11px] text-muted-foreground min-w-0">
                                <Mail className="h-3 w-3 shrink-0" />
                                <span className="truncate">{cust.email}</span>
                            </div>
                        )}
                    </div>
                )
            },
            size: 220,
        },
        {
            id: 'phone',
            accessorKey: 'phone',
            header: () => (
                <DataTableSortHeader
                    label="No. HP"
                    field="phone"
                    tableSort={filters.table_sort}
                    tableDirection={filters.table_direction}
                    toolbarSort={filters.sort}
                    toolbarDirection={filters.direction}
                    onSort={onSort}
                />
            ),
            cell: ({ row }) => {
                const phone = row.original.phone
                return phone ? (
                    <div className="flex items-center gap-1.5 font-mono text-xs text-foreground">
                        <Phone className="h-3 w-3 text-muted-foreground shrink-0" />
                        <span className="truncate">{phone}</span>
                    </div>
                ) : (
                    <span className="text-xs text-muted-foreground">-</span>
                )
            },
            size: 155,
        },
        {
            id: 'points',
            accessorKey: 'points',
            header: () => (
                <DataTableSortHeader
                    label="Poin"
                    field="points"
                    tableSort={filters.table_sort}
                    tableDirection={filters.table_direction}
                    toolbarSort={filters.sort}
                    toolbarDirection={filters.direction}
                    onSort={onSort}
                />
            ),
            cell: ({ row }) => (
                <Badge
                    variant="outline"
                    className="font-mono text-xs gap-1 bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800"
                >
                    <Award className="h-3 w-3" />
                    {formatNumber(row.original.points)}
                </Badge>
            ),
            size: 115,
        },
        {
            id: 'transactions_count',
            accessorKey: 'transactions_count',
            header: () => (
                <DataTableSortHeader
                    label="Transaksi"
                    field="transactions_count"
                    tableSort={filters.table_sort}
                    tableDirection={filters.table_direction}
                    toolbarSort={filters.sort}
                    toolbarDirection={filters.direction}
                    onSort={onSort}
                />
            ),
            cell: ({ row }) => (
                <Badge variant="secondary" className="font-mono text-xs">
                    {formatNumber(row.original.transactions_count)} Struk
                </Badge>
            ),
            size: 120,
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
            cell: ({ row }) =>
                row.original.is_active ? (
                    <Badge variant="success">Aktif</Badge>
                ) : (
                    <Badge variant="secondary">Nonaktif</Badge>
                ),
            size: 110,
        },
        {
            id: 'actions',
            header: () => <span className="text-right block w-full pr-2">Aksi</span>,
            cell: ({ row }) => (
                <div className="flex justify-end pr-2">
                    <CustomerActionsCell
                        customer={row.original}
                        canEdit={canEdit}
                        canDelete={canDelete}
                        detailUrl={CustomerController.show.url(row.original.id)}
                    />
                </div>
            ),
            size: 70,
        },
    ]
}

export function Customer() {
    const { customers, filters, summary } = usePage<CustomerPageProps>().props
    const { user, flash } = useAuth()
    const [isLoading, setIsLoading] = useState(false)

    const userRole = (user?.role as string) || ''
    const canCreate = ['admin', 'supervisor', 'cashier'].includes(userRole)
    const canEdit = ['admin', 'supervisor', 'cashier'].includes(userRole)
    const canDelete = ['admin', 'supervisor'].includes(userRole)

    const handleFilterStatus = (status?: string) => {
        const nextStatus = status && filters.status === status ? undefined : status
        router.visit(
            CustomerController.index({
                mergeQuery: {
                    status: nextStatus,
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
            CustomerController.index({
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
                from: customers.from ?? 1,
                canEdit,
                canDelete,
                filters,
                onSort: handleSort,
            }),
        [
            customers.from,
            canEdit,
            canDelete,
            filters.table_sort,
            filters.table_direction,
            filters.sort,
            filters.direction,
        ]
    )

    useEffect(() => {
        if (flash?.success) toast.success(flash.success)
        if (flash?.error) toast.error(flash.error)
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
                    <h1 className="text-2xl font-bold tracking-tight">Pelanggan / Member</h1>
                    <p className="text-sm text-muted-foreground">
                        Kelola data member toko, saldo poin, dan riwayat belanja pelanggan.
                    </p>
                </div>
                {canCreate && <DialogAddCustomer storeUrl={CustomerController.store.url()} />}
            </div>

            <SummaryStatGrid>
                <SummaryStatCard
                    title="Total Pelanggan"
                    value={formatNumber(summary.total_customers)}
                    icon={Users}
                    variant="blue"
                    subInfo={`${formatNumber(summary.inactive_customers)} nonaktif`}
                    periodLabel="Semua Data"
                    isActive={!filters.status || filters.status === 'all'}
                    onClick={() => handleFilterStatus(undefined)}
                />
                <SummaryStatCard
                    title="Pelanggan Aktif"
                    value={formatNumber(summary.active_customers)}
                    icon={CheckCircle2}
                    variant="emerald"
                    subInfo={`${formatPercent(summary.active_customers, summary.total_customers)} aktif di kasir`}
                    periodLabel="Aktif"
                    isActive={filters.status === 'active'}
                    onClick={() => handleFilterStatus('active')}
                />
                <SummaryStatCard
                    title="Pelanggan Baru"
                    value={formatNumber(summary.new_this_month)}
                    icon={UserPlus}
                    variant="amber"
                    subInfo="Pendaftar bulan berjalan"
                    periodLabel="Bulan Ini"
                />
                <SummaryStatCard
                    title="Pernah Bertransaksi"
                    value={formatNumber(summary.transacted_customers)}
                    icon={UserCheck}
                    variant="rose"
                    subInfo={`Total ${formatNumber(summary.total_active_points)} poin aktif`}
                    periodLabel="Loyalitas"
                />
            </SummaryStatGrid>

            <CustomerTableToolbar
                filters={filters}
                routeUrl={CustomerController.index}
                isLoading={isLoading}
            />

            <DataTable
                columns={columns}
                data={customers.data ?? []}
                tableKey="customers-table"
                emptyMessage="Tidak ada data pelanggan ditemukan."
                isLoading={isLoading}
            />

            <DataTablePagination
                meta={customers}
                routeUrl={CustomerController.index}
                isLoading={isLoading}
            />
        </div>
    )
}

Customer.layout = (page: React.ReactNode) => (
    <AuthenticatedLayout>{page}</AuthenticatedLayout>
)

export default Customer

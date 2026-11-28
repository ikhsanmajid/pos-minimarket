import React, { useEffect, useState } from 'react'
import { router, usePage } from '@inertiajs/react'
import AuthenticatedLayout from '@/layouts/AuthenticatedLayout'
import { DataTable, type DataTableColumn } from '@/components/dataTable'
import { Badge } from '@/components/ui/badge'
import { SummaryStatCard, SummaryStatGrid } from '@/components/SummaryStatCard'
import { formatNumber, formatPercent } from '@/lib/utils'
import { ShieldCheck, UserCheck, Users as UsersIcon, UserX } from 'lucide-react'
import type { PageProps } from '@/types'
import { useAuth } from '@/hooks/use-auth'
import { toast } from 'react-toastify'
import UserTableToolbar, { type UserFilters } from './component/UserSearch'
import { index, store, show, destroy } from '@/actions/App/Http/Controllers/UserController'
import DataTablePagination, { type PaginationMeta } from '@/components/dataTablePagination'
import { DialogAddUser } from './component/DialogAddUser'
import { UserActionsCell } from './component/UserActionsCell'
import { DataTableSortHeader } from '@/components/dataTableSortHeader'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type UserRow = {
    id: number
    name: string
    email: string
    phone: string | null
    role: string
    role_name: string
    is_active: boolean
    has_pin: boolean
    last_login_at: string | null
    created_at: string
}

export type RoleOption = {
    value: string
    label: string
}

interface PaginatedUsers extends PaginationMeta {
    data: UserRow[]
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export const roleBadgeClass: Record<string, string> = {
    admin: 'bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300',
    cashier: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300',
    warehouse: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
    supervisor: 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300',
}

// ---------------------------------------------------------------------------
// Columns
// ---------------------------------------------------------------------------

interface GetColumnsOptions {
    from: number | null
    currentUserId: number
    roles: RoleOption[]
    filters: UserFilters
    onSort: (field: string) => void
}

const getColumns = ({ from, currentUserId, roles, filters, onSort }: GetColumnsOptions): DataTableColumn<UserRow>[] => [
    {
        id: 'no',
        header: 'No',
        cell: (info) => (from ?? 1) + info.row.index,
        size: 55,
    },
    {
        accessorKey: 'name',
        header: () => (
            <DataTableSortHeader
                label="Pengguna"
                field="name"
                tableSort={filters.table_sort}
                tableDirection={filters.table_direction}
                toolbarSort={filters.sort}
                toolbarDirection={filters.direction}
                onSort={onSort}
            />
        ),
        cell: (info) => {
            const row = info.row.original
            return (
                <div className="flex flex-col py-0.5 min-w-0">
                    <span className="font-medium text-foreground truncate">{row.name}</span>
                    <span className="text-xs text-muted-foreground truncate">{row.email}</span>
                </div>
            )
        },
        size: 235,
    },
    {
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
        cell: (info) => {
            const phone = info.getValue<string | null>()
            return phone ? (
                <span className="font-mono text-xs">{phone}</span>
            ) : (
                <span className="text-muted-foreground">-</span>
            )
        },
        size: 145,
    },
    {
        accessorKey: 'role_name',
        header: () => (
            <DataTableSortHeader
                label="Role"
                field="role"
                tableSort={filters.table_sort}
                tableDirection={filters.table_direction}
                toolbarSort={filters.sort}
                toolbarDirection={filters.direction}
                onSort={onSort}
            />
        ),
        cell: (info) => {
            const row = info.row.original
            const cls = roleBadgeClass[row.role] ?? ''
            return <Badge className={cls}>{info.getValue<string>()}</Badge>
        },
        size: 135,
    },
    {
        accessorKey: 'has_pin',
        header: 'PIN Otorisasi',
        cell: (info) => {
            const row = info.row.original
            const isPrivileged = row.role === 'admin' || row.role === 'supervisor'
            if (!isPrivileged) {
                return <span className="text-muted-foreground">-</span>
            }

            return row.has_pin ? (
                <Badge variant="outline" className="border-emerald-500/40 text-emerald-600 dark:text-emerald-400">
                    Terpasang
                </Badge>
            ) : (
                <Badge variant="outline" className="border-amber-500/40 text-amber-600 dark:text-amber-400">
                    Belum Set
                </Badge>
            )
        },
        size: 140,
    },
    {
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
        cell: (info) => {
            const isActive = info.getValue<boolean>()
            return isActive ? (
                <Badge variant="success">Aktif</Badge>
            ) : (
                <Badge variant="secondary">Nonaktif</Badge>
            )
        },
        size: 125,
    },
    {
        accessorKey: 'last_login_at',
        header: () => (
            <DataTableSortHeader
                label="Login Terakhir"
                field="last_login_at"
                tableSort={filters.table_sort}
                tableDirection={filters.table_direction}
                toolbarSort={filters.sort}
                toolbarDirection={filters.direction}
                onSort={onSort}
            />
        ),
        cell: (info) => {
            const val = info.getValue<string | null>()
            return val ? (
                <span className="text-xs text-muted-foreground font-mono">{val}</span>
            ) : (
                <span className="text-xs text-muted-foreground">Belum pernah</span>
            )
        },
        size: 180,
    },
    {
        id: 'actions',
        header: () => <span className="text-right block w-full pr-2">Aksi</span>,
        size: 80,
        cell: (info) => {
            const row = info.row.original
            return (
                <div className="flex justify-end pr-2">
                    <UserActionsCell
                        user={row}
                        roles={roles}
                        currentUserId={currentUserId}
                        detailUrl={show.url(row.id)}
                        destroyUrl={destroy.url(row.id)}
                    />
                </div>
            )
        },
    },
]

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

type UserPageProps = PageProps<{
    users: PaginatedUsers
    filters: UserFilters
    summary: {
        total_users: number
        active_users: number
        inactive_users: number
        admin_supervisor_count: number
        cashier_count: number
        warehouse_count: number
        active_roles_count: number
    }
    roles: RoleOption[]
}>

const UsersPage = () => {
    const { users, filters, summary, roles } = usePage<UserPageProps>().props
    const { flash, user: currentUser } = useAuth()
    const [isLoading, setIsLoading] = useState(false)

    const handleFilterActive = (isActive?: string) => {
        const nextVal = isActive && String(filters.is_active) === isActive ? undefined : isActive
        router.visit(
            index({
                mergeQuery: {
                    is_active: nextVal,
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
        // Jika kolom ini sudah dipilih di toolbar, tidak bisa disortir di header tabel
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
                // Siklus 3-state: asc -> desc -> unsorted
                nextSort = undefined
                nextDirection = undefined
            }
        }

        router.visit(
            index({
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
                from: users.from,
                currentUserId: currentUser?.id ?? 0,
                roles,
                filters,
                onSort: handleSort,
            }),
        [
            users.from,
            currentUser?.id,
            roles,
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
        if (flash.error) {
            toast.error(flash.error)
        }
    }, [flash.success, flash.error])

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
                    <h1 className="text-2xl font-bold tracking-tight">Pengguna</h1>
                    <p className="text-sm text-muted-foreground">
                        Kelola akun karyawan yang dapat mengakses sistem POS.
                    </p>
                </div>
                <DialogAddUser roles={roles} storeUrl={store.url()} />
            </div>

            <SummaryStatGrid>
                <SummaryStatCard
                    title="Total User"
                    value={formatNumber(summary.total_users)}
                    icon={UsersIcon}
                    variant="blue"
                    subInfo={`${formatNumber(summary.active_roles_count)} role aktif`}
                    periodLabel="Semua Data"
                    isActive={filters.is_active === undefined || filters.is_active === 'all'}
                    onClick={() => handleFilterActive(undefined)}
                />
                <SummaryStatCard
                    title="User Aktif"
                    value={formatNumber(summary.active_users)}
                    icon={UserCheck}
                    variant="emerald"
                    subInfo={`${formatPercent(summary.active_users, summary.total_users)} dari total user`}
                    periodLabel="Aktif"
                    isActive={String(filters.is_active) === 'true' || String(filters.is_active) === '1'}
                    onClick={() => handleFilterActive('true')}
                />
                <SummaryStatCard
                    title="Admin & Supervisor"
                    value={formatNumber(summary.admin_supervisor_count)}
                    icon={ShieldCheck}
                    variant="amber"
                    subInfo={`Kasir: ${formatNumber(summary.cashier_count)} • Gudang: ${formatNumber(summary.warehouse_count)}`}
                    periodLabel="Otorisasi"
                />
                <SummaryStatCard
                    title="User Nonaktif"
                    value={formatNumber(summary.inactive_users)}
                    icon={UserX}
                    variant="rose"
                    subInfo="Akses login dinonaktifkan"
                    periodLabel="Nonaktif"
                    isActive={String(filters.is_active) === 'false' || String(filters.is_active) === '0'}
                    onClick={() => handleFilterActive('false')}
                />
            </SummaryStatGrid>

            <UserTableToolbar filters={filters} roles={roles} routeUrl={index} isLoading={isLoading} />

            <DataTable
                columns={columns}
                data={users.data}
                tableKey="users-table"
                emptyMessage="Tidak ada pengguna ditemukan."
                isLoading={isLoading}
            />

            <DataTablePagination
                meta={users}
                routeUrl={index}
                isLoading={isLoading}
            />
        </div>
    )
}

UsersPage.layout = (page: React.ReactNode) => (
    <AuthenticatedLayout>{page}</AuthenticatedLayout>
)

export default UsersPage

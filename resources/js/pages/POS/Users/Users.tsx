import React, { useEffect, useState } from 'react'
import { router, usePage } from '@inertiajs/react'
import AuthenticatedLayout from '@/layouts/AuthenticatedLayout'
import { DataTable, type DataTableColumn } from '@/components/dataTable'
import { Badge } from '@/components/ui/badge'
import type { PageProps } from '@/types'
import { useAuth } from '@/hooks/use-auth'
import { toast } from 'react-toastify'
import UserTableToolbar, { type UserFilters } from './component/UserSearch'
import { index, store, show, destroy } from '@/actions/App/Http/Controllers/UserController'
import DataTablePagination, { type PaginationMeta } from '@/components/dataTablePagination'
import { DialogAddUser } from './component/DialogAddUser'
import { UserActionsCell } from './component/UserActionsCell'
import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react'

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
// SortHeader Component
// ---------------------------------------------------------------------------

function SortHeader({
    label,
    field,
    tableSort,
    tableDirection,
    toolbarSort,
    toolbarDirection,
    onSort,
}: {
    label: string
    field: string
    tableSort?: string
    tableDirection?: string
    toolbarSort?: string
    toolbarDirection?: string
    onSort: (field: string) => void
}) {
    const isPrimary = tableSort === field
    const isToolbarSorted = toolbarSort === field
    const hasBoth = Boolean(tableSort && toolbarSort && tableSort !== toolbarSort)

    let tooltip = `Urutkan ${label} (A-Z / Terendah)`
    if (isToolbarSorted) {
        tooltip = `Kolom ${label} sedang diurutkan via toolbar (${toolbarDirection === 'asc' ? 'A-Z / Terendah' : 'Z-A / Tertinggi'}). Tidak dapat diurutkan di header tabel.`
    } else if (isPrimary) {
        if (tableDirection === 'asc') {
            tooltip = `Urutkan ${label} (Z-A / Tertinggi)`
        } else if (tableDirection === 'desc') {
            tooltip = `Batal urutkan (Default / Unsorted)`
        }
    }

    if (isToolbarSorted) {
        return (
            <div
                title={tooltip}
                className="flex items-center gap-1.5 font-medium text-muted-foreground/80 cursor-not-allowed select-none"
            >
                <span>{label}</span>
                <div className="flex items-center gap-1">
                    {toolbarDirection === 'asc' ? (
                        <ArrowUp className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    ) : (
                        <ArrowDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    )}
                    <span
                        className="flex h-3.5 items-center justify-center rounded bg-muted px-1 text-[9px] font-medium text-muted-foreground leading-none"
                        title="Diurutkan via Toolbar (Nonaktif di Header)"
                    >
                        Toolbar
                    </span>
                </div>
            </div>
        )
    }

    return (
        <button
            type="button"
            onClick={() => onSort(field)}
            title={tooltip}
            className="flex items-center gap-1.5 font-medium hover:text-foreground text-left cursor-pointer select-none group"
        >
            <span>{label}</span>
            {isPrimary ? (
                <div className="flex items-center gap-1">
                    {tableDirection === 'asc' ? (
                        <ArrowUp className="h-3.5 w-3.5 text-primary shrink-0" />
                    ) : (
                        <ArrowDown className="h-3.5 w-3.5 text-primary shrink-0" />
                    )}
                    {hasBoth && (
                        <span
                            className="flex h-3.5 min-w-3.5 px-0.5 items-center justify-center rounded bg-primary/10 text-[9px] font-bold text-primary leading-none"
                            title="Urutan Utama (Ke-1)"
                        >
                            1
                        </span>
                    )}
                </div>
            ) : (
                <ArrowUpDown className="h-3.5 w-3.5 opacity-30 group-hover:opacity-100 transition-opacity shrink-0" />
            )}
        </button>
    )
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
        size: 8,
    },
    {
        accessorKey: 'name',
        header: () => (
            <SortHeader
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
                <div className="flex flex-col py-0.5">
                    <span className="font-medium text-foreground">{row.name}</span>
                    <span className="text-xs text-muted-foreground">{row.email}</span>
                </div>
            )
        },
    },
    {
        accessorKey: 'phone',
        header: () => (
            <SortHeader
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
        size: 14,
    },
    {
        accessorKey: 'role_name',
        header: () => (
            <SortHeader
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
        size: 14,
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
        size: 14,
    },
    {
        accessorKey: 'is_active',
        header: () => (
            <SortHeader
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
        size: 12,
    },
    {
        accessorKey: 'last_login_at',
        header: () => (
            <SortHeader
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
        size: 16,
    },
    {
        id: 'actions',
        header: '',
        size: 12,
        cell: (info) => {
            const row = info.row.original
            return (
                <UserActionsCell
                    user={row}
                    roles={roles}
                    currentUserId={currentUserId}
                    detailUrl={show.url(row.id)}
                    destroyUrl={destroy.url(row.id)}
                />
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
    roles: RoleOption[]
}>

const UsersPage = () => {
    const { users, filters, roles } = usePage<UserPageProps>().props
    const { flash, user: currentUser } = useAuth()
    const [isLoading, setIsLoading] = useState(false)

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

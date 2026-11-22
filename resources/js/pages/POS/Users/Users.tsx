import React, { useEffect, useState } from 'react'
import { Link, router, usePage } from '@inertiajs/react'
import AuthenticatedLayout from '@/layouts/AuthenticatedLayout'
import { DataTable, DataTableColumn } from '@/components/dataTable'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { PageProps } from '@/types'
import { useAuth } from '@/hooks/use-auth'
import { toast } from 'react-toastify'
import UserTableToolbar from './component/UserSearch'
import { index, store, show, destroy } from '@/actions/App/Http/Controllers/UserController'
import DataTablePagination, { type PaginationMeta } from '@/components/dataTablePagination'
import { DialogAddUser } from './component/DialogAddUser'
import { UserActionsCell } from './component/UserActionsCell'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type UserRow = {
    id: number
    name: string
    email: string
    role: string
    role_name: string
    created_at: string
}

export type RoleOption = {
    value: string
    label: string
}

interface PaginatedUsers extends PaginationMeta {
    data: UserRow[]
}

interface Filters {
    search?: string
    role?: string
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
}

const getColumns = ({ from, currentUserId, roles }: GetColumnsOptions): DataTableColumn<UserRow>[] => [
    {
        id: 'no',
        header: 'No',
        cell: (info) => (from ?? 1) + info.row.index,
        size: 10,
    },
    {
        accessorKey: 'name',
        header: 'Nama',
    },
    {
        accessorKey: 'email',
        header: 'Email',
    },
    {
        accessorKey: 'role_name',
        header: 'Role',
        cell: (info) => {
            const row = info.row.original
            const cls = roleBadgeClass[row.role] ?? ''
            return <Badge className={cls}>{info.getValue<string>()}</Badge>
        },
    },
    {
        accessorKey: 'created_at',
        header: 'Terdaftar',
    },
    {
        id: 'actions',
        header: '',
        size: 20,
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
    filters: Filters
    roles: RoleOption[]
}>

const UsersPage = () => {
    const { users, filters, roles } = usePage<UserPageProps>().props
    const { flash, user: currentUser } = useAuth()
    const [isLoading, setIsLoading] = useState(false)

    const columns = React.useMemo(
        () => getColumns({ from: users.from, currentUserId: currentUser?.id, roles }),
        [users.from, currentUser?.id, roles]
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
                    <h1 className="text-2xl font-bold tracking-tight">Pengguna</h1>
                    <p className="text-sm text-muted-foreground">
                        Kelola akun karyawan yang dapat mengakses sistem.
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

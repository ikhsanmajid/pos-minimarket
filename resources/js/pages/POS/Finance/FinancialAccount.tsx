import React, { useEffect, useState } from 'react'
import { router, usePage } from '@inertiajs/react'
import AuthenticatedLayout from '@/layouts/AuthenticatedLayout'
import { DataTable, type DataTableColumn } from '@/components/dataTable'
import DataTablePagination, { type PaginationMeta } from '@/components/dataTablePagination'
import { DataTableSortHeader } from '@/components/dataTableSortHeader'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Plus, Search, X, MoreHorizontal, Pencil, Trash2, Wallet, Landmark, Smartphone, Star } from 'lucide-react'
import { toast } from 'react-toastify'
import type { PageProps } from '@/types'
import { useAuth } from '@/hooks/use-auth'
import FinancialAccountController from '@/actions/App/Http/Controllers/FinancialAccountController'
import { DialogFinancialAccount } from './component/DialogFinancialAccount'
import { formatRupiah } from '../PurchaseOrders/component/purchaseOrderUtils'

export interface FinancialAccountRow {
    id: number
    code: string
    name: string
    type: string
    type_label: string
    account_number: string | null
    bank_name: string | null
    opening_balance: number
    current_balance: number
    is_default: boolean
    is_active: boolean
    notes: string | null
    transactions_count: number
    created_at: string | null
}

interface Filters {
    search?: string
    type?: string
    status?: string
    sort?: string
    direction?: string
    table_sort?: string
    table_direction?: string
}

type FinancialAccountPageProps = PageProps<{
    accounts: PaginationMeta & { data: FinancialAccountRow[] }
    filters: Filters
    summary: {
        total_balance: number
        cash_balance: number
        bank_balance: number
        ewallet_balance: number
    }
    accountTypes: { value: string; label: string }[]
}>

const FinancialAccountPage = () => {
    const { accounts, filters, summary, accountTypes = [] } = usePage<FinancialAccountPageProps>().props
    const { flash, user } = useAuth()
    const isAdmin = user?.role === 'admin'

    const [search, setSearch] = useState(filters.search ?? '')
    const [type, setType] = useState(filters.type ?? 'all')
    const [status, setStatus] = useState(filters.status ?? 'all')
    const [isLoading, setIsLoading] = useState(false)
    const [createOpen, setCreateOpen] = useState(false)
    const [editAccount, setEditAccount] = useState<FinancialAccountRow | null>(null)
    const [deleteAccount, setDeleteAccount] = useState<FinancialAccountRow | null>(null)
    const isFirstRender = React.useRef(true)

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

    useEffect(() => {
        if (isFirstRender.current) {
            isFirstRender.current = false
            return
        }
        const t = setTimeout(() => {
            router.visit(
                FinancialAccountController.index({
                    mergeQuery: { search: search || undefined, page: 1 },
                }),
                { preserveState: true, preserveScroll: true, replace: true }
            )
        }, 300)
        return () => clearTimeout(t)
    }, [search])

    const handleSort = (field: string) => {
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
            FinancialAccountController.index({
                mergeQuery: { table_sort: nextSort, table_direction: nextDirection, page: 1 },
            }),
            { preserveState: true, preserveScroll: true, replace: true }
        )
    }

    const columns: DataTableColumn<FinancialAccountRow>[] = React.useMemo(
        () => [
            {
                id: 'no',
                header: 'No',
                cell: (info) => (accounts.from ?? 1) + info.row.index,
                size: 55,
            },
            {
                accessorKey: 'code',
                header: () => (
                    <DataTableSortHeader
                        label="Kode"
                        field="code"
                        tableSort={filters.table_sort}
                        tableDirection={filters.table_direction}
                        toolbarSort={filters.sort}
                        toolbarDirection={filters.direction}
                        onSort={handleSort}
                    />
                ),
                size: 120,
                cell: (info) => (
                    <span className="font-mono text-xs font-semibold text-primary">
                        {info.getValue<string>()}
                    </span>
                ),
            },
            {
                accessorKey: 'name',
                header: () => (
                    <DataTableSortHeader
                        label="Nama Akun"
                        field="name"
                        tableSort={filters.table_sort}
                        tableDirection={filters.table_direction}
                        toolbarSort={filters.sort}
                        toolbarDirection={filters.direction}
                        onSort={handleSort}
                    />
                ),
                size: 240,
                cell: ({ row }) => {
                    const acc = row.original
                    return (
                        <div className="flex flex-col min-w-0">
                            <div className="flex items-center gap-1.5 min-w-0">
                                <span className="font-medium text-foreground truncate">{acc.name}</span>
                                {acc.is_default && (
                                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0 gap-0.5 bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 shrink-0">
                                        <Star className="h-2.5 w-2.5 fill-current" />
                                        Default
                                    </Badge>
                                )}
                            </div>
                            {(acc.bank_name || acc.account_number) && (
                                <span className="text-[11px] text-muted-foreground font-mono truncate">
                                    {acc.bank_name ? `${acc.bank_name} • ` : ''}
                                    {acc.account_number || ''}
                                </span>
                            )}
                        </div>
                    )
                },
            },
            {
                accessorKey: 'type',
                header: 'Tipe',
                size: 150,
                cell: ({ row }) => (
                    <Badge variant="outline" className="text-[11px]">
                        {row.original.type_label}
                    </Badge>
                ),
            },
            {
                accessorKey: 'current_balance',
                header: () => (
                    <DataTableSortHeader
                        label="Saldo Berjalan"
                        field="current_balance"
                        tableSort={filters.table_sort}
                        tableDirection={filters.table_direction}
                        toolbarSort={filters.sort}
                        toolbarDirection={filters.direction}
                        onSort={handleSort}
                    />
                ),
                size: 170,
                cell: ({ row }) => (
                    <span className="font-mono text-xs font-bold text-foreground">
                        {formatRupiah(row.original.current_balance)}
                    </span>
                ),
            },
            {
                accessorKey: 'is_active',
                header: 'Status',
                size: 105,
                cell: ({ row }) =>
                    row.original.is_active ? (
                        <Badge variant="success">Aktif</Badge>
                    ) : (
                        <Badge variant="secondary">Nonaktif</Badge>
                    ),
            },
            {
                id: 'actions',
                header: () => <span className="text-right block w-full pr-2">Aksi</span>,
                size: 70,
                cell: ({ row }) => {
                    const acc = row.original
                    if (!isAdmin) {
                        return <span className="text-right block pr-2 text-xs text-muted-foreground">-</span>
                    }

                    return (
                        <div className="flex justify-end pr-2">
                            <DropdownMenu>
                                <DropdownMenuTrigger
                                    render={
                                        <Button variant="ghost" size="icon-sm" className="cursor-pointer" aria-label="Aksi" />
                                    }
                                >
                                    <MoreHorizontal className="h-4 w-4" />
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-40">
                                    <DropdownMenuItem onClick={() => setEditAccount(acc)} className="cursor-pointer gap-2">
                                        <Pencil className="h-3.5 w-3.5" />
                                        Edit Akun
                                    </DropdownMenuItem>
                                    {acc.transactions_count === 0 && (
                                        <>
                                            <DropdownMenuSeparator />
                                            <DropdownMenuItem
                                                variant="destructive"
                                                onClick={() => setDeleteAccount(acc)}
                                                className="cursor-pointer gap-2"
                                            >
                                                <Trash2 className="h-3.5 w-3.5" />
                                                Hapus
                                            </DropdownMenuItem>
                                        </>
                                    )}
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </div>
                    )
                },
            },
        ],
        [accounts.from, filters.table_sort, filters.table_direction, filters.sort, filters.direction, isAdmin]
    )

    const typeItems = [{ value: 'all', label: 'Semua Tipe' }, ...accountTypes]
    const statusItems = [
        { value: 'all', label: 'Semua Status' },
        { value: 'active', label: 'Aktif' },
        { value: 'inactive', label: 'Nonaktif' },
    ]

    return (
        <div className="w-full min-w-0 space-y-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Akun Kas & Bank</h1>
                    <p className="text-sm text-muted-foreground">
                        Kelola saldo kas laci POS, brankas toko, rekening bank, dan e-wallet.
                    </p>
                </div>
                {isAdmin && (
                    <Button onClick={() => setCreateOpen(true)} className="gap-1.5">
                        <Plus className="h-4 w-4" />
                        Tambah Akun
                    </Button>
                )}
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card>
                    <CardContent className="p-4 flex items-center justify-between">
                        <div>
                            <p className="text-xs text-muted-foreground">Total Saldo Aktif</p>
                            <p className="text-lg font-extrabold font-mono text-primary mt-0.5">
                                {formatRupiah(summary.total_balance)}
                            </p>
                        </div>
                        <Wallet className="h-8 w-8 text-primary/30" />
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-4 flex items-center justify-between">
                        <div>
                            <p className="text-xs text-muted-foreground">Kas Tunai</p>
                            <p className="text-lg font-bold font-mono mt-0.5">{formatRupiah(summary.cash_balance)}</p>
                        </div>
                        <Wallet className="h-8 w-8 text-emerald-500/30" />
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-4 flex items-center justify-between">
                        <div>
                            <p className="text-xs text-muted-foreground">Rekening Bank</p>
                            <p className="text-lg font-bold font-mono mt-0.5">{formatRupiah(summary.bank_balance)}</p>
                        </div>
                        <Landmark className="h-8 w-8 text-blue-500/30" />
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-4 flex items-center justify-between">
                        <div>
                            <p className="text-xs text-muted-foreground">E-Wallet</p>
                            <p className="text-lg font-bold font-mono mt-0.5">{formatRupiah(summary.ewallet_balance)}</p>
                        </div>
                        <Smartphone className="h-8 w-8 text-purple-500/30" />
                    </CardContent>
                </Card>
            </div>

            {/* Filter Toolbar */}
            <div className="flex flex-wrap items-center gap-2.5">
                <div className="relative w-full sm:w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                    <Input
                        placeholder="Cari kode / nama / bank..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="pl-9 h-9 text-sm"
                    />
                </div>

                <Select
                    items={typeItems}
                    value={type}
                    onValueChange={(val) => {
                        if (!val) return
                        setType(val)
                        router.visit(
                            FinancialAccountController.index({
                                mergeQuery: { type: val !== 'all' ? val : undefined, page: 1 },
                            }),
                            { preserveState: true, preserveScroll: true, replace: true }
                        )
                    }}
                >
                    <SelectTrigger className="w-full sm:w-[175px] h-9">
                        <SelectValue placeholder="Semua Tipe">
                            {(val) => typeItems.find((i) => i.value === val)?.label}
                        </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                        {typeItems.map((i) => (
                            <SelectItem key={i.value} value={i.value}>
                                {i.label}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>

                <Select
                    items={statusItems}
                    value={status}
                    onValueChange={(val) => {
                        if (!val) return
                        setStatus(val)
                        router.visit(
                            FinancialAccountController.index({
                                mergeQuery: { status: val !== 'all' ? val : undefined, page: 1 },
                            }),
                            { preserveState: true, preserveScroll: true, replace: true }
                        )
                    }}
                >
                    <SelectTrigger className="w-full sm:w-[155px] h-9">
                        <SelectValue placeholder="Semua Status">
                            {(val) => statusItems.find((i) => i.value === val)?.label}
                        </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                        {statusItems.map((i) => (
                            <SelectItem key={i.value} value={i.value}>
                                {i.label}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>

                {(search || type !== 'all' || status !== 'all') && (
                    <Button
                        variant="outline"
                        size="sm"
                        className="h-9 text-xs gap-1"
                        onClick={() => {
                            isFirstRender.current = true
                            setSearch('')
                            setType('all')
                            setStatus('all')
                            router.visit(FinancialAccountController.index.url(), {
                                preserveState: true,
                                preserveScroll: true,
                                replace: true,
                            })
                        }}
                    >
                        <X className="h-3.5 w-3.5" />
                        Reset
                    </Button>
                )}
            </div>

            <DataTable
                columns={columns}
                data={accounts.data ?? []}
                tableKey="financial-accounts-table"
                emptyMessage="Belum ada akun keuangan."
                isLoading={isLoading}
            />

            <DataTablePagination
                meta={accounts}
                routeUrl={FinancialAccountController.index}
                isLoading={isLoading}
            />

            <DialogFinancialAccount
                account={null}
                accountTypes={accountTypes}
                open={createOpen}
                onOpenChange={setCreateOpen}
            />

            <DialogFinancialAccount
                account={editAccount}
                accountTypes={accountTypes}
                open={Boolean(editAccount)}
                onOpenChange={(open) => {
                    if (!open) setEditAccount(null)
                }}
            />

            <AlertDialog open={Boolean(deleteAccount)} onOpenChange={(open) => !open && setDeleteAccount(null)}>
                <AlertDialogContent size="sm">
                    <AlertDialogHeader>
                        <AlertDialogTitle>Hapus Akun Keuangan</AlertDialogTitle>
                        <AlertDialogDescription>
                            Yakin ingin menghapus akun <strong>{deleteAccount?.name}</strong>?
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Batal</AlertDialogCancel>
                        <AlertDialogAction
                            variant="destructive"
                            onClick={() => {
                                if (!deleteAccount) return
                                router.delete(FinancialAccountController.destroy.url(deleteAccount.id), {
                                    preserveScroll: true,
                                    onFinish: () => setDeleteAccount(null),
                                })
                            }}
                        >
                            Ya, Hapus
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    )
}

FinancialAccountPage.layout = (page: React.ReactNode) => (
    <AuthenticatedLayout>{page}</AuthenticatedLayout>
)

export default FinancialAccountPage

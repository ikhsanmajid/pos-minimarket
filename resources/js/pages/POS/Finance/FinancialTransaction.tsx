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
import { Label } from '@/components/ui/label'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import { Search, X, ArrowDownLeft, ArrowUpRight, Scale } from 'lucide-react'
import type { PageProps } from '@/types'
import FinancialTransactionController from '@/actions/App/Http/Controllers/FinancialTransactionController'
import { formatRupiah } from '../PurchaseOrders/component/purchaseOrderUtils'

export interface FinancialTransactionRow {
    id: number
    transaction_number: string
    transaction_date: string
    type: 'in' | 'out' | string
    type_label: string
    amount: number
    balance_before: number
    balance_after: number
    description: string
    account_name: string
    account_code: string
    category_name: string
    creator_name: string
    created_at: string
}

interface Filters {
    search?: string
    financial_account_id?: string
    financial_category_id?: string
    type?: string
    start_date?: string
    end_date?: string
    sort?: string
    direction?: string
    table_sort?: string
    table_direction?: string
}

type FinancialTransactionPageProps = PageProps<{
    transactions: PaginationMeta & { data: FinancialTransactionRow[] }
    filters: Filters
    summary: {
        total_in: number
        total_out: number
        net_flow: number
    }
    accounts: { id: number; code: string; name: string }[]
    categories: { id: number; code: string; name: string; type: string }[]
    transactionTypes: { value: string; label: string }[]
}>

const FinancialTransactionPage = () => {
    const {
        transactions,
        filters,
        summary,
        accounts = [],
        categories = [],
        transactionTypes = [],
    } = usePage<FinancialTransactionPageProps>().props

    const [search, setSearch] = useState(filters.search ?? '')
    const [accountId, setAccountId] = useState(filters.financial_account_id ?? 'all')
    const [categoryId, setCategoryId] = useState(filters.financial_category_id ?? 'all')
    const [type, setType] = useState(filters.type ?? 'all')
    const [startDate, setStartDate] = useState(filters.start_date ?? '')
    const [endDate, setEndDate] = useState(filters.end_date ?? '')
    const [isLoading, setIsLoading] = useState(false)
    const isFirstRender = React.useRef(true)

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
                FinancialTransactionController.index({
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
            FinancialTransactionController.index({
                mergeQuery: { table_sort: nextSort, table_direction: nextDirection, page: 1 },
            }),
            { preserveState: true, preserveScroll: true, replace: true }
        )
    }

    const columns: DataTableColumn<FinancialTransactionRow>[] = React.useMemo(
        () => [
            {
                id: 'no',
                header: 'No',
                cell: (info) => (transactions.from ?? 1) + info.row.index,
                size: 55,
            },
            {
                accessorKey: 'transaction_number',
                header: () => (
                    <DataTableSortHeader
                        label="No. Mutasi"
                        field="transaction_number"
                        tableSort={filters.table_sort}
                        tableDirection={filters.table_direction}
                        toolbarSort={filters.sort}
                        toolbarDirection={filters.direction}
                        onSort={handleSort}
                    />
                ),
                size: 165,
                cell: ({ row }) => (
                    <div className="flex flex-col min-w-0">
                        <span className="font-mono text-xs font-semibold text-foreground truncate">
                            {row.original.transaction_number}
                        </span>
                        <span className="font-mono text-[11px] text-muted-foreground">
                            {row.original.transaction_date}
                        </span>
                    </div>
                ),
            },
            {
                accessorKey: 'account_name',
                header: 'Akun & Kategori',
                size: 215,
                cell: ({ row }) => (
                    <div className="flex flex-col min-w-0">
                        <span className="font-medium text-foreground truncate">{row.original.account_name}</span>
                        <span className="text-[11px] text-muted-foreground truncate">
                            {row.original.category_name}
                        </span>
                    </div>
                ),
            },
            {
                accessorKey: 'type',
                header: 'Arus',
                size: 115,
                cell: ({ row }) => {
                    const isIn = row.original.type === 'in'
                    return (
                        <Badge
                            variant="outline"
                            className={
                                isIn
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300'
                                    : 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/60 dark:text-rose-300'
                            }
                        >
                            {row.original.type_label}
                        </Badge>
                    )
                },
            },
            {
                accessorKey: 'amount',
                header: () => (
                    <DataTableSortHeader
                        label="Nominal"
                        field="amount"
                        tableSort={filters.table_sort}
                        tableDirection={filters.table_direction}
                        toolbarSort={filters.sort}
                        toolbarDirection={filters.direction}
                        onSort={handleSort}
                    />
                ),
                size: 145,
                cell: ({ row }) => {
                    const isIn = row.original.type === 'in'
                    return (
                        <span
                            className={`font-mono text-xs font-bold ${
                                isIn ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                            }`}
                        >
                            {isIn ? '+' : '-'} {formatRupiah(row.original.amount)}
                        </span>
                    )
                },
            },
            {
                accessorKey: 'balance_after',
                header: 'Saldo Akhir',
                size: 145,
                cell: ({ row }) => (
                    <span className="font-mono text-xs font-semibold text-foreground">
                        {formatRupiah(row.original.balance_after)}
                    </span>
                ),
            },
            {
                accessorKey: 'description',
                header: 'Keterangan',
                size: 250,
                cell: ({ row }) => (
                    <div className="flex flex-col min-w-0">
                        <span className="text-xs text-foreground line-clamp-2 whitespace-normal">
                            {row.original.description}
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                            Oleh: {row.original.creator_name}
                        </span>
                    </div>
                ),
            },
        ],
        [transactions.from, filters.table_sort, filters.table_direction, filters.sort, filters.direction]
    )

    const accountItems = [
        { value: 'all', label: 'Semua Akun' },
        ...accounts.map((a) => ({ value: String(a.id), label: `${a.name} (${a.code})` })),
    ]
    const categoryItems = [
        { value: 'all', label: 'Semua Kategori' },
        ...categories.map((c) => ({ value: String(c.id), label: c.name })),
    ]
    const typeItems = [{ value: 'all', label: 'Semua Arus' }, ...transactionTypes]

    return (
        <div className="w-full min-w-0 space-y-6">
            <div>
                <h1 className="text-2xl font-bold tracking-tight">Buku Arus Kas (Financial Ledger)</h1>
                <p className="text-sm text-muted-foreground">
                    Catatan historis seluruh uang masuk dan keluar toko secara terpusat (read-only).
                </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Card>
                    <CardContent className="p-4 flex items-center justify-between">
                        <div>
                            <p className="text-xs text-muted-foreground">Total Kas Masuk</p>
                            <p className="text-lg font-extrabold font-mono text-emerald-600 dark:text-emerald-400 mt-0.5">
                                + {formatRupiah(summary.total_in)}
                            </p>
                        </div>
                        <ArrowDownLeft className="h-8 w-8 text-emerald-500/30" />
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-4 flex items-center justify-between">
                        <div>
                            <p className="text-xs text-muted-foreground">Total Kas Keluar</p>
                            <p className="text-lg font-extrabold font-mono text-rose-600 dark:text-rose-400 mt-0.5">
                                - {formatRupiah(summary.total_out)}
                            </p>
                        </div>
                        <ArrowUpRight className="h-8 w-8 text-rose-500/30" />
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-4 flex items-center justify-between">
                        <div>
                            <p className="text-xs text-muted-foreground">Arus Kas Bersih</p>
                            <p
                                className={`text-lg font-extrabold font-mono mt-0.5 ${
                                    summary.net_flow >= 0
                                        ? 'text-emerald-600 dark:text-emerald-400'
                                        : 'text-rose-600 dark:text-rose-400'
                                }`}
                            >
                                {formatRupiah(summary.net_flow)}
                            </p>
                        </div>
                        <Scale className="h-8 w-8 text-primary/30" />
                    </CardContent>
                </Card>
            </div>

            {/* Filter Toolbar */}
            <div className="flex flex-wrap items-center gap-2.5">
                <div className="relative w-full sm:w-60">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                    <Input
                        placeholder="Cari no. mutasi / keterangan..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="pl-9 h-9 text-sm"
                    />
                </div>

                <Select
                    items={accountItems}
                    value={accountId}
                    onValueChange={(val) => {
                        if (!val) return
                        setAccountId(val)
                        router.visit(
                            FinancialTransactionController.index({
                                mergeQuery: { financial_account_id: val !== 'all' ? val : undefined, page: 1 },
                            }),
                            { preserveState: true, preserveScroll: true, replace: true }
                        )
                    }}
                >
                    <SelectTrigger className="w-full sm:w-[190px] h-9">
                        <SelectValue placeholder="Semua Akun">
                            {(val) => accountItems.find((i) => i.value === val)?.label}
                        </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                        {accountItems.map((i) => (
                            <SelectItem key={i.value} value={i.value}>
                                {i.label}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>

                <Select
                    items={categoryItems}
                    value={categoryId}
                    onValueChange={(val) => {
                        if (!val) return
                        setCategoryId(val)
                        router.visit(
                            FinancialTransactionController.index({
                                mergeQuery: { financial_category_id: val !== 'all' ? val : undefined, page: 1 },
                            }),
                            { preserveState: true, preserveScroll: true, replace: true }
                        )
                    }}
                >
                    <SelectTrigger className="w-full sm:w-[195px] h-9">
                        <SelectValue placeholder="Semua Kategori">
                            {(val) => categoryItems.find((i) => i.value === val)?.label}
                        </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                        {categoryItems.map((i) => (
                            <SelectItem key={i.value} value={i.value}>
                                {i.label}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>

                <Select
                    items={typeItems}
                    value={type}
                    onValueChange={(val) => {
                        if (!val) return
                        setType(val)
                        router.visit(
                            FinancialTransactionController.index({
                                mergeQuery: { type: val !== 'all' ? val : undefined, page: 1 },
                            }),
                            { preserveState: true, preserveScroll: true, replace: true }
                        )
                    }}
                >
                    <SelectTrigger className="w-full sm:w-[145px] h-9">
                        <SelectValue placeholder="Semua Arus">
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

                <div className="flex items-center gap-1.5">
                    <Label htmlFor="fin-start" className="text-xs text-muted-foreground">
                        Dari:
                    </Label>
                    <Input
                        id="fin-start"
                        type="date"
                        value={startDate}
                        onChange={(e) => {
                            setStartDate(e.target.value)
                            router.visit(
                                FinancialTransactionController.index({
                                    mergeQuery: { start_date: e.target.value || undefined, page: 1 },
                                }),
                                { preserveState: true, preserveScroll: true, replace: true }
                            )
                        }}
                        className="h-9 w-[135px] text-xs"
                    />
                </div>

                <div className="flex items-center gap-1.5">
                    <Label htmlFor="fin-end" className="text-xs text-muted-foreground">
                        Sampai:
                    </Label>
                    <Input
                        id="fin-end"
                        type="date"
                        value={endDate}
                        onChange={(e) => {
                            setEndDate(e.target.value)
                            router.visit(
                                FinancialTransactionController.index({
                                    mergeQuery: { end_date: e.target.value || undefined, page: 1 },
                                }),
                                { preserveState: true, preserveScroll: true, replace: true }
                            )
                        }}
                        className="h-9 w-[135px] text-xs"
                    />
                </div>

                {(search || accountId !== 'all' || categoryId !== 'all' || type !== 'all' || startDate || endDate) && (
                    <Button
                        variant="outline"
                        size="sm"
                        className="h-9 text-xs gap-1"
                        onClick={() => {
                            isFirstRender.current = true
                            setSearch('')
                            setAccountId('all')
                            setCategoryId('all')
                            setType('all')
                            setStartDate('')
                            setEndDate('')
                            router.visit(FinancialTransactionController.index.url(), {
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
                data={transactions.data ?? []}
                tableKey="financial-transactions-table"
                emptyMessage="Belum ada catatan transaksi arus kas."
                isLoading={isLoading}
            />

            <DataTablePagination
                meta={transactions}
                routeUrl={FinancialTransactionController.index}
                isLoading={isLoading}
            />
        </div>
    )
}

FinancialTransactionPage.layout = (page: React.ReactNode) => (
    <AuthenticatedLayout>{page}</AuthenticatedLayout>
)

export default FinancialTransactionPage

import React, { useEffect, useState } from 'react'
import { router, usePage } from '@inertiajs/react'
import AuthenticatedLayout from '@/layouts/AuthenticatedLayout'
import { DataTable, type DataTableColumn } from '@/components/dataTable'
import DataTablePagination, { type PaginationMeta } from '@/components/dataTablePagination'
import { DataTableSortHeader } from '@/components/dataTableSortHeader'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { SummaryStatCard, SummaryStatGrid } from '@/components/SummaryStatCard'
import { formatDateRangeLabel, formatNumber, formatPercent, formatRupiah } from '@/lib/utils'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import { Search, X, ArrowDownLeft, ArrowLeftRight, ArrowUpRight, Scale, Plus } from 'lucide-react'
import { toast } from 'react-toastify'
import type { PageProps } from '@/types'
import { useAuth } from '@/hooks/use-auth'
import FinancialTransactionController from '@/actions/App/Http/Controllers/FinancialTransactionController'
import {
    DialogAddFinancialTransaction,
    type ActiveFinancialAccountOption,
    type ManualFinancialCategoryOption,
} from './component/DialogAddFinancialTransaction'

export interface FinancialTransactionRow {
    id: number
    transaction_number: string
    transaction_date: string
    type: 'in' | 'out' | string
    type_label: string
    amount: number
    balance_before: number
    balance_after: number
    reference_number: string | null
    source_code: 'manual' | 'pos' | 'return' | 'payable' | 'shift' | 'system' | string
    source_label: string
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
        total_transactions: number
        in_count: number
        out_count: number
        total_in: number
        total_out: number
        net_flow: number
    }
    accounts: { id: number; code: string; name: string }[]
    activeAccounts: ActiveFinancialAccountOption[]
    categories: { id: number; code: string; name: string; type: string }[]
    manualCategories: ManualFinancialCategoryOption[]
    transactionTypes: { value: string; label: string }[]
    canCreate: boolean
}>

const sourceBadgeClasses: Record<string, string> = {
    manual:
        'bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950/60 dark:text-violet-300 dark:border-violet-800',
    pos: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800',
    return: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800',
    payable:
        'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/60 dark:text-orange-300 dark:border-orange-800',
    shift: 'bg-cyan-50 text-cyan-700 border-cyan-200 dark:bg-cyan-950/60 dark:text-cyan-300 dark:border-cyan-800',
    system: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-900 dark:text-slate-300 dark:border-slate-700',
}

const FinancialTransactionPage = () => {
    const {
        transactions,
        filters,
        summary,
        accounts = [],
        activeAccounts = [],
        categories = [],
        manualCategories = [],
        transactionTypes = [],
        canCreate = false,
    } = usePage<FinancialTransactionPageProps>().props
    const { flash } = useAuth()

    const [search, setSearch] = useState(filters.search ?? '')
    const [accountId, setAccountId] = useState(filters.financial_account_id ?? 'all')
    const [categoryId, setCategoryId] = useState(filters.financial_category_id ?? 'all')
    const [type, setType] = useState(filters.type ?? 'all')
    const [startDate, setStartDate] = useState(filters.start_date ?? '')
    const [endDate, setEndDate] = useState(filters.end_date ?? '')
    const [isLoading, setIsLoading] = useState(false)
    const [createOpen, setCreateOpen] = useState(false)
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
                size: 205,
                cell: ({ row }) => (
                    <div className="flex flex-col min-w-0">
                        <span className="font-medium text-foreground truncate">
                            {row.original.account_name}
                        </span>
                        <span className="text-[11px] text-muted-foreground truncate">
                            {row.original.category_name}
                        </span>
                    </div>
                ),
            },
            {
                accessorKey: 'source_code',
                header: 'Sumber',
                size: 110,
                cell: ({ row }) => (
                    <Badge
                        variant="outline"
                        className={`text-[10px] font-medium ${sourceBadgeClasses[row.original.source_code] ?? sourceBadgeClasses.system}`}
                    >
                        {row.original.source_label}
                    </Badge>
                ),
            },
            {
                accessorKey: 'type',
                header: 'Arus',
                size: 110,
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
                size: 140,
                cell: ({ row }) => {
                    const isIn = row.original.type === 'in'
                    return (
                        <span
                            className={`font-mono text-xs font-bold ${
                                isIn
                                    ? 'text-emerald-600 dark:text-emerald-400'
                                    : 'text-rose-600 dark:text-rose-400'
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
                size: 140,
                cell: ({ row }) => (
                    <span className="font-mono text-xs font-semibold text-foreground">
                        {formatRupiah(row.original.balance_after)}
                    </span>
                ),
            },
            {
                accessorKey: 'description',
                header: 'Keterangan',
                size: 245,
                cell: ({ row }) => (
                    <div className="flex flex-col min-w-0">
                        <span className="text-xs text-foreground line-clamp-2 whitespace-normal">
                            {row.original.description}
                        </span>
                        <span className="text-[10px] text-muted-foreground truncate">
                            {row.original.reference_number
                                ? `Ref: ${row.original.reference_number} • `
                                : ''}
                            Oleh: {row.original.creator_name}
                        </span>
                    </div>
                ),
            },
        ],
        [
            transactions.from,
            filters.table_sort,
            filters.table_direction,
            filters.sort,
            filters.direction,
        ]
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
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Buku Arus Kas (Financial Ledger)</h1>
                    <p className="text-sm text-muted-foreground">
                        Catatan historis uang masuk/keluar otomatis maupun pencatatan biaya operasional manual toko.
                    </p>
                </div>
                {canCreate && (
                    <Button onClick={() => setCreateOpen(true)} className="gap-1.5 cursor-pointer">
                        <Plus className="h-4 w-4" />
                        Catat Pemasukan / Pengeluaran
                    </Button>
                )}
            </div>

            <SummaryStatGrid>
                <SummaryStatCard
                    title="Total Transaksi"
                    value={formatNumber(summary.total_transactions)}
                    icon={ArrowLeftRight}
                    variant="blue"
                    subInfo={`${formatNumber(summary.in_count)} masuk • ${formatNumber(summary.out_count)} keluar`}
                    periodLabel={formatDateRangeLabel(filters.start_date, filters.end_date, 'Semua Data')}
                    isActive={!filters.type || filters.type === 'all'}
                    onClick={() => {
                        setType('all')
                        router.visit(
                            FinancialTransactionController.index({
                                mergeQuery: { type: undefined, page: 1 },
                            }),
                            { preserveState: true, preserveScroll: true, replace: true }
                        )
                    }}
                />
                <SummaryStatCard
                    title="Total Pemasukan"
                    value={formatRupiah(summary.total_in)}
                    icon={ArrowDownLeft}
                    variant="emerald"
                    subInfo={`${formatNumber(summary.in_count)} transaksi (${formatPercent(summary.in_count, summary.total_transactions)})`}
                    periodLabel={formatDateRangeLabel(filters.start_date, filters.end_date, 'Kas Masuk')}
                    isActive={filters.type === 'in'}
                    onClick={() => {
                        const next = filters.type === 'in' ? 'all' : 'in'
                        setType(next)
                        router.visit(
                            FinancialTransactionController.index({
                                mergeQuery: { type: next !== 'all' ? next : undefined, page: 1 },
                            }),
                            { preserveState: true, preserveScroll: true, replace: true }
                        )
                    }}
                />
                <SummaryStatCard
                    title="Arus Kas Bersih (Net)"
                    value={formatRupiah(summary.net_flow)}
                    icon={Scale}
                    variant="amber"
                    subInfo={summary.net_flow >= 0 ? 'Surplus arus kas' : 'Defisit arus kas'}
                    periodLabel={formatDateRangeLabel(filters.start_date, filters.end_date, 'Semua Data')}
                />
                <SummaryStatCard
                    title="Total Pengeluaran"
                    value={formatRupiah(summary.total_out)}
                    icon={ArrowUpRight}
                    variant="rose"
                    subInfo={`${formatNumber(summary.out_count)} transaksi (${formatPercent(summary.out_count, summary.total_transactions)})`}
                    periodLabel={formatDateRangeLabel(filters.start_date, filters.end_date, 'Kas Keluar')}
                    isActive={filters.type === 'out'}
                    onClick={() => {
                        const next = filters.type === 'out' ? 'all' : 'out'
                        setType(next)
                        router.visit(
                            FinancialTransactionController.index({
                                mergeQuery: { type: next !== 'all' ? next : undefined, page: 1 },
                            }),
                            { preserveState: true, preserveScroll: true, replace: true }
                        )
                    }}
                />
            </SummaryStatGrid>

            <div className="mb-4 space-y-3 rounded-lg border bg-card p-3.5 shadow-xs sm:p-4">
                <div className="flex flex-wrap items-center gap-2.5">
                    <div className="relative w-full sm:w-64 lg:w-72">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                        <Input
                            placeholder="Cari no. mutasi / ref / keterangan…"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="pl-9 pr-8 h-9 text-sm"
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
                        disabled={isLoading}
                    >
                        <SelectTrigger className="w-full sm:w-auto sm:min-w-[190px] h-9">
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
                        disabled={isLoading}
                    >
                        <SelectTrigger className="w-full sm:w-auto sm:min-w-[195px] h-9">
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
                        disabled={isLoading}
                    >
                        <SelectTrigger className="w-full sm:w-auto sm:min-w-[145px] h-9">
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
                        <Label htmlFor="fin-start" className="text-xs text-muted-foreground whitespace-nowrap">
                            Dari:
                        </Label>
                        <Input
                            id="fin-start"
                            type="date"
                            value={startDate}
                            disabled={isLoading}
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
                        <Label htmlFor="fin-end" className="text-xs text-muted-foreground whitespace-nowrap">
                            Sampai:
                        </Label>
                        <Input
                            id="fin-end"
                            type="date"
                            value={endDate}
                            disabled={isLoading}
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
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={isLoading}
                            className="h-9 px-3 text-xs gap-1.5 text-muted-foreground hover:text-foreground border-dashed"
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
                            Reset Filter
                        </Button>
                    )}
                </div>
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

            {canCreate && (
                <DialogAddFinancialTransaction
                    accounts={activeAccounts}
                    categories={manualCategories}
                    open={createOpen}
                    onOpenChange={setCreateOpen}
                />
            )}
        </div>
    )
}

FinancialTransactionPage.layout = (page: React.ReactNode) => (
    <AuthenticatedLayout>{page}</AuthenticatedLayout>
)

export default FinancialTransactionPage

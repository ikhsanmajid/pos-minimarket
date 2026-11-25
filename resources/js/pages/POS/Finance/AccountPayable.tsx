import React, { useEffect, useState } from 'react'
import { Link, router, usePage } from '@inertiajs/react'
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
import { Search, X, CreditCard, AlertTriangle, Clock, FileWarning } from 'lucide-react'
import { toast } from 'react-toastify'
import type { PageProps } from '@/types'
import { useAuth } from '@/hooks/use-auth'
import AccountPayableController from '@/actions/App/Http/Controllers/AccountPayableController'
import PurchaseOrderController from '@/actions/App/Http/Controllers/PurchaseOrderController'
import { RecordPaymentDialog } from '../PurchaseOrders/component/RecordPaymentDialog'
import {
    formatRupiah,
    paymentStatusBadgeConfig,
    type FinancialAccountOption,
    type SelectOptionItem,
} from '../PurchaseOrders/component/purchaseOrderUtils'

export interface AccountPayableRow {
    id: number
    payable_number: string
    purchase_order_id: number
    po_number: string
    supplier_id: number
    supplier_name: string
    invoice_number: string | null
    total_amount: number
    paid_amount: number
    remaining_amount: number
    due_date: string | null
    raw_due_date: string | null
    is_overdue: boolean
    status: string
    status_label: string
    can_pay: boolean
}

interface Filters {
    search?: string
    status?: string
    due_filter?: string
    supplier_id?: string
    sort?: string
    direction?: string
    table_sort?: string
    table_direction?: string
}

type AccountPayablePageProps = PageProps<{
    payables: PaginationMeta & { data: AccountPayableRow[] }
    filters: Filters
    summary: {
        total_outstanding: number
        overdue_amount: number
        overdue_count: number
        due_soon_amount: number
    }
    financialAccounts: FinancialAccountOption[]
    paymentStatuses: SelectOptionItem[]
    paymentMethods: SelectOptionItem[]
}>

const AccountPayablePage = () => {
    const {
        payables,
        filters,
        summary,
        financialAccounts = [],
        paymentStatuses = [],
        paymentMethods = [],
    } = usePage<AccountPayablePageProps>().props
    const { flash } = useAuth()

    const [search, setSearch] = useState(filters.search ?? '')
    const [status, setStatus] = useState(filters.status ?? 'all')
    const [dueFilter, setDueFilter] = useState(filters.due_filter ?? 'all')
    const [isLoading, setIsLoading] = useState(false)
    const [payingRow, setPayingRow] = useState<AccountPayableRow | null>(null)
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
                AccountPayableController.index({
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
            AccountPayableController.index({
                mergeQuery: { table_sort: nextSort, table_direction: nextDirection, page: 1 },
            }),
            { preserveState: true, preserveScroll: true, replace: true }
        )
    }

    const columns: DataTableColumn<AccountPayableRow>[] = React.useMemo(
        () => [
            {
                id: 'no',
                header: 'No',
                cell: (info) => (payables.from ?? 1) + info.row.index,
                size: 55,
            },
            {
                accessorKey: 'payable_number',
                header: () => (
                    <DataTableSortHeader
                        label="No. Hutang / PO"
                        field="payable_number"
                        tableSort={filters.table_sort}
                        tableDirection={filters.table_direction}
                        toolbarSort={filters.sort}
                        toolbarDirection={filters.direction}
                        onSort={handleSort}
                    />
                ),
                size: 195,
                cell: ({ row }) => {
                    const ap = row.original
                    return (
                        <div className="flex flex-col min-w-0">
                            <span className="font-mono text-xs font-semibold text-foreground truncate">
                                {ap.payable_number}
                            </span>
                            <Link
                                href={PurchaseOrderController.show.url(ap.purchase_order_id)}
                                className="font-mono text-[11px] text-primary hover:underline truncate"
                            >
                                {ap.po_number}
                            </Link>
                        </div>
                    )
                },
            },
            {
                accessorKey: 'supplier_name',
                header: 'Supplier',
                size: 200,
                cell: ({ row }) => (
                    <div className="flex flex-col min-w-0">
                        <span className="font-medium text-foreground truncate">{row.original.supplier_name}</span>
                        {row.original.invoice_number && (
                            <span className="font-mono text-[11px] text-muted-foreground truncate">
                                Faktur: {row.original.invoice_number}
                            </span>
                        )}
                    </div>
                ),
            },
            {
                accessorKey: 'due_date',
                header: () => (
                    <DataTableSortHeader
                        label="Jatuh Tempo"
                        field="due_date"
                        tableSort={filters.table_sort}
                        tableDirection={filters.table_direction}
                        toolbarSort={filters.sort}
                        toolbarDirection={filters.direction}
                        onSort={handleSort}
                    />
                ),
                size: 145,
                cell: ({ row }) => {
                    const ap = row.original
                    return (
                        <div className="flex flex-col gap-0.5">
                            <span className="font-mono text-xs">{ap.due_date || '-'}</span>
                            {ap.is_overdue && (
                                <Badge variant="destructive" className="text-[10px] w-fit px-1.5 py-0">
                                    Jatuh Tempo!
                                </Badge>
                            )}
                        </div>
                    )
                },
            },
            {
                accessorKey: 'total_amount',
                header: () => (
                    <DataTableSortHeader
                        label="Total Tagihan"
                        field="total_amount"
                        tableSort={filters.table_sort}
                        tableDirection={filters.table_direction}
                        toolbarSort={filters.sort}
                        toolbarDirection={filters.direction}
                        onSort={handleSort}
                    />
                ),
                size: 145,
                cell: ({ row }) => (
                    <span className="font-mono text-xs font-semibold">{formatRupiah(row.original.total_amount)}</span>
                ),
            },
            {
                accessorKey: 'remaining_amount',
                header: () => (
                    <DataTableSortHeader
                        label="Sisa Hutang"
                        field="remaining_amount"
                        tableSort={filters.table_sort}
                        tableDirection={filters.table_direction}
                        toolbarSort={filters.sort}
                        toolbarDirection={filters.direction}
                        onSort={handleSort}
                    />
                ),
                size: 150,
                cell: ({ row }) => (
                    <span
                        className={`font-mono text-xs font-bold ${
                            row.original.remaining_amount > 0
                                ? 'text-rose-600 dark:text-rose-400'
                                : 'text-emerald-600 dark:text-emerald-400'
                        }`}
                    >
                        {formatRupiah(row.original.remaining_amount)}
                    </span>
                ),
            },
            {
                accessorKey: 'status',
                header: 'Status',
                size: 135,
                cell: ({ row }) => {
                    const cfg = paymentStatusBadgeConfig[row.original.status] ?? {
                        label: row.original.status_label,
                        className: '',
                    }
                    return (
                        <Badge variant="outline" className={`text-[11px] ${cfg.className}`}>
                            {cfg.label}
                        </Badge>
                    )
                },
            },
            {
                id: 'actions',
                header: () => <span className="text-right block w-full pr-2">Aksi</span>,
                size: 95,
                cell: ({ row }) => {
                    const ap = row.original
                    return (
                        <div className="flex justify-end pr-2">
                            {ap.can_pay ? (
                                <Button
                                    size="xs"
                                    variant="outline"
                                    onClick={() => setPayingRow(ap)}
                                    className="gap-1 border-primary/40 text-primary hover:bg-primary/5"
                                >
                                    <CreditCard className="h-3 w-3" />
                                    Bayar
                                </Button>
                            ) : (
                                <Link
                                    href={PurchaseOrderController.show.url(ap.purchase_order_id)}
                                    className="text-xs text-muted-foreground hover:text-foreground underline"
                                >
                                    Detail
                                </Link>
                            )}
                        </div>
                    )
                },
            },
        ],
        [payables.from, filters.table_sort, filters.table_direction, filters.sort, filters.direction]
    )

    const statusItems = [{ value: 'all', label: 'Semua Status' }, ...paymentStatuses]
    const dueItems = [
        { value: 'all', label: 'Semua Jatuh Tempo' },
        { value: 'overdue', label: 'Lewat Jatuh Tempo' },
        { value: 'due_soon', label: 'Jatuh Tempo ≤ 7 Hari' },
        { value: 'not_due', label: 'Belum Jatuh Tempo' },
    ]

    return (
        <div className="w-full min-w-0 space-y-6">
            <div>
                <h1 className="text-2xl font-bold tracking-tight">Hutang Dagang (Account Payables)</h1>
                <p className="text-sm text-muted-foreground">
                    Pantau tagihan supplier dari Purchase Order, jatuh tempo, dan lakukan pembayaran cepat.
                </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Card>
                    <CardContent className="p-4 flex items-center justify-between">
                        <div>
                            <p className="text-xs text-muted-foreground">Total Hutang Belum Lunas</p>
                            <p className="text-lg font-extrabold font-mono text-primary mt-0.5">
                                {formatRupiah(summary.total_outstanding)}
                            </p>
                        </div>
                        <FileWarning className="h-8 w-8 text-primary/30" />
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-4 flex items-center justify-between">
                        <div>
                            <p className="text-xs text-muted-foreground">
                                Lewat Jatuh Tempo ({summary.overdue_count} tagihan)
                            </p>
                            <p className="text-lg font-extrabold font-mono text-rose-600 dark:text-rose-400 mt-0.5">
                                {formatRupiah(summary.overdue_amount)}
                            </p>
                        </div>
                        <AlertTriangle className="h-8 w-8 text-rose-500/30" />
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-4 flex items-center justify-between">
                        <div>
                            <p className="text-xs text-muted-foreground">Jatuh Tempo 7 Hari Ke Depan</p>
                            <p className="text-lg font-bold font-mono text-amber-600 dark:text-amber-400 mt-0.5">
                                {formatRupiah(summary.due_soon_amount)}
                            </p>
                        </div>
                        <Clock className="h-8 w-8 text-amber-500/30" />
                    </CardContent>
                </Card>
            </div>

            {/* Filter Toolbar */}
            <div className="flex flex-wrap items-center gap-2.5">
                <div className="relative w-full sm:w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                    <Input
                        placeholder="Cari No. AP / PO / supplier..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="pl-9 h-9 text-sm"
                    />
                </div>

                <Select
                    items={statusItems}
                    value={status}
                    onValueChange={(val) => {
                        if (!val) return
                        setStatus(val)
                        router.visit(
                            AccountPayableController.index({
                                mergeQuery: { status: val !== 'all' ? val : undefined, page: 1 },
                            }),
                            { preserveState: true, preserveScroll: true, replace: true }
                        )
                    }}
                >
                    <SelectTrigger className="w-full sm:w-[175px] h-9">
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

                <Select
                    items={dueItems}
                    value={dueFilter}
                    onValueChange={(val) => {
                        if (!val) return
                        setDueFilter(val)
                        router.visit(
                            AccountPayableController.index({
                                mergeQuery: { due_filter: val !== 'all' ? val : undefined, page: 1 },
                            }),
                            { preserveState: true, preserveScroll: true, replace: true }
                        )
                    }}
                >
                    <SelectTrigger className="w-full sm:w-[195px] h-9">
                        <SelectValue placeholder="Semua Jatuh Tempo">
                            {(val) => dueItems.find((i) => i.value === val)?.label}
                        </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                        {dueItems.map((i) => (
                            <SelectItem key={i.value} value={i.value}>
                                {i.label}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>

                {(search || status !== 'all' || dueFilter !== 'all') && (
                    <Button
                        variant="outline"
                        size="sm"
                        className="h-9 text-xs gap-1"
                        onClick={() => {
                            isFirstRender.current = true
                            setSearch('')
                            setStatus('all')
                            setDueFilter('all')
                            router.visit(AccountPayableController.index.url(), {
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
                data={payables.data ?? []}
                tableKey="account-payables-table"
                emptyMessage="Tidak ada data hutang dagang."
                isLoading={isLoading}
            />

            <DataTablePagination
                meta={payables}
                routeUrl={AccountPayableController.index}
                isLoading={isLoading}
            />

            {payingRow && (
                <RecordPaymentDialog
                    postUrl={AccountPayableController.recordPayment.url(payingRow.id)}
                    title={`Bayar Hutang: ${payingRow.payable_number}`}
                    subtitle={`Supplier: ${payingRow.supplier_name} • PO: ${payingRow.po_number}`}
                    remainingAmount={payingRow.remaining_amount}
                    invoiceNumber={payingRow.invoice_number}
                    financialAccounts={financialAccounts}
                    paymentMethods={paymentMethods}
                    open={Boolean(payingRow)}
                    onOpenChange={(open) => {
                        if (!open) setPayingRow(null)
                    }}
                />
            )}
        </div>
    )
}

AccountPayablePage.layout = (page: React.ReactNode) => (
    <AuthenticatedLayout>{page}</AuthenticatedLayout>
)

export default AccountPayablePage

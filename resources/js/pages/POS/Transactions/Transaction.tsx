import React, { useMemo, useState } from 'react'
import { Link, router, usePage } from '@inertiajs/react'
import { Ban, CircleDollarSign, Receipt, RotateCcw, ShoppingCart } from 'lucide-react'
import AuthenticatedLayout from '@/layouts/AuthenticatedLayout'
import { DataTable } from '@/components/dataTable'
import DataTablePagination, { type PaginationMeta } from '@/components/dataTablePagination'
import { Button } from '@/components/ui/button'
import { SummaryStatCard, SummaryStatGrid } from '@/components/SummaryStatCard'
import { formatDateRangeLabel, formatNumber, formatPercent, formatRupiah } from '@/lib/utils'
import cashier from '@/routes/pos/cashier'
import transactions from '@/routes/pos/transactions'
import type { PageProps, TransactionRow } from '@/types'
import { getTransactionColumns } from './component/transactionColumns'
import { TransactionSearch, type TransactionFilters } from './component/TransactionSearch'

type TransactionPageProps = PageProps<{
    transactions: PaginationMeta & { data: TransactionRow[] }
    filters: TransactionFilters
    summary: {
        total_transactions: number
        completed_count: number
        refunded_count: number
        voided_count: number
        total_sales: number
        voided_amount: number
    }
    cashiers: { id: number; name: string; role_name: string }[]
    canViewAll: boolean
    statusOptions: { value: string; label: string }[]
    paymentMethodOptions: { value: string; label: string }[]
}>

const Transaction = () => {
    const {
        transactions: paginated,
        filters,
        summary,
        cashiers,
        canViewAll,
        statusOptions,
        paymentMethodOptions,
    } = usePage<TransactionPageProps>().props

    const [isLoading, setIsLoading] = useState(false)

    const handleFilterStatus = (status?: string) => {
        const nextStatus = status && filters.status === status ? undefined : status
        router.visit(
            transactions.index({
                mergeQuery: {
                    status: nextStatus,
                    page: 1,
                },
            }),
            {
                preserveState: true,
                preserveScroll: true,
                replace: true,
                onStart: () => setIsLoading(true),
                onFinish: () => setIsLoading(false),
            }
        )
    }

    const handleTableSort = (field: string) => {
        let nextSort: string | undefined = field
        let nextDir: string | undefined = 'asc'

        if (filters.table_sort === field) {
            if (filters.table_direction === 'asc') {
                nextDir = 'desc'
            } else {
                nextSort = undefined
                nextDir = undefined
            }
        }

        router.visit(
            transactions.index({
                mergeQuery: {
                    table_sort: nextSort,
                    table_direction: nextDir,
                    page: 1,
                },
            }),
            {
                preserveState: true,
                preserveScroll: true,
                replace: true,
                onStart: () => setIsLoading(true),
                onFinish: () => setIsLoading(false),
            }
        )
    }

    const columns = useMemo(
        () => getTransactionColumns(paginated.from, filters, handleTableSort),
        [paginated.from, filters]
    )

    return (
        <div className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-foreground">
                        Riwayat Transaksi POS
                    </h1>
                    <p className="text-sm text-muted-foreground">
                        Pantau transaksi penjualan, cetak ulang struk, pembatalan (void), dan proses retur barang.
                    </p>
                </div>

                <Link href={cashier.index.url()}>
                    <Button className="gap-2 cursor-pointer">
                        <ShoppingCart className="h-4 w-4" />
                        Buka Terminal Kasir
                    </Button>
                </Link>
            </div>

            <SummaryStatGrid>
                <SummaryStatCard
                    title="Total Transaksi"
                    value={formatNumber(summary.total_transactions)}
                    icon={Receipt}
                    variant="blue"
                    subInfo={`${formatNumber(summary.completed_count)} selesai (${formatPercent(summary.completed_count, summary.total_transactions)})`}
                    periodLabel={formatDateRangeLabel(
                        filters.start_date,
                        filters.end_date,
                        canViewAll ? 'Semua Kasir' : 'Kasir Saya'
                    )}
                    isActive={!filters.status || filters.status === 'all'}
                    onClick={() => handleFilterStatus(undefined)}
                />
                <SummaryStatCard
                    title="Total Penjualan"
                    value={formatRupiah(summary.total_sales)}
                    icon={CircleDollarSign}
                    variant="emerald"
                    subInfo="Transaksi aktif (non-void)"
                    periodLabel={formatDateRangeLabel(filters.start_date, filters.end_date, 'Semua Data')}
                    isActive={filters.status === 'completed'}
                    onClick={() => handleFilterStatus('completed')}
                />
                <SummaryStatCard
                    title="Transaksi Retur"
                    value={formatNumber(summary.refunded_count)}
                    icon={RotateCcw}
                    variant="amber"
                    subInfo="Retur sebagian & penuh"
                    periodLabel={formatDateRangeLabel(filters.start_date, filters.end_date, 'Retur')}
                    isActive={filters.status === 'refunded'}
                    onClick={() => handleFilterStatus('refunded')}
                />
                <SummaryStatCard
                    title="Transaksi Dibatalkan (Void)"
                    value={formatNumber(summary.voided_count)}
                    icon={Ban}
                    variant="rose"
                    subInfo={`Nominal void: ${formatRupiah(summary.voided_amount)}`}
                    periodLabel={formatDateRangeLabel(filters.start_date, filters.end_date, 'Void')}
                    isActive={filters.status === 'voided'}
                    onClick={() => handleFilterStatus('voided')}
                />
            </SummaryStatGrid>

            <TransactionSearch
                filters={filters}
                cashiers={cashiers}
                canViewAll={canViewAll}
                statusOptions={statusOptions}
                paymentMethodOptions={paymentMethodOptions}
                isLoading={isLoading}
            />

            <DataTable
                columns={columns}
                data={paginated.data}
                tableKey="pos-transactions-table"
                emptyMessage="Belum ada transaksi penjualan yang sesuai dengan filter."
                isLoading={isLoading}
            />

            <DataTablePagination
                meta={paginated}
                routeUrl={transactions.index}
                isLoading={isLoading}
            />
        </div>
    )
}

Transaction.layout = (page: React.ReactNode) => <AuthenticatedLayout>{page}</AuthenticatedLayout>

export default Transaction

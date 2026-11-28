import React, { useMemo, useState } from 'react'
import { Link, router, usePage } from '@inertiajs/react'
import { ShoppingCart } from 'lucide-react'
import AuthenticatedLayout from '@/layouts/AuthenticatedLayout'
import { DataTable } from '@/components/dataTable'
import DataTablePagination, { type PaginationMeta } from '@/components/dataTablePagination'
import { Button } from '@/components/ui/button'
import cashier from '@/routes/pos/cashier'
import transactions from '@/routes/pos/transactions'
import type { PageProps, TransactionRow } from '@/types'
import { getTransactionColumns } from './component/transactionColumns'
import { TransactionSearch, type TransactionFilters } from './component/TransactionSearch'

type TransactionPageProps = PageProps<{
    transactions: PaginationMeta & { data: TransactionRow[] }
    filters: TransactionFilters
    cashiers: { id: number; name: string; role_name: string }[]
    canViewAll: boolean
    statusOptions: { value: string; label: string }[]
    paymentMethodOptions: { value: string; label: string }[]
}>

const Transaction = () => {
    const {
        transactions: paginated,
        filters,
        cashiers,
        canViewAll,
        statusOptions,
        paymentMethodOptions,
    } = usePage<TransactionPageProps>().props

    const [isLoading, setIsLoading] = useState(false)

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

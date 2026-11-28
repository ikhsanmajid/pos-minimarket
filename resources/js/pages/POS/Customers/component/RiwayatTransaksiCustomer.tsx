import React, { useMemo } from 'react'
import { Link } from '@inertiajs/react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { DataTable, type DataTableColumn } from '@/components/dataTable'
import DataTablePagination, { type PaginationMeta } from '@/components/dataTablePagination'
import { cn, formatRupiah } from '@/lib/utils'
import { Eye, Loader2, RefreshCw } from 'lucide-react'
import CustomerController from '@/actions/App/Http/Controllers/CustomerController'
import TransactionController from '@/actions/App/Http/Controllers/TransactionController'
import type { CustomerRow } from '../Customer'

export interface CustomerTransactionRow {
    id: number
    invoice_number: string
    created_at: string
    cashier_name: string
    items_count: number
    grand_total: number
    payment_methods: string[]
    status: string
    status_label: string
}

export interface PaginatedCustomerTransactions extends PaginationMeta {
    data: CustomerTransactionRow[]
}

interface RiwayatTransaksiCustomerProps {
    customer: CustomerRow
    transactions?: PaginatedCustomerTransactions
    isLoading?: boolean
    onRefresh?: () => void
}

const statusClasses: Record<string, string> = {
    completed:
        'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800',
    voided: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800',
    partially_refunded:
        'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800',
    refunded:
        'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-900 dark:text-slate-300 dark:border-slate-700',
}

export function RiwayatTransaksiCustomer({
    customer,
    transactions,
    isLoading = false,
    onRefresh,
}: RiwayatTransaksiCustomerProps) {
    const columns: DataTableColumn<CustomerTransactionRow>[] = useMemo(
        () => [
            {
                id: 'no',
                header: 'No',
                cell: (info) => (
                    <span className="font-mono text-xs text-muted-foreground">
                        {(transactions?.from ?? 1) + info.row.index}
                    </span>
                ),
                size: 55,
            },
            {
                accessorKey: 'invoice_number',
                header: 'No. Struk / Waktu',
                size: 190,
                cell: ({ row }) => (
                    <div className="flex flex-col min-w-0">
                        <Link
                            href={TransactionController.show.url(row.original.id)}
                            className="font-mono text-xs font-semibold text-primary hover:underline truncate"
                        >
                            {row.original.invoice_number}
                        </Link>
                        <span className="font-mono text-[11px] text-muted-foreground">
                            {row.original.created_at}
                        </span>
                    </div>
                ),
            },
            {
                accessorKey: 'cashier_name',
                header: 'Kasir',
                size: 150,
                cell: ({ row }) => (
                    <span className="text-xs text-foreground truncate block">
                        {row.original.cashier_name}
                    </span>
                ),
            },
            {
                accessorKey: 'items_count',
                header: 'Item',
                size: 90,
                cell: ({ row }) => (
                    <Badge variant="secondary" className="font-mono text-xs">
                        {row.original.items_count} item
                    </Badge>
                ),
            },
            {
                accessorKey: 'payment_methods',
                header: 'Pembayaran',
                size: 140,
                cell: ({ row }) => (
                    <div className="flex flex-wrap gap-1">
                        {row.original.payment_methods.length > 0 ? (
                            row.original.payment_methods.map((method) => (
                                <Badge key={method} variant="outline" className="text-[10px] py-0">
                                    {method}
                                </Badge>
                            ))
                        ) : (
                            <span className="text-xs text-muted-foreground">-</span>
                        )}
                    </div>
                ),
            },
            {
                accessorKey: 'grand_total',
                header: 'Total Belanja',
                size: 140,
                cell: ({ row }) => (
                    <span className="font-mono text-xs font-semibold text-foreground">
                        {formatRupiah(row.original.grand_total)}
                    </span>
                ),
            },
            {
                accessorKey: 'status',
                header: 'Status',
                size: 130,
                cell: ({ row }) => (
                    <Badge
                        variant="outline"
                        className={`text-[11px] ${statusClasses[row.original.status] ?? ''}`}
                    >
                        {row.original.status_label}
                    </Badge>
                ),
            },
            {
                id: 'actions',
                header: () => <span className="text-right block w-full pr-2">Aksi</span>,
                size: 80,
                cell: ({ row }) => (
                    <div className="flex justify-end pr-2">
                        <Button
                            variant="ghost"
                            size="sm"
                            render={<Link href={TransactionController.show.url(row.original.id)} />}
                            className="h-8 gap-1 text-xs text-muted-foreground hover:text-foreground"
                        >
                            <Eye className="h-3.5 w-3.5" />
                            Detail
                        </Button>
                    </div>
                ),
            },
        ],
        [transactions?.from]
    )

    if (!transactions && isLoading) {
        return (
            <div className="flex min-h-[220px] flex-col items-center justify-center rounded-lg border border-dashed p-8 text-center bg-card">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <h3 className="mt-4 text-sm font-semibold text-foreground">Memuat riwayat transaksi…</h3>
                <p className="mt-1 text-xs text-muted-foreground">
                    Sedang mengambil daftar struk belanja untuk {customer.name}.
                </p>
            </div>
        )
    }

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h3 className="text-base font-semibold text-foreground">Riwayat Transaksi Belanja</h3>
                    <p className="text-xs text-muted-foreground">
                        {transactions
                            ? `Menampilkan ${transactions.total} struk transaksi milik ${customer.name}.`
                            : `Daftar transaksi belanja untuk ${customer.name}.`}
                    </p>
                </div>
                {onRefresh && (
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={onRefresh}
                        disabled={isLoading}
                        className="h-8 gap-1.5 text-xs text-muted-foreground hover:text-foreground"
                    >
                        <RefreshCw className={cn('h-3.5 w-3.5', isLoading && 'animate-spin')} />
                        Muat Ulang
                    </Button>
                )}
            </div>

            <DataTable
                columns={columns}
                data={transactions?.data ?? []}
                tableKey={`customer-transactions-${customer.id}`}
                emptyMessage="Pelanggan ini belum memiliki riwayat transaksi belanja."
                isLoading={isLoading}
            />

            {transactions && (
                <DataTablePagination
                    meta={transactions}
                    routeUrl={(opts) => CustomerController.show(customer.id, opts)}
                    only={['transactions']}
                    isLoading={isLoading}
                />
            )}
        </div>
    )
}

export default RiwayatTransaksiCustomer

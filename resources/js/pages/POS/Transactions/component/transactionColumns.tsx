import React from 'react'
import { Link } from '@inertiajs/react'
import { Eye } from 'lucide-react'
import type { DataTableColumn } from '@/components/dataTable'
import { DataTableSortHeader } from '@/components/dataTableSortHeader'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import transactions from '@/routes/pos/transactions'
import type { TransactionRow } from '@/types'
import type { TransactionFilters } from './TransactionSearch'
import { formatRupiah, getTransactionStatusBadgeClass } from './transactionUtils'

export function getTransactionColumns(
    from: number | null,
    filters: TransactionFilters,
    onSort: (field: string) => void
): DataTableColumn<TransactionRow>[] {
    return [
        {
            id: 'no',
            header: 'No',
            cell: (info) => (
                <span className="font-mono text-xs text-muted-foreground">
                    {(from ?? 1) + info.row.index}
                </span>
            ),
            size: 55,
        },
        {
            accessorKey: 'invoice_number',
            header: () => (
                <DataTableSortHeader
                    label="No. Invoice"
                    field="invoice_number"
                    tableSort={filters.table_sort}
                    tableDirection={filters.table_direction}
                    toolbarSort={filters.sort}
                    toolbarDirection={filters.direction}
                    onSort={onSort}
                />
            ),
            cell: ({ row }) => (
                <Link
                    href={transactions.show.url({ transaction: row.original.id })}
                    className="font-mono text-xs font-semibold text-primary hover:underline"
                >
                    {row.original.invoice_number}
                </Link>
            ),
            size: 165,
        },
        {
            accessorKey: 'created_at',
            header: () => (
                <DataTableSortHeader
                    label="Waktu"
                    field="created_at"
                    tableSort={filters.table_sort}
                    tableDirection={filters.table_direction}
                    toolbarSort={filters.sort}
                    toolbarDirection={filters.direction}
                    onSort={onSort}
                />
            ),
            cell: (info) => (
                <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {info.getValue<string>()}
                </span>
            ),
            size: 145,
        },
        {
            accessorKey: 'cashier_name',
            header: 'Kasir / Pelanggan',
            cell: ({ row }) => (
                <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                        {row.original.cashier_name}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                        {row.original.customer_name} • {row.original.items_count} item
                    </p>
                </div>
            ),
            size: 185,
        },
        {
            accessorKey: 'payment_methods',
            header: 'Pembayaran',
            cell: ({ row }) => (
                <div className="flex flex-wrap gap-1">
                    {row.original.payment_methods.map((label) => (
                        <Badge key={label} variant="outline" className="text-[11px] font-normal">
                            {label}
                        </Badge>
                    ))}
                </div>
            ),
            size: 155,
        },
        {
            accessorKey: 'grand_total',
            header: () => (
                <DataTableSortHeader
                    label="Grand Total"
                    field="grand_total"
                    tableSort={filters.table_sort}
                    tableDirection={filters.table_direction}
                    toolbarSort={filters.sort}
                    toolbarDirection={filters.direction}
                    onSort={onSort}
                />
            ),
            cell: (info) => (
                <span className="font-mono text-xs font-semibold text-foreground">
                    {formatRupiah(info.getValue<number>())}
                </span>
            ),
            size: 135,
        },
        {
            accessorKey: 'status',
            header: () => (
                <DataTableSortHeader
                    label="Status"
                    field="status"
                    tableSort={filters.table_sort}
                    tableDirection={filters.table_direction}
                    toolbarSort={filters.sort}
                    toolbarDirection={filters.direction}
                    onSort={onSort}
                />
            ),
            cell: ({ row }) => (
                <span
                    className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${getTransactionStatusBadgeClass(row.original.status)}`}
                >
                    {row.original.status_label}
                </span>
            ),
            size: 140,
        },
        {
            id: 'actions',
            header: () => <span className="text-right block w-full pr-2">Aksi</span>,
            size: 90,
            cell: ({ row }) => (
                <div className="flex justify-end pr-2">
                    <Link href={transactions.show.url({ transaction: row.original.id })}>
                        <Button variant="outline" size="sm" className="h-7 gap-1 px-2.5 text-xs cursor-pointer">
                            <Eye className="h-3.5 w-3.5" />
                            Detail
                        </Button>
                    </Link>
                </div>
            ),
        },
    ]
}

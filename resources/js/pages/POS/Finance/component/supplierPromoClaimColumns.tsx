import React from 'react'
import type { DataTableColumn } from '@/components/dataTable'
import { DataTableSortHeader } from '@/components/dataTableSortHeader'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ClipboardCheck } from 'lucide-react'

export interface SupplierPromoClaimRow {
    id: number
    transaction_id: number
    invoice_number: string
    transaction_date: string
    description: string
    funding: string
    funding_label: string
    supplier_id: number | null
    supplier_name: string
    discount_amount: number
    store_discount_amount: number
    supplier_discount_amount: number
    claim_status: 'pending' | 'claimed' | 'paid' | string
    settlement_method: 'credit_note' | 'free_goods' | 'transfer_reimburse' | null
    settlement_method_label: string | null
    settlement_detail: string | null
    claimed_at: string | null
    claim_reference: string | null
    claim_notes: string | null
    settled_by_name: string | null
}

export interface SupplierPromoClaimFilters {
    search?: string
    supplier_id?: string
    claim_status?: string
    settlement_method?: string
    date_from?: string
    date_to?: string
    sort?: string
    direction?: string
    table_sort?: string
    table_direction?: string
}

export function formatIdrCurrency(amount: number): string {
    return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(amount)
}

interface GetSupplierPromoClaimColumnsParams {
    from?: number
    filters: SupplierPromoClaimFilters
    selectedIds: number[]
    allUnsettledChecked: boolean
    hasUnsettledRows: boolean
    onToggleAll: () => void
    onToggleRow: (id: number) => void
    onSort: (field: string) => void
    onSettleRow: (row: SupplierPromoClaimRow) => void
}

export function getSupplierPromoClaimColumns({
    from = 1,
    filters,
    selectedIds,
    allUnsettledChecked,
    hasUnsettledRows,
    onToggleAll,
    onToggleRow,
    onSort,
    onSettleRow,
}: GetSupplierPromoClaimColumnsParams): DataTableColumn<SupplierPromoClaimRow>[] {
    return [
        {
            id: 'select',
            size: 44,
            header: () => (
                <div className="flex justify-center">
                    <input
                        type="checkbox"
                        checked={allUnsettledChecked}
                        disabled={!hasUnsettledRows}
                        onChange={onToggleAll}
                        className="rounded border-input cursor-pointer"
                        title="Pilih semua klaim yang belum lunas"
                    />
                </div>
            ),
            cell: ({ row }) => {
                const isPaid = row.original.claim_status === 'paid'
                return (
                    <div className="flex justify-center">
                        {isPaid ? (
                            <span className="text-muted-foreground/40 text-xs">-</span>
                        ) : (
                            <input
                                type="checkbox"
                                checked={selectedIds.includes(row.original.id)}
                                onChange={() => onToggleRow(row.original.id)}
                                className="rounded border-input cursor-pointer"
                            />
                        )}
                    </div>
                )
            },
        },
        {
            id: 'no',
            header: 'No',
            size: 55,
            cell: (info) => (
                <span className="font-mono text-xs text-muted-foreground">
                    {from + info.row.index}
                </span>
            ),
        },
        {
            accessorKey: 'created_at',
            size: 165,
            header: () => (
                <DataTableSortHeader
                    label="Invoice & Tanggal"
                    field="created_at"
                    tableSort={filters.table_sort}
                    tableDirection={filters.table_direction}
                    toolbarSort={filters.sort}
                    toolbarDirection={filters.direction}
                    onSort={onSort}
                />
            ),
            cell: ({ row }) => (
                <div className="min-w-0">
                    <div className="font-mono text-xs font-semibold text-foreground truncate">
                        {row.original.invoice_number}
                    </div>
                    <div className="font-mono text-[11px] text-muted-foreground truncate">
                        {row.original.transaction_date}
                    </div>
                </div>
            ),
        },
        {
            accessorKey: 'description',
            size: 225,
            header: 'Promo / Voucher',
            cell: ({ row }) => (
                <div className="min-w-0">
                    <div
                        className="text-xs font-medium text-foreground truncate"
                        title={row.original.description}
                    >
                        {row.original.description}
                    </div>
                    <div className="mt-0.5 flex items-center gap-1.5">
                        <Badge variant="outline" className="text-[10px] h-4 px-1.5">
                            {row.original.funding_label}
                        </Badge>
                        <span className="font-mono text-[10px] text-muted-foreground">
                            Total: {formatIdrCurrency(row.original.discount_amount)}
                        </span>
                    </div>
                </div>
            ),
        },
        {
            accessorKey: 'supplier_name',
            size: 160,
            header: 'Supplier',
            cell: ({ row }) => (
                <span
                    className="text-xs font-medium text-foreground truncate block"
                    title={row.original.supplier_name}
                >
                    {row.original.supplier_name}
                </span>
            ),
        },
        {
            accessorKey: 'supplier_discount_amount',
            size: 145,
            header: () => (
                <DataTableSortHeader
                    label="Porsi Supplier"
                    field="supplier_discount_amount"
                    tableSort={filters.table_sort}
                    tableDirection={filters.table_direction}
                    toolbarSort={filters.sort}
                    toolbarDirection={filters.direction}
                    onSort={onSort}
                />
            ),
            cell: ({ row }) => (
                <div className="min-w-0">
                    <div className="font-mono text-xs font-semibold text-primary">
                        {formatIdrCurrency(row.original.supplier_discount_amount)}
                    </div>
                    {row.original.store_discount_amount > 0 && (
                        <div className="font-mono text-[10px] text-muted-foreground">
                            Toko: {formatIdrCurrency(row.original.store_discount_amount)}
                        </div>
                    )}
                </div>
            ),
        },
        {
            accessorKey: 'claim_status',
            size: 220,
            header: () => (
                <DataTableSortHeader
                    label="Status & Penyelesaian"
                    field="claim_status"
                    tableSort={filters.table_sort}
                    tableDirection={filters.table_direction}
                    toolbarSort={filters.sort}
                    toolbarDirection={filters.direction}
                    onSort={onSort}
                />
            ),
            cell: ({ row }) => {
                const { claim_status, settlement_method_label, settlement_detail, claim_reference } =
                    row.original
                return (
                    <div className="min-w-0 space-y-0.5">
                        <div className="flex flex-wrap items-center gap-1">
                            {claim_status === 'paid' ? (
                                <Badge variant="success" className="text-[10px]">
                                    Lunas / Selesai
                                </Badge>
                            ) : claim_status === 'claimed' ? (
                                <Badge
                                    variant="secondary"
                                    className="text-[10px] border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950/60 dark:text-blue-300"
                                >
                                    Diajukan
                                </Badge>
                            ) : (
                                <Badge
                                    variant="outline"
                                    className="text-[10px] border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/60 dark:text-amber-300"
                                >
                                    Belum Diklaim
                                </Badge>
                            )}
                            {settlement_method_label && (
                                <Badge variant="outline" className="text-[10px] truncate max-w-[140px]">
                                    {settlement_method_label}
                                </Badge>
                            )}
                        </div>
                        {settlement_detail && (
                            <p
                                className="text-[11px] text-muted-foreground truncate"
                                title={settlement_detail}
                            >
                                {settlement_detail}
                            </p>
                        )}
                        {claim_reference && (
                            <p
                                className="font-mono text-[10px] text-muted-foreground truncate"
                                title={claim_reference}
                            >
                                Ref: {claim_reference}
                            </p>
                        )}
                    </div>
                )
            },
        },
        {
            id: 'actions',
            header: () => <span className="text-right block w-full pr-2">Aksi</span>,
            size: 115,
            cell: ({ row }) => (
                <div className="flex justify-end pr-2">
                    {row.original.claim_status === 'paid' ? (
                        <span className="text-xs text-muted-foreground">Selesai</span>
                    ) : (
                        <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => onSettleRow(row.original)}
                            className="h-7 px-2.5 gap-1 text-xs cursor-pointer"
                        >
                            <ClipboardCheck className="h-3.5 w-3.5" />
                            Selesaikan
                        </Button>
                    )}
                </div>
            ),
        },
    ]
}

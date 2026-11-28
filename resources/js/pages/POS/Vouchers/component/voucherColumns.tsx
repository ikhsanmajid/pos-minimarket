import React from 'react'
import type { DataTableColumn } from '@/components/dataTable'
import { DataTableSortHeader } from '@/components/dataTableSortHeader'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { VoucherRow } from '@/types'
import { Crown, Pencil, Trash2 } from 'lucide-react'
import type { VoucherFilters } from './VoucherSearch'

const formatRupiah = (val: number | null | undefined): string =>
    new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0,
    }).format(Number(val ?? 0))

function formatBenefitSummary(voucher: VoucherRow): string {
    switch (voucher.type) {
        case 'percentage': {
            const base = `Diskon ${voucher.value}%`
            return voucher.max_discount
                ? `${base} (maks. ${formatRupiah(voucher.max_discount)})`
                : base
        }
        case 'free_item':
            return voucher.free_product_name
                ? `Gratis: ${voucher.free_product_name}`
                : 'Gratis 1 Produk'
        case 'cash_voucher':
            return `Voucher Tunai ${formatRupiah(voucher.value)}`
        case 'product_specific':
            return `Potongan Produk ${formatRupiah(voucher.value)}`
        default:
            return `Potongan ${formatRupiah(voucher.value)}`
    }
}

function renderStatusBadge(status: string): React.ReactNode {
    switch (status) {
        case 'active':
            return <Badge variant="success">Aktif</Badge>
        case 'draft':
            return <Badge variant="secondary">Draft</Badge>
        case 'paused':
            return (
                <Badge
                    variant="outline"
                    className="border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/60 dark:text-amber-300"
                >
                    Dijeda
                </Badge>
            )
        case 'exhausted':
            return (
                <Badge
                    variant="outline"
                    className="border-orange-300 bg-orange-50 text-orange-800 dark:border-orange-800 dark:bg-orange-950/60 dark:text-orange-300"
                >
                    Kuota Habis
                </Badge>
            )
        case 'expired':
            return (
                <Badge
                    variant="outline"
                    className="border-rose-300 bg-rose-50 text-rose-700 dark:border-rose-800 dark:bg-rose-950/60 dark:text-rose-300"
                >
                    Kedaluwarsa
                </Badge>
            )
        default:
            return <Badge variant="secondary">{status}</Badge>
    }
}

export function getVoucherColumns({
    from = 1,
    filters,
    onSort,
    onEdit,
    onDelete,
}: {
    from?: number
    filters: VoucherFilters
    onSort: (field: string) => void
    onEdit: (voucher: VoucherRow) => void
    onDelete: (voucher: VoucherRow) => void
}): DataTableColumn<VoucherRow>[] {
    return [
        {
            id: 'no',
            header: 'No',
            cell: ({ row }) => (from ?? 1) + row.index,
            size: 55,
        },
        {
            id: 'code',
            accessorKey: 'code',
            header: () => (
                <DataTableSortHeader
                    label="Kode & Nama Voucher"
                    field="code"
                    tableSort={filters.table_sort}
                    tableDirection={filters.table_direction}
                    toolbarSort={filters.sort}
                    toolbarDirection={filters.direction}
                    onSort={onSort}
                />
            ),
            cell: ({ row }) => {
                const v = row.original
                return (
                    <div className="space-y-0.5 min-w-0">
                        <div className="flex items-center gap-1.5 min-w-0">
                            <span className="font-mono text-xs font-semibold text-primary truncate" title={v.code}>
                                {v.code}
                            </span>
                            {v.member_only && (
                                <Badge
                                    variant="outline"
                                    className="h-4 px-1.5 py-0 text-[10px] gap-0.5 shrink-0 border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/60 dark:text-amber-300"
                                >
                                    <Crown className="h-2.5 w-2.5" />
                                    Member
                                </Badge>
                            )}
                        </div>
                        <p className="text-xs font-medium text-foreground truncate" title={v.name}>
                            {v.name}
                        </p>
                    </div>
                )
            },
            size: 245,
        },
        {
            id: 'type',
            accessorKey: 'type',
            header: () => (
                <DataTableSortHeader
                    label="Tipe & Manfaat"
                    field="type"
                    tableSort={filters.table_sort}
                    tableDirection={filters.table_direction}
                    toolbarSort={filters.sort}
                    toolbarDirection={filters.direction}
                    onSort={onSort}
                />
            ),
            cell: ({ row }) => {
                const v = row.original
                return (
                    <div className="space-y-0.5 min-w-0">
                        <p className="text-xs font-semibold text-foreground truncate" title={formatBenefitSummary(v)}>
                            {formatBenefitSummary(v)}
                        </p>
                        <p className="text-[11px] text-muted-foreground truncate">
                            {v.type_short_label} • {v.funding_label}
                        </p>
                    </div>
                )
            },
            size: 195,
        },
        {
            id: 'used_count',
            accessorKey: 'used_count',
            header: () => (
                <DataTableSortHeader
                    label="Kuota & Min. Belanja"
                    field="used_count"
                    tableSort={filters.table_sort}
                    tableDirection={filters.table_direction}
                    toolbarSort={filters.sort}
                    toolbarDirection={filters.direction}
                    onSort={onSort}
                />
            ),
            cell: ({ row }) => {
                const v = row.original
                const quotaText =
                    v.total_quota !== null
                        ? `${v.used_count} / ${v.total_quota}`
                        : `${v.used_count} / ∞`
                return (
                    <div className="space-y-0.5 font-mono text-[11px] min-w-0">
                        <p className="font-semibold text-foreground truncate">Kuota: {quotaText}</p>
                        <p className="text-muted-foreground truncate">
                            Min: {v.min_spend > 0 ? formatRupiah(v.min_spend) : 'Tanpa min.'}
                        </p>
                    </div>
                )
            },
            size: 165,
        },
        {
            id: 'valid_from',
            accessorKey: 'valid_from',
            header: () => (
                <DataTableSortHeader
                    label="Periode Berlaku (WIB)"
                    field="valid_from"
                    tableSort={filters.table_sort}
                    tableDirection={filters.table_direction}
                    toolbarSort={filters.sort}
                    toolbarDirection={filters.direction}
                    onSort={onSort}
                />
            ),
            cell: ({ row }) => {
                const v = row.original
                return (
                    <div className="space-y-0.5 font-mono text-[11px] text-foreground min-w-0">
                        <p className="truncate">{v.valid_from_display}</p>
                        <p className="text-muted-foreground truncate">s/d {v.valid_until_display}</p>
                        {v.allowed_hours_start && v.allowed_hours_end && (
                            <p className="text-primary truncate">
                                Jam {v.allowed_hours_start}–{v.allowed_hours_end}
                            </p>
                        )}
                    </div>
                )
            },
            size: 175,
        },
        {
            id: 'status',
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
            cell: ({ row }) => renderStatusBadge(row.original.computed_status),
            size: 115,
        },
        {
            id: 'actions',
            header: () => <span className="text-right block w-full pr-2">Aksi</span>,
            cell: ({ row }) => (
                <div className="flex justify-end gap-1 pr-2">
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => onEdit(row.original)}
                        className="h-7 w-7 cursor-pointer"
                        title="Edit voucher"
                    >
                        <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => onDelete(row.original)}
                        className="h-7 w-7 text-destructive hover:text-destructive cursor-pointer"
                        title="Hapus voucher"
                    >
                        <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                </div>
            ),
            size: 80,
        },
    ]
}

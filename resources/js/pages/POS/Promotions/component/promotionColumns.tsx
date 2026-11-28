import React from 'react'
import type { DataTableColumn } from '@/components/dataTable'
import { DataTableSortHeader } from '@/components/dataTableSortHeader'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { PromotionRow } from '@/types'
import { Crown, Pencil, Trash2 } from 'lucide-react'
import type { PromotionFilters } from './PromotionSearch'

const formatRupiah = (val: number | null | undefined): string =>
    new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0,
    }).format(Number(val ?? 0))

function formatBenefitSummary(promo: PromotionRow): string {
    switch (promo.type) {
        case 'percentage_discount': {
            const base = `Diskon ${promo.discount_value ?? 0}%`
            return promo.max_discount_amount
                ? `${base} (maks. ${formatRupiah(promo.max_discount_amount)})`
                : base
        }
        case 'fixed_discount':
            return `Potongan ${formatRupiah(promo.discount_value)}/unit`
        case 'buy_x_get_y': {
            const disc = promo.get_discount_percent >= 100
                ? 'Gratis'
                : `Diskon ${promo.get_discount_percent}%`
            return `Beli ${promo.buy_qty ?? 0} ${disc} ${promo.get_qty ?? 0}`
        }
        case 'multibuy_price':
            return `${promo.buy_qty ?? 0} pcs = ${formatRupiah(promo.bundle_price)}`
        case 'nth_item_discount': {
            const val = promo.discount_value ?? 0
            const discText = val > 100 ? formatRupiah(val) : `${val || promo.get_discount_percent}%`
            return `Item ke-${promo.nth_item ?? 2} diskon ${discText}`
        }
        case 'mix_match':
            return promo.bundle_price
                ? `Mix ${promo.buy_qty ?? 2} item = ${formatRupiah(promo.bundle_price)}`
                : `Mix ${promo.buy_qty ?? 2} item hemat ${(promo.discount_value ?? 0) <= 100 ? `${promo.discount_value}%` : formatRupiah(promo.discount_value)}`
        case 'bundle':
            return `Bundel ${(promo.bundle_items ?? []).length} SKU = ${formatRupiah(promo.bundle_price)}`
        case 'near_expiry':
            return `Near Expiry ≤${promo.near_expiry_days ?? 0} hari (${promo.discount_value ?? 0}%)`
        case 'min_spend_discount':
            return `Potongan ${formatRupiah(promo.discount_value)} (min. ${formatRupiah(promo.min_purchase_amount)})`
        case 'min_spend_percent': {
            const base = `Diskon ${promo.discount_value ?? 0}% (min. ${formatRupiah(promo.min_purchase_amount)})`
            return promo.max_discount_amount ? `${base}, maks ${formatRupiah(promo.max_discount_amount)}` : base
        }
        case 'tebus_murah':
            return `Tebus ${formatRupiah(promo.special_price)} (min. ${formatRupiah(promo.min_purchase_amount)})`
        case 'gift_with_purchase':
            return `Gratis ${promo.get_qty ?? 1}x hadiah (min. ${formatRupiah(promo.min_purchase_amount)})`
        case 'payment_promo': {
            const val = promo.discount_value ?? 0
            const disc = val <= 100 ? `${val}%` : formatRupiah(val)
            const bin = promo.payment_bin_prefix ? ` BIN ${promo.payment_bin_prefix}` : ''
            return `${(promo.payment_method ?? '').toUpperCase()}${bin}: ${disc}`
        }
        case 'cashback': {
            const val = promo.discount_value ?? 0
            return `Cashback ${val <= 100 ? `${val}%` : formatRupiah(val)}`
        }
        default:
            return promo.type_label
    }
}

function renderStatusBadge(status: string): React.ReactNode {
    switch (status) {
        case 'active':
            return <Badge variant="success">Aktif</Badge>
        case 'scheduled':
            return (
                <Badge
                    variant="outline"
                    className="border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/60 dark:text-amber-300"
                >
                    Terjadwal
                </Badge>
            )
        case 'expired':
            return (
                <Badge
                    variant="outline"
                    className="border-rose-300 bg-rose-50 text-rose-700 dark:border-rose-800 dark:bg-rose-950/60 dark:text-rose-300"
                >
                    Berakhir
                </Badge>
            )
        default:
            return <Badge variant="secondary">Nonaktif</Badge>
    }
}

export function getPromotionColumns({
    from = 1,
    filters,
    onSort,
    onEdit,
    onDelete,
}: {
    from?: number
    filters: PromotionFilters
    onSort: (field: string) => void
    onEdit: (promotion: PromotionRow) => void
    onDelete: (promotion: PromotionRow) => void
}): DataTableColumn<PromotionRow>[] {
    return [
        {
            id: 'no',
            header: 'No',
            cell: ({ row }) => (from ?? 1) + row.index,
            size: 55,
        },
        {
            id: 'name',
            accessorKey: 'name',
            header: () => (
                <DataTableSortHeader
                    label="Nama Promo"
                    field="name"
                    tableSort={filters.table_sort}
                    tableDirection={filters.table_direction}
                    toolbarSort={filters.sort}
                    toolbarDirection={filters.direction}
                    onSort={onSort}
                />
            ),
            cell: ({ row }) => {
                const p = row.original
                return (
                    <div className="space-y-0.5 min-w-0">
                        <div className="flex items-center gap-1.5 min-w-0">
                            <span className="font-semibold text-sm text-foreground truncate" title={p.name}>
                                {p.name}
                            </span>
                            {p.member_only && (
                                <Badge
                                    variant="outline"
                                    className="h-4 px-1.5 py-0 text-[10px] gap-0.5 shrink-0 border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/60 dark:text-amber-300"
                                >
                                    <Crown className="h-2.5 w-2.5" />
                                    Member
                                </Badge>
                            )}
                        </div>
                        <div className="flex items-center gap-2 text-[11px] text-muted-foreground font-mono">
                            {p.code && <span className="text-primary font-semibold">{p.code}</span>}
                            <span>Prioritas: {p.priority}</span>
                            {p.exclusive_group && <span>• Grup: {p.exclusive_group}</span>}
                        </div>
                    </div>
                )
            },
            size: 240,
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
                const p = row.original
                return (
                    <div className="space-y-0.5 min-w-0">
                        <p className="text-xs font-medium text-foreground truncate">
                            {formatBenefitSummary(p)}
                        </p>
                        <p className="text-[11px] text-muted-foreground truncate">
                            {p.type_short_label} • {p.funding_label}
                        </p>
                    </div>
                )
            },
            size: 195,
        },
        {
            id: 'scope',
            header: 'Target & Kuota',
            cell: ({ row }) => {
                const p = row.original
                const targetText =
                    p.scope === 'product'
                        ? `${p.products_count} Produk`
                        : p.scope === 'category'
                          ? `${p.categories_count} Kategori`
                          : 'Semua Produk'
                const quotaText =
                    p.quota_total !== null
                        ? `Kuota: ${p.quota_used}/${p.quota_total}`
                        : 'Kuota: Tanpa batas'

                return (
                    <div className="space-y-0.5 text-xs min-w-0">
                        <p className="font-medium text-foreground truncate">{targetText}</p>
                        <p className="font-mono text-[11px] text-muted-foreground truncate">{quotaText}</p>
                    </div>
                )
            },
            size: 145,
        },
        {
            id: 'starts_at',
            accessorKey: 'starts_at',
            header: () => (
                <DataTableSortHeader
                    label="Periode Berlaku (WIB)"
                    field="starts_at"
                    tableSort={filters.table_sort}
                    tableDirection={filters.table_direction}
                    toolbarSort={filters.sort}
                    toolbarDirection={filters.direction}
                    onSort={onSort}
                />
            ),
            cell: ({ row }) => {
                const p = row.original
                return (
                    <div className="space-y-0.5 font-mono text-[11px] text-foreground min-w-0">
                        <p className="truncate">{p.starts_at_display}</p>
                        <p className="text-muted-foreground truncate">s/d {p.ends_at_display}</p>
                        {p.time_start && p.time_end && (
                            <p className="text-primary truncate">
                                Jam {p.time_start}–{p.time_end}
                            </p>
                        )}
                    </div>
                )
            },
            size: 175,
        },
        {
            id: 'is_active',
            accessorKey: 'is_active',
            header: () => (
                <DataTableSortHeader
                    label="Status"
                    field="is_active"
                    tableSort={filters.table_sort}
                    tableDirection={filters.table_direction}
                    toolbarSort={filters.sort}
                    toolbarDirection={filters.direction}
                    onSort={onSort}
                />
            ),
            cell: ({ row }) => renderStatusBadge(row.original.computed_status),
            size: 110,
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
                        title="Edit promo"
                    >
                        <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => onDelete(row.original)}
                        className="h-7 w-7 text-destructive hover:text-destructive cursor-pointer"
                        title="Hapus promo"
                    >
                        <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                </div>
            ),
            size: 80,
        },
    ]
}

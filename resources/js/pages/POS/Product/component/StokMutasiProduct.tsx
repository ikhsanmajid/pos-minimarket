import React, { useMemo } from 'react'
import { router } from '@inertiajs/react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { DataTable, type DataTableColumn } from '@/components/dataTable'
import DataTablePagination, { type PaginationMeta } from '@/components/dataTablePagination'
import { DataTableSortHeader } from '@/components/dataTableSortHeader'
import { Loader2, RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'
import ProductController from '@/actions/App/Http/Controllers/ProductController'
import type { DetailProductData } from '../DetailProduct'
import {
    StockMovementSearch,
    type StockMovementFilters,
    type StockMovementTypeOption,
} from './StockMovementSearch'

export interface StockMovementRow {
    id: number
    type: string
    type_label: string
    stock_before: number
    qty_change: number
    stock_after: number
    unit_cost: number
    notes: string | null
    creator_name: string
    created_at: string | null
}

export interface PaginatedStockMovements extends PaginationMeta {
    data: StockMovementRow[]
    filters?: StockMovementFilters
    type_options?: StockMovementTypeOption[]
}

interface StokMutasiProductProps {
    product: DetailProductData
    stockMovements?: PaginatedStockMovements
    isLoading?: boolean
    onRefresh?: () => void
}

const formatRupiah = (val: number) =>
    new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0,
    }).format(val)

export function StokMutasiProduct({
    product,
    stockMovements,
    isLoading = false,
    onRefresh,
}: StokMutasiProductProps) {
    const baseUnit = product.base_unit || 'pcs'
    const filters: StockMovementFilters = stockMovements?.filters ?? {}
    const typeOptions: StockMovementTypeOption[] = stockMovements?.type_options ?? []

    const handleSort = (field: string) => {
        if (filters.mutation_sort === field) {
            return
        }

        const isCurrent = filters.mutation_table_sort === field
        let nextSort: string | undefined = field
        let nextDirection: 'asc' | 'desc' | undefined = 'asc'

        if (isCurrent) {
            if (filters.mutation_table_dir === 'asc') {
                nextDirection = 'desc'
            } else if (filters.mutation_table_dir === 'desc') {
                nextSort = undefined
                nextDirection = undefined
            }
        }

        router.visit(
            ProductController.show(product.id, {
                mergeQuery: {
                    tab: 'mutation',
                    mutation_table_sort: nextSort,
                    mutation_table_dir: nextDirection,
                    mutation_page: 1,
                },
            }),
            {
                only: ['stockMovements'],
                preserveState: true,
                preserveScroll: true,
                replace: true,
            }
        )
    }

    const handleNavigate = (params: Record<string, string | number | undefined>) => {
        router.visit(
            ProductController.show(product.id, {
                mergeQuery: {
                    tab: 'mutation',
                    ...(params.page !== undefined ? { mutation_page: params.page } : {}),
                    ...(params.per_page !== undefined ? { mutation_per_page: params.per_page } : {}),
                },
            }),
            {
                only: ['stockMovements'],
                preserveState: true,
                preserveScroll: true,
                replace: true,
            }
        )
    }

    const columns: DataTableColumn<StockMovementRow>[] = useMemo(
        () => [
            {
                id: 'no',
                header: 'No',
                cell: (info) => {
                    const from = stockMovements?.from ?? 1
                    return (
                        <span className="font-mono text-xs text-muted-foreground">
                            {from + info.row.index}
                        </span>
                    )
                },
                size: 55,
            },
            {
                accessorKey: 'created_at',
                header: () => (
                    <DataTableSortHeader
                        label="Waktu"
                        field="created_at"
                        tableSort={filters.mutation_table_sort}
                        tableDirection={filters.mutation_table_dir}
                        toolbarSort={filters.mutation_sort}
                        toolbarDirection={filters.mutation_sort_dir}
                        onSort={handleSort}
                    />
                ),
                cell: (info) => (
                    <span className="font-mono text-xs text-muted-foreground">
                        {info.getValue<string | null>() || '-'}
                    </span>
                ),
                size: 165,
            },
            {
                accessorKey: 'type_label',
                header: () => (
                    <DataTableSortHeader
                        label="Jenis Mutasi"
                        field="type"
                        tableSort={filters.mutation_table_sort}
                        tableDirection={filters.mutation_table_dir}
                        toolbarSort={filters.mutation_sort}
                        toolbarDirection={filters.mutation_sort_dir}
                        onSort={handleSort}
                    />
                ),
                cell: (info) => {
                    const row = info.row.original
                    const isPositive = row.qty_change >= 0
                    return (
                        <Badge
                            variant="outline"
                            className={
                                isPositive
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800'
                                    : 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800'
                            }
                        >
                            {row.type_label}
                        </Badge>
                    )
                },
                size: 165,
            },
            {
                accessorKey: 'stock_before',
                header: () => (
                    <div className="flex justify-end">
                        <DataTableSortHeader
                            label="Awal"
                            field="stock_before"
                            tableSort={filters.mutation_table_sort}
                            tableDirection={filters.mutation_table_dir}
                            toolbarSort={filters.mutation_sort}
                            toolbarDirection={filters.mutation_sort_dir}
                            onSort={handleSort}
                        />
                    </div>
                ),
                cell: (info) => (
                    <span className="block text-right font-mono text-xs text-muted-foreground">
                        {info.getValue<number>()}
                    </span>
                ),
                size: 95,
            },
            {
                accessorKey: 'qty_change',
                header: () => (
                    <div className="flex justify-end">
                        <DataTableSortHeader
                            label="Perubahan"
                            field="qty_change"
                            tableSort={filters.mutation_table_sort}
                            tableDirection={filters.mutation_table_dir}
                            toolbarSort={filters.mutation_sort}
                            toolbarDirection={filters.mutation_sort_dir}
                            onSort={handleSort}
                        />
                    </div>
                ),
                cell: (info) => {
                    const qty = info.getValue<number>()
                    const isPositive = qty >= 0
                    return (
                        <span
                            className={cn(
                                'block text-right font-mono text-xs font-bold',
                                isPositive
                                    ? 'text-emerald-600 dark:text-emerald-400'
                                    : 'text-rose-600 dark:text-rose-400'
                            )}
                        >
                            {isPositive ? `+${qty}` : qty}
                        </span>
                    )
                },
                size: 120,
            },
            {
                accessorKey: 'stock_after',
                header: () => (
                    <div className="flex justify-end">
                        <DataTableSortHeader
                            label="Akhir"
                            field="stock_after"
                            tableSort={filters.mutation_table_sort}
                            tableDirection={filters.mutation_table_dir}
                            toolbarSort={filters.mutation_sort}
                            toolbarDirection={filters.mutation_sort_dir}
                            onSort={handleSort}
                        />
                    </div>
                ),
                cell: (info) => (
                    <span className="block text-right font-mono text-xs font-semibold text-foreground">
                        {info.getValue<number>()} {baseUnit}
                    </span>
                ),
                size: 115,
            },
            {
                accessorKey: 'unit_cost',
                header: () => (
                    <div className="flex justify-end">
                        <DataTableSortHeader
                            label={`HPP / ${baseUnit}`}
                            field="unit_cost"
                            tableSort={filters.mutation_table_sort}
                            tableDirection={filters.mutation_table_dir}
                            toolbarSort={filters.mutation_sort}
                            toolbarDirection={filters.mutation_sort_dir}
                            onSort={handleSort}
                        />
                    </div>
                ),
                cell: (info) => (
                    <span className="block text-right font-mono text-xs font-semibold text-foreground">
                        {formatRupiah(info.getValue<number>())}
                    </span>
                ),
                size: 140,
            },
            {
                accessorKey: 'notes',
                header: 'Keterangan',
                cell: (info) => (
                    <span className="line-clamp-2 whitespace-normal text-xs text-muted-foreground">
                        {info.getValue<string | null>() || '-'}
                    </span>
                ),
                size: 220,
            },
            {
                accessorKey: 'creator_name',
                header: 'Petugas',
                cell: (info) => (
                    <span className="block truncate text-xs text-muted-foreground">
                        {info.getValue<string>()}
                    </span>
                ),
                size: 130,
            },
        ],
        [
            stockMovements?.from,
            baseUnit,
            filters.mutation_table_sort,
            filters.mutation_table_dir,
            filters.mutation_sort,
            filters.mutation_sort_dir,
        ]
    )

    if (!stockMovements && isLoading) {
        return (
            <div className="flex min-h-[220px] flex-col items-center justify-center rounded-lg border border-dashed bg-card p-8 text-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <h3 className="mt-4 text-sm font-semibold text-foreground">Memuat riwayat mutasi stok…</h3>
                <p className="mt-1 text-xs text-muted-foreground">
                    Sedang mengambil log pergerakan stok untuk produk {product.name}.
                </p>
            </div>
        )
    }

    return (
        <div className="space-y-4">
            {/* Toolbar Header */}
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h3 className="text-base font-semibold text-foreground">Kartu Stok & Riwayat Mutasi</h3>
                    <p className="text-xs text-muted-foreground">
                        {stockMovements
                            ? `Log pergerakan stok keluar/masuk dalam satuan dasar ${baseUnit} (Total ${stockMovements.total} mutasi).`
                            : `Log pergerakan stok keluar/masuk dalam satuan dasar ${baseUnit} untuk ${product.name}.`}
                    </p>
                </div>
                {onRefresh && (
                    <Button
                        type="button"
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

            {/* Search & Filter Toolbar */}
            <StockMovementSearch
                filters={filters}
                typeOptions={typeOptions}
                routeUrl={(opts) => ProductController.show(product.id, opts)}
                isLoading={isLoading}
            />

            {/* DataTable */}
            <DataTable
                columns={columns}
                data={stockMovements?.data ?? []}
                tableKey={`product-stock-movements-${product.id}`}
                emptyMessage="Belum ada riwayat mutasi stok untuk produk ini."
                isLoading={isLoading}
            />

            {/* Pagination */}
            {stockMovements && (
                <DataTablePagination
                    meta={stockMovements}
                    routeUrl={(opts) => ProductController.show(product.id, opts)}
                    only={['stockMovements']}
                    pageSizeOptions={[10, 15, 25, 50, 100]}
                    onNavigate={handleNavigate}
                    isLoading={isLoading}
                />
            )}
        </div>
    )
}

export default StokMutasiProduct

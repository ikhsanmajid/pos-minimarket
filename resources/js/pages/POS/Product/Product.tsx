import React, { useEffect, useState } from 'react'
import { router, usePage } from '@inertiajs/react'
import AuthenticatedLayout from '@/layouts/AuthenticatedLayout'
import { DataTable, DataTableColumn } from '@/components/dataTable'
import { Badge } from '@/components/ui/badge'
import { SummaryStatCard, SummaryStatGrid } from '@/components/SummaryStatCard'
import { formatNumber, formatPercent } from '@/lib/utils'
import type { PageProps } from '@/types'
import { AlertTriangle, Package, PackageCheck, PackageX } from 'lucide-react'
import { useAuth } from '@/hooks/use-auth'
import { toast } from 'react-toastify'
import ProductController from '@/actions/App/Http/Controllers/ProductController'
import ProductTableToolbar, { type ProductFilters } from './component/ProductSearch'
import DataTablePagination, { type PaginationMeta } from '@/components/dataTablePagination'
import { DataTableSortHeader } from '@/components/dataTableSortHeader'
import { ProductActionsCell } from './component/ProductActionsCell'
import { DialogAddProduct } from './component/DialogAddProduct'

export interface Category {
    id: number
    name: string
    is_active?: boolean
}

export interface ProductUnit {
    id: number
    unit_name: string
    conversion_factor: number
    barcode: string | null
    buy_price: number
    sell_price: number | null
    is_default_purchase: boolean
    is_active: boolean
}

export type Product = {
    id: number
    category_id?: number
    barcode: string
    name: string
    base_unit: string
    category: string | null
    buy_price: string | number
    sell_price: string | number
    stock: number
    min_stock: number
    image?: string | null
    active: boolean
    units?: ProductUnit[]
}

interface PaginatedProducts extends PaginationMeta {
    data: Product[]
}

interface GetColumnsOptions {
    from: number | null
    categories: Category[]
    canEdit: boolean
    canDelete: boolean
    filters: ProductFilters
    onSort: (field: string) => void
}

const getColumns = ({
    from,
    categories,
    canEdit,
    canDelete,
    filters,
    onSort,
}: GetColumnsOptions): DataTableColumn<Product>[] => [
    {
        id: 'no',
        header: 'No',
        cell: (info) => (from ?? 1) + info.row.index,
        size: 55,
    },
    {
        accessorKey: 'name',
        header: () => (
            <DataTableSortHeader
                label="Produk"
                field="name"
                tableSort={filters.table_sort}
                tableDirection={filters.table_direction}
                toolbarSort={filters.sort}
                toolbarDirection={filters.direction}
                onSort={onSort}
            />
        ),
        size: 280,
        cell: (info) => {
            const row = info.row.original
            const activeUnitsCount = row.units?.filter((u) => u.is_active).length ?? 0

            return (
                <div className="flex items-center gap-3 py-0.5 min-w-0">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border bg-muted/40 overflow-hidden">
                        {row.image ? (
                            <img
                                src={row.image}
                                alt={row.name}
                                className="h-full w-full object-cover"
                            />
                        ) : (
                            <Package className="h-5 w-5 text-muted-foreground" />
                        )}
                    </div>
                    <div className="flex flex-col min-w-0">
                        <span className="font-medium text-foreground truncate">
                            {row.name}
                        </span>
                        <div className="flex items-center gap-1.5 min-w-0">
                            <span className="text-xs text-muted-foreground font-mono truncate">
                                {row.barcode}
                            </span>
                            {activeUnitsCount > 0 && (
                                <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 font-mono shrink-0">
                                    +{activeUnitsCount} UOM
                                </Badge>
                            )}
                        </div>
                    </div>
                </div>
            )
        },
    },
    {
        accessorKey: 'category',
        header: 'Kategori',
        size: 140,
        cell: (info) => (
            <span className="text-muted-foreground block truncate">
                {info.getValue<string>() ?? '-'}
            </span>
        ),
    },
    {
        accessorKey: 'buy_price',
        header: () => (
            <DataTableSortHeader
                label="Harga Beli"
                field="buy_price"
                tableSort={filters.table_sort}
                tableDirection={filters.table_direction}
                toolbarSort={filters.sort}
                toolbarDirection={filters.direction}
                onSort={onSort}
            />
        ),
        size: 140,
        cell: (info) => (
            <span className="font-mono text-xs font-semibold text-foreground">
                {new Intl.NumberFormat('id-ID', {
                    style: 'currency',
                    currency: 'IDR',
                    minimumFractionDigits: 0,
                }).format(Number(info.getValue<string>()))}
            </span>
        ),
    },
    {
        accessorKey: 'sell_price',
        header: () => (
            <DataTableSortHeader
                label="Harga Jual"
                field="sell_price"
                tableSort={filters.table_sort}
                tableDirection={filters.table_direction}
                toolbarSort={filters.sort}
                toolbarDirection={filters.direction}
                onSort={onSort}
            />
        ),
        size: 140,
        cell: (info) => (
            <span className="font-mono text-xs font-semibold text-primary">
                {new Intl.NumberFormat('id-ID', {
                    style: 'currency',
                    currency: 'IDR',
                    minimumFractionDigits: 0,
                }).format(Number(info.getValue<string>()))}
            </span>
        ),
    },
    {
        accessorKey: 'stock',
        header: () => (
            <DataTableSortHeader
                label="Stok"
                field="stock"
                tableSort={filters.table_sort}
                tableDirection={filters.table_direction}
                toolbarSort={filters.sort}
                toolbarDirection={filters.direction}
                onSort={onSort}
            />
        ),
        size: 185,
        cell: (info) => {
            const row = info.row.original
            const unit = row.base_unit || 'pcs'

            if (row.stock === 0) {
                return (
                    <div className="flex items-center gap-1.5">
                        <span className="font-mono font-semibold text-destructive">
                            {row.stock} <span className="text-[11px] font-normal">{unit}</span>
                        </span>
                        <Badge className="bg-red-300 text-red-700 dark:bg-red-950 dark:text-red-300">
                            Habis!
                        </Badge>
                    </div>
                )
            }
            if (row.stock > 0 && row.stock <= row.min_stock) {
                return (
                    <div className="flex items-center gap-1.5">
                        <span className="font-mono font-semibold text-orange-600 dark:text-orange-400">
                            {row.stock} <span className="text-[11px] font-normal">{unit}</span>
                        </span>
                        <Badge className="bg-orange-300 text-orange-700 dark:bg-orange-950 dark:text-orange-300">
                            Hampir Habis
                        </Badge>
                    </div>
                )
            }
            return (
                <div className="flex items-center gap-1.5">
                    <span className="font-mono font-semibold text-green-600 dark:text-green-400">
                        {row.stock} <span className="text-[11px] font-normal">{unit}</span>
                    </span>
                    <Badge className="bg-green-300 text-green-700 dark:bg-green-950 dark:text-green-300">
                        Aman
                    </Badge>
                </div>
            )
        },
    },
    {
        accessorKey: 'min_stock',
        header: 'Min. Stok',
        size: 105,
        cell: (info) => {
            const row = info.row.original
            return (
                <span className="font-mono text-xs text-muted-foreground">
                    {row.min_stock} {row.base_unit || 'pcs'}
                </span>
            )
        },
    },
    {
        accessorKey: 'active',
        header: () => (
            <DataTableSortHeader
                label="Status"
                field="active"
                tableSort={filters.table_sort}
                tableDirection={filters.table_direction}
                toolbarSort={filters.sort}
                toolbarDirection={filters.direction}
                onSort={onSort}
            />
        ),
        size: 105,
        cell: (info) =>
            info.getValue<boolean>() ? (
                <Badge variant="success">Aktif</Badge>
            ) : (
                <Badge variant="secondary">Nonaktif</Badge>
            ),
    },
    {
        id: 'actions',
        header: () => <span className="text-right block w-full pr-2">Aksi</span>,
        size: 70,
        cell: (info) => {
            const row = info.row.original
            return (
                <div className="flex justify-end pr-2">
                    <ProductActionsCell
                        product={row}
                        categories={categories}
                        canEdit={canEdit}
                        canDelete={canDelete}
                        detailUrl={ProductController.show.url(row.id)}
                        destroyUrl={ProductController.destroy.url(row.id)}
                    />
                </div>
            )
        },
    },
]

type ProductPageProps = PageProps<{
    products: PaginatedProducts
    filters: ProductFilters
    categories: Category[]
    summary: {
        total_products: number
        active_products: number
        safe_stock_count: number
        low_stock_count: number
        out_of_stock_count: number
        active_units_count: number
    }
}>

const ProductPage = () => {
    const { products, filters, categories = [], summary } = usePage<ProductPageProps>().props
    const { flash, user } = useAuth()
    const [isLoading, setIsLoading] = useState(false)

    const handleFilterStockStatus = (stockStatus?: string) => {
        const nextStatus = stockStatus && filters.stock_status === stockStatus ? undefined : stockStatus
        router.visit(
            ProductController.index({
                mergeQuery: {
                    stock_status: nextStatus,
                    page: 1,
                },
            }),
            {
                preserveState: true,
                preserveScroll: true,
                replace: true,
            }
        )
    }

    const canEdit = user?.role === 'admin' || user?.role === 'warehouse'
    const canDelete = user?.role === 'admin'

    const handleSort = (field: string) => {
        if (filters.sort === field) {
            return
        }

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
            ProductController.index({
                mergeQuery: {
                    table_sort: nextSort,
                    table_direction: nextDirection,
                    page: 1,
                },
            }),
            {
                preserveState: true,
                preserveScroll: true,
                replace: true,
            }
        )
    }

    const columns = React.useMemo(
        () =>
            getColumns({
                from: products.from,
                categories,
                canEdit,
                canDelete,
                filters,
                onSort: handleSort,
            }),
        [
            products.from,
            categories,
            canEdit,
            canDelete,
            filters.table_sort,
            filters.table_direction,
            filters.sort,
            filters.direction,
        ]
    )

    useEffect(() => {
        if (flash.success) {
            toast.success(flash.success)
        }
    }, [flash.success])

    useEffect(() => {
        const removeStart = router.on('start', () => setIsLoading(true))
        const removeFinish = router.on('finish', () => setIsLoading(false))

        return () => {
            removeStart()
            removeFinish()
        }
    }, [])

    return (
        <div className="w-full min-w-0 space-y-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Produk</h1>
                    <p className="text-sm text-muted-foreground">
                        Daftar seluruh produk, satuan dasar, dan konversi Multi-UOM toko.
                    </p>
                </div>
                {canEdit && (
                    <DialogAddProduct
                        categories={categories}
                        storeUrl={ProductController.store.url()}
                    />
                )}
            </div>

            <SummaryStatGrid>
                <SummaryStatCard
                    title="Total Produk"
                    value={formatNumber(summary.total_products)}
                    icon={Package}
                    variant="blue"
                    subInfo={`${formatPercent(summary.active_products, summary.total_products)} aktif • ${formatNumber(summary.active_units_count)} UOM`}
                    periodLabel="Semua Data"
                    isActive={!filters.stock_status || filters.stock_status === 'all'}
                    onClick={() => handleFilterStockStatus(undefined)}
                />
                <SummaryStatCard
                    title="Stok Aman"
                    value={formatNumber(summary.safe_stock_count)}
                    icon={PackageCheck}
                    variant="emerald"
                    subInfo={`${formatPercent(summary.safe_stock_count, summary.total_products)} dari total produk`}
                    periodLabel="> Min. Stok"
                    isActive={filters.stock_status === 'in_stock'}
                    onClick={() => handleFilterStockStatus('in_stock')}
                />
                <SummaryStatCard
                    title="Stok Hampir Habis"
                    value={formatNumber(summary.low_stock_count)}
                    icon={AlertTriangle}
                    variant="amber"
                    subInfo="Perlu restock segera"
                    periodLabel="≤ Min. Stok"
                    isActive={filters.stock_status === 'low_stock'}
                    onClick={() => handleFilterStockStatus('low_stock')}
                />
                <SummaryStatCard
                    title="Stok Habis"
                    value={formatNumber(summary.out_of_stock_count)}
                    icon={PackageX}
                    variant="rose"
                    subInfo="Segera buat order PO"
                    periodLabel="Stok 0"
                    isActive={filters.stock_status === 'out_of_stock'}
                    onClick={() => handleFilterStockStatus('out_of_stock')}
                />
            </SummaryStatGrid>

            <ProductTableToolbar
                filters={filters}
                categories={categories}
                routeUrl={ProductController.index}
                isLoading={isLoading}
            />

            <DataTable
                columns={columns}
                data={products.data}
                tableKey="product-table"
                emptyMessage="Tidak ada produk ditemukan."
                isLoading={isLoading}
            />

            <DataTablePagination
                meta={products}
                routeUrl={ProductController.index}
                isLoading={isLoading}
            />
        </div>
    )
}

ProductPage.layout = (page: React.ReactNode) => (
    <AuthenticatedLayout>{page}</AuthenticatedLayout>
)

export default ProductPage

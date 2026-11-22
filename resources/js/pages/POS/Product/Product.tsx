import React, { useEffect, useState } from 'react'
import { Link, router, usePage } from '@inertiajs/react'
import AuthenticatedLayout from '@/layouts/AuthenticatedLayout'
import { DataTable, DataTableColumn } from '@/components/dataTable'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { PageProps } from '@/types'
import { Plus, Package, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react'
import { useAuth } from '@/hooks/use-auth'
import { toast } from 'react-toastify'
import ProductController from '@/actions/App/Http/Controllers/ProductController'
import ProductTableToolbar, { type ProductFilters } from './component/ProductSearch'
import DataTablePagination, { type PaginationMeta } from '@/components/dataTablePagination'
import { ProductActionsCell } from './component/ProductActionsCell'
import { DialogAddProduct } from './component/DialogAddProduct'

export interface Category {
    id: number
    name: string
}

export type Product = {
    id: number
    category_id?: number
    barcode: string
    name: string
    category: string | null
    buy_price: string | number
    sell_price: string | number
    stock: number
    min_stock: number
    image?: string | null
    active: boolean
}

interface PaginatedProducts extends PaginationMeta {
    data: Product[]
}

interface SortHeaderProps {
    label: string
    field: string
    tableSort?: string
    tableDirection?: string
    toolbarSort?: string
    toolbarDirection?: string
    onSort: (field: string) => void
}

function SortHeader({
    label,
    field,
    tableSort,
    tableDirection,
    toolbarSort,
    toolbarDirection,
    onSort,
}: SortHeaderProps) {
    const isPrimary = tableSort === field
    const isToolbarSorted = toolbarSort === field
    const hasBoth = Boolean(tableSort && toolbarSort && tableSort !== toolbarSort)

    let tooltip = `Urutkan ${label} (A-Z / Terendah)`
    if (isToolbarSorted) {
        tooltip = `Kolom ${label} sedang diurutkan via toolbar (${toolbarDirection === 'asc' ? 'A-Z / Terendah' : 'Z-A / Tertinggi'}). Tidak dapat diurutkan di header tabel.`
    } else if (isPrimary) {
        if (tableDirection === 'asc') {
            tooltip = `Urutkan ${label} (Z-A / Tertinggi)`
        } else if (tableDirection === 'desc') {
            tooltip = `Batal urutkan (Default / Unsorted)`
        }
    }

    if (isToolbarSorted) {
        return (
            <div
                title={tooltip}
                className="flex items-center gap-1.5 font-medium text-muted-foreground/80 cursor-not-allowed select-none"
            >
                <span>{label}</span>
                <div className="flex items-center gap-1">
                    {toolbarDirection === 'asc' ? (
                        <ArrowUp className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    ) : (
                        <ArrowDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    )}
                    <span
                        className="flex h-3.5 items-center justify-center rounded bg-muted px-1 text-[9px] font-medium text-muted-foreground leading-none"
                        title="Diurutkan via Toolbar (Nonaktif di Header)"
                    >
                        Toolbar
                    </span>
                </div>
            </div>
        )
    }

    return (
        <button
            type="button"
            onClick={() => onSort(field)}
            title={tooltip}
            className="flex items-center gap-1.5 font-medium hover:text-foreground text-left cursor-pointer select-none group"
        >
            <span>{label}</span>
            {isPrimary ? (
                <div className="flex items-center gap-1">
                    {tableDirection === 'asc' ? (
                        <ArrowUp className="h-3.5 w-3.5 text-primary shrink-0" />
                    ) : (
                        <ArrowDown className="h-3.5 w-3.5 text-primary shrink-0" />
                    )}
                    {hasBoth && (
                        <span
                            className="flex h-3.5 min-w-3.5 px-0.5 items-center justify-center rounded bg-primary/10 text-[9px] font-bold text-primary leading-none"
                            title="Urutan Utama (Ke-1)"
                        >
                            1
                        </span>
                    )}
                </div>
            ) : (
                <ArrowUpDown className="h-3.5 w-3.5 opacity-30 group-hover:opacity-100 transition-opacity shrink-0" />
            )}
        </button>
    )
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
            size: 10,
        },
        {
            accessorKey: 'name',
            header: () => (
                <SortHeader
                    label="Produk"
                    field="name"
                    tableSort={filters.table_sort}
                    tableDirection={filters.table_direction}
                    toolbarSort={filters.sort}
                    toolbarDirection={filters.direction}
                    onSort={onSort}
                />
            ),
            cell: (info) => {
                const row = info.row.original
                return (
                    <div className="flex items-center gap-3 py-0.5">
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
                            <span className="font-medium text-foreground truncate max-w-[220px]">
                                {row.name}
                            </span>
                            <span className="text-xs text-muted-foreground font-mono">
                                {row.barcode}
                            </span>
                        </div>
                    </div>
                )
            },
        },
        {
            accessorKey: 'category',
            header: 'Kategori',
            cell: (info) => (
                <span className="text-muted-foreground">
                    {info.getValue<string>() ?? '-'}
                </span>
            ),
        },
        {
            accessorKey: 'buy_price',
            header: () => (
                <SortHeader
                    label="Harga Beli"
                    field="buy_price"
                    tableSort={filters.table_sort}
                    tableDirection={filters.table_direction}
                    toolbarSort={filters.sort}
                    toolbarDirection={filters.direction}
                    onSort={onSort}
                />
            ),
            size: 30,
            cell: (info) =>
                new Intl.NumberFormat('id-ID', {
                    style: 'currency',
                    currency: 'IDR',
                    minimumFractionDigits: 0,
                }).format(Number(info.getValue<string>())),
        },
        {
            accessorKey: 'sell_price',
            header: () => (
                <SortHeader
                    label="Harga Jual"
                    field="sell_price"
                    tableSort={filters.table_sort}
                    tableDirection={filters.table_direction}
                    toolbarSort={filters.sort}
                    toolbarDirection={filters.direction}
                    onSort={onSort}
                />
            ),
            size: 30,
            cell: (info) => (
                <span className="font-medium text-primary">
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
                <SortHeader
                    label="Stok"
                    field="stock"
                    tableSort={filters.table_sort}
                    tableDirection={filters.table_direction}
                    toolbarSort={filters.sort}
                    toolbarDirection={filters.direction}
                    onSort={onSort}
                />
            ),
            size: 20,
            cell: (info) => {
                const row = info.row.original
                if (row.stock === 0) {
                    return (
                        <div className="flex items-center gap-1.5">
                            <span className="font-semibold text-destructive">{row.stock}</span>
                            <Badge className="bg-red-300 text-red-700 dark:bg-red-950 dark:text-red-300">
                                Habis!
                            </Badge>
                        </div>
                    )
                }
                if (row.stock > 0 && row.stock <= row.min_stock) {
                    return (
                        <div className="flex items-center gap-1.5">
                            <span className="font-semibold text-orange-600 dark:text-orange-400">
                                {row.stock}
                            </span>
                            <Badge className="bg-orange-300 text-orange-700 dark:bg-orange-950 dark:text-orange-300">
                                Hampir Habis
                            </Badge>
                        </div>
                    )
                }
                return (
                    <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-green-600 dark:text-green-400">
                            {row.stock}
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
            size: 10,
            cell: (info) => (
                <span className="text-muted-foreground">
                    {info.getValue<number>()}
                </span>
            ),
        },
        {
            accessorKey: 'active',
            header: () => (
                <SortHeader
                    label="Status"
                    field="active"
                    tableSort={filters.table_sort}
                    tableDirection={filters.table_direction}
                    toolbarSort={filters.sort}
                    toolbarDirection={filters.direction}
                    onSort={onSort}
                />
            ),
            size: 10,
            cell: (info) =>
                info.getValue<boolean>() ? (
                    <Badge variant="success">Aktif</Badge>
                ) : (
                    <Badge variant="secondary">Nonaktif</Badge>
                ),
        },
        {
            id: 'actions',
            header: '',
            size: 20,
            cell: (info) => {
                const row = info.row.original
                return (
                    <ProductActionsCell
                        product={row}
                        categories={categories}
                        canEdit={canEdit}
                        canDelete={canDelete}
                        detailUrl={ProductController.show.url(row.id)}
                        destroyUrl={ProductController.destroy.url(row.id)}
                    />
                )
            },
        },
    ]

type ProductPageProps = PageProps<{
    products: PaginatedProducts
    filters: ProductFilters
    categories: Category[]
}>

const ProductPage = () => {
    const { products, filters, categories = [] } = usePage<ProductPageProps>().props
    const { flash, user } = useAuth()
    const [isLoading, setIsLoading] = useState(false)

    const canEdit = user?.role === 'admin' || user?.role === 'warehouse'
    const canDelete = user?.role === 'admin'

    const handleSort = (field: string) => {
        // Jika kolom ini sudah dipilih di toolbar, tidak bisa disortir di header tabel
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
                // Siklus 3-state: asc -> desc -> unsorted
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
                        Daftar seluruh produk yang tersedia di toko.
                    </p>
                </div>
                {canEdit && (
                    <DialogAddProduct
                        categories={categories}
                        storeUrl={ProductController.store.url()}
                    />
                )}
            </div>

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

import React, { useEffect, useState } from 'react'
import { router, usePage } from '@inertiajs/react'
import AuthenticatedLayout from '@/layouts/AuthenticatedLayout'
import { DataTable, type DataTableColumn } from '@/components/dataTable'
import { Badge } from '@/components/ui/badge'
import type { PageProps } from '@/types'
import { useAuth } from '@/hooks/use-auth'
import { toast } from 'react-toastify'
import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react'
import DataTablePagination, { type PaginationMeta } from '@/components/dataTablePagination'
import CategoryTableToolbar, { type CategoryFilters } from './component/CategorySearch'
import { DialogAddCategory } from './component/DialogAddCategory'
import { CategoryActionsCell } from './component/CategoryActionsCell'
import CategoryController from '@/actions/App/Http/Controllers/CategoryController'

export type CategoryRow = {
    id: number
    code: string | null
    name: string
    slug: string
    description: string | null
    is_active: boolean
    products_count: number
    created_at?: string
}

interface PaginatedCategories extends PaginationMeta {
    data: CategoryRow[]
}

type CategoryPageProps = PageProps<{
    categories: PaginatedCategories
    filters: CategoryFilters
}>

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
    canEdit: boolean
    canDelete: boolean
    filters: CategoryFilters
    onSort: (field: string) => void
}

const getColumns = ({
    from,
    canEdit,
    canDelete,
    filters,
    onSort,
}: GetColumnsOptions): DataTableColumn<CategoryRow>[] => [
        {
            id: 'no',
            header: 'No',
            cell: (info) => (from ?? 1) + info.row.index,
            size: 8,
        },
        {
            accessorKey: 'code',
            header: () => (
                <SortHeader
                    label="Kode"
                    field="code"
                    tableSort={filters.table_sort}
                    tableDirection={filters.table_direction}
                    toolbarSort={filters.sort}
                    toolbarDirection={filters.direction}
                    onSort={onSort}
                />
            ),
            cell: (info) => {
                const val = info.getValue<string | null>()
                return val ? (
                    <span className="font-mono text-xs font-semibold uppercase">{val}</span>
                ) : (
                    <span className="text-muted-foreground">-</span>
                )
            },
            size: 15,
        },
        {
            accessorKey: 'name',
            header: () => (
                <SortHeader
                    label="Nama Kategori"
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
                    <div className="flex flex-col py-0.5">
                        <span className="font-medium text-foreground">{row.name}</span>
                        {row.description && (
                            <span className="text-xs text-muted-foreground line-clamp-1 max-w-sm">
                                {row.description}
                            </span>
                        )}
                    </div>
                )
            },
        },
        {
            accessorKey: 'products_count',
            header: () => (
                <SortHeader
                    label="Jumlah Produk"
                    field="products_count"
                    tableSort={filters.table_sort}
                    tableDirection={filters.table_direction}
                    toolbarSort={filters.sort}
                    toolbarDirection={filters.direction}
                    onSort={onSort}
                />
            ),
            cell: (info) => {
                const count = info.getValue<number>()
                return (
                    <span className="text-muted-foreground font-mono">
                        {count} produk
                    </span>
                )
            },
            size: 15,
        },
        {
            accessorKey: 'is_active',
            header: () => (
                <SortHeader
                    label="Status"
                    field="is_active"
                    tableSort={filters.table_sort}
                    tableDirection={filters.table_direction}
                    toolbarSort={filters.sort}
                    toolbarDirection={filters.direction}
                    onSort={onSort}
                />
            ),
            cell: (info) => {
                const isActive = info.getValue<boolean>()
                return isActive ? (
                    <Badge variant="success">Aktif</Badge>
                ) : (
                    <Badge variant="secondary">Nonaktif</Badge>
                )
            },
            size: 15,
        },
        {
            id: 'actions',
            header: '',
            size: 10,
            cell: (info) => {
                const row = info.row.original
                return (
                    <CategoryActionsCell
                        category={row}
                        canEdit={canEdit}
                        canDelete={canDelete}
                    />
                )
            },
        },
    ]

const CategoryPage = () => {
    const { categories, filters } = usePage<CategoryPageProps>().props
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
            CategoryController.index({
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
                from: categories.from,
                canEdit,
                canDelete,
                filters,
                onSort: handleSort,
            }),
        [
            categories.from,
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
        if (flash.error) {
            toast.error(flash.error)
        }
    }, [flash.success, flash.error])

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
                    <h1 className="text-2xl font-bold tracking-tight">Kategori Produk</h1>
                    <p className="text-sm text-muted-foreground">
                        Kelola kategori untuk mengelompokkan produk di toko.
                    </p>
                </div>
                {canEdit && (
                    <DialogAddCategory storeUrl={CategoryController.store.url()} />
                )}
            </div>

            <CategoryTableToolbar
                filters={filters}
                routeUrl={CategoryController.index}
                isLoading={isLoading}
            />

            <DataTable
                columns={columns}
                data={categories.data}
                tableKey="category-table"
                emptyMessage="Tidak ada kategori ditemukan."
                isLoading={isLoading}
            />

            <DataTablePagination
                meta={{
                    current_page: categories.current_page,
                    last_page: categories.last_page,
                    per_page: categories.per_page,
                    total: categories.total,
                    from: categories.from,
                    to: categories.to,
                }}
                routeUrl={CategoryController.index}
                isLoading={isLoading}
            />
        </div>
    )
}

CategoryPage.layout = (page: React.ReactNode) => (
    <AuthenticatedLayout>{page}</AuthenticatedLayout>
)

export default CategoryPage

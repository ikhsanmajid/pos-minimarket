import React, { useEffect, useState } from 'react'
import { router, usePage } from '@inertiajs/react'
import AuthenticatedLayout from '@/layouts/AuthenticatedLayout'
import { DataTable, type DataTableColumn } from '@/components/dataTable'
import { Badge } from '@/components/ui/badge'
import { SummaryStatCard, SummaryStatGrid } from '@/components/SummaryStatCard'
import { formatNumber, formatPercent } from '@/lib/utils'
import { CheckCircle2, FolderOpen, FolderTree, PauseCircle } from 'lucide-react'
import type { PageProps } from '@/types'
import { useAuth } from '@/hooks/use-auth'
import { toast } from 'react-toastify'
import DataTablePagination, { type PaginationMeta } from '@/components/dataTablePagination'
import CategoryTableToolbar, { type CategoryFilters } from './component/CategorySearch'
import { DialogAddCategory } from './component/DialogAddCategory'
import { CategoryActionsCell } from './component/CategoryActionsCell'
import CategoryController from '@/actions/App/Http/Controllers/CategoryController'
import { DataTableSortHeader } from '@/components/dataTableSortHeader'

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
    summary: {
        total_categories: number
        active_categories: number
        inactive_categories: number
        empty_categories: number
        categorized_products_count: number
    }
}>

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
            size: 55,
        },
        {
            accessorKey: 'code',
            header: () => (
                <DataTableSortHeader
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
            size: 130,
        },
        {
            accessorKey: 'name',
            header: () => (
                <DataTableSortHeader
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
                    <div className="flex flex-col py-0.5 min-w-0">
                        <span className="font-medium text-foreground truncate">{row.name}</span>
                        {row.description && (
                            <span className="text-xs text-muted-foreground whitespace-normal line-clamp-1">
                                {row.description}
                            </span>
                        )}
                    </div>
                )
            },
            size: 385,
        },
        {
            accessorKey: 'products_count',
            header: () => (
                <DataTableSortHeader
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
            size: 170,
        },
        {
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
            cell: (info) => {
                const isActive = info.getValue<boolean>()
                return isActive ? (
                    <Badge variant="success">Aktif</Badge>
                ) : (
                    <Badge variant="secondary">Nonaktif</Badge>
                )
            },
            size: 140,
        },
        {
            id: 'actions',
            header: () => <span className="text-right block w-full pr-2">Aksi</span>,
            size: 80,
            cell: (info) => {
                const row = info.row.original
                return (
                    <div className="flex justify-end pr-2">
                        <CategoryActionsCell
                            category={row}
                            canEdit={canEdit}
                            canDelete={canDelete}
                        />
                    </div>
                )
            },
        },
    ]

const CategoryPage = () => {
    const { categories, filters, summary } = usePage<CategoryPageProps>().props
    const { flash, user } = useAuth()
    const [isLoading, setIsLoading] = useState(false)

    const handleFilterStatus = (status?: string) => {
        const nextStatus = status && filters.status === status ? undefined : status
        router.visit(
            CategoryController.index({
                mergeQuery: {
                    status: nextStatus,
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

            <SummaryStatGrid>
                <SummaryStatCard
                    title="Total Kategori"
                    value={formatNumber(summary.total_categories)}
                    icon={FolderTree}
                    variant="blue"
                    subInfo={`${formatNumber(summary.categorized_products_count)} produk terkategorisasi`}
                    periodLabel="Semua Data"
                    isActive={!filters.status || filters.status === 'all'}
                    onClick={() => handleFilterStatus(undefined)}
                />
                <SummaryStatCard
                    title="Kategori Aktif"
                    value={formatNumber(summary.active_categories)}
                    icon={CheckCircle2}
                    variant="emerald"
                    subInfo={`${formatPercent(summary.active_categories, summary.total_categories)} dari total kategori`}
                    periodLabel="Aktif"
                    isActive={filters.status === 'active'}
                    onClick={() => handleFilterStatus('active')}
                />
                <SummaryStatCard
                    title="Kategori Nonaktif"
                    value={formatNumber(summary.inactive_categories)}
                    icon={PauseCircle}
                    variant="amber"
                    subInfo="Terkunci dari produk baru"
                    periodLabel="Nonaktif"
                    isActive={filters.status === 'inactive'}
                    onClick={() => handleFilterStatus('inactive')}
                />
                <SummaryStatCard
                    title="Kategori Kosong"
                    value={formatNumber(summary.empty_categories)}
                    icon={FolderOpen}
                    variant="rose"
                    subInfo="Belum memiliki produk • perlu tinjauan"
                    periodLabel="0 Produk"
                />
            </SummaryStatGrid>

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

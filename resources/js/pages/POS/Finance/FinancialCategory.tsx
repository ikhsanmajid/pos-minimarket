import React, { useEffect, useState } from 'react'
import { router, usePage } from '@inertiajs/react'
import AuthenticatedLayout from '@/layouts/AuthenticatedLayout'
import { DataTable, type DataTableColumn } from '@/components/dataTable'
import DataTablePagination, { type PaginationMeta } from '@/components/dataTablePagination'
import { DataTableSortHeader } from '@/components/dataTableSortHeader'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { SummaryStatCard, SummaryStatGrid } from '@/components/SummaryStatCard'
import { formatNumber } from '@/lib/utils'
import {
    ArrowDownLeft,
    ArrowUpRight,
    CheckCircle2,
    Pencil,
    Plus,
    ShieldCheck,
    Tags,
    Trash2,
} from 'lucide-react'
import { toast } from 'react-toastify'
import type { PageProps } from '@/types'
import { useAuth } from '@/hooks/use-auth'
import FinancialCategoryController from '@/actions/App/Http/Controllers/FinancialCategoryController'
import FinancialCategorySearch, {
    type FinancialCategoryFilters,
} from './component/FinancialCategorySearch'
import { DialogFinancialCategory } from './component/DialogFinancialCategory'
import { DialogDeleteFinancialCategory } from './component/DialogDeleteFinancialCategory'

export interface FinancialCategoryRow {
    id: number
    code: string
    name: string
    type: 'income' | 'expense' | string
    type_label: string
    is_system: boolean
    is_active: boolean
    description: string | null
    transactions_count: number
    created_at: string | null
}

type FinancialCategoryPageProps = PageProps<{
    categories: PaginationMeta & { data: FinancialCategoryRow[] }
    filters: FinancialCategoryFilters
    summary: {
        total_categories: number
        income_categories: number
        expense_categories: number
        active_categories: number
        system_categories: number
    }
    categoryTypes: { value: string; label: string }[]
}>

const FinancialCategoryPage = () => {
    const {
        categories,
        filters,
        summary,
        categoryTypes = [],
    } = usePage<FinancialCategoryPageProps>().props
    const { flash } = useAuth()

    const [isLoading, setIsLoading] = useState(false)
    const [createOpen, setCreateOpen] = useState(false)
    const [editCategory, setEditCategory] = useState<FinancialCategoryRow | null>(null)
    const [deleteCategory, setDeleteCategory] = useState<FinancialCategoryRow | null>(null)

    useEffect(() => {
        if (flash?.success) toast.success(flash.success)
        if (flash?.error) toast.error(flash.error)
    }, [flash?.success, flash?.error])

    useEffect(() => {
        const removeStart = router.on('start', () => setIsLoading(true))
        const removeFinish = router.on('finish', () => setIsLoading(false))
        return () => {
            removeStart()
            removeFinish()
        }
    }, [])

    const handleSort = (field: string) => {
        if (filters.sort === field) return

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
            FinancialCategoryController.index({
                mergeQuery: { table_sort: nextSort, table_direction: nextDirection, page: 1 },
            }),
            { preserveState: true, preserveScroll: true, replace: true }
        )
    }

    const handleQuickTypeFilter = (type?: string) => {
        const nextType = type && filters.type === type ? undefined : type
        router.visit(
            FinancialCategoryController.index({
                mergeQuery: { type: nextType, page: 1 },
            }),
            { preserveState: true, preserveScroll: true, replace: true }
        )
    }

    const columns: DataTableColumn<FinancialCategoryRow>[] = React.useMemo(
        () => [
            {
                id: 'no',
                header: 'No',
                cell: (info) => (categories.from ?? 1) + info.row.index,
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
                        onSort={handleSort}
                    />
                ),
                size: 135,
                cell: ({ row }) => (
                    <span className="font-mono text-xs font-semibold text-primary">
                        {row.original.code}
                    </span>
                ),
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
                        onSort={handleSort}
                    />
                ),
                size: 270,
                cell: ({ row }) => {
                    const cat = row.original
                    return (
                        <div className="flex flex-col min-w-0">
                            <div className="flex items-center gap-1.5 min-w-0">
                                <span className="font-medium text-foreground truncate">{cat.name}</span>
                                {cat.is_system && (
                                    <Badge
                                        variant="outline"
                                        className="text-[10px] px-1.5 py-0 gap-0.5 bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800 shrink-0"
                                    >
                                        <ShieldCheck className="h-2.5 w-2.5" />
                                        Sistem
                                    </Badge>
                                )}
                            </div>
                            {cat.description && (
                                <span className="text-[11px] text-muted-foreground truncate">
                                    {cat.description}
                                </span>
                            )}
                        </div>
                    )
                },
            },
            {
                accessorKey: 'type',
                header: () => (
                    <DataTableSortHeader
                        label="Tipe"
                        field="type"
                        tableSort={filters.table_sort}
                        tableDirection={filters.table_direction}
                        toolbarSort={filters.sort}
                        toolbarDirection={filters.direction}
                        onSort={handleSort}
                    />
                ),
                size: 135,
                cell: ({ row }) => {
                    const isIncome = row.original.type === 'income'
                    return (
                        <Badge
                            variant="outline"
                            className={
                                isIncome
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800'
                                    : 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800'
                            }
                        >
                            {row.original.type_label}
                        </Badge>
                    )
                },
            },
            {
                accessorKey: 'transactions_count',
                header: () => (
                    <DataTableSortHeader
                        label="Transaksi"
                        field="transactions_count"
                        tableSort={filters.table_sort}
                        tableDirection={filters.table_direction}
                        toolbarSort={filters.sort}
                        toolbarDirection={filters.direction}
                        onSort={handleSort}
                    />
                ),
                size: 120,
                cell: ({ row }) => (
                    <Badge variant="secondary" className="font-mono text-xs">
                        {formatNumber(row.original.transactions_count)} Mutasi
                    </Badge>
                ),
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
                        onSort={handleSort}
                    />
                ),
                size: 105,
                cell: ({ row }) =>
                    row.original.is_active ? (
                        <Badge variant="success">Aktif</Badge>
                    ) : (
                        <Badge variant="secondary">Nonaktif</Badge>
                    ),
            },
            {
                id: 'actions',
                header: () => <span className="text-right block w-full pr-2">Aksi</span>,
                size: 95,
                cell: ({ row }) => {
                    const cat = row.original
                    const cannotDeleteReason = cat.is_system
                        ? 'Kategori bawaan sistem tidak dapat dihapus'
                        : cat.transactions_count > 0
                          ? 'Kategori sudah digunakan pada transaksi keuangan (nonaktifkan saja)'
                          : null

                    return (
                        <div className="flex items-center justify-end gap-1 pr-2">
                            <Button
                                type="button"
                                variant="ghost"
                                size="icon-sm"
                                onClick={() => setEditCategory(cat)}
                                title="Edit Kategori"
                                className="cursor-pointer"
                            >
                                <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <span title={cannotDeleteReason ?? 'Hapus Kategori'}>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon-sm"
                                    disabled={Boolean(cannotDeleteReason)}
                                    onClick={() => setDeleteCategory(cat)}
                                    className="text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40 disabled:opacity-40 cursor-pointer"
                                >
                                    <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                            </span>
                        </div>
                    )
                },
            },
        ],
        [
            categories.from,
            filters.table_sort,
            filters.table_direction,
            filters.sort,
            filters.direction,
        ]
    )

    return (
        <div className="w-full min-w-0 space-y-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Kategori Keuangan</h1>
                    <p className="text-sm text-muted-foreground">
                        Atur kategori pos pemasukan dan pengeluaran operasional untuk pembukuan arus kas.
                    </p>
                </div>
                <Button onClick={() => setCreateOpen(true)} className="gap-1.5 cursor-pointer">
                    <Plus className="h-4 w-4" />
                    Tambah Kategori
                </Button>
            </div>

            <SummaryStatGrid>
                <SummaryStatCard
                    title="Total Kategori"
                    value={formatNumber(summary.total_categories)}
                    icon={Tags}
                    variant="blue"
                    subInfo={`${formatNumber(summary.system_categories)} kategori sistem terproteksi`}
                    periodLabel="Semua Data"
                    isActive={!filters.type || filters.type === 'all'}
                    onClick={() => handleQuickTypeFilter(undefined)}
                />
                <SummaryStatCard
                    title="Kategori Pemasukan"
                    value={formatNumber(summary.income_categories)}
                    icon={ArrowDownLeft}
                    variant="emerald"
                    subInfo="Pos kas masuk toko"
                    periodLabel="Pemasukan"
                    isActive={filters.type === 'income'}
                    onClick={() => handleQuickTypeFilter('income')}
                />
                <SummaryStatCard
                    title="Kategori Aktif"
                    value={formatNumber(summary.active_categories)}
                    icon={CheckCircle2}
                    variant="amber"
                    subInfo={`Dari ${formatNumber(summary.total_categories)} total kategori`}
                    periodLabel="Aktif"
                />
                <SummaryStatCard
                    title="Kategori Pengeluaran"
                    value={formatNumber(summary.expense_categories)}
                    icon={ArrowUpRight}
                    variant="rose"
                    subInfo="Pos biaya operasional & stok"
                    periodLabel="Pengeluaran"
                    isActive={filters.type === 'expense'}
                    onClick={() => handleQuickTypeFilter('expense')}
                />
            </SummaryStatGrid>

            <FinancialCategorySearch
                filters={filters}
                categoryTypes={categoryTypes}
                routeUrl={FinancialCategoryController.index}
                isLoading={isLoading}
            />

            <DataTable
                columns={columns}
                data={categories.data ?? []}
                tableKey="financial-categories-table"
                emptyMessage="Belum ada kategori keuangan."
                isLoading={isLoading}
            />

            <DataTablePagination
                meta={categories}
                routeUrl={FinancialCategoryController.index}
                isLoading={isLoading}
            />

            <DialogFinancialCategory
                category={null}
                categoryTypes={categoryTypes}
                open={createOpen}
                onOpenChange={setCreateOpen}
            />

            <DialogFinancialCategory
                category={editCategory}
                categoryTypes={categoryTypes}
                open={Boolean(editCategory)}
                onOpenChange={(open) => {
                    if (!open) setEditCategory(null)
                }}
            />

            <DialogDeleteFinancialCategory
                category={deleteCategory}
                open={Boolean(deleteCategory)}
                onOpenChange={(open) => {
                    if (!open) setDeleteCategory(null)
                }}
            />
        </div>
    )
}

FinancialCategoryPage.layout = (page: React.ReactNode) => (
    <AuthenticatedLayout>{page}</AuthenticatedLayout>
)

export default FinancialCategoryPage

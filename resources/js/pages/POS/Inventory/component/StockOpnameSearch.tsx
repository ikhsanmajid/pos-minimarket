import React, { useEffect, useRef, useState } from 'react'
import { router } from '@inertiajs/react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import { ArrowDown, ArrowUp, Loader2, Search, X } from 'lucide-react'
import StockOpnameController from '@/actions/App/Http/Controllers/StockOpnameController'
import type { SelectOptionItem } from './StockAdjustmentSearch'

export interface StockOpnameFilters {
    search?: string
    status?: string
    category_id?: string
    sort?: string
    direction?: string
    table_sort?: string
    table_direction?: string
}

interface StockOpnameSearchProps {
    filters: StockOpnameFilters
    statusOptions: SelectOptionItem[]
    categories: { id: number; name: string }[]
    isLoading?: boolean
}

const SORT_OPTIONS: SelectOptionItem[] = [
    { value: 'default', label: 'Urutan: Terbaru' },
    { value: 'created_at:asc', label: 'Tanggal: Terlama' },
    { value: 'total_variance_value:asc', label: 'Selisih Minus: Terbesar' },
    { value: 'opname_number:desc', label: 'No. Opname: Z-A' },
]

const TABLE_SORT_LABELS: Record<string, string> = {
    created_at: 'Tanggal',
    opname_number: 'No. Opname',
    status: 'Status',
    total_items_counted: 'Progress',
    total_variance_items: 'Item Selisih',
    total_variance_value: 'Nilai Selisih',
}

export function StockOpnameSearch({
    filters,
    statusOptions,
    categories,
    isLoading = false,
}: StockOpnameSearchProps) {
    const [search, setSearch] = useState(filters.search ?? '')
    const isFirstRender = useRef(true)

    const allStatusItems: SelectOptionItem[] = [{ value: 'all', label: 'Semua Status' }, ...statusOptions]
    const allCategoryItems: SelectOptionItem[] = [
        { value: 'all', label: 'Semua Cakupan' },
        { value: 'store', label: 'Seluruh Toko' },
        ...categories.map((c) => ({ value: String(c.id), label: c.name })),
    ]

    const activeSortValue =
        filters.sort && filters.direction ? `${filters.sort}:${filters.direction}` : 'default'

    const visitWithQuery = (mergeQuery: Record<string, string | number | undefined>) => {
        router.visit(
            StockOpnameController.index({
                mergeQuery: {
                    ...mergeQuery,
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

    useEffect(() => {
        if (isFirstRender.current) {
            isFirstRender.current = false
            return
        }

        const timer = setTimeout(() => {
            if ((filters.search ?? '') !== search) {
                visitWithQuery({ search: search.trim() || undefined })
            }
        }, 300)

        return () => clearTimeout(timer)
    }, [search])

    useEffect(() => {
        setSearch(filters.search ?? '')
    }, [filters.search])

    const handleSortChange = (val: string | null) => {
        if (!val || val === 'default') {
            visitWithQuery({ sort: undefined, direction: undefined })
            return
        }

        const [sortField, sortDir] = val.split(':')
        const clearTableSort = filters.table_sort === sortField
        visitWithQuery({
            sort: sortField,
            direction: sortDir,
            ...(clearTableSort ? { table_sort: undefined, table_direction: undefined } : {}),
        })
    }

    const activeFilterCount = [
        Boolean(filters.search),
        Boolean(filters.status && filters.status !== 'all'),
        Boolean(filters.category_id && filters.category_id !== 'all'),
        Boolean(filters.sort),
        Boolean(filters.table_sort),
    ].filter(Boolean).length

    const handleReset = () => {
        setSearch('')
        router.visit(StockOpnameController.index.url(), {
            preserveState: true,
            preserveScroll: true,
            replace: true,
        })
    }

    return (
        <div className="mb-4 space-y-3 rounded-lg border bg-card p-3.5 shadow-xs sm:p-4">
            <div className="flex flex-wrap items-center gap-2.5">
                {/* Search Input */}
                <div className="relative w-full sm:w-64 lg:w-72">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Cari no. opname atau catatan…"
                        className="h-9 pl-9 pr-8 text-sm"
                        disabled={isLoading}
                    />
                    {isLoading ? (
                        <Loader2 className="absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
                    ) : (
                        search && (
                            <button
                                type="button"
                                onClick={() => setSearch('')}
                                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                aria-label="Hapus pencarian"
                            >
                                <X className="h-3.5 w-3.5" />
                            </button>
                        )
                    )}
                </div>

                {/* Filter Status */}
                <Select
                    value={filters.status ?? 'all'}
                    items={allStatusItems}
                    onValueChange={(val) =>
                        visitWithQuery({ status: !val || val === 'all' ? undefined : val })
                    }
                    disabled={isLoading}
                >
                    <SelectTrigger className="h-9 w-full sm:w-auto sm:min-w-[150px]">
                        <SelectValue>
                            {(val) => allStatusItems.find((i) => i.value === val)?.label ?? 'Semua Status'}
                        </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                        {allStatusItems.map((item) => (
                            <SelectItem key={item.value} value={item.value}>
                                {item.label}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>

                {/* Filter Cakupan Kategori */}
                <Select
                    value={filters.category_id ?? 'all'}
                    items={allCategoryItems}
                    onValueChange={(val) =>
                        visitWithQuery({ category_id: !val || val === 'all' ? undefined : val })
                    }
                    disabled={isLoading}
                >
                    <SelectTrigger className="h-9 w-full sm:w-auto sm:min-w-[165px]">
                        <SelectValue>
                            {(val) => allCategoryItems.find((i) => i.value === val)?.label ?? 'Semua Cakupan'}
                        </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                        {allCategoryItems.map((item) => (
                            <SelectItem key={item.value} value={item.value}>
                                {item.label}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>

                {/* Urutan */}
                <Select
                    value={activeSortValue}
                    items={SORT_OPTIONS}
                    onValueChange={handleSortChange}
                    disabled={isLoading}
                >
                    <SelectTrigger className="h-9 w-full sm:w-auto sm:min-w-[155px]">
                        <SelectValue>
                            {(val) => SORT_OPTIONS.find((i) => i.value === val)?.label ?? 'Urutan: Terbaru'}
                        </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                        {SORT_OPTIONS.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>
                                {opt.label}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>

                {/* Active Table Sort Chip */}
                {filters.table_sort && (
                    <div className="flex h-9 items-center gap-1.5 rounded-md border border-primary/20 bg-primary/5 px-2.5 text-xs text-primary">
                        <span>Tabel: {TABLE_SORT_LABELS[filters.table_sort] ?? filters.table_sort}</span>
                        {filters.table_direction === 'desc' ? (
                            <ArrowDown className="h-3.5 w-3.5" />
                        ) : (
                            <ArrowUp className="h-3.5 w-3.5" />
                        )}
                        <button
                            type="button"
                            onClick={() =>
                                visitWithQuery({ table_sort: undefined, table_direction: undefined })
                            }
                            className="ml-0.5 rounded p-0.5 hover:bg-primary/10"
                            aria-label="Hapus urutan tabel"
                        >
                            <X className="h-3 w-3" />
                        </button>
                    </div>
                )}

                {/* Reset Filter */}
                {activeFilterCount > 0 && (
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleReset}
                        disabled={isLoading}
                        className="h-9 gap-1.5 border-dashed px-3 text-xs text-muted-foreground hover:text-foreground"
                    >
                        <X className="h-3.5 w-3.5" />
                        Reset Filter
                        <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
                            {activeFilterCount}
                        </span>
                    </Button>
                )}
            </div>
        </div>
    )
}

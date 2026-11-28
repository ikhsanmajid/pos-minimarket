import * as React from 'react'
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
import { Loader2, Search, X } from 'lucide-react'
import type { RouteDefinition, RouteQueryOptions } from '@/wayfinder'

export interface CategoryFilters {
    search?: string
    status?: string
    sort?: string
    direction?: string
    table_sort?: string
    table_direction?: string
}

const TABLE_SORT_LABELS: Record<string, string> = {
    code: 'Kode',
    name: 'Nama Kategori',
    products_count: 'Jumlah Produk',
    is_active: 'Status',
}

interface CategoryTableToolbarProps {
    filters: CategoryFilters
    routeUrl: (options?: RouteQueryOptions) => RouteDefinition<'get'>
    isLoading?: boolean
}

export function CategoryTableToolbar({
    filters,
    routeUrl,
    isLoading = false,
}: CategoryTableToolbarProps) {
    const [search, setSearch] = React.useState(filters.search ?? '')
    const [status, setStatus] = React.useState(filters.status ?? 'all')
    const isFirstRender = React.useRef(true)

    React.useEffect(() => {
        setStatus(filters.status ?? 'all')
    }, [filters.status])

    React.useEffect(() => {
        if (isFirstRender.current) {
            isFirstRender.current = false
            return
        }

        const timeout = setTimeout(() => {
            applyFilters({ searchVal: search })
        }, 300)

        return () => clearTimeout(timeout)
    }, [search])

    const applyFilters = (overrides: { searchVal?: string; statusVal?: string } = {}) => {
        const sVal = overrides.searchVal !== undefined ? overrides.searchVal : search
        const stVal = overrides.statusVal !== undefined ? overrides.statusVal : status

        router.visit(
            routeUrl({
                mergeQuery: {
                    search: sVal || undefined,
                    status: stVal !== 'all' ? stVal : undefined,
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

    const handleStatusChange = (val: string | null) => {
        if (val == null) return
        setStatus(val)
        applyFilters({ statusVal: val })
    }

    const handleSortChange = (val: string | null) => {
        if (val == null) return

        let sortVal: string | undefined
        let directionVal: string | undefined

        if (val !== 'default') {
            if (val.endsWith('_asc')) {
                directionVal = 'asc'
                sortVal = val.slice(0, -4)
            } else if (val.endsWith('_desc')) {
                directionVal = 'desc'
                sortVal = val.slice(0, -5)
            }
        }

        // Jika kolom yang dipilih di toolbar sama dengan yang sedang disortir di header tabel,
        // bersihkan sortir header tabel agar tidak duplikat
        const isSameAsTableSort = Boolean(sortVal && sortVal === filters.table_sort)

        router.visit(
            routeUrl({
                mergeQuery: {
                    sort: sortVal,
                    direction: directionVal,
                    ...(isSameAsTableSort ? { table_sort: undefined, table_direction: undefined } : {}),
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

    const handleClearTableSort = () => {
        router.visit(
            routeUrl({
                mergeQuery: {
                    table_sort: undefined,
                    table_direction: undefined,
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

    const handleReset = () => {
        isFirstRender.current = true
        setSearch('')
        setStatus('all')

        router.visit(
            routeUrl({
                mergeQuery: {
                    search: undefined,
                    status: undefined,
                    sort: undefined,
                    direction: undefined,
                    table_sort: undefined,
                    table_direction: undefined,
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

    const currentSortKey =
        filters.sort && filters.direction ? `${filters.sort}_${filters.direction}` : 'default'

    const isSorted = currentSortKey !== 'default'
    const isTableSorted = Boolean(filters.table_sort && filters.table_direction)

    const hasActiveFilters =
        Boolean(search) ||
        status !== 'all' ||
        isSorted ||
        isTableSorted

    const sortOptions = [
        { value: 'default', label: 'Urutan: Default' },
        { value: 'name_asc', label: 'Nama (A → Z)' },
        { value: 'name_desc', label: 'Nama (Z → A)' },
        { value: 'products_count_desc', label: 'Jumlah Produk (Terbanyak)' },
        { value: 'products_count_asc', label: 'Jumlah Produk (Tersedikit)' },
        { value: 'code_asc', label: 'Kode (A → Z)' },
        { value: 'code_desc', label: 'Kode (Z → A)' },
        { value: 'is_active_desc', label: 'Status (Aktif Dulu)' },
        { value: 'is_active_asc', label: 'Status (Nonaktif Dulu)' },
        { value: 'created_at_desc', label: 'Terbaru Ditambahkan' },
    ]

    const statusItems = [
        { value: 'all', label: 'Semua Status' },
        { value: 'active', label: 'Aktif' },
        { value: 'inactive', label: 'Nonaktif' },
    ]

    return (
        <div className="mb-4 space-y-3 rounded-lg border bg-card p-3.5 shadow-xs sm:p-4">
            <div className="flex flex-wrap items-center gap-2.5">
                {/* Search Input */}
                <div className="relative w-full sm:w-64 lg:w-72">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                    <Input
                        placeholder="Cari nama atau kode kategori…"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="pl-9 pr-8 h-9 text-sm"
                    />
                    {search && !isLoading && (
                        <button
                            type="button"
                            onClick={() => setSearch('')}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
                            title="Hapus pencarian"
                        >
                            <X className="h-3.5 w-3.5" />
                        </button>
                    )}
                    {isLoading && (
                        <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
                    )}
                </div>

                {/* Filter Status */}
                <Select
                    items={statusItems}
                    value={status}
                    onValueChange={handleStatusChange}
                    disabled={isLoading}
                >
                    <SelectTrigger className="w-full sm:w-auto sm:min-w-[140px] h-9">
                        <SelectValue placeholder="Semua Status">
                            {(val) => statusItems.find((s) => s.value === val)?.label}
                        </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                        {statusItems.map((item) => (
                            <SelectItem key={item.value} value={item.value}>
                                {item.label}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>

                {/* Filter Urutan */}
                <Select
                    items={sortOptions}
                    value={currentSortKey}
                    onValueChange={handleSortChange}
                    disabled={isLoading}
                >
                    <SelectTrigger className="w-full sm:w-auto sm:min-w-[195px] h-9">
                        <SelectValue placeholder="Urutan: Default">
                            {(val) => sortOptions.find((s) => s.value === val)?.label}
                        </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                        {sortOptions.map((item) => (
                            <SelectItem key={item.value} value={item.value}>
                                {item.label}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>

                {/* Active Table Sort Chip */}
                {isTableSorted && filters.table_sort && (
                    <div className="flex h-9 items-center gap-1.5 rounded-md border border-primary/20 bg-primary/5 px-2.5 text-xs text-primary">
                        <span className="font-medium">Tabel:</span>
                        <span>
                            {TABLE_SORT_LABELS[filters.table_sort] ?? filters.table_sort}{' '}
                            {filters.table_direction === 'asc' ? '↑' : '↓'}
                        </span>
                        <button
                            type="button"
                            onClick={handleClearTableSort}
                            className="ml-0.5 rounded p-0.5 text-primary/70 hover:bg-primary/10 hover:text-primary cursor-pointer"
                            title="Hapus urutan header tabel"
                        >
                            <X className="h-3 w-3" />
                        </button>
                    </div>
                )}

                {/* Reset Button */}
                {hasActiveFilters && (
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={handleReset}
                        disabled={isLoading}
                        className="h-9 px-3 text-xs gap-1.5 text-muted-foreground hover:text-foreground border-dashed"
                    >
                        <X className="h-3.5 w-3.5" />
                        Reset Filter
                    </Button>
                )}
            </div>
        </div>
    )
}

export default CategoryTableToolbar

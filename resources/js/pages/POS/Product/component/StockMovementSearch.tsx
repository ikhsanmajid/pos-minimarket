import * as React from 'react'
import { router } from '@inertiajs/react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import { Loader2, Search, X } from 'lucide-react'
import type { RouteDefinition, RouteQueryOptions } from '@/wayfinder'

export interface StockMovementFilters {
    mutation_search?: string
    mutation_type?: string
    mutation_direction?: string
    mutation_start_date?: string
    mutation_end_date?: string
    mutation_sort?: string
    mutation_sort_dir?: string
    mutation_table_sort?: string
    mutation_table_dir?: string
}

export interface StockMovementTypeOption {
    value: string
    label: string
}

const TABLE_SORT_LABELS: Record<string, string> = {
    created_at: 'Waktu',
    type: 'Jenis Mutasi',
    stock_before: 'Awal',
    qty_change: 'Perubahan',
    stock_after: 'Akhir',
    unit_cost: 'HPP',
}

interface StockMovementSearchProps {
    filters: StockMovementFilters
    typeOptions: StockMovementTypeOption[]
    routeUrl: (options?: RouteQueryOptions) => RouteDefinition<'get'>
    isLoading?: boolean
}

export function StockMovementSearch({
    filters,
    typeOptions,
    routeUrl,
    isLoading = false,
}: StockMovementSearchProps) {
    const [search, setSearch] = React.useState(filters.mutation_search ?? '')
    const [movementType, setMovementType] = React.useState(filters.mutation_type ?? 'all')
    const [direction, setDirection] = React.useState(filters.mutation_direction ?? 'all')
    const [startDate, setStartDate] = React.useState(filters.mutation_start_date ?? '')
    const [endDate, setEndDate] = React.useState(filters.mutation_end_date ?? '')

    React.useEffect(() => {
        setSearch(filters.mutation_search ?? '')
        setMovementType(filters.mutation_type ?? 'all')
        setDirection(filters.mutation_direction ?? 'all')
        setStartDate(filters.mutation_start_date ?? '')
        setEndDate(filters.mutation_end_date ?? '')
    }, [
        filters.mutation_search,
        filters.mutation_type,
        filters.mutation_direction,
        filters.mutation_start_date,
        filters.mutation_end_date,
    ])

    // Debounce search 300ms
    React.useEffect(() => {
        if (search === (filters.mutation_search ?? '')) {
            return
        }

        const timeout = setTimeout(() => {
            applyFilters({ searchVal: search })
        }, 300)

        return () => clearTimeout(timeout)
    }, [search])

    const applyFilters = (
        overrides: {
            searchVal?: string
            typeVal?: string
            directionVal?: string
            startDateVal?: string
            endDateVal?: string
        } = {}
    ) => {
        const sVal = overrides.searchVal !== undefined ? overrides.searchVal : search
        const tVal = overrides.typeVal !== undefined ? overrides.typeVal : movementType
        const dVal = overrides.directionVal !== undefined ? overrides.directionVal : direction
        const sdVal = overrides.startDateVal !== undefined ? overrides.startDateVal : startDate
        const edVal = overrides.endDateVal !== undefined ? overrides.endDateVal : endDate

        router.visit(
            routeUrl({
                mergeQuery: {
                    tab: 'mutation',
                    mutation_search: sVal || undefined,
                    mutation_type: tVal !== 'all' ? tVal : undefined,
                    mutation_direction: dVal !== 'all' ? dVal : undefined,
                    mutation_start_date: sdVal || undefined,
                    mutation_end_date: edVal || undefined,
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

    const handleTypeChange = (val: string | null) => {
        if (val == null) return
        setMovementType(val)
        applyFilters({ typeVal: val })
    }

    const handleDirectionChange = (val: string | null) => {
        if (val == null) return
        setDirection(val)
        applyFilters({ directionVal: val })
    }

    const handleStartDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value
        setStartDate(val)
        applyFilters({ startDateVal: val })
    }

    const handleEndDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value
        setEndDate(val)
        applyFilters({ endDateVal: val })
    }

    const handleSortChange = (val: string | null) => {
        if (val == null) return

        let sortVal: string | undefined
        let sortDirVal: string | undefined

        if (val !== 'default') {
            if (val.endsWith('_asc')) {
                sortDirVal = 'asc'
                sortVal = val.slice(0, -4)
            } else if (val.endsWith('_desc')) {
                sortDirVal = 'desc'
                sortVal = val.slice(0, -5)
            }
        }

        const isSameAsTableSort = Boolean(sortVal && sortVal === filters.mutation_table_sort)

        router.visit(
            routeUrl({
                mergeQuery: {
                    tab: 'mutation',
                    mutation_sort: sortVal,
                    mutation_sort_dir: sortDirVal,
                    ...(isSameAsTableSort
                        ? { mutation_table_sort: undefined, mutation_table_dir: undefined }
                        : {}),
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

    const handleClearTableSort = () => {
        router.visit(
            routeUrl({
                mergeQuery: {
                    tab: 'mutation',
                    mutation_table_sort: undefined,
                    mutation_table_dir: undefined,
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

    const handleReset = () => {
        setSearch('')
        setMovementType('all')
        setDirection('all')
        setStartDate('')
        setEndDate('')

        router.visit(
            routeUrl({
                mergeQuery: {
                    tab: 'mutation',
                    mutation_search: undefined,
                    mutation_type: undefined,
                    mutation_direction: undefined,
                    mutation_start_date: undefined,
                    mutation_end_date: undefined,
                    mutation_sort: undefined,
                    mutation_sort_dir: undefined,
                    mutation_table_sort: undefined,
                    mutation_table_dir: undefined,
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

    const currentSortKey =
        filters.mutation_sort && filters.mutation_sort_dir
            ? `${filters.mutation_sort}_${filters.mutation_sort_dir}`
            : 'default'

    const isSorted = currentSortKey !== 'default'
    const isTableSorted = Boolean(filters.mutation_table_sort && filters.mutation_table_dir)

    const activeFilterCount = [
        Boolean(search),
        movementType !== 'all',
        direction !== 'all',
        Boolean(startDate),
        Boolean(endDate),
        isSorted,
        isTableSorted,
    ].filter(Boolean).length

    const hasActiveFilters = activeFilterCount > 0

    const typeItems = React.useMemo(
        () => [{ value: 'all', label: 'Semua Jenis Mutasi' }, ...typeOptions],
        [typeOptions]
    )

    const directionItems = [
        { value: 'all', label: 'Semua Arus' },
        { value: 'in', label: 'Stok Masuk (+)' },
        { value: 'out', label: 'Stok Keluar (-)' },
    ]

    const sortOptions = [
        { value: 'default', label: 'Urutan: Default' },
        { value: 'created_at_desc', label: 'Waktu (Terbaru)' },
        { value: 'created_at_asc', label: 'Waktu (Terlama)' },
        { value: 'qty_change_desc', label: 'Perubahan (Terbesar)' },
        { value: 'qty_change_asc', label: 'Perubahan (Terkecil)' },
        { value: 'stock_after_desc', label: 'Stok Akhir (Tertinggi)' },
        { value: 'stock_after_asc', label: 'Stok Akhir (Terendah)' },
        { value: 'unit_cost_desc', label: 'HPP (Tertinggi)' },
        { value: 'unit_cost_asc', label: 'HPP (Terendah)' },
    ]

    return (
        <div className="mb-4 space-y-3 rounded-lg border bg-card p-3.5 shadow-xs sm:p-4">
            <div className="flex flex-wrap items-center gap-2.5">
                {/* Search Input */}
                <div className="relative w-full sm:w-64 lg:w-72">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                        placeholder="Cari keterangan atau petugas…"
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
                            aria-label="Hapus pencarian"
                        >
                            <X className="h-3.5 w-3.5" />
                        </button>
                    )}
                    {isLoading && (
                        <Loader2 className="absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
                    )}
                </div>

                {/* Filter Jenis Mutasi */}
                <Select
                    items={typeItems}
                    value={movementType}
                    onValueChange={handleTypeChange}
                    disabled={isLoading}
                >
                    <SelectTrigger className="w-full sm:w-auto sm:min-w-[175px] h-9">
                        <SelectValue placeholder="Semua Jenis Mutasi">
                            {(val) => typeItems.find((item) => item.value === val)?.label}
                        </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                        {typeItems.map((item) => (
                            <SelectItem key={item.value} value={item.value}>
                                {item.label}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>

                {/* Filter Arus Stok */}
                <Select
                    items={directionItems}
                    value={direction}
                    onValueChange={handleDirectionChange}
                    disabled={isLoading}
                >
                    <SelectTrigger className="w-full sm:w-auto sm:min-w-[145px] h-9">
                        <SelectValue placeholder="Semua Arus">
                            {(val) => directionItems.find((item) => item.value === val)?.label}
                        </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                        {directionItems.map((item) => (
                            <SelectItem key={item.value} value={item.value}>
                                {item.label}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>

                {/* Tanggal Dari */}
                <div className="flex items-center gap-1.5">
                    <Label
                        htmlFor="mutation-date-from"
                        className="text-xs text-muted-foreground whitespace-nowrap"
                    >
                        Dari:
                    </Label>
                    <Input
                        id="mutation-date-from"
                        type="date"
                        value={startDate}
                        onChange={handleStartDateChange}
                        disabled={isLoading}
                        className="h-9 w-[135px] text-xs"
                    />
                </div>

                {/* Tanggal Sampai */}
                <div className="flex items-center gap-1.5">
                    <Label
                        htmlFor="mutation-date-to"
                        className="text-xs text-muted-foreground whitespace-nowrap"
                    >
                        Sampai:
                    </Label>
                    <Input
                        id="mutation-date-to"
                        type="date"
                        value={endDate}
                        onChange={handleEndDateChange}
                        disabled={isLoading}
                        className="h-9 w-[135px] text-xs"
                    />
                </div>

                {/* Filter Urutan */}
                <Select
                    items={sortOptions}
                    value={currentSortKey}
                    onValueChange={handleSortChange}
                    disabled={isLoading}
                >
                    <SelectTrigger className="w-full sm:w-auto sm:min-w-[185px] h-9">
                        <SelectValue placeholder="Urutan: Default">
                            {(val) => sortOptions.find((item) => item.value === val)?.label}
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
                {isTableSorted && filters.mutation_table_sort && (
                    <div className="flex h-9 items-center gap-1.5 rounded-md border border-primary/20 bg-primary/5 px-2.5 text-xs text-primary">
                        <span className="font-medium">Tabel:</span>
                        <span>
                            {TABLE_SORT_LABELS[filters.mutation_table_sort] ?? filters.mutation_table_sort}{' '}
                            {filters.mutation_table_dir === 'asc' ? '↑' : '↓'}
                        </span>
                        <button
                            type="button"
                            onClick={handleClearTableSort}
                            className="ml-0.5 rounded p-0.5 text-primary/70 hover:bg-primary/10 hover:text-primary cursor-pointer"
                            title="Hapus urutan header tabel"
                            aria-label="Hapus urutan header tabel"
                        >
                            <X className="h-3 w-3" />
                        </button>
                    </div>
                )}

                {/* Reset Button */}
                {hasActiveFilters && (
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleReset}
                        disabled={isLoading}
                        className="h-9 px-3 text-xs gap-1.5 text-muted-foreground hover:text-foreground border-dashed"
                    >
                        <X className="h-3.5 w-3.5" />
                        Reset Filter
                        {activeFilterCount > 0 && (
                            <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
                                {activeFilterCount}
                            </span>
                        )}
                    </Button>
                )}
            </div>
        </div>
    )
}

export default StockMovementSearch

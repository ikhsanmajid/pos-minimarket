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
import { Loader2, X, Search } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { RouteDefinition, RouteQueryOptions } from '@/wayfinder'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ActivityFilters {
    search?: string
    log_name?: string
    subject_type?: string
    date_from?: string
    date_to?: string
    sort?: string
    direction?: string
    table_sort?: string
    table_direction?: string
}

export interface LogNameOption {
    value: string
    label: string
    short_label?: string
    count?: number
    modules?: string[]
}

export interface SubjectTypeOption {
    value: string
    label: string
}

const TABLE_SORT_LABELS: Record<string, string> = {
    id: 'ID',
    created_at: 'Waktu',
    log_name: 'Kategori Log',
    description: 'Deskripsi',
}

interface ActivityLogSearchProps {
    filters: ActivityFilters
    logNames: LogNameOption[]
    subjectTypes: SubjectTypeOption[]
    routeUrl: (options?: RouteQueryOptions) => RouteDefinition<'get'>
    isLoading?: boolean
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ActivityLogSearch({
    filters,
    logNames,
    subjectTypes,
    routeUrl,
    isLoading = false,
}: ActivityLogSearchProps) {
    const [search, setSearch] = React.useState(filters.search ?? '')
    const [logName, setLogName] = React.useState(filters.log_name ?? 'all')
    const [subjectType, setSubjectType] = React.useState(filters.subject_type ?? 'all')
    const [dateFrom, setDateFrom] = React.useState(filters.date_from ?? '')
    const [dateTo, setDateTo] = React.useState(filters.date_to ?? '')
    const isFirstRender = React.useRef(true)

    React.useEffect(() => {
        setSearch(filters.search ?? '')
        setLogName(filters.log_name ?? 'all')
        setSubjectType(filters.subject_type ?? 'all')
        setDateFrom(filters.date_from ?? '')
        setDateTo(filters.date_to ?? '')
    }, [filters.search, filters.log_name, filters.subject_type, filters.date_from, filters.date_to])

    // Debounce search 300ms
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

    const applyFilters = (overrides: {
        searchVal?: string
        logNameVal?: string
        subjectTypeVal?: string
        dateFromVal?: string
        dateToVal?: string
    } = {}) => {
        const sVal = overrides.searchVal !== undefined ? overrides.searchVal : search
        const lVal = overrides.logNameVal !== undefined ? overrides.logNameVal : logName
        const subVal = overrides.subjectTypeVal !== undefined ? overrides.subjectTypeVal : subjectType
        const dfVal = overrides.dateFromVal !== undefined ? overrides.dateFromVal : dateFrom
        const dtVal = overrides.dateToVal !== undefined ? overrides.dateToVal : dateTo

        router.visit(
            routeUrl({
                mergeQuery: {
                    search: sVal || undefined,
                    log_name: lVal !== 'all' ? lVal : undefined,
                    subject_type: subVal !== 'all' ? subVal : undefined,
                    date_from: dfVal || undefined,
                    date_to: dtVal || undefined,
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

    const handleLogNameChange = (val: string | null) => {
        if (val == null) return
        setLogName(val)
        applyFilters({ logNameVal: val })
    }

    const handleSubjectTypeChange = (val: string | null) => {
        if (val == null) return
        setSubjectType(val)

        // Jika modul diubah ke 'all', reset kategori log ke 'all'
        // Jika modul diubah ke model lain, cek apakah kategori saat ini masih ada dalam modul baru
        let newLogName = logName
        if (val === 'all') {
            newLogName = 'all'
        } else {
            const validCategories = logNames.filter((n) => {
                if (!n.modules || n.modules.length === 0) return true
                return n.modules.includes(val) || n.modules.some((m) => m.toLowerCase().includes(val.toLowerCase()))
            })
            if (!validCategories.some((n) => n.value === logName)) {
                newLogName = 'all'
            }
        }

        setLogName(newLogName)
        applyFilters({ subjectTypeVal: val, logNameVal: newLogName })
    }

    const handleDateFromChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value
        setDateFrom(val)
        applyFilters({ dateFromVal: val })
    }

    const handleDateToChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value
        setDateTo(val)
        applyFilters({ dateToVal: val })
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

        // Bersihkan sortir header tabel jika kolom yang dipilih di toolbar sama
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

    const handleReset = () => {
        isFirstRender.current = true
        setSearch('')
        setLogName('all')
        setSubjectType('all')
        setDateFrom('')
        setDateTo('')

        router.visit(
            routeUrl({
                mergeQuery: {
                    search: undefined,
                    log_name: undefined,
                    subject_type: undefined,
                    date_from: undefined,
                    date_to: undefined,
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

    const currentSortKey =
        filters.sort && filters.direction ? `${filters.sort}_${filters.direction}` : 'default'

    const isSorted = currentSortKey !== 'default'
    const isTableSorted = Boolean(filters.table_sort && filters.table_direction)

    const hasActiveFilters =
        Boolean(search) ||
        logName !== 'all' ||
        subjectType !== 'all' ||
        Boolean(dateFrom) ||
        Boolean(dateTo) ||
        isSorted ||
        isTableSorted

    const activeFilterCount = [
        Boolean(search),
        logName !== 'all',
        subjectType !== 'all',
        Boolean(dateFrom),
        Boolean(dateTo),
        isSorted,
        isTableSorted,
    ].filter(Boolean).length

    const isModuleSelected = subjectType !== 'all' && Boolean(subjectType)

    const selectedModuleLabel = React.useMemo(() => {
        return subjectTypes.find((s) => s.value === subjectType)?.label ?? 'Modul'
    }, [subjectTypes, subjectType])

    const availableLogNames = React.useMemo(() => {
        if (!isModuleSelected) return []
        return logNames.filter((n) => {
            if (!n.modules || n.modules.length === 0) return true
            return (
                n.modules.includes(subjectType) ||
                n.modules.some((m) => m.toLowerCase().includes(subjectType.toLowerCase()))
            )
        })
    }, [isModuleSelected, subjectType, logNames])

    const logNameItems = React.useMemo(() => {
        if (!isModuleSelected) {
            return [{ value: 'all', label: 'Pilih modul terlebih dahulu' }]
        }
        return [
            { value: 'all', label: `Semua Kategori (${selectedModuleLabel})` },
            ...availableLogNames,
        ]
    }, [isModuleSelected, selectedModuleLabel, availableLogNames])

    const subjectTypeItems = React.useMemo(
        () => [{ value: 'all', label: 'Semua Modul' }, ...subjectTypes],
        [subjectTypes]
    )

    const sortOptions = [
        { value: 'default', label: 'Urutan: Default' },
        { value: 'created_at_desc', label: 'Waktu (Terbaru)' },
        { value: 'created_at_asc', label: 'Waktu (Terlama)' },
        { value: 'log_name_asc', label: 'Kategori (A → Z)' },
        { value: 'log_name_desc', label: 'Kategori (Z → A)' },
    ]

    return (
        <div className="mb-4 space-y-3">
            <div className="flex flex-wrap items-center gap-2.5">
                {/* Search Input */}
                <div className="relative w-full sm:w-64 lg:w-72">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                    <Input
                        placeholder="Cari aktivitas atau pengguna…"
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

                {/* Filter Modul / Subject Type (Pilih Modul Dulu) */}
                {subjectTypes.length > 0 && (
                    <Select
                        items={subjectTypeItems}
                        value={subjectType}
                        onValueChange={handleSubjectTypeChange}
                        disabled={isLoading}
                    >
                        <SelectTrigger className="w-full sm:w-auto sm:min-w-[170px] h-9">
                            <SelectValue placeholder="Semua Modul">
                                {(val) => subjectTypeItems.find((s) => s.value === val)?.label}
                            </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                            {subjectTypeItems.map((s) => (
                                <SelectItem key={s.value} value={s.value}>
                                    {s.label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                )}

                {/* Filter Kategori Log (Dependen pada Modul yang Dipilih) */}
                <Select
                    items={logNameItems}
                    value={logName}
                    onValueChange={handleLogNameChange}
                    disabled={isLoading || !isModuleSelected}
                >
                    <SelectTrigger
                        className={cn(
                            'w-full sm:w-auto sm:min-w-[230px] h-9 transition-colors',
                            !isModuleSelected && 'opacity-60 cursor-not-allowed bg-muted/40 text-muted-foreground'
                        )}
                        title={!isModuleSelected ? 'Pilih modul terlebih dahulu untuk memilih kategori log' : undefined}
                    >
                        <SelectValue placeholder={!isModuleSelected ? 'Pilih modul terlebih dahulu' : `Semua Kategori (${selectedModuleLabel})`}>
                            {(val) => logNameItems.find((n) => n.value === val)?.label}
                        </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                        {logNameItems.map((n) => (
                            <SelectItem key={n.value} value={n.value}>
                                <div className="flex items-center justify-between w-full gap-2">
                                    <span className="truncate">{n.label}</span>
                                    {typeof n.count === 'number' && (
                                        <span className="text-[10px] text-muted-foreground font-mono bg-muted px-1.5 py-0.5 rounded shrink-0">
                                            {n.count}
                                        </span>
                                    )}
                                </div>
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>

                {/* Tanggal Dari */}
                <div className="flex items-center gap-1.5">
                    <Label htmlFor="date-from" className="text-xs text-muted-foreground whitespace-nowrap">
                        Dari:
                    </Label>
                    <Input
                        id="date-from"
                        type="date"
                        value={dateFrom}
                        onChange={handleDateFromChange}
                        disabled={isLoading}
                        className="h-9 w-[135px] text-xs"
                    />
                </div>

                {/* Tanggal Sampai */}
                <div className="flex items-center gap-1.5">
                    <Label htmlFor="date-to" className="text-xs text-muted-foreground whitespace-nowrap">
                        Sampai:
                    </Label>
                    <Input
                        id="date-to"
                        type="date"
                        value={dateTo}
                        onChange={handleDateToChange}
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
                    <SelectTrigger className="w-full sm:w-auto sm:min-w-[170px] h-9">
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

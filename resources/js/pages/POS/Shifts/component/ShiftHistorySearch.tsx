import * as React from 'react'
import { router } from '@inertiajs/react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import { Loader2, Search, X } from 'lucide-react'
import type { RouteDefinition, RouteQueryOptions } from '@/wayfinder'

export interface ShiftHistoryFilters {
    search?: string
    user_id?: string
    status?: string
    has_variance?: string | boolean
    start_date?: string
    end_date?: string
    sort?: string
    direction?: string
    table_sort?: string
    table_direction?: string
}

export interface CashierOption {
    id: number
    name: string
    role_name: string
}

const TABLE_SORT_LABELS: Record<string, string> = {
    shift_number: 'No. Shift',
    register_name: 'Mesin Kasir',
    opened_at: 'Waktu Buka',
    closed_at: 'Waktu Tutup',
    starting_cash: 'Modal Awal',
    actual_cash: 'Fisik Kas',
    cash_variance: 'Selisih (Variance)',
    total_transactions: 'Trx',
}

interface ShiftHistoryTableToolbarProps {
    filters: ShiftHistoryFilters
    cashiers: CashierOption[]
    canViewAll: boolean
    routeUrl: (options?: RouteQueryOptions) => RouteDefinition<'get'>
    isLoading?: boolean
}

const parseBooleanFilter = (value?: string | boolean): boolean =>
    value === true || value === '1' || value === 'true'

export default function ShiftHistoryTableToolbar({
    filters,
    cashiers,
    canViewAll,
    routeUrl,
    isLoading = false,
}: ShiftHistoryTableToolbarProps) {
    const [search, setSearch] = React.useState(filters.search ?? '')
    const [userId, setUserId] = React.useState(filters.user_id ?? 'all')
    const [status, setStatus] = React.useState(filters.status ?? 'all')
    const [hasVariance, setHasVariance] = React.useState(parseBooleanFilter(filters.has_variance))
    const [startDate, setStartDate] = React.useState(filters.start_date ?? '')
    const [endDate, setEndDate] = React.useState(filters.end_date ?? '')

    React.useEffect(() => {
        setSearch(filters.search ?? '')
        setUserId(filters.user_id ?? 'all')
        setStatus(filters.status ?? 'all')
        setHasVariance(parseBooleanFilter(filters.has_variance))
        setStartDate(filters.start_date ?? '')
        setEndDate(filters.end_date ?? '')
    }, [
        filters.search,
        filters.user_id,
        filters.status,
        filters.has_variance,
        filters.start_date,
        filters.end_date,
    ])

    // Debounce search 300ms
    React.useEffect(() => {
        if (search === (filters.search ?? '')) {
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
            userIdVal?: string
            statusVal?: string
            hasVarianceVal?: boolean
            startDateVal?: string
            endDateVal?: string
        } = {}
    ) => {
        const sVal = overrides.searchVal !== undefined ? overrides.searchVal : search
        const uVal = overrides.userIdVal !== undefined ? overrides.userIdVal : userId
        const stVal = overrides.statusVal !== undefined ? overrides.statusVal : status
        const varVal = overrides.hasVarianceVal !== undefined ? overrides.hasVarianceVal : hasVariance
        const sdVal = overrides.startDateVal !== undefined ? overrides.startDateVal : startDate
        const edVal = overrides.endDateVal !== undefined ? overrides.endDateVal : endDate

        router.visit(
            routeUrl({
                mergeQuery: {
                    search: sVal || undefined,
                    user_id: canViewAll && uVal !== 'all' ? uVal : undefined,
                    status: stVal !== 'all' ? stVal : undefined,
                    has_variance: varVal ? '1' : undefined,
                    start_date: sdVal || undefined,
                    end_date: edVal || undefined,
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

    const handleCashierChange = (val: string | null) => {
        if (val == null) return
        setUserId(val)
        applyFilters({ userIdVal: val })
    }

    const handleStatusChange = (val: string | null) => {
        if (val == null) return
        setStatus(val)
        applyFilters({ statusVal: val })
    }

    const handleVarianceChange = (checked: boolean) => {
        setHasVariance(checked)
        applyFilters({ hasVarianceVal: checked })
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
        setSearch('')
        setUserId('all')
        setStatus('all')
        setHasVariance(false)
        setStartDate('')
        setEndDate('')

        router.visit(
            routeUrl({
                mergeQuery: {
                    search: undefined,
                    user_id: undefined,
                    status: undefined,
                    has_variance: undefined,
                    start_date: undefined,
                    end_date: undefined,
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

    const activeFilterCount = [
        Boolean(search),
        canViewAll && userId !== 'all',
        status !== 'all',
        hasVariance,
        Boolean(startDate),
        Boolean(endDate),
        isSorted,
        isTableSorted,
    ].filter(Boolean).length

    const hasActiveFilters = activeFilterCount > 0

    const cashierItems = React.useMemo(
        () => [
            { value: 'all', label: 'Semua Kasir' },
            ...cashiers.map((c) => ({
                value: String(c.id),
                label: `${c.name} (${c.role_name})`,
            })),
        ],
        [cashiers]
    )

    const statusItems = [
        { value: 'all', label: 'Semua Status' },
        { value: 'open', label: 'Aktif / Berjalan' },
        { value: 'closed', label: 'Ditutup' },
    ]

    const sortOptions = [
        { value: 'default', label: 'Urutan: Default' },
        { value: 'opened_at_desc', label: 'Waktu Buka (Terbaru)' },
        { value: 'opened_at_asc', label: 'Waktu Buka (Terlama)' },
        { value: 'closed_at_desc', label: 'Waktu Tutup (Terbaru)' },
        { value: 'closed_at_asc', label: 'Waktu Tutup (Terlama)' },
        { value: 'shift_number_asc', label: 'No. Shift (A → Z)' },
        { value: 'shift_number_desc', label: 'No. Shift (Z → A)' },
        { value: 'actual_cash_desc', label: 'Fisik Kas (Tertinggi)' },
        { value: 'actual_cash_asc', label: 'Fisik Kas (Terendah)' },
        { value: 'cash_variance_desc', label: 'Selisih (Tertinggi)' },
        { value: 'cash_variance_asc', label: 'Selisih (Terendah)' },
        { value: 'total_transactions_desc', label: 'Transaksi (Terbanyak)' },
        { value: 'total_transactions_asc', label: 'Transaksi (Tersedikit)' },
    ]

    return (
        <div className="mb-4 space-y-3 rounded-lg border bg-card p-3.5 shadow-xs sm:p-4">
            <div className="flex flex-wrap items-center gap-2.5">
                {/* Search Input */}
                <div className="relative w-full sm:w-64 lg:w-72">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                    <Input
                        placeholder="Cari no. shift, kasir, atau mesin…"
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
                        <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
                    )}
                </div>

                {/* Filter Kasir */}
                {canViewAll && (
                    <Select
                        items={cashierItems}
                        value={userId}
                        onValueChange={handleCashierChange}
                        disabled={isLoading}
                    >
                        <SelectTrigger className="w-full sm:w-auto sm:min-w-[180px] h-9">
                            <SelectValue placeholder="Semua Kasir">
                                {(val) => cashierItems.find((c) => c.value === val)?.label}
                            </SelectValue>
                        </SelectTrigger>
                        <SelectContent className="w-auto min-w-(--anchor-width)">
                            {cashierItems.map((item) => (
                                <SelectItem key={item.value} value={item.value}>
                                    {item.label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                )}

                {/* Filter Status */}
                <Select
                    items={statusItems}
                    value={status}
                    onValueChange={handleStatusChange}
                    disabled={isLoading}
                >
                    <SelectTrigger className="w-full sm:w-auto sm:min-w-[155px] h-9">
                        <SelectValue placeholder="Semua Status">
                            {(val) => statusItems.find((s) => s.value === val)?.label}
                        </SelectValue>
                    </SelectTrigger>
                    <SelectContent className="w-auto min-w-(--anchor-width)">
                        {statusItems.map((item) => (
                            <SelectItem key={item.value} value={item.value}>
                                {item.label}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>

                {/* Toggle Hanya Selisih */}
                <div className="flex h-9 w-full sm:w-auto items-center justify-between gap-2.5 rounded-md border border-input bg-transparent px-3 shadow-xs dark:bg-input/30">
                    <Label
                        htmlFor="shift-only-variance"
                        className="text-xs font-medium whitespace-nowrap cursor-pointer"
                    >
                        Hanya Selisih
                    </Label>
                    <Switch
                        id="shift-only-variance"
                        checked={hasVariance}
                        onCheckedChange={handleVarianceChange}
                        disabled={isLoading}
                    />
                </div>

                {/* Tanggal Dari */}
                <div className="flex items-center gap-1.5">
                    <Label
                        htmlFor="shift-date-from"
                        className="text-xs text-muted-foreground whitespace-nowrap"
                    >
                        Dari:
                    </Label>
                    <Input
                        id="shift-date-from"
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
                        htmlFor="shift-date-to"
                        className="text-xs text-muted-foreground whitespace-nowrap"
                    >
                        Sampai:
                    </Label>
                    <Input
                        id="shift-date-to"
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
                    <SelectTrigger className="w-full sm:w-auto sm:min-w-[205px] h-9">
                        <SelectValue placeholder="Urutan: Default">
                            {(val) => sortOptions.find((s) => s.value === val)?.label}
                        </SelectValue>
                    </SelectTrigger>
                    <SelectContent className="w-auto min-w-(--anchor-width)">
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
                            aria-label="Hapus urutan header tabel"
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

export { ShiftHistoryTableToolbar as ShiftHistorySearch }

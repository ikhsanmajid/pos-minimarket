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
import SelectSupplierAsync, { type SupplierOption } from './SelectSupplierAsync'

export interface PurchaseOrderFilters {
    search?: string
    status?: string
    payment_status?: string
    supplier_id?: string
    start_date?: string
    end_date?: string
    sort?: string
    direction?: string
    table_sort?: string
    table_direction?: string
}

interface SupplierProp {
    id: number
    name: string
    code: string | null
    is_active: boolean
}

interface StatusOption {
    value: string
    label: string
}

interface PurchaseOrderTableToolbarProps {
    filters: PurchaseOrderFilters
    suppliers: SupplierProp[]
    statuses: StatusOption[]
    paymentStatuses: StatusOption[]
    routeUrl: (options?: RouteQueryOptions) => RouteDefinition<'get'>
    isLoading?: boolean
}

const TABLE_SORT_LABELS: Record<string, string> = {
    po_number: 'No. PO',
    order_date: 'Tgl Pesan',
    expected_date: 'Estimasi Datang',
    due_date: 'Jatuh Tempo',
    status: 'Status',
    payment_status: 'Pembayaran',
    total_amount: 'Total Tagihan',
}

export function PurchaseOrderTableToolbar({
    filters,
    suppliers,
    statuses,
    paymentStatuses,
    routeUrl,
    isLoading = false,
}: PurchaseOrderTableToolbarProps) {
    const [search, setSearch] = React.useState(filters.search ?? '')
    const [status, setStatus] = React.useState(filters.status ?? 'all')
    const [paymentStatus, setPaymentStatus] = React.useState(filters.payment_status ?? 'all')
    const [supplierId, setSupplierId] = React.useState(filters.supplier_id ?? 'all')
    const [startDate, setStartDate] = React.useState(filters.start_date ?? '')
    const [endDate, setEndDate] = React.useState(filters.end_date ?? '')
    const isFirstRender = React.useRef(true)

    React.useEffect(() => {
        setStatus(filters.status ?? 'all')
        setPaymentStatus(filters.payment_status ?? 'all')
        setSupplierId(filters.supplier_id ?? 'all')
        setStartDate(filters.start_date ?? '')
        setEndDate(filters.end_date ?? '')
    }, [filters.status, filters.payment_status, filters.supplier_id, filters.start_date, filters.end_date])

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
        statusVal?: string
        paymentStatusVal?: string
        supplierIdVal?: string
        startDateVal?: string
        endDateVal?: string
    } = {}) => {
        const s = overrides.searchVal !== undefined ? overrides.searchVal : search
        const st = overrides.statusVal !== undefined ? overrides.statusVal : status
        const pst = overrides.paymentStatusVal !== undefined ? overrides.paymentStatusVal : paymentStatus
        const sup = overrides.supplierIdVal !== undefined ? overrides.supplierIdVal : supplierId
        const sd = overrides.startDateVal !== undefined ? overrides.startDateVal : startDate
        const ed = overrides.endDateVal !== undefined ? overrides.endDateVal : endDate

        router.visit(
            routeUrl({
                mergeQuery: {
                    search: s || undefined,
                    status: st !== 'all' ? st : undefined,
                    payment_status: pst !== 'all' ? pst : undefined,
                    supplier_id: sup !== 'all' ? sup : undefined,
                    start_date: sd || undefined,
                    end_date: ed || undefined,
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

    const handleSupplierChange = (val: string | null) => {
        if (val == null) return
        setSupplierId(val)
        applyFilters({ supplierIdVal: val })
    }

    const handleStatusChange = (val: string | null) => {
        if (val == null) return
        setStatus(val)
        applyFilters({ statusVal: val })
    }

    const handlePaymentStatusChange = (val: string | null) => {
        if (val == null) return
        setPaymentStatus(val)
        applyFilters({ paymentStatusVal: val })
    }

    const handleStartDateChange = (val: string) => {
        setStartDate(val)
        applyFilters({ startDateVal: val })
    }

    const handleEndDateChange = (val: string) => {
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

    const handleReset = () => {
        isFirstRender.current = true
        setSearch('')
        setStatus('all')
        setPaymentStatus('all')
        setSupplierId('all')
        setStartDate('')
        setEndDate('')

        router.visit(
            routeUrl({
                mergeQuery: {
                    search: undefined,
                    status: undefined,
                    payment_status: undefined,
                    supplier_id: undefined,
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
        status !== 'all' ||
        paymentStatus !== 'all' ||
        supplierId !== 'all' ||
        Boolean(startDate) ||
        Boolean(endDate) ||
        isSorted ||
        isTableSorted

    const activeFilterCount = [
        Boolean(search),
        status !== 'all',
        paymentStatus !== 'all',
        supplierId !== 'all',
        Boolean(startDate),
        Boolean(endDate),
        isSorted,
        isTableSorted,
    ].filter(Boolean).length

    const statusItems = React.useMemo(() => [
        { value: 'all', label: 'Semua Status' },
        ...statuses,
    ], [statuses])

    const paymentStatusItems = React.useMemo(() => [
        { value: 'all', label: 'Semua Bayar' },
        ...paymentStatuses,
    ], [paymentStatuses])

    const sortOptions = [
        { value: 'default', label: 'Urutan: Default' },
        { value: 'po_number_asc', label: 'No. PO (A → Z)' },
        { value: 'po_number_desc', label: 'No. PO (Z → A)' },
        { value: 'order_date_desc', label: 'Tgl Pesan (Terbaru)' },
        { value: 'order_date_asc', label: 'Tgl Pesan (Terlama)' },
        { value: 'total_amount_desc', label: 'Tagihan (Tertinggi)' },
        { value: 'total_amount_asc', label: 'Tagihan (Terendah)' },
        { value: 'created_at_desc', label: 'Terbaru Ditambahkan' },
    ]

    const supplierOptions = React.useMemo<SupplierOption[]>(() => {
        return suppliers.map((s) => ({
            value: s.id,
            label: s.code ? `${s.name} (${s.code})` : s.name,
        }))
    }, [suppliers])

    return (
        <div className="mb-4 space-y-3">
            <div className="flex flex-wrap items-center gap-2.5">
                {/* Search Input: Khusus No PO */}
                <div className="relative w-full sm:w-60 lg:w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                    <Input
                        placeholder="Cari No. PO..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="pl-9 pr-8 h-9 text-sm"
                    />
                    {search && !isLoading && (
                        <button
                            type="button"
                            onClick={() => setSearch('')}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
                            title="Hapus pencarian No. PO"
                        >
                            <X className="h-3.5 w-3.5" />
                        </button>
                    )}
                    {isLoading && (
                        <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
                    )}
                </div>

                {/* Filter Supplier (React-Select Async) */}
                <SelectSupplierAsync
                    value={supplierId !== 'all' ? Number(supplierId) : null}
                    onChange={(val) => handleSupplierChange(val ? String(val) : 'all')}
                    placeholder="Semua Supplier"
                    defaultOptions={supplierOptions.length > 0 ? supplierOptions : true}
                    onlyActive={false}
                    isClearable
                    disabled={isLoading}
                    className="w-full sm:w-[185px] lg:w-[210px]"
                />

                {/* Filter Status PO */}
                <Select
                    items={statusItems}
                    value={status}
                    onValueChange={handleStatusChange}
                    disabled={isLoading}
                >
                    <SelectTrigger className="w-full sm:w-[145px] h-9">
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

                {/* Filter Status Pembayaran */}
                <Select
                    items={paymentStatusItems}
                    value={paymentStatus}
                    onValueChange={handlePaymentStatusChange}
                    disabled={isLoading}
                >
                    <SelectTrigger className="w-full sm:w-[145px] h-9">
                        <SelectValue placeholder="Semua Bayar">
                            {(val) => paymentStatusItems.find((p) => p.value === val)?.label}
                        </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                        {paymentStatusItems.map((item) => (
                            <SelectItem key={item.value} value={item.value}>
                                {item.label}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>

                {/* Filter Rentang Tanggal Pesanan */}
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Input
                        type="date"
                        value={startDate}
                        onChange={(e) => handleStartDateChange(e.target.value)}
                        className="w-[125px] h-9 text-xs"
                        title="Tanggal Mulai Pesanan"
                        disabled={isLoading}
                    />
                    <span>-</span>
                    <Input
                        type="date"
                        value={endDate}
                        onChange={(e) => handleEndDateChange(e.target.value)}
                        className="w-[125px] h-9 text-xs"
                        title="Tanggal Akhir Pesanan"
                        disabled={isLoading}
                    />
                </div>

                {/* Filter Urutan */}
                <Select
                    items={sortOptions}
                    value={currentSortKey}
                    onValueChange={handleSortChange}
                    disabled={isLoading}
                >
                    <SelectTrigger className="w-full sm:w-[170px] h-9">
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
                        onClick={handleReset}
                        disabled={isLoading}
                        size="sm"
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

export default PurchaseOrderTableToolbar

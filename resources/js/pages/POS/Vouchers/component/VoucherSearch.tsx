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

export interface VoucherFilters {
    search?: string
    status?: string
    type?: string
    member_only?: string
    sort?: string
    direction?: string
    table_sort?: string
    table_direction?: string
}

interface VoucherSearchProps {
    filters: VoucherFilters
    typeOptions: Array<{ value: string; label: string }>
    routeUrl: (options?: RouteQueryOptions) => RouteDefinition<'get'>
    isLoading?: boolean
}

const TABLE_SORT_LABELS: Record<string, string> = {
    code: 'Kode',
    name: 'Nama Voucher',
    type: 'Tipe',
    value: 'Nilai',
    min_spend: 'Min. Belanja',
    used_count: 'Terpakai',
    valid_from: 'Mulai',
    valid_until: 'Berakhir',
    status: 'Status',
    created_at: 'Dibuat',
}

export function VoucherSearch({
    filters,
    typeOptions,
    routeUrl,
    isLoading = false,
}: VoucherSearchProps) {
    const [search, setSearch] = React.useState(filters.search ?? '')
    const [status, setStatus] = React.useState(filters.status ?? 'all')
    const [type, setType] = React.useState(filters.type ?? 'all')
    const [memberOnly, setMemberOnly] = React.useState(filters.member_only ?? 'all')
    const isFirstRender = React.useRef(true)

    React.useEffect(() => {
        setStatus(filters.status ?? 'all')
    }, [filters.status])

    React.useEffect(() => {
        setType(filters.type ?? 'all')
    }, [filters.type])

    React.useEffect(() => {
        setMemberOnly(filters.member_only ?? 'all')
    }, [filters.member_only])

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

    const applyFilters = (
        overrides: {
            searchVal?: string
            statusVal?: string
            typeVal?: string
            memberVal?: string
        } = {}
    ) => {
        const sVal = overrides.searchVal !== undefined ? overrides.searchVal : search
        const stVal = overrides.statusVal !== undefined ? overrides.statusVal : status
        const tVal = overrides.typeVal !== undefined ? overrides.typeVal : type
        const mVal = overrides.memberVal !== undefined ? overrides.memberVal : memberOnly

        router.visit(
            routeUrl({
                mergeQuery: {
                    search: sVal || undefined,
                    status: stVal !== 'all' ? stVal : undefined,
                    type: tVal !== 'all' ? tVal : undefined,
                    member_only: mVal !== 'all' ? mVal : undefined,
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
        setType('all')
        setMemberOnly('all')

        router.visit(
            routeUrl({
                mergeQuery: {
                    search: undefined,
                    status: undefined,
                    type: undefined,
                    member_only: undefined,
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

    const activeFilterCount = [
        Boolean(search),
        status !== 'all',
        type !== 'all',
        memberOnly !== 'all',
        isSorted,
        isTableSorted,
    ].filter(Boolean).length

    const statusItems = [
        { value: 'all', label: 'Semua Status' },
        { value: 'active', label: 'Aktif' },
        { value: 'draft', label: 'Draft' },
        { value: 'paused', label: 'Dijeda' },
        { value: 'expired', label: 'Kedaluwarsa' },
        { value: 'exhausted', label: 'Kuota Habis' },
    ]

    const typeItems = [{ value: 'all', label: 'Semua Tipe Voucher' }, ...typeOptions]

    const memberItems = [
        { value: 'all', label: 'Semua Pelanggan' },
        { value: 'member', label: 'Khusus Member' },
        { value: 'public', label: 'Umum & Member' },
    ]

    const sortOptions = [
        { value: 'default', label: 'Urutan: Terbaru' },
        { value: 'code_asc', label: 'Kode (A → Z)' },
        { value: 'name_asc', label: 'Nama Voucher (A → Z)' },
        { value: 'used_count_desc', label: 'Paling Sering Dipakai' },
        { value: 'valid_until_asc', label: 'Segera Berakhir' },
    ]

    return (
        <div className="mb-4 space-y-3 rounded-lg border bg-card p-3.5 shadow-xs sm:p-4">
            <div className="flex flex-wrap items-center gap-2.5">
                <div className="relative w-full sm:w-64 lg:w-72">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                    <Input
                        placeholder="Cari kode atau nama voucher…"
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

                <Select
                    items={statusItems}
                    value={status}
                    onValueChange={(val) => {
                        if (val == null) return
                        setStatus(val)
                        applyFilters({ statusVal: val })
                    }}
                    disabled={isLoading}
                >
                    <SelectTrigger className="w-full sm:w-auto sm:min-w-[145px] h-9">
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

                <Select
                    items={typeItems}
                    value={type}
                    onValueChange={(val) => {
                        if (val == null) return
                        setType(val)
                        applyFilters({ typeVal: val })
                    }}
                    disabled={isLoading}
                >
                    <SelectTrigger className="w-full sm:w-auto sm:min-w-[165px] h-9">
                        <SelectValue placeholder="Semua Tipe Voucher">
                            {(val) => typeItems.find((t) => t.value === val)?.label}
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

                <Select
                    items={memberItems}
                    value={memberOnly}
                    onValueChange={(val) => {
                        if (val == null) return
                        setMemberOnly(val)
                        applyFilters({ memberVal: val })
                    }}
                    disabled={isLoading}
                >
                    <SelectTrigger className="w-full sm:w-auto sm:min-w-[155px] h-9">
                        <SelectValue placeholder="Semua Pelanggan">
                            {(val) => memberItems.find((m) => m.value === val)?.label}
                        </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                        {memberItems.map((item) => (
                            <SelectItem key={item.value} value={item.value}>
                                {item.label}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>

                <Select
                    items={sortOptions}
                    value={currentSortKey}
                    onValueChange={handleSortChange}
                    disabled={isLoading}
                >
                    <SelectTrigger className="w-full sm:w-auto sm:min-w-[175px] h-9">
                        <SelectValue placeholder="Urutan: Terbaru">
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

                {activeFilterCount > 0 && (
                    <Button
                        variant="outline"
                        onClick={handleReset}
                        disabled={isLoading}
                        size="sm"
                        className="h-9 px-3 text-xs gap-1.5 text-muted-foreground hover:text-foreground border-dashed cursor-pointer"
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

export default VoucherSearch

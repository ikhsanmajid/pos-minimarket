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
import { Loader2, X, Search } from 'lucide-react'
import type { RouteDefinition, RouteQueryOptions } from '@/wayfinder'
import type { RoleOption } from '../Users'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface UserFilters {
    search?: string
    role?: string
    is_active?: string
    sort?: string
    direction?: string
    table_sort?: string
    table_direction?: string
}

const TABLE_SORT_LABELS: Record<string, string> = {
    name: 'Pengguna',
    phone: 'No. HP',
    role: 'Role',
    is_active: 'Status',
    last_login_at: 'Login Terakhir',
    created_at: 'Tanggal Dibuat',
}

interface UserTableToolbarProps {
    filters: UserFilters
    roles: RoleOption[]
    routeUrl: (options?: RouteQueryOptions) => RouteDefinition<'get'>
    isLoading?: boolean
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function UserTableToolbar({
    filters,
    roles,
    routeUrl,
    isLoading = false,
}: UserTableToolbarProps) {
    const [search, setSearch] = React.useState(filters.search ?? '')
    const [role, setRole] = React.useState(filters.role ?? 'all')
    const [isActive, setIsActive] = React.useState(filters.is_active ?? 'all')
    const isFirstRender = React.useRef(true)

    React.useEffect(() => {
        setRole(filters.role ?? 'all')
        setIsActive(filters.is_active ?? 'all')
    }, [filters.role, filters.is_active])

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
        roleVal?: string
        statusVal?: string
    } = {}) => {
        const sVal = overrides.searchVal !== undefined ? overrides.searchVal : search
        const rVal = overrides.roleVal !== undefined ? overrides.roleVal : role
        const stVal = overrides.statusVal !== undefined ? overrides.statusVal : isActive

        router.visit(
            routeUrl({
                mergeQuery: {
                    search: sVal || undefined,
                    role: rVal !== 'all' ? rVal : undefined,
                    is_active: stVal !== 'all' ? stVal : undefined,
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

    const handleRoleChange = (val: string | null) => {
        if (val == null) return
        setRole(val)
        applyFilters({ roleVal: val })
    }

    const handleStatusChange = (val: string | null) => {
        if (val == null) return
        setIsActive(val)
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

    const handleReset = () => {
        isFirstRender.current = true
        setSearch('')
        setRole('all')
        setIsActive('all')

        router.visit(
            routeUrl({
                mergeQuery: {
                    search: undefined,
                    role: undefined,
                    is_active: undefined,
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
        role !== 'all' ||
        isActive !== 'all' ||
        isSorted ||
        isTableSorted

    const activeFilterCount = [
        Boolean(search),
        role !== 'all',
        isActive !== 'all',
        isSorted,
        isTableSorted,
    ].filter(Boolean).length

    const roleItems = React.useMemo(
        () => [{ value: 'all', label: 'Semua Role' }, ...roles],
        [roles]
    )

    const statusItems = [
        { value: 'all', label: 'Semua Status' },
        { value: 'true', label: 'Aktif' },
        { value: 'false', label: 'Nonaktif' },
    ]

    const sortOptions = [
        { value: 'default', label: 'Urutan: Default' },
        { value: 'name_asc', label: 'Nama (A → Z)' },
        { value: 'name_desc', label: 'Nama (Z → A)' },
        { value: 'role_asc', label: 'Role (A → Z)' },
        { value: 'role_desc', label: 'Role (Z → A)' },
        { value: 'is_active_desc', label: 'Status (Aktif Dulu)' },
        { value: 'is_active_asc', label: 'Status (Nonaktif Dulu)' },
        { value: 'last_login_at_desc', label: 'Login Terakhir (Terbaru)' },
        { value: 'last_login_at_asc', label: 'Login Terakhir (Terlama)' },
        { value: 'created_at_desc', label: 'Terbaru Ditambahkan' },
        { value: 'created_at_asc', label: 'Terlama Ditambahkan' },
    ]

    return (
        <div className="mb-4 space-y-3">
            <div className="flex flex-wrap items-center gap-2.5">
                {/* Search Input */}
                <div className="relative w-full sm:w-64 lg:w-72">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                    <Input
                        placeholder="Cari nama, email, atau no. HP…"
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

                {/* Filter Role */}
                <Select items={roleItems} value={role} onValueChange={handleRoleChange} disabled={isLoading}>
                    <SelectTrigger className="w-full sm:w-auto sm:min-w-[150px] h-9">
                        <SelectValue placeholder="Semua Role">
                            {(val) => roleItems.find((r) => r.value === val)?.label}
                        </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                        {roleItems.map((r) => (
                            <SelectItem key={r.value} value={r.value}>
                                {r.label}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>

                {/* Filter Status Aktif */}
                <Select items={statusItems} value={isActive} onValueChange={handleStatusChange} disabled={isLoading}>
                    <SelectTrigger className="w-full sm:w-auto sm:min-w-[140px] h-9">
                        <SelectValue placeholder="Semua Status">
                            {(val) => statusItems.find((s) => s.value === val)?.label}
                        </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                        {statusItems.map((s) => (
                            <SelectItem key={s.value} value={s.value}>
                                {s.label}
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
                    <SelectTrigger className="w-full sm:w-auto sm:min-w-[185px] h-9">
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

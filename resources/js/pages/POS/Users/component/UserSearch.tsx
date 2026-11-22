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
import { Loader2, X } from 'lucide-react'
import { type RouteDefinition, type RouteQueryOptions } from '@/wayfinder'
import type { RoleOption } from '../Users'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Filters {
    search?: string
    role?: string
}

interface UserTableToolbarProps {
    filters: Filters
    roles: RoleOption[]
    routeUrl: (options?: RouteQueryOptions) => RouteDefinition<'get'>
    isLoading?: boolean
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function UserTableToolbar({ filters, roles, routeUrl, isLoading = false }: UserTableToolbarProps) {
    const [search, setSearch] = React.useState(filters.search ?? '')
    const [role, setRole] = React.useState(filters.role ?? 'all')
    const isFirstRender = React.useRef(true)

    // Debounce search — kirim setelah 300ms tanpa ketikan
    React.useEffect(() => {
        if (isFirstRender.current) {
            isFirstRender.current = false
            return
        }

        const timeout = setTimeout(() => {
            applyFilters(search, role)
        }, 300)

        return () => clearTimeout(timeout)
    }, [search])

    const applyFilters = (searchVal: string, roleVal: string) => {
        router.visit(
            routeUrl({
                mergeQuery: {
                    search: searchVal || undefined,
                    role: roleVal !== 'all' ? roleVal : undefined,
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
        applyFilters(search, val)
    }

    const handleReset = () => {
        isFirstRender.current = true
        setSearch('')
        setRole('all')
        router.visit(
            routeUrl({
                mergeQuery: {
                    search: undefined,
                    role: undefined,
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

    const hasActiveFilters = Boolean(search) || role !== 'all'

    const roleItems = React.useMemo(() => [
        { value: 'all', label: 'Semua Role' },
        ...roles,
    ], [roles])

    return (
        <div className="mb-4 flex flex-wrap items-center gap-2">
            <div className="relative w-full max-w-xs">
                <Input
                    placeholder="Cari nama atau email…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pr-8"
                />
                {isLoading && (
                    <Loader2 className="absolute top-1/2 right-2.5 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
                )}
            </div>

            <Select items={roleItems} value={role} onValueChange={handleRoleChange} disabled={isLoading}>
                <SelectTrigger className="w-[160px]">
                    <SelectValue placeholder="Semua Role">
                        {(val) => roleItems.find((r) => r.value === val)?.label}
                    </SelectValue>
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="all">Semua Role</SelectItem>
                    {roles.map((r) => (
                        <SelectItem key={r.value} value={r.value}>
                            {r.label}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>

            {hasActiveFilters && (
                <Button variant="ghost" onClick={handleReset} disabled={isLoading} className="px-2.5">
                    Reset
                    <X className="ml-1.5 h-4 w-4" />
                </Button>
            )}
        </div>
    )
}

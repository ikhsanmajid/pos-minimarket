import React, { useEffect, useMemo, useRef, useState } from 'react'
import { router } from '@inertiajs/react'
import { ArrowDown, ArrowUp, Loader2, Search, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import transactions from '@/routes/pos/transactions'
import { TRANSACTION_SORT_LABELS, TRANSACTION_SORT_OPTIONS } from './transactionUtils'

export interface TransactionFilters {
    search?: string
    user_id?: string
    payment_method?: string
    status?: string
    start_date?: string
    end_date?: string
    sort?: string
    direction?: string
    table_sort?: string
    table_direction?: string
}

interface TransactionSearchProps {
    filters: TransactionFilters
    cashiers: { id: number; name: string; role_name: string }[]
    canViewAll: boolean
    statusOptions: { value: string; label: string }[]
    paymentMethodOptions: { value: string; label: string }[]
    isLoading: boolean
}

export function TransactionSearch({
    filters,
    cashiers,
    canViewAll,
    statusOptions,
    paymentMethodOptions,
    isLoading,
}: TransactionSearchProps) {
    const [search, setSearch] = useState(filters.search ?? '')
    const isFirstRender = useRef(true)

    useEffect(() => {
        setSearch(filters.search ?? '')
    }, [filters.search])

    const applyQuery = (params: Record<string, string | number | undefined>) => {
        router.visit(
            transactions.index({
                mergeQuery: {
                    ...params,
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

        const timer = window.setTimeout(() => {
            if (search !== (filters.search ?? '')) {
                applyQuery({ search: search.trim() || undefined })
            }
        }, 300)

        return () => window.clearTimeout(timer)
    }, [search])

    const statusItems = useMemo(
        () => [{ value: 'all', label: 'Semua Status' }, ...statusOptions],
        [statusOptions]
    )

    const paymentItems = useMemo(
        () => [{ value: 'all', label: 'Semua Metode' }, ...paymentMethodOptions],
        [paymentMethodOptions]
    )

    const cashierItems = useMemo(
        () => [
            { value: 'all', label: 'Semua Kasir' },
            ...cashiers.map((c) => ({ value: String(c.id), label: c.name })),
        ],
        [cashiers]
    )

    const currentSortValue =
        filters.sort && filters.direction ? `${filters.sort}:${filters.direction}` : 'default'

    const activeFilterCount = [
        filters.search,
        filters.status && filters.status !== 'all' ? filters.status : null,
        filters.payment_method && filters.payment_method !== 'all' ? filters.payment_method : null,
        canViewAll && filters.user_id && filters.user_id !== 'all' ? filters.user_id : null,
        filters.start_date,
        filters.end_date,
        filters.sort,
        filters.table_sort,
    ].filter(Boolean).length

    const handleSortChange = (val: string | null) => {
        if (!val || val === 'default') {
            applyQuery({ sort: undefined, direction: undefined })
            return
        }
        const [field, dir] = val.split(':')
        const clearTableSort = filters.table_sort === field
        applyQuery({
            sort: field,
            direction: dir,
            ...(clearTableSort ? { table_sort: undefined, table_direction: undefined } : {}),
        })
    }

    const handleReset = () => {
        setSearch('')
        router.visit(transactions.index.url(), {
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
                        placeholder="Cari no. invoice, kasir, pelanggan…"
                        disabled={isLoading}
                        className="pl-9 pr-8 h-9 text-sm"
                    />
                    {isLoading ? (
                        <Loader2 className="absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
                    ) : (
                        search && (
                            <button
                                type="button"
                                onClick={() => setSearch('')}
                                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
                                title="Hapus pencarian"
                            >
                                <X className="h-3.5 w-3.5" />
                            </button>
                        )
                    )}
                </div>

                {/* Status Filter */}
                <Select
                    value={filters.status || 'all'}
                    onValueChange={(v) => applyQuery({ status: !v || v === 'all' ? undefined : v })}
                    items={statusItems}
                    disabled={isLoading}
                >
                    <SelectTrigger className="w-full sm:w-auto sm:min-w-[155px] h-9">
                        <SelectValue>
                            {(val) => statusItems.find((i) => i.value === val)?.label ?? 'Semua Status'}
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

                {/* Payment Method Filter */}
                <Select
                    value={filters.payment_method || 'all'}
                    onValueChange={(v) =>
                        applyQuery({ payment_method: !v || v === 'all' ? undefined : v })
                    }
                    items={paymentItems}
                    disabled={isLoading}
                >
                    <SelectTrigger className="w-full sm:w-auto sm:min-w-[155px] h-9">
                        <SelectValue>
                            {(val) => paymentItems.find((i) => i.value === val)?.label ?? 'Semua Metode'}
                        </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                        {paymentItems.map((item) => (
                            <SelectItem key={item.value} value={item.value}>
                                {item.label}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>

                {/* Cashier Filter */}
                {canViewAll && (
                    <Select
                        value={filters.user_id || 'all'}
                        onValueChange={(v) => applyQuery({ user_id: !v || v === 'all' ? undefined : v })}
                        items={cashierItems}
                        disabled={isLoading}
                    >
                        <SelectTrigger className="w-full sm:w-auto sm:min-w-[155px] h-9">
                            <SelectValue>
                                {(val) => cashierItems.find((i) => i.value === val)?.label ?? 'Semua Kasir'}
                            </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                            {cashierItems.map((item) => (
                                <SelectItem key={item.value} value={item.value}>
                                    {item.label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                )}

                {/* Date Range */}
                <div className="flex items-center gap-1.5">
                    <Label htmlFor="tx-date-from" className="text-xs text-muted-foreground whitespace-nowrap">
                        Dari:
                    </Label>
                    <Input
                        id="tx-date-from"
                        type="date"
                        value={filters.start_date ?? ''}
                        onChange={(e) => applyQuery({ start_date: e.target.value || undefined })}
                        disabled={isLoading}
                        className="h-9 w-[135px] text-xs"
                    />
                </div>

                <div className="flex items-center gap-1.5">
                    <Label htmlFor="tx-date-to" className="text-xs text-muted-foreground whitespace-nowrap">
                        Sampai:
                    </Label>
                    <Input
                        id="tx-date-to"
                        type="date"
                        value={filters.end_date ?? ''}
                        onChange={(e) => applyQuery({ end_date: e.target.value || undefined })}
                        disabled={isLoading}
                        className="h-9 w-[135px] text-xs"
                    />
                </div>

                {/* Toolbar Sort */}
                <Select
                    value={currentSortValue}
                    onValueChange={handleSortChange}
                    items={TRANSACTION_SORT_OPTIONS}
                    disabled={isLoading}
                >
                    <SelectTrigger className="w-full sm:w-auto sm:min-w-[180px] h-9">
                        <SelectValue>
                            {(val) =>
                                TRANSACTION_SORT_OPTIONS.find((i) => i.value === val)?.label ??
                                'Urutan: Default'
                            }
                        </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                        {TRANSACTION_SORT_OPTIONS.map((item) => (
                            <SelectItem key={item.value} value={item.value}>
                                {item.label}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>

                {/* Active Table Sort Chip */}
                {filters.table_sort && (
                    <div className="flex h-9 items-center gap-1.5 rounded-md border border-primary/20 bg-primary/5 px-2.5 text-xs text-primary">
                        <span>
                            Tabel: {TRANSACTION_SORT_LABELS[filters.table_sort] ?? filters.table_sort}
                        </span>
                        {filters.table_direction === 'asc' ? (
                            <ArrowUp className="h-3 w-3" />
                        ) : (
                            <ArrowDown className="h-3 w-3" />
                        )}
                        <button
                            type="button"
                            onClick={() =>
                                applyQuery({ table_sort: undefined, table_direction: undefined })
                            }
                            className="ml-0.5 rounded hover:bg-primary/10 p-0.5 cursor-pointer"
                            title="Hapus sortir kolom tabel"
                        >
                            <X className="h-3 w-3" />
                        </button>
                    </div>
                )}

                {/* Reset Button */}
                {activeFilterCount > 0 && (
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleReset}
                        disabled={isLoading}
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

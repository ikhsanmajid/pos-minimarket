import React, { useEffect, useRef, useState } from 'react'
import { router } from '@inertiajs/react'
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
import SupplierPromoClaimController from '@/actions/App/Http/Controllers/SupplierPromoClaimController'
import { Loader2, Search, X } from 'lucide-react'
import type { SupplierPromoClaimFilters } from './supplierPromoClaimColumns'

interface OptionItem {
    value: string
    label: string
}

interface SupplierPromoClaimSearchProps {
    filters: SupplierPromoClaimFilters
    suppliers: Array<{ id: number; name: string }>
    settlementMethods: OptionItem[]
    isLoading?: boolean
}

const STATUS_OPTIONS: OptionItem[] = [
    { value: 'all', label: 'Semua Status' },
    { value: 'pending', label: 'Belum Diklaim' },
    { value: 'claimed', label: 'Diajukan' },
    { value: 'paid', label: 'Lunas / Selesai' },
]

const SORT_OPTIONS: OptionItem[] = [
    { value: 'default', label: 'Urutan: Terbaru' },
    { value: 'supplier_discount_amount:desc', label: 'Porsi Supplier: Terbesar' },
    { value: 'supplier_discount_amount:asc', label: 'Porsi Supplier: Terkecil' },
    { value: 'created_at:asc', label: 'Tanggal: Terlama' },
]

const TABLE_SORT_LABELS: Record<string, string> = {
    created_at: 'Tanggal',
    supplier_discount_amount: 'Porsi Supplier',
    claim_status: 'Status',
}

export function SupplierPromoClaimSearch({
    filters,
    suppliers,
    settlementMethods,
    isLoading = false,
}: SupplierPromoClaimSearchProps) {
    const [search, setSearch] = useState(filters.search ?? '')
    const isFirstRender = useRef(true)

    useEffect(() => {
        setSearch(filters.search ?? '')
    }, [filters.search])

    useEffect(() => {
        if (isFirstRender.current) {
            isFirstRender.current = false
            return
        }
        const timer = window.setTimeout(() => {
            router.visit(
                SupplierPromoClaimController.index({
                    mergeQuery: {
                        search: search.trim() || undefined,
                        page: 1,
                    },
                }),
                { preserveState: true, preserveScroll: true, replace: true }
            )
        }, 300)

        return () => window.clearTimeout(timer)
    }, [search])

    const supplierItems: OptionItem[] = [
        { value: 'all', label: 'Semua Supplier' },
        ...suppliers.map((s) => ({ value: String(s.id), label: s.name })),
    ]

    const methodItems: OptionItem[] = [
        { value: 'all', label: 'Semua Metode' },
        ...settlementMethods,
    ]

    const currentSortValue =
        filters.sort && filters.direction ? `${filters.sort}:${filters.direction}` : 'default'

    const activeFilterCount = [
        filters.search,
        filters.supplier_id && filters.supplier_id !== 'all' ? filters.supplier_id : null,
        filters.claim_status && filters.claim_status !== 'all' ? filters.claim_status : null,
        filters.settlement_method && filters.settlement_method !== 'all'
            ? filters.settlement_method
            : null,
        filters.date_from,
        filters.date_to,
        filters.sort,
        filters.table_sort,
    ].filter(Boolean).length

    const applyQuery = (mergeQuery: Record<string, string | number | undefined>) => {
        router.visit(
            SupplierPromoClaimController.index({
                mergeQuery: { ...mergeQuery, page: 1 },
            }),
            { preserveState: true, preserveScroll: true, replace: true }
        )
    }

    const handleReset = () => {
        setSearch('')
        router.visit(SupplierPromoClaimController.index.url(), {
            preserveState: true,
            preserveScroll: true,
            replace: true,
        })
    }

    return (
        <div className="mb-4 space-y-3 rounded-lg border bg-card p-3.5 shadow-xs sm:p-4">
            <div className="flex flex-wrap items-center gap-2.5">
                <div className="relative w-full sm:w-64 lg:w-72">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Cari invoice, promo, referensi, supplier..."
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

                <Select
                    items={supplierItems}
                    value={filters.supplier_id ?? 'all'}
                    onValueChange={(val) =>
                        val && applyQuery({ supplier_id: val === 'all' ? undefined : val })
                    }
                    disabled={isLoading}
                >
                    <SelectTrigger className="w-full sm:w-auto sm:min-w-[165px] h-9">
                        <SelectValue>
                            {(val) => supplierItems.find((i) => i.value === val)?.label ?? 'Semua Supplier'}
                        </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                        {supplierItems.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>
                                {opt.label}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>

                <Select
                    items={STATUS_OPTIONS}
                    value={filters.claim_status ?? 'all'}
                    onValueChange={(val) =>
                        val && applyQuery({ claim_status: val === 'all' ? undefined : val })
                    }
                    disabled={isLoading}
                >
                    <SelectTrigger className="w-full sm:w-auto sm:min-w-[150px] h-9">
                        <SelectValue>
                            {(val) => STATUS_OPTIONS.find((i) => i.value === val)?.label ?? 'Semua Status'}
                        </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                        {STATUS_OPTIONS.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>
                                {opt.label}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>

                <Select
                    items={methodItems}
                    value={filters.settlement_method ?? 'all'}
                    onValueChange={(val) =>
                        val && applyQuery({ settlement_method: val === 'all' ? undefined : val })
                    }
                    disabled={isLoading}
                >
                    <SelectTrigger className="w-full sm:w-auto sm:min-w-[170px] h-9">
                        <SelectValue>
                            {(val) => methodItems.find((i) => i.value === val)?.label ?? 'Semua Metode'}
                        </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                        {methodItems.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>
                                {opt.label}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>

                <div className="flex items-center gap-1.5">
                    <Label htmlFor="claim-date-from" className="text-xs text-muted-foreground whitespace-nowrap">
                        Dari:
                    </Label>
                    <Input
                        id="claim-date-from"
                        type="date"
                        value={filters.date_from ?? ''}
                        onChange={(e) => applyQuery({ date_from: e.target.value || undefined })}
                        disabled={isLoading}
                        className="h-9 w-[135px] text-xs"
                    />
                </div>

                <div className="flex items-center gap-1.5">
                    <Label htmlFor="claim-date-to" className="text-xs text-muted-foreground whitespace-nowrap">
                        Sampai:
                    </Label>
                    <Input
                        id="claim-date-to"
                        type="date"
                        value={filters.date_to ?? ''}
                        onChange={(e) => applyQuery({ date_to: e.target.value || undefined })}
                        disabled={isLoading}
                        className="h-9 w-[135px] text-xs"
                    />
                </div>

                <Select
                    items={SORT_OPTIONS}
                    value={currentSortValue}
                    onValueChange={(val) => {
                        if (!val || val === 'default') {
                            applyQuery({ sort: undefined, direction: undefined })
                            return
                        }
                        const [s, d] = val.split(':')
                        applyQuery({
                            sort: s,
                            direction: d,
                            ...(filters.table_sort === s
                                ? { table_sort: undefined, table_direction: undefined }
                                : {}),
                        })
                    }}
                    disabled={isLoading}
                >
                    <SelectTrigger className="w-full sm:w-auto sm:min-w-[165px] h-9">
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

                {filters.table_sort && (
                    <div className="flex h-9 items-center gap-1.5 rounded-md border border-primary/20 bg-primary/5 px-2.5 text-xs text-primary">
                        <span>
                            Tabel: {TABLE_SORT_LABELS[filters.table_sort] ?? filters.table_sort}{' '}
                            {filters.table_direction === 'desc' ? '↓' : '↑'}
                        </span>
                        <button
                            type="button"
                            onClick={() => applyQuery({ table_sort: undefined, table_direction: undefined })}
                            className="hover:text-destructive cursor-pointer"
                            title="Hapus urutan kolom tabel"
                        >
                            <X className="h-3.5 w-3.5" />
                        </button>
                    </div>
                )}

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

export default SupplierPromoClaimSearch

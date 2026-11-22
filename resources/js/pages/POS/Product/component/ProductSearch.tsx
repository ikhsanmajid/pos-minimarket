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
import type { RouteDefinition, RouteQueryOptions } from '@/wayfinder'
import type { Category } from '../Product'

export interface ProductFilters {
    search?: string
    status?: string
    category_id?: string
    stock_status?: string
    sort?: string
    direction?: string
}

interface ProductTableToolbarProps {
    filters: ProductFilters
    categories: Category[]
    routeUrl: (options?: RouteQueryOptions) => RouteDefinition<'get'>
    isLoading?: boolean
}

export default function ProductTableToolbar({
    filters,
    categories,
    routeUrl,
    isLoading = false,
}: ProductTableToolbarProps) {
    const [search, setSearch] = React.useState(filters.search ?? '')
    const [status, setStatus] = React.useState(filters.status ?? 'all')
    const [categoryId, setCategoryId] = React.useState(filters.category_id ?? 'all')
    const [stockStatus, setStockStatus] = React.useState(filters.stock_status ?? 'all')
    const isFirstRender = React.useRef(true)

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
        categoryVal?: string
        stockVal?: string
    } = {}) => {
        const sVal = overrides.searchVal !== undefined ? overrides.searchVal : search
        const stVal = overrides.statusVal !== undefined ? overrides.statusVal : status
        const catVal = overrides.categoryVal !== undefined ? overrides.categoryVal : categoryId
        const stockVal = overrides.stockVal !== undefined ? overrides.stockVal : stockStatus

        router.visit(
            routeUrl({
                mergeQuery: {
                    search: sVal || undefined,
                    status: stVal !== 'all' ? stVal : undefined,
                    category_id: catVal !== 'all' ? catVal : undefined,
                    stock_status: stockVal !== 'all' ? stockVal : undefined,
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

    const handleCategoryChange = (val: string | null) => {
        if (val == null) return
        setCategoryId(val)
        applyFilters({ categoryVal: val })
    }

    const handleStatusChange = (val: string | null) => {
        if (val == null) return
        setStatus(val)
        applyFilters({ statusVal: val })
    }

    const handleStockStatusChange = (val: string | null) => {
        if (val == null) return
        setStockStatus(val)
        applyFilters({ stockVal: val })
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

        router.visit(
            routeUrl({
                mergeQuery: {
                    sort: sortVal,
                    direction: directionVal,
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
        setCategoryId('all')
        setStockStatus('all')

        router.visit(
            routeUrl({
                mergeQuery: {
                    search: undefined,
                    status: undefined,
                    category_id: undefined,
                    stock_status: undefined,
                    sort: undefined,
                    direction: undefined,
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

    const hasActiveFilters =
        Boolean(search) ||
        status !== 'all' ||
        categoryId !== 'all' ||
        stockStatus !== 'all' ||
        isSorted

    const activeFilterCount = [
        Boolean(search),
        status !== 'all',
        categoryId !== 'all',
        stockStatus !== 'all',
        isSorted,
    ].filter(Boolean).length

    // Sort options with Unsorted (Default), Ascending, and Descending
    const sortOptions = [
        { value: 'default', label: 'Urutan: Default' },
        { value: 'name_asc', label: 'Nama (A → Z)' },
        { value: 'name_desc', label: 'Nama (Z → A)' },
        { value: 'sell_price_asc', label: 'Harga (Termurah)' },
        { value: 'sell_price_desc', label: 'Harga (Termahal)' },
        { value: 'stock_asc', label: 'Stok (Terendah)' },
        { value: 'stock_desc', label: 'Stok (Tertinggi)' },
        { value: 'active_desc', label: 'Status (Aktif Dulu)' },
        { value: 'active_asc', label: 'Status (Nonaktif Dulu)' },
        { value: 'created_at_desc', label: 'Terbaru Ditambahkan' },
    ]

    // Category items with "Semua Kategori"
    const categoryItems = React.useMemo(() => [
        { value: 'all', label: 'Semua Kategori' },
        ...categories.map((c) => ({ value: String(c.id), label: c.name })),
    ], [categories])

    // Status items
    const statusItems = [
        { value: 'all', label: 'Semua Status' },
        { value: 'active', label: 'Aktif' },
        { value: 'inactive', label: 'Nonaktif' },
    ]

    // Stock status items
    const stockStatusItems = [
        { value: 'all', label: 'Semua Stok' },
        { value: 'in_stock', label: 'Stok Aman' },
        { value: 'low_stock', label: 'Hampir Habis' },
        { value: 'out_of_stock', label: 'Stok Habis' },
    ]

    return (
        <div className="mb-4 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
                {/* Search Input */}
                <div className="relative w-full sm:w-64">
                    <Input
                        placeholder="Cari nama atau barcode…"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="pr-8 text-sm"
                    />
                    {isLoading && (
                        <Loader2 className="absolute top-1/2 right-2.5 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
                    )}
                </div>

                {/* Filter Kategori */}
                <Select
                    items={categoryItems}
                    value={categoryId}
                    onValueChange={handleCategoryChange}
                    disabled={isLoading}
                >
                    <SelectTrigger className="w-full sm:w-[155px]">
                        <SelectValue placeholder="Semua Kategori">
                            {(val) => categoryItems.find((c) => c.value === val)?.label}
                        </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                        {categoryItems.map((item) => (
                            <SelectItem key={item.value} value={item.value}>
                                {item.label}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>

                {/* Filter Status Aktif */}
                <Select
                    items={statusItems}
                    value={status}
                    onValueChange={handleStatusChange}
                    disabled={isLoading}
                >
                    <SelectTrigger className="w-full sm:w-[140px]">
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

                {/* Filter Status Stok */}
                <Select
                    items={stockStatusItems}
                    value={stockStatus}
                    onValueChange={handleStockStatusChange}
                    disabled={isLoading}
                >
                    <SelectTrigger className="w-full sm:w-[145px]">
                        <SelectValue placeholder="Semua Stok">
                            {(val) => stockStatusItems.find((s) => s.value === val)?.label}
                        </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                        {stockStatusItems.map((item) => (
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
                    <SelectTrigger className="w-full sm:w-[175px]">
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

                {/* Reset Button */}
                {hasActiveFilters && (
                    <Button
                        variant="ghost"
                        onClick={handleReset}
                        disabled={isLoading}
                        size="sm"
                        className="h-9 px-2.5 text-xs text-muted-foreground hover:text-foreground"
                    >
                        <X className="mr-1 h-3.5 w-3.5" />
                        Reset Filter
                        {activeFilterCount > 1 && (
                            <span className="ml-1.5 rounded-full bg-primary/10 px-1.5 py-0.2 text-[10px] font-semibold text-primary">
                                {activeFilterCount}
                            </span>
                        )}
                    </Button>
                )}
            </div>
        </div>
    )
}

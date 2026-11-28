import React, { useEffect, useMemo, useRef, useState } from 'react'
import { router } from '@inertiajs/react'
import { Loader2, Search, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import SelectKategoriProduct, {
    type CategoryOption,
} from '@/pages/POS/Product/component/SelectKategoriProduct'
import reports from '@/routes/pos/reports'
import { ReportFilterBar } from './ReportFilterBar'
import type { ReportFilters, ReportPreset } from './reportUtils'

const MOVEMENT_ITEMS = [
    { value: 'all', label: 'Semua Klasifikasi' },
    { value: 'fast_moving', label: 'Fast Moving' },
    { value: 'slow_moving', label: 'Slow Moving' },
    { value: 'dead_stock', label: 'Dead Stock' },
]

const SORT_LABELS: Record<string, string> = {
    product_name: 'Produk',
    category_name: 'Kategori',
    stock: 'Stok',
    buy_price: 'HPP',
    asset_value: 'Nilai Aset',
    qty_sold: 'Qty Terjual',
    movement_class: 'Klasifikasi',
}

interface StockValuationReportSearchProps {
    filters: ReportFilters
    categories: { id: number; name: string }[]
    isLoading?: boolean
}

export default function StockValuationReportSearch({
    filters,
    categories,
    isLoading = false,
}: StockValuationReportSearchProps) {
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
        const timer = setTimeout(() => {
            visitWith({ search: search || undefined, page: 1 })
        }, 300)
        return () => clearTimeout(timer)
    }, [search])

    const visitWith = (mergeQuery: Record<string, string | number | undefined>) => {
        router.visit(reports.stockValuation.url({ mergeQuery }), {
            preserveState: true,
            preserveScroll: true,
            replace: true,
        })
    }

    const handleApplyPeriod = (preset: ReportPreset, startDate?: string, endDate?: string) => {
        if (preset === 'custom') {
            visitWith({ preset: 'custom', start_date: startDate, end_date: endDate, page: 1 })
        } else {
            visitWith({ preset, start_date: undefined, end_date: undefined, page: 1 })
        }
    }

    const handleReset = () => {
        setSearch('')
        router.visit(reports.stockValuation.url(), { preserveScroll: true, replace: true })
    }

    const categoryDefaultOptions = useMemo<CategoryOption[]>(
        () => categories.map((c) => ({ value: c.id, label: c.name })),
        [categories]
    )

    const selectedCategoryId = filters.category_id ? Number(filters.category_id) : null
    const selectedCategoryOption = useMemo<CategoryOption | null>(
        () =>
            selectedCategoryId
                ? (categoryDefaultOptions.find((o) => o.value === selectedCategoryId) ?? null)
                : null,
        [selectedCategoryId, categoryDefaultOptions]
    )

    const activeFilterCount = [
        filters.category_id,
        filters.movement_class && filters.movement_class !== 'all' ? filters.movement_class : undefined,
        filters.search,
        filters.table_sort,
    ].filter(Boolean).length

    return (
        <ReportFilterBar
            filters={filters}
            csvExportUrl={reports.stockValuation.export.csv.url()}
            pdfExportUrl={reports.stockValuation.export.pdf.url()}
            isLoading={isLoading}
            activeFilterCount={activeFilterCount}
            sortLabelMap={SORT_LABELS}
            onApplyPeriod={handleApplyPeriod}
            onClearTableSort={() => visitWith({ table_sort: undefined, table_direction: undefined })}
            onReset={handleReset}
        >
            <div className="relative w-full sm:w-64">
                <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Cari nama atau barcode…"
                    className="h-9 pl-9 pr-8 text-sm"
                />
                {isLoading ? (
                    <Loader2 className="absolute right-2.5 top-2.5 h-4 w-4 animate-spin text-muted-foreground" />
                ) : (
                    search && (
                        <button
                            type="button"
                            onClick={() => setSearch('')}
                            className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground"
                        >
                            <X className="h-4 w-4" />
                        </button>
                    )
                )}
            </div>

            <div className="w-full sm:w-52">
                <SelectKategoriProduct
                    value={selectedCategoryId}
                    initialOption={selectedCategoryOption}
                    defaultOptions={categoryDefaultOptions}
                    placeholder="Semua Kategori"
                    disabled={isLoading}
                    onChange={(val) => visitWith({ category_id: val ?? undefined, page: 1 })}
                />
            </div>

            <Select
                items={MOVEMENT_ITEMS}
                value={filters.movement_class ?? 'all'}
                disabled={isLoading}
                onValueChange={(val) =>
                    visitWith({ movement_class: val === 'all' ? undefined : val ?? undefined, page: 1 })
                }
            >
                <SelectTrigger className="h-9 w-full sm:w-auto sm:min-w-[165px]">
                    <SelectValue>
                        {(val) => MOVEMENT_ITEMS.find((i) => i.value === val)?.label ?? 'Semua Klasifikasi'}
                    </SelectValue>
                </SelectTrigger>
                <SelectContent>
                    {MOVEMENT_ITEMS.map((item) => (
                        <SelectItem key={item.value} value={item.value}>
                            {item.label}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </ReportFilterBar>
    )
}

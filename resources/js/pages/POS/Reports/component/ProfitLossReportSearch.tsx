import React, { useEffect, useMemo, useRef, useState } from 'react'
import { router } from '@inertiajs/react'
import { Loader2, Search, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import SelectKategoriProduct, {
    type CategoryOption,
} from '@/pages/POS/Product/component/SelectKategoriProduct'
import reports from '@/routes/pos/reports'
import { ReportFilterBar } from './ReportFilterBar'
import type { ReportFilters, ReportPreset } from './reportUtils'

const SORT_LABELS: Record<string, string> = {
    product_name: 'Produk',
    category_name: 'Kategori',
    qty_sold: 'Qty Terjual',
    net_revenue: 'Omzet Bersih',
    net_cogs: 'HPP Bersih',
    gross_profit: 'Laba Kotor',
    margin_pct: 'Margin %',
}

interface ProfitLossReportSearchProps {
    filters: ReportFilters
    categories: { id: number; name: string }[]
    isLoading?: boolean
}

export default function ProfitLossReportSearch({
    filters,
    categories,
    isLoading = false,
}: ProfitLossReportSearchProps) {
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
        router.visit(reports.profitLoss.url({ mergeQuery }), {
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
        router.visit(reports.profitLoss.url(), { preserveScroll: true, replace: true })
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
        filters.product_id,
        filters.search,
        filters.table_sort,
    ].filter(Boolean).length

    return (
        <ReportFilterBar
            filters={filters}
            csvExportUrl={reports.profitLoss.export.csv.url()}
            pdfExportUrl={reports.profitLoss.export.pdf.url()}
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
                    placeholder="Cari produk atau kategori…"
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

            <div className="w-full sm:w-56">
                <SelectKategoriProduct
                    value={selectedCategoryId}
                    initialOption={selectedCategoryOption}
                    defaultOptions={categoryDefaultOptions}
                    placeholder="Semua Kategori"
                    disabled={isLoading}
                    onChange={(val) => visitWith({ category_id: val ?? undefined, page: 1 })}
                />
            </div>
        </ReportFilterBar>
    )
}

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
import SelectCashierAsync, { type CashierOption } from './SelectCashierAsync'
import reports from '@/routes/pos/reports'
import { ReportFilterBar } from './ReportFilterBar'
import type { ReportFilters, ReportPreset } from './reportUtils'

const SORT_LABELS: Record<string, string> = {
    product_name: 'Nama Produk',
    category_name: 'Kategori',
    transactions_count: 'Transaksi',
    qty_sold: 'Qty Terjual',
    total_discount: 'Diskon',
    total_revenue: 'Omzet',
}

interface SalesReportSearchProps {
    filters: ReportFilters
    cashiers: { id: number; name: string }[]
    categories: { id: number; name: string }[]
    paymentMethods: { value: string; label: string }[]
    isLoading?: boolean
}

export default function SalesReportSearch({
    filters,
    cashiers,
    categories,
    paymentMethods,
    isLoading = false,
}: SalesReportSearchProps) {
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
        router.visit(reports.sales.url({ mergeQuery }), {
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
        router.visit(reports.sales.url(), { preserveScroll: true, replace: true })
    }

    const cashierDefaultOptions = useMemo<CashierOption[]>(
        () => cashiers.map((c) => ({ value: c.id, label: c.name })),
        [cashiers]
    )

    const selectedCashierId = filters.cashier_id ? Number(filters.cashier_id) : null
    const selectedCashierOption = useMemo<CashierOption | null>(
        () =>
            selectedCashierId
                ? (cashierDefaultOptions.find((o) => o.value === selectedCashierId) ?? null)
                : null,
        [selectedCashierId, cashierDefaultOptions]
    )

    const paymentItems = useMemo(
        () => [{ value: 'all', label: 'Semua Pembayaran' }, ...paymentMethods],
        [paymentMethods]
    )

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
        filters.cashier_id,
        filters.category_id,
        filters.product_id,
        filters.payment_method && filters.payment_method !== 'all' ? filters.payment_method : undefined,
        filters.search,
        filters.table_sort,
    ].filter(Boolean).length

    return (
        <ReportFilterBar
            filters={filters}
            csvExportUrl={reports.sales.export.csv.url()}
            pdfExportUrl={reports.sales.export.pdf.url()}
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
                    placeholder="Cari produk atau barcode…"
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
                <SelectCashierAsync
                    value={selectedCashierId}
                    initialOption={selectedCashierOption}
                    defaultOptions={cashierDefaultOptions}
                    placeholder="Semua Kasir"
                    disabled={isLoading}
                    onChange={(val) => visitWith({ cashier_id: val ?? undefined, page: 1 })}
                />
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
                items={paymentItems}
                value={filters.payment_method ?? 'all'}
                disabled={isLoading}
                onValueChange={(val) =>
                    visitWith({ payment_method: val === 'all' ? undefined : val ?? undefined, page: 1 })
                }
            >
                <SelectTrigger className="h-9 w-full sm:w-auto sm:min-w-[165px]">
                    <SelectValue>
                        {(val) => paymentItems.find((i) => i.value === val)?.label ?? 'Semua Pembayaran'}
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
        </ReportFilterBar>
    )
}

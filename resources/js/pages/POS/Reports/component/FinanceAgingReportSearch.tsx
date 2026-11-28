import React, { useMemo } from 'react'
import { router } from '@inertiajs/react'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import SelectSupplierAsync, {
    type SupplierOption,
} from '@/pages/POS/PurchaseOrders/component/SelectSupplierAsync'
import reports from '@/routes/pos/reports'
import { ReportFilterBar } from './ReportFilterBar'
import type { ReportFilters, ReportPreset } from './reportUtils'

const SORT_LABELS: Record<string, string> = {
    payable_number: 'No. Hutang',
    supplier_name: 'Supplier',
    due_date_raw: 'Jatuh Tempo',
    days_overdue: 'Terlambat',
    remaining_amount: 'Sisa Hutang',
}

interface FinanceAgingReportSearchProps {
    filters: ReportFilters
    accounts: { id: number; code: string; name: string }[]
    suppliers: { id: number; name: string }[]
    isLoading?: boolean
}

export default function FinanceAgingReportSearch({
    filters,
    accounts,
    suppliers,
    isLoading = false,
}: FinanceAgingReportSearchProps) {
    const visitWith = (mergeQuery: Record<string, string | number | undefined>) => {
        router.visit(reports.financeAging.url({ mergeQuery }), {
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
        router.visit(reports.financeAging.url(), { preserveScroll: true, replace: true })
    }

    const accountItems = useMemo(
        () => [
            { value: 'all', label: 'Semua Akun Kas/Bank' },
            ...accounts.map((a) => ({ value: String(a.id), label: `${a.code} — ${a.name}` })),
        ],
        [accounts]
    )

    const supplierDefaultOptions = useMemo<SupplierOption[]>(
        () => suppliers.map((s) => ({ value: s.id, label: s.name })),
        [suppliers]
    )

    const selectedSupplierId = filters.supplier_id ? Number(filters.supplier_id) : null
    const selectedSupplierOption = useMemo<SupplierOption | null>(
        () =>
            selectedSupplierId
                ? (supplierDefaultOptions.find((o) => o.value === selectedSupplierId) ?? null)
                : null,
        [selectedSupplierId, supplierDefaultOptions]
    )

    const activeFilterCount = [
        filters.financial_account_id,
        filters.supplier_id,
        filters.table_sort,
    ].filter(Boolean).length

    return (
        <ReportFilterBar
            filters={filters}
            csvExportUrl={reports.financeAging.export.csv.url()}
            pdfExportUrl={reports.financeAging.export.pdf.url()}
            isLoading={isLoading}
            activeFilterCount={activeFilterCount}
            sortLabelMap={SORT_LABELS}
            onApplyPeriod={handleApplyPeriod}
            onClearTableSort={() => visitWith({ table_sort: undefined, table_direction: undefined })}
            onReset={handleReset}
        >
            <Select
                items={accountItems}
                value={filters.financial_account_id ? String(filters.financial_account_id) : 'all'}
                disabled={isLoading}
                onValueChange={(val) =>
                    visitWith({
                        financial_account_id: val === 'all' ? undefined : val ?? undefined,
                        page: 1,
                    })
                }
            >
                <SelectTrigger className="h-9 w-full sm:w-auto sm:min-w-[190px]">
                    <SelectValue>
                        {(val) =>
                            accountItems.find((i) => i.value === val)?.label ?? 'Semua Akun Kas/Bank'
                        }
                    </SelectValue>
                </SelectTrigger>
                <SelectContent>
                    {accountItems.map((item) => (
                        <SelectItem key={item.value} value={item.value}>
                            {item.label}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>

            <div className="w-full sm:w-56">
                <SelectSupplierAsync
                    value={selectedSupplierId}
                    initialOption={selectedSupplierOption}
                    defaultOptions={supplierDefaultOptions}
                    onlyActive={false}
                    placeholder="Semua Supplier"
                    disabled={isLoading}
                    onChange={(val) => visitWith({ supplier_id: val ?? undefined, page: 1 })}
                />
            </div>
        </ReportFilterBar>
    )
}

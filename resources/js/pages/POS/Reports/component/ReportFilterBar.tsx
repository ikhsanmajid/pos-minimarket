import React, { useState } from 'react'
import { Download, FileSpreadsheet, FileText, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import {
    REPORT_PRESETS,
    buildExportUrl,
    type ReportFilters,
    type ReportPreset,
} from './reportUtils'

interface ReportFilterBarProps {
    filters: ReportFilters
    csvExportUrl: string
    pdfExportUrl: string
    isLoading?: boolean
    activeFilterCount?: number
    sortLabelMap?: Record<string, string>
    onApplyPeriod: (preset: ReportPreset, startDate?: string, endDate?: string) => void
    onClearTableSort?: () => void
    onReset: () => void
    children?: React.ReactNode
}

export function ReportFilterBar({
    filters,
    csvExportUrl,
    pdfExportUrl,
    isLoading = false,
    activeFilterCount = 0,
    sortLabelMap = {},
    onApplyPeriod,
    onClearTableSort,
    onReset,
    children,
}: ReportFilterBarProps) {
    const [startDate, setStartDate] = useState(filters.start_date ?? '')
    const [endDate, setEndDate] = useState(filters.end_date ?? '')

    const currentPreset = (filters.preset as ReportPreset) || 'this_month'
    const fullCsvUrl = buildExportUrl(csvExportUrl, filters)
    const fullPdfUrl = buildExportUrl(pdfExportUrl, filters)

    const handlePresetClick = (preset: ReportPreset) => {
        if (preset === 'custom') {
            onApplyPeriod('custom', startDate || filters.start_date, endDate || filters.end_date)
            return
        }
        onApplyPeriod(preset)
    }

    const handleDateChange = (nextStart: string, nextEnd: string) => {
        setStartDate(nextStart)
        setEndDate(nextEnd)
        if (nextStart && nextEnd && nextEnd >= nextStart) {
            onApplyPeriod('custom', nextStart, nextEnd)
        }
    }

    return (
        <div className="mb-4 space-y-3 rounded-lg border bg-card p-3.5 shadow-xs sm:p-4">
            {/* Baris 1: Preset Cepat + Tanggal Kustom + Tombol Export */}
            <div className="flex flex-wrap items-center justify-between gap-2.5">
                <div className="flex flex-wrap items-center gap-1.5">
                    {REPORT_PRESETS.map((preset) => {
                        const isActive = currentPreset === preset.value
                        return (
                            <Button
                                key={preset.value}
                                type="button"
                                size="sm"
                                variant={isActive ? 'default' : 'outline'}
                                disabled={isLoading}
                                onClick={() => handlePresetClick(preset.value)}
                                className={cn('h-9 px-3 text-xs')}
                            >
                                {preset.label}
                            </Button>
                        )
                    })}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    <a
                        href={fullCsvUrl}
                        className="inline-flex h-9 items-center gap-1.5 rounded-md border border-input bg-background px-3 text-xs font-medium text-foreground shadow-xs transition-colors hover:bg-accent hover:text-accent-foreground"
                    >
                        <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                        <span>Export CSV</span>
                    </a>
                    <a
                        href={fullPdfUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex h-9 items-center gap-1.5 rounded-md border border-input bg-background px-3 text-xs font-medium text-foreground shadow-xs transition-colors hover:bg-accent hover:text-accent-foreground"
                    >
                        <FileText className="h-3.5 w-3.5 text-rose-600 dark:text-rose-400" />
                        <span>Export PDF</span>
                        <Download className="h-3 w-3 opacity-60" />
                    </a>
                </div>
            </div>

            {/* Baris 2: Rentang Tanggal + Filter Spesifik Laporan + Chip Sortir + Reset */}
            <div className="flex flex-wrap items-center gap-2.5 border-t pt-3">
                <div className="flex items-center gap-1.5">
                    <Label
                        htmlFor="report-date-from"
                        className="text-xs text-muted-foreground whitespace-nowrap"
                    >
                        Dari:
                    </Label>
                    <Input
                        id="report-date-from"
                        type="date"
                        value={startDate}
                        disabled={isLoading}
                        onChange={(e) => handleDateChange(e.target.value, endDate)}
                        className="h-9 w-[138px] text-xs"
                    />
                </div>
                <div className="flex items-center gap-1.5">
                    <Label
                        htmlFor="report-date-to"
                        className="text-xs text-muted-foreground whitespace-nowrap"
                    >
                        Sampai:
                    </Label>
                    <Input
                        id="report-date-to"
                        type="date"
                        value={endDate}
                        min={startDate || undefined}
                        disabled={isLoading}
                        onChange={(e) => handleDateChange(startDate, e.target.value)}
                        className="h-9 w-[138px] text-xs"
                    />
                </div>

                {children}

                {filters.table_sort && onClearTableSort && (
                    <div className="flex h-9 items-center gap-1.5 rounded-md border border-primary/20 bg-primary/5 px-2.5 text-xs text-primary">
                        <span>
                            Tabel: {sortLabelMap[filters.table_sort] ?? filters.table_sort}{' '}
                            {filters.table_direction === 'desc' ? '↓' : '↑'}
                        </span>
                        <button
                            type="button"
                            onClick={onClearTableSort}
                            aria-label="Hapus urutan tabel"
                            className="rounded-sm hover:bg-primary/15 p-0.5"
                        >
                            <X className="h-3 w-3" />
                        </button>
                    </div>
                )}

                {activeFilterCount > 0 && (
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={isLoading}
                        onClick={onReset}
                        className="h-9 gap-1.5 border-dashed px-3 text-xs text-muted-foreground hover:text-foreground"
                    >
                        <X className="h-3.5 w-3.5" />
                        <span>Reset Filter</span>
                        <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
                            {activeFilterCount}
                        </span>
                    </Button>
                )}
            </div>
        </div>
    )
}

import * as React from 'react'
import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface DataTableSortHeaderProps {
    label: string
    field: string
    tableSort?: string
    tableDirection?: string
    toolbarSort?: string
    toolbarDirection?: string
    onSort: (field: string) => void
    className?: string
}

export function DataTableSortHeader({
    label,
    field,
    tableSort,
    tableDirection,
    toolbarSort,
    toolbarDirection,
    onSort,
    className,
}: DataTableSortHeaderProps) {
    const isPrimary = tableSort === field
    const isToolbarSorted = toolbarSort === field
    const hasBoth = Boolean(tableSort && toolbarSort && tableSort !== toolbarSort)

    let tooltip = `Urutkan ${label} (A-Z / Terendah)`
    if (isToolbarSorted) {
        tooltip = `Kolom ${label} sedang diurutkan via toolbar (${toolbarDirection === 'asc' ? 'A-Z / Terendah' : 'Z-A / Tertinggi'}). Tidak dapat diurutkan di header tabel.`
    } else if (isPrimary) {
        if (tableDirection === 'asc') {
            tooltip = `Urutkan ${label} (Z-A / Tertinggi)`
        } else if (tableDirection === 'desc') {
            tooltip = `Batal urutkan (Default / Unsorted)`
        }
    }

    if (isToolbarSorted) {
        return (
            <div
                title={tooltip}
                className={cn(
                    'flex items-center gap-1.5 font-medium text-muted-foreground/80 cursor-not-allowed select-none',
                    className
                )}
            >
                <span>{label}</span>
                <div className="flex items-center gap-1">
                    {toolbarDirection === 'asc' ? (
                        <ArrowUp className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    ) : (
                        <ArrowDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    )}
                    <span
                        className="flex h-3.5 items-center justify-center rounded bg-muted px-1 text-[9px] font-medium text-muted-foreground leading-none"
                        title="Diurutkan via Toolbar (Nonaktif di Header)"
                    >
                        Toolbar
                    </span>
                </div>
            </div>
        )
    }

    return (
        <button
            type="button"
            onClick={() => onSort(field)}
            title={tooltip}
            className={cn(
                'flex items-center gap-1.5 font-medium hover:text-foreground text-left cursor-pointer select-none group',
                className
            )}
        >
            <span>{label}</span>
            {isPrimary ? (
                <div className="flex items-center gap-1">
                    {tableDirection === 'asc' ? (
                        <ArrowUp className="h-3.5 w-3.5 text-primary shrink-0" />
                    ) : (
                        <ArrowDown className="h-3.5 w-3.5 text-primary shrink-0" />
                    )}
                    {hasBoth && (
                        <span
                            className="flex h-3.5 min-w-3.5 px-0.5 items-center justify-center rounded bg-primary/10 text-[9px] font-bold text-primary leading-none"
                            title="Urutan Utama (Ke-1)"
                        >
                            1
                        </span>
                    )}
                </div>
            ) : (
                <ArrowUpDown className="h-3.5 w-3.5 opacity-30 group-hover:opacity-100 transition-opacity shrink-0" />
            )}
        </button>
    )
}

export default DataTableSortHeader

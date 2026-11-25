import React, { useEffect, useState, useMemo } from 'react'
import { router, usePage } from '@inertiajs/react'
import AuthenticatedLayout from '@/layouts/AuthenticatedLayout'
import { DataTable, type DataTableColumn } from '@/components/dataTable'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Eye } from 'lucide-react'
import DataTablePagination, { type PaginationMeta } from '@/components/dataTablePagination'
import type { PageProps } from '@/types'
import { roleBadgeClass } from '../Users/Users'
import { index } from '@/actions/App/Http/Controllers/ActivityLogController'
import ActivityLogSearch, {
    type ActivityFilters,
    type LogNameOption,
    type SubjectTypeOption,
} from './component/ActivityLogSearch'
import ActivityLogDetailDialog from './component/ActivityLogDetailDialog'
import { DataTableSortHeader } from '@/components/dataTableSortHeader'

export type ActivityRow = {
    id: number
    log_name: string
    log_name_label?: string
    description: string
    event: string | null
    subject_type: string | null
    subject_type_full: string | null
    subject_id: number | null
    causer_name: string
    causer_role: string | null
    properties: Record<string, any> | null
    attribute_changes?: {
        old?: Record<string, any>
        attributes?: Record<string, any>
        [key: string]: any
    } | null
    category_map?: Record<string | number, string> | null
    created_at: string
    created_at_human: string
}

interface PaginatedActivities extends PaginationMeta {
    data: ActivityRow[]
}

type ActivityLogPageProps = PageProps<{
    activities: PaginatedActivities
    filters: ActivityFilters
    logNames: LogNameOption[]
    subjectTypes: SubjectTypeOption[]
    categoryMap?: Record<string | number, string>
}>

export const eventBadgeClass: Record<string, string> = {
    created: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300',
    updated: 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300',
    deleted: 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300',
    auth: 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300',
}

// ---------------------------------------------------------------------------
// Columns
// ---------------------------------------------------------------------------

interface GetColumnsOptions {
    from: number | null
    filters: ActivityFilters
    onSort: (field: string) => void
    onSelect: (activity: ActivityRow) => void
}

const getColumns = ({
    from,
    filters,
    onSort,
    onSelect,
}: GetColumnsOptions): DataTableColumn<ActivityRow>[] => [
    {
        id: 'no',
        header: 'No',
        cell: (info) => (from ?? 1) + info.row.index,
        size: 55,
    },
    {
        accessorKey: 'created_at',
        header: () => (
            <DataTableSortHeader
                label="Waktu"
                field="created_at"
                tableSort={filters.table_sort}
                tableDirection={filters.table_direction}
                toolbarSort={filters.sort}
                toolbarDirection={filters.direction}
                onSort={onSort}
            />
        ),
        cell: (info) => {
            const row = info.row.original
            return (
                <div className="flex flex-col py-0.5">
                    <span className="font-mono text-xs font-medium text-foreground">{row.created_at}</span>
                    <span className="text-[11px] text-muted-foreground">{row.created_at_human}</span>
                </div>
            )
        },
        size: 170,
    },
    {
        accessorKey: 'causer_name',
        header: 'Pengguna',
        cell: (info) => {
            const row = info.row.original
            return (
                <div className="flex flex-col py-0.5 min-w-0">
                    <span className="font-medium text-foreground text-sm truncate">{row.causer_name}</span>
                    {row.causer_role && (
                        <span className="text-xs text-muted-foreground truncate">{row.causer_role}</span>
                    )}
                </div>
            )
        },
        size: 165,
    },
    {
        accessorKey: 'subject_type',
        header: 'Modul / Objek',
        cell: (info) => {
            const row = info.row.original
            if (!row.subject_type) {
                return (
                    <Badge variant="outline" className="text-xs">
                        {row.log_name_label ?? row.log_name}
                    </Badge>
                )
            }
            return (
                <div className="flex items-center gap-1.5 min-w-0">
                    <Badge variant="outline" className="text-xs font-semibold shrink-0">
                        {row.subject_type}
                    </Badge>
                    {row.subject_id && (
                        <span className="text-xs text-muted-foreground font-mono truncate">#{row.subject_id}</span>
                    )}
                </div>
            )
        },
        size: 170,
    },
    {
        accessorKey: 'description',
        header: () => (
            <DataTableSortHeader
                label="Aktivitas"
                field="description"
                tableSort={filters.table_sort}
                tableDirection={filters.table_direction}
                toolbarSort={filters.sort}
                toolbarDirection={filters.direction}
                onSort={onSort}
            />
        ),
        cell: (info) => {
            const row = info.row.original
            const eventCls = row.event ? eventBadgeClass[row.event] ?? '' : ''
            return (
                <div className="flex items-center gap-2 py-0.5 min-w-0">
                    {row.event && (
                        <Badge className={`text-[10px] uppercase font-bold px-1.5 py-0 shrink-0 ${eventCls}`}>
                            {row.event}
                        </Badge>
                    )}
                    <span className="text-sm font-medium text-foreground whitespace-normal line-clamp-2">
                        {row.description}
                    </span>
                </div>
            )
        },
        size: 430,
    },
    {
        id: 'actions',
        header: () => <span className="text-right block w-full pr-2">Aksi</span>,
        cell: (info) => {
            const row = info.row.original
            return (
                <div className="flex justify-end pr-2">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onSelect(row)}
                        className="h-8 gap-1.5 text-xs text-muted-foreground hover:text-foreground"
                    >
                        <Eye className="h-3.5 w-3.5" />
                        Detail
                    </Button>
                </div>
            )
        },
        size: 90,
    },
]

// ---------------------------------------------------------------------------
// Page Component
// ---------------------------------------------------------------------------

export default function ActivityLog() {
    const { activities, filters, logNames, subjectTypes, categoryMap } = usePage<ActivityLogPageProps>().props
    const [isLoading, setIsLoading] = useState(false)
    const [selectedActivity, setSelectedActivity] = useState<ActivityRow | null>(null)

    useEffect(() => {
        const removeStart = router.on('start', () => setIsLoading(true))
        const removeFinish = router.on('finish', () => setIsLoading(false))
        return () => {
            removeStart()
            removeFinish()
        }
    }, [])

    const handleSort = (field: string) => {
        if (filters.sort === field) {
            return
        }

        const isCurrent = filters.table_sort === field
        let nextSort: string | undefined = field
        let nextDirection: 'asc' | 'desc' | undefined = 'asc'

        if (isCurrent) {
            if (filters.table_direction === 'asc') {
                nextDirection = 'desc'
            } else if (filters.table_direction === 'desc') {
                nextSort = undefined
                nextDirection = undefined
            }
        }

        router.visit(
            index({
                mergeQuery: {
                    table_sort: nextSort,
                    table_direction: nextDirection,
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

    const columns = useMemo(
        () =>
            getColumns({
                from: activities.from,
                filters,
                onSort: handleSort,
                onSelect: (act) => setSelectedActivity(act),
            }),
        [
            activities.from,
            filters.table_sort,
            filters.table_direction,
            filters.sort,
            filters.direction,
        ]
    )

    return (
        <div className="w-full min-w-0 space-y-6">
            <div>
                <h1 className="text-2xl font-bold tracking-tight">Log Aktivitas</h1>
                <p className="text-sm text-muted-foreground">
                    Audit trail dan rekaman aktivitas perubahan data di sistem POS.
                </p>
            </div>

            {/* Filter Toolbar */}
            <ActivityLogSearch
                filters={filters}
                logNames={logNames}
                subjectTypes={subjectTypes}
                routeUrl={index}
                isLoading={isLoading}
            />

            {/* DataTable */}
            <DataTable
                columns={columns}
                data={activities.data}
                tableKey="activity-logs-table"
                emptyMessage="Tidak ada catatan log aktivitas ditemukan."
                isLoading={isLoading}
            />

            {/* Pagination */}
            <DataTablePagination
                meta={activities}
                routeUrl={index}
                isLoading={isLoading}
            />

            {/* Detail Dialog */}
            <ActivityLogDetailDialog
                activity={selectedActivity}
                categoryMap={categoryMap}
                open={!!selectedActivity}
                onOpenChange={(open) => !open && setSelectedActivity(null)}
            />
        </div>
    )
}

ActivityLog.layout = (page: React.ReactNode) => (
    <AuthenticatedLayout>{page}</AuthenticatedLayout>
)

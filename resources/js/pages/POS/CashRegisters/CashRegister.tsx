import React, { useEffect, useMemo, useState } from 'react'
import { router, usePage } from '@inertiajs/react'
import AuthenticatedLayout from '@/layouts/AuthenticatedLayout'
import { DataTable, type DataTableColumn } from '@/components/dataTable'
import DataTablePagination, { type PaginationMeta } from '@/components/dataTablePagination'
import { DataTableSortHeader } from '@/components/dataTableSortHeader'
import { Badge } from '@/components/ui/badge'
import { SummaryStatCard, SummaryStatGrid } from '@/components/SummaryStatCard'
import { formatNumber, formatPercent } from '@/lib/utils'
import { CheckCircle2, Monitor, MonitorPlay, PauseCircle } from 'lucide-react'
import { toast } from 'react-toastify'
import type { PageProps } from '@/types'
import { useAuth } from '@/hooks/use-auth'
import CashRegisterController from '@/actions/App/Http/Controllers/CashRegisterController'
import { CashRegisterSearch, type CashRegisterFilters } from './component/CashRegisterSearch'
import { DialogAddCashRegister } from './component/DialogAddCashRegister'
import { CashRegisterActionsCell } from './component/CashRegisterActionsCell'

export interface CashRegisterRow {
    id: number
    code: string
    name: string
    location: string | null
    description: string | null
    is_active: boolean
    shifts_count: number
    is_in_use: boolean
    active_shift: {
        id: number
        shift_number: string
        cashier_name: string
        opened_at: string
    } | null
    created_at?: string
}

interface PaginatedCashRegisters extends PaginationMeta {
    data: CashRegisterRow[]
}

type CashRegisterPageProps = PageProps<{
    cashRegisters: PaginatedCashRegisters
    filters: CashRegisterFilters
    summary: {
        total_registers: number
        active_registers: number
        inactive_registers: number
        in_use_registers: number
        available_registers: number
    }
    permissions: {
        can_create: boolean
        can_edit: boolean
        can_delete: boolean
    }
}>

interface GetColumnsOptions {
    from: number | null
    canEdit: boolean
    canDelete: boolean
    filters: CashRegisterFilters
    onSort: (field: string) => void
}

const getColumns = ({
    from,
    canEdit,
    canDelete,
    filters,
    onSort,
}: GetColumnsOptions): DataTableColumn<CashRegisterRow>[] => [
    {
        id: 'no',
        header: 'No',
        cell: (info) => (from ?? 1) + info.row.index,
        size: 55,
    },
    {
        accessorKey: 'code',
        header: () => (
            <DataTableSortHeader
                label="Kode"
                field="code"
                tableSort={filters.table_sort}
                tableDirection={filters.table_direction}
                toolbarSort={filters.sort}
                toolbarDirection={filters.direction}
                onSort={onSort}
            />
        ),
        cell: (info) => (
            <span className="font-mono text-xs font-semibold uppercase text-foreground">
                {info.getValue<string>()}
            </span>
        ),
        size: 120,
    },
    {
        accessorKey: 'name',
        header: () => (
            <DataTableSortHeader
                label="Nama Kasir & Keterangan"
                field="name"
                tableSort={filters.table_sort}
                tableDirection={filters.table_direction}
                toolbarSort={filters.sort}
                toolbarDirection={filters.direction}
                onSort={onSort}
            />
        ),
        cell: ({ row }) => (
            <div className="flex flex-col py-0.5 min-w-0">
                <span className="font-medium text-foreground truncate">{row.original.name}</span>
                {row.original.description && (
                    <span className="text-xs text-muted-foreground whitespace-normal line-clamp-1">
                        {row.original.description}
                    </span>
                )}
            </div>
        ),
        size: 260,
    },
    {
        accessorKey: 'location',
        header: () => (
            <DataTableSortHeader
                label="Lokasi"
                field="location"
                tableSort={filters.table_sort}
                tableDirection={filters.table_direction}
                toolbarSort={filters.sort}
                toolbarDirection={filters.direction}
                onSort={onSort}
            />
        ),
        cell: (info) => {
            const val = info.getValue<string | null>()
            return val ? (
                <span className="text-sm text-foreground truncate block">{val}</span>
            ) : (
                <span className="text-xs text-muted-foreground">-</span>
            )
        },
        size: 190,
    },
    {
        id: 'operational_status',
        header: 'Operasional',
        cell: ({ row }) => {
            const item = row.original
            if (item.is_in_use && item.active_shift) {
                return (
                    <div className="flex flex-col gap-0.5 min-w-0">
                        <Badge
                            variant="outline"
                            className="w-fit border-amber-400 bg-amber-50 text-amber-800 dark:border-amber-700 dark:bg-amber-950/50 dark:text-amber-200"
                        >
                            Sedang Dipakai
                        </Badge>
                        <span className="text-[11px] text-muted-foreground truncate">
                            {item.active_shift.cashier_name} • {item.active_shift.shift_number}
                        </span>
                    </div>
                )
            }

            if (!item.is_active) {
                return <span className="text-xs text-muted-foreground">Tidak beroperasi</span>
            }

            return (
                <Badge
                    variant="outline"
                    className="border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
                >
                    Tersedia
                </Badge>
            )
        },
        size: 205,
    },
    {
        accessorKey: 'shifts_count',
        header: () => (
            <DataTableSortHeader
                label="Total Shift"
                field="shifts_count"
                tableSort={filters.table_sort}
                tableDirection={filters.table_direction}
                toolbarSort={filters.sort}
                toolbarDirection={filters.direction}
                onSort={onSort}
            />
        ),
        cell: (info) => (
            <span className="font-mono text-xs text-muted-foreground">
                {formatNumber(info.getValue<number>())} shift
            </span>
        ),
        size: 125,
    },
    {
        accessorKey: 'is_active',
        header: () => (
            <DataTableSortHeader
                label="Status"
                field="is_active"
                tableSort={filters.table_sort}
                tableDirection={filters.table_direction}
                toolbarSort={filters.sort}
                toolbarDirection={filters.direction}
                onSort={onSort}
            />
        ),
        cell: (info) =>
            info.getValue<boolean>() ? (
                <Badge variant="success">Aktif</Badge>
            ) : (
                <Badge variant="secondary">Nonaktif</Badge>
            ),
        size: 110,
    },
    {
        id: 'actions',
        header: () => <span className="text-right block w-full pr-2">Aksi</span>,
        cell: ({ row }) => (
            <div className="flex justify-end pr-2">
                <CashRegisterActionsCell
                    cashRegister={row.original}
                    canEdit={canEdit}
                    canDelete={canDelete}
                />
            </div>
        ),
        size: 70,
    },
]

const CashRegister = () => {
    const { cashRegisters, filters, summary, permissions } =
        usePage<CashRegisterPageProps>().props
    const { flash } = useAuth()
    const [isLoading, setIsLoading] = useState(false)

    useEffect(() => {
        if (flash?.success) toast.success(flash.success)
        if (flash?.error) toast.error(flash.error)
    }, [flash?.success, flash?.error])

    useEffect(() => {
        const removeStart = router.on('start', () => setIsLoading(true))
        const removeFinish = router.on('finish', () => setIsLoading(false))

        return () => {
            removeStart()
            removeFinish()
        }
    }, [])

    const handleSort = (field: string) => {
        let nextSort: string | undefined = field
        let nextDirection: string | undefined = 'asc'

        if (filters.table_sort === field) {
            if (filters.table_direction === 'asc') {
                nextDirection = 'desc'
            } else {
                nextSort = undefined
                nextDirection = undefined
            }
        }

        router.visit(
            CashRegisterController.index({
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

    const handleFilterStatus = (status?: string) => {
        const nextStatus = status && filters.status === status ? undefined : status
        router.visit(
            CashRegisterController.index({
                mergeQuery: {
                    status: nextStatus,
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
                from: cashRegisters.from,
                canEdit: permissions.can_edit,
                canDelete: permissions.can_delete,
                filters,
                onSort: handleSort,
            }),
        [cashRegisters.from, permissions.can_edit, permissions.can_delete, filters]
    )

    return (
        <div className="w-full min-w-0 space-y-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-foreground">
                        Daftar Kasir Fisik
                    </h1>
                    <p className="text-sm text-muted-foreground">
                        Kelola meja / mesin kasir fisik yang tersedia untuk sesi shift dan terminal kasir POS.
                    </p>
                </div>

                {permissions.can_create && (
                    <DialogAddCashRegister storeUrl={CashRegisterController.store.url()} />
                )}
            </div>

            <SummaryStatGrid>
                <SummaryStatCard
                    title="Total Kasir Fisik"
                    value={formatNumber(summary.total_registers)}
                    icon={Monitor}
                    variant="blue"
                    subInfo={`${formatNumber(summary.available_registers)} tersedia untuk buka shift`}
                    periodLabel="Semua Data"
                    isActive={!filters.status || filters.status === 'all'}
                    onClick={() => handleFilterStatus(undefined)}
                />
                <SummaryStatCard
                    title="Kasir Aktif"
                    value={formatNumber(summary.active_registers)}
                    icon={CheckCircle2}
                    variant="emerald"
                    subInfo={`${formatPercent(summary.active_registers, summary.total_registers)} dari total kasir`}
                    periodLabel="Aktif"
                    isActive={filters.status === 'active'}
                    onClick={() => handleFilterStatus('active')}
                />
                <SummaryStatCard
                    title="Sedang Dipakai Shift"
                    value={formatNumber(summary.in_use_registers)}
                    icon={MonitorPlay}
                    variant="amber"
                    subInfo={`${formatNumber(summary.available_registers)} kasir aktif masih kosong`}
                    periodLabel="Berjalan"
                    isActive={filters.status === 'in_use'}
                    onClick={() => handleFilterStatus('in_use')}
                />
                <SummaryStatCard
                    title="Kasir Nonaktif"
                    value={formatNumber(summary.inactive_registers)}
                    icon={PauseCircle}
                    variant="rose"
                    subInfo={`${formatPercent(summary.inactive_registers, summary.total_registers)} tidak beroperasi`}
                    periodLabel="Nonaktif"
                    isActive={filters.status === 'inactive'}
                    onClick={() => handleFilterStatus('inactive')}
                />
            </SummaryStatGrid>

            <CashRegisterSearch
                filters={filters}
                routeUrl={CashRegisterController.index}
                isLoading={isLoading}
            />

            <DataTable
                tableKey="cash-registers-table"
                columns={columns}
                data={cashRegisters.data}
                isLoading={isLoading}
                emptyMessage="Belum ada data kasir fisik yang sesuai dengan filter."
            />

            <DataTablePagination
                meta={cashRegisters}
                routeUrl={CashRegisterController.index}
                isLoading={isLoading}
            />
        </div>
    )
}

CashRegister.layout = (page: React.ReactNode) => <AuthenticatedLayout>{page}</AuthenticatedLayout>

export default CashRegister

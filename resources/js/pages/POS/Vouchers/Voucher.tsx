import React, { useEffect, useMemo, useState } from 'react'
import { router, usePage } from '@inertiajs/react'
import AuthenticatedLayout from '@/layouts/AuthenticatedLayout'
import { DataTable } from '@/components/dataTable'
import DataTablePagination, { type PaginationMeta } from '@/components/dataTablePagination'
import { SummaryStatCard, SummaryStatGrid } from '@/components/SummaryStatCard'
import { Button } from '@/components/ui/button'
import { formatNumber } from '@/lib/utils'
import { useAuth } from '@/hooks/use-auth'
import { toast } from 'react-toastify'
import VoucherController from '@/actions/App/Http/Controllers/VoucherController'
import type { PageProps, VoucherRow } from '@/types'
import { CheckCircle2, Layers, Plus, TicketPercent, TrendingUp, XCircle } from 'lucide-react'
import { VoucherSearch, type VoucherFilters } from './component/VoucherSearch'
import { getVoucherColumns } from './component/voucherColumns'
import { VoucherFormDialog } from './component/VoucherFormDialog'
import { VoucherBulkDialog } from './component/VoucherBulkDialog'

interface PaginatedVouchers extends PaginationMeta {
    data: VoucherRow[]
}

type VoucherPageProps = PageProps<{
    vouchers: PaginatedVouchers
    filters: VoucherFilters
    summary: {
        total_vouchers: number
        active_vouchers: number
        total_redemptions: number
        expired_or_exhausted: number
    }
    typeOptions: Array<{ value: string; label: string }>
    statusOptions: Array<{ value: string; label: string }>
    fundingOptions: Array<{ value: string; label: string }>
    products: Array<{ id: number; name: string; barcode: string }>
    categories: Array<{ id: number; name: string }>
    suppliers?: Array<{ id: number; name: string }>
}>

export function Voucher() {
    const {
        vouchers,
        filters,
        summary,
        typeOptions,
        statusOptions,
        fundingOptions,
        products,
        categories,
        suppliers = [],
    } = usePage<VoucherPageProps>().props
    const { flash } = useAuth()

    const [isLoading, setIsLoading] = useState(false)
    const [dialogOpen, setDialogOpen] = useState(false)
    const [bulkDialogOpen, setBulkDialogOpen] = useState(false)
    const [editingVoucher, setEditingVoucher] = useState<VoucherRow | null>(null)

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

    const handleFilterStatus = (status?: string) => {
        const nextStatus = status && filters.status === status ? undefined : status
        router.visit(
            VoucherController.index({
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

    const handleSort = (field: string) => {
        if (filters.sort === field) return

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
            VoucherController.index({
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

    const handleEdit = (voucher: VoucherRow) => {
        setEditingVoucher(voucher)
        setDialogOpen(true)
    }

    const handleDelete = (voucher: VoucherRow) => {
        if (!window.confirm(`Hapus voucher "${voucher.code} - ${voucher.name}"?`)) return
        router.delete(VoucherController.destroy.url({ voucher: voucher.id }), {
            preserveScroll: true,
        })
    }

    const columns = useMemo(
        () =>
            getVoucherColumns({
                from: vouchers.from ?? 1,
                filters,
                onSort: handleSort,
                onEdit: handleEdit,
                onDelete: handleDelete,
            }),
        [
            vouchers.from,
            filters.table_sort,
            filters.table_direction,
            filters.sort,
            filters.direction,
        ]
    )

    return (
        <div className="w-full min-w-0 space-y-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Voucher &amp; Kode Promo</h1>
                    <p className="text-sm text-muted-foreground">
                        Kelola kode voucher tunggal maupun massal (PREFIX-XXXX-XXXX) dengan validasi kuota &amp; jadwal online.
                    </p>
                </div>
                <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => setBulkDialogOpen(true)}
                        className="gap-1.5 h-9 cursor-pointer"
                    >
                        <Layers className="h-4 w-4" />
                        Generate Massal
                    </Button>
                    <Button
                        type="button"
                        onClick={() => {
                            setEditingVoucher(null)
                            setDialogOpen(true)
                        }}
                        className="gap-1.5 h-9 cursor-pointer"
                    >
                        <Plus className="h-4 w-4" />
                        Tambah Voucher
                    </Button>
                </div>
            </div>

            <SummaryStatGrid>
                <SummaryStatCard
                    title="Total Voucher"
                    value={formatNumber(summary.total_vouchers)}
                    icon={TicketPercent}
                    variant="blue"
                    subInfo="Semua kode terdaftar"
                    periodLabel="Semua Data"
                    isActive={!filters.status || filters.status === 'all'}
                    onClick={() => handleFilterStatus(undefined)}
                />
                <SummaryStatCard
                    title="Sedang Aktif"
                    value={formatNumber(summary.active_vouchers)}
                    icon={CheckCircle2}
                    variant="emerald"
                    subInfo="Siap dipakai di kasir"
                    periodLabel="Aktif"
                    isActive={filters.status === 'active'}
                    onClick={() => handleFilterStatus('active')}
                />
                <SummaryStatCard
                    title="Total Redeem"
                    value={formatNumber(summary.total_redemptions)}
                    icon={TrendingUp}
                    variant="amber"
                    subInfo="Akumulasi pemakaian"
                    periodLabel="Terpakai"
                />
                <SummaryStatCard
                    title="Kedaluwarsa / Habis"
                    value={formatNumber(summary.expired_or_exhausted)}
                    icon={XCircle}
                    variant="rose"
                    subInfo="Melewati periode atau kuota"
                    periodLabel="Arsip"
                    isActive={filters.status === 'expired_or_exhausted'}
                    onClick={() => handleFilterStatus('expired_or_exhausted')}
                />
            </SummaryStatGrid>

            <VoucherSearch
                filters={filters}
                typeOptions={typeOptions}
                routeUrl={VoucherController.index}
                isLoading={isLoading}
            />

            <DataTable
                columns={columns}
                data={vouchers.data ?? []}
                tableKey="vouchers-table"
                emptyMessage="Belum ada data voucher ditemukan."
                isLoading={isLoading}
            />

            <DataTablePagination
                meta={vouchers}
                routeUrl={VoucherController.index}
                isLoading={isLoading}
            />

            <VoucherFormDialog
                open={dialogOpen}
                onOpenChange={setDialogOpen}
                voucher={editingVoucher}
                typeOptions={typeOptions}
                statusOptions={statusOptions}
                fundingOptions={fundingOptions}
                products={products}
                categories={categories}
                suppliers={suppliers}
            />

            <VoucherBulkDialog
                open={bulkDialogOpen}
                onOpenChange={setBulkDialogOpen}
                typeOptions={typeOptions}
                statusOptions={statusOptions}
                fundingOptions={fundingOptions}
            />
        </div>
    )
}

Voucher.layout = (page: React.ReactNode) => (
    <AuthenticatedLayout>{page}</AuthenticatedLayout>
)

export default Voucher

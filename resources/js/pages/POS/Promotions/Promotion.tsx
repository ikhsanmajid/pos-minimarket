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
import PromotionController from '@/actions/App/Http/Controllers/PromotionController'
import type { PageProps, PromotionRow } from '@/types'
import { CalendarClock, CheckCircle2, Plus, Tags, XCircle } from 'lucide-react'
import { PromotionSearch, type PromotionFilters } from './component/PromotionSearch'
import { getPromotionColumns } from './component/promotionColumns'
import { PromotionFormDialog } from './component/PromotionFormDialog'

interface PaginatedPromotions extends PaginationMeta {
    data: PromotionRow[]
}

type PromotionPageProps = PageProps<{
    promotions: PaginatedPromotions
    filters: PromotionFilters
    summary: {
        total_promotions: number
        active_promotions: number
        scheduled_promotions: number
        ended_or_inactive_promotions: number
    }
    typeOptions: Array<{ value: string; label: string }>
    scopeOptions: Array<{ value: string; label: string }>
    fundingOptions: Array<{ value: string; label: string }>
    paymentMethodOptions?: Array<{ value: string; label: string }>
    products: Array<{ id: number; name: string; barcode: string }>
    categories: Array<{ id: number; name: string }>
    suppliers?: Array<{ id: number; name: string }>
}>

export function Promotion() {
    const {
        promotions,
        filters,
        summary,
        typeOptions,
        scopeOptions,
        fundingOptions,
        paymentMethodOptions = [],
        products,
        categories,
        suppliers = [],
    } = usePage<PromotionPageProps>().props
    const { flash } = useAuth()

    const [isLoading, setIsLoading] = useState(false)
    const [dialogOpen, setDialogOpen] = useState(false)
    const [editingPromotion, setEditingPromotion] = useState<PromotionRow | null>(null)

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
            PromotionController.index({
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
            PromotionController.index({
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

    const handleEdit = (promo: PromotionRow) => {
        setEditingPromotion(promo)
        setDialogOpen(true)
    }

    const handleDelete = (promo: PromotionRow) => {
        if (!window.confirm(`Hapus promo "${promo.name}"?`)) return
        router.delete(PromotionController.destroy.url({ promotion: promo.id }), {
            preserveScroll: true,
        })
    }

    const columns = useMemo(
        () =>
            getPromotionColumns({
                from: promotions.from ?? 1,
                filters,
                onSort: handleSort,
                onEdit: handleEdit,
                onDelete: handleDelete,
            }),
        [
            promotions.from,
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
                    <h1 className="text-2xl font-bold tracking-tight">Promo &amp; Diskon</h1>
                    <p className="text-sm text-muted-foreground">
                        Kelola promo otomatis (persentase, potongan nominal, Beli X Gratis Y, Multibuy) untuk kasir POS.
                    </p>
                </div>
                <Button
                    type="button"
                    onClick={() => {
                        setEditingPromotion(null)
                        setDialogOpen(true)
                    }}
                    className="gap-1.5 h-9 cursor-pointer self-start sm:self-auto"
                >
                    <Plus className="h-4 w-4" />
                    Tambah Promo
                </Button>
            </div>

            <SummaryStatGrid>
                <SummaryStatCard
                    title="Total Promo"
                    value={formatNumber(summary.total_promotions)}
                    icon={Tags}
                    variant="blue"
                    subInfo="Semua program promo"
                    periodLabel="Semua Data"
                    isActive={!filters.status || filters.status === 'all'}
                    onClick={() => handleFilterStatus(undefined)}
                />
                <SummaryStatCard
                    title="Sedang Aktif"
                    value={formatNumber(summary.active_promotions)}
                    icon={CheckCircle2}
                    variant="emerald"
                    subInfo="Berlaku otomatis di kasir"
                    periodLabel="Aktif"
                    isActive={filters.status === 'active'}
                    onClick={() => handleFilterStatus('active')}
                />
                <SummaryStatCard
                    title="Terjadwal"
                    value={formatNumber(summary.scheduled_promotions)}
                    icon={CalendarClock}
                    variant="amber"
                    subInfo="Akan datang sesuai jadwal"
                    periodLabel="Mendatang"
                    isActive={filters.status === 'scheduled'}
                    onClick={() => handleFilterStatus('scheduled')}
                />
                <SummaryStatCard
                    title="Berakhir / Nonaktif"
                    value={formatNumber(summary.ended_or_inactive_promotions)}
                    icon={XCircle}
                    variant="rose"
                    subInfo="Sudah lewat atau dijeda"
                    periodLabel="Arsip"
                    isActive={filters.status === 'ended_or_inactive'}
                    onClick={() => handleFilterStatus('ended_or_inactive')}
                />
            </SummaryStatGrid>

            <PromotionSearch
                filters={filters}
                typeOptions={typeOptions}
                routeUrl={PromotionController.index}
                isLoading={isLoading}
            />

            <DataTable
                columns={columns}
                data={promotions.data ?? []}
                tableKey="promotions-table"
                emptyMessage="Belum ada data promo ditemukan."
                isLoading={isLoading}
            />

            <DataTablePagination
                meta={promotions}
                routeUrl={PromotionController.index}
                isLoading={isLoading}
            />

            <PromotionFormDialog
                open={dialogOpen}
                onOpenChange={setDialogOpen}
                promotion={editingPromotion}
                typeOptions={typeOptions}
                scopeOptions={scopeOptions}
                fundingOptions={fundingOptions}
                paymentMethodOptions={paymentMethodOptions}
                products={products}
                categories={categories}
                suppliers={suppliers}
            />
        </div>
    )
}

Promotion.layout = (page: React.ReactNode) => (
    <AuthenticatedLayout>{page}</AuthenticatedLayout>
)

export default Promotion

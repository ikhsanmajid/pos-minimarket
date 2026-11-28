import React, { useEffect, useMemo, useState } from 'react'
import { Head, router, usePage } from '@inertiajs/react'
import AuthenticatedLayout from '@/layouts/AuthenticatedLayout'
import { DataTable } from '@/components/dataTable'
import DataTablePagination, { type PaginationMeta } from '@/components/dataTablePagination'
import { SummaryStatCard, SummaryStatGrid } from '@/components/SummaryStatCard'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/hooks/use-auth'
import { toast } from 'react-toastify'
import SupplierPromoClaimController from '@/actions/App/Http/Controllers/SupplierPromoClaimController'
import type { PageProps } from '@/types'
import { CheckCircle2, ClipboardCheck, Clock, Send, Truck } from 'lucide-react'
import {
    formatIdrCurrency,
    getSupplierPromoClaimColumns,
    type SupplierPromoClaimFilters,
    type SupplierPromoClaimRow,
} from './component/supplierPromoClaimColumns'
import { SupplierPromoClaimSearch } from './component/SupplierPromoClaimSearch'
import {
    SupplierClaimSettleDialog,
    type ClaimAccountOption,
    type ClaimProductOption,
    type OpenPayableOption,
} from './component/SupplierClaimSettleDialog'

interface PaginatedClaims extends PaginationMeta {
    data: SupplierPromoClaimRow[]
}

type SupplierPromoClaimPageProps = PageProps<{
    claims: PaginatedClaims
    filters: SupplierPromoClaimFilters
    summary: {
        total_supplier_burden: number
        pending_amount: number
        pending_count: number
        claimed_amount: number
        claimed_count: number
        paid_amount: number
        paid_count: number
    }
    options: {
        suppliers: Array<{ id: number; name: string }>
        openPayables: OpenPayableOption[]
        products: ClaimProductOption[]
        financialAccounts: ClaimAccountOption[]
        incomeCategories: ClaimAccountOption[]
        settlementMethods: Array<{ value: string; label: string }>
    }
}>

export function SupplierPromoClaim() {
    const { claims, filters, summary, options } = usePage<SupplierPromoClaimPageProps>().props
    const { flash } = useAuth()

    const [isLoading, setIsLoading] = useState(false)
    const [selectedIds, setSelectedIds] = useState<number[]>([])
    const [settleDialogOpen, setSettleDialogOpen] = useState(false)
    const [dialogTargetRows, setDialogTargetRows] = useState<SupplierPromoClaimRow[]>([])

    useEffect(() => {
        if (flash?.success) toast.success(flash.success)
        if (flash?.error) toast.error(flash.error)
    }, [flash?.success, flash?.error])

    useEffect(() => {
        const offStart = router.on('start', () => setIsLoading(true))
        const offFinish = router.on('finish', () => setIsLoading(false))
        return () => {
            offStart()
            offFinish()
        }
    }, [])

    const unsettledRows = useMemo(
        () => claims.data.filter((r) => r.claim_status !== 'paid'),
        [claims.data]
    )

    const allUnsettledChecked =
        unsettledRows.length > 0 && unsettledRows.every((r) => selectedIds.includes(r.id))

    const toggleAll = () => {
        if (allUnsettledChecked) {
            setSelectedIds([])
        } else {
            setSelectedIds(unsettledRows.map((r) => r.id))
        }
    }

    const toggleRow = (id: number) => {
        setSelectedIds((prev) =>
            prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
        )
    }

    const handleFilterStatus = (status?: string) => {
        const nextStatus = status && filters.claim_status === status ? undefined : status
        router.visit(
            SupplierPromoClaimController.index({
                mergeQuery: { claim_status: nextStatus, page: 1 },
            }),
            { preserveState: true, preserveScroll: true, replace: true }
        )
    }

    const handleSort = (field: string) => {
        if (filters.sort === field) return
        const isCurrent = filters.table_sort === field
        let nextSort: string | undefined = field
        let nextDir: 'asc' | 'desc' | undefined = 'asc'

        if (isCurrent) {
            if (filters.table_direction === 'asc') {
                nextDir = 'desc'
            } else {
                nextSort = undefined
                nextDir = undefined
            }
        }

        router.visit(
            SupplierPromoClaimController.index({
                mergeQuery: {
                    table_sort: nextSort,
                    table_direction: nextDir,
                    page: 1,
                },
            }),
            { preserveState: true, preserveScroll: true, replace: true }
        )
    }

    const handleSettleSingle = (row: SupplierPromoClaimRow) => {
        setDialogTargetRows([row])
        setSettleDialogOpen(true)
    }

    const handleSettleBulk = () => {
        const rows = claims.data.filter(
            (r) => selectedIds.includes(r.id) && r.claim_status !== 'paid'
        )
        if (rows.length === 0) return
        setDialogTargetRows(rows)
        setSettleDialogOpen(true)
    }

    const columns = useMemo(
        () =>
            getSupplierPromoClaimColumns({
                from: claims.from ?? 1,
                filters,
                selectedIds,
                allUnsettledChecked,
                hasUnsettledRows: unsettledRows.length > 0,
                onToggleAll: toggleAll,
                onToggleRow: toggleRow,
                onSort: handleSort,
                onSettleRow: handleSettleSingle,
            }),
        [
            claims.from,
            filters.table_sort,
            filters.table_direction,
            filters.sort,
            filters.direction,
            selectedIds,
            allUnsettledChecked,
            unsettledRows.length,
        ]
    )

    return (
        <div className="w-full min-w-0 space-y-6">
            <Head title="Klaim Promo Supplier" />

            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Klaim Promo Supplier</h1>
                    <p className="text-sm text-muted-foreground">
                        Kelola penagihan dan penyelesaian promo yang ditanggung supplier atau patungan melalui Potong Tagihan (Credit Note), Ganti Barang (Free Goods), atau Transfer Reimburse.
                    </p>
                </div>

                {selectedIds.length > 0 && (
                    <Button
                        type="button"
                        onClick={handleSettleBulk}
                        className="h-9 gap-1.5 cursor-pointer self-start sm:self-auto"
                    >
                        <ClipboardCheck className="h-4 w-4" />
                        Selesaikan Terpilih ({selectedIds.length})
                    </Button>
                )}
            </div>

            <SummaryStatGrid>
                <SummaryStatCard
                    title="Total Porsi Supplier"
                    value={formatIdrCurrency(summary.total_supplier_burden)}
                    icon={Truck}
                    variant="blue"
                    subInfo="Semua promo supplier & patungan"
                    periodLabel="Semua Data"
                    isActive={!filters.claim_status || filters.claim_status === 'all'}
                    onClick={() => handleFilterStatus(undefined)}
                />
                <SummaryStatCard
                    title="Belum Diklaim"
                    value={formatIdrCurrency(summary.pending_amount)}
                    icon={Clock}
                    variant="amber"
                    subInfo={`${summary.pending_count} transaksi menunggu klaim`}
                    periodLabel="Pending"
                    isActive={filters.claim_status === 'pending'}
                    onClick={() => handleFilterStatus('pending')}
                />
                <SummaryStatCard
                    title="Sudah Diajukan"
                    value={formatIdrCurrency(summary.claimed_amount)}
                    icon={Send}
                    variant="blue"
                    subInfo={`${summary.claimed_count} transaksi menunggu realisasi`}
                    periodLabel="Diajukan"
                    isActive={filters.claim_status === 'claimed'}
                    onClick={() => handleFilterStatus('claimed')}
                />
                <SummaryStatCard
                    title="Lunas / Diselesaikan"
                    value={formatIdrCurrency(summary.paid_amount)}
                    icon={CheckCircle2}
                    variant="emerald"
                    subInfo={`${summary.paid_count} transaksi sudah ditukar`}
                    periodLabel="Selesai"
                    isActive={filters.claim_status === 'paid'}
                    onClick={() => handleFilterStatus('paid')}
                />
            </SummaryStatGrid>

            <SupplierPromoClaimSearch
                filters={filters}
                suppliers={options.suppliers}
                settlementMethods={options.settlementMethods}
                isLoading={isLoading}
            />

            <DataTable
                columns={columns}
                data={claims.data}
                tableKey="supplier-promo-claims-table"
                emptyMessage="Belum ada data klaim promo supplier."
                isLoading={isLoading}
            />

            <DataTablePagination
                meta={claims}
                routeUrl={SupplierPromoClaimController.index}
                isLoading={isLoading}
            />

            <SupplierClaimSettleDialog
                open={settleDialogOpen}
                onOpenChange={setSettleDialogOpen}
                targetRows={dialogTargetRows}
                openPayables={options.openPayables}
                products={options.products}
                financialAccounts={options.financialAccounts}
                incomeCategories={options.incomeCategories}
                onSuccess={() => setSelectedIds([])}
            />
        </div>
    )
}

SupplierPromoClaim.layout = (page: React.ReactNode) => (
    <AuthenticatedLayout>{page}</AuthenticatedLayout>
)

export default SupplierPromoClaim

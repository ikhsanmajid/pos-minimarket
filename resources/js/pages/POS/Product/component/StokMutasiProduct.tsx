import React from 'react'
import { router } from '@inertiajs/react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { ArrowLeftRight, PackageSearch, RefreshCw, ChevronLeft, ChevronRight } from 'lucide-react'
import ProductController from '@/actions/App/Http/Controllers/ProductController'
import type { DetailProductData } from '../DetailProduct'

export interface StockMovementRow {
    id: number
    type: string
    type_label: string
    stock_before: number
    qty_change: number
    stock_after: number
    unit_cost: number
    notes: string | null
    creator_name: string
    created_at: string | null
}

export interface PaginatedStockMovements {
    data: StockMovementRow[]
    current_page: number
    last_page: number
    per_page: number
    total: number
    from: number | null
    to: number | null
}

interface StokMutasiProductProps {
    product: DetailProductData
    stockMovements?: PaginatedStockMovements
    isLoading?: boolean
    onRefresh?: () => void
}

const formatRupiah = (val: number) =>
    new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0,
    }).format(val)

export function StokMutasiProduct({
    product,
    stockMovements,
    isLoading = false,
    onRefresh,
}: StokMutasiProductProps) {
    const baseUnit = product.base_unit || 'pcs'

    const goToPage = (page: number) => {
        router.visit(
            ProductController.show(product.id, {
                mergeQuery: {
                    tab: 'mutation',
                    mutation_page: page,
                },
            }),
            {
                only: ['stockMovements'],
                preserveState: true,
                preserveScroll: true,
                replace: true,
            }
        )
    }

    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                    <ArrowLeftRight className="h-5 w-5 text-muted-foreground" />
                    <div>
                        <CardTitle className="text-base font-semibold">Kartu Stok & Riwayat Mutasi</CardTitle>
                        <CardDescription>
                            Log pergerakan stok keluar/masuk dalam satuan dasar{' '}
                            <span className="font-mono font-semibold text-foreground">{baseUnit}</span> untuk{' '}
                            {product.name}.
                        </CardDescription>
                    </div>
                </div>
                {onRefresh && (
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={onRefresh}
                        disabled={isLoading}
                        className="gap-1.5 text-xs shrink-0"
                    >
                        <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                        Muat Ulang
                    </Button>
                )}
            </CardHeader>

            <CardContent className="p-0">
                {isLoading && !stockMovements ? (
                    <div className="p-6 space-y-3 border-t">
                        <Skeleton className="h-8 w-full" />
                        <Skeleton className="h-8 w-full" />
                        <Skeleton className="h-8 w-full" />
                    </div>
                ) : !stockMovements || stockMovements.data.length === 0 ? (
                    <div className="p-6 border-t">
                        <div className="flex min-h-[200px] flex-col items-center justify-center rounded-lg border border-dashed p-8 text-center">
                            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                                <PackageSearch className="h-6 w-6 text-muted-foreground" />
                            </div>
                            <h3 className="mt-4 text-sm font-semibold text-foreground">
                                Belum ada riwayat mutasi stok
                            </h3>
                            <p className="mt-1.5 max-w-sm text-xs text-muted-foreground">
                                Mutasi stok akan otomatis tercatat setiap kali penerimaan barang (LPB PO), penjualan kasir, atau penyesuaian stok diproses.
                            </p>
                        </div>
                    </div>
                ) : (
                    <>
                        <div className="overflow-x-auto border-t">
                            <table className="w-full min-w-[820px] table-fixed text-xs text-left">
                                <thead className="bg-muted/70 text-muted-foreground font-semibold border-b">
                                    <tr>
                                        <th className="p-3 w-[16%]">Waktu</th>
                                        <th className="p-3 w-[15%]">Jenis Mutasi</th>
                                        <th className="p-3 w-[10%] text-right">Awal</th>
                                        <th className="p-3 w-[11%] text-right">Perubahan</th>
                                        <th className="p-3 w-[10%] text-right">Akhir</th>
                                        <th className="p-3 w-[13%] text-right">HPP / {baseUnit}</th>
                                        <th className="p-3 w-[15%]">Keterangan</th>
                                        <th className="p-3 w-[10%]">Petugas</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y">
                                    {stockMovements.data.map((row) => {
                                        const isPositive = row.qty_change >= 0
                                        return (
                                            <tr key={row.id} className="hover:bg-muted/30 transition-colors">
                                                <td className="p-3 font-mono text-[11px] text-muted-foreground overflow-hidden text-ellipsis">
                                                    {row.created_at || '-'}
                                                </td>
                                                <td className="p-3 overflow-hidden text-ellipsis">
                                                    <Badge
                                                        variant="outline"
                                                        className={
                                                            isPositive
                                                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800'
                                                                : 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800'
                                                        }
                                                    >
                                                        {row.type_label}
                                                    </Badge>
                                                </td>
                                                <td className="p-3 text-right font-mono text-muted-foreground">
                                                    {row.stock_before}
                                                </td>
                                                <td
                                                    className={`p-3 text-right font-mono font-bold ${
                                                        isPositive
                                                            ? 'text-emerald-600 dark:text-emerald-400'
                                                            : 'text-rose-600 dark:text-rose-400'
                                                    }`}
                                                >
                                                    {isPositive ? `+${row.qty_change}` : row.qty_change}
                                                </td>
                                                <td className="p-3 text-right font-mono font-semibold text-foreground">
                                                    {row.stock_after} {baseUnit}
                                                </td>
                                                <td className="p-3 text-right font-mono font-semibold text-foreground">
                                                    {formatRupiah(row.unit_cost)}
                                                </td>
                                                <td className="p-3 text-muted-foreground overflow-hidden text-ellipsis">
                                                    <span className="line-clamp-2 whitespace-normal">
                                                        {row.notes || '-'}
                                                    </span>
                                                </td>
                                                <td className="p-3 text-muted-foreground truncate">
                                                    {row.creator_name}
                                                </td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                            </table>
                        </div>

                        {stockMovements.last_page > 1 && (
                            <div className="flex items-center justify-between px-4 py-3 border-t text-xs text-muted-foreground">
                                <span>
                                    Menampilkan {stockMovements.from ?? 0}–{stockMovements.to ?? 0} dari{' '}
                                    {stockMovements.total} mutasi
                                </span>
                                <div className="flex items-center gap-1.5">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="xs"
                                        disabled={stockMovements.current_page <= 1 || isLoading}
                                        onClick={() => goToPage(stockMovements.current_page - 1)}
                                    >
                                        <ChevronLeft className="h-3.5 w-3.5" />
                                    </Button>
                                    <span className="font-mono px-2">
                                        {stockMovements.current_page} / {stockMovements.last_page}
                                    </span>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="xs"
                                        disabled={stockMovements.current_page >= stockMovements.last_page || isLoading}
                                        onClick={() => goToPage(stockMovements.current_page + 1)}
                                    >
                                        <ChevronRight className="h-3.5 w-3.5" />
                                    </Button>
                                </div>
                            </div>
                        )}
                    </>
                )}
            </CardContent>
        </Card>
    )
}

export default StokMutasiProduct

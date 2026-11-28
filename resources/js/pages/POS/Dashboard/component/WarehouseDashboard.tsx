import React from 'react'
import { Link } from '@inertiajs/react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { SummaryStatCard, SummaryStatGrid } from '@/components/SummaryStatCard'
import { formatNumber } from '@/lib/utils'
import {
    AlertTriangle,
    ArrowRight,
    Boxes,
    PackageCheck,
    PackageMinus,
    Plus,
    XCircle,
} from 'lucide-react'
import purchaseOrders from '@/routes/pos/purchase-orders'
import products from '@/routes/pos/products'
import type { WarehouseWidgetsData } from './dashboardUtils'
import { WarehouseStockChart } from './DashboardCharts'

export interface WarehouseDashboardProps {
    kpis: {
        active_sku_count: number
        low_stock_count: number
        po_ready_receive_count: number
        po_rejected_count: number
    }
    warehouseWidgets?: WarehouseWidgetsData
}

export function WarehouseDashboard({ kpis, warehouseWidgets }: WarehouseDashboardProps) {
    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-foreground">
                        Dashboard Gudang & Persediaan
                    </h1>
                    <p className="text-sm text-muted-foreground">
                        Fokus kontrol stok kritis, penerimaan barang (LPB), dan revisi Purchase Order.
                    </p>
                </div>

                <div className="flex flex-wrap gap-2">
                    <Link href={purchaseOrders.create.url()}>
                        <Button className="gap-2 cursor-pointer">
                            <Plus className="h-4 w-4" />
                            Buat Purchase Order
                        </Button>
                    </Link>
                    <Link href={products.index.url()}>
                        <Button variant="outline" className="gap-2 cursor-pointer">
                            <Boxes className="h-4 w-4" />
                            Master Produk
                        </Button>
                    </Link>
                </div>
            </div>

            {/* 4 Warehouse KPI Cards */}
            <SummaryStatGrid>
                <SummaryStatCard
                    title="Total SKU Aktif"
                    value={formatNumber(kpis.active_sku_count)}
                    icon={Boxes}
                    variant="blue"
                    subInfo="Produk terdaftar aktif"
                    periodLabel="Aktif"
                    href={products.index.url()}
                />
                <SummaryStatCard
                    title="PO Siap Diterima (LPB)"
                    value={formatNumber(kpis.po_ready_receive_count)}
                    icon={PackageCheck}
                    variant="emerald"
                    subInfo="Status approved / partial"
                    periodLabel="Siap LPB"
                    href={purchaseOrders.index.url({ query: { status: 'approved' } })}
                />
                <SummaryStatCard
                    title="PO Ditolak (Revisi)"
                    value={formatNumber(kpis.po_rejected_count)}
                    icon={XCircle}
                    variant="amber"
                    subInfo="Perlu diperbaiki & ajukan ulang"
                    periodLabel="Revisi"
                    href={purchaseOrders.index.url({ query: { status: 'rejected' } })}
                />
                <SummaryStatCard
                    title="SKU Stok Kritis"
                    value={formatNumber(kpis.low_stock_count)}
                    icon={PackageMinus}
                    variant="rose"
                    subInfo="Stok ≤ minimum stok"
                    periodLabel="Restock"
                    href={products.index.url({ query: { stock_status: 'low_stock' } })}
                />
            </SummaryStatGrid>

            {/* Stock Movement Chart + Rejected POs */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
                <div className="lg:col-span-8">
                    <WarehouseStockChart data={warehouseWidgets?.stockMovementTrend} />
                </div>

                <Card className="lg:col-span-4 flex flex-col">
                    <CardHeader className="pb-3">
                        <CardTitle className="flex items-center gap-2 text-base">
                            <AlertTriangle className="h-4 w-4 text-amber-500" />
                            PO Ditolak (Perlu Revisi)
                        </CardTitle>
                        <CardDescription className="text-xs">Daftar pengajuan PO yang ditolak Admin</CardDescription>
                    </CardHeader>
                    <CardContent className="flex-1">
                        {warehouseWidgets === undefined ? (
                            <div className="space-y-2.5">
                                <Skeleton className="h-14 w-full" />
                                <Skeleton className="h-14 w-full" />
                            </div>
                        ) : warehouseWidgets.rejectedPos.length === 0 ? (
                            <p className="py-10 text-center text-xs text-muted-foreground">
                                Tidak ada PO yang ditolak saat ini.
                            </p>
                        ) : (
                            <div className="space-y-2.5">
                                {warehouseWidgets.rejectedPos.map((po) => (
                                    <div key={po.id} className="rounded-lg border p-3 space-y-1.5">
                                        <div className="flex items-center justify-between gap-2">
                                            <span className="font-mono text-xs font-semibold text-primary">
                                                {po.po_number}
                                            </span>
                                            <Link href={purchaseOrders.show.url(po.id)}>
                                                <Button size="sm" variant="outline" className="h-6 text-[11px] cursor-pointer">
                                                    Revisi
                                                </Button>
                                            </Link>
                                        </div>
                                        <p className="text-xs text-muted-foreground truncate">{po.supplier_name}</p>
                                        <p className="text-[11px] text-rose-600 dark:text-rose-400 line-clamp-2">
                                            Alasan: {po.rejection_reason}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* PO Siap Diterima & Stok Kritis */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-base">PO Menunggu Penerimaan Barang (LPB)</CardTitle>
                        <CardDescription className="text-xs">
                            Klik Terima untuk memproses penerimaan stok ke gudang.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        {warehouseWidgets === undefined ? (
                            <div className="space-y-2">
                                <Skeleton className="h-10 w-full" />
                                <Skeleton className="h-10 w-full" />
                                <Skeleton className="h-10 w-full" />
                            </div>
                        ) : (
                            <div className="overflow-x-auto rounded-lg border">
                                <table className="table-fixed w-full min-w-[460px] text-sm">
                                    <thead className="bg-muted/50 border-b text-xs text-muted-foreground">
                                        <tr>
                                            <th className="w-[28%] px-3 py-2 text-left font-medium">No. PO</th>
                                            <th className="w-[30%] px-3 py-2 text-left font-medium">Supplier</th>
                                            <th className="w-[22%] px-3 py-2 text-left font-medium">Status</th>
                                            <th className="w-[20%] px-3 py-2 text-right font-medium">Aksi</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y">
                                        {warehouseWidgets.pendingReceivingPos.length === 0 ? (
                                            <tr>
                                                <td colSpan={4} className="px-3 py-8 text-center text-xs text-muted-foreground">
                                                    Semua PO yang disetujui telah diterima penuh.
                                                </td>
                                            </tr>
                                        ) : (
                                            warehouseWidgets.pendingReceivingPos.map((po) => (
                                                <tr key={po.id}>
                                                    <td className="px-3 py-2 font-mono text-xs font-semibold text-primary truncate">
                                                        {po.po_number}
                                                    </td>
                                                    <td className="px-3 py-2 text-xs truncate">{po.supplier_name}</td>
                                                    <td className="px-3 py-2">
                                                        <Badge variant="outline" className="text-[10px]">
                                                            {po.receiving_status_label}
                                                        </Badge>
                                                    </td>
                                                    <td className="px-3 py-2 text-right">
                                                        <Link href={purchaseOrders.show.url(po.id)}>
                                                            <Button size="sm" variant="outline" className="h-7 gap-1 text-xs cursor-pointer">
                                                                Terima <ArrowRight className="h-3 w-3" />
                                                            </Button>
                                                        </Link>
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-base">Daftar Produk Stok Kritis</CardTitle>
                        <CardDescription className="text-xs">
                            Segera jadwalkan pemesanan ulang untuk produk di bawah batas aman.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        {warehouseWidgets === undefined ? (
                            <div className="space-y-2">
                                <Skeleton className="h-10 w-full" />
                                <Skeleton className="h-10 w-full" />
                                <Skeleton className="h-10 w-full" />
                            </div>
                        ) : (
                            <div className="overflow-x-auto rounded-lg border">
                                <table className="table-fixed w-full min-w-[460px] text-sm">
                                    <thead className="bg-muted/50 border-b text-xs text-muted-foreground">
                                        <tr>
                                            <th className="w-[46%] px-3 py-2 text-left font-medium">Produk</th>
                                            <th className="w-[18%] px-3 py-2 text-right font-medium">Stok</th>
                                            <th className="w-[16%] px-3 py-2 text-right font-medium">Min</th>
                                            <th className="w-[20%] px-3 py-2 text-right font-medium">Aksi</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y">
                                        {warehouseWidgets.lowStockProducts.length === 0 ? (
                                            <tr>
                                                <td colSpan={4} className="px-3 py-8 text-center text-xs text-muted-foreground">
                                                    Stok seluruh SKU dalam kondisi aman.
                                                </td>
                                            </tr>
                                        ) : (
                                            warehouseWidgets.lowStockProducts.map((p) => (
                                                <tr key={p.id}>
                                                    <td className="px-3 py-2 text-xs font-medium truncate">
                                                        {p.name}
                                                    </td>
                                                    <td className="px-3 py-2 text-right font-mono text-xs font-bold text-rose-600 dark:text-rose-400">
                                                        {p.stock} {p.base_unit}
                                                    </td>
                                                    <td className="px-3 py-2 text-right font-mono text-xs text-muted-foreground">
                                                        {p.min_stock}
                                                    </td>
                                                    <td className="px-3 py-2 text-right">
                                                        <Link href={products.show.url(p.id)}>
                                                            <Button size="sm" variant="outline" className="h-7 text-xs cursor-pointer">
                                                                Detail
                                                            </Button>
                                                        </Link>
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}

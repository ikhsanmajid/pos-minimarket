import React from 'react'
import { Link } from '@inertiajs/react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
    AlertTriangle,
    ArrowRight,
    CheckCircle2,
    ClipboardCheck,
    FileWarning,
    PackageMinus,
    Scale,
} from 'lucide-react'
import purchaseOrders from '@/routes/pos/purchase-orders'
import products from '@/routes/pos/products'
import financePayables from '@/routes/pos/finance/payables'
import shifts from '@/routes/pos/shifts'
import { formatRupiah, type ActionableAlertsData } from './dashboardUtils'
import { formatSignedRupiah } from '../../Shifts/component/shiftUtils'

interface ActionableAlertsCardProps {
    counts: {
        pending_po: number
        low_stock: number
        due_payables?: number
        shift_anomalies: number
    }
    alerts?: ActionableAlertsData
    showPayables?: boolean
}

export function ActionableAlertsCard({
    counts,
    alerts,
    showPayables = true,
}: ActionableAlertsCardProps) {
    const defaultTab =
        counts.pending_po > 0
            ? 'pending_po'
            : counts.low_stock > 0
              ? 'low_stock'
              : showPayables && (counts.due_payables ?? 0) > 0
                ? 'due_payables'
                : counts.shift_anomalies > 0
                  ? 'shift_anomalies'
                  : 'pending_po'

    return (
        <Card>
            <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                    <AlertTriangle className="h-4 w-4 text-amber-500" />
                    Perlu Tindakan Segera (Actionable Alerts)
                </CardTitle>
                <CardDescription className="text-xs">
                    Daftar antrean operasional yang membutuhkan persetujuan, restock, pembayaran, atau audit.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <Tabs defaultValue={defaultTab} className="space-y-4">
                    <TabsList className="flex flex-wrap h-auto gap-1 w-full justify-start">
                        <TabsTrigger value="pending_po" className="gap-1.5 text-xs">
                            <ClipboardCheck className="h-3.5 w-3.5" />
                            Approval PO
                            <Badge variant={counts.pending_po > 0 ? 'destructive' : 'secondary'} className="h-4 px-1.5 text-[10px]">
                                {counts.pending_po}
                            </Badge>
                        </TabsTrigger>

                        <TabsTrigger value="low_stock" className="gap-1.5 text-xs">
                            <PackageMinus className="h-3.5 w-3.5" />
                            Stok Kritis
                            <Badge variant={counts.low_stock > 0 ? 'destructive' : 'secondary'} className="h-4 px-1.5 text-[10px]">
                                {counts.low_stock}
                            </Badge>
                        </TabsTrigger>

                        {showPayables && (
                            <TabsTrigger value="due_payables" className="gap-1.5 text-xs">
                                <FileWarning className="h-3.5 w-3.5" />
                                Hutang Jatuh Tempo
                                <Badge variant={(counts.due_payables ?? 0) > 0 ? 'destructive' : 'secondary'} className="h-4 px-1.5 text-[10px]">
                                    {counts.due_payables ?? 0}
                                </Badge>
                            </TabsTrigger>
                        )}

                        <TabsTrigger value="shift_anomalies" className="gap-1.5 text-xs">
                            <Scale className="h-3.5 w-3.5" />
                            Selisih Shift (7H)
                            <Badge variant={counts.shift_anomalies > 0 ? 'destructive' : 'secondary'} className="h-4 px-1.5 text-[10px]">
                                {counts.shift_anomalies}
                            </Badge>
                        </TabsTrigger>
                    </TabsList>

                    {alerts === undefined ? (
                        <div className="space-y-2.5">
                            <Skeleton className="h-12 w-full rounded-lg" />
                            <Skeleton className="h-12 w-full rounded-lg" />
                            <Skeleton className="h-12 w-full rounded-lg" />
                        </div>
                    ) : (
                        <>
                            {/* Tab 1: Pending PO */}
                            <TabsContent value="pending_po" className="m-0">
                                {alerts.pending_pos.length === 0 ? (
                                    <EmptyAlert text="Tidak ada Purchase Order yang menunggu persetujuan." />
                                ) : (
                                    <div className="divide-y rounded-lg border">
                                        {alerts.pending_pos.map((po) => (
                                            <div key={po.id} className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between">
                                                <div className="min-w-0">
                                                    <p className="font-mono text-xs font-semibold text-primary">
                                                        {po.po_number}
                                                    </p>
                                                    <p className="text-xs text-muted-foreground truncate">
                                                        {po.supplier_name} • {po.order_date}
                                                    </p>
                                                </div>
                                                <div className="flex items-center gap-3 shrink-0">
                                                    <span className="font-mono text-xs font-semibold">
                                                        {formatRupiah(po.total_amount)}
                                                    </span>
                                                    <Link href={purchaseOrders.show.url(po.id)}>
                                                        <Button size="sm" variant="outline" className="h-7 gap-1 text-xs cursor-pointer">
                                                            Tinjau <ArrowRight className="h-3 w-3" />
                                                        </Button>
                                                    </Link>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </TabsContent>

                            {/* Tab 2: Low Stock */}
                            <TabsContent value="low_stock" className="m-0">
                                {alerts.low_stock_products.length === 0 ? (
                                    <EmptyAlert text="Seluruh produk aktif berada di atas batas stok minimum." />
                                ) : (
                                    <div className="divide-y rounded-lg border">
                                        {alerts.low_stock_products.map((prod) => (
                                            <div key={prod.id} className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between">
                                                <div className="min-w-0">
                                                    <p className="text-xs font-semibold text-foreground truncate">
                                                        {prod.name}
                                                    </p>
                                                    <p className="text-[11px] text-muted-foreground">
                                                        Barcode: <span className="font-mono">{prod.barcode ?? '-'}</span> • Min: {prod.min_stock} {prod.base_unit}
                                                    </p>
                                                </div>
                                                <div className="flex items-center gap-2 shrink-0">
                                                    <Badge variant="destructive" className="font-mono text-[11px]">
                                                        Sisa {prod.stock} {prod.base_unit}
                                                    </Badge>
                                                    <Link href={products.show.url(prod.id)}>
                                                        <Button size="sm" variant="ghost" className="h-7 text-xs cursor-pointer">
                                                            Detail
                                                        </Button>
                                                    </Link>
                                                    <Link href={purchaseOrders.create.url()}>
                                                        <Button size="sm" variant="outline" className="h-7 text-xs cursor-pointer">
                                                            Buat PO
                                                        </Button>
                                                    </Link>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </TabsContent>

                            {/* Tab 3: Due Payables */}
                            {showPayables && (
                                <TabsContent value="due_payables" className="m-0">
                                    {(alerts.due_payables ?? []).length === 0 ? (
                                        <EmptyAlert text="Tidak ada hutang dagang jatuh tempo dalam 7 hari ke depan." />
                                    ) : (
                                        <div className="divide-y rounded-lg border">
                                            {(alerts.due_payables ?? []).map((ap) => (
                                                <div key={ap.id} className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between">
                                                    <div className="min-w-0">
                                                        <div className="flex items-center gap-2">
                                                            <span className="font-mono text-xs font-semibold text-primary">
                                                                {ap.payable_number}
                                                            </span>
                                                            {ap.is_overdue && (
                                                                <Badge variant="destructive" className="text-[10px]">
                                                                    Terlambat
                                                                </Badge>
                                                            )}
                                                        </div>
                                                        <p className="text-xs text-muted-foreground truncate">
                                                            {ap.supplier_name} • PO {ap.po_number} • Tempo: {ap.due_date}
                                                        </p>
                                                    </div>
                                                    <div className="flex items-center gap-3 shrink-0">
                                                        <span className="font-mono text-xs font-semibold text-rose-600 dark:text-rose-400">
                                                            {formatRupiah(ap.remaining_amount)}
                                                        </span>
                                                        <Link href={financePayables.index.url()}>
                                                            <Button size="sm" variant="outline" className="h-7 gap-1 text-xs cursor-pointer">
                                                                Bayar <ArrowRight className="h-3 w-3" />
                                                            </Button>
                                                        </Link>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </TabsContent>
                            )}

                            {/* Tab 4: Shift Variance Anomalies */}
                            <TabsContent value="shift_anomalies" className="m-0">
                                {alerts.shift_anomalies.length === 0 ? (
                                    <EmptyAlert text="Semua sesi shift dalam 7 hari terakhir tercatat klop tanpa selisih." />
                                ) : (
                                    <div className="divide-y rounded-lg border">
                                        {alerts.shift_anomalies.map((s) => (
                                            <div key={s.id} className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between">
                                                <div className="min-w-0">
                                                    <p className="font-mono text-xs font-semibold text-primary">
                                                        {s.shift_number} ({s.register_name})
                                                    </p>
                                                    <p className="text-xs text-muted-foreground truncate">
                                                        Kasir: {s.cashier_name} • Tutup: {s.closed_at}
                                                    </p>
                                                </div>
                                                <div className="flex items-center gap-3 shrink-0">
                                                    <Badge
                                                        variant="outline"
                                                        className={
                                                            s.cash_variance < 0
                                                                ? 'border-rose-200 bg-rose-500/10 text-rose-700 font-mono dark:border-rose-800 dark:text-rose-300'
                                                                : 'border-amber-200 bg-amber-500/10 text-amber-700 font-mono dark:border-amber-800 dark:text-amber-300'
                                                        }
                                                    >
                                                        {formatSignedRupiah(s.cash_variance)}
                                                    </Badge>
                                                    <Link href={shifts.show.url(s.id)}>
                                                        <Button size="sm" variant="outline" className="h-7 gap-1 text-xs cursor-pointer">
                                                            Audit <ArrowRight className="h-3 w-3" />
                                                        </Button>
                                                    </Link>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </TabsContent>
                        </>
                    )}
                </Tabs>
            </CardContent>
        </Card>
    )
}

function EmptyAlert({ text }: { text: string }) {
    return (
        <div className="flex items-center gap-2.5 rounded-lg border border-dashed p-5 text-xs text-muted-foreground">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>{text}</span>
        </div>
    )
}

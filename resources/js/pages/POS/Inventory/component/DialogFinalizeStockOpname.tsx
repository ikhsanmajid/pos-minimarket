import React from 'react'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react'
import { cn, formatNumber, formatRupiah } from '@/lib/utils'
import type { OpnameSessionItem } from '../StockOpnameSession'

interface DialogFinalizeStockOpnameProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    opnameNumber: string
    items: OpnameSessionItem[]
    hasUnsavedChanges: boolean
    isFinalizing: boolean
    onConfirmFinalize: () => void
}

export function DialogFinalizeStockOpname({
    open,
    onOpenChange,
    opnameNumber,
    items,
    hasUnsavedChanges,
    isFinalizing,
    onConfirmFinalize,
}: DialogFinalizeStockOpnameProps) {
    const uncountedItems = items.filter((i) => i.physical_stock === null)
    const countedItems = items.filter((i) => i.physical_stock !== null)

    const varianceItems = countedItems.filter((i) => {
        const sys = i.system_stock ?? 0
        const phy = i.physical_stock ?? 0
        return phy !== sys
    })

    const surplusItems = varianceItems.filter((i) => (i.physical_stock ?? 0) > (i.system_stock ?? 0))
    const shortageItems = varianceItems.filter((i) => (i.physical_stock ?? 0) < (i.system_stock ?? 0))

    const totalVarianceValue = varianceItems.reduce((acc, item) => {
        const diff = (item.physical_stock ?? 0) - (item.system_stock ?? 0)
        return acc + diff * (item.unit_cost_snapshot ?? 0)
    }, 0)

    return (
        <Dialog open={open} onOpenChange={(next) => !isFinalizing && onOpenChange(next)}>
            <DialogContent className="flex max-h-[85vh] max-w-3xl flex-col gap-0 overflow-hidden p-0">
                <DialogHeader className="shrink-0 border-b p-6 pb-4">
                    <DialogTitle>Review & Finalisasi {opnameNumber}</DialogTitle>
                    <DialogDescription>
                        Periksa ringkasan komparasi stok sistem vs fisik sebelum mengunci dokumen dan memperbarui stok produk.
                    </DialogDescription>
                </DialogHeader>

                <div className="flex-1 space-y-4 overflow-y-auto overflow-x-hidden p-6">
                    {hasUnsavedChanges && (
                        <div className="flex items-start gap-2.5 rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
                            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                            <p>
                                Anda masih memiliki perubahan penghitungan yang belum disimpan. Simpan draf terlebih dahulu sebelum finalisasi agar data terbaru ikut diproses.
                            </p>
                        </div>
                    )}

                    {uncountedItems.length > 0 && (
                        <div className="flex items-start gap-2.5 rounded-lg border border-rose-300 bg-rose-50 p-3 text-xs text-rose-800 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-300">
                            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                            <p>
                                Masih ada <strong>{uncountedItems.length} produk</strong> yang belum diisi stok fisiknya. Lengkapi seluruh penghitungan terlebih dahulu sebelum finalisasi.
                            </p>
                        </div>
                    )}

                    {/* Ringkasan Angka */}
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                        <div className="rounded-lg border bg-muted/30 p-3">
                            <p className="text-[11px] text-muted-foreground">Produk Dihitung</p>
                            <p className="mt-0.5 font-mono text-lg font-bold text-foreground">
                                {formatNumber(countedItems.length)} / {formatNumber(items.length)}
                            </p>
                        </div>
                        <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 p-3 dark:border-emerald-900 dark:bg-emerald-950/30">
                            <p className="text-[11px] text-muted-foreground">Item Surplus (+)</p>
                            <p className="mt-0.5 font-mono text-lg font-bold text-emerald-600 dark:text-emerald-400">
                                {formatNumber(surplusItems.length)}
                            </p>
                        </div>
                        <div className="rounded-lg border border-rose-200 bg-rose-50/50 p-3 dark:border-rose-900 dark:bg-rose-950/30">
                            <p className="text-[11px] text-muted-foreground">Item Minus (-)</p>
                            <p className="mt-0.5 font-mono text-lg font-bold text-rose-600 dark:text-rose-400">
                                {formatNumber(shortageItems.length)}
                            </p>
                        </div>
                        <div className="rounded-lg border bg-muted/30 p-3">
                            <p className="text-[11px] text-muted-foreground">Total Selisih (Rp)</p>
                            <p
                                className={cn(
                                    'mt-0.5 font-mono text-base font-bold',
                                    totalVarianceValue < 0
                                        ? 'text-rose-600 dark:text-rose-400'
                                        : totalVarianceValue > 0
                                          ? 'text-emerald-600 dark:text-emerald-400'
                                          : 'text-foreground'
                                )}
                            >
                                {totalVarianceValue > 0 ? '+' : ''}
                                {formatRupiah(totalVarianceValue)}
                            </p>
                        </div>
                    </div>

                    {/* Tabel Item Berselisih */}
                    {varianceItems.length > 0 ? (
                        <div className="space-y-2">
                            <p className="text-xs font-semibold text-foreground">
                                Rincian Item Berselisih ({varianceItems.length} produk akan memperbarui stok):
                            </p>
                            <div className="overflow-x-auto rounded-lg border">
                                <table className="w-full min-w-[540px] table-fixed text-xs">
                                    <thead className="border-b bg-muted/50 text-muted-foreground">
                                        <tr>
                                            <th className="w-[38%] px-3 py-2 text-left font-medium">Produk</th>
                                            <th className="w-[14%] px-3 py-2 text-right font-medium">Sistem</th>
                                            <th className="w-[14%] px-3 py-2 text-right font-medium">Fisik</th>
                                            <th className="w-[14%] px-3 py-2 text-right font-medium">Selisih</th>
                                            <th className="w-[20%] px-3 py-2 text-right font-medium">Nilai (Rp)</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y">
                                        {varianceItems.map((item) => {
                                            const sys = item.system_stock ?? 0
                                            const phy = item.physical_stock ?? 0
                                            const diff = phy - sys
                                            const val = diff * (item.unit_cost_snapshot ?? 0)
                                            return (
                                                <tr key={item.id}>
                                                    <td className="truncate px-3 py-2 font-medium text-foreground">
                                                        {item.product_name}
                                                    </td>
                                                    <td className="px-3 py-2 text-right font-mono text-muted-foreground">
                                                        {sys}
                                                    </td>
                                                    <td className="px-3 py-2 text-right font-mono font-semibold">
                                                        {phy}
                                                    </td>
                                                    <td
                                                        className={cn(
                                                            'px-3 py-2 text-right font-mono font-bold',
                                                            diff < 0
                                                                ? 'text-rose-600 dark:text-rose-400'
                                                                : 'text-emerald-600 dark:text-emerald-400'
                                                        )}
                                                    >
                                                        {diff > 0 ? `+${diff}` : diff}
                                                    </td>
                                                    <td
                                                        className={cn(
                                                            'px-3 py-2 text-right font-mono font-semibold',
                                                            val < 0
                                                                ? 'text-rose-600 dark:text-rose-400'
                                                                : 'text-emerald-600 dark:text-emerald-400'
                                                        )}
                                                    >
                                                        {val > 0 ? '+' : ''}
                                                        {formatRupiah(val)}
                                                    </td>
                                                </tr>
                                            )
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    ) : (
                        <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 p-4 text-center text-xs text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300">
                            Semua produk yang dihitung cocok 100% dengan stok sistem (0 selisih).
                        </div>
                    )}

                    <div className="rounded-lg border border-amber-200 bg-amber-50/60 p-3 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
                        <strong>Peringatan:</strong> Setelah difinalisasi, stok produk yang berselisih akan langsung diperbarui, mutasi stok bertipe <em>Stock Opname</em> akan dicatat, dan dokumen ini akan <strong>dikunci permanen</strong>.
                    </div>
                </div>

                <DialogFooter className="flex shrink-0 items-center justify-end gap-2 border-t bg-muted/20 p-6 pt-4">
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                        disabled={isFinalizing}
                    >
                        Batal
                    </Button>
                    <Button
                        type="button"
                        onClick={onConfirmFinalize}
                        disabled={isFinalizing || uncountedItems.length > 0 || hasUnsavedChanges}
                        className="gap-1.5 bg-emerald-600 text-white hover:bg-emerald-700"
                    >
                        {isFinalizing ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                            <CheckCircle2 className="h-4 w-4" />
                        )}
                        Finalisasi & Kunci Dokumen
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

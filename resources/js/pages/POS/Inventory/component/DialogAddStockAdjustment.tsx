import React, { useMemo, useState } from 'react'
import { useForm } from '@inertiajs/react'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import { AlertTriangle, ArrowRight, Info, Loader2 } from 'lucide-react'
import { cn, formatRupiah } from '@/lib/utils'
import SelectProductAsync, {
    type ProductOption,
} from '@/pages/POS/PurchaseOrders/component/SelectProductAsync'
import StockAdjustmentController from '@/actions/App/Http/Controllers/StockAdjustmentController'
import type { SelectOptionItem } from './StockAdjustmentSearch'

interface DialogAddStockAdjustmentProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    typeOptions: SelectOptionItem[]
    reasonOptions: SelectOptionItem[]
    canApprove: boolean
}

export function DialogAddStockAdjustment({
    open,
    onOpenChange,
    typeOptions,
    reasonOptions,
    canApprove,
}: DialogAddStockAdjustmentProps) {
    const [selectedProduct, setSelectedProduct] = useState<ProductOption | null>(null)

    const { data, setData, post, processing, errors, reset, clearErrors } = useForm({
        product_id: '' as string | number,
        type: 'out',
        reason: 'damaged',
        qty_change: 1,
        notes: '',
    })

    const hasStockInfo = selectedProduct?.stock !== undefined && selectedProduct?.stock !== null
    const currentStock = selectedProduct?.stock ?? 0
    const buyPrice = selectedProduct?.buy_price ?? 0
    const baseUnit = selectedProduct?.base_unit ?? 'pcs'
    const qtyNum = Number(data.qty_change) || 0

    const preview = useMemo(() => {
        if (!selectedProduct) {
            return null
        }
        const after = hasStockInfo
            ? data.type === 'in'
                ? currentStock + qtyNum
                : currentStock - qtyNum
            : null
        const signedQty = data.type === 'in' ? qtyNum : -qtyNum
        const costImpact = signedQty * buyPrice
        return {
            before: hasStockInfo ? currentStock : null,
            after,
            isNegative: after !== null && after < 0,
            costImpact,
        }
    }, [selectedProduct, hasStockInfo, currentStock, qtyNum, data.type, buyPrice])

    const handleClose = () => {
        if (processing) return
        reset()
        clearErrors()
        setSelectedProduct(null)
        onOpenChange(false)
    }

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        if (!selectedProduct || (preview && preview.isNegative)) {
            return
        }

        post(StockAdjustmentController.store.url(), {
            preserveScroll: true,
            onSuccess: () => {
                reset()
                clearErrors()
                setSelectedProduct(null)
                onOpenChange(false)
            },
        })
    }

    return (
        <Dialog open={open} onOpenChange={(next) => (next ? onOpenChange(true) : handleClose())}>
            <DialogContent className="flex max-h-[85vh] max-w-2xl flex-col gap-0 overflow-hidden p-0">
                <DialogHeader className="shrink-0 border-b p-6 pb-4">
                    <DialogTitle>
                        {canApprove ? 'Buat Penyesuaian Stok' : 'Ajukan Penyesuaian Stok'}
                    </DialogTitle>
                    <DialogDescription>
                        {canApprove
                            ? 'Penyesuaian stok akan langsung memperbarui stok produk dan tercatat pada kartu stok (tanpa memotong saldo kas/bank).'
                            : 'Pengajuan penyesuaian stok akan dikirim ke Admin/Supervisor untuk ditinjau sebelum stok produk berubah.'}
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
                    <div className="flex-1 space-y-4 overflow-y-auto overflow-x-hidden p-6">
                        {!canApprove && (
                            <div className="flex items-start gap-2.5 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
                                <Info className="mt-0.5 h-4 w-4 shrink-0" />
                                <p>
                                    Pengajuan ini berstatus <strong>Menunggu Persetujuan</strong>. Stok produk baru
                                    akan diperbarui setelah disetujui oleh Admin atau Supervisor.
                                </p>
                            </div>
                        )}

                        {/* Pilih Produk */}
                        <div className="space-y-1.5">
                            <Label htmlFor="adj-product">
                                Produk <span className="text-rose-500">*</span>
                            </Label>
                            <SelectProductAsync
                                id="adj-product"
                                value={selectedProduct}
                                onChange={(val, opt) => {
                                    setSelectedProduct(opt)
                                    setData('product_id', val ?? '')
                                }}
                                placeholder="Cari nama produk atau barcode…"
                                error={errors.product_id}
                                required
                            />
                            {selectedProduct && (
                                <p className="text-xs text-muted-foreground">
                                    {hasStockInfo && (
                                        <>
                                            Stok Sistem:{' '}
                                            <strong className="text-foreground">
                                                {currentStock} {baseUnit}
                                            </strong>
                                            {' · '}
                                        </>
                                    )}
                                    HPP: <strong className="text-foreground">{formatRupiah(buyPrice)}</strong> / {baseUnit}
                                </p>
                            )}
                        </div>

                        {/* Tipe & Alasan */}
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <div className="space-y-1.5">
                                <Label>
                                    Tipe Penyesuaian <span className="text-rose-500">*</span>
                                </Label>
                                <Select
                                    value={data.type}
                                    items={typeOptions}
                                    onValueChange={(val) => val && setData('type', val)}
                                >
                                    <SelectTrigger className="h-9 w-full">
                                        <SelectValue>
                                            {(val) =>
                                                typeOptions.find((t) => t.value === val)?.label ??
                                                'Pilih Tipe'
                                            }
                                        </SelectValue>
                                    </SelectTrigger>
                                    <SelectContent>
                                        {typeOptions.map((opt) => (
                                            <SelectItem key={opt.value} value={opt.value}>
                                                {opt.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                {errors.type && (
                                    <p className="text-xs text-rose-500">{errors.type}</p>
                                )}
                            </div>

                            <div className="space-y-1.5">
                                <Label>
                                    Alasan <span className="text-rose-500">*</span>
                                </Label>
                                <Select
                                    value={data.reason}
                                    items={reasonOptions}
                                    onValueChange={(val) => val && setData('reason', val)}
                                >
                                    <SelectTrigger className="h-9 w-full">
                                        <SelectValue>
                                            {(val) =>
                                                reasonOptions.find((r) => r.value === val)?.label ??
                                                'Pilih Alasan'
                                            }
                                        </SelectValue>
                                    </SelectTrigger>
                                    <SelectContent>
                                        {reasonOptions.map((opt) => (
                                            <SelectItem key={opt.value} value={opt.value}>
                                                {opt.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                {errors.reason && (
                                    <p className="text-xs text-rose-500">{errors.reason}</p>
                                )}
                            </div>
                        </div>

                        {/* Qty Perubahan */}
                        <div className="space-y-1.5">
                            <Label htmlFor="adj-qty">
                                Jumlah Perubahan ({baseUnit}) <span className="text-rose-500">*</span>
                            </Label>
                            <Input
                                id="adj-qty"
                                type="number"
                                min={1}
                                value={data.qty_change}
                                onChange={(e) => setData('qty_change', Math.max(0, Number(e.target.value)))}
                                className="h-9 font-mono"
                                required
                            />
                            {errors.qty_change && (
                                <p className="text-xs text-rose-500">{errors.qty_change}</p>
                            )}
                        </div>

                        {/* Preview Real-time */}
                        {preview && (
                            <div
                                className={cn(
                                    'rounded-lg border p-3.5 text-sm',
                                    preview.isNegative
                                        ? 'border-rose-300 bg-rose-50 dark:border-rose-800 dark:bg-rose-950/40'
                                        : 'border-border bg-muted/40'
                                )}
                            >
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                    <span className="text-xs font-medium text-muted-foreground">
                                        Pratinjau Perubahan Stok
                                    </span>
                                    {preview.before !== null && preview.after !== null ? (
                                        <div className="flex items-center gap-2 font-mono text-sm font-semibold">
                                            <span>
                                                {preview.before} {baseUnit}
                                            </span>
                                            <ArrowRight className="h-4 w-4 text-muted-foreground" />
                                            <span
                                                className={cn(
                                                    preview.isNegative
                                                        ? 'text-rose-600 dark:text-rose-400'
                                                        : data.type === 'in'
                                                            ? 'text-emerald-600 dark:text-emerald-400'
                                                            : 'text-amber-600 dark:text-amber-400'
                                                )}
                                            >
                                                {preview.after} {baseUnit}
                                            </span>
                                        </div>
                                    ) : (
                                        <span
                                            className={cn(
                                                'font-mono text-sm font-semibold',
                                                data.type === 'in'
                                                    ? 'text-emerald-600 dark:text-emerald-400'
                                                    : 'text-amber-600 dark:text-amber-400'
                                            )}
                                        >
                                            {data.type === 'in' ? `+${qtyNum}` : `-${qtyNum}`} {baseUnit}
                                        </span>
                                    )}
                                </div>

                                <div className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-border/60 pt-2">
                                    <span className="text-xs text-muted-foreground">
                                        Estimasi Dampak Nilai (HPP)
                                    </span>
                                    <span
                                        className={cn(
                                            'font-mono text-xs font-bold',
                                            preview.costImpact < 0
                                                ? 'text-rose-600 dark:text-rose-400'
                                                : 'text-emerald-600 dark:text-emerald-400'
                                        )}
                                    >
                                        {preview.costImpact > 0 ? '+' : ''}
                                        {formatRupiah(preview.costImpact)}
                                    </span>
                                </div>

                                {preview.isNegative && (
                                    <div className="mt-2 flex items-center gap-1.5 text-xs font-medium text-rose-600 dark:text-rose-400">
                                        <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                                        Stok sesudah penyesuaian tidak boleh negatif!
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Catatan Wajib */}
                        <div className="space-y-1.5">
                            <Label htmlFor="adj-notes">
                                Catatan / Keterangan <span className="text-rose-500">*</span>
                            </Label>
                            <textarea
                                id="adj-notes"
                                rows={3}
                                value={data.notes}
                                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                                    setData('notes', e.target.value)
                                }
                                placeholder="Jelaskan kronologi / alasan penyesuaian stok secara singkat dan jelas…"
                                className="flex min-h-[76px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30"
                                required
                            />
                            {errors.notes && (
                                <p className="text-xs text-rose-500">{errors.notes}</p>
                            )}
                        </div>
                    </div>

                    <DialogFooter className="flex shrink-0 items-center justify-end gap-2 border-t bg-muted/20 p-6 pt-4">
                        <Button type="button" variant="outline" onClick={handleClose} disabled={processing}>
                            Batal
                        </Button>
                        <Button
                            type="submit"
                            disabled={
                                processing ||
                                !selectedProduct ||
                                qtyNum < 1 ||
                                Boolean(preview?.isNegative)
                            }
                        >
                            {processing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            {canApprove ? 'Simpan Penyesuaian' : 'Kirim Pengajuan'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}

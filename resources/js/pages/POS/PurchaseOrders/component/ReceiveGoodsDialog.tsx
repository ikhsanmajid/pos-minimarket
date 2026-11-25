import * as React from 'react'
import { router } from '@inertiajs/react'
import { Button } from '@/components/ui/button'
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { PackageCheck, ArrowRight, AlertCircle, Info } from 'lucide-react'
import PurchaseOrderController from '@/actions/App/Http/Controllers/PurchaseOrderController'
import { formatRupiah } from './purchaseOrderUtils'

export interface ReceiveItemInput {
    id: number
    product_id: number
    product_name: string
    barcode: string
    base_unit: string
    unit_name: string
    conversion_factor: number
    current_stock: number
    current_buy_price: number | string
    quantity_ordered: number
    quantity_received: number
    remaining_quantity: number
    free_qty_ordered: number
    free_qty_received: number
    remaining_free_quantity: number
    unit_cost: number | string
    net_unit_cost: number | string
    raw_expired_date?: string | null
}

interface ReceiveGoodsDialogProps {
    poId: number
    poNumber: string
    items: ReceiveItemInput[]
    open: boolean
    onOpenChange: (open: boolean) => void
}

interface ReceiveRowState {
    qty: number
    free_qty: number
    batch_number: string
    expired_date: string
}

export function ReceiveGoodsDialog({
    poId,
    poNumber,
    items,
    open,
    onOpenChange,
}: ReceiveGoodsDialogProps) {
    const pendingItems = React.useMemo(
        () => items.filter((it) => it.remaining_quantity > 0 || it.remaining_free_quantity > 0),
        [items]
    )

    const todayStr = new Date().toISOString().split('T')[0]
    const [deliveryNote, setDeliveryNote] = React.useState('')
    const [receivedDate, setReceivedDate] = React.useState(todayStr)
    const [notes, setNotes] = React.useState('')
    const [receiveForm, setReceiveForm] = React.useState<Record<number, ReceiveRowState>>({})
    const [processing, setProcessing] = React.useState(false)
    const [errorMsg, setErrorMsg] = React.useState<string | null>(null)

    React.useEffect(() => {
        if (open) {
            const initial: Record<number, ReceiveRowState> = {}
            pendingItems.forEach((it) => {
                initial[it.id] = {
                    qty: it.remaining_quantity,
                    free_qty: it.remaining_free_quantity,
                    batch_number: '',
                    expired_date: it.raw_expired_date || '',
                }
            })
            setReceiveForm(initial)
            setDeliveryNote('')
            setReceivedDate(new Date().toISOString().split('T')[0])
            setNotes('')
            setErrorMsg(null)
        }
    }, [open, pendingItems])

    const updateRow = (itemId: number, patch: Partial<ReceiveRowState>) => {
        setReceiveForm((prev) => ({
            ...prev,
            [itemId]: {
                ...prev[itemId],
                ...patch,
            },
        }))
    }

    const handleFillAllMax = () => {
        const updated: Record<number, ReceiveRowState> = {}
        pendingItems.forEach((it) => {
            updated[it.id] = {
                qty: it.remaining_quantity,
                free_qty: it.remaining_free_quantity,
                batch_number: receiveForm[it.id]?.batch_number || '',
                expired_date: receiveForm[it.id]?.expired_date || it.raw_expired_date || '',
            }
        })
        setReceiveForm(updated)
    }

    const handleResetAllZero = () => {
        const updated: Record<number, ReceiveRowState> = {}
        pendingItems.forEach((it) => {
            updated[it.id] = {
                qty: 0,
                free_qty: 0,
                batch_number: receiveForm[it.id]?.batch_number || '',
                expired_date: receiveForm[it.id]?.expired_date || it.raw_expired_date || '',
            }
        })
        setReceiveForm(updated)
    }

    const totalBaseUnitsReceiving = pendingItems.reduce((acc, it) => {
        const row = receiveForm[it.id]
        const q = (row?.qty || 0) + (row?.free_qty || 0)
        return acc + q * Math.max(1, it.conversion_factor)
    }, 0)

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        setErrorMsg(null)

        if (totalBaseUnitsReceiving <= 0) {
            setErrorMsg('Harap masukkan minimal 1 barang dengan jumlah terima atau bonus lebih dari 0.')
            return
        }

        const payloadItems = pendingItems.map((it) => ({
            purchase_order_item_id: it.id,
            receive_now_qty: receiveForm[it.id]?.qty || 0,
            free_qty_received: receiveForm[it.id]?.free_qty || 0,
            batch_number: receiveForm[it.id]?.batch_number || null,
            expired_date: receiveForm[it.id]?.expired_date || null,
        }))

        setProcessing(true)
        router.post(
            PurchaseOrderController.receive.url(poId),
            {
                supplier_delivery_note: deliveryNote || null,
                received_date: receivedDate,
                notes: notes || null,
                items: payloadItems,
            },
            {
                preserveScroll: true,
                onSuccess: () => {
                    onOpenChange(false)
                },
                onError: (errs) => {
                    const first = Object.values(errs)[0]
                    if (first) setErrorMsg(String(first))
                },
                onFinish: () => {
                    setProcessing(false)
                },
            }
        )
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-4xl lg:max-w-5xl max-h-[85vh] flex flex-col p-0 gap-0 overflow-hidden">
                <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden">
                    <DialogHeader className="p-6 pb-4 border-b shrink-0">
                        <DialogTitle className="flex items-center gap-2 text-lg">
                            <PackageCheck className="h-5 w-5 text-emerald-600" />
                            Terima Barang (LPB) — {poNumber}
                        </DialogTitle>
                        <DialogDescription className="text-xs">
                            Stok akan dikonversi ke <strong>satuan dasar</strong>, HPP dihitung ulang dengan metode{' '}
                            <strong>Weighted Average</strong> (termasuk bonus), dan kartu stok dicatat otomatis.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="flex-1 overflow-y-auto overflow-x-hidden p-6 space-y-4">
                        {errorMsg && (
                            <div className="flex items-center gap-2 rounded-md bg-destructive/10 p-3 text-xs text-destructive font-medium border border-destructive/20">
                                <AlertCircle className="h-4 w-4 shrink-0" />
                                <span>{errorMsg}</span>
                            </div>
                        )}

                        {/* Header Dokumen LPB */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 rounded-lg border bg-muted/20 p-3.5">
                            <div className="space-y-1">
                                <Label htmlFor="lpb-delivery-note" className="text-xs">
                                    No. Surat Jalan / Faktur Supplier
                                </Label>
                                <Input
                                    id="lpb-delivery-note"
                                    value={deliveryNote}
                                    onChange={(e) => setDeliveryNote(e.target.value)}
                                    placeholder="Contoh: SJ-2026/11/001"
                                    className="h-8 text-xs font-mono"
                                />
                            </div>
                            <div className="space-y-1">
                                <Label htmlFor="lpb-received-date" className="text-xs">
                                    Tanggal Terima Fisik <span className="text-destructive">*</span>
                                </Label>
                                <Input
                                    id="lpb-received-date"
                                    type="date"
                                    value={receivedDate}
                                    onChange={(e) => setReceivedDate(e.target.value)}
                                    className="h-8 text-xs"
                                    required
                                />
                            </div>
                            <div className="space-y-1">
                                <Label htmlFor="lpb-notes" className="text-xs">
                                    Catatan Penerimaan
                                </Label>
                                <Input
                                    id="lpb-notes"
                                    value={notes}
                                    onChange={(e) => setNotes(e.target.value)}
                                    placeholder="Kondisi kemasan, pengiriman tahap 1..."
                                    className="h-8 text-xs"
                                />
                            </div>
                        </div>

                        <div className="flex items-center justify-between text-xs bg-muted/50 p-2.5 rounded-lg border">
                            <div className="flex items-center gap-1.5 text-muted-foreground">
                                <Info className="h-4 w-4 text-primary" />
                                <span>
                                    Total <strong>{pendingItems.length}</strong> baris produk menunggu penerimaan.
                                </span>
                            </div>
                            <div className="flex items-center gap-2">
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={handleFillAllMax}
                                    className="h-7 text-xs"
                                >
                                    Terima Semua Sisa
                                </Button>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={handleResetAllZero}
                                    className="h-7 text-xs text-muted-foreground"
                                >
                                    Reset 0
                                </Button>
                            </div>
                        </div>

                        {/* Tabel Daftar Barang Penerimaan */}
                        <div className="rounded-lg border overflow-x-auto">
                            <table className="w-full min-w-[860px] table-fixed text-xs text-left">
                                <thead className="bg-muted/70 text-muted-foreground font-semibold border-b">
                                    <tr>
                                        <th className="p-3 w-[23%]">Produk & Satuan PO</th>
                                        <th className="p-3 w-[14%] text-center">Sisa Pesanan</th>
                                        <th className="p-3 w-[18%]">Terima Sekarang</th>
                                        <th className="p-3 w-[20%]">Batch & Expired</th>
                                        <th className="p-3 w-[25%]">Simulasi Stok & HPP Dasar</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y">
                                    {pendingItems.map((item) => {
                                        const row = receiveForm[item.id] ?? {
                                            qty: 0,
                                            free_qty: 0,
                                            batch_number: '',
                                            expired_date: '',
                                        }

                                        const factor = Math.max(1, item.conversion_factor)
                                        const baseIncoming = (row.qty + row.free_qty) * factor
                                        const oldStock = Math.max(0, Number(item.current_stock))
                                        const oldCost = Number(item.current_buy_price)
                                        const netUnitCost = Number(item.net_unit_cost)
                                        const incomingCostTotal = row.qty * netUnitCost

                                        const newStock = oldStock + baseIncoming
                                        const newWeightedCost =
                                            newStock > 0
                                                ? Math.round((((oldStock * oldCost) + incomingCostTotal) / newStock) * 100) / 100
                                                : oldCost

                                        return (
                                            <tr key={item.id} className="hover:bg-muted/30 transition-colors">
                                                <td className="p-3 align-top overflow-hidden text-ellipsis">
                                                    <div className="font-medium text-foreground text-sm truncate">
                                                        {item.product_name}
                                                    </div>
                                                    <div className="font-mono text-[11px] text-muted-foreground">
                                                        1 {item.unit_name} = {factor} {item.base_unit}
                                                    </div>
                                                    <div className="text-[11px] text-muted-foreground mt-0.5">
                                                        Harga bersih: <strong>{formatRupiah(netUnitCost)}</strong>/{item.unit_name}
                                                    </div>
                                                </td>

                                                <td className="p-3 align-top text-center">
                                                    <div className="space-y-1">
                                                        <Badge variant="outline" className="font-mono text-[11px]">
                                                            Sisa: {item.remaining_quantity} {item.unit_name}
                                                        </Badge>
                                                        {item.free_qty_ordered > 0 && (
                                                            <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-mono">
                                                                Bonus sisa: {item.remaining_free_quantity}
                                                            </div>
                                                        )}
                                                    </div>
                                                </td>

                                                <td className="p-3 align-top space-y-2">
                                                    <div>
                                                        <span className="text-[10px] text-muted-foreground block mb-0.5">
                                                            Qty ({item.unit_name})
                                                        </span>
                                                        <Input
                                                            type="number"
                                                            min={0}
                                                            max={item.remaining_quantity}
                                                            value={row.qty}
                                                            onChange={(e) => {
                                                                const parsed = parseInt(e.target.value) || 0
                                                                updateRow(item.id, {
                                                                    qty: Math.max(0, Math.min(item.remaining_quantity, parsed)),
                                                                })
                                                            }}
                                                            className="font-mono text-xs font-semibold h-8"
                                                        />
                                                    </div>
                                                    {item.remaining_free_quantity > 0 && (
                                                        <div>
                                                            <span className="text-[10px] text-emerald-600 dark:text-emerald-400 block mb-0.5">
                                                                Bonus ({item.unit_name})
                                                            </span>
                                                            <Input
                                                                type="number"
                                                                min={0}
                                                                max={item.remaining_free_quantity}
                                                                value={row.free_qty}
                                                                onChange={(e) => {
                                                                    const parsed = parseInt(e.target.value) || 0
                                                                    updateRow(item.id, {
                                                                        free_qty: Math.max(
                                                                            0,
                                                                            Math.min(item.remaining_free_quantity, parsed)
                                                                        ),
                                                                    })
                                                                }}
                                                                className="font-mono text-xs h-8 border-emerald-300 dark:border-emerald-800"
                                                            />
                                                        </div>
                                                    )}
                                                </td>

                                                <td className="p-3 align-top space-y-2">
                                                    <Input
                                                        placeholder="No. Batch (opsional)"
                                                        value={row.batch_number}
                                                        onChange={(e) =>
                                                            updateRow(item.id, { batch_number: e.target.value })
                                                        }
                                                        className="text-xs font-mono h-8"
                                                    />
                                                    <Input
                                                        type="date"
                                                        value={row.expired_date}
                                                        onChange={(e) =>
                                                            updateRow(item.id, { expired_date: e.target.value })
                                                        }
                                                        className="text-xs h-8"
                                                    />
                                                </td>

                                                <td className="p-3 align-top">
                                                    {baseIncoming > 0 ? (
                                                        <div className="p-2 rounded-md bg-muted/40 border space-y-1 text-xs">
                                                            <div className="font-mono text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                                                                +{baseIncoming} {item.base_unit}
                                                            </div>
                                                            <div className="text-muted-foreground text-[11px] font-mono">
                                                                Stok: {oldStock} → {newStock} {item.base_unit}
                                                            </div>
                                                            <div className="flex items-center gap-1 font-mono text-[11px]">
                                                                <span className="text-muted-foreground line-through">
                                                                    {formatRupiah(oldCost)}
                                                                </span>
                                                                <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />
                                                                <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                                                                    {formatRupiah(newWeightedCost)}/{item.base_unit}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <span className="text-muted-foreground text-xs italic">
                                                            Tidak ada barang diterima
                                                        </span>
                                                    )}
                                                </td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                            </table>
                        </div>

                        <div className="flex flex-col sm:flex-row items-center justify-between gap-2 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs">
                            <div>
                                <span className="font-semibold text-foreground block">
                                    Total Masuk ke Stok Dasar: +{totalBaseUnitsReceiving.toLocaleString('id-ID')} unit dasar
                                </span>
                                <span className="text-muted-foreground">
                                    Nomor LPB dan entri kartu stok (stock_movements) akan dibuat otomatis.
                                </span>
                            </div>
                        </div>
                    </div>

                    <DialogFooter className="p-6 pt-4 border-t shrink-0 flex items-center justify-end gap-2 bg-muted/20">
                        <DialogClose
                            render={<Button type="button" variant="outline" size="sm">Batal</Button>}
                        />
                        <Button
                            type="submit"
                            size="sm"
                            disabled={processing || totalBaseUnitsReceiving <= 0}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white"
                        >
                            {processing ? 'Memproses LPB...' : 'Konfirmasi Penerimaan Barang'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}

export default ReceiveGoodsDialog

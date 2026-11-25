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
import { Badge } from '@/components/ui/badge'
import { PackageCheck, ArrowRight, TrendingUp, AlertCircle, Info } from 'lucide-react'
import PurchaseOrderController from '@/actions/App/Http/Controllers/PurchaseOrderController'

export interface ReceiveItemInput {
    id: number
    product_id: number
    product_name: string
    barcode: string
    current_stock: number
    current_buy_price: number | string
    quantity_ordered: number
    quantity_received: number
    remaining_quantity: number
    unit_cost: number | string
    raw_expired_date?: string | null
}

interface ReceiveGoodsDialogProps {
    poId: number
    poNumber: string
    items: ReceiveItemInput[]
    open: boolean
    onOpenChange: (open: boolean) => void
}

const formatRupiah = (val: number | string) => {
    const num = Number(val) || 0
    return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0,
    }).format(num)
}

export function ReceiveGoodsDialog({
    poId,
    poNumber,
    items,
    open,
    onOpenChange,
}: ReceiveGoodsDialogProps) {
    // Hanya item yang masih memiliki sisa
    const pendingItems = React.useMemo(() => {
        return items.filter((it) => it.remaining_quantity > 0)
    }, [items])

    // State form: receive_now_qty dan expired_date per item
    const [receiveForm, setReceiveForm] = React.useState<Record<number, { qty: number; expired_date: string }>>({})
    const [processing, setProcessing] = React.useState(false)
    const [errorMsg, setErrorMsg] = React.useState<string | null>(null)

    React.useEffect(() => {
        if (open) {
            const initial: Record<number, { qty: number; expired_date: string }> = {}
            pendingItems.forEach((it) => {
                initial[it.id] = {
                    qty: it.remaining_quantity, // default terisi sisa pesanan
                    expired_date: it.raw_expired_date || '',
                }
            })
            setReceiveForm(initial)
            setErrorMsg(null)
        }
    }, [open, pendingItems])

    const handleQtyChange = (itemId: number, maxQty: number, val: string) => {
        const parsed = parseInt(val) || 0
        const clamped = Math.max(0, Math.min(maxQty, parsed))
        setReceiveForm((prev) => ({
            ...prev,
            [itemId]: {
                ...prev[itemId],
                qty: clamped,
            },
        }))
    }

    const handleDateChange = (itemId: number, dateVal: string) => {
        setReceiveForm((prev) => ({
            ...prev,
            [itemId]: {
                ...prev[itemId],
                expired_date: dateVal,
            },
        }))
    }

    const handleFillAllMax = () => {
        const updated: Record<number, { qty: number; expired_date: string }> = {}
        pendingItems.forEach((it) => {
            updated[it.id] = {
                qty: it.remaining_quantity,
                expired_date: receiveForm[it.id]?.expired_date || it.raw_expired_date || '',
            }
        })
        setReceiveForm(updated)
    }

    const handleResetAllZero = () => {
        const updated: Record<number, { qty: number; expired_date: string }> = {}
        pendingItems.forEach((it) => {
            updated[it.id] = {
                qty: 0,
                expired_date: receiveForm[it.id]?.expired_date || it.raw_expired_date || '',
            }
        })
        setReceiveForm(updated)
    }

    // Hitung total unit yang sedang diterima saat ini
    const totalUnitsReceiving = Object.values(receiveForm).reduce((acc, curr) => acc + (curr.qty || 0), 0)

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        setErrorMsg(null)

        if (totalUnitsReceiving <= 0) {
            setErrorMsg('Harap masukkan minimal 1 barang dengan jumlah terima > 0.')
            return
        }

        const payloadItems = pendingItems.map((it) => ({
            purchase_order_item_id: it.id,
            receive_now_qty: receiveForm[it.id]?.qty || 0,
            expired_date: receiveForm[it.id]?.expired_date || null,
        }))

        setProcessing(true)
        router.post(
            PurchaseOrderController.receive.url(poId),
            { items: payloadItems },
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
            <DialogContent className="sm:max-w-3xl md:max-w-4xl lg:max-w-5xl max-h-[85vh] flex flex-col p-0 overflow-hidden">
                <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden">
                    <DialogHeader className="px-6 pt-5 pb-4 border-b shrink-0">
                        <DialogTitle className="flex items-center gap-2 text-lg">
                            <PackageCheck className="h-6 w-6 text-emerald-600" />
                            Penerimaan Barang PO: {poNumber}
                        </DialogTitle>
                        <DialogDescription className="text-xs">
                            Konfirmasi barang yang tiba di gudang. Sistem akan otomatis menambah stok dan mengkalkulasi{' '}
                            <strong>Weighted Average Buy Price (Harga Beli Rata-Rata Tertimbang)</strong>.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="flex-1 overflow-y-auto overflow-x-hidden px-6 py-4 space-y-4">

                    {errorMsg && (
                        <div className="flex items-center gap-2 rounded-md bg-destructive/10 p-3 text-xs text-destructive font-medium border border-destructive/20">
                            <AlertCircle className="h-4 w-4 shrink-0" />
                            <span>{errorMsg}</span>
                        </div>
                    )}

                    <div className="flex items-center justify-between text-xs bg-muted/50 p-2.5 rounded-lg border">
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                            <Info className="h-4 w-4 text-primary" />
                            <span>
                                Total <strong>{pendingItems.length}</strong> produk menunggu penerimaan.
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
                        <table className="w-full min-w-[760px] table-fixed text-xs text-left">
                            <thead className="bg-muted/70 text-muted-foreground font-semibold border-b">
                                <tr>
                                    <th className="p-3 w-[26%]">Produk & Barcode</th>
                                    <th className="p-3 w-[14%] text-center">Status Pesanan</th>
                                    <th className="p-3 w-[18%]">Terima Sekarang</th>
                                    <th className="p-3 w-[18%]">Tgl Expired</th>
                                    <th className="p-3 w-[24%]">Simulasi Harga Beli Baru</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {pendingItems.map((item) => {
                                    const nowQty = receiveForm[item.id]?.qty || 0
                                    const expDate = receiveForm[item.id]?.expired_date || ''

                                    const oldStock = Math.max(0, Number(item.current_stock))
                                    const oldCost = Number(item.current_buy_price)
                                    const incomingQty = nowQty
                                    const incomingCost = Number(item.unit_cost)

                                    const totalQty = oldStock + incomingQty
                                    const newWeightedCost = totalQty > 0
                                        ? Math.round((((oldStock * oldCost) + (incomingQty * incomingCost)) / totalQty) * 100) / 100
                                        : incomingCost

                                    const isPriceDifferent = Math.abs(newWeightedCost - oldCost) >= 0.01

                                    return (
                                        <tr key={item.id} className="hover:bg-muted/30 transition-colors">
                                            <td className="p-3 align-top">
                                                <div className="font-medium text-foreground text-sm">
                                                    {item.product_name}
                                                </div>
                                                <span className="font-mono text-[11px] text-muted-foreground">
                                                    {item.barcode}
                                                </span>
                                                <div className="text-[11px] text-muted-foreground mt-1">
                                                    Harga PO: <strong>{formatRupiah(item.unit_cost)}</strong>
                                                </div>
                                            </td>

                                            <td className="p-3 align-top text-center">
                                                <div className="space-y-1">
                                                    <Badge variant="outline" className="font-mono text-xs">
                                                        Dipesan: {item.quantity_ordered}
                                                    </Badge>
                                                    <div className="text-[11px] text-muted-foreground">
                                                        Sudah datang: {item.quantity_received}
                                                    </div>
                                                    <div className="text-xs font-semibold text-primary">
                                                        Sisa: {item.remaining_quantity}
                                                    </div>
                                                </div>
                                            </td>

                                            <td className="p-3 align-top">
                                                <div className="space-y-1">
                                                    <Input
                                                        type="number"
                                                        min={0}
                                                        max={item.remaining_quantity}
                                                        value={nowQty}
                                                        onChange={(e) =>
                                                            handleQtyChange(item.id, item.remaining_quantity, e.target.value)
                                                        }
                                                        className="font-mono text-sm font-semibold h-9"
                                                    />
                                                    <span className="text-[10px] text-muted-foreground block">
                                                        Maks: {item.remaining_quantity} unit
                                                    </span>
                                                </div>
                                            </td>

                                            <td className="p-3 align-top">
                                                <Input
                                                    type="date"
                                                    value={expDate}
                                                    onChange={(e) => handleDateChange(item.id, e.target.value)}
                                                    className="text-xs h-9"
                                                />
                                            </td>

                                            <td className="p-3 align-top">
                                                {nowQty > 0 ? (
                                                    <div className="p-2 rounded-md bg-muted/40 border space-y-1 text-xs">
                                                        <div className="flex items-center justify-between text-muted-foreground text-[11px]">
                                                            <span>Stok: {oldStock} ➔ {totalQty}</span>
                                                        </div>
                                                        <div className="flex items-center gap-1.5 font-medium">
                                                            <span className="text-muted-foreground line-through text-[11px]">
                                                                {formatRupiah(oldCost)}
                                                            </span>
                                                            <ArrowRight className="h-3 w-3 text-muted-foreground" />
                                                            <span className="text-emerald-600 font-bold">
                                                                {formatRupiah(newWeightedCost)}
                                                            </span>
                                                        </div>
                                                        {isPriceDifferent && (
                                                            <span className="text-[10px] font-mono text-muted-foreground block">
                                                                {newWeightedCost > oldCost ? '▲ Naik' : '▼ Turun'} (Rata-rata Tertimbang)
                                                            </span>
                                                        )}
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

                    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs">
                        <div>
                            <span className="font-semibold text-foreground block">
                                Total Pengiriman Sekarang: {totalUnitsReceiving} Unit
                            </span>
                            <span className="text-muted-foreground">
                                Status PO akan otomatis diperbarui menjadi Selesai jika seluruh barang telah diterima penuh.
                            </span>
                        </div>
                    </div>

                    </div>

                    <DialogFooter className="px-6 py-3 border-t bg-muted/20 shrink-0">
                        <DialogClose
                            render={<Button type="button" variant="outline" size="sm">Batal</Button>}
                        />
                        <Button
                            type="submit"
                            size="sm"
                            disabled={processing || totalUnitsReceiving <= 0}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white"
                        >
                            {processing ? 'Memproses Penerimaan...' : `Konfirmasi Terima ${totalUnitsReceiving} Barang`}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}
export default ReceiveGoodsDialog

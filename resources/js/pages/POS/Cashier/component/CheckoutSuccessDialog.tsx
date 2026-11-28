import React from 'react'
import { CheckCircle2, Printer, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import type { PosReceiptData } from '@/types'
import { formatRupiah } from './posUtils'

interface CheckoutSuccessDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    receipt: PosReceiptData | null
    paperWidth: '58mm' | '80mm'
    onPaperWidthChange: (width: '58mm' | '80mm') => void
    onPrint: () => void
    onNewTransaction: () => void
}

export function CheckoutSuccessDialog({
    open,
    onOpenChange,
    receipt,
    paperWidth,
    onPaperWidthChange,
    onPrint,
    onNewTransaction,
}: CheckoutSuccessDialogProps) {
    if (!receipt) return null

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-md max-h-[85vh] flex flex-col p-0 gap-0 overflow-hidden">
                <DialogHeader className="p-6 pb-4 border-b shrink-0">
                    <div className="flex items-center gap-2.5">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                            <CheckCircle2 className="h-6 w-6" />
                        </div>
                        <div>
                            <DialogTitle>Transaksi Berhasil</DialogTitle>
                            <DialogDescription className="font-mono text-xs mt-0.5">
                                {receipt.invoice_number}
                            </DialogDescription>
                        </div>
                    </div>
                </DialogHeader>

                <div className="flex-1 overflow-y-auto overflow-x-hidden p-6 space-y-4">
                    <div className="rounded-xl border bg-muted/30 p-4 space-y-2 text-sm">
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Total Tagihan</span>
                            <span className="font-mono font-semibold">{formatRupiah(receipt.grand_total)}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Total Bayar</span>
                            <span className="font-mono font-semibold">{formatRupiah(receipt.paid_amount)}</span>
                        </div>
                        <div className="flex justify-between border-t pt-2">
                            <span className="font-semibold text-foreground">Kembalian</span>
                            <span className="font-mono text-lg font-bold text-emerald-600 dark:text-emerald-400">
                                {formatRupiah(receipt.change_amount)}
                            </span>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <p className="text-xs font-medium text-muted-foreground">Ukuran Kertas Struk Thermal:</p>
                        <div className="grid grid-cols-2 gap-2">
                            <Button
                                type="button"
                                variant={paperWidth === '58mm' ? 'default' : 'outline'}
                                size="sm"
                                onClick={() => onPaperWidthChange('58mm')}
                                className="cursor-pointer"
                            >
                                Thermal 58mm
                            </Button>
                            <Button
                                type="button"
                                variant={paperWidth === '80mm' ? 'default' : 'outline'}
                                size="sm"
                                onClick={() => onPaperWidthChange('80mm')}
                                className="cursor-pointer"
                            >
                                Thermal 80mm
                            </Button>
                        </div>
                    </div>
                </div>

                <DialogFooter className="p-6 pt-4 border-t shrink-0 flex items-center justify-end gap-2 bg-muted/20">
                    <Button
                        type="button"
                        variant="outline"
                        onClick={onPrint}
                        className="gap-1.5 cursor-pointer"
                    >
                        <Printer className="h-4 w-4" />
                        Cetak Struk
                    </Button>
                    <Button
                        type="button"
                        onClick={onNewTransaction}
                        className="gap-1.5 cursor-pointer"
                    >
                        <RotateCcw className="h-4 w-4" />
                        Transaksi Baru
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

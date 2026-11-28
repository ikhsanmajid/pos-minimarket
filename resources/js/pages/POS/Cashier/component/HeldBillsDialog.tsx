import React from 'react'
import { Clock, Play, Trash2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import type { PosHeldTransaction } from '@/types'
import { formatRupiah } from './posUtils'

interface HeldBillsDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    heldTransactions: PosHeldTransaction[]
    onResume: (held: PosHeldTransaction) => void
    onDelete: (held: PosHeldTransaction) => void
    isBusy?: boolean
}

export function HeldBillsDialog({
    open,
    onOpenChange,
    heldTransactions,
    onResume,
    onDelete,
    isBusy = false,
}: HeldBillsDialogProps) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="w-[calc(100%-2rem)] sm:max-w-2xl max-h-[85vh] flex flex-col p-0 gap-0 overflow-hidden">
                <DialogHeader className="p-6 pb-4 border-b shrink-0">
                    <DialogTitle>Transaksi Tertahan (Hold Bill)</DialogTitle>
                    <DialogDescription>
                        Pilih transaksi tertahan untuk dimuat ulang ke keranjang atau dihapus.
                    </DialogDescription>
                </DialogHeader>

                <div className="flex-1 overflow-y-auto overflow-x-hidden p-6 space-y-3">
                    {heldTransactions.length === 0 ? (
                        <div className="py-12 text-center text-sm text-muted-foreground">
                            Belum ada transaksi yang ditahan pada shift ini.
                        </div>
                    ) : (
                        heldTransactions.map((held) => (
                            <div
                                key={held.id}
                                className="flex flex-col gap-3 rounded-lg border bg-card p-4 sm:flex-row sm:items-center sm:justify-between"
                            >
                                <div className="space-y-1 min-w-0">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <span className="font-mono text-xs font-semibold text-primary">
                                            {held.hold_code}
                                        </span>
                                        {held.label && (
                                            <span className="text-sm font-semibold text-foreground truncate">
                                                {held.label}
                                            </span>
                                        )}
                                        <Badge variant="secondary" className="text-[11px]">
                                            {held.items_count} item
                                        </Badge>
                                    </div>
                                    <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                                        <span className="inline-flex items-center gap-1">
                                            <Clock className="h-3 w-3" /> {held.created_at}
                                        </span>
                                        {held.customer_name && <span>Pelanggan: {held.customer_name}</span>}
                                        <span className="font-mono font-semibold text-foreground">
                                            Est. {formatRupiah(held.estimated_total)}
                                        </span>
                                    </div>
                                </div>

                                <div className="flex items-center gap-2 shrink-0">
                                    <Button
                                        type="button"
                                        size="sm"
                                        disabled={isBusy}
                                        onClick={() => {
                                            onResume(held)
                                            onOpenChange(false)
                                        }}
                                        className="gap-1.5 cursor-pointer"
                                    >
                                        <Play className="h-3.5 w-3.5" />
                                        Muat Ulang
                                    </Button>
                                    <Button
                                        type="button"
                                        size="sm"
                                        variant="outline"
                                        disabled={isBusy}
                                        onClick={() => onDelete(held)}
                                        className="text-destructive hover:text-destructive cursor-pointer"
                                        title="Hapus Hold Bill"
                                    >
                                        <Trash2 className="h-3.5 w-3.5" />
                                    </Button>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                <DialogFooter className="p-6 pt-4 border-t shrink-0 flex items-center justify-end gap-2 bg-muted/20">
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                        className="cursor-pointer"
                    >
                        Tutup
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

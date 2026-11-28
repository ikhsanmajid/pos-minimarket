import React, { useEffect, useState } from 'react'
import { useForm } from '@inertiajs/react'
import { AlertTriangle, KeyRound } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import transactions from '@/routes/pos/transactions'

interface VoidTransactionDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    transactionId: number
    invoiceNumber: string
}

export function VoidTransactionDialog({
    open,
    onOpenChange,
    transactionId,
    invoiceNumber,
}: VoidTransactionDialogProps) {
    const form = useForm({
        reason: '',
        supervisor_pin: '',
    })
    const formErrors = form.errors as Record<string, string | undefined>
    const [submittedOnce, setSubmittedOnce] = useState(false)

    useEffect(() => {
        if (open) {
            form.reset()
            form.clearErrors()
            setSubmittedOnce(false)
        }
    }, [open])

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        setSubmittedOnce(true)
        form.post(transactions.void.url({ transaction: transactionId }), {
            preserveScroll: true,
            onSuccess: () => {
                onOpenChange(false)
            },
        })
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-lg max-h-[85vh] flex flex-col p-0 gap-0 overflow-hidden">
                <DialogHeader className="p-6 pb-4 border-b shrink-0">
                    <div className="flex items-center gap-2.5">
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-rose-500/15 text-rose-600 dark:text-rose-400">
                            <AlertTriangle className="h-5 w-5" />
                        </div>
                        <div>
                            <DialogTitle>Void Transaksi {invoiceNumber}</DialogTitle>
                            <DialogDescription>
                                Pembatalan transaksi akan mengembalikan stok produk dan membalikkan saldo akun keuangan asal.
                            </DialogDescription>
                        </div>
                    </div>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
                    <div className="flex-1 overflow-y-auto overflow-x-hidden p-6 space-y-4">
                        <div className="space-y-1.5">
                            <Label htmlFor="void-reason">Alasan Pembatalan (Wajib)</Label>
                            <textarea
                                id="void-reason"
                                rows={3}
                                value={form.data.reason}
                                onChange={(e) => form.setData('reason', e.target.value)}
                                placeholder="Contoh: Salah input item oleh kasir..."
                                disabled={form.processing}
                                className="flex min-h-[76px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30"
                            />
                            {(submittedOnce || form.errors.reason) && form.errors.reason && (
                                <p className="text-xs font-medium text-destructive">{form.errors.reason}</p>
                            )}
                        </div>

                        <div className="space-y-1.5">
                            <Label htmlFor="void-pin" className="flex items-center gap-1.5">
                                <KeyRound className="h-3.5 w-3.5 text-muted-foreground" />
                                PIN Supervisor / Admin (Wajib)
                            </Label>
                            <Input
                                id="void-pin"
                                type="password"
                                inputMode="numeric"
                                autoComplete="off"
                                value={form.data.supervisor_pin}
                                onChange={(e) => form.setData('supervisor_pin', e.target.value)}
                                placeholder="Masukkan PIN Supervisor / Admin..."
                                disabled={form.processing}
                                className="h-10 font-mono tracking-[0.3em]"
                            />
                            {form.errors.supervisor_pin && (
                                <p className="text-xs font-medium text-destructive">
                                    {form.errors.supervisor_pin}
                                </p>
                            )}
                            {formErrors.status && (
                                <p className="text-xs font-medium text-destructive">{formErrors.status}</p>
                            )}
                        </div>
                    </div>

                    <DialogFooter className="p-6 pt-4 border-t shrink-0 flex items-center justify-end gap-2 bg-muted/20">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => onOpenChange(false)}
                            disabled={form.processing}
                            className="cursor-pointer"
                        >
                            Batal
                        </Button>
                        <Button
                            type="submit"
                            variant="destructive"
                            disabled={form.processing}
                            className="cursor-pointer"
                        >
                            {form.processing ? 'Memproses Void...' : 'Konfirmasi Void'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}

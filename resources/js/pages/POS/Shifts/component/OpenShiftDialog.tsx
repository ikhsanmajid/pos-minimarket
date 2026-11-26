import React from 'react'
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
import { Loader2, PlayCircle, Banknote, Monitor } from 'lucide-react'
import CashierShiftController from '@/actions/App/Http/Controllers/CashierShiftController'
import { formatRupiah } from './shiftUtils'

interface OpenShiftDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
}

const REGISTER_PRESETS = ['Kasir 1', 'Kasir 2', 'Kasir 3']
const CASH_PRESETS = [200000, 300000, 500000, 1000000]

export function OpenShiftDialog({ open, onOpenChange }: OpenShiftDialogProps) {
    const { data, setData, post, processing, errors, reset, clearErrors } = useForm({
        register_name: 'Kasir 1',
        starting_cash: '500000',
    })

    const handleClose = () => {
        if (!processing) {
            clearErrors()
            onOpenChange(false)
        }
    }

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        post(CashierShiftController.open.url(), {
            preserveScroll: true,
            onSuccess: () => {
                reset()
                onOpenChange(false)
            },
        })
    }

    const numericCash = Number(data.starting_cash || 0)

    return (
        <Dialog open={open} onOpenChange={(val) => !val && handleClose()}>
            <DialogContent className="max-w-lg max-h-[85vh] flex flex-col p-0 gap-0 overflow-hidden">
                <DialogHeader className="p-6 pb-4 border-b shrink-0">
                    <DialogTitle className="flex items-center gap-2">
                        <PlayCircle className="h-5 w-5 text-primary" />
                        Buka Sesi Shift Kasir
                    </DialogTitle>
                    <DialogDescription>
                        Pastikan uang modal awal di laci kasir telah dihitung sebelum memulai sesi shift baru.
                    </DialogDescription>
                </DialogHeader>

                <form id="open-shift-form" onSubmit={handleSubmit} className="flex-1 overflow-y-auto overflow-x-hidden p-6 space-y-5">
                    {(errors as Record<string, string>).shift && (
                        <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
                            {(errors as Record<string, string>).shift}
                        </div>
                    )}

                    <div className="space-y-2">
                        <Label htmlFor="register_name" className="flex items-center gap-1.5">
                            <Monitor className="h-3.5 w-3.5 text-muted-foreground" />
                            Nama / Nomor Mesin Kasir <span className="text-destructive">*</span>
                        </Label>
                        <Input
                            id="register_name"
                            value={data.register_name}
                            onChange={(e) => setData('register_name', e.target.value)}
                            placeholder="Contoh: Kasir 1"
                            required
                        />
                        <div className="flex flex-wrap gap-1.5 pt-1">
                            {REGISTER_PRESETS.map((preset) => (
                                <button
                                    key={preset}
                                    type="button"
                                    onClick={() => setData('register_name', preset)}
                                    className={`rounded-md border px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer ${
                                        data.register_name === preset
                                            ? 'border-primary bg-primary/10 text-primary'
                                            : 'border-border bg-muted/40 text-muted-foreground hover:bg-muted'
                                    }`}
                                >
                                    {preset}
                                </button>
                            ))}
                        </div>
                        {errors.register_name && (
                            <p className="text-xs text-destructive">{errors.register_name}</p>
                        )}
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="starting_cash" className="flex items-center gap-1.5">
                            <Banknote className="h-3.5 w-3.5 text-muted-foreground" />
                            Modal Awal Laci (Rp) <span className="text-destructive">*</span>
                        </Label>
                        <Input
                            id="starting_cash"
                            type="number"
                            min="0"
                            step="100"
                            value={data.starting_cash}
                            onChange={(e) => setData('starting_cash', e.target.value)}
                            placeholder="500000"
                            className="font-mono text-base font-semibold"
                            required
                        />
                        <div className="flex flex-wrap gap-1.5 pt-1">
                            {CASH_PRESETS.map((preset) => (
                                <button
                                    key={preset}
                                    type="button"
                                    onClick={() => setData('starting_cash', String(preset))}
                                    className="rounded-md border border-border bg-muted/40 px-2.5 py-1 font-mono text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground cursor-pointer"
                                >
                                    {formatRupiah(preset)}
                                </button>
                            ))}
                        </div>
                        <p className="text-xs text-muted-foreground">
                            Nominal terbaca: <span className="font-mono font-semibold text-foreground">{formatRupiah(numericCash)}</span>
                        </p>
                        {errors.starting_cash && (
                            <p className="text-xs text-destructive">{errors.starting_cash}</p>
                        )}
                    </div>
                </form>

                <DialogFooter className="p-6 pt-4 border-t shrink-0 flex items-center justify-end gap-2 bg-muted/20">
                    <Button type="button" variant="outline" onClick={handleClose} disabled={processing}>
                        Batal
                    </Button>
                    <Button type="submit" form="open-shift-form" disabled={processing} className="gap-2">
                        {processing ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlayCircle className="h-4 w-4" />}
                        Mulai Shift
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

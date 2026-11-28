import React, { useEffect, useMemo } from 'react'
import { Link, useForm } from '@inertiajs/react'
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
import { Badge } from '@/components/ui/badge'
import { Loader2, PlayCircle, Banknote, Monitor, AlertCircle } from 'lucide-react'
import CashierShiftController from '@/actions/App/Http/Controllers/CashierShiftController'
import cashRegistersRoutes from '@/routes/pos/cash-registers'
import { formatRupiah } from './shiftUtils'

export interface CashRegisterOption {
    id: number
    code: string
    name: string
    location: string | null
    is_in_use: boolean
    active_shift_number: string | null
    active_cashier_name: string | null
}

interface OpenShiftDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    cashRegisters: CashRegisterOption[]
    canManageRegisters?: boolean
}

const CASH_PRESETS = [200000, 300000, 500000, 1000000]

export function OpenShiftDialog({
    open,
    onOpenChange,
    cashRegisters,
    canManageRegisters = false,
}: OpenShiftDialogProps) {
    const firstAvailable = useMemo(
        () => cashRegisters.find((register) => !register.is_in_use) ?? null,
        [cashRegisters]
    )

    const { data, setData, post, processing, errors, reset, clearErrors } = useForm({
        cash_register_id: firstAvailable ? String(firstAvailable.id) : '',
        register_name: firstAvailable?.name ?? '',
        starting_cash: '500000',
    })

    useEffect(() => {
        if (!open) return
        if (cashRegisters.length === 0) {
            setData('cash_register_id', '')
            if (!data.register_name) {
                setData('register_name', 'Kasir 1')
            }
            return
        }

        const currentSelected = cashRegisters.find((r) => String(r.id) === data.cash_register_id)
        if (!currentSelected || currentSelected.is_in_use) {
            setData('cash_register_id', firstAvailable ? String(firstAvailable.id) : '')
            setData('register_name', firstAvailable?.name ?? '')
        }
    }, [open, cashRegisters, firstAvailable])

    const handleClose = () => {
        if (!processing) {
            clearErrors()
            onOpenChange(false)
        }
    }

    const handleSelectRegister = (register: CashRegisterOption) => {
        if (register.is_in_use) return
        setData('cash_register_id', String(register.id))
        setData('register_name', register.name)
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
    const hasManagedRegisters = cashRegisters.length > 0
    const allRegistersOccupied = hasManagedRegisters && !firstAvailable
    const registerError =
        (errors as Record<string, string>).cash_register_id ?? errors.register_name

    return (
        <Dialog open={open} onOpenChange={(val) => !val && handleClose()}>
            <DialogContent className="max-w-lg max-h-[85vh] flex flex-col p-0 gap-0 overflow-hidden">
                <DialogHeader className="p-6 pb-4 border-b shrink-0">
                    <DialogTitle className="flex items-center gap-2">
                        <PlayCircle className="h-5 w-5 text-primary" />
                        Buka Sesi Shift Kasir
                    </DialogTitle>
                    <DialogDescription>
                        Pilih kasir fisik yang tersedia dan pastikan uang modal awal di laci telah dihitung sebelum memulai shift.
                    </DialogDescription>
                </DialogHeader>

                <form
                    id="open-shift-form"
                    onSubmit={handleSubmit}
                    className="flex-1 overflow-y-auto overflow-x-hidden p-6 space-y-5"
                >
                    {(errors as Record<string, string>).shift && (
                        <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
                            {(errors as Record<string, string>).shift}
                        </div>
                    )}

                    <div className="space-y-2">
                        <div className="flex items-center justify-between gap-2">
                            <Label htmlFor="register_name" className="flex items-center gap-1.5">
                                <Monitor className="h-3.5 w-3.5 text-muted-foreground" />
                                Pilih Kasir Fisik <span className="text-destructive">*</span>
                            </Label>
                            {canManageRegisters && (
                                <Link
                                    href={cashRegistersRoutes.index.url()}
                                    className="text-xs font-medium text-primary hover:underline"
                                >
                                    Kelola Kasir Fisik
                                </Link>
                            )}
                        </div>

                        {hasManagedRegisters ? (
                            <div className="space-y-2">
                                {allRegistersOccupied && (
                                    <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
                                        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
                                        <span>
                                            Semua kasir fisik aktif sedang digunakan oleh shift lain. Tutup salah satu shift atau tambahkan kasir fisik baru.
                                        </span>
                                    </div>
                                )}
                                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                                    {cashRegisters.map((register) => {
                                        const isSelected = String(register.id) === data.cash_register_id
                                        return (
                                            <button
                                                key={register.id}
                                                type="button"
                                                disabled={register.is_in_use || processing}
                                                onClick={() => handleSelectRegister(register)}
                                                className={`flex flex-col items-start gap-1 rounded-lg border p-3 text-left transition-colors ${
                                                    register.is_in_use
                                                        ? 'cursor-not-allowed border-border/60 bg-muted/40 opacity-65'
                                                        : isSelected
                                                            ? 'cursor-pointer border-primary bg-primary/10 ring-1 ring-primary'
                                                            : 'cursor-pointer border-border bg-card hover:bg-muted/50'
                                                }`}
                                            >
                                                <div className="flex w-full items-center justify-between gap-2">
                                                    <span className="text-sm font-semibold text-foreground truncate">
                                                        {register.name}
                                                    </span>
                                                    <Badge
                                                        variant={register.is_in_use ? 'secondary' : 'success'}
                                                        className="text-[10px] shrink-0"
                                                    >
                                                        {register.is_in_use ? 'Dipakai' : 'Tersedia'}
                                                    </Badge>
                                                </div>
                                                <span className="font-mono text-[11px] text-muted-foreground">
                                                    {register.code}
                                                    {register.location ? ` • ${register.location}` : ''}
                                                </span>
                                                {register.is_in_use && register.active_cashier_name && (
                                                    <span className="text-[11px] text-amber-700 dark:text-amber-400 truncate w-full">
                                                        Oleh {register.active_cashier_name} ({register.active_shift_number})
                                                    </span>
                                                )}
                                            </button>
                                        )
                                    })}
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                <Input
                                    id="register_name"
                                    value={data.register_name}
                                    onChange={(e) => setData('register_name', e.target.value)}
                                    placeholder="Contoh: Kasir 1"
                                    required
                                />
                                <p className="text-xs text-muted-foreground">
                                    Belum ada daftar kasir fisik aktif yang terdaftar. Anda dapat mengisi nama kasir secara manual.
                                </p>
                            </div>
                        )}

                        {registerError && (
                            <p className="text-xs text-destructive">{registerError}</p>
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
                            Nominal terbaca:{' '}
                            <span className="font-mono font-semibold text-foreground">
                                {formatRupiah(numericCash)}
                            </span>
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
                    <Button
                        type="submit"
                        form="open-shift-form"
                        disabled={processing || allRegistersOccupied || (hasManagedRegisters && !data.cash_register_id)}
                        className="gap-2"
                    >
                        {processing ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlayCircle className="h-4 w-4" />}
                        Mulai Shift
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

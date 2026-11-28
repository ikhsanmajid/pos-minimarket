import React, { useEffect, useRef, useState } from 'react'
import { KeyRound, ShieldAlert } from 'lucide-react'
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

interface SupervisorPinDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    title?: string
    description?: string
    confirmLabel?: string
    error?: string | null
    isSubmitting?: boolean
    onConfirm: (pin: string) => void
}

export function SupervisorPinDialog({
    open,
    onOpenChange,
    title = 'Otorisasi PIN Supervisor / Admin',
    description = 'Masukkan PIN milik Supervisor atau Admin yang aktif untuk melanjutkan tindakan ini.',
    confirmLabel = 'Verifikasi & Lanjutkan',
    error = null,
    isSubmitting = false,
    onConfirm,
}: SupervisorPinDialogProps) {
    const [pin, setPin] = useState('')
    const [localError, setLocalError] = useState<string | null>(null)
    const inputRef = useRef<HTMLInputElement>(null)

    useEffect(() => {
        if (open) {
            setPin('')
            setLocalError(null)
            const timer = window.setTimeout(() => {
                inputRef.current?.focus()
            }, 80)
            return () => window.clearTimeout(timer)
        }
    }, [open])

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        const trimmed = pin.trim()
        if (!trimmed) {
            setLocalError('PIN Supervisor / Admin wajib diisi.')
            inputRef.current?.focus()
            return
        }
        setLocalError(null)
        onConfirm(trimmed)
    }

    const activeError = error || localError

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-md max-h-[85vh] flex flex-col p-0 gap-0 overflow-hidden">
                <DialogHeader className="p-6 pb-4 border-b shrink-0">
                    <div className="flex items-center gap-2.5">
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-500/15 text-amber-600 dark:text-amber-400">
                            <ShieldAlert className="h-5 w-5" />
                        </div>
                        <div>
                            <DialogTitle>{title}</DialogTitle>
                            <DialogDescription className="mt-0.5">{description}</DialogDescription>
                        </div>
                    </div>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
                    <div className="flex-1 overflow-y-auto overflow-x-hidden p-6 space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="supervisor-pin-input" className="flex items-center gap-1.5">
                                <KeyRound className="h-3.5 w-3.5 text-muted-foreground" />
                                PIN Supervisor / Admin
                            </Label>
                            <Input
                                ref={inputRef}
                                id="supervisor-pin-input"
                                type="password"
                                inputMode="numeric"
                                autoComplete="off"
                                placeholder="Masukkan PIN..."
                                value={pin}
                                onChange={(e) => {
                                    setPin(e.target.value)
                                    if (localError) setLocalError(null)
                                }}
                                disabled={isSubmitting}
                                className="h-11 text-center font-mono text-lg tracking-[0.35em]"
                            />
                            {activeError && (
                                <p className="text-xs font-medium text-destructive">{activeError}</p>
                            )}
                        </div>
                    </div>

                    <DialogFooter className="p-6 pt-4 border-t shrink-0 flex items-center justify-end gap-2 bg-muted/20">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => onOpenChange(false)}
                            disabled={isSubmitting}
                            className="cursor-pointer"
                        >
                            Batal
                        </Button>
                        <Button type="submit" disabled={isSubmitting} className="cursor-pointer">
                            {isSubmitting ? 'Memverifikasi...' : confirmLabel}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}

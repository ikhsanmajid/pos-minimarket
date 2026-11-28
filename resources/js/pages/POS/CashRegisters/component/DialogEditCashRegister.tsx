import * as React from 'react'
import { useForm } from '@inertiajs/react'
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
import { Field, FieldError, FieldGroup } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Monitor } from 'lucide-react'
import type { CashRegisterRow } from '../CashRegister'

interface DialogEditCashRegisterProps {
    cashRegister: CashRegisterRow
    updateUrl: string
    open: boolean
    onOpenChange: (open: boolean) => void
}

export function DialogEditCashRegister({
    cashRegister,
    updateUrl,
    open,
    onOpenChange,
}: DialogEditCashRegisterProps) {
    const { data, setData, patch, processing, errors, clearErrors } = useForm({
        code: cashRegister.code,
        name: cashRegister.name,
        location: cashRegister.location ?? '',
        description: cashRegister.description ?? '',
        is_active: cashRegister.is_active,
    })

    React.useEffect(() => {
        if (open) {
            clearErrors()
            setData({
                code: cashRegister.code,
                name: cashRegister.name,
                location: cashRegister.location ?? '',
                description: cashRegister.description ?? '',
                is_active: cashRegister.is_active,
            })
        }
    }, [open, cashRegister])

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        patch(updateUrl, {
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
                    <DialogTitle className="flex items-center gap-2">
                        <Monitor className="h-5 w-5 text-primary" />
                        Edit Kasir Fisik
                    </DialogTitle>
                    <DialogDescription>
                        Perbarui identitas, lokasi, atau status operasional kasir fisik{' '}
                        <strong className="text-foreground">{cashRegister.name}</strong>.
                    </DialogDescription>
                </DialogHeader>

                <form
                    id={`edit-cash-register-form-${cashRegister.id}`}
                    onSubmit={handleSubmit}
                    className="flex-1 overflow-y-auto overflow-x-hidden p-6 space-y-4"
                >
                    <FieldGroup className="space-y-4">
                        <Field>
                            <Label htmlFor={`edit-register-code-${cashRegister.id}`}>
                                Kode Kasir <span className="text-destructive">*</span>
                            </Label>
                            <Input
                                id={`edit-register-code-${cashRegister.id}`}
                                placeholder="Contoh: KSR-01"
                                maxLength={20}
                                value={data.code}
                                onChange={(e) => setData('code', e.target.value.toUpperCase())}
                                className="font-mono uppercase"
                                aria-invalid={!!errors.code}
                                required
                            />
                            <FieldError>{errors.code}</FieldError>
                        </Field>

                        <Field>
                            <Label htmlFor={`edit-register-name-${cashRegister.id}`}>
                                Nama Kasir Fisik <span className="text-destructive">*</span>
                            </Label>
                            <Input
                                id={`edit-register-name-${cashRegister.id}`}
                                placeholder="Contoh: Kasir 1"
                                maxLength={50}
                                value={data.name}
                                onChange={(e) => setData('name', e.target.value)}
                                aria-invalid={!!errors.name}
                                required
                            />
                            <FieldError>{errors.name}</FieldError>
                        </Field>

                        <Field>
                            <Label htmlFor={`edit-register-location-${cashRegister.id}`}>Lokasi / Area (Opsional)</Label>
                            <Input
                                id={`edit-register-location-${cashRegister.id}`}
                                placeholder="Contoh: Meja Kasir Utama (Kiri)"
                                maxLength={100}
                                value={data.location}
                                onChange={(e) => setData('location', e.target.value)}
                                aria-invalid={!!errors.location}
                            />
                            <FieldError>{errors.location}</FieldError>
                        </Field>

                        <Field>
                            <Label htmlFor={`edit-register-description-${cashRegister.id}`}>
                                Catatan / Keterangan (Opsional)
                            </Label>
                            <Input
                                id={`edit-register-description-${cashRegister.id}`}
                                placeholder="Contoh: Printer thermal 80mm + scanner barcode"
                                maxLength={500}
                                value={data.description}
                                onChange={(e) => setData('description', e.target.value)}
                                aria-invalid={!!errors.description}
                            />
                            <FieldError>{errors.description}</FieldError>
                        </Field>

                        <div className="space-y-1.5">
                            <div className="flex items-center justify-between rounded-lg border p-3 bg-muted/20">
                                <div className="space-y-0.5">
                                    <Label htmlFor={`edit-register-is_active-${cashRegister.id}`} className="text-sm font-medium">
                                        Status Aktif
                                    </Label>
                                    <p className="text-xs text-muted-foreground">
                                        {cashRegister.is_in_use
                                            ? 'Tidak dapat dinonaktifkan saat shift masih berlangsung'
                                            : 'Kasir fisik aktif dapat dipilih saat membuka sesi shift baru'}
                                    </p>
                                </div>
                                <Switch
                                    id={`edit-register-is_active-${cashRegister.id}`}
                                    checked={data.is_active}
                                    disabled={cashRegister.is_in_use}
                                    onCheckedChange={(checked) => setData('is_active', checked)}
                                />
                            </div>
                            <FieldError>{errors.is_active}</FieldError>
                        </div>
                    </FieldGroup>
                </form>

                <DialogFooter className="p-6 pt-4 border-t shrink-0 flex items-center justify-end gap-2 bg-muted/20">
                    <DialogClose render={<Button type="button" variant="outline" disabled={processing} />}>
                        Batal
                    </DialogClose>
                    <Button
                        type="submit"
                        form={`edit-cash-register-form-${cashRegister.id}`}
                        disabled={processing}
                    >
                        {processing ? 'Menyimpan…' : 'Simpan Perubahan'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

export default DialogEditCashRegister

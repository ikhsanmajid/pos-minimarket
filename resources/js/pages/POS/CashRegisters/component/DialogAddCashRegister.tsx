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
    DialogTrigger,
} from '@/components/ui/dialog'
import { Field, FieldError, FieldGroup } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Monitor, Plus } from 'lucide-react'

interface DialogAddCashRegisterProps {
    storeUrl: string
}

export function DialogAddCashRegister({ storeUrl }: DialogAddCashRegisterProps) {
    const [open, setOpen] = React.useState(false)

    const { data, setData, post, processing, errors, reset, clearErrors } = useForm({
        code: '',
        name: '',
        location: '',
        description: '',
        is_active: true,
    })

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        post(storeUrl, {
            preserveScroll: true,
            onSuccess: () => {
                setOpen(false)
                reset()
            },
        })
    }

    const handleOpenChange = (nextOpen: boolean) => {
        setOpen(nextOpen)
        if (!nextOpen) {
            clearErrors()
            reset()
        }
    }

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogTrigger
                render={
                    <Button className="w-full sm:w-auto cursor-pointer">
                        <Plus className="h-4 w-4 mr-1.5" />
                        Tambah Kasir Fisik
                    </Button>
                }
            />

            <DialogContent className="max-w-lg max-h-[85vh] flex flex-col p-0 gap-0 overflow-hidden">
                <DialogHeader className="p-6 pb-4 border-b shrink-0">
                    <DialogTitle className="flex items-center gap-2">
                        <Monitor className="h-5 w-5 text-primary" />
                        Tambah Kasir Fisik
                    </DialogTitle>
                    <DialogDescription>
                        Daftarkan meja atau mesin kasir fisik baru yang dapat dipilih kasir saat membuka shift.
                    </DialogDescription>
                </DialogHeader>

                <form
                    id="create-cash-register-form"
                    onSubmit={handleSubmit}
                    className="flex-1 overflow-y-auto overflow-x-hidden p-6 space-y-4"
                >
                    <FieldGroup className="space-y-4">
                        <Field>
                            <Label htmlFor="create-register-code">
                                Kode Kasir <span className="text-destructive">*</span>
                            </Label>
                            <Input
                                id="create-register-code"
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
                            <Label htmlFor="create-register-name">
                                Nama Kasir Fisik <span className="text-destructive">*</span>
                            </Label>
                            <Input
                                id="create-register-name"
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
                            <Label htmlFor="create-register-location">Lokasi / Area (Opsional)</Label>
                            <Input
                                id="create-register-location"
                                placeholder="Contoh: Meja Kasir Utama (Kiri)"
                                maxLength={100}
                                value={data.location}
                                onChange={(e) => setData('location', e.target.value)}
                                aria-invalid={!!errors.location}
                            />
                            <FieldError>{errors.location}</FieldError>
                        </Field>

                        <Field>
                            <Label htmlFor="create-register-description">Catatan / Keterangan (Opsional)</Label>
                            <Input
                                id="create-register-description"
                                placeholder="Contoh: Printer thermal 80mm + scanner barcode"
                                maxLength={500}
                                value={data.description}
                                onChange={(e) => setData('description', e.target.value)}
                                aria-invalid={!!errors.description}
                            />
                            <FieldError>{errors.description}</FieldError>
                        </Field>

                        <div className="flex items-center justify-between rounded-lg border p-3 bg-muted/20">
                            <div className="space-y-0.5">
                                <Label htmlFor="create-register-is_active" className="text-sm font-medium">
                                    Status Aktif
                                </Label>
                                <p className="text-xs text-muted-foreground">
                                    Kasir fisik aktif dapat dipilih saat membuka sesi shift baru
                                </p>
                            </div>
                            <Switch
                                id="create-register-is_active"
                                checked={data.is_active}
                                onCheckedChange={(checked) => setData('is_active', checked)}
                            />
                        </div>
                    </FieldGroup>
                </form>

                <DialogFooter className="p-6 pt-4 border-t shrink-0 flex items-center justify-end gap-2 bg-muted/20">
                    <DialogClose render={<Button type="button" variant="outline" disabled={processing} />}>
                        Batal
                    </DialogClose>
                    <Button type="submit" form="create-cash-register-form" disabled={processing}>
                        {processing ? 'Menyimpan…' : 'Simpan Kasir'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

export default DialogAddCashRegister

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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Field, FieldError } from '@/components/ui/field'
import { Pencil } from 'lucide-react'
import type { CustomerRow } from '../Customer'

interface DialogEditCustomerProps {
    customer: CustomerRow
    updateUrl: string
    open: boolean
    onOpenChange: (open: boolean) => void
}

export function DialogEditCustomer({
    customer,
    updateUrl,
    open,
    onOpenChange,
}: DialogEditCustomerProps) {
    const { data, setData, patch, processing, errors, clearErrors } = useForm({
        member_code: customer.member_code ?? '',
        name: customer.name ?? '',
        phone: customer.phone ?? '',
        email: customer.email ?? '',
        address: customer.address ?? '',
        points: String(customer.points ?? 0),
        is_active: customer.is_active ?? true,
        notes: customer.notes ?? '',
    })

    React.useEffect(() => {
        if (open) {
            clearErrors()
            setData({
                member_code: customer.member_code ?? '',
                name: customer.name ?? '',
                phone: customer.phone ?? '',
                email: customer.email ?? '',
                address: customer.address ?? '',
                points: String(customer.points ?? 0),
                is_active: customer.is_active ?? true,
                notes: customer.notes ?? '',
            })
        }
    }, [open, customer])

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        patch(updateUrl, {
            preserveScroll: true,
            onSuccess: () => onOpenChange(false),
        })
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-xl max-h-[85vh] flex flex-col p-0 gap-0 overflow-hidden">
                <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden">
                    <DialogHeader className="p-6 pb-4 border-b shrink-0">
                        <DialogTitle className="flex items-center gap-2">
                            <Pencil className="h-4 w-4 text-primary" />
                            Edit Pelanggan: {customer.name}
                        </DialogTitle>
                        <DialogDescription className="text-xs">
                            Perbarui informasi kontak, poin, atau status keaktifan pelanggan.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="flex-1 overflow-y-auto overflow-x-hidden p-6 space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <Field>
                                <Label htmlFor="edit-cust-code" className="text-xs">
                                    Kode Member
                                </Label>
                                <Input
                                    id="edit-cust-code"
                                    value={data.member_code}
                                    onChange={(e) => setData('member_code', e.target.value)}
                                    className="font-mono text-xs mt-1"
                                />
                                <FieldError>{errors.member_code}</FieldError>
                            </Field>

                            <Field>
                                <Label htmlFor="edit-cust-phone" className="text-xs">
                                    Nomor HP
                                </Label>
                                <Input
                                    id="edit-cust-phone"
                                    value={data.phone}
                                    onChange={(e) => setData('phone', e.target.value)}
                                    placeholder="Contoh: 081234567890"
                                    className="font-mono text-xs mt-1"
                                />
                                <FieldError>{errors.phone}</FieldError>
                            </Field>
                        </div>

                        <Field>
                            <Label htmlFor="edit-cust-name" className="text-xs">
                                Nama Lengkap <span className="text-destructive">*</span>
                            </Label>
                            <Input
                                id="edit-cust-name"
                                value={data.name}
                                onChange={(e) => setData('name', e.target.value)}
                                className="text-xs mt-1"
                                required
                            />
                            <FieldError>{errors.name}</FieldError>
                        </Field>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <Field>
                                <Label htmlFor="edit-cust-email" className="text-xs">
                                    Email
                                </Label>
                                <Input
                                    id="edit-cust-email"
                                    type="email"
                                    value={data.email}
                                    onChange={(e) => setData('email', e.target.value)}
                                    className="text-xs mt-1"
                                />
                                <FieldError>{errors.email}</FieldError>
                            </Field>

                            <Field>
                                <Label htmlFor="edit-cust-points" className="text-xs">
                                    Saldo Poin
                                </Label>
                                <Input
                                    id="edit-cust-points"
                                    type="number"
                                    min={0}
                                    value={data.points}
                                    onChange={(e) => setData('points', e.target.value)}
                                    className="font-mono text-xs mt-1"
                                />
                                <FieldError>{errors.points}</FieldError>
                            </Field>
                        </div>

                        <Field>
                            <Label htmlFor="edit-cust-address" className="text-xs">
                                Alamat
                            </Label>
                            <textarea
                                id="edit-cust-address"
                                rows={2}
                                value={data.address}
                                onChange={(e) => setData('address', e.target.value)}
                                className="w-full mt-1 rounded-md border border-input bg-background p-2 text-xs shadow-xs"
                            />
                            <FieldError>{errors.address}</FieldError>
                        </Field>

                        <Field>
                            <Label htmlFor="edit-cust-notes" className="text-xs">
                                Catatan
                            </Label>
                            <textarea
                                id="edit-cust-notes"
                                rows={2}
                                value={data.notes}
                                onChange={(e) => setData('notes', e.target.value)}
                                className="w-full mt-1 rounded-md border border-input bg-background p-2 text-xs shadow-xs"
                            />
                            <FieldError>{errors.notes}</FieldError>
                        </Field>

                        <div className="flex items-center justify-between rounded-lg border p-3">
                            <div>
                                <Label className="text-xs font-medium">Status Member Aktif</Label>
                                <p className="text-[11px] text-muted-foreground">
                                    Member nonaktif tidak akan muncul pada pencarian Terminal Kasir.
                                </p>
                            </div>
                            <Switch
                                checked={data.is_active}
                                onCheckedChange={(checked) => setData('is_active', checked)}
                            />
                        </div>
                    </div>

                    <DialogFooter className="p-6 pt-4 border-t shrink-0 flex items-center justify-end gap-2 bg-muted/20">
                        <DialogClose
                            render={
                                <Button type="button" variant="outline" size="sm">
                                    Batal
                                </Button>
                            }
                        />
                        <Button type="submit" size="sm" disabled={processing}>
                            {processing ? 'Menyimpan...' : 'Simpan Perubahan'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}

export default DialogEditCustomer

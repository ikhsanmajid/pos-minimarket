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
import { Field, FieldError } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Building2 } from 'lucide-react'
import type { SupplierRow } from '../Supplier'

interface DialogEditSupplierProps {
    supplier: SupplierRow
    updateUrl: string
    open: boolean
    onOpenChange: (open: boolean) => void
}

export function DialogEditSupplier({
    supplier,
    updateUrl,
    open,
    onOpenChange,
}: DialogEditSupplierProps) {
    const { data, setData, patch, processing, errors, reset } = useForm({
        code: supplier.code ?? '',
        name: supplier.name,
        contact_person: supplier.contact_person ?? '',
        phone: supplier.phone,
        email: supplier.email ?? '',
        address: supplier.address ?? '',
        city: supplier.city ?? '',
        npwp: supplier.npwp ?? '',
        payment_term_days: supplier.payment_term_days ?? 0,
        bank_name: supplier.bank_name ?? '',
        bank_account_number: supplier.bank_account_number ?? '',
        bank_account_name: supplier.bank_account_name ?? '',
        is_active: supplier.is_active,
        notes: supplier.notes ?? '',
    })

    React.useEffect(() => {
        if (open) {
            setData({
                code: supplier.code ?? '',
                name: supplier.name,
                contact_person: supplier.contact_person ?? '',
                phone: supplier.phone,
                email: supplier.email ?? '',
                address: supplier.address ?? '',
                city: supplier.city ?? '',
                npwp: supplier.npwp ?? '',
                payment_term_days: supplier.payment_term_days ?? 0,
                bank_name: supplier.bank_name ?? '',
                bank_account_number: supplier.bank_account_number ?? '',
                bank_account_name: supplier.bank_account_name ?? '',
                is_active: supplier.is_active,
                notes: supplier.notes ?? '',
            })
        }
    }, [open, supplier.id])

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
            <DialogContent className="sm:max-w-2xl md:max-w-3xl max-h-[85vh] flex flex-col p-0 overflow-hidden">
                <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden">
                    <DialogHeader className="px-6 pt-5 pb-4 border-b shrink-0">
                        <DialogTitle className="flex items-center gap-2">
                            <Building2 className="h-5 w-5 text-primary" />
                            Edit Supplier: {supplier.name}
                        </DialogTitle>
                        <DialogDescription className="text-xs">
                            Perbarui informasi kontak, perbankan, dan status supplier.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="flex-1 overflow-y-auto overflow-x-hidden px-6 py-4 space-y-4">
                        <div className="rounded-lg border bg-card p-4 space-y-3">
                            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                Informasi Utama
                            </h4>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <Field>
                                    <Label htmlFor="edit_code">Kode Supplier</Label>
                                    <Input
                                        id="edit_code"
                                        value={data.code}
                                        onChange={(e) => setData('code', e.target.value)}
                                        className="font-mono text-xs"
                                    />
                                    {errors.code && <FieldError>{errors.code}</FieldError>}
                                </Field>

                                <Field>
                                    <Label htmlFor="edit_name">Nama Supplier / PT <span className="text-destructive">*</span></Label>
                                    <Input
                                        id="edit_name"
                                        value={data.name}
                                        onChange={(e) => setData('name', e.target.value)}
                                        required
                                    />
                                    {errors.name && <FieldError>{errors.name}</FieldError>}
                                </Field>

                                <Field>
                                    <Label htmlFor="edit_contact">Kontak Person (PIC)</Label>
                                    <Input
                                        id="edit_contact"
                                        value={data.contact_person}
                                        onChange={(e) => setData('contact_person', e.target.value)}
                                    />
                                    {errors.contact_person && <FieldError>{errors.contact_person}</FieldError>}
                                </Field>

                                <Field>
                                    <Label htmlFor="edit_phone">No. Telepon / WhatsApp <span className="text-destructive">*</span></Label>
                                    <Input
                                        id="edit_phone"
                                        value={data.phone}
                                        onChange={(e) => setData('phone', e.target.value)}
                                        required
                                    />
                                    {errors.phone && <FieldError>{errors.phone}</FieldError>}
                                </Field>

                                <Field>
                                    <Label htmlFor="edit_email">Email</Label>
                                    <Input
                                        id="edit_email"
                                        type="email"
                                        value={data.email}
                                        onChange={(e) => setData('email', e.target.value)}
                                    />
                                    {errors.email && <FieldError>{errors.email}</FieldError>}
                                </Field>

                                <Field>
                                    <Label htmlFor="edit_city">Kota</Label>
                                    <Input
                                        id="edit_city"
                                        value={data.city}
                                        onChange={(e) => setData('city', e.target.value)}
                                    />
                                    {errors.city && <FieldError>{errors.city}</FieldError>}
                                </Field>
                            </div>

                            <Field>
                                <Label htmlFor="edit_address">Alamat Lengkap</Label>
                                <textarea
                                    id="edit_address"
                                    rows={2}
                                    value={data.address}
                                    onChange={(e) => setData('address', e.target.value)}
                                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring"
                                />
                                {errors.address && <FieldError>{errors.address}</FieldError>}
                            </Field>
                        </div>

                        <div className="rounded-lg border bg-card p-4 space-y-3">
                            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                Ketentuan Pembayaran & Perbankan
                            </h4>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                <Field>
                                    <Label htmlFor="edit_terms">Tempo Pembayaran (Hari)</Label>
                                    <Input
                                        id="edit_terms"
                                        type="number"
                                        min={0}
                                        value={data.payment_term_days}
                                        onChange={(e) => setData('payment_term_days', parseInt(e.target.value) || 0)}
                                    />
                                    <span className="text-[11px] text-muted-foreground">0 = Cash on Delivery (COD).</span>
                                    {errors.payment_term_days && <FieldError>{errors.payment_term_days}</FieldError>}
                                </Field>

                                <Field>
                                    <Label htmlFor="edit_npwp">NPWP</Label>
                                    <Input
                                        id="edit_npwp"
                                        value={data.npwp}
                                        onChange={(e) => setData('npwp', e.target.value)}
                                    />
                                    {errors.npwp && <FieldError>{errors.npwp}</FieldError>}
                                </Field>

                                <Field>
                                    <Label htmlFor="edit_bank">Nama Bank</Label>
                                    <Input
                                        id="edit_bank"
                                        value={data.bank_name}
                                        onChange={(e) => setData('bank_name', e.target.value)}
                                    />
                                    {errors.bank_name && <FieldError>{errors.bank_name}</FieldError>}
                                </Field>

                                <Field>
                                    <Label htmlFor="edit_acc_num">No. Rekening</Label>
                                    <Input
                                        id="edit_acc_num"
                                        value={data.bank_account_number}
                                        onChange={(e) => setData('bank_account_number', e.target.value)}
                                        className="font-mono text-xs"
                                    />
                                    {errors.bank_account_number && <FieldError>{errors.bank_account_number}</FieldError>}
                                </Field>

                                <Field className="sm:col-span-2">
                                    <Label htmlFor="edit_acc_name">Atas Nama Rekening</Label>
                                    <Input
                                        id="edit_acc_name"
                                        value={data.bank_account_name}
                                        onChange={(e) => setData('bank_account_name', e.target.value)}
                                    />
                                    {errors.bank_account_name && <FieldError>{errors.bank_account_name}</FieldError>}
                                </Field>
                            </div>

                            <Field>
                                <Label htmlFor="edit_notes">Catatan Tambahan</Label>
                                <textarea
                                    id="edit_notes"
                                    rows={2}
                                    value={data.notes}
                                    onChange={(e) => setData('notes', e.target.value)}
                                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring"
                                />
                                {errors.notes && <FieldError>{errors.notes}</FieldError>}
                            </Field>

                            <div className="flex items-center justify-between pt-2">
                                <div className="space-y-0.5">
                                    <Label htmlFor="edit_active">Status Pemasok</Label>
                                    <p className="text-xs text-muted-foreground">
                                        Pemasok aktif dapat dipilih saat pembuatan Purchase Order.
                                    </p>
                                </div>
                                <Switch
                                    id="edit_active"
                                    checked={data.is_active}
                                    onCheckedChange={(checked) => setData('is_active', checked)}
                                />
                            </div>
                        </div>
                    </div>

                    <DialogFooter className="px-6 py-3 border-t bg-muted/20 shrink-0">
                        <DialogClose
                            render={<Button type="button" variant="outline" size="sm">Batal</Button>}
                        />
                        <Button type="submit" size="sm" disabled={processing}>
                            {processing ? 'Menyimpan...' : 'Perbarui Supplier'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}
export default DialogEditSupplier

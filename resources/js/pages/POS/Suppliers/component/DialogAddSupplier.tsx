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
import { Plus, Building2 } from 'lucide-react'

interface DialogAddSupplierProps {
    storeUrl: string
}

export function DialogAddSupplier({ storeUrl }: DialogAddSupplierProps) {
    const [open, setOpen] = React.useState(false)

    const { data, setData, post, processing, errors, reset } = useForm({
        code: '',
        name: '',
        contact_person: '',
        phone: '',
        email: '',
        address: '',
        city: '',
        npwp: '',
        payment_term_days: 0,
        bank_name: '',
        bank_account_number: '',
        bank_account_name: '',
        is_active: true,
        notes: '',
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
            reset()
        }
    }

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogTrigger
                render={
                    <Button className="w-full sm:w-auto">
                        <Plus className="h-4 w-4 mr-1.5" />
                        Tambah Supplier
                    </Button>
                }
            />

            <DialogContent className="sm:max-w-2xl md:max-w-3xl max-h-[85vh] flex flex-col p-0 overflow-hidden">
                <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden">
                    <DialogHeader className="px-6 pt-5 pb-4 border-b shrink-0">
                        <DialogTitle className="flex items-center gap-2">
                            <Building2 className="h-5 w-5 text-primary" />
                            Tambah Supplier Baru
                        </DialogTitle>
                        <DialogDescription className="text-xs">
                            Isi detail informasi mitra pemasok / vendor produk toko Anda.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="flex-1 overflow-y-auto overflow-x-hidden px-6 py-4 space-y-4">
                        {/* Informasi Utama */}
                        <div className="rounded-lg border bg-card p-4 space-y-3">
                            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                Informasi Utama
                            </h4>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <Field>
                                    <Label htmlFor="add_code">Kode Supplier (Opsional)</Label>
                                    <Input
                                        id="add_code"
                                        placeholder="Otomatis (cth: SUP-0001)"
                                        value={data.code}
                                        onChange={(e) => setData('code', e.target.value)}
                                        className="font-mono text-xs"
                                    />
                                    {errors.code && <FieldError>{errors.code}</FieldError>}
                                </Field>

                                <Field>
                                    <Label htmlFor="add_name">Nama Supplier / PT <span className="text-destructive">*</span></Label>
                                    <Input
                                        id="add_name"
                                        placeholder="cth: PT Sumber Makmur Sejahtera"
                                        value={data.name}
                                        onChange={(e) => setData('name', e.target.value)}
                                        required
                                    />
                                    {errors.name && <FieldError>{errors.name}</FieldError>}
                                </Field>

                                <Field>
                                    <Label htmlFor="add_contact">Kontak Person (PIC)</Label>
                                    <Input
                                        id="add_contact"
                                        placeholder="cth: Bpk. Hendra Gunawan"
                                        value={data.contact_person}
                                        onChange={(e) => setData('contact_person', e.target.value)}
                                    />
                                    {errors.contact_person && <FieldError>{errors.contact_person}</FieldError>}
                                </Field>

                                <Field>
                                    <Label htmlFor="add_phone">No. Telepon / WhatsApp <span className="text-destructive">*</span></Label>
                                    <Input
                                        id="add_phone"
                                        placeholder="cth: 081234567890"
                                        value={data.phone}
                                        onChange={(e) => setData('phone', e.target.value)}
                                        required
                                    />
                                    {errors.phone && <FieldError>{errors.phone}</FieldError>}
                                </Field>

                                <Field>
                                    <Label htmlFor="add_email">Email</Label>
                                    <Input
                                        id="add_email"
                                        type="email"
                                        placeholder="cth: sales@pemasok.co.id"
                                        value={data.email}
                                        onChange={(e) => setData('email', e.target.value)}
                                    />
                                    {errors.email && <FieldError>{errors.email}</FieldError>}
                                </Field>

                                <Field>
                                    <Label htmlFor="add_city">Kota</Label>
                                    <Input
                                        id="add_city"
                                        placeholder="cth: Jakarta Pusat"
                                        value={data.city}
                                        onChange={(e) => setData('city', e.target.value)}
                                    />
                                    {errors.city && <FieldError>{errors.city}</FieldError>}
                                </Field>
                            </div>

                            <Field>
                                <Label htmlFor="add_address">Alamat Lengkap</Label>
                                <textarea
                                    id="add_address"
                                    rows={2}
                                    placeholder="Jl. Perdagangan Raya No. 45, Kawasan Industri..."
                                    value={data.address}
                                    onChange={(e) => setData('address', e.target.value)}
                                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring"
                                />
                                {errors.address && <FieldError>{errors.address}</FieldError>}
                            </Field>
                        </div>

                        {/* Syarat Pembayaran & Rekening */}
                        <div className="rounded-lg border bg-card p-4 space-y-3">
                            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                Ketentuan Pembayaran & Perbankan
                            </h4>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                <Field>
                                    <Label htmlFor="add_terms">Tempo Pembayaran (Hari)</Label>
                                    <Input
                                        id="add_terms"
                                        type="number"
                                        min={0}
                                        placeholder="0 = Tunai / COD"
                                        value={data.payment_term_days}
                                        onChange={(e) => setData('payment_term_days', parseInt(e.target.value) || 0)}
                                    />
                                    <span className="text-[11px] text-muted-foreground">Isi 0 jika Cash on Delivery (COD).</span>
                                    {errors.payment_term_days && <FieldError>{errors.payment_term_days}</FieldError>}
                                </Field>

                                <Field>
                                    <Label htmlFor="add_npwp">NPWP</Label>
                                    <Input
                                        id="add_npwp"
                                        placeholder="cth: 01.234.567.8-901.000"
                                        value={data.npwp}
                                        onChange={(e) => setData('npwp', e.target.value)}
                                    />
                                    {errors.npwp && <FieldError>{errors.npwp}</FieldError>}
                                </Field>

                                <Field>
                                    <Label htmlFor="add_bank">Nama Bank</Label>
                                    <Input
                                        id="add_bank"
                                        placeholder="cth: BCA / Mandiri / BNI"
                                        value={data.bank_name}
                                        onChange={(e) => setData('bank_name', e.target.value)}
                                    />
                                    {errors.bank_name && <FieldError>{errors.bank_name}</FieldError>}
                                </Field>

                                <Field>
                                    <Label htmlFor="add_acc_num">No. Rekening</Label>
                                    <Input
                                        id="add_acc_num"
                                        placeholder="cth: 1234567890"
                                        value={data.bank_account_number}
                                        onChange={(e) => setData('bank_account_number', e.target.value)}
                                        className="font-mono text-xs"
                                    />
                                    {errors.bank_account_number && <FieldError>{errors.bank_account_number}</FieldError>}
                                </Field>

                                <Field className="sm:col-span-2">
                                    <Label htmlFor="add_acc_name">Atas Nama Rekening</Label>
                                    <Input
                                        id="add_acc_name"
                                        placeholder="cth: PT Sumber Makmur Sejahtera"
                                        value={data.bank_account_name}
                                        onChange={(e) => setData('bank_account_name', e.target.value)}
                                    />
                                    {errors.bank_account_name && <FieldError>{errors.bank_account_name}</FieldError>}
                                </Field>
                            </div>

                            <Field>
                                <Label htmlFor="add_notes">Catatan Tambahan</Label>
                                <textarea
                                    id="add_notes"
                                    rows={2}
                                    placeholder="Catatan khusus, syarat minimum order, dll..."
                                    value={data.notes}
                                    onChange={(e) => setData('notes', e.target.value)}
                                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring"
                                />
                                {errors.notes && <FieldError>{errors.notes}</FieldError>}
                            </Field>

                            <div className="flex items-center justify-between pt-2">
                                <div className="space-y-0.5">
                                    <Label htmlFor="add_active">Status Pemasok</Label>
                                    <p className="text-xs text-muted-foreground">
                                        Pemasok aktif dapat dipilih saat pembuatan Purchase Order.
                                    </p>
                                </div>
                                <Switch
                                    id="add_active"
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
                            {processing ? 'Menyimpan...' : 'Simpan Supplier'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}
export default DialogAddSupplier

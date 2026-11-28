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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import { Field, FieldError } from '@/components/ui/field'
import { Plus, UserPlus } from 'lucide-react'

const TIER_ITEMS = [
    { value: 'silver', label: 'Silver (1x Poin)' },
    { value: 'gold', label: 'Gold (1.5x Poin)' },
    { value: 'platinum', label: 'Platinum (2x Poin)' },
]

interface DialogAddCustomerProps {
    storeUrl: string
}

export function DialogAddCustomer({ storeUrl }: DialogAddCustomerProps) {
    const [open, setOpen] = React.useState(false)

    const { data, setData, post, processing, errors, reset, clearErrors } = useForm({
        member_code: '',
        name: '',
        phone: '',
        email: '',
        address: '',
        points: '0',
        tier: 'silver',
        birth_date: '',
        is_active: true,
        notes: '',
    })

    const handleOpenChange = (nextOpen: boolean) => {
        setOpen(nextOpen)
        if (!nextOpen) {
            clearErrors()
            reset()
        }
    }

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        post(storeUrl, {
            preserveScroll: true,
            onSuccess: () => {
                reset()
                setOpen(false)
            },
        })
    }

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogTrigger
                render={
                    <Button className="gap-1.5 cursor-pointer">
                        <Plus className="h-4 w-4" />
                        Tambah Pelanggan
                    </Button>
                }
            />

            <DialogContent className="sm:max-w-xl max-h-[85vh] flex flex-col p-0 gap-0 overflow-hidden">
                <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden">
                    <DialogHeader className="p-6 pb-4 border-b shrink-0">
                        <DialogTitle className="flex items-center gap-2">
                            <UserPlus className="h-5 w-5 text-primary" />
                            Tambah Pelanggan / Member
                        </DialogTitle>
                        <DialogDescription className="text-xs">
                            Daftarkan pelanggan baru agar dapat dipilih cepat saat transaksi kasir.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="flex-1 overflow-y-auto overflow-x-hidden p-6 space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <Field>
                                <Label htmlFor="add-cust-code" className="text-xs">
                                    Kode Member (Opsional)
                                </Label>
                                <Input
                                    id="add-cust-code"
                                    value={data.member_code}
                                    onChange={(e) => setData('member_code', e.target.value)}
                                    placeholder="Otomatis (MBR-YYYYMMDD-XXXX)"
                                    className="font-mono text-xs mt-1"
                                />
                                <FieldError>{errors.member_code}</FieldError>
                            </Field>

                            <Field>
                                <Label htmlFor="add-cust-phone" className="text-xs">
                                    Nomor HP
                                </Label>
                                <Input
                                    id="add-cust-phone"
                                    value={data.phone}
                                    onChange={(e) => setData('phone', e.target.value)}
                                    placeholder="Contoh: 081234567890"
                                    className="font-mono text-xs mt-1"
                                />
                                <FieldError>{errors.phone}</FieldError>
                            </Field>
                        </div>

                        <Field>
                            <Label htmlFor="add-cust-name" className="text-xs">
                                Nama Lengkap <span className="text-destructive">*</span>
                            </Label>
                            <Input
                                id="add-cust-name"
                                value={data.name}
                                onChange={(e) => setData('name', e.target.value)}
                                placeholder="Nama pelanggan / member"
                                className="text-xs mt-1"
                                required
                            />
                            <FieldError>{errors.name}</FieldError>
                        </Field>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <Field>
                                <Label htmlFor="add-cust-email" className="text-xs">
                                    Email (Opsional)
                                </Label>
                                <Input
                                    id="add-cust-email"
                                    type="email"
                                    value={data.email}
                                    onChange={(e) => setData('email', e.target.value)}
                                    placeholder="pelanggan@email.com"
                                    className="text-xs mt-1"
                                />
                                <FieldError>{errors.email}</FieldError>
                            </Field>

                            <Field>
                                <Label htmlFor="add-cust-points" className="text-xs">
                                    Poin Awal
                                </Label>
                                <Input
                                    id="add-cust-points"
                                    type="number"
                                    min={0}
                                    value={data.points}
                                    onChange={(e) => setData('points', e.target.value)}
                                    className="font-mono text-xs mt-1"
                                />
                                <FieldError>{errors.points}</FieldError>
                            </Field>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <Field>
                                <Label className="text-xs">Tier Member</Label>
                                <div className="mt-1">
                                    <Select
                                        items={TIER_ITEMS}
                                        value={data.tier}
                                        onValueChange={(val) => val && setData('tier', val)}
                                    >
                                        <SelectTrigger className="w-full h-9 text-xs">
                                            <SelectValue>
                                                {(val) => TIER_ITEMS.find((t) => t.value === val)?.label}
                                            </SelectValue>
                                        </SelectTrigger>
                                        <SelectContent>
                                            {TIER_ITEMS.map((item) => (
                                                <SelectItem key={item.value} value={item.value}>
                                                    {item.label}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <FieldError>{errors.tier}</FieldError>
                            </Field>

                            <Field>
                                <Label htmlFor="add-cust-birth-date" className="text-xs">
                                    Tanggal Lahir (Opsional)
                                </Label>
                                <Input
                                    id="add-cust-birth-date"
                                    type="date"
                                    value={data.birth_date}
                                    onChange={(e) => setData('birth_date', e.target.value)}
                                    className="font-mono text-xs mt-1 h-9"
                                />
                                <FieldError>{errors.birth_date}</FieldError>
                            </Field>
                        </div>

                        <Field>
                            <Label htmlFor="add-cust-address" className="text-xs">
                                Alamat
                            </Label>
                            <textarea
                                id="add-cust-address"
                                rows={2}
                                value={data.address}
                                onChange={(e) => setData('address', e.target.value)}
                                placeholder="Alamat lengkap pelanggan"
                                className="w-full mt-1 rounded-md border border-input bg-background p-2 text-xs shadow-xs"
                            />
                            <FieldError>{errors.address}</FieldError>
                        </Field>

                        <Field>
                            <Label htmlFor="add-cust-notes" className="text-xs">
                                Catatan
                            </Label>
                            <textarea
                                id="add-cust-notes"
                                rows={2}
                                value={data.notes}
                                onChange={(e) => setData('notes', e.target.value)}
                                placeholder="Preferensi belanja atau catatan internal"
                                className="w-full mt-1 rounded-md border border-input bg-background p-2 text-xs shadow-xs"
                            />
                            <FieldError>{errors.notes}</FieldError>
                        </Field>

                        <div className="flex items-center justify-between rounded-lg border p-3">
                            <div>
                                <Label className="text-xs font-medium">Status Member Aktif</Label>
                                <p className="text-[11px] text-muted-foreground">
                                    Hanya member aktif yang muncul pada pencarian cepat Terminal Kasir.
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
                            {processing ? 'Menyimpan...' : 'Simpan Pelanggan'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}

export default DialogAddCustomer

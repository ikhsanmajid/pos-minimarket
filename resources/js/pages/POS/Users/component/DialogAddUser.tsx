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
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import { Plus, ShieldAlert, UserPlus } from 'lucide-react'
import type { RoleOption } from '../Users'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DialogAddUserProps {
    roles: RoleOption[]
    storeUrl: string
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function DialogAddUser({ roles, storeUrl }: DialogAddUserProps) {
    const [open, setOpen] = React.useState(false)

    const { data, setData, post, processing, errors, reset } = useForm({
        name: '',
        email: '',
        phone: '',
        role: '',
        password: '',
        password_confirmation: '',
        pin: '',
        is_active: true,
    })

    const isPrivilegedRole = data.role === 'admin' || data.role === 'supervisor'

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        post(storeUrl, {
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
            <DialogTrigger render={<Button className="gap-2"><Plus className="h-4 w-4" /> Tambah Pengguna</Button>} />

            <DialogContent className="sm:max-w-2xl md:max-w-3xl p-0 gap-0 overflow-hidden max-h-[88vh] flex flex-col">
                <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden">
                    <DialogHeader className="px-6 pt-5 pb-4 border-b border-border/50 shrink-0">
                        <DialogTitle className="flex items-center gap-2">
                            <UserPlus className="h-5 w-5 text-primary" />
                            Tambah Pengguna Baru
                        </DialogTitle>
                        <DialogDescription>
                            Isi detail profil dan kredensial akun karyawan baru untuk sistem POS.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4 custom-scrollbar">
                        <FieldGroup className="space-y-4">
                            {/* Baris 1: Nama Lengkap & Email */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <Field>
                                    <Label htmlFor="add-name">
                                        Nama Lengkap <span className="text-destructive">*</span>
                                    </Label>
                                    <Input
                                        id="add-name"
                                        name="name"
                                        type="text"
                                        placeholder="Contoh: Budi Santoso"
                                        value={data.name}
                                        onChange={(e) => setData('name', e.target.value)}
                                        aria-invalid={!!errors.name}
                                        autoComplete="off"
                                        required
                                    />
                                    <FieldError>{errors.name}</FieldError>
                                </Field>

                                <Field>
                                    <Label htmlFor="add-email">
                                        Email <span className="text-destructive">*</span>
                                    </Label>
                                    <Input
                                        id="add-email"
                                        name="email"
                                        type="email"
                                        placeholder="budi@minimarket.com"
                                        value={data.email}
                                        onChange={(e) => setData('email', e.target.value)}
                                        aria-invalid={!!errors.email}
                                        autoComplete="off"
                                        required
                                    />
                                    <FieldError>{errors.email}</FieldError>
                                </Field>
                            </div>

                            {/* Baris 2: No Telepon & Role */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <Field>
                                    <Label htmlFor="add-phone">Nomor Telepon / WhatsApp</Label>
                                    <Input
                                        id="add-phone"
                                        name="phone"
                                        type="tel"
                                        placeholder="Contoh: 08123456789"
                                        value={data.phone}
                                        onChange={(e) => setData('phone', e.target.value)}
                                        aria-invalid={!!errors.phone}
                                        autoComplete="off"
                                    />
                                    <FieldError>{errors.phone}</FieldError>
                                </Field>

                                <Field>
                                    <Label htmlFor="add-role">
                                        Role / Jabatan <span className="text-destructive">*</span>
                                    </Label>
                                    <Select
                                        items={roles}
                                        value={data.role}
                                        onValueChange={(val) => val && setData('role', val)}
                                    >
                                        <SelectTrigger
                                            id="add-role"
                                            className="w-full"
                                            aria-invalid={!!errors.role}
                                        >
                                            <SelectValue placeholder="Pilih role pengguna…">
                                                {(val) => roles.find((r) => r.value === val)?.label}
                                            </SelectValue>
                                        </SelectTrigger>
                                        <SelectContent>
                                            {roles.map((r) => (
                                                <SelectItem key={r.value} value={r.value}>
                                                    {r.label}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <FieldError>{errors.role}</FieldError>
                                </Field>
                            </div>

                            {/* PIN Otorisasi 6 digit (hanya admin/supervisor) */}
                            {isPrivilegedRole && (
                                <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3.5 space-y-2">
                                    <div className="flex items-center gap-1.5 text-xs font-medium text-amber-700 dark:text-amber-400">
                                        <ShieldAlert className="h-4 w-4 shrink-0" />
                                        <span>PIN Otorisasi Transaksi (Khusus Admin / Supervisor)</span>
                                    </div>
                                    <Field>
                                        <Label htmlFor="add-pin" className="text-xs text-muted-foreground">
                                            PIN 6 Digit (Angka)
                                        </Label>
                                        <Input
                                            id="add-pin"
                                            name="pin"
                                            type="password"
                                            inputMode="numeric"
                                            maxLength={6}
                                            placeholder="Contoh: 123456"
                                            value={data.pin}
                                            onChange={(e) => setData('pin', e.target.value.replace(/\D/g, '').slice(0, 6))}
                                            aria-invalid={!!errors.pin}
                                            autoComplete="off"
                                            className="font-mono tracking-widest mt-1"
                                        />
                                        <FieldError>{errors.pin}</FieldError>
                                    </Field>
                                </div>
                            )}

                            {/* Baris 3: Kata Sandi & Konfirmasi Kata Sandi */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <Field>
                                    <Label htmlFor="add-password">
                                        Kata Sandi <span className="text-destructive">*</span>
                                    </Label>
                                    <Input
                                        id="add-password"
                                        name="password"
                                        type="password"
                                        placeholder="Min. 8 karakter"
                                        value={data.password}
                                        onChange={(e) => setData('password', e.target.value)}
                                        aria-invalid={!!errors.password}
                                        autoComplete="new-password"
                                        required
                                    />
                                    <FieldError>{errors.password}</FieldError>
                                </Field>

                                <Field>
                                    <Label htmlFor="add-password_confirmation">
                                        Konfirmasi Kata Sandi <span className="text-destructive">*</span>
                                    </Label>
                                    <Input
                                        id="add-password_confirmation"
                                        name="password_confirmation"
                                        type="password"
                                        placeholder="Ulangi kata sandi"
                                        value={data.password_confirmation}
                                        onChange={(e) => setData('password_confirmation', e.target.value)}
                                        aria-invalid={!!errors.password_confirmation}
                                        autoComplete="new-password"
                                        required
                                    />
                                    <FieldError>{errors.password_confirmation}</FieldError>
                                </Field>
                            </div>

                            {/* Baris 4: Status Aktif Switch */}
                            <div className="flex items-center justify-between rounded-lg border p-3.5 bg-muted/10">
                                <div className="space-y-0.5">
                                    <Label htmlFor="add-is_active" className="text-sm font-medium cursor-pointer">
                                        Status Akun Aktif
                                    </Label>
                                    <p className="text-xs text-muted-foreground">
                                        Pengguna hanya bisa login jika akun dalam status aktif.
                                    </p>
                                </div>
                                <Switch
                                    id="add-is_active"
                                    checked={data.is_active}
                                    onCheckedChange={(checked) => setData('is_active', checked)}
                                />
                            </div>
                        </FieldGroup>
                    </div>

                    <DialogFooter className="px-6 py-3.5 border-t border-border/50 bg-muted/20 shrink-0 gap-2">
                        <DialogClose render={<Button type="button" variant="outline" disabled={processing}>Batal</Button>} />
                        <Button type="submit" disabled={processing} className="gap-2">
                            <Plus className="h-4 w-4" />
                            {processing ? 'Menyimpan…' : 'Simpan Pengguna'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}

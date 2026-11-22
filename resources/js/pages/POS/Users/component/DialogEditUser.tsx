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
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import { update } from '@/actions/App/Http/Controllers/UserController'
import { ShieldAlert, UserCog, Check } from 'lucide-react'
import type { RoleOption, UserRow } from '../Users'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DialogEditUserProps {
    user: UserRow
    roles: RoleOption[]
    open: boolean
    onOpenChange: (open: boolean) => void
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function DialogEditUser({ user, roles, open, onOpenChange }: DialogEditUserProps) {
    const { data, setData, patch, processing, errors, reset } = useForm({
        name: user.name,
        email: user.email,
        phone: user.phone ?? '',
        role: user.role,
        password: '',
        password_confirmation: '',
        pin: '',
        is_active: user.is_active,
    })

    const isPrivilegedRole = data.role === 'admin' || data.role === 'supervisor'

    // Sync form values when user prop changes (different row opened)
    React.useEffect(() => {
        if (open) {
            setData({
                name: user.name,
                email: user.email,
                phone: user.phone ?? '',
                role: user.role,
                password: '',
                password_confirmation: '',
                pin: '',
                is_active: user.is_active,
            })
        }
    }, [open, user.id])

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        patch(update.url(user.id), {
            onSuccess: () => {
                onOpenChange(false)
                reset()
            },
        })
    }

    const handleOpenChange = (nextOpen: boolean) => {
        onOpenChange(nextOpen)
        if (!nextOpen) {
            reset()
        }
    }

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogContent className="sm:max-w-2xl md:max-w-3xl p-0 gap-0 overflow-hidden max-h-[88vh] flex flex-col">
                <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden">
                    <DialogHeader className="px-6 pt-5 pb-4 border-b border-border/50 shrink-0">
                        <DialogTitle className="flex items-center gap-2">
                            <UserCog className="h-5 w-5 text-primary" />
                            Edit Pengguna
                        </DialogTitle>
                        <DialogDescription>
                            Perbarui informasi profil dan kredensial untuk <strong>{user.name}</strong>.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4 custom-scrollbar">
                        <FieldGroup className="space-y-4">
                            {/* Baris 1: Nama & Email */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <Field>
                                    <Label htmlFor="edit-name">
                                        Nama Lengkap <span className="text-destructive">*</span>
                                    </Label>
                                    <Input
                                        id="edit-name"
                                        name="name"
                                        type="text"
                                        value={data.name}
                                        onChange={(e) => setData('name', e.target.value)}
                                        aria-invalid={!!errors.name}
                                        autoComplete="off"
                                        required
                                    />
                                    <FieldError>{errors.name}</FieldError>
                                </Field>

                                <Field>
                                    <Label htmlFor="edit-email">
                                        Email <span className="text-destructive">*</span>
                                    </Label>
                                    <Input
                                        id="edit-email"
                                        name="email"
                                        type="email"
                                        value={data.email}
                                        onChange={(e) => setData('email', e.target.value)}
                                        aria-invalid={!!errors.email}
                                        autoComplete="off"
                                        required
                                    />
                                    <FieldError>{errors.email}</FieldError>
                                </Field>
                            </div>

                            {/* Baris 2: No HP & Role */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <Field>
                                    <Label htmlFor="edit-phone">Nomor Telepon / WhatsApp</Label>
                                    <Input
                                        id="edit-phone"
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
                                    <Label htmlFor="edit-role">
                                        Role / Jabatan <span className="text-destructive">*</span>
                                    </Label>
                                    <Select
                                        items={roles}
                                        value={data.role}
                                        onValueChange={(val) => val && setData('role', val)}
                                    >
                                        <SelectTrigger
                                            id="edit-role"
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

                            {/* PIN Otorisasi (Khusus Admin / Supervisor) */}
                            {isPrivilegedRole && (
                                <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3.5 space-y-2">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-1.5 text-xs font-medium text-amber-700 dark:text-amber-400">
                                            <ShieldAlert className="h-4 w-4 shrink-0" />
                                            <span>PIN Otorisasi (Admin / Supervisor)</span>
                                        </div>
                                        <span className="text-[11px] text-muted-foreground font-mono">
                                            {user.has_pin ? '● Status: Terpasang' : '○ Status: Belum Set'}
                                        </span>
                                    </div>
                                    <Field>
                                        <Label htmlFor="edit-pin" className="text-xs text-muted-foreground">
                                            Ganti PIN 6 Digit (Biarkan kosong jika tidak ingin diubah)
                                        </Label>
                                        <Input
                                            id="edit-pin"
                                            name="pin"
                                            type="password"
                                            inputMode="numeric"
                                            maxLength={6}
                                            placeholder={user.has_pin ? '****** (Tidak diubah)' : 'Masukkan 6 digit angka'}
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

                            {/* Baris 3: Status Aktif Switch */}
                            <div className="flex items-center justify-between rounded-lg border p-3.5 bg-muted/10">
                                <div className="space-y-0.5">
                                    <Label htmlFor="edit-is_active" className="text-sm font-medium cursor-pointer">
                                        Status Akun Aktif
                                    </Label>
                                    <p className="text-xs text-muted-foreground">
                                        Pengguna hanya bisa login jika akun dalam status aktif.
                                    </p>
                                </div>
                                <Switch
                                    id="edit-is_active"
                                    checked={data.is_active}
                                    onCheckedChange={(checked) => setData('is_active', checked)}
                                />
                            </div>

                            {/* Baris 4: Kata Sandi Baru & Konfirmasi Kata Sandi */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <Field>
                                    <Label htmlFor="edit-password">
                                        Kata Sandi Baru{' '}
                                        <span className="font-normal text-muted-foreground text-xs">(opsional)</span>
                                    </Label>
                                    <Input
                                        id="edit-password"
                                        name="password"
                                        type="password"
                                        placeholder="Kosongkan jika tidak diubah"
                                        value={data.password}
                                        onChange={(e) => setData('password', e.target.value)}
                                        aria-invalid={!!errors.password}
                                        autoComplete="new-password"
                                    />
                                    <FieldError>{errors.password}</FieldError>
                                </Field>

                                <Field>
                                    <Label htmlFor="edit-password-confirm">
                                        Konfirmasi Kata Sandi Baru
                                    </Label>
                                    <Input
                                        id="edit-password-confirm"
                                        name="password_confirmation"
                                        type="password"
                                        placeholder="Ulangi kata sandi baru"
                                        value={data.password_confirmation}
                                        onChange={(e) => setData('password_confirmation', e.target.value)}
                                        disabled={!data.password}
                                        autoComplete="new-password"
                                    />
                                </Field>
                            </div>
                        </FieldGroup>
                    </div>

                    <DialogFooter className="px-6 py-3.5 border-t border-border/50 bg-muted/20 shrink-0 gap-2">
                        <DialogClose render={<Button variant="outline" type="button" disabled={processing}>Batal</Button>} />
                        <Button type="submit" disabled={processing} className="gap-2">
                            <Check className="h-4 w-4" />
                            {processing ? 'Menyimpan…' : 'Simpan Perubahan'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}

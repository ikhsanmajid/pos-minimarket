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
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import { update } from '@/actions/App/Http/Controllers/UserController'
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
        role: user.role,
        password: '',
        password_confirmation: '',
    })

    // Sync form values when user prop changes (different row opened)
    React.useEffect(() => {
        if (open) {
            setData({
                name: user.name,
                email: user.email,
                role: user.role,
                password: '',
                password_confirmation: '',
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
            <DialogContent className="sm:max-w-md">
                <form onSubmit={handleSubmit}>
                    <DialogHeader>
                        <DialogTitle>Edit Pengguna</DialogTitle>
                        <DialogDescription>
                            Perbarui data <strong>{user.name}</strong>. Biarkan kata sandi kosong jika tidak ingin menggantinya.
                        </DialogDescription>
                    </DialogHeader>

                    <FieldGroup className="mt-4 mb-4">
                        {/* Nama */}
                        <Field>
                            <Label htmlFor="edit-name">Nama Lengkap</Label>
                            <Input
                                id="edit-name"
                                name="name"
                                type="text"
                                value={data.name}
                                onChange={(e) => setData('name', e.target.value)}
                                aria-invalid={!!errors.name}
                                autoComplete="off"
                            />
                            <FieldError>{errors.name}</FieldError>
                        </Field>

                        {/* Email */}
                        <Field>
                            <Label htmlFor="edit-email">Email</Label>
                            <Input
                                id="edit-email"
                                name="email"
                                type="email"
                                value={data.email}
                                onChange={(e) => setData('email', e.target.value)}
                                aria-invalid={!!errors.email}
                                autoComplete="off"
                            />
                            <FieldError>{errors.email}</FieldError>
                        </Field>

                        {/* Role */}
                        <Field>
                            <Label htmlFor="edit-role">Role</Label>
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
                                    <SelectValue placeholder="Pilih role…">
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

                        {/* Password baru (opsional) */}
                        <Field>
                            <Label htmlFor="edit-password">
                                Kata Sandi Baru{' '}
                                <span className="font-normal text-muted-foreground">(opsional)</span>
                            </Label>
                            <Input
                                id="edit-password"
                                name="password"
                                type="password"
                                placeholder="Kosongkan jika tidak ingin mengubah"
                                value={data.password}
                                onChange={(e) => setData('password', e.target.value)}
                                aria-invalid={!!errors.password}
                                autoComplete="new-password"
                            />
                            <FieldError>{errors.password}</FieldError>
                        </Field>

                        {/* Konfirmasi password */}
                        <Field>
                            <Label htmlFor="edit-password-confirm">Konfirmasi Kata Sandi Baru</Label>
                            <Input
                                id="edit-password-confirm"
                                name="password_confirmation"
                                type="password"
                                placeholder="Ulangi kata sandi baru"
                                value={data.password_confirmation}
                                onChange={(e) => setData('password_confirmation', e.target.value)}
                                autoComplete="new-password"
                            />
                        </Field>
                    </FieldGroup>

                    <DialogFooter>
                        <DialogClose render={<Button variant="outline" type="button" />}>
                            Batal
                        </DialogClose>
                        <Button type="submit" disabled={processing}>
                            {processing ? 'Menyimpan…' : 'Simpan Perubahan'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}

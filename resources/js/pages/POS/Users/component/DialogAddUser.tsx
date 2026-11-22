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
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import { Plus } from 'lucide-react'
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
        password: '',
        password_confirmation: '',
        role: '',
    })

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
            <DialogTrigger render={<Button><Plus className="h-4 w-4" /> Tambah Pengguna</Button>} />

            <DialogContent className="sm:max-w-md">
                <form onSubmit={handleSubmit}>
                    <DialogHeader>
                        <DialogTitle>Tambah Pengguna</DialogTitle>
                        <DialogDescription>
                            Isi data pengguna baru. Semua field wajib diisi.
                        </DialogDescription>
                    </DialogHeader>

                    <FieldGroup className="mt-4 mb-4">
                        {/* Nama */}
                        <Field>
                            <Label htmlFor="add-name">Nama Lengkap</Label>
                            <Input
                                id="add-name"
                                name="name"
                                type="text"
                                placeholder="Contoh: Budi Santoso"
                                value={data.name}
                                onChange={(e) => setData('name', e.target.value)}
                                aria-invalid={!!errors.name}
                                autoComplete="off"
                            />
                            <FieldError>{errors.name}</FieldError>
                        </Field>

                        {/* Email */}
                        <Field>
                            <Label htmlFor="add-email">Email</Label>
                            <Input
                                id="add-email"
                                name="email"
                                type="email"
                                placeholder="budi@toko.com"
                                value={data.email}
                                onChange={(e) => setData('email', e.target.value)}
                                aria-invalid={!!errors.email}
                                autoComplete="off"
                            />
                            <FieldError>{errors.email}</FieldError>
                        </Field>

                        {/* Role */}
                        <Field>
                            <Label htmlFor="add-role">Role</Label>
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

                        {/* Password */}
                        <Field>
                            <Label htmlFor="add-password">Kata Sandi</Label>
                            <Input
                                id="add-password"
                                name="password"
                                type="password"
                                placeholder="Min. 8 karakter"
                                value={data.password}
                                onChange={(e) => setData('password', e.target.value)}
                                aria-invalid={!!errors.password}
                                autoComplete="new-password"
                            />
                            <FieldError>{errors.password}</FieldError>
                        </Field>

                        {/* Konfirmasi Password */}
                        <Field>
                            <Label htmlFor="add-password-confirm">Konfirmasi Kata Sandi</Label>
                            <Input
                                id="add-password-confirm"
                                name="password_confirmation"
                                type="password"
                                placeholder="Ulangi kata sandi"
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
                            {processing ? 'Menyimpan…' : 'Simpan'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}

import React from 'react'
import { Link, useForm, usePage } from '@inertiajs/react'
import AuthenticatedLayout from '@/layouts/AuthenticatedLayout'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Field, FieldError, FieldGroup } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import { index, show, update } from '@/actions/App/Http/Controllers/UserController'
import { ArrowLeft } from 'lucide-react'
import type { PageProps } from '@/types'
import type { RoleOption } from './Users'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type EditUserData = {
    id: number
    name: string
    email: string
    role: string
}

type EditUserPageProps = PageProps<{
    user: EditUserData
    roles: RoleOption[]
}>

// ---------------------------------------------------------------------------
// Page Component
// ---------------------------------------------------------------------------

const EditUser = () => {
    const { user, roles } = usePage<EditUserPageProps>().props

    const { data, setData, patch, processing, errors } = useForm({
        name: user.name,
        email: user.email,
        role: user.role,
        password: '',
        password_confirmation: '',
    })

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        patch(update.url(user.id))
    }

    return (
        <div className="p-6 max-w-2xl mx-auto">
            {/* Back button */}
            <div className="mb-6 flex items-center justify-between">
                <Button
                    variant="ghost"
                    size="sm"
                    render={<Link href={show.url(user.id)} />}
                    className="gap-1.5 text-muted-foreground"
                >
                    <ArrowLeft className="h-4 w-4" />
                    Kembali ke detail
                </Button>
            </div>

            <Card>
                <form onSubmit={handleSubmit}>
                    <CardHeader>
                        <CardTitle>Edit Pengguna</CardTitle>
                        <CardDescription>
                            Perbarui informasi akun <strong>{user.name}</strong>. Biarkan kata sandi kosong jika tidak ingin mengubahnya.
                        </CardDescription>
                    </CardHeader>

                    <CardContent>
                        <FieldGroup className="space-y-4">
                            {/* Nama */}
                            <Field>
                                <Label htmlFor="name">Nama Lengkap</Label>
                                <Input
                                    id="name"
                                    name="name"
                                    type="text"
                                    value={data.name}
                                    onChange={(e) => setData('name', e.target.value)}
                                    aria-invalid={!!errors.name}
                                />
                                <FieldError>{errors.name}</FieldError>
                            </Field>

                            {/* Email */}
                            <Field>
                                <Label htmlFor="email">Email</Label>
                                <Input
                                    id="email"
                                    name="email"
                                    type="email"
                                    value={data.email}
                                    onChange={(e) => setData('email', e.target.value)}
                                    aria-invalid={!!errors.email}
                                />
                                <FieldError>{errors.email}</FieldError>
                            </Field>

                            {/* Role */}
                            <Field>
                                <Label htmlFor="role">Role</Label>
                                <Select
                                    items={roles}
                                    value={data.role}
                                    onValueChange={(val) => val && setData('role', val)}
                                >
                                    <SelectTrigger id="role" className="w-full" aria-invalid={!!errors.role}>
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

                            {/* Password Baru (Opsional) */}
                            <Field>
                                <Label htmlFor="password">
                                    Kata Sandi Baru{' '}
                                    <span className="font-normal text-muted-foreground">(opsional)</span>
                                </Label>
                                <Input
                                    id="password"
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

                            {/* Konfirmasi Password Baru */}
                            <Field>
                                <Label htmlFor="password_confirmation">Konfirmasi Kata Sandi Baru</Label>
                                <Input
                                    id="password_confirmation"
                                    name="password_confirmation"
                                    type="password"
                                    placeholder="Ulangi kata sandi baru"
                                    value={data.password_confirmation}
                                    onChange={(e) => setData('password_confirmation', e.target.value)}
                                    autoComplete="new-password"
                                />
                            </Field>
                        </FieldGroup>
                    </CardContent>

                    <CardFooter className="flex justify-end gap-3 border-t pt-6">
                        <Button
                            variant="outline"
                            type="button"
                            render={<Link href={index.url()} />}
                        >
                            Batal
                        </Button>
                        <Button type="submit" disabled={processing}>
                            {processing ? 'Menyimpan…' : 'Simpan Perubahan'}
                        </Button>
                    </CardFooter>
                </form>
            </Card>
        </div>
    )
}

EditUser.layout = (page: React.ReactNode) => (
    <AuthenticatedLayout>{page}</AuthenticatedLayout>
)

export default EditUser

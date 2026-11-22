import React, { useEffect } from 'react'
import { useForm, usePage } from '@inertiajs/react'
import AuthenticatedLayout from '@/layouts/AuthenticatedLayout'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Field, FieldError, FieldGroup } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { toast } from 'react-toastify'
import { User as UserIcon, Lock, KeyRound, ShieldAlert, CheckCircle2 } from 'lucide-react'
import type { PageProps } from '@/types'
import { useAuth } from '@/hooks/use-auth'
import { roleBadgeClass } from '../Users/Users'

type ProfileData = {
    id: number
    name: string
    email: string
    phone: string | null
    role: string
    role_name: string
    has_pin: boolean
    created_at: string
    last_login_at: string | null
}

type ProfilePageProps = PageProps<{
    user: ProfileData
    isPrivileged: boolean
}>

function getInitials(name: string): string {
    return name
        .split(' ')
        .slice(0, 2)
        .map((n) => n[0]?.toUpperCase() ?? '')
        .join('')
}

const ProfilePage = () => {
    const { user, isPrivileged } = usePage<ProfilePageProps>().props
    const { flash } = useAuth()

    const { data, setData, patch, processing, errors, reset } = useForm({
        name: user.name,
        phone: user.phone ?? '',
        current_password: '',
        password: '',
        password_confirmation: '',
        pin: '',
    })

    useEffect(() => {
        if (flash.success) {
            toast.success(flash.success)
        }
        if (flash.error) {
            toast.error(flash.error)
        }
    }, [flash.success, flash.error])

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        patch('/pos/profile', {
            preserveScroll: true,
            onSuccess: () => {
                reset('current_password', 'password', 'password_confirmation', 'pin')
            },
        })
    }

    const roleCls = roleBadgeClass[user.role] ?? ''

    return (
        <div className="w-full min-w-0 max-w-4xl mx-auto space-y-6 pb-12">
            <div>
                <h1 className="text-2xl font-bold tracking-tight">Profil Saya</h1>
                <p className="text-sm text-muted-foreground">
                    Kelola informasi profil akun dan keamanan Anda.
                </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
                {/* Header Akun */}
                <Card>
                    <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6">
                        <div className="flex items-center gap-4">
                            <Avatar size="lg" className="h-16 w-16 text-xl">
                                <AvatarFallback>{getInitials(user.name)}</AvatarFallback>
                            </Avatar>
                            <div className="space-y-1">
                                <CardTitle className="text-xl">{user.name}</CardTitle>
                                <div className="flex flex-wrap items-center gap-2">
                                    <Badge className={roleCls}>{user.role_name}</Badge>
                                    <span className="text-xs text-muted-foreground font-mono">
                                        {user.email}
                                    </span>
                                </div>
                            </div>
                        </div>
                        <div className="text-xs text-muted-foreground space-y-0.5">
                            <p>Terdaftar: {user.created_at}</p>
                            <p>Login Terakhir: {user.last_login_at ?? '-'}</p>
                        </div>
                    </CardHeader>
                </Card>

                {/* Informasi Pribadi */}
                <Card>
                    <CardHeader>
                        <div className="flex items-center gap-2">
                            <UserIcon className="h-5 w-5 text-primary" />
                            <CardTitle className="text-lg">Informasi Pribadi</CardTitle>
                        </div>
                        <CardDescription>
                            Perbarui nama tampilan dan nomor kontak Anda.
                        </CardDescription>
                    </CardHeader>

                    <CardContent className="space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <Field>
                                <Label htmlFor="profile-name">
                                    Nama Lengkap <span className="text-destructive">*</span>
                                </Label>
                                <Input
                                    id="profile-name"
                                    value={data.name}
                                    onChange={(e) => setData('name', e.target.value)}
                                    aria-invalid={!!errors.name}
                                    required
                                />
                                <FieldError>{errors.name}</FieldError>
                            </Field>

                            <Field>
                                <Label htmlFor="profile-email">Alamat Email</Label>
                                <Input
                                    id="profile-email"
                                    value={user.email}
                                    disabled
                                    className="bg-muted cursor-not-allowed"
                                />
                                <p className="text-[11px] text-muted-foreground mt-1">
                                    Email digunakan untuk login dan tidak dapat diubah sendiri.
                                </p>
                            </Field>
                        </div>

                        <Field>
                            <Label htmlFor="profile-phone">Nomor Telepon / WhatsApp</Label>
                            <Input
                                id="profile-phone"
                                type="tel"
                                placeholder="Contoh: 08123456789"
                                value={data.phone}
                                onChange={(e) => setData('phone', e.target.value)}
                                aria-invalid={!!errors.phone}
                            />
                            <FieldError>{errors.phone}</FieldError>
                        </Field>
                    </CardContent>
                </Card>

                {/* Keamanan & Kata Sandi */}
                <Card>
                    <CardHeader>
                        <div className="flex items-center gap-2">
                            <Lock className="h-5 w-5 text-primary" />
                            <CardTitle className="text-lg">Ubah Kata Sandi</CardTitle>
                        </div>
                        <CardDescription>
                            Biarkan kolom kata sandi kosong jika Anda tidak ingin mengubahnya.
                        </CardDescription>
                    </CardHeader>

                    <CardContent className="space-y-4">
                        <Field>
                            <Label htmlFor="current_password">Kata Sandi Saat Ini</Label>
                            <Input
                                id="current_password"
                                type="password"
                                placeholder="Masukkan kata sandi lama Anda"
                                value={data.current_password}
                                onChange={(e) => setData('current_password', e.target.value)}
                                aria-invalid={!!errors.current_password}
                                autoComplete="current-password"
                            />
                            <FieldError>{errors.current_password}</FieldError>
                        </Field>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <Field>
                                <Label htmlFor="password">Kata Sandi Baru</Label>
                                <Input
                                    id="password"
                                    type="password"
                                    placeholder="Min. 8 karakter"
                                    value={data.password}
                                    onChange={(e) => setData('password', e.target.value)}
                                    aria-invalid={!!errors.password}
                                    autoComplete="new-password"
                                />
                                <FieldError>{errors.password}</FieldError>
                            </Field>

                            <Field>
                                <Label htmlFor="password_confirmation">Konfirmasi Kata Sandi Baru</Label>
                                <Input
                                    id="password_confirmation"
                                    type="password"
                                    placeholder="Ulangi kata sandi baru"
                                    value={data.password_confirmation}
                                    onChange={(e) => setData('password_confirmation', e.target.value)}
                                    aria-invalid={!!errors.password_confirmation}
                                    autoComplete="new-password"
                                />
                                <FieldError>{errors.password_confirmation}</FieldError>
                            </Field>
                        </div>
                    </CardContent>
                </Card>

                {/* PIN Otorisasi (Khusus Admin / Supervisor) */}
                {isPrivileged && (
                    <Card className="border-amber-500/20 bg-amber-500/5">
                        <CardHeader>
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <ShieldAlert className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                                    <CardTitle className="text-lg">PIN Otorisasi Transaksi</CardTitle>
                                </div>
                                <span className="text-xs font-mono font-medium text-amber-700 dark:text-amber-400">
                                    {user.has_pin ? '● PIN Aktif' : '○ Belum Diatur'}
                                </span>
                            </div>
                            <CardDescription>
                                Digunakan untuk otorisasi tindakan sensitif pada modul kasir/supervisor (misal: diskon manual, void, hapus transaksi).
                            </CardDescription>
                        </CardHeader>

                        <CardContent>
                            <Field className="max-w-xs">
                                <Label htmlFor="profile-pin" className="text-xs">
                                    PIN Baru (6 Digit Angka)
                                </Label>
                                <Input
                                    id="profile-pin"
                                    type="password"
                                    inputMode="numeric"
                                    maxLength={6}
                                    placeholder={user.has_pin ? '****** (Biarkan kosong jika tidak diubah)' : 'Masukkan 6 digit angka'}
                                    value={data.pin}
                                    onChange={(e) => setData('pin', e.target.value.replace(/\D/g, '').slice(0, 6))}
                                    aria-invalid={!!errors.pin}
                                    autoComplete="off"
                                    className="font-mono tracking-widest mt-1"
                                />
                                <FieldError>{errors.pin}</FieldError>
                            </Field>
                        </CardContent>
                    </Card>
                )}

                <div className="flex justify-end gap-3 pt-2">
                    <Button type="submit" disabled={processing} size="lg" className="min-w-[150px]">
                        {processing ? 'Menyimpan…' : 'Simpan Perubahan'}
                    </Button>
                </div>
            </form>
        </div>
    )
}

ProfilePage.layout = (page: React.ReactNode) => (
    <AuthenticatedLayout>{page}</AuthenticatedLayout>
)

export default ProfilePage

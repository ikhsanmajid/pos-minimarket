import React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Separator } from '@/components/ui/separator'
import {
    Mail,
    Phone,
    Shield,
    Calendar,
    Clock,
    ShieldAlert,
    CheckCircle2,
    XCircle,
    LogIn,
    UserCheck,
} from 'lucide-react'
import { useAuth } from '@/hooks/use-auth'
import { roleBadgeClass } from '../Users'
import type { DetailUser } from '../DetailUser'

function getInitials(name: string): string {
    return name
        .split(' ')
        .slice(0, 2)
        .map((n) => n[0]?.toUpperCase() ?? '')
        .join('')
}

function DetailRow({
    icon: Icon,
    label,
    value,
}: {
    icon: React.ElementType
    label: string
    value: React.ReactNode
}) {
    return (
        <div className="flex items-start gap-3.5">
            <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                <Icon className="h-4 w-4" />
            </div>
            <div className="flex-1 space-y-0.5 min-w-0">
                <p className="text-xs text-muted-foreground">{label}</p>
                <div className="text-sm font-medium text-foreground">{value}</div>
            </div>
        </div>
    )
}

interface DetailTabUserProps {
    user: DetailUser
}

export function DetailTabUser({ user }: DetailTabUserProps) {
    const { user: currentUser } = useAuth()
    const isSelf = currentUser?.id === user.id
    const roleCls = roleBadgeClass[user.role] ?? ''
    const isPrivileged = user.role === 'admin' || user.role === 'supervisor'

    return (
        <div className="space-y-6">
            {/* Header Profil Ringkasan */}
            <Card>
                <CardHeader className="p-6">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                        <div className="flex items-center gap-4">
                            <Avatar size="lg" className="h-16 w-16 text-xl">
                                <AvatarFallback className="font-semibold bg-primary/10 text-primary">
                                    {getInitials(user.name)}
                                </AvatarFallback>
                            </Avatar>
                            <div>
                                <CardTitle className="text-xl font-bold tracking-tight text-foreground">
                                    {user.name}
                                </CardTitle>
                                <div className="mt-1.5 flex flex-wrap items-center gap-2">
                                    <Badge className={roleCls}>{user.role_name}</Badge>
                                    {user.is_active ? (
                                        <Badge variant="success" className="gap-1">
                                            <CheckCircle2 className="h-3 w-3" />
                                            Aktif
                                        </Badge>
                                    ) : (
                                        <Badge variant="secondary" className="gap-1">
                                            <XCircle className="h-3 w-3" />
                                            Nonaktif
                                        </Badge>
                                    )}
                                    {isSelf && (
                                        <Badge variant="outline" className="border-primary/40 text-primary gap-1">
                                            <UserCheck className="h-3 w-3" />
                                            Akun Anda
                                        </Badge>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </CardHeader>
            </Card>

            {/* Detail Grid: Kontak & Keamanan */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Kolom 1: Informasi Akun & Kontak */}
                <Card>
                    <CardHeader className="pb-3 border-b">
                        <CardTitle className="text-sm font-semibold flex items-center gap-2">
                            <Shield className="h-4 w-4 text-primary" />
                            Informasi Kontak & Akun
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-4 space-y-4">
                        <DetailRow
                            icon={Mail}
                            label="Alamat Email"
                            value={
                                <a
                                    href={`mailto:${user.email}`}
                                    className="text-primary hover:underline font-mono text-xs sm:text-sm"
                                >
                                    {user.email}
                                </a>
                            }
                        />

                        <Separator />

                        <DetailRow
                            icon={Phone}
                            label="Nomor Telepon / WhatsApp"
                            value={
                                user.phone ? (
                                    <span className="font-mono">{user.phone}</span>
                                ) : (
                                    <span className="text-muted-foreground">-</span>
                                )
                            }
                        />

                        <Separator />

                        <DetailRow
                            icon={Shield}
                            label="Role & Hak Akses"
                            value={<Badge className={roleCls}>{user.role_name}</Badge>}
                        />
                    </CardContent>
                </Card>

                {/* Kolom 2: Keamanan & Riwayat Sistem */}
                <Card>
                    <CardHeader className="pb-3 border-b">
                        <CardTitle className="text-sm font-semibold flex items-center gap-2">
                            <ShieldAlert className="h-4 w-4 text-primary" />
                            Akses & Riwayat Sistem
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-4 space-y-4">
                        {isPrivileged && (
                            <>
                                <DetailRow
                                    icon={ShieldAlert}
                                    label="PIN Otorisasi Transaksi"
                                    value={
                                        user.has_pin ? (
                                            <Badge variant="outline" className="border-emerald-500/40 text-emerald-600 dark:text-emerald-400">
                                                Terpasang (6 Digit)
                                            </Badge>
                                        ) : (
                                            <Badge variant="outline" className="border-amber-500/40 text-amber-600 dark:text-amber-400">
                                                Belum Diatur
                                            </Badge>
                                        )
                                    }
                                />
                                <Separator />
                            </>
                        )}

                        <DetailRow
                            icon={LogIn}
                            label="Login Terakhir"
                            value={
                                user.last_login_at ?? (
                                    <span className="text-muted-foreground">Belum pernah login</span>
                                )
                            }
                        />

                        <Separator />

                        <DetailRow
                            icon={Calendar}
                            label="Tanggal Terdaftar"
                            value={user.created_at}
                        />

                        <Separator />

                        <DetailRow
                            icon={Clock}
                            label="Terakhir Diperbarui"
                            value={user.updated_at}
                        />
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}

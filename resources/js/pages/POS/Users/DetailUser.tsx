import React from 'react'
import { Link, usePage } from '@inertiajs/react'
import AuthenticatedLayout from '@/layouts/AuthenticatedLayout'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { index, edit, destroy } from '@/actions/App/Http/Controllers/UserController'
import { ArrowLeft, Pencil, Mail, Shield, Calendar, Clock, Trash2 } from 'lucide-react'
import type { PageProps } from '@/types'
import { useAuth } from '@/hooks/use-auth'
import { roleBadgeClass } from './Users'
import { DialogDeleteUser } from './component/DialogDeleteUser'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type DetailUser = {
    id: number
    name: string
    email: string
    role: string
    role_name: string
    created_at: string
    updated_at: string
}

type DetailUserPageProps = PageProps<{ user: DetailUser }>

// ---------------------------------------------------------------------------
// Helper: inisial dari nama
// ---------------------------------------------------------------------------

function getInitials(name: string): string {
    return name
        .split(' ')
        .slice(0, 2)
        .map((n) => n[0]?.toUpperCase() ?? '')
        .join('')
}

// ---------------------------------------------------------------------------
// Row item in detail card
// ---------------------------------------------------------------------------

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
        <div className="flex items-start gap-4">
            <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted">
                <Icon className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="flex-1 space-y-0.5">
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className="text-sm font-medium">{value}</p>
            </div>
        </div>
    )
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

const DetailUser = () => {
    const { user } = usePage<DetailUserPageProps>().props
    const { user: currentUser } = useAuth()
    const [deleteOpen, setDeleteOpen] = React.useState(false)
    const isSelf = currentUser?.id === user.id
    const roleCls = roleBadgeClass[user.role] ?? ''

    return (
        <div className="p-6 max-w-2xl mx-auto">
            {/* Back */}
            <div className="mb-6">
                <Button
                    variant="ghost"
                    size="sm"
                    render={<Link href={index.url()} />}
                    className="gap-1.5 text-muted-foreground"
                >
                    <ArrowLeft className="h-4 w-4" />
                    Kembali ke daftar pengguna
                </Button>
            </div>

            <Card>
                {/* Profile header */}
                <CardHeader className="border-b pb-6">
                    <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-4">
                            <Avatar size="lg" className="h-16 w-16 text-xl">
                                <AvatarFallback>{getInitials(user.name)}</AvatarFallback>
                            </Avatar>
                            <div>
                                <CardTitle className="text-xl">{user.name}</CardTitle>
                                <Badge className={`mt-1 ${roleCls}`}>{user.role_name}</Badge>
                            </div>
                        </div>
                    </div>
                </CardHeader>

                <CardContent className="pt-6 space-y-5">
                    <DetailRow
                        icon={Mail}
                        label="Alamat Email"
                        value={
                            <a
                                href={`mailto:${user.email}`}
                                className="text-primary underline-offset-4 hover:underline"
                            >
                                {user.email}
                            </a>
                        }
                    />

                    <Separator />

                    <DetailRow
                        icon={Shield}
                        label="Role / Jabatan"
                        value={<Badge className={roleCls}>{user.role_name}</Badge>}
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

            <DialogDeleteUser
                user={user}
                destroyUrl={destroy.url(user.id)}
                open={deleteOpen}
                onOpenChange={setDeleteOpen}
            />
        </div>
    )
}

DetailUser.layout = (page: React.ReactNode) => (
    <AuthenticatedLayout>{page}</AuthenticatedLayout>
)

export default DetailUser

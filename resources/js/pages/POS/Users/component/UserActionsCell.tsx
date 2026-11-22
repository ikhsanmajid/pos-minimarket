import * as React from 'react'
import { Link } from '@inertiajs/react'
import { Button } from '@/components/ui/button'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { MoreHorizontal, Eye, Pencil, Trash2 } from 'lucide-react'
import { DialogEditUser } from './DialogEditUser'
import { DialogDeleteUser } from './DialogDeleteUser'
import type { UserRow, RoleOption } from '../Users'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface UserActionsCellProps {
    user: UserRow
    roles: RoleOption[]
    currentUserId: number
    detailUrl: string
    destroyUrl: string
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function UserActionsCell({
    user,
    roles,
    currentUserId,
    detailUrl,
    destroyUrl,
}: UserActionsCellProps) {
    const isSelf = user.id === currentUserId
    const [editOpen, setEditOpen] = React.useState(false)
    const [deleteOpen, setDeleteOpen] = React.useState(false)

    return (
        <>
            {/* ---- Dropdown trigger ---- */}
            <DropdownMenu>
                <DropdownMenuTrigger render={
                    <Button
                        variant="ghost"
                        size="icon-sm"
                        className="data-[popup-open]:bg-muted"
                        aria-label="Aksi"
                    />
                }>
                    <MoreHorizontal className="h-4 w-4" />
                </DropdownMenuTrigger>

                <DropdownMenuContent align="end" className="w-44">
                    {/* Detail */}
                    <DropdownMenuItem render={<Link href={detailUrl} />}>
                        <Eye className="mr-2 h-4 w-4" />
                        Lihat Detail
                    </DropdownMenuItem>

                    {/* Edit */}
                    <DropdownMenuItem
                        disabled={isSelf}
                        className={isSelf ? 'cursor-not-allowed opacity-50' : ''}
                        onClick={isSelf ? undefined : () => setEditOpen(true)}
                    >
                        <Pencil className="mr-2 h-4 w-4" />
                        Edit
                    </DropdownMenuItem>

                    <DropdownMenuSeparator />

                    {/* Hapus */}
                    <DropdownMenuItem
                        className={
                            isSelf
                                ? 'cursor-not-allowed opacity-50'
                                : 'text-destructive focus:text-destructive'
                        }
                        disabled={isSelf}
                        onClick={isSelf ? undefined : () => setDeleteOpen(true)}
                    >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Hapus
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>

            {/* ---- Edit Dialog ---- */}
            <DialogEditUser
                user={user}
                roles={roles}
                open={editOpen}
                onOpenChange={setEditOpen}
            />

            {/* ---- Delete Confirm Dialog ---- */}
            <DialogDeleteUser
                user={user}
                destroyUrl={destroyUrl}
                open={deleteOpen}
                onOpenChange={setDeleteOpen}
            />
        </>
    )
}

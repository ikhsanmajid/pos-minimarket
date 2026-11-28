import * as React from 'react'
import { Button } from '@/components/ui/button'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { MoreHorizontal, Pencil, Trash2 } from 'lucide-react'
import CashRegisterController from '@/actions/App/Http/Controllers/CashRegisterController'
import type { CashRegisterRow } from '../CashRegister'
import { DialogEditCashRegister } from './DialogEditCashRegister'
import { AlertDialogDeleteCashRegister } from './AlertDialogDeleteCashRegister'

interface CashRegisterActionsCellProps {
    cashRegister: CashRegisterRow
    canEdit: boolean
    canDelete: boolean
}

export function CashRegisterActionsCell({
    cashRegister,
    canEdit,
    canDelete,
}: CashRegisterActionsCellProps) {
    const [editOpen, setEditOpen] = React.useState(false)
    const [deleteOpen, setDeleteOpen] = React.useState(false)

    if (!canEdit && !canDelete) {
        return null
    }

    return (
        <>
            <DropdownMenu>
                <DropdownMenuTrigger
                    render={
                        <Button
                            variant="ghost"
                            size="icon-sm"
                            className="data-[popup-open]:bg-muted cursor-pointer"
                            aria-label="Aksi"
                        />
                    }
                >
                    <MoreHorizontal className="h-4 w-4" />
                </DropdownMenuTrigger>

                <DropdownMenuContent align="end" className="w-36">
                    {canEdit && (
                        <DropdownMenuItem onClick={() => setEditOpen(true)} className="cursor-pointer">
                            <Pencil className="mr-2 h-4 w-4" />
                            Edit
                        </DropdownMenuItem>
                    )}

                    {canEdit && canDelete && <DropdownMenuSeparator />}

                    {canDelete && (
                        <DropdownMenuItem
                            className="text-destructive focus:text-destructive cursor-pointer"
                            onClick={() => setDeleteOpen(true)}
                        >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Hapus
                        </DropdownMenuItem>
                    )}
                </DropdownMenuContent>
            </DropdownMenu>

            {canEdit && (
                <DialogEditCashRegister
                    cashRegister={cashRegister}
                    updateUrl={CashRegisterController.update.url(cashRegister.id)}
                    open={editOpen}
                    onOpenChange={setEditOpen}
                />
            )}

            {canDelete && (
                <AlertDialogDeleteCashRegister
                    cashRegister={cashRegister}
                    destroyUrl={CashRegisterController.destroy.url(cashRegister.id)}
                    open={deleteOpen}
                    onOpenChange={setDeleteOpen}
                />
            )}
        </>
    )
}

export default CashRegisterActionsCell

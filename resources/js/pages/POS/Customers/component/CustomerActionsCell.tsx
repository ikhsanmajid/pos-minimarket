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
import { DialogEditCustomer } from './DialogEditCustomer'
import { DialogDeleteCustomer } from './DialogDeleteCustomer'
import type { CustomerRow } from '../Customer'
import CustomerController from '@/actions/App/Http/Controllers/CustomerController'

interface CustomerActionsCellProps {
    customer: CustomerRow
    canEdit: boolean
    canDelete: boolean
    detailUrl?: string
}

export function CustomerActionsCell({
    customer,
    canEdit,
    canDelete,
    detailUrl,
}: CustomerActionsCellProps) {
    const [editOpen, setEditOpen] = React.useState(false)
    const [deleteOpen, setDeleteOpen] = React.useState(false)

    if (!canEdit && !canDelete && !detailUrl) {
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

                <DropdownMenuContent align="end" className="w-40">
                    {detailUrl && (
                        <DropdownMenuItem
                            render={
                                <Link
                                    href={detailUrl}
                                    className="flex items-center gap-2 cursor-pointer w-full"
                                />
                            }
                        >
                            <Eye className="h-3.5 w-3.5" />
                            <span>Lihat Detail</span>
                        </DropdownMenuItem>
                    )}

                    {canEdit && (
                        <DropdownMenuItem
                            onClick={() => setEditOpen(true)}
                            className="cursor-pointer gap-2"
                        >
                            <Pencil className="h-3.5 w-3.5" />
                            <span>Edit</span>
                        </DropdownMenuItem>
                    )}

                    {canDelete && (
                        <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                                onClick={() => setDeleteOpen(true)}
                                variant="destructive"
                                className="cursor-pointer gap-2"
                            >
                                <Trash2 className="h-3.5 w-3.5" />
                                <span>Hapus</span>
                            </DropdownMenuItem>
                        </>
                    )}
                </DropdownMenuContent>
            </DropdownMenu>

            {canEdit && (
                <DialogEditCustomer
                    customer={customer}
                    updateUrl={CustomerController.update.url(customer.id)}
                    open={editOpen}
                    onOpenChange={setEditOpen}
                />
            )}

            {canDelete && (
                <DialogDeleteCustomer
                    customer={customer}
                    destroyUrl={CustomerController.destroy.url(customer.id)}
                    open={deleteOpen}
                    onOpenChange={setDeleteOpen}
                />
            )}
        </>
    )
}

export default CustomerActionsCell

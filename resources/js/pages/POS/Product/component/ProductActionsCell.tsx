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
import { DialogEditProduct } from './DialogEditProduct'
import { DialogDeleteProduct } from './DialogDeleteProduct'
import type { Category, Product } from '../Product'

interface ProductActionsCellProps {
    product: Product
    categories: Category[]
    canEdit: boolean
    canDelete: boolean
    detailUrl: string
    destroyUrl: string
}

export function ProductActionsCell({
    product,
    categories,
    canEdit,
    canDelete,
    detailUrl,
    destroyUrl,
}: ProductActionsCellProps) {
    const [editOpen, setEditOpen] = React.useState(false)
    const [deleteOpen, setDeleteOpen] = React.useState(false)

    return (
        <>
            <DropdownMenu>
                <DropdownMenuTrigger
                    render={
                        <Button
                            variant="ghost"
                            size="icon-sm"
                            className="data-[popup-open]:bg-muted"
                            aria-label="Aksi"
                        />
                    }
                >
                    <MoreHorizontal className="h-4 w-4" />
                </DropdownMenuTrigger>

                <DropdownMenuContent align="end" className="w-44">
                    {/* Detail */}
                    <DropdownMenuItem render={<Link href={detailUrl} />}>
                        <Eye className="mr-2 h-4 w-4" />
                        Lihat Detail
                    </DropdownMenuItem>

                    {/* Edit */}
                    {canEdit && (
                        <DropdownMenuItem onClick={() => setEditOpen(true)}>
                            <Pencil className="mr-2 h-4 w-4" />
                            Edit
                        </DropdownMenuItem>
                    )}

                    {canDelete && (
                        <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                                className="text-destructive focus:text-destructive"
                                onClick={() => setDeleteOpen(true)}
                            >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Hapus
                            </DropdownMenuItem>
                        </>
                    )}
                </DropdownMenuContent>
            </DropdownMenu>

            {/* Dialog Edit */}
            {canEdit && (
                <DialogEditProduct
                    product={product}
                    categories={categories}
                    open={editOpen}
                    onOpenChange={setEditOpen}
                />
            )}

            {/* Dialog Hapus */}
            {canDelete && (
                <DialogDeleteProduct
                    product={product}
                    destroyUrl={destroyUrl}
                    open={deleteOpen}
                    onOpenChange={setDeleteOpen}
                />
            )}
        </>
    )
}

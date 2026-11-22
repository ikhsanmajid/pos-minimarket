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
import { DialogEditCategory } from './DialogEditCategory'
import { AlertDialogDeleteCategory } from './AlertDialogDeleteCategory'
import type { CategoryRow } from '../Category'
import CategoryController from '@/actions/App/Http/Controllers/CategoryController'

interface CategoryActionsCellProps {
    category: CategoryRow
    canEdit: boolean
    canDelete: boolean
}

export function CategoryActionsCell({
    category,
    canEdit,
    canDelete,
}: CategoryActionsCellProps) {
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
                <DialogEditCategory
                    category={category}
                    updateUrl={CategoryController.update.url(category.id)}
                    open={editOpen}
                    onOpenChange={setEditOpen}
                />
            )}

            {canDelete && (
                <AlertDialogDeleteCategory
                    category={category}
                    destroyUrl={CategoryController.destroy.url(category.id)}
                    open={deleteOpen}
                    onOpenChange={setDeleteOpen}
                />
            )}
        </>
    )
}

export default CategoryActionsCell

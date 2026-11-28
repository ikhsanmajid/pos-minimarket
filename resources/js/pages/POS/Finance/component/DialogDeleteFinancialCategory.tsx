import * as React from 'react'
import { router } from '@inertiajs/react'
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import FinancialCategoryController from '@/actions/App/Http/Controllers/FinancialCategoryController'
import type { FinancialCategoryRow } from '../FinancialCategory'

interface DialogDeleteFinancialCategoryProps {
    category: FinancialCategoryRow | null
    open: boolean
    onOpenChange: (open: boolean) => void
}

export function DialogDeleteFinancialCategory({
    category,
    open,
    onOpenChange,
}: DialogDeleteFinancialCategoryProps) {
    const [isDeleting, setIsDeleting] = React.useState(false)

    const handleDelete = () => {
        if (!category) return
        setIsDeleting(true)
        router.delete(FinancialCategoryController.destroy.url(category.id), {
            preserveScroll: true,
            onFinish: () => {
                setIsDeleting(false)
                onOpenChange(false)
            },
        })
    }

    return (
        <AlertDialog open={open} onOpenChange={onOpenChange}>
            <AlertDialogContent size="sm">
                <AlertDialogHeader>
                    <AlertDialogTitle>Hapus Kategori Keuangan</AlertDialogTitle>
                    <AlertDialogDescription>
                        Yakin ingin menghapus kategori <strong>{category?.name}</strong> (
                        <span className="font-mono">{category?.code}</span>)?
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel disabled={isDeleting}>Batal</AlertDialogCancel>
                    <AlertDialogAction
                        variant="destructive"
                        disabled={isDeleting}
                        onClick={handleDelete}
                    >
                        {isDeleting ? 'Menghapus...' : 'Ya, Hapus'}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    )
}

export default DialogDeleteFinancialCategory

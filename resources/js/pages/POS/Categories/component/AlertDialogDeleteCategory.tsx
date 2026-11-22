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
import { Trash2 } from 'lucide-react'
import type { CategoryRow } from '../Category'

interface AlertDialogDeleteCategoryProps {
    category: CategoryRow
    destroyUrl: string
    open: boolean
    onOpenChange: (open: boolean) => void
}

export function AlertDialogDeleteCategory({
    category,
    destroyUrl,
    open,
    onOpenChange,
}: AlertDialogDeleteCategoryProps) {
    const [processing, setProcessing] = React.useState(false)

    const handleConfirm = () => {
        setProcessing(true)
        router.delete(destroyUrl, {
            preserveScroll: true,
            onFinish: () => {
                setProcessing(false)
                onOpenChange(false)
            },
        })
    }

    return (
        <AlertDialog open={open} onOpenChange={onOpenChange}>
            <AlertDialogContent size="sm">
                <AlertDialogHeader>
                    <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
                        <Trash2 className="h-6 w-6 text-destructive" />
                    </div>
                    <AlertDialogTitle className="text-center">Hapus Kategori</AlertDialogTitle>
                    <AlertDialogDescription className="text-center">
                        Yakin ingin menghapus kategori{' '}
                        <strong className="text-foreground">{category.name}</strong>?
                        {category.products_count > 0 && (
                            <span className="block mt-2 text-destructive font-medium">
                                Perhatian: Kategori ini masih memiliki {category.products_count} produk terhubung.
                            </span>
                        )}
                    </AlertDialogDescription>
                </AlertDialogHeader>

                <AlertDialogFooter className="mt-2 sm:flex-row sm:justify-center gap-2">
                    <AlertDialogCancel disabled={processing}>
                        Batal
                    </AlertDialogCancel>
                    <AlertDialogAction
                        variant="destructive"
                        onClick={handleConfirm}
                        disabled={processing}
                    >
                        {processing ? 'Menghapus…' : 'Ya, Hapus'}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    )
}

export default AlertDialogDeleteCategory

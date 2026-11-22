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
import type { SupplierRow } from '../Supplier'

interface DialogDeleteSupplierProps {
    supplier: SupplierRow
    destroyUrl: string
    open: boolean
    onOpenChange: (open: boolean) => void
}

export function DialogDeleteSupplier({
    supplier,
    destroyUrl,
    open,
    onOpenChange,
}: DialogDeleteSupplierProps) {
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
                    <AlertDialogTitle className="text-center">Hapus Supplier</AlertDialogTitle>
                    <AlertDialogDescription className="text-center">
                        Yakin ingin menghapus data supplier{' '}
                        <strong className="text-foreground">{supplier.name}</strong> ({supplier.code})?
                        {supplier.purchase_orders_count > 0 && (
                            <span className="block mt-2 text-destructive font-medium">
                                Perhatian: Supplier ini memiliki {supplier.purchase_orders_count} riwayat PO dan tidak dapat dihapus.
                            </span>
                        )}
                    </AlertDialogDescription>
                </AlertDialogHeader>

                <AlertDialogFooter>
                    <AlertDialogCancel disabled={processing}>Batal</AlertDialogCancel>
                    <AlertDialogAction
                        variant="destructive"
                        onClick={handleConfirm}
                        disabled={processing || supplier.purchase_orders_count > 0}
                    >
                        {processing ? 'Menghapus...' : 'Ya, Hapus'}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    )
}
export default DialogDeleteSupplier

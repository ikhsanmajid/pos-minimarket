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
import type { CustomerRow } from '../Customer'

interface DialogDeleteCustomerProps {
    customer: CustomerRow
    destroyUrl: string
    open: boolean
    onOpenChange: (open: boolean) => void
}

export function DialogDeleteCustomer({
    customer,
    destroyUrl,
    open,
    onOpenChange,
}: DialogDeleteCustomerProps) {
    const [isDeleting, setIsDeleting] = React.useState(false)

    const handleDelete = () => {
        setIsDeleting(true)
        router.delete(destroyUrl, {
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
                    <AlertDialogTitle>Hapus Pelanggan</AlertDialogTitle>
                    <AlertDialogDescription>
                        Yakin ingin menghapus pelanggan <strong>{customer.name}</strong> (
                        <span className="font-mono">{customer.member_code}</span>)? Riwayat transaksi
                        belanja lama akan tetap tersimpan dengan aman.
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

export default DialogDeleteCustomer

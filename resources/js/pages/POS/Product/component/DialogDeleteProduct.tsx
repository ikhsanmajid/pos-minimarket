import * as React from 'react'
import { router } from '@inertiajs/react'
import { Button } from '@/components/ui/button'
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import { Trash2 } from 'lucide-react'
import type { Product } from '../Product'

interface DialogDeleteProductProps {
    product: Product
    destroyUrl: string
    open: boolean
    onOpenChange: (open: boolean) => void
}

export function DialogDeleteProduct({
    product,
    destroyUrl,
    open,
    onOpenChange,
}: DialogDeleteProductProps) {
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
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent showCloseButton={false} className="sm:max-w-sm">
                <DialogHeader>
                    <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
                        <Trash2 className="h-6 w-6 text-destructive" />
                    </div>
                    <DialogTitle className="text-center">Hapus Produk</DialogTitle>
                    <DialogDescription className="text-center">
                        Yakin ingin menghapus produk{' '}
                        <strong className="text-foreground">{product.name}</strong>{' '}
                        (Barcode: {product.barcode})? Tindakan ini tidak dapat dibatalkan.
                    </DialogDescription>
                </DialogHeader>

                <DialogFooter className="mt-2 sm:flex-row sm:justify-center gap-2">
                    <DialogClose render={<Button variant="outline" className="flex-1 sm:flex-none" />}>
                        Batal
                    </DialogClose>
                    <Button
                        variant="destructive"
                        className="flex-1 sm:flex-none bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        onClick={handleConfirm}
                        disabled={processing}
                    >
                        {processing ? 'Menghapus…' : 'Ya, Hapus'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

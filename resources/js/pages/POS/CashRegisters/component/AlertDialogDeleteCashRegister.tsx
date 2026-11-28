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
import type { CashRegisterRow } from '../CashRegister'

interface AlertDialogDeleteCashRegisterProps {
    cashRegister: CashRegisterRow
    destroyUrl: string
    open: boolean
    onOpenChange: (open: boolean) => void
}

export function AlertDialogDeleteCashRegister({
    cashRegister,
    destroyUrl,
    open,
    onOpenChange,
}: AlertDialogDeleteCashRegisterProps) {
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
                    <AlertDialogTitle className="text-center">Hapus Kasir Fisik</AlertDialogTitle>
                    <AlertDialogDescription className="text-center">
                        Yakin ingin menghapus kasir fisik{' '}
                        <strong className="text-foreground">
                            {cashRegister.name} ({cashRegister.code})
                        </strong>
                        ?
                        {cashRegister.is_in_use && (
                            <span className="block mt-2 text-destructive font-medium">
                                Kasir ini sedang digunakan pada shift aktif dan tidak dapat dihapus sebelum shift ditutup.
                            </span>
                        )}
                        {!cashRegister.is_in_use && cashRegister.shifts_count > 0 && (
                            <span className="block mt-2 text-muted-foreground">
                                Riwayat {cashRegister.shifts_count} shift sebelumnya tetap tersimpan dengan aman.
                            </span>
                        )}
                    </AlertDialogDescription>
                </AlertDialogHeader>

                <AlertDialogFooter className="mt-2 sm:flex-row sm:justify-center gap-2">
                    <AlertDialogCancel disabled={processing}>Batal</AlertDialogCancel>
                    <AlertDialogAction
                        variant="destructive"
                        onClick={handleConfirm}
                        disabled={processing || cashRegister.is_in_use}
                    >
                        {processing ? 'Menghapus…' : 'Ya, Hapus'}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    )
}

export default AlertDialogDeleteCashRegister

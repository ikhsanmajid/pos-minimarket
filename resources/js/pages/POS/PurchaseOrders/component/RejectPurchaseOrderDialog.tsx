import * as React from 'react'
import { useForm } from '@inertiajs/react'
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
import { Label } from '@/components/ui/label'
import { Field, FieldError } from '@/components/ui/field'
import { XCircle } from 'lucide-react'
import PurchaseOrderController from '@/actions/App/Http/Controllers/PurchaseOrderController'

interface RejectPurchaseOrderDialogProps {
    poId: number
    poNumber: string
    open: boolean
    onOpenChange: (open: boolean) => void
}

export function RejectPurchaseOrderDialog({
    poId,
    poNumber,
    open,
    onOpenChange,
}: RejectPurchaseOrderDialogProps) {
    const { data, setData, post, processing, errors, reset, clearErrors } = useForm({
        rejection_reason: '',
    })

    React.useEffect(() => {
        if (open) {
            reset()
            clearErrors()
        }
    }, [open])

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        post(PurchaseOrderController.reject.url(poId), {
            preserveScroll: true,
            onSuccess: () => {
                onOpenChange(false)
            },
        })
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md max-h-[85vh] flex flex-col p-0 gap-0 overflow-hidden">
                <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden">
                    <DialogHeader className="p-6 pb-4 border-b shrink-0">
                        <DialogTitle className="flex items-center gap-2 text-rose-600 dark:text-rose-400">
                            <XCircle className="h-5 w-5" />
                            Tolak Purchase Order: {poNumber}
                        </DialogTitle>
                        <DialogDescription className="text-xs">
                            Berikan alasan penolakan yang jelas agar pembuat PO dapat merevisi dan mengajukan ulang.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="flex-1 overflow-y-auto overflow-x-hidden p-6 space-y-3">
                        <Field>
                            <Label htmlFor="reject-reason" className="text-xs">
                                Alasan Penolakan <span className="text-destructive">*</span>
                            </Label>
                            <textarea
                                id="reject-reason"
                                rows={4}
                                value={data.rejection_reason}
                                onChange={(e) => setData('rejection_reason', e.target.value)}
                                placeholder="Contoh: Harga beli dari supplier terlalu tinggi, harap negosiasi ulang atau kurangi qty pesanan..."
                                className="w-full mt-1 rounded-md border border-input bg-background p-2.5 text-xs shadow-xs"
                                required
                                minLength={5}
                            />
                            <FieldError>{errors.rejection_reason}</FieldError>
                        </Field>
                    </div>

                    <DialogFooter className="p-6 pt-4 border-t shrink-0 flex items-center justify-end gap-2 bg-muted/20">
                        <DialogClose render={<Button type="button" variant="outline" size="sm">Batal</Button>} />
                        <Button
                            type="submit"
                            variant="destructive"
                            size="sm"
                            disabled={processing || data.rejection_reason.trim().length < 5}
                        >
                            {processing ? 'Menolak...' : 'Tolak PO'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}

export default RejectPurchaseOrderDialog

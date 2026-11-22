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
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import { CreditCard } from 'lucide-react'
import PurchaseOrderController from '@/actions/App/Http/Controllers/PurchaseOrderController'

interface PaymentStatusDialogProps {
    poId: number
    poNumber: string
    currentStatus: string
    open: boolean
    onOpenChange: (open: boolean) => void
}

const PAYMENT_STATUS_OPTIONS = [
    { value: 'unpaid', label: 'Belum Dibayar (Unpaid)' },
    { value: 'partial', label: 'Dibayar Sebagian (Partial)' },
    { value: 'paid', label: 'Lunas (Paid)' },
] as const

export function PaymentStatusDialog({
    poId,
    poNumber,
    currentStatus,
    open,
    onOpenChange,
}: PaymentStatusDialogProps) {
    const [status, setStatus] = React.useState(currentStatus)
    const [processing, setProcessing] = React.useState(false)

    React.useEffect(() => {
        if (open) {
            setStatus(currentStatus)
        }
    }, [open, currentStatus])

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        setProcessing(true)
        router.patch(
            PurchaseOrderController.updatePaymentStatus.url(poId),
            { payment_status: status },
            {
                preserveScroll: true,
                onFinish: () => {
                    setProcessing(false)
                    onOpenChange(false)
                },
            }
        )
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <form onSubmit={handleSubmit} className="space-y-4">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <CreditCard className="h-5 w-5 text-primary" />
                            Status Pembayaran: {poNumber}
                        </DialogTitle>
                        <DialogDescription>
                            Pilih status pelunasan pembayaran faktur tagihan PO ini.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="py-2">
                        <label className="text-xs font-medium text-foreground block mb-1.5">
                            Status Tagihan
                        </label>
                        <Select
                            items={PAYMENT_STATUS_OPTIONS}
                            value={status}
                            onValueChange={(val) => setStatus(val ?? 'unpaid')}
                        >
                            <SelectTrigger className="w-full">
                                <SelectValue placeholder="Pilih status">
                                    {(val) =>
                                        PAYMENT_STATUS_OPTIONS.find((opt) => opt.value === val)?.label ??
                                        'Pilih status'
                                    }
                                </SelectValue>
                            </SelectTrigger>
                            <SelectContent alignItemWithTrigger={false}>
                                {PAYMENT_STATUS_OPTIONS.map((opt) => (
                                    <SelectItem key={opt.value} value={opt.value}>
                                        {opt.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <DialogFooter>
                        <DialogClose
                            render={<Button type="button" variant="outline">Batal</Button>}
                        />
                        <Button type="submit" disabled={processing}>
                            {processing ? 'Menyimpan...' : 'Perbarui Status'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}
export default PaymentStatusDialog

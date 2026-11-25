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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Field, FieldError } from '@/components/ui/field'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import { CreditCard, Wallet } from 'lucide-react'
import {
    formatRupiah,
    type FinancialAccountOption,
    type SelectOptionItem,
} from './purchaseOrderUtils'

interface RecordPaymentDialogProps {
    postUrl: string
    title: string
    subtitle?: string
    remainingAmount: number
    invoiceNumber?: string | null
    financialAccounts: FinancialAccountOption[]
    paymentMethods: SelectOptionItem[]
    open: boolean
    onOpenChange: (open: boolean) => void
}

export function RecordPaymentDialog({
    postUrl,
    title,
    subtitle,
    remainingAmount,
    invoiceNumber,
    financialAccounts,
    paymentMethods,
    open,
    onOpenChange,
}: RecordPaymentDialogProps) {
    const defaultAccount = React.useMemo(
        () => financialAccounts.find((a) => a.is_default) ?? financialAccounts[0] ?? null,
        [financialAccounts]
    )

    const { data, setData, post, processing, errors, clearErrors } = useForm({
        financial_account_id: defaultAccount ? String(defaultAccount.id) : '',
        amount: String(remainingAmount || ''),
        payment_date: new Date().toISOString().split('T')[0],
        payment_method: 'transfer',
        reference_number: '',
        invoice_number: invoiceNumber || '',
        notes: '',
    })

    React.useEffect(() => {
        if (open) {
            clearErrors()
            const defaultAcc = financialAccounts.find((a) => a.is_default) ?? financialAccounts[0]
            setData({
                financial_account_id: defaultAcc ? String(defaultAcc.id) : '',
                amount: remainingAmount > 0 ? String(remainingAmount) : '',
                payment_date: new Date().toISOString().split('T')[0],
                payment_method: defaultAcc?.type === 'cash' ? 'cash' : 'transfer',
                reference_number: '',
                invoice_number: invoiceNumber || '',
                notes: '',
            })
        }
    }, [open, remainingAmount, invoiceNumber])

    const selectedAccount = financialAccounts.find((a) => String(a.id) === data.financial_account_id)
    const payNum = Number(data.amount) || 0
    const isInsufficientBalance = selectedAccount ? payNum > selectedAccount.current_balance : false

    const accountItems = React.useMemo(
        () =>
            financialAccounts.map((acc) => ({
                value: String(acc.id),
                label: `${acc.name} (${formatRupiah(acc.current_balance)})`,
            })),
        [financialAccounts]
    )

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        post(postUrl, {
            preserveScroll: true,
            onSuccess: () => {
                onOpenChange(false)
            },
        })
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-lg max-h-[85vh] flex flex-col p-0 gap-0 overflow-hidden">
                <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden">
                    <DialogHeader className="p-6 pb-4 border-b shrink-0">
                        <DialogTitle className="flex items-center gap-2">
                            <CreditCard className="h-5 w-5 text-primary" />
                            {title}
                        </DialogTitle>
                        <DialogDescription className="text-xs">
                            {subtitle || 'Pembayaran akan memotong saldo akun kas/bank dan mencatat buku besar arus kas otomatis.'}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="flex-1 overflow-y-auto overflow-x-hidden p-6 space-y-4">
                        <div className="flex items-center justify-between rounded-lg border bg-muted/30 p-3 text-xs">
                            <span className="text-muted-foreground font-medium">Sisa Hutang Tagihan:</span>
                            <span className="font-mono text-base font-extrabold text-primary">
                                {formatRupiah(remainingAmount)}
                            </span>
                        </div>

                        <Field>
                            <Label htmlFor="pay-account" className="text-xs">
                                Rekening / Kas Sumber <span className="text-destructive">*</span>
                            </Label>
                            <Select
                                items={accountItems}
                                value={data.financial_account_id}
                                onValueChange={(val) => val && setData('financial_account_id', val)}
                            >
                                <SelectTrigger id="pay-account" className="w-full mt-1">
                                    <SelectValue placeholder="Pilih akun kas / bank">
                                        {(val) => accountItems.find((a) => a.value === val)?.label}
                                    </SelectValue>
                                </SelectTrigger>
                                <SelectContent>
                                    {accountItems.map((acc) => (
                                        <SelectItem key={acc.value} value={acc.value}>
                                            {acc.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            {selectedAccount && (
                                <p className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1">
                                    <Wallet className="h-3 w-3" />
                                    Saldo tersedia: <strong className="font-mono text-foreground">{formatRupiah(selectedAccount.current_balance)}</strong>
                                </p>
                            )}
                            <FieldError>{errors.financial_account_id}</FieldError>
                        </Field>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <Field>
                                <div className="flex items-center justify-between">
                                    <Label htmlFor="pay-amount" className="text-xs">
                                        Nominal Bayar (Rp) <span className="text-destructive">*</span>
                                    </Label>
                                    <button
                                        type="button"
                                        onClick={() => setData('amount', String(remainingAmount))}
                                        className="text-[11px] text-primary hover:underline cursor-pointer"
                                    >
                                        Bayar Lunas
                                    </button>
                                </div>
                                <Input
                                    id="pay-amount"
                                    type="number"
                                    min={1}
                                    max={remainingAmount}
                                    step="any"
                                    value={data.amount}
                                    onChange={(e) => setData('amount', e.target.value)}
                                    className="font-mono text-xs mt-1"
                                    required
                                />
                                {isInsufficientBalance && (
                                    <p className="text-[11px] text-destructive mt-1">
                                        Melebihi saldo akun {selectedAccount?.name}.
                                    </p>
                                )}
                                <FieldError>{errors.amount}</FieldError>
                            </Field>

                            <Field>
                                <Label htmlFor="pay-date" className="text-xs">
                                    Tanggal Bayar <span className="text-destructive">*</span>
                                </Label>
                                <Input
                                    id="pay-date"
                                    type="date"
                                    value={data.payment_date}
                                    onChange={(e) => setData('payment_date', e.target.value)}
                                    className="text-xs mt-1"
                                    required
                                />
                                <FieldError>{errors.payment_date}</FieldError>
                            </Field>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <Field>
                                <Label htmlFor="pay-method" className="text-xs">
                                    Metode Pembayaran <span className="text-destructive">*</span>
                                </Label>
                                <Select
                                    items={paymentMethods}
                                    value={data.payment_method}
                                    onValueChange={(val) => val && setData('payment_method', val)}
                                >
                                    <SelectTrigger id="pay-method" className="w-full mt-1">
                                        <SelectValue placeholder="Pilih metode">
                                            {(val) => paymentMethods.find((m) => m.value === val)?.label}
                                        </SelectValue>
                                    </SelectTrigger>
                                    <SelectContent>
                                        {paymentMethods.map((m) => (
                                            <SelectItem key={m.value} value={m.value}>
                                                {m.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <FieldError>{errors.payment_method}</FieldError>
                            </Field>

                            <Field>
                                <Label htmlFor="pay-ref" className="text-xs">
                                    No. Referensi / Bukti Transfer
                                </Label>
                                <Input
                                    id="pay-ref"
                                    value={data.reference_number}
                                    onChange={(e) => setData('reference_number', e.target.value)}
                                    placeholder="Contoh: TRF-88912"
                                    className="font-mono text-xs mt-1"
                                />
                                <FieldError>{errors.reference_number}</FieldError>
                            </Field>
                        </div>

                        <Field>
                            <Label htmlFor="pay-invoice" className="text-xs">
                                No. Faktur Supplier (Opsional)
                            </Label>
                            <Input
                                id="pay-invoice"
                                value={data.invoice_number}
                                onChange={(e) => setData('invoice_number', e.target.value)}
                                placeholder="Nomor tagihan / faktur dari supplier"
                                className="font-mono text-xs mt-1"
                            />
                            <FieldError>{errors.invoice_number}</FieldError>
                        </Field>

                        <Field>
                            <Label htmlFor="pay-notes" className="text-xs">
                                Catatan Pembayaran
                            </Label>
                            <textarea
                                id="pay-notes"
                                rows={2}
                                value={data.notes}
                                onChange={(e) => setData('notes', e.target.value)}
                                placeholder="Cicilan ke-1, pelunasan faktur..."
                                className="w-full mt-1 rounded-md border border-input bg-background p-2 text-xs shadow-xs"
                            />
                            <FieldError>{errors.notes}</FieldError>
                        </Field>
                    </div>

                    <DialogFooter className="p-6 pt-4 border-t shrink-0 flex items-center justify-end gap-2 bg-muted/20">
                        <DialogClose render={<Button type="button" variant="outline" size="sm">Batal</Button>} />
                        <Button
                            type="submit"
                            size="sm"
                            disabled={processing || !data.financial_account_id || payNum <= 0 || isInsufficientBalance}
                        >
                            {processing ? 'Menyimpan...' : 'Simpan Pembayaran'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}

export default RecordPaymentDialog

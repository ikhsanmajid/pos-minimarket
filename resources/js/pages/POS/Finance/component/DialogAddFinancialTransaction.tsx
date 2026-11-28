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
import { AlertTriangle, ArrowDownLeft, ArrowUpRight, Receipt } from 'lucide-react'
import { formatRupiah } from '@/lib/utils'
import FinancialTransactionController from '@/actions/App/Http/Controllers/FinancialTransactionController'

export interface ActiveFinancialAccountOption {
    id: number
    code: string
    name: string
    type: string
    type_label: string
    current_balance: number
    is_default: boolean
}

export interface ManualFinancialCategoryOption {
    id: number
    code: string
    name: string
    type: 'income' | 'expense' | string
}

interface DialogAddFinancialTransactionProps {
    accounts: ActiveFinancialAccountOption[]
    categories: ManualFinancialCategoryOption[]
    open: boolean
    onOpenChange: (open: boolean) => void
}

const getTodayDate = (): string => {
    const now = new Date()
    const y = now.getFullYear()
    const m = String(now.getMonth() + 1).padStart(2, '0')
    const d = String(now.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
}

export function DialogAddFinancialTransaction({
    accounts,
    categories,
    open,
    onOpenChange,
}: DialogAddFinancialTransactionProps) {
    const defaultAccount = accounts.find((a) => a.is_default) ?? accounts[0]

    const { data, setData, post, processing, errors, clearErrors, reset } = useForm({
        type: 'out' as 'in' | 'out',
        financial_account_id: defaultAccount ? String(defaultAccount.id) : '',
        financial_category_id: '',
        amount: '',
        transaction_date: getTodayDate(),
        reference_number: '',
        description: '',
    })

    const filteredCategories = React.useMemo(() => {
        const expectedType = data.type === 'in' ? 'income' : 'expense'
        return categories.filter((c) => c.type === expectedType)
    }, [categories, data.type])

    React.useEffect(() => {
        if (open) {
            clearErrors()
            const defaultAcc = accounts.find((a) => a.is_default) ?? accounts[0]
            const firstExpenseCat = categories.find((c) => c.type === 'expense')
            setData({
                type: 'out',
                financial_account_id: defaultAcc ? String(defaultAcc.id) : '',
                financial_category_id: firstExpenseCat ? String(firstExpenseCat.id) : '',
                amount: '',
                transaction_date: getTodayDate(),
                reference_number: '',
                description: '',
            })
        }
    }, [open])

    const handleTypeSwitch = (nextType: 'in' | 'out') => {
        const expectedCatType = nextType === 'in' ? 'income' : 'expense'
        const firstMatching = categories.find((c) => c.type === expectedCatType)
        setData((prev) => ({
            ...prev,
            type: nextType,
            financial_category_id: firstMatching ? String(firstMatching.id) : '',
        }))
    }

    const selectedAccount = accounts.find((a) => String(a.id) === data.financial_account_id) ?? null
    const numericAmount = Number(data.amount) || 0
    const isInsufficientBalance =
        data.type === 'out' &&
        selectedAccount !== null &&
        numericAmount > 0 &&
        numericAmount > selectedAccount.current_balance

    const accountItems = accounts.map((a) => ({
        value: String(a.id),
        label: `${a.name} (${a.code}) — Saldo: ${formatRupiah(a.current_balance)}`,
    }))

    const categoryItems = filteredCategories.map((c) => ({
        value: String(c.id),
        label: `${c.name} (${c.code})`,
    }))

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        post(FinancialTransactionController.store.url(), {
            preserveScroll: true,
            onSuccess: () => {
                reset()
                onOpenChange(false)
            },
        })
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-xl max-h-[85vh] flex flex-col p-0 gap-0 overflow-hidden">
                <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden">
                    <DialogHeader className="p-6 pb-4 border-b shrink-0">
                        <DialogTitle className="flex items-center gap-2">
                            <Receipt className="h-5 w-5 text-primary" />
                            Catat Transaksi Keuangan Manual
                        </DialogTitle>
                        <DialogDescription className="text-xs">
                            Catat biaya operasional (listrik, sewa, gaji, ATK) atau pemasukan lainnya. Saldo akun diperbarui otomatis secara atomik.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="flex-1 overflow-y-auto overflow-x-hidden p-6 space-y-4">
                        {/* Toggle Tipe Transaksi */}
                        <div className="grid grid-cols-2 gap-2 rounded-lg border bg-muted/40 p-1">
                            <button
                                type="button"
                                onClick={() => handleTypeSwitch('out')}
                                className={`flex items-center justify-center gap-1.5 rounded-md px-3 py-2 text-xs font-semibold transition-colors cursor-pointer ${
                                    data.type === 'out'
                                        ? 'bg-rose-600 text-white shadow-xs'
                                        : 'text-muted-foreground hover:text-foreground'
                                }`}
                            >
                                <ArrowUpRight className="h-4 w-4" />
                                Pengeluaran Operasional
                            </button>
                            <button
                                type="button"
                                onClick={() => handleTypeSwitch('in')}
                                className={`flex items-center justify-center gap-1.5 rounded-md px-3 py-2 text-xs font-semibold transition-colors cursor-pointer ${
                                    data.type === 'in'
                                        ? 'bg-emerald-600 text-white shadow-xs'
                                        : 'text-muted-foreground hover:text-foreground'
                                }`}
                            >
                                <ArrowDownLeft className="h-4 w-4" />
                                Pemasukan Lainnya
                            </button>
                        </div>

                        <Field>
                            <Label htmlFor="fin-tx-account" className="text-xs">
                                Akun Kas / Bank <span className="text-destructive">*</span>
                            </Label>
                            <Select
                                items={accountItems}
                                value={data.financial_account_id}
                                onValueChange={(val) => val && setData('financial_account_id', val)}
                            >
                                <SelectTrigger id="fin-tx-account" className="w-full mt-1">
                                    <SelectValue placeholder="Pilih akun keuangan">
                                        {(val) => accountItems.find((i) => i.value === val)?.label}
                                    </SelectValue>
                                </SelectTrigger>
                                <SelectContent>
                                    {accountItems.map((i) => (
                                        <SelectItem key={i.value} value={i.value}>
                                            {i.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <FieldError>{errors.financial_account_id}</FieldError>
                        </Field>

                        <Field>
                            <Label htmlFor="fin-tx-category" className="text-xs">
                                Kategori Keuangan <span className="text-destructive">*</span>
                            </Label>
                            <Select
                                items={categoryItems}
                                value={data.financial_category_id}
                                onValueChange={(val) => val && setData('financial_category_id', val)}
                            >
                                <SelectTrigger id="fin-tx-category" className="w-full mt-1">
                                    <SelectValue placeholder="Pilih kategori aktif">
                                        {(val) => categoryItems.find((i) => i.value === val)?.label}
                                    </SelectValue>
                                </SelectTrigger>
                                <SelectContent>
                                    {categoryItems.map((i) => (
                                        <SelectItem key={i.value} value={i.value}>
                                            {i.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            {filteredCategories.length === 0 && (
                                <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-1">
                                    Belum ada kategori aktif untuk tipe ini. Tambahkan kategori terlebih dahulu.
                                </p>
                            )}
                            <FieldError>{errors.financial_category_id}</FieldError>
                        </Field>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <Field>
                                <Label htmlFor="fin-tx-date" className="text-xs">
                                    Tanggal Transaksi <span className="text-destructive">*</span>
                                </Label>
                                <Input
                                    id="fin-tx-date"
                                    type="date"
                                    value={data.transaction_date}
                                    onChange={(e) => setData('transaction_date', e.target.value)}
                                    className="font-mono text-xs mt-1"
                                    required
                                />
                                <FieldError>{errors.transaction_date}</FieldError>
                            </Field>

                            <Field>
                                <Label htmlFor="fin-tx-amount" className="text-xs">
                                    Nominal (Rp) <span className="text-destructive">*</span>
                                </Label>
                                <Input
                                    id="fin-tx-amount"
                                    type="number"
                                    min={1}
                                    step="any"
                                    value={data.amount}
                                    onChange={(e) => setData('amount', e.target.value)}
                                    placeholder="0"
                                    className="font-mono text-xs mt-1"
                                    required
                                />
                                {numericAmount > 0 && (
                                    <p className="text-[11px] font-mono text-muted-foreground mt-1">
                                        {formatRupiah(numericAmount)}
                                    </p>
                                )}
                                <FieldError>{errors.amount}</FieldError>
                            </Field>
                        </div>

                        {isInsufficientBalance && selectedAccount && (
                            <div className="flex items-start gap-2 rounded-lg border border-rose-300 bg-rose-50 p-3 text-xs text-rose-700 dark:border-rose-900 dark:bg-rose-950/50 dark:text-rose-300">
                                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                                <span>
                                    Nominal pengeluaran ({formatRupiah(numericAmount)}) melebihi saldo{' '}
                                    <strong>{selectedAccount.name}</strong> ({formatRupiah(selectedAccount.current_balance)}).
                                </span>
                            </div>
                        )}

                        <Field>
                            <Label htmlFor="fin-tx-ref" className="text-xs">
                                No. Referensi / Kuitansi (Opsional)
                            </Label>
                            <Input
                                id="fin-tx-ref"
                                value={data.reference_number}
                                onChange={(e) => setData('reference_number', e.target.value)}
                                placeholder="Contoh: PLN-2026-11 / KWITANSI-01"
                                className="font-mono text-xs mt-1"
                            />
                            <FieldError>{errors.reference_number}</FieldError>
                        </Field>

                        <Field>
                            <Label htmlFor="fin-tx-desc" className="text-xs">
                                Keterangan <span className="text-destructive">*</span>
                            </Label>
                            <textarea
                                id="fin-tx-desc"
                                rows={3}
                                value={data.description}
                                onChange={(e) => setData('description', e.target.value)}
                                placeholder="Contoh: Pembayaran tagihan listrik PLN bulan November 2026"
                                className="w-full mt-1 rounded-md border border-input bg-background p-2 text-xs shadow-xs"
                                required
                            />
                            <FieldError>{errors.description}</FieldError>
                        </Field>
                    </div>

                    <DialogFooter className="p-6 pt-4 border-t shrink-0 flex items-center justify-end gap-2 bg-muted/20">
                        <DialogClose
                            render={
                                <Button type="button" variant="outline" size="sm">
                                    Batal
                                </Button>
                            }
                        />
                        <Button
                            type="submit"
                            size="sm"
                            disabled={
                                processing ||
                                isInsufficientBalance ||
                                !data.financial_account_id ||
                                !data.financial_category_id
                            }
                        >
                            {processing ? 'Menyimpan...' : 'Simpan Transaksi'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}

export default DialogAddFinancialTransaction

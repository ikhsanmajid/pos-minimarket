import React, { useEffect, useMemo, useState } from 'react'
import { Banknote, CreditCard, Plus, Split, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import type { PosFinancialAccount, PosPaymentMethodOption } from '@/types'
import { formatRupiah, getDefaultAccountIdForMethod } from './posUtils'

export interface PaymentEntryPayload {
    payment_method: string
    financial_account_id: number
    amount: number
    reference_number?: string | null
}

interface PaymentRowState {
    id: string
    payment_method: string
    financial_account_id: string
    amount: string
    reference_number: string
}

interface PaymentDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    grandTotal: number
    paymentMethods: PosPaymentMethodOption[]
    financialAccounts: PosFinancialAccount[]
    isSubmitting: boolean
    errorMessage?: string | null
    onSubmitPayment: (payments: PaymentEntryPayload[]) => void
}

const QUICK_CASH_AMOUNTS = [10000, 20000, 50000, 100000]

export function PaymentDialog({
    open,
    onOpenChange,
    grandTotal,
    paymentMethods,
    financialAccounts,
    isSubmitting,
    errorMessage = null,
    onSubmitPayment,
}: PaymentDialogProps) {
    const [mode, setMode] = useState<'single' | 'split'>('single')
    const [singleMethod, setSingleMethod] = useState('cash')
    const [singleAccountId, setSingleAccountId] = useState('')
    const [singleAmount, setSingleAmount] = useState('')
    const [singleReference, setSingleReference] = useState('')
    const [splitRows, setSplitRows] = useState<PaymentRowState[]>([])
    const [localError, setLocalError] = useState<string | null>(null)

    const methodItems = useMemo(
        () => paymentMethods.map((m) => ({ value: m.value, label: m.label })),
        [paymentMethods]
    )

    const accountItems = useMemo(
        () =>
            financialAccounts.map((a) => ({
                value: String(a.id),
                label: `${a.name} (${a.code})`,
            })),
        [financialAccounts]
    )

    useEffect(() => {
        if (!open) return
        const defaultCashAcc = getDefaultAccountIdForMethod('cash', financialAccounts)
        const defaultQrisAcc = getDefaultAccountIdForMethod('qris', financialAccounts)

        setMode('single')
        setSingleMethod('cash')
        setSingleAccountId(defaultCashAcc ? String(defaultCashAcc) : '')
        setSingleAmount(String(grandTotal))
        setSingleReference('')
        setSplitRows([
            {
                id: 'row-1',
                payment_method: 'cash',
                financial_account_id: defaultCashAcc ? String(defaultCashAcc) : '',
                amount: String(Math.floor(grandTotal / 2)),
                reference_number: '',
            },
            {
                id: 'row-2',
                payment_method: 'qris',
                financial_account_id: defaultQrisAcc ? String(defaultQrisAcc) : '',
                amount: String(grandTotal - Math.floor(grandTotal / 2)),
                reference_number: '',
            },
        ])
        setLocalError(null)
    }, [open, grandTotal, financialAccounts])

    const handleSingleMethodChange = (value: string | null) => {
        if (!value) return
        setSingleMethod(value)
        const acc = getDefaultAccountIdForMethod(value, financialAccounts)
        if (acc) {
            setSingleAccountId(String(acc))
        }
        if (value !== 'cash') {
            setSingleAmount(String(grandTotal))
        }
    }

    const totalPaid = useMemo(() => {
        if (mode === 'single') {
            return Math.max(0, Number(singleAmount) || 0)
        }
        return splitRows.reduce((sum, row) => sum + Math.max(0, Number(row.amount) || 0), 0)
    }, [mode, singleAmount, splitRows])

    const nonCashTotal = useMemo(() => {
        if (mode === 'single') {
            return singleMethod !== 'cash' ? Math.max(0, Number(singleAmount) || 0) : 0
        }
        return splitRows.reduce(
            (sum, row) => sum + (row.payment_method !== 'cash' ? Math.max(0, Number(row.amount) || 0) : 0),
            0
        )
    }, [mode, singleMethod, singleAmount, splitRows])

    const remaining = Math.max(0, Math.round((grandTotal - totalPaid) * 100) / 100)
    const change = Math.max(0, Math.round((totalPaid - grandTotal) * 100) / 100)

    const addSplitRow = () => {
        const defaultAcc = getDefaultAccountIdForMethod('qris', financialAccounts)
        setSplitRows((prev) => [
            ...prev,
            {
                id: `row-${Date.now()}`,
                payment_method: 'qris',
                financial_account_id: defaultAcc ? String(defaultAcc) : '',
                amount: remaining > 0 ? String(remaining) : '0',
                reference_number: '',
            },
        ])
    }

    const updateSplitRow = (id: string, patch: Partial<PaymentRowState>) => {
        setSplitRows((prev) =>
            prev.map((row) => {
                if (row.id !== id) return row
                const updated = { ...row, ...patch }
                if (patch.payment_method) {
                    const acc = getDefaultAccountIdForMethod(patch.payment_method, financialAccounts)
                    if (acc) {
                        updated.financial_account_id = String(acc)
                    }
                }
                return updated
            })
        )
    }

    const removeSplitRow = (id: string) => {
        setSplitRows((prev) => (prev.length > 1 ? prev.filter((r) => r.id !== id) : prev))
    }

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        setLocalError(null)

        if (totalPaid < grandTotal) {
            setLocalError(`Total bayar masih kurang ${formatRupiah(remaining)}.`)
            return
        }

        if (nonCashTotal > grandTotal) {
            setLocalError('Total pembayaran non-tunai tidak boleh melebihi grand total.')
            return
        }

        if (mode === 'single') {
            if (!singleAccountId) {
                setLocalError('Pilih akun kas/bank tujuan pembayaran.')
                return
            }
            onSubmitPayment([
                {
                    payment_method: singleMethod,
                    financial_account_id: Number(singleAccountId),
                    amount: Number(singleAmount),
                    reference_number: singleMethod !== 'cash' && singleReference.trim() ? singleReference.trim() : null,
                },
            ])
            return
        }

        const payload: PaymentEntryPayload[] = []
        for (const row of splitRows) {
            const amt = Number(row.amount) || 0
            if (amt <= 0) continue
            if (!row.financial_account_id) {
                setLocalError('Setiap baris split payment wajib memilih akun kas/bank.')
                return
            }
            payload.push({
                payment_method: row.payment_method,
                financial_account_id: Number(row.financial_account_id),
                amount: amt,
                reference_number: row.payment_method !== 'cash' && row.reference_number.trim() ? row.reference_number.trim() : null,
            })
        }

        if (payload.length === 0) {
            setLocalError('Masukkan minimal 1 nominal pembayaran lebih dari 0.')
            return
        }

        onSubmitPayment(payload)
    }

    const displayError = errorMessage || localError

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="w-[calc(100%-2rem)] sm:max-w-2xl md:max-w-3xl max-h-[85vh] flex flex-col p-0 gap-0 overflow-hidden">
                <DialogHeader className="p-6 pb-4 border-b shrink-0">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <DialogTitle>Pembayaran Transaksi (F8)</DialogTitle>
                            <DialogDescription>
                                Pilih metode bayar tunggal atau Split Payment (kombinasi Tunai + Non-Tunai).
                            </DialogDescription>
                        </div>
                        <div className="inline-flex rounded-lg border bg-muted/40 p-1">
                            <button
                                type="button"
                                onClick={() => setMode('single')}
                                className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer ${
                                    mode === 'single'
                                        ? 'bg-background text-foreground shadow-xs'
                                        : 'text-muted-foreground hover:text-foreground'
                                }`}
                            >
                                <Banknote className="h-3.5 w-3.5" />
                                Bayar Tunggal
                            </button>
                            <button
                                type="button"
                                onClick={() => setMode('split')}
                                className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer ${
                                    mode === 'split'
                                        ? 'bg-background text-foreground shadow-xs'
                                        : 'text-muted-foreground hover:text-foreground'
                                }`}
                            >
                                <Split className="h-3.5 w-3.5" />
                                Split Payment
                            </button>
                        </div>
                    </div>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
                    <div className="flex-1 overflow-y-auto overflow-x-hidden p-6 space-y-5">
                        {/* Total Tagihan Banner */}
                        <div className="rounded-xl border bg-muted/30 p-4 flex items-center justify-between">
                            <div>
                                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                                    Total Tagihan
                                </p>
                                <p className="font-mono text-2xl font-bold text-foreground mt-0.5">
                                    {formatRupiah(grandTotal)}
                                </p>
                            </div>
                            <div className="text-right">
                                {remaining > 0 ? (
                                    <>
                                        <p className="text-xs font-medium text-amber-600 dark:text-amber-400">
                                            Sisa Belum Dibayar
                                        </p>
                                        <p className="font-mono text-xl font-bold text-amber-600 dark:text-amber-400">
                                            {formatRupiah(remaining)}
                                        </p>
                                    </>
                                ) : (
                                    <>
                                        <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
                                            Kembalian
                                        </p>
                                        <p className="font-mono text-xl font-bold text-emerald-600 dark:text-emerald-400">
                                            {formatRupiah(change)}
                                        </p>
                                    </>
                                )}
                            </div>
                        </div>

                        {mode === 'single' ? (
                            <div className="space-y-4">
                                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                    <div className="space-y-1.5 min-w-0">
                                        <Label>Metode Pembayaran</Label>
                                        <Select
                                            value={singleMethod}
                                            onValueChange={handleSingleMethodChange}
                                            items={methodItems}
                                            disabled={isSubmitting}
                                        >
                                            <SelectTrigger className="w-full h-9">
                                                <SelectValue>
                                                    {(val) =>
                                                        methodItems.find((m) => m.value === val)?.label ??
                                                        'Pilih metode'
                                                    }
                                                </SelectValue>
                                            </SelectTrigger>
                                            <SelectContent>
                                                {methodItems.map((m) => (
                                                    <SelectItem key={m.value} value={m.value}>
                                                        {m.label}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <div className="space-y-1.5 min-w-0">
                                        <Label>Akun Kas / Bank</Label>
                                        <Select
                                            value={singleAccountId}
                                            onValueChange={(v) => v && setSingleAccountId(v)}
                                            items={accountItems}
                                            disabled={isSubmitting}
                                        >
                                            <SelectTrigger className="w-full h-9">
                                                <SelectValue>
                                                    {(val) =>
                                                        accountItems.find((a) => a.value === val)?.label ??
                                                        'Pilih akun'
                                                    }
                                                </SelectValue>
                                            </SelectTrigger>
                                            <SelectContent>
                                                {accountItems.map((a) => (
                                                    <SelectItem key={a.value} value={a.value}>
                                                        {a.label}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>

                                <div className="space-y-1.5">
                                    <Label htmlFor="single-pay-amount">Nominal Dibayarkan (Rp)</Label>
                                    <Input
                                        id="single-pay-amount"
                                        type="number"
                                        min={0}
                                        step="1"
                                        value={singleAmount}
                                        onChange={(e) => setSingleAmount(e.target.value)}
                                        disabled={isSubmitting}
                                        className="h-11 font-mono text-lg font-semibold"
                                    />
                                </div>

                                {singleMethod === 'cash' ? (
                                    <div className="space-y-2">
                                        <p className="text-xs text-muted-foreground">Nominal Cepat Tunai:</p>
                                        <div className="flex flex-wrap gap-2">
                                            <Button
                                                type="button"
                                                variant="secondary"
                                                size="sm"
                                                onClick={() => setSingleAmount(String(grandTotal))}
                                                className="font-mono text-xs cursor-pointer"
                                            >
                                                Uang Pas ({formatRupiah(grandTotal)})
                                            </Button>
                                            {QUICK_CASH_AMOUNTS.map((amt) => (
                                                <Button
                                                    key={amt}
                                                    type="button"
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => setSingleAmount(String(amt))}
                                                    className="font-mono text-xs cursor-pointer"
                                                >
                                                    {formatRupiah(amt)}
                                                </Button>
                                            ))}
                                        </div>
                                    </div>
                                ) : (
                                    <div className="space-y-1.5">
                                        <Label htmlFor="single-ref-number" className="flex items-center gap-1.5">
                                            <CreditCard className="h-3.5 w-3.5 text-muted-foreground" />
                                            Nomor Referensi QRIS / EDC / Transfer (Opsional)
                                        </Label>
                                        <Input
                                            id="single-ref-number"
                                            value={singleReference}
                                            onChange={(e) => setSingleReference(e.target.value)}
                                            placeholder="Contoh: REF-QRIS-98231"
                                            disabled={isSubmitting}
                                            className="h-9"
                                        />
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {splitRows.map((row, index) => (
                                    <div
                                        key={row.id}
                                        className="rounded-lg border bg-card p-3.5 space-y-3"
                                    >
                                        <div className="flex items-center justify-between">
                                            <span className="text-xs font-semibold text-muted-foreground">
                                                Pembayaran #{index + 1}
                                            </span>
                                            {splitRows.length > 1 && (
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => removeSplitRow(row.id)}
                                                    className="h-7 w-7 text-destructive hover:text-destructive cursor-pointer"
                                                >
                                                    <Trash2 className="h-3.5 w-3.5" />
                                                </Button>
                                            )}
                                        </div>

                                        <div className="grid grid-cols-1 gap-3 md:grid-cols-12">
                                            <div className="space-y-1 md:col-span-4 min-w-0">
                                                <Label className="text-xs">Metode</Label>
                                                <Select
                                                    value={row.payment_method}
                                                    onValueChange={(v) =>
                                                        v && updateSplitRow(row.id, { payment_method: v })
                                                    }
                                                    items={methodItems}
                                                    disabled={isSubmitting}
                                                >
                                                    <SelectTrigger className="w-full h-9">
                                                        <SelectValue>
                                                            {(val) =>
                                                                methodItems.find((m) => m.value === val)?.label ??
                                                                'Metode'
                                                            }
                                                        </SelectValue>
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {methodItems.map((m) => (
                                                            <SelectItem key={m.value} value={m.value}>
                                                                {m.label}
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </div>

                                            <div className="space-y-1 md:col-span-5 min-w-0">
                                                <Label className="text-xs">Akun Kas / Bank</Label>
                                                <Select
                                                    value={row.financial_account_id}
                                                    onValueChange={(v) =>
                                                        v && updateSplitRow(row.id, { financial_account_id: v })
                                                    }
                                                    items={accountItems}
                                                    disabled={isSubmitting}
                                                >
                                                    <SelectTrigger className="w-full h-9">
                                                        <SelectValue>
                                                            {(val) =>
                                                                accountItems.find((a) => a.value === val)?.label ??
                                                                'Pilih akun'
                                                            }
                                                        </SelectValue>
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {accountItems.map((a) => (
                                                            <SelectItem key={a.value} value={a.value}>
                                                                {a.label}
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </div>

                                            <div className="space-y-1 md:col-span-3 min-w-0">
                                                <Label className="text-xs">Nominal (Rp)</Label>
                                                <Input
                                                    type="number"
                                                    min={0}
                                                    step="1"
                                                    value={row.amount}
                                                    onChange={(e) =>
                                                        updateSplitRow(row.id, { amount: e.target.value })
                                                    }
                                                    disabled={isSubmitting}
                                                    className="w-full h-9 font-mono text-sm"
                                                />
                                            </div>
                                        </div>

                                        {row.payment_method !== 'cash' && (
                                            <div className="space-y-1">
                                                <Label className="text-xs">No. Referensi (Opsional)</Label>
                                                <Input
                                                    value={row.reference_number}
                                                    onChange={(e) =>
                                                        updateSplitRow(row.id, { reference_number: e.target.value })
                                                    }
                                                    placeholder="No. referensi QRIS / EDC / Transfer"
                                                    disabled={isSubmitting}
                                                    className="h-8 text-xs"
                                                />
                                            </div>
                                        )}
                                    </div>
                                ))}

                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={addSplitRow}
                                    disabled={isSubmitting}
                                    className="gap-1.5 border-dashed cursor-pointer"
                                >
                                    <Plus className="h-3.5 w-3.5" />
                                    Tambah Metode Pembayaran
                                </Button>
                            </div>
                        )}

                        {displayError && (
                            <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-3.5 py-2.5 text-xs font-medium text-destructive">
                                {displayError}
                            </div>
                        )}
                    </div>

                    <DialogFooter className="p-6 pt-4 border-t shrink-0 flex items-center justify-end gap-2 bg-muted/20">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => onOpenChange(false)}
                            disabled={isSubmitting}
                            className="cursor-pointer"
                        >
                            Batal
                        </Button>
                        <Button
                            type="submit"
                            disabled={isSubmitting || totalPaid < grandTotal || nonCashTotal > grandTotal}
                            className="cursor-pointer"
                        >
                            {isSubmitting ? 'Memproses...' : `Bayar ${formatRupiah(grandTotal)}`}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}

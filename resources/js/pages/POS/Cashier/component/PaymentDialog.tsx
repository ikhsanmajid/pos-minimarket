import React, { useEffect, useMemo, useState } from 'react'
import { Award, Banknote, CreditCard, Crown, Heart, Plus, Sparkles, Split, Trash2, X } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
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
import { Switch } from '@/components/ui/switch'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import type {
    PosAppliedPaymentPromotion,
    PosCartLoyaltyInfo,
    PosDonationProduct,
    PosFinancialAccount,
    PosPaymentMethodOption,
} from '@/types'
import { formatRupiah, getDefaultAccountIdForMethod } from './posUtils'

export interface PaymentEntryPayload {
    payment_method: string
    financial_account_id: number
    amount: number
    card_bin?: string | null
    reference_number?: string | null
}

export interface PaymentDonationPayload {
    donation_product_id: number
    donation_amount: number
}

interface PaymentRowState {
    id: string
    payment_method: string
    financial_account_id: string
    amount: string
    card_bin: string
    reference_number: string
}

export interface PaymentPromoPreviewResult {
    grandTotal: number
    netPayableAfterPoints?: number
    paymentPromotion: PosAppliedPaymentPromotion | null
    loyalty?: PosCartLoyaltyInfo | null
}

interface PaymentDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    grandTotal: number
    loyaltyInfo?: PosCartLoyaltyInfo | null
    redeemPoints?: number
    onRedeemPointsChange?: (points: number) => void
    paymentMethods: PosPaymentMethodOption[]
    financialAccounts: PosFinancialAccount[]
    donationProducts?: PosDonationProduct[]
    isSubmitting: boolean
    errorMessage?: string | null
    onPreviewPaymentPromo?: (
        payments: Array<{
            payment_method: string
            amount: number
            card_bin?: string | null
            reference_number?: string | null
        }>
    ) => Promise<PaymentPromoPreviewResult | null>
    onSubmitPayment: (payments: PaymentEntryPayload[], donation?: PaymentDonationPayload | null) => void
}

const QUICK_CASH_AMOUNTS = [10000, 20000, 50000, 100000, 200000, 500000]
const ADD_CASH_DENOMINATIONS = [1000, 2000, 5000, 10000, 20000, 50000, 100000]

export function PaymentDialog({
    open,
    onOpenChange,
    grandTotal,
    loyaltyInfo = null,
    redeemPoints = 0,
    onRedeemPointsChange,
    paymentMethods,
    financialAccounts,
    donationProducts = [],
    isSubmitting,
    errorMessage = null,
    onPreviewPaymentPromo,
    onSubmitPayment,
}: PaymentDialogProps) {
    const [mode, setMode] = useState<'single' | 'split'>('single')
    const [singleMethod, setSingleMethod] = useState('cash')
    const [singleAccountId, setSingleAccountId] = useState('')
    const [singleAmount, setSingleAmount] = useState('')
    const [singleCardBin, setSingleCardBin] = useState('')
    const [singleReference, setSingleReference] = useState('')
    const [splitRows, setSplitRows] = useState<PaymentRowState[]>([])
    const [previewGrandTotal, setPreviewGrandTotal] = useState<number | null>(null)
    const [previewNetPayable, setPreviewNetPayable] = useState<number | null>(null)
    const [previewPaymentPromo, setPreviewPaymentPromo] = useState<PosAppliedPaymentPromotion | null>(null)
    const [previewLoyalty, setPreviewLoyalty] = useState<PosCartLoyaltyInfo | null>(null)
    const [donateChange, setDonateChange] = useState(false)
    const [selectedDonationId, setSelectedDonationId] = useState('')
    const [donationAmountInput, setDonationAmountInput] = useState('')
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

    const donationItems = useMemo(
        () =>
            donationProducts.map((p) => ({
                value: String(p.id),
                label: p.name,
            })),
        [donationProducts]
    )

    useEffect(() => {
        if (!open) return
        const defaultCashAcc = getDefaultAccountIdForMethod('cash', financialAccounts)
        const defaultQrisAcc = getDefaultAccountIdForMethod('qris', financialAccounts)
        const initialPayable = loyaltyInfo?.net_payable_after_points ?? grandTotal

        setMode('single')
        setSingleMethod('cash')
        setSingleAccountId(defaultCashAcc ? String(defaultCashAcc) : '')
        setSingleAmount(String(initialPayable))
        setSingleCardBin('')
        setSingleReference('')
        setPreviewGrandTotal(null)
        setPreviewNetPayable(null)
        setPreviewPaymentPromo(null)
        setPreviewLoyalty(null)
        setSplitRows([
            {
                id: 'row-1',
                payment_method: 'cash',
                financial_account_id: defaultCashAcc ? String(defaultCashAcc) : '',
                amount: String(Math.floor(initialPayable / 2)),
                card_bin: '',
                reference_number: '',
            },
            {
                id: 'row-2',
                payment_method: 'qris',
                financial_account_id: defaultQrisAcc ? String(defaultQrisAcc) : '',
                amount: String(initialPayable - Math.floor(initialPayable / 2)),
                card_bin: '',
                reference_number: '',
            },
        ])
        setDonateChange(false)
        setSelectedDonationId(donationProducts[0] ? String(donationProducts[0].id) : '')
        setDonationAmountInput('')
        setLocalError(null)
    }, [open, grandTotal, financialAccounts, donationProducts])

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

    // Preview promo metode bayar secara real-time saat metode / nominal / BIN berubah
    useEffect(() => {
        if (!open || !onPreviewPaymentPromo) {
            setPreviewGrandTotal(null)
            setPreviewPaymentPromo(null)
            return
        }

        const payload =
            mode === 'single'
                ? [
                      {
                          payment_method: singleMethod,
                          amount: Math.max(0, Number(singleAmount) || 0),
                          card_bin: singleMethod !== 'cash' && singleCardBin.trim() ? singleCardBin.trim() : null,
                          reference_number:
                              singleMethod !== 'cash' && singleReference.trim() ? singleReference.trim() : null,
                      },
                  ]
                : splitRows
                      .filter((r) => (Number(r.amount) || 0) > 0)
                      .map((r) => ({
                          payment_method: r.payment_method,
                          amount: Math.max(0, Number(r.amount) || 0),
                          card_bin: r.payment_method !== 'cash' && r.card_bin.trim() ? r.card_bin.trim() : null,
                          reference_number:
                              r.payment_method !== 'cash' && r.reference_number.trim()
                                  ? r.reference_number.trim()
                                  : null,
                      }))

        if (payload.length === 0) {
            setPreviewGrandTotal(null)
            setPreviewPaymentPromo(null)
            return
        }

        let cancelled = false
        const timer = window.setTimeout(async () => {
            const res = await onPreviewPaymentPromo(payload)
            if (!cancelled && res) {
                setPreviewGrandTotal(res.grandTotal)
                setPreviewNetPayable(res.netPayableAfterPoints ?? res.grandTotal)
                setPreviewPaymentPromo(res.paymentPromotion)
                setPreviewLoyalty(res.loyalty ?? null)
                if (mode === 'single' && singleMethod !== 'cash') {
                    setSingleAmount(String(res.netPayableAfterPoints ?? res.grandTotal))
                }
            }
        }, 150)

        return () => {
            cancelled = true
            window.clearTimeout(timer)
        }
    }, [open, mode, singleMethod, singleAmount, singleCardBin, singleReference, splitRows, redeemPoints, onPreviewPaymentPromo])

    const activeLoyalty = previewLoyalty ?? loyaltyInfo
    const effectiveGrossBill = previewGrandTotal !== null ? previewGrandTotal : grandTotal
    const pointsRedeemAmount = activeLoyalty?.points_redeem_amount ?? 0
    const effectiveBillTotal =
        previewNetPayable !== null
            ? previewNetPayable
            : Math.max(0, effectiveGrossBill - pointsRedeemAmount)

    const remaining = Math.max(0, Math.round((effectiveBillTotal - totalPaid) * 100) / 100)
    const rawChange = Math.max(0, Math.round((totalPaid - effectiveBillTotal) * 100) / 100)

    useEffect(() => {
        if (rawChange <= 0 && donateChange) {
            setDonateChange(false)
            setDonationAmountInput('')
        } else if (donateChange && Number(donationAmountInput) > rawChange) {
            setDonationAmountInput(String(rawChange))
        }
    }, [rawChange, donateChange, donationAmountInput])

    const effectiveDonationAmount =
        donateChange && rawChange > 0 && donationProducts.length > 0
            ? Math.min(rawChange, Math.max(0, Math.round((Number(donationAmountInput) || 0) * 100) / 100))
            : 0
    const finalGrandTotal = Math.round((effectiveBillTotal + effectiveDonationAmount) * 100) / 100
    const change = Math.max(0, Math.round((totalPaid - finalGrandTotal) * 100) / 100)
    const smallCoinsRemainder = Math.round((rawChange % 1000) * 100) / 100

    const handleToggleDonateChange = (checked: boolean) => {
        setDonateChange(checked)
        if (checked) {
            if (!selectedDonationId && donationProducts[0]) {
                setSelectedDonationId(String(donationProducts[0].id))
            }
            setDonationAmountInput(String(rawChange))
        } else {
            setDonationAmountInput('')
        }
    }

    const addSplitRow = () => {
        const defaultAcc = getDefaultAccountIdForMethod('qris', financialAccounts)
        setSplitRows((prev) => [
            ...prev,
            {
                id: `row-${Date.now()}`,
                payment_method: 'qris',
                financial_account_id: defaultAcc ? String(defaultAcc) : '',
                amount: remaining > 0 ? String(remaining) : '0',
                card_bin: '',
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

        if (totalPaid < effectiveBillTotal) {
            setLocalError(`Total bayar masih kurang ${formatRupiah(remaining)}.`)
            return
        }

        if (nonCashTotal > effectiveBillTotal) {
            setLocalError('Total pembayaran non-tunai tidak boleh melebihi grand total.')
            return
        }

        let donationPayload: PaymentDonationPayload | null = null
        if (effectiveDonationAmount > 0) {
            if (!selectedDonationId) {
                setLocalError('Pilih program produk donasi terlebih dahulu.')
                return
            }
            if (effectiveDonationAmount > rawChange) {
                setLocalError('Nominal donasi tidak boleh melebihi uang kembalian.')
                return
            }
            donationPayload = {
                donation_product_id: Number(selectedDonationId),
                donation_amount: effectiveDonationAmount,
            }
        }

        if (mode === 'single') {
            if (!singleAccountId) {
                setLocalError('Pilih akun kas/bank tujuan pembayaran.')
                return
            }
            onSubmitPayment(
                [
                    {
                        payment_method: singleMethod,
                        financial_account_id: Number(singleAccountId),
                        amount: Number(singleAmount),
                        card_bin: singleMethod !== 'cash' && singleCardBin.trim() ? singleCardBin.trim() : null,
                        reference_number: singleMethod !== 'cash' && singleReference.trim() ? singleReference.trim() : null,
                    },
                ],
                donationPayload
            )
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
                card_bin: row.payment_method !== 'cash' && row.card_bin.trim() ? row.card_bin.trim() : null,
                reference_number: row.payment_method !== 'cash' && row.reference_number.trim() ? row.reference_number.trim() : null,
            })
        }

        if (payload.length === 0) {
            setLocalError('Masukkan minimal 1 nominal pembayaran lebih dari 0.')
            return
        }

        onSubmitPayment(payload, donationPayload)
    }

    const displayError = errorMessage || localError

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="w-[calc(100%-2rem)] sm:max-w-3xl md:max-w-4xl max-h-[85vh] flex flex-col p-0 gap-0 overflow-hidden">
                <DialogHeader className="p-6 pb-4 pr-14 border-b shrink-0">
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
                        <div className="rounded-xl border bg-muted/30 p-4 flex items-center justify-between gap-4">
                            <div>
                                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                                    {effectiveDonationAmount > 0 ? 'Total Tagihan + Donasi' : 'Total Tagihan'}
                                </p>
                                <p className="font-mono text-2xl font-bold text-foreground mt-0.5">
                                    {formatRupiah(finalGrandTotal)}
                                </p>
                                {effectiveDonationAmount > 0 && (
                                    <p className="text-[11px] text-muted-foreground mt-0.5 font-mono">
                                        Belanja {formatRupiah(grandTotal)} + Donasi {formatRupiah(effectiveDonationAmount)}
                                    </p>
                                )}
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
                                        {effectiveDonationAmount > 0 && (
                                            <p className="text-[11px] text-pink-600 dark:text-pink-400 font-medium mt-0.5">
                                                Didonasikan: {formatRupiah(effectiveDonationAmount)}
                                            </p>
                                        )}
                                    </>
                                )}
                            </div>
                        </div>

                        {/* Banner Loyalitas & Penukaran Poin */}
                        {activeLoyalty && activeLoyalty.customer_id !== null && (
                            <div className="rounded-xl border border-violet-300/80 bg-violet-50/60 dark:border-violet-800 dark:bg-violet-950/30 p-4 space-y-3">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                    <div className="flex items-center gap-2">
                                        <Crown className="h-4 w-4 text-violet-600 dark:text-violet-400 shrink-0" />
                                        <span className="text-xs font-semibold text-violet-900 dark:text-violet-200">
                                            Member {activeLoyalty.tier_label ?? 'Silver'} ({activeLoyalty.tier_multiplier}x Poin)
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Badge variant="outline" className="font-mono text-[11px] gap-1 bg-background">
                                            <Award className="h-3 w-3 text-amber-500" />
                                            Saldo: {activeLoyalty.active_point_balance} poin
                                        </Badge>
                                        <Badge variant="secondary" className="font-mono text-[11px]">
                                            Est. +{activeLoyalty.estimated_points_earned} poin
                                        </Badge>
                                    </div>
                                </div>

                                {onRedeemPointsChange && activeLoyalty.max_redeemable_points > 0 && (
                                    <div className="flex flex-col sm:flex-row sm:items-center gap-2 pt-2 border-t border-violet-200/70 dark:border-violet-800/60">
                                        <div className="flex-1 min-w-0">
                                            <Label htmlFor="payment-redeem-points" className="text-xs">
                                                Bayar Sebagian Pakai Poin (1 pt = Rp 100, Maks. {activeLoyalty.max_redeemable_points} pt / 50%)
                                            </Label>
                                        </div>
                                        <div className="flex items-center gap-1.5 shrink-0">
                                            <Input
                                                id="payment-redeem-points"
                                                type="number"
                                                min={0}
                                                max={activeLoyalty.max_redeemable_points}
                                                step={1}
                                                value={redeemPoints || ''}
                                                placeholder="0"
                                                disabled={isSubmitting}
                                                onChange={(e) => {
                                                    const raw = Math.max(0, Math.floor(Number(e.target.value) || 0))
                                                    const clamped = Math.min(raw, activeLoyalty.max_redeemable_points)
                                                    onRedeemPointsChange(clamped)
                                                    if (mode === 'single') {
                                                        setSingleAmount(
                                                            String(Math.max(0, effectiveGrossBill - clamped * 100))
                                                        )
                                                    }
                                                }}
                                                className="h-8 w-24 font-mono text-xs bg-background"
                                            />
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                disabled={isSubmitting}
                                                onClick={() => {
                                                    const maxPts = activeLoyalty.max_redeemable_points
                                                    onRedeemPointsChange(maxPts)
                                                    if (mode === 'single') {
                                                        setSingleAmount(
                                                            String(Math.max(0, effectiveGrossBill - maxPts * 100))
                                                        )
                                                    }
                                                }}
                                                className="h-8 px-2.5 text-xs cursor-pointer"
                                            >
                                                Maks ({formatRupiah(activeLoyalty.max_redeemable_amount)})
                                            </Button>
                                            {redeemPoints > 0 && (
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="icon"
                                                    disabled={isSubmitting}
                                                    onClick={() => {
                                                        onRedeemPointsChange(0)
                                                        if (mode === 'single') {
                                                            setSingleAmount(String(effectiveGrossBill))
                                                        }
                                                    }}
                                                    className="h-8 w-8 text-muted-foreground hover:text-destructive cursor-pointer"
                                                    title="Hapus redeem poin"
                                                >
                                                    <X className="h-3.5 w-3.5" />
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {pointsRedeemAmount > 0 && (
                                    <p className="text-[11px] font-mono text-violet-800 dark:text-violet-300">
                                        Tagihan {formatRupiah(effectiveGrossBill)} − Poin {formatRupiah(pointsRedeemAmount)} = Sisa Bayar Kasir {formatRupiah(effectiveBillTotal)}
                                    </p>
                                )}
                            </div>
                        )}

                        {/* Preview Promo Metode Bayar */}
                        {previewPaymentPromo && previewPaymentPromo.discount_amount > 0 && (
                            <div className="rounded-xl border border-emerald-300/80 bg-emerald-50/70 dark:border-emerald-800 dark:bg-emerald-950/30 px-4 py-3 flex items-center justify-between gap-3">
                                <div className="flex items-center gap-2 min-w-0">
                                    <Sparkles className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                                    <div className="min-w-0">
                                        <p className="text-xs font-semibold text-emerald-800 dark:text-emerald-200 truncate">
                                            Promo Metode Bayar: {previewPaymentPromo.name}
                                        </p>
                                        <p className="text-[11px] text-emerald-700/80 dark:text-emerald-300/80">
                                            Porsi eligible: {formatRupiah(previewPaymentPromo.eligible_payment_amount)}
                                            {previewPaymentPromo.payment_bin_prefix
                                                ? ` • BIN ${previewPaymentPromo.payment_bin_prefix}`
                                                : ''}
                                        </p>
                                    </div>
                                </div>
                                <Badge variant="success" className="font-mono text-xs shrink-0">
                                    -{formatRupiah(previewPaymentPromo.discount_amount)}
                                </Badge>
                            </div>
                        )}

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
                                    <div className="space-y-3">
                                        <div className="space-y-1.5">
                                            <p className="text-xs text-muted-foreground">Nominal Cepat Tunai:</p>
                                            <div className="flex flex-wrap gap-2">
                                                <Button
                                                    type="button"
                                                    variant="secondary"
                                                    size="sm"
                                                    onClick={() => setSingleAmount(String(effectiveBillTotal))}
                                                    className="font-mono text-xs cursor-pointer"
                                                >
                                                    Uang Pas ({formatRupiah(effectiveBillTotal)})
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

                                        <div className="space-y-1.5">
                                            <div className="flex items-center justify-between gap-2">
                                                <p className="text-xs text-muted-foreground">
                                                    Tambah Pecahan Uang (klik untuk menambahkan ke nominal dibayarkan):
                                                </p>
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => setSingleAmount('0')}
                                                    className="h-6 px-2 text-[11px] text-muted-foreground hover:text-destructive cursor-pointer"
                                                >
                                                    Reset Rp 0
                                                </Button>
                                            </div>
                                            <div className="flex flex-wrap gap-2">
                                                {ADD_CASH_DENOMINATIONS.map((amt) => (
                                                    <Button
                                                        key={`add-${amt}`}
                                                        type="button"
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() =>
                                                            setSingleAmount(String((Number(singleAmount) || 0) + amt))
                                                        }
                                                        className="font-mono text-xs border-emerald-300/80 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-800 dark:text-emerald-300 dark:hover:bg-emerald-950/50 cursor-pointer"
                                                    >
                                                        +{formatRupiah(amt)}
                                                    </Button>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                        <div className="space-y-1.5">
                                            <Label htmlFor="single-card-bin" className="flex items-center gap-1.5">
                                                <CreditCard className="h-3.5 w-3.5 text-muted-foreground" />
                                                BIN Kartu 6–8 Digit (Opsional)
                                            </Label>
                                            <Input
                                                id="single-card-bin"
                                                value={singleCardBin}
                                                onChange={(e) =>
                                                    setSingleCardBin(e.target.value.replace(/\D/g, '').slice(0, 8))
                                                }
                                                placeholder="Contoh: 411111"
                                                disabled={isSubmitting}
                                                className="h-9 font-mono"
                                            />
                                        </div>
                                        <div className="space-y-1.5">
                                            <Label htmlFor="single-ref-number" className="flex items-center gap-1.5">
                                                No. Referensi QRIS / EDC / Transfer (Opsional)
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
                                            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                                                <div className="space-y-1">
                                                    <Label className="text-xs">BIN Kartu 6–8 Digit (Opsional)</Label>
                                                    <Input
                                                        value={row.card_bin}
                                                        onChange={(e) =>
                                                            updateSplitRow(row.id, {
                                                                card_bin: e.target.value.replace(/\D/g, '').slice(0, 8),
                                                            })
                                                        }
                                                        placeholder="Contoh: 411111"
                                                        disabled={isSubmitting}
                                                        className="h-8 font-mono text-xs"
                                                    />
                                                </div>
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

                        {/* Donasi Kembalian (muncul saat ada kembalian tunai & tersedia produk donasi aktif) */}
                        {rawChange > 0 && donationProducts.length > 0 && (
                            <div className="rounded-xl border border-pink-200/80 bg-pink-50/40 dark:border-pink-900/60 dark:bg-pink-950/20 p-4 space-y-3">
                                <div className="flex items-center justify-between gap-3">
                                    <div className="flex items-start gap-2.5">
                                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-pink-500/15 text-pink-600 dark:text-pink-400 mt-0.5">
                                            <Heart className="h-4 w-4" />
                                        </div>
                                        <div className="space-y-0.5">
                                            <Label htmlFor="donate-change-switch" className="text-sm font-semibold cursor-pointer">
                                                Masukkan Kembalian ke Donasi
                                            </Label>
                                            <p className="text-xs text-muted-foreground">
                                                Salurkan sisa uang kembalian ({formatRupiah(rawChange)}) ke program donasi jika uang receh tidak tersedia.
                                            </p>
                                        </div>
                                    </div>
                                    <Switch
                                        id="donate-change-switch"
                                        checked={donateChange}
                                        disabled={isSubmitting}
                                        onCheckedChange={handleToggleDonateChange}
                                    />
                                </div>

                                {donateChange && (
                                    <div className="grid grid-cols-1 gap-3 pt-2 border-t border-pink-200/60 dark:border-pink-900/50 sm:grid-cols-2">
                                        <div className="space-y-1.5 min-w-0">
                                            <Label className="text-xs">Program Donasi</Label>
                                            {donationProducts.length > 1 ? (
                                                <Select
                                                    value={selectedDonationId}
                                                    onValueChange={(v) => v && setSelectedDonationId(v)}
                                                    items={donationItems}
                                                    disabled={isSubmitting}
                                                >
                                                    <SelectTrigger className="w-full h-9">
                                                        <SelectValue>
                                                            {(val) =>
                                                                donationItems.find((d) => d.value === val)?.label ??
                                                                'Pilih program donasi'
                                                            }
                                                        </SelectValue>
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {donationItems.map((d) => (
                                                            <SelectItem key={d.value} value={d.value}>
                                                                {d.label}
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            ) : (
                                                <div className="flex h-9 items-center rounded-md border bg-background px-3 text-xs font-medium text-foreground">
                                                    {donationProducts[0].name}
                                                </div>
                                            )}
                                        </div>

                                        <div className="space-y-1.5 min-w-0">
                                            <Label htmlFor="donation-amount-input" className="text-xs">
                                                Nominal Donasi (Maks. {formatRupiah(rawChange)})
                                            </Label>
                                            <Input
                                                id="donation-amount-input"
                                                type="number"
                                                min={0}
                                                max={rawChange}
                                                step="1"
                                                value={donationAmountInput}
                                                onChange={(e) => setDonationAmountInput(e.target.value)}
                                                disabled={isSubmitting}
                                                className="h-9 font-mono text-sm font-semibold"
                                            />
                                        </div>

                                        <div className="sm:col-span-2 flex flex-wrap gap-2">
                                            <Button
                                                type="button"
                                                variant="secondary"
                                                size="sm"
                                                onClick={() => setDonationAmountInput(String(rawChange))}
                                                disabled={isSubmitting}
                                                className="h-7 font-mono text-xs cursor-pointer"
                                            >
                                                Semua Kembalian ({formatRupiah(rawChange)})
                                            </Button>
                                            {smallCoinsRemainder > 0 && rawChange > smallCoinsRemainder && (
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => setDonationAmountInput(String(smallCoinsRemainder))}
                                                    disabled={isSubmitting}
                                                    className="h-7 font-mono text-xs cursor-pointer"
                                                >
                                                    Sisa Receh ({formatRupiah(smallCoinsRemainder)})
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                )}
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
                            disabled={isSubmitting || totalPaid < effectiveBillTotal || nonCashTotal > effectiveBillTotal}
                            className="cursor-pointer"
                        >
                            {isSubmitting ? 'Memproses...' : `Bayar ${formatRupiah(finalGrandTotal)}`}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}

import React, { useEffect, useMemo, useState } from 'react'
import { router } from '@inertiajs/react'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import {
    Calculator,
    EyeOff,
    Loader2,
    Lock,
    Minus,
    Plus,
    RotateCcw,
    ShieldAlert,
} from 'lucide-react'
import CashierShiftController from '@/actions/App/Http/Controllers/CashierShiftController'
import {
    DEFAULT_DENOMINATIONS,
    formatRupiah,
    type DenominationRow,
    type FinancialAccountSelectOption,
    type ShiftPolicyRules,
} from './shiftUtils'

interface CloseShiftDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    shiftId: number
    shiftNumber: string
    registerName: string
    denominations?: number[]
    financialAccounts: FinancialAccountSelectOption[]
    policyRules: ShiftPolicyRules
}

export function CloseShiftDialog({
    open,
    onOpenChange,
    shiftId,
    shiftNumber,
    registerName,
    denominations = DEFAULT_DENOMINATIONS,
    financialAccounts,
    policyRules,
}: CloseShiftDialogProps) {
    const [counts, setCounts] = useState<Record<number, number>>(() =>
        Object.fromEntries(denominations.map((d) => [d, 0]))
    )
    const [closingNotes, setClosingNotes] = useState('')
    const [supervisorPin, setSupervisorPin] = useState('')
    const [cashAccountId, setCashAccountId] = useState<string>('auto')
    const [nonCashAccountId, setNonCashAccountId] = useState<string>('auto')
    const [processing, setProcessing] = useState(false)
    const [errors, setErrors] = useState<Record<string, string>>({})

    useEffect(() => {
        if (open) {
            setCounts(Object.fromEntries(denominations.map((d) => [d, 0])))
            setClosingNotes('')
            setSupervisorPin('')
            setCashAccountId('auto')
            setNonCashAccountId('auto')
            setErrors({})
        }
    }, [open, shiftId, denominations])

    const cashAccounts = useMemo(
        () => financialAccounts.filter((a) => a.type === 'cash'),
        [financialAccounts]
    )
    const nonCashAccounts = useMemo(
        () => financialAccounts.filter((a) => a.type === 'bank' || a.type === 'ewallet'),
        [financialAccounts]
    )

    const cashAccountItems = useMemo(
        () => [
            { value: 'auto', label: 'Otomatis (Brankas Default)' },
            ...cashAccounts.map((acc) => ({
                value: String(acc.id),
                label: `[${acc.code}] ${acc.name}`,
            })),
        ],
        [cashAccounts]
    )
    const nonCashAccountItems = useMemo(
        () => [
            { value: 'auto', label: 'Otomatis (Bank Utama)' },
            ...nonCashAccounts.map((acc) => ({
                value: String(acc.id),
                label: `[${acc.code}] ${acc.name}`,
            })),
        ],
        [nonCashAccounts]
    )

    const breakdown: DenominationRow[] = useMemo(
        () =>
            denominations.map((denom) => {
                const qty = Math.max(0, Number(counts[denom] || 0))
                return {
                    denomination: denom,
                    qty,
                    subtotal: denom * qty,
                }
            }),
        [counts, denominations]
    )

    const actualCash = useMemo(
        () => breakdown.reduce((sum, item) => sum + item.subtotal, 0),
        [breakdown]
    )

    const updateCount = (denom: number, value: number) => {
        setCounts((prev) => ({
            ...prev,
            [denom]: Math.max(0, Math.floor(Number.isNaN(value) ? 0 : value)),
        }))
    }

    const resetCalculator = () => {
        setCounts(Object.fromEntries(denominations.map((d) => [d, 0])))
    }

    const handleClose = () => {
        if (!processing) {
            setErrors({})
            onOpenChange(false)
        }
    }

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        setProcessing(true)
        setErrors({})

        router.post(
            CashierShiftController.close.url(shiftId),
            {
                actual_cash: actualCash,
                denomination_breakdown: breakdown,
                closing_notes: closingNotes || null,
                supervisor_pin: supervisorPin || null,
                cash_deposit_account_id: cashAccountId !== 'auto' ? Number(cashAccountId) : null,
                non_cash_deposit_account_id: nonCashAccountId !== 'auto' ? Number(nonCashAccountId) : null,
            } as unknown as Record<string, string>,
            {
                preserveScroll: true,
                onError: (errs) => {
                    setErrors(errs as Record<string, string>)
                    setProcessing(false)
                },
                onSuccess: () => {
                    setProcessing(false)
                    onOpenChange(false)
                },
                onFinish: () => setProcessing(false),
            }
        )
    }

    const pinRequiredByError = Boolean(errors.supervisor_pin)
    const notesRequiredByError = Boolean(errors.closing_notes)

    return (
        <Dialog open={open} onOpenChange={(val) => !val && handleClose()}>
            <DialogContent className="sm:max-w-3xl max-h-[85vh] flex flex-col p-0 gap-0 overflow-hidden">
                <DialogHeader className="p-6 pb-4 border-b shrink-0">
                    <DialogTitle className="flex items-center gap-2">
                        <Lock className="h-5 w-5 text-primary" />
                        Tutup Sesi Shift — {shiftNumber} ({registerName})
                    </DialogTitle>
                    <DialogDescription>
                        Hitung seluruh uang tunai fisik di laci kasir menggunakan kalkulator pecahan Rupiah di bawah ini.
                    </DialogDescription>
                </DialogHeader>

                <form id="close-shift-form" onSubmit={handleSubmit} className="flex-1 overflow-y-auto overflow-x-hidden p-6 space-y-5">
                    {/* Blind Closing Notice */}
                    <div className="flex items-start gap-3 rounded-lg border border-blue-200 bg-blue-50/70 p-3.5 text-xs text-blue-900 dark:border-blue-800 dark:bg-blue-950/30 dark:text-blue-200">
                        <EyeOff className="mt-0.5 h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400" />
                        <div>
                            <p className="font-semibold">Mode Blind Closing Aktif</p>
                            <p className="mt-0.5 opacity-90">
                                Nominal ekspektasi sistem sengaja disembunyikan agar perhitungan uang fisik dilakukan secara objektif. Hasil rekonsiliasi & Z-Report akan ditampilkan setelah shift ditutup.
                            </p>
                        </div>
                    </div>

                    {/* Kalkulator Pecahan Rupiah */}
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <Label className="flex items-center gap-1.5 text-sm font-semibold">
                                <Calculator className="h-4 w-4 text-primary" />
                                Kalkulator Pecahan Rupiah
                            </Label>
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={resetCalculator}
                                className="h-7 gap-1.5 text-xs text-muted-foreground"
                            >
                                <RotateCcw className="h-3.5 w-3.5" />
                                Reset Hitungan
                            </Button>
                        </div>

                        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                            {breakdown.map((row) => (
                                <div
                                    key={row.denomination}
                                    className="flex items-center justify-between gap-3 rounded-lg border bg-card px-3 py-2.5"
                                >
                                    <div className="min-w-0 flex-1">
                                        <p className="font-mono text-xs font-semibold text-foreground truncate">
                                            {formatRupiah(row.denomination)}
                                        </p>
                                        <p className="font-mono text-[11px] text-muted-foreground truncate">
                                            = {formatRupiah(row.subtotal)}
                                        </p>
                                    </div>

                                    <div className="flex items-center gap-1.5 shrink-0">
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="icon"
                                            className="h-8 w-8 shrink-0"
                                            disabled={row.qty <= 0}
                                            aria-label={`Kurangi pecahan ${formatRupiah(row.denomination)}`}
                                            onClick={() => updateCount(row.denomination, row.qty - 1)}
                                        >
                                            <Minus className="h-3.5 w-3.5" />
                                        </Button>
                                        <Input
                                            type="text"
                                            inputMode="numeric"
                                            pattern="[0-9]*"
                                            value={row.qty === 0 ? '' : String(row.qty)}
                                            placeholder="0"
                                            aria-label={`Jumlah pecahan ${formatRupiah(row.denomination)}`}
                                            onFocus={(e) => e.target.select()}
                                            onChange={(e) => {
                                                const digits = e.target.value.replace(/\D/g, '')
                                                updateCount(row.denomination, digits ? parseInt(digits, 10) : 0)
                                            }}
                                            className="h-8 w-16 px-1.5 text-center font-mono text-xs tabular-nums"
                                        />
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="icon"
                                            className="h-8 w-8 shrink-0"
                                            aria-label={`Tambah pecahan ${formatRupiah(row.denomination)}`}
                                            onClick={() => updateCount(row.denomination, row.qty + 1)}
                                        >
                                            <Plus className="h-3.5 w-3.5" />
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Ringkasan Total Fisik Terhitung */}
                        <div className="flex flex-col gap-1 rounded-xl border-2 border-primary/30 bg-primary/5 p-4 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                                    Total Uang Fisik Terhitung (Actual Cash)
                                </p>
                                <p className="text-xs text-muted-foreground">
                                    Total lembar/keping:{' '}
                                    <span className="font-mono font-semibold text-foreground">
                                        {breakdown.reduce((s, r) => s + r.qty, 0)}
                                    </span>
                                </p>
                            </div>
                            <p className="font-mono text-2xl font-bold text-primary">
                                {formatRupiah(actualCash)}
                            </p>
                        </div>
                        {errors.actual_cash && (
                            <p className="text-xs text-destructive">{errors.actual_cash}</p>
                        )}
                    </div>

                    {/* Akun Setoran Keuangan (Opsional untuk Admin/Supervisor) */}
                    {policyRules.is_privileged && (
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <div className="space-y-1.5">
                                <Label className="text-xs">Akun Setoran Tunai (Default: Brankas)</Label>
                                <Select
                                    items={cashAccountItems}
                                    value={cashAccountId}
                                    onValueChange={(v) => setCashAccountId(v || 'auto')}
                                >
                                    <SelectTrigger className="w-full">
                                        <SelectValue placeholder="Otomatis (Brankas Default)">
                                            {(val) => cashAccountItems.find((item) => item.value === val)?.label}
                                        </SelectValue>
                                    </SelectTrigger>
                                    <SelectContent className="w-auto min-w-(--anchor-width)">
                                        {cashAccountItems.map((item) => (
                                            <SelectItem key={item.value} value={item.value}>
                                                {item.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-xs">Akun Setoran Non-Tunai (Default: Bank/E-Wallet)</Label>
                                <Select
                                    items={nonCashAccountItems}
                                    value={nonCashAccountId}
                                    onValueChange={(v) => setNonCashAccountId(v || 'auto')}
                                >
                                    <SelectTrigger className="w-full">
                                        <SelectValue placeholder="Otomatis (Bank Utama)">
                                            {(val) => nonCashAccountItems.find((item) => item.value === val)?.label}
                                        </SelectValue>
                                    </SelectTrigger>
                                    <SelectContent className="w-auto min-w-(--anchor-width)">
                                        {nonCashAccountItems.map((item) => (
                                            <SelectItem key={item.value} value={item.value}>
                                                {item.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    )}

                    {/* Catatan Penutupan */}
                    <div className="space-y-1.5">
                        <Label htmlFor="closing-notes" className="flex items-center gap-1.5">
                            Catatan Penutupan Shift
                            {notesRequiredByError && <span className="text-destructive">* (Wajib karena ada selisih)</span>}
                        </Label>
                        <textarea
                            id="closing-notes"
                            rows={2}
                            value={closingNotes}
                            onChange={(e) => setClosingNotes(e.target.value)}
                            placeholder="Catatan serah terima atau penjelasan jika terdapat selisih kas..."
                            className={`w-full rounded-md border bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${notesRequiredByError ? 'border-destructive ring-1 ring-destructive' : 'border-input'
                                }`}
                        />
                        {errors.closing_notes && (
                            <p className="text-xs font-medium text-destructive">{errors.closing_notes}</p>
                        )}
                    </div>

                    {/* PIN Otorisasi Supervisor (Opsional, atau wajib jika backend mendeteksi selisih > toleransi) */}
                    {!policyRules.is_privileged && (
                        <div
                            className={`rounded-lg border p-4 space-y-2 ${pinRequiredByError
                                    ? 'border-destructive bg-destructive/10'
                                    : 'border-amber-200 bg-amber-50/50 dark:border-amber-800 dark:bg-amber-950/20'
                                }`}
                        >
                            <Label htmlFor="close-supervisor-pin" className="flex items-center gap-1.5">
                                <ShieldAlert className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                                PIN Otorisasi Supervisor / Admin{' '}
                                {pinRequiredByError ? (
                                    <span className="text-destructive font-semibold">(Wajib Diisi)</span>
                                ) : (
                                    <span className="text-xs font-normal text-muted-foreground">(Wajib jika selisih &gt; {formatRupiah(policyRules.variance_pin_threshold)})</span>
                                )}
                            </Label>
                            <Input
                                id="close-supervisor-pin"
                                type="password"
                                inputMode="numeric"
                                autoComplete="off"
                                value={supervisorPin}
                                onChange={(e) => setSupervisorPin(e.target.value)}
                                placeholder="Kosongkan jika kas klop / dalam batas toleransi"
                                className="font-mono tracking-widest bg-background"
                            />
                            {errors.supervisor_pin && (
                                <p className="text-xs font-medium text-destructive">{errors.supervisor_pin}</p>
                            )}
                        </div>
                    )}
                </form>

                <DialogFooter className="p-6 pt-4 border-t shrink-0 flex items-center justify-end gap-2 bg-muted/20">
                    <Button type="button" variant="outline" onClick={handleClose} disabled={processing}>
                        Batal
                    </Button>
                    <Button type="submit" form="close-shift-form" disabled={processing} className="gap-2">
                        {processing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
                        Konfirmasi & Tutup Shift
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

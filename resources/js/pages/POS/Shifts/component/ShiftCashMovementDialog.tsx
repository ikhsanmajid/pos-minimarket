import React, { useEffect } from 'react'
import { useForm } from '@inertiajs/react'
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
import { ArrowDownToLine, ArrowUpFromLine, Landmark, Loader2, ShieldCheck } from 'lucide-react'
import CashierShiftController from '@/actions/App/Http/Controllers/CashierShiftController'
import {
    formatRupiah,
    type FinancialAccountSelectOption,
    type ShiftPolicyRules,
} from './shiftUtils'

interface ShiftCashMovementDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    shiftId: number
    initialType: 'cash_in' | 'cash_out' | 'cash_drop'
    financialAccounts: FinancialAccountSelectOption[]
    policyRules: ShiftPolicyRules
}

export function ShiftCashMovementDialog({
    open,
    onOpenChange,
    shiftId,
    initialType,
    financialAccounts,
    policyRules,
}: ShiftCashMovementDialogProps) {
    const cashAccounts = financialAccounts.filter((acc) => acc.type === 'cash')
    const defaultSafeAccount = cashAccounts.find((a) => a.is_default || a.code === 'KAS-002') ?? cashAccounts[0]

    const { data, setData, post, processing, errors, reset, clearErrors } = useForm({
        type: initialType as string,
        amount: '',
        reason: '',
        financial_account_id: initialType === 'cash_drop' && defaultSafeAccount ? String(defaultSafeAccount.id) : '',
        supervisor_pin: '',
    })

    useEffect(() => {
        if (open) {
            setData({
                type: initialType,
                amount: '',
                reason: '',
                financial_account_id: initialType === 'cash_drop' && defaultSafeAccount ? String(defaultSafeAccount.id) : '',
                supervisor_pin: '',
            })
            clearErrors()
        }
    }, [open, initialType])

    const amountNum = Number(data.amount || 0)
    const needsPin =
        !policyRules.is_privileged &&
        (data.type === 'cash_drop' ||
            (data.type === 'cash_out' && amountNum >= policyRules.cash_out_pin_threshold))

    const titleMeta =
        data.type === 'cash_drop'
            ? {
                  title: 'Setor Uang ke Brankas (Cash Drop)',
                  desc: 'Pindahkan kelebihan uang tunai dari laci kasir ke brankas/akun kas toko. Mutasi otomatis tercatat di Keuangan.',
                  icon: <Landmark className="h-5 w-5 text-blue-600 dark:text-blue-400" />,
                  accountLabel: 'Akun Tujuan Setoran (Brankas / Kas)',
                  reasonPlaceholder: 'Contoh: Setoran tengah shift karena uang laci melebihi batas aman',
              }
            : data.type === 'cash_out'
              ? {
                    title: 'Catat Kas Keluar (Cash Out)',
                    desc: 'Pengeluaran operasional tunai dari laci kasir (plastik, es, perlengkapan toko, dll).',
                    icon: <ArrowUpFromLine className="h-5 w-5 text-rose-600 dark:text-rose-400" />,
                    accountLabel: 'Akun Keuangan Pencatatan Biaya',
                    reasonPlaceholder: 'Contoh: Beli kantong kresek & kertas struk thermal',
                }
              : {
                    title: 'Catat Kas Masuk (Cash In)',
                    desc: 'Penambahan uang tunai ke laci kasir (misalnya tambahan uang receh kembalian).',
                    icon: <ArrowDownToLine className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />,
                    accountLabel: 'Sumber Akun Keuangan (Opsional)',
                    reasonPlaceholder: 'Contoh: Tambahan uang pecahan kecil dari brankas',
                }

    const handleClose = () => {
        if (!processing) {
            clearErrors()
            onOpenChange(false)
        }
    }

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        post(CashierShiftController.storeMovement.url(shiftId), {
            preserveScroll: true,
            onSuccess: () => {
                reset()
                onOpenChange(false)
            },
        })
    }

    return (
        <Dialog open={open} onOpenChange={(val) => !val && handleClose()}>
            <DialogContent className="max-w-lg max-h-[85vh] flex flex-col p-0 gap-0 overflow-hidden">
                <DialogHeader className="p-6 pb-4 border-b shrink-0">
                    <DialogTitle className="flex items-center gap-2">
                        {titleMeta.icon}
                        {titleMeta.title}
                    </DialogTitle>
                    <DialogDescription>{titleMeta.desc}</DialogDescription>
                </DialogHeader>

                <form id="shift-movement-form" onSubmit={handleSubmit} className="flex-1 overflow-y-auto overflow-x-hidden p-6 space-y-4">
                    <div className="space-y-1.5">
                        <Label>Jenis Mutasi</Label>
                        <div className="grid grid-cols-3 gap-2">
                            {[
                                { value: 'cash_in', label: 'Cash In' },
                                { value: 'cash_out', label: 'Cash Out' },
                                { value: 'cash_drop', label: 'Cash Drop' },
                            ].map((opt) => (
                                <button
                                    key={opt.value}
                                    type="button"
                                    onClick={() => setData('type', opt.value)}
                                    className={`rounded-lg border px-3 py-2 text-xs font-semibold transition-colors cursor-pointer ${
                                        data.type === opt.value
                                            ? 'border-primary bg-primary text-primary-foreground'
                                            : 'border-border bg-card text-muted-foreground hover:bg-muted'
                                    }`}
                                >
                                    {opt.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="space-y-1.5">
                        <Label htmlFor="movement-amount">
                            Nominal (Rp) <span className="text-destructive">*</span>
                        </Label>
                        <Input
                            id="movement-amount"
                            type="number"
                            min="100"
                            step="100"
                            value={data.amount}
                            onChange={(e) => setData('amount', e.target.value)}
                            placeholder="100000"
                            className="font-mono text-base font-semibold"
                            required
                        />
                        {amountNum > 0 && (
                            <p className="text-xs text-muted-foreground">
                                Nominal: <span className="font-mono font-semibold text-foreground">{formatRupiah(amountNum)}</span>
                            </p>
                        )}
                        {errors.amount && <p className="text-xs text-destructive">{errors.amount}</p>}
                    </div>

                    <div className="space-y-1.5">
                        <Label htmlFor="movement-account">{titleMeta.accountLabel}</Label>
                        <Select
                            value={data.financial_account_id || 'none'}
                            onValueChange={(val) => setData('financial_account_id', !val || val === 'none' ? '' : val)}
                        >
                            <SelectTrigger id="movement-account">
                                <SelectValue placeholder="Pilih akun kas / brankas" />
                            </SelectTrigger>
                            <SelectContent>
                                {data.type === 'cash_in' && (
                                    <SelectItem value="none">Tanpa potong akun (Uang eksternal)</SelectItem>
                                )}
                                {data.type !== 'cash_in' && (
                                    <SelectItem value="none">Otomatis (Akun Kas Default)</SelectItem>
                                )}
                                {cashAccounts.map((acc) => (
                                    <SelectItem key={acc.id} value={String(acc.id)}>
                                        [{acc.code}] {acc.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        {errors.financial_account_id && (
                            <p className="text-xs text-destructive">{errors.financial_account_id}</p>
                        )}
                    </div>

                    <div className="space-y-1.5">
                        <Label htmlFor="movement-reason">
                            Alasan / Keterangan <span className="text-destructive">*</span>
                        </Label>
                        <textarea
                            id="movement-reason"
                            rows={3}
                            value={data.reason}
                            onChange={(e) => setData('reason', e.target.value)}
                            placeholder={titleMeta.reasonPlaceholder}
                            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            required
                        />
                        {errors.reason && <p className="text-xs text-destructive">{errors.reason}</p>}
                    </div>

                    {needsPin && (
                        <div className="rounded-lg border border-amber-300 bg-amber-50/70 p-4 space-y-2 dark:border-amber-800 dark:bg-amber-950/30">
                            <Label htmlFor="movement-pin" className="flex items-center gap-1.5 text-amber-900 dark:text-amber-200">
                                <ShieldCheck className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                                PIN Otorisasi Admin / Supervisor <span className="text-destructive">*</span>
                            </Label>
                            <p className="text-xs text-amber-800/90 dark:text-amber-300/90">
                                {data.type === 'cash_drop'
                                    ? 'Setiap penyetoran uang ke brankas (Cash Drop) memerlukan verifikasi PIN Admin/Supervisor.'
                                    : `Pengeluaran kas ≥ ${formatRupiah(policyRules.cash_out_pin_threshold)} memerlukan verifikasi PIN Admin/Supervisor.`}
                            </p>
                            <Input
                                id="movement-pin"
                                type="password"
                                inputMode="numeric"
                                autoComplete="off"
                                value={data.supervisor_pin}
                                onChange={(e) => setData('supervisor_pin', e.target.value)}
                                placeholder="Masukkan PIN Supervisor / Admin"
                                className="font-mono tracking-widest bg-background"
                                required
                            />
                            {errors.supervisor_pin && (
                                <p className="text-xs text-destructive font-medium">{errors.supervisor_pin}</p>
                            )}
                        </div>
                    )}

                    {policyRules.is_privileged && (data.type === 'cash_drop' || data.type === 'cash_out') && (
                        <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50/60 px-3 py-2 text-xs text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300">
                            <ShieldCheck className="h-4 w-4 shrink-0" />
                            <span>Otorisasi otomatis berlaku karena Anda login sebagai Admin / Supervisor.</span>
                        </div>
                    )}
                </form>

                <DialogFooter className="p-6 pt-4 border-t shrink-0 flex items-center justify-end gap-2 bg-muted/20">
                    <Button type="button" variant="outline" onClick={handleClose} disabled={processing}>
                        Batal
                    </Button>
                    <Button type="submit" form="shift-movement-form" disabled={processing} className="gap-2">
                        {processing && <Loader2 className="h-4 w-4 animate-spin" />}
                        Simpan Mutasi Kas
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

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
import { Switch } from '@/components/ui/switch'
import { Field, FieldError } from '@/components/ui/field'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import { Wallet } from 'lucide-react'
import FinancialAccountController from '@/actions/App/Http/Controllers/FinancialAccountController'
import type { FinancialAccountRow } from '../FinancialAccount'

interface DialogFinancialAccountProps {
    account?: FinancialAccountRow | null
    accountTypes: { value: string; label: string }[]
    open: boolean
    onOpenChange: (open: boolean) => void
}

export function DialogFinancialAccount({
    account,
    accountTypes,
    open,
    onOpenChange,
}: DialogFinancialAccountProps) {
    const isEdit = Boolean(account)
    const hasTransactions = (account?.transactions_count ?? 0) > 0

    const { data, setData, post, patch, processing, errors, clearErrors } = useForm({
        code: account?.code ?? '',
        name: account?.name ?? '',
        type: account?.type ?? 'cash',
        bank_name: account?.bank_name ?? '',
        account_number: account?.account_number ?? '',
        opening_balance: account ? String(account.opening_balance) : '0',
        is_default: account?.is_default ?? false,
        is_active: account?.is_active ?? true,
        notes: account?.notes ?? '',
    })

    React.useEffect(() => {
        if (open) {
            clearErrors()
            setData({
                code: account?.code ?? '',
                name: account?.name ?? '',
                type: account?.type ?? 'cash',
                bank_name: account?.bank_name ?? '',
                account_number: account?.account_number ?? '',
                opening_balance: account ? String(account.opening_balance) : '0',
                is_default: account?.is_default ?? false,
                is_active: account?.is_active ?? true,
                notes: account?.notes ?? '',
            })
        }
    }, [open, account])

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()

        if (isEdit && account) {
            patch(FinancialAccountController.update.url(account.id), {
                preserveScroll: true,
                onSuccess: () => onOpenChange(false),
            })
        } else {
            post(FinancialAccountController.store.url(), {
                preserveScroll: true,
                onSuccess: () => onOpenChange(false),
            })
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-lg max-h-[85vh] flex flex-col p-0 gap-0 overflow-hidden">
                <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden">
                    <DialogHeader className="p-6 pb-4 border-b shrink-0">
                        <DialogTitle className="flex items-center gap-2">
                            <Wallet className="h-5 w-5 text-primary" />
                            {isEdit ? `Edit Akun: ${account?.name}` : 'Tambah Akun Kas / Bank'}
                        </DialogTitle>
                        <DialogDescription className="text-xs">
                            Kelola rekening kas toko, bank, atau dompet digital untuk pencatatan arus kas dan pembayaran hutang.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="flex-1 overflow-y-auto overflow-x-hidden p-6 space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <Field>
                                <Label htmlFor="acc-code" className="text-xs">
                                    Kode Akun (Opsional)
                                </Label>
                                <Input
                                    id="acc-code"
                                    value={data.code}
                                    onChange={(e) => setData('code', e.target.value)}
                                    placeholder="Otomatis (KAS-001 / BNK-001)"
                                    className="font-mono text-xs mt-1"
                                />
                                <FieldError>{errors.code}</FieldError>
                            </Field>

                            <Field>
                                <Label htmlFor="acc-type" className="text-xs">
                                    Tipe Akun <span className="text-destructive">*</span>
                                </Label>
                                <Select
                                    items={accountTypes}
                                    value={data.type}
                                    onValueChange={(val) => val && setData('type', val)}
                                >
                                    <SelectTrigger id="acc-type" className="w-full mt-1">
                                        <SelectValue placeholder="Pilih tipe">
                                            {(val) => accountTypes.find((t) => t.value === val)?.label}
                                        </SelectValue>
                                    </SelectTrigger>
                                    <SelectContent>
                                        {accountTypes.map((t) => (
                                            <SelectItem key={t.value} value={t.value}>
                                                {t.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <FieldError>{errors.type}</FieldError>
                            </Field>
                        </div>

                        <Field>
                            <Label htmlFor="acc-name" className="text-xs">
                                Nama Akun <span className="text-destructive">*</span>
                            </Label>
                            <Input
                                id="acc-name"
                                value={data.name}
                                onChange={(e) => setData('name', e.target.value)}
                                placeholder="Contoh: Brankas Toko, Rekening BCA Toko"
                                className="text-xs mt-1"
                                required
                            />
                            <FieldError>{errors.name}</FieldError>
                        </Field>

                        {data.type !== 'cash' && (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <Field>
                                    <Label htmlFor="acc-bank" className="text-xs">
                                        Nama Bank / Penyedia
                                    </Label>
                                    <Input
                                        id="acc-bank"
                                        value={data.bank_name}
                                        onChange={(e) => setData('bank_name', e.target.value)}
                                        placeholder="BCA, BRI, Mandiri, GoPay..."
                                        className="text-xs mt-1"
                                    />
                                    <FieldError>{errors.bank_name}</FieldError>
                                </Field>

                                <Field>
                                    <Label htmlFor="acc-number" className="text-xs">
                                        Nomor Rekening / Akun
                                    </Label>
                                    <Input
                                        id="acc-number"
                                        value={data.account_number}
                                        onChange={(e) => setData('account_number', e.target.value)}
                                        placeholder="1234567890"
                                        className="font-mono text-xs mt-1"
                                    />
                                    <FieldError>{errors.account_number}</FieldError>
                                </Field>
                            </div>
                        )}

                        <Field>
                            <Label htmlFor="acc-balance" className="text-xs">
                                Saldo Awal (Rp) <span className="text-destructive">*</span>
                            </Label>
                            <Input
                                id="acc-balance"
                                type="number"
                                min={0}
                                step="any"
                                value={data.opening_balance}
                                onChange={(e) => setData('opening_balance', e.target.value)}
                                disabled={isEdit && hasTransactions}
                                className="font-mono text-xs mt-1"
                                required
                            />
                            {isEdit && hasTransactions && (
                                <p className="text-[11px] text-muted-foreground mt-1">
                                    Saldo awal terkunci karena akun sudah memiliki riwayat mutasi transaksi.
                                </p>
                            )}
                            <FieldError>{errors.opening_balance}</FieldError>
                        </Field>

                        <Field>
                            <Label htmlFor="acc-notes" className="text-xs">
                                Catatan
                            </Label>
                            <textarea
                                id="acc-notes"
                                rows={2}
                                value={data.notes}
                                onChange={(e) => setData('notes', e.target.value)}
                                className="w-full mt-1 rounded-md border border-input bg-background p-2 text-xs shadow-xs"
                            />
                            <FieldError>{errors.notes}</FieldError>
                        </Field>

                        <div className="space-y-2.5 pt-1">
                            <div className="flex items-center justify-between rounded-lg border p-3">
                                <div>
                                    <Label className="text-xs font-medium">Jadikan Akun Default</Label>
                                    <p className="text-[11px] text-muted-foreground">
                                        Terpilih otomatis saat mencatat pembayaran hutang.
                                    </p>
                                </div>
                                <Switch
                                    checked={data.is_default}
                                    onCheckedChange={(checked) => setData('is_default', checked)}
                                />
                            </div>

                            <div className="flex items-center justify-between rounded-lg border p-3">
                                <div>
                                    <Label className="text-xs font-medium">Status Aktif</Label>
                                    <p className="text-[11px] text-muted-foreground">
                                        Akun nonaktif tidak dapat digunakan untuk transaksi baru.
                                    </p>
                                </div>
                                <Switch
                                    checked={data.is_active}
                                    onCheckedChange={(checked) => setData('is_active', checked)}
                                />
                            </div>
                        </div>
                    </div>

                    <DialogFooter className="p-6 pt-4 border-t shrink-0 flex items-center justify-end gap-2 bg-muted/20">
                        <DialogClose render={<Button type="button" variant="outline" size="sm">Batal</Button>} />
                        <Button type="submit" size="sm" disabled={processing}>
                            {processing ? 'Menyimpan...' : isEdit ? 'Simpan Perubahan' : 'Simpan Akun'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}

export default DialogFinancialAccount

import React, { useEffect, useState } from 'react'
import { router } from '@inertiajs/react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { FieldTooltip } from '@/components/ui/field-tooltip'
import { Switch } from '@/components/ui/switch'
import {
    Dialog,
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
import VoucherController from '@/actions/App/Http/Controllers/VoucherController'

interface OptionItem {
    value: string
    label: string
}

interface VoucherBulkDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    typeOptions: OptionItem[]
    statusOptions: OptionItem[]
    fundingOptions: OptionItem[]
}

function defaultDateTimeLocal(addDays = 0): string {
    const d = new Date()
    d.setDate(d.getDate() + addDays)
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function VoucherBulkDialog({
    open,
    onOpenChange,
    typeOptions,
    statusOptions,
    fundingOptions,
}: VoucherBulkDialogProps) {
    const bulkTypeOptions = typeOptions.filter((t) => t.value !== 'free_item')

    const [prefix, setPrefix] = useState('PROMO')
    const [count, setCount] = useState('10')
    const [name, setName] = useState('')
    const [type, setType] = useState('fixed_amount')
    const [value, setValue] = useState('10000')
    const [maxDiscount, setMaxDiscount] = useState('')
    const [minSpend, setMinSpend] = useState('50000')
    const [totalQuota, setTotalQuota] = useState('1')
    const [validFrom, setValidFrom] = useState(defaultDateTimeLocal(0))
    const [validUntil, setValidUntil] = useState(defaultDateTimeLocal(30))
    const [funding, setFunding] = useState('store')
    const [status, setStatus] = useState('active')
    const [memberOnly, setMemberOnly] = useState(false)
    const [stackableWithPromo, setStackableWithPromo] = useState(true)
    const [errors, setErrors] = useState<Record<string, string>>({})
    const [isSubmitting, setIsSubmitting] = useState(false)

    useEffect(() => {
        if (!open) return
        setErrors({})
    }, [open])

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        setIsSubmitting(true)
        setErrors({})

        router.post(
            VoucherController.generateBulk.url(),
            {
                prefix: prefix.trim().toUpperCase(),
                count: Number(count) || 1,
                name: name.trim(),
                type,
                value: Number(value) || 0,
                max_discount: maxDiscount !== '' ? Number(maxDiscount) : null,
                min_spend: minSpend !== '' ? Number(minSpend) : 0,
                total_quota: totalQuota !== '' ? Number(totalQuota) : null,
                valid_from: validFrom,
                valid_until: validUntil,
                funding,
                status,
                member_only: memberOnly,
                stackable_with_promo: stackableWithPromo,
            },
            {
                preserveScroll: true,
                onError: (errs) => setErrors(errs),
                onSuccess: () => onOpenChange(false),
                onFinish: () => setIsSubmitting(false),
            }
        )
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="w-[95vw] max-w-2xl sm:max-w-2xl max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden">
                <DialogHeader className="px-6 py-4 border-b shrink-0">
                    <DialogTitle className="text-lg">Generator Kode Voucher Massal</DialogTitle>
                    <DialogDescription>
                        Menghasilkan kode unik berformat <span className="font-mono font-semibold">PREFIX-XXXX-XXXX</span> dengan digit checksum dan tanpa karakter ambigu (0/O, 1/I/L).
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
                    <div className="flex-1 overflow-y-auto overflow-x-hidden px-6 py-5 space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-12 gap-4">
                            <div className="sm:col-span-4 space-y-1.5">
                                <Label htmlFor="bulk-prefix">
                                    Prefix <span className="text-destructive">*</span>
                                    <FieldTooltip content="Awalan kode voucher (huruf/angka maks. 12 karakter), misal GAJIAN -> GAJIAN-XXXX-XXXX." />
                                </Label>
                                <Input
                                    id="bulk-prefix"
                                    value={prefix}
                                    onChange={(e) => setPrefix(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                                    maxLength={12}
                                    placeholder="GAJIAN"
                                    className="h-9 font-mono uppercase"
                                    required
                                />
                                {errors.prefix && <p className="text-xs text-destructive">{errors.prefix}</p>}
                            </div>
                            <div className="sm:col-span-3 space-y-1.5">
                                <Label htmlFor="bulk-count">
                                    Jumlah Kode <span className="text-destructive">*</span>
                                    <FieldTooltip content="Banyaknya kode voucher unik yang akan dibuat sekaligus (maks. 500 per batch)." />
                                </Label>
                                <Input
                                    id="bulk-count"
                                    type="number"
                                    min={1}
                                    max={500}
                                    value={count}
                                    onChange={(e) => setCount(e.target.value)}
                                    className="h-9 font-mono"
                                    required
                                />
                                {errors.count && <p className="text-xs text-destructive">{errors.count}</p>}
                            </div>
                            <div className="sm:col-span-5 space-y-1.5">
                                <Label htmlFor="bulk-name">
                                    Nama Campaign <span className="text-destructive">*</span>
                                    <FieldTooltip content="Nama campaign yang diterapkan ke seluruh kode voucher dalam batch ini." />
                                </Label>
                                <Input
                                    id="bulk-name"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    placeholder="Voucher Member Gajian"
                                    className="h-9"
                                    required
                                />
                                {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <div className="space-y-1.5">
                                <Label>
                                    Tipe Voucher
                                    <FieldTooltip content="Jenis potongan untuk seluruh kode dalam batch: nominal (Rp) atau persentase (%)." />
                                </Label>
                                <Select
                                    items={bulkTypeOptions}
                                    value={type}
                                    onValueChange={(val) => val && setType(val)}
                                >
                                    <SelectTrigger className="w-full h-9">
                                        <SelectValue>
                                            {(val) => bulkTypeOptions.find((t) => t.value === val)?.label}
                                        </SelectValue>
                                    </SelectTrigger>
                                    <SelectContent>
                                        {bulkTypeOptions.map((opt) => (
                                            <SelectItem key={opt.value} value={opt.value}>
                                                {opt.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor="bulk-value">
                                    {type === 'percentage' ? 'Diskon (%)' : 'Nominal (Rp)'}{' '}
                                    <span className="text-destructive">*</span>
                                    <FieldTooltip content="Nilai diskon per voucher (persen 1-100 atau nominal Rupiah)." />
                                </Label>
                                <Input
                                    id="bulk-value"
                                    type="number"
                                    min={1}
                                    max={type === 'percentage' ? 100 : undefined}
                                    value={value}
                                    onChange={(e) => setValue(e.target.value)}
                                    className="h-9 font-mono"
                                    required
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor="bulk-max-disc">
                                    Maks. Diskon (Rp)
                                    <FieldTooltip content="Batas maksimal potongan Rupiah (untuk tipe persentase). Kosongkan jika tanpa batas." />
                                </Label>
                                <Input
                                    id="bulk-max-disc"
                                    type="number"
                                    min={0}
                                    value={maxDiscount}
                                    onChange={(e) => setMaxDiscount(e.target.value)}
                                    placeholder="Opsional"
                                    className="h-9 font-mono"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <div className="space-y-1.5">
                                <Label htmlFor="bulk-min-spend">
                                    Min. Belanja (Rp)
                                    <FieldTooltip content="Minimal total belanja eligible agar kode voucher dapat digunakan." />
                                </Label>
                                <Input
                                    id="bulk-min-spend"
                                    type="number"
                                    min={0}
                                    value={minSpend}
                                    onChange={(e) => setMinSpend(e.target.value)}
                                    className="h-9 font-mono"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor="bulk-quota">
                                    Kuota / Kode
                                    <FieldTooltip content="Berapa kali masing-masing kode unik dapat dipakai (default 1 = sekali pakai)." />
                                </Label>
                                <Input
                                    id="bulk-quota"
                                    type="number"
                                    min={1}
                                    value={totalQuota}
                                    onChange={(e) => setTotalQuota(e.target.value)}
                                    placeholder="1 (sekali pakai)"
                                    className="h-9 font-mono"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label>
                                    Status Awal
                                    <FieldTooltip content="Status awal seluruh voucher saat selesai digenerate (Aktif / Draft / Dijeda)." />
                                </Label>
                                <Select
                                    items={statusOptions}
                                    value={status}
                                    onValueChange={(val) => val && setStatus(val)}
                                >
                                    <SelectTrigger className="w-full h-9">
                                        <SelectValue>
                                            {(val) => statusOptions.find((s) => s.value === val)?.label}
                                        </SelectValue>
                                    </SelectTrigger>
                                    <SelectContent>
                                        {statusOptions.map((opt) => (
                                            <SelectItem key={opt.value} value={opt.value}>
                                                {opt.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <Label htmlFor="bulk-from">
                                    Mulai Berlaku (WIB)
                                    <FieldTooltip content="Tanggal dan jam mulai voucher dalam batch ini aktif (WIB)." />
                                </Label>
                                <Input
                                    id="bulk-from"
                                    type="datetime-local"
                                    value={validFrom}
                                    onChange={(e) => setValidFrom(e.target.value)}
                                    className="h-9 font-mono text-xs"
                                    required
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor="bulk-until">
                                    Berakhir Pada (WIB)
                                    <FieldTooltip content="Tanggal dan jam kedaluwarsa voucher dalam batch ini (WIB)." />
                                </Label>
                                <Input
                                    id="bulk-until"
                                    type="datetime-local"
                                    value={validUntil}
                                    onChange={(e) => setValidUntil(e.target.value)}
                                    className="h-9 font-mono text-xs"
                                    required
                                />
                                {errors.valid_until && <p className="text-xs text-destructive">{errors.valid_until}</p>}
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <div className="space-y-1.5">
                                <Label>
                                    Penanggung Biaya
                                    <FieldTooltip content="Pihak penanggung beban diskon (Toko, Supplier, atau Co-funding)." />
                                </Label>
                                <Select
                                    items={fundingOptions}
                                    value={funding}
                                    onValueChange={(val) => val && setFunding(val)}
                                >
                                    <SelectTrigger className="w-full h-9">
                                        <SelectValue>
                                            {(val) => fundingOptions.find((f) => f.value === val)?.label}
                                        </SelectValue>
                                    </SelectTrigger>
                                    <SelectContent>
                                        {fundingOptions.map((opt) => (
                                            <SelectItem key={opt.value} value={opt.value}>
                                                {opt.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="flex items-center justify-between rounded-lg border p-3 bg-muted/20">
                                <span className="text-xs font-medium flex items-center">
                                    Khusus Member
                                    <FieldTooltip content="Wajib memilih pelanggan member terdaftar saat transaksi." />
                                </span>
                                <Switch checked={memberOnly} onCheckedChange={setMemberOnly} />
                            </div>
                            <div className="flex items-center justify-between rounded-lg border p-3 bg-muted/20">
                                <span className="text-xs font-medium flex items-center">
                                    Gabung Promo
                                    <FieldTooltip content="Izinkan voucher dipakai bersamaan dengan promo otomatis." />
                                </span>
                                <Switch checked={stackableWithPromo} onCheckedChange={setStackableWithPromo} />
                            </div>
                        </div>
                    </div>

                    <DialogFooter className="px-6 py-4 border-t shrink-0 flex items-center justify-end gap-2 bg-muted/20">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => onOpenChange(false)}
                            className="cursor-pointer"
                        >
                            Batal
                        </Button>
                        <Button type="submit" disabled={isSubmitting} className="cursor-pointer">
                            {isSubmitting ? 'Membuat...' : `Generate ${Number(count) || 0} Voucher`}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}

export default VoucherBulkDialog

import React, { useEffect, useMemo, useState } from 'react'
import { router } from '@inertiajs/react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { FieldTooltip } from '@/components/ui/field-tooltip'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
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
import type { VoucherRow } from '@/types'
import { Dices, Search } from 'lucide-react'
import {
    SelectProductsMultiAsync,
    type PromotionProductOption,
} from '@/pages/POS/Promotions/component/SelectProductsMultiAsync'
import { DateTime24hInput, Time24hInput } from '@/components/ui/datetime-24h-input'

interface OptionItem {
    value: string
    label: string
}

interface ProductOption {
    id: number
    name: string
    barcode: string
}

interface CategoryOption {
    id: number
    name: string
}

interface VoucherFormDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    voucher: VoucherRow | null
    typeOptions: OptionItem[]
    statusOptions: OptionItem[]
    fundingOptions: OptionItem[]
    products: ProductOption[]
    categories: CategoryOption[]
    suppliers?: Array<{ id: number; name: string }>
}

const DAY_BITS: Array<{ bit: number; label: string }> = [
    { bit: 1, label: 'Sen' },
    { bit: 2, label: 'Sel' },
    { bit: 4, label: 'Rab' },
    { bit: 8, label: 'Kam' },
    { bit: 16, label: 'Jum' },
    { bit: 32, label: 'Sab' },
    { bit: 64, label: 'Min' },
]

function defaultDateTimeLocal(addDays = 0): string {
    const d = new Date()
    d.setDate(d.getDate() + addDays)
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function VoucherFormDialog({
    open,
    onOpenChange,
    voucher,
    typeOptions,
    statusOptions,
    fundingOptions,
    products,
    categories,
    suppliers = [],
}: VoucherFormDialogProps) {
    const [code, setCode] = useState('')
    const [name, setName] = useState('')
    const [type, setType] = useState('fixed_amount')
    const [value, setValue] = useState('')
    const [maxDiscount, setMaxDiscount] = useState('')
    const [minSpend, setMinSpend] = useState('0')
    const [validFrom, setValidFrom] = useState(defaultDateTimeLocal(0))
    const [validUntil, setValidUntil] = useState(defaultDateTimeLocal(14))
    const [allowedDays, setAllowedDays] = useState(127)
    const [useHappyHour, setUseHappyHour] = useState(false)
    const [allowedHoursStart, setAllowedHoursStart] = useState('')
    const [allowedHoursEnd, setAllowedHoursEnd] = useState('')
    const [totalQuota, setTotalQuota] = useState('')
    const [perCustomerLimit, setPerCustomerLimit] = useState('')
    const [perDayLimit, setPerDayLimit] = useState('')
    const [memberOnly, setMemberOnly] = useState(false)
    const [stackableWithPromo, setStackableWithPromo] = useState(true)
    const [stackableWithVoucher, setStackableWithVoucher] = useState(false)
    const [funding, setFunding] = useState('store')
    const [supplierId, setSupplierId] = useState('')
    const [storeSharePercent, setStoreSharePercent] = useState('50')
    const [supplierSharePercent, setSupplierSharePercent] = useState('50')
    const [status, setStatus] = useState('active')
    const [freeProductId, setFreeProductId] = useState<string>('')
    const [selectedProducts, setSelectedProducts] = useState<PromotionProductOption[]>([])
    const [selectedCategoryIds, setSelectedCategoryIds] = useState<number[]>([])
    const [categorySearch, setCategorySearch] = useState('')
    const [isGeneratingCode, setIsGeneratingCode] = useState(false)
    const [errors, setErrors] = useState<Record<string, string>>({})
    const [isSubmitting, setIsSubmitting] = useState(false)

    useEffect(() => {
        if (!open) return
        setErrors({})
        setCategorySearch('')

        if (voucher) {
            setCode(voucher.code)
            setName(voucher.name)
            setType(voucher.type)
            setValue(String(voucher.value ?? 0))
            setMaxDiscount(voucher.max_discount !== null ? String(voucher.max_discount) : '')
            setMinSpend(String(voucher.min_spend ?? 0))
            setValidFrom(voucher.valid_from)
            setValidUntil(voucher.valid_until)
            setAllowedDays(voucher.allowed_days ?? 127)
            setUseHappyHour(Boolean(voucher.allowed_hours_start || voucher.allowed_hours_end))
            setAllowedHoursStart(voucher.allowed_hours_start ?? '')
            setAllowedHoursEnd(voucher.allowed_hours_end ?? '')
            setTotalQuota(voucher.total_quota !== null ? String(voucher.total_quota) : '')
            setPerCustomerLimit(voucher.per_customer_limit !== null ? String(voucher.per_customer_limit) : '')
            setPerDayLimit(voucher.per_day_limit !== null ? String(voucher.per_day_limit) : '')
            setMemberOnly(voucher.member_only)
            setStackableWithPromo(voucher.stackable_with_promo)
            setStackableWithVoucher(voucher.stackable_with_voucher)
            setFunding(voucher.funding)
            setSupplierId(voucher.supplier_id ? String(voucher.supplier_id) : '')
            setStoreSharePercent(
                voucher.funding === 'shared'
                    ? String(voucher.store_share_percent ?? 50)
                    : voucher.funding === 'supplier'
                      ? '0'
                      : '100'
            )
            setSupplierSharePercent(
                voucher.funding === 'shared'
                    ? String(voucher.supplier_share_percent ?? 50)
                    : voucher.funding === 'supplier'
                      ? '100'
                      : '0'
            )
            setStatus(voucher.status)
            setFreeProductId(voucher.free_product_id ? String(voucher.free_product_id) : '')
            setSelectedProducts(
                (voucher.applicable_products ?? []).map((p) => ({
                    value: p.id,
                    label: `${p.name} (${p.barcode})`,
                    id: p.id,
                    name: p.name,
                    barcode: p.barcode,
                }))
            )
            setSelectedCategoryIds(voucher.applicable_categories ?? [])
        } else {
            setCode('')
            setName('')
            setType('fixed_amount')
            setValue('')
            setMaxDiscount('')
            setMinSpend('0')
            setValidFrom(defaultDateTimeLocal(0))
            setValidUntil(defaultDateTimeLocal(14))
            setAllowedDays(127)
            setUseHappyHour(false)
            setAllowedHoursStart('')
            setAllowedHoursEnd('')
            setTotalQuota('')
            setPerCustomerLimit('')
            setPerDayLimit('')
            setMemberOnly(false)
            setStackableWithPromo(true)
            setStackableWithVoucher(false)
            setFunding('store')
            setSupplierId('')
            setStoreSharePercent('50')
            setSupplierSharePercent('50')
            setStatus('active')
            setFreeProductId('')
            setSelectedProducts([])
            setSelectedCategoryIds([])
        }
    }, [open, voucher])

    const filteredCategories = useMemo(() => {
        const q = categorySearch.trim().toLowerCase()
        if (!q) return categories
        return categories.filter((c) => c.name.toLowerCase().includes(q))
    }, [categories, categorySearch])

    const freeProductItems = useMemo(
        () =>
            products.map((p) => ({
                value: String(p.id),
                label: `${p.name} (${p.barcode})`,
            })),
        [products]
    )

    const toggleDayBit = (bit: number) => {
        setAllowedDays((prev) => {
            const next = prev ^ bit
            return next === 0 ? prev : next
        })
    }

    const toggleCategory = (id: number) => {
        setSelectedCategoryIds((prev) =>
            prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
        )
    }

    const handleGenerateCode = async () => {
        setIsGeneratingCode(true)
        try {
            const res = await fetch(VoucherController.generateCode.url({ query: { length: 8 } }), {
                headers: { Accept: 'application/json' },
            })
            if (res.ok) {
                const data = (await res.json()) as { code?: string }
                if (data.code) {
                    setCode(data.code)
                }
            }
        } finally {
            setIsGeneratingCode(false)
        }
    }

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        setIsSubmitting(true)
        setErrors({})

        const payload = {
            code: code.trim().toUpperCase() || null,
            name: name.trim(),
            type,
            value: type === 'free_item' ? 0 : value !== '' ? Number(value) : 0,
            max_discount: maxDiscount !== '' ? Number(maxDiscount) : null,
            min_spend: minSpend !== '' ? Number(minSpend) : 0,
            valid_from: validFrom,
            valid_until: validUntil,
            allowed_days: allowedDays,
            allowed_hours_start: useHappyHour && allowedHoursStart ? allowedHoursStart : null,
            allowed_hours_end: useHappyHour && allowedHoursEnd ? allowedHoursEnd : null,
            total_quota: totalQuota !== '' ? Number(totalQuota) : null,
            per_customer_limit: perCustomerLimit !== '' ? Number(perCustomerLimit) : null,
            per_day_limit: perDayLimit !== '' ? Number(perDayLimit) : null,
            member_only: memberOnly,
            applicable_skus: selectedProducts.map((p) => p.barcode),
            applicable_categories: selectedCategoryIds,
            free_product_id: type === 'free_item' && freeProductId ? Number(freeProductId) : null,
            stackable_with_promo: stackableWithPromo,
            stackable_with_voucher: stackableWithVoucher,
            funding,
            supplier_id:
                (funding === 'supplier' || funding === 'shared') && supplierId !== ''
                    ? Number(supplierId)
                    : null,
            store_share_percent:
                funding === 'shared'
                    ? Number(storeSharePercent) || 0
                    : funding === 'supplier'
                      ? 0
                      : 100,
            supplier_share_percent:
                funding === 'shared'
                    ? Number(supplierSharePercent) || 0
                    : funding === 'supplier'
                      ? 100
                      : 0,
            status,
        }

        if (voucher) {
            router.patch(VoucherController.update.url({ voucher: voucher.id }), payload, {
                preserveScroll: true,
                onError: (errs) => setErrors(errs),
                onSuccess: () => onOpenChange(false),
                onFinish: () => setIsSubmitting(false),
            })
        } else {
            router.post(VoucherController.store.url(), payload, {
                preserveScroll: true,
                onError: (errs) => setErrors(errs),
                onSuccess: () => onOpenChange(false),
                onFinish: () => setIsSubmitting(false),
            })
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="w-[95vw] max-w-4xl sm:max-w-4xl max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden">
                <DialogHeader className="px-6 py-4 border-b shrink-0">
                    <DialogTitle className="text-lg">
                        {voucher ? 'Edit Voucher / Kode Promo' : 'Tambah Voucher / Kode Promo'}
                    </DialogTitle>
                    <DialogDescription>
                        Kode voucher selalu disimpan huruf kapital tanpa spasi dan divalidasi secara online di kasir.
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
                    <div className="flex-1 overflow-y-auto overflow-x-hidden px-6 py-5 space-y-5">
                        {/* Identitas Voucher */}
                        <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                            <div className="md:col-span-5 space-y-1.5">
                                <Label htmlFor="voucher-code">
                                    Kode Voucher
                                    <FieldTooltip content="Kode unik yang diinput kasir saat checkout. Kosongkan atau klik Acak untuk generate otomatis." />
                                </Label>
                                <div className="flex gap-2">
                                    <Input
                                        id="voucher-code"
                                        value={code}
                                        onChange={(e) => setCode(e.target.value.toUpperCase().replace(/\s+/g, ''))}
                                        placeholder="Kosongkan untuk otomatis"
                                        className="h-9 font-mono uppercase"
                                    />
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={() => void handleGenerateCode()}
                                        disabled={isGeneratingCode}
                                        className="h-9 gap-1.5 shrink-0 cursor-pointer"
                                        title="Generate kode acak tanpa karakter ambigu"
                                    >
                                        <Dices className="h-4 w-4" />
                                        Acak
                                    </Button>
                                </div>
                                {errors.code && <p className="text-xs text-destructive">{errors.code}</p>}
                            </div>

                            <div className="md:col-span-7 space-y-1.5">
                                <Label htmlFor="voucher-name">
                                    Nama Voucher <span className="text-destructive">*</span>
                                    <FieldTooltip content="Nama deskriptif voucher yang tampil di laporan, kasir, dan struk belanja." />
                                </Label>
                                <Input
                                    id="voucher-name"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    placeholder="Contoh: Voucher Gajian Potongan Rp 15.000"
                                    className="h-9"
                                    required
                                />
                                {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="space-y-1.5">
                                <Label>
                                    Tipe Voucher
                                    <FieldTooltip content="Pilih jenis manfaat voucher: potongan nominal (Rp), persentase (%), atau produk gratis." />
                                </Label>
                                <Select items={typeOptions} value={type} onValueChange={(val) => val && setType(val)}>
                                    <SelectTrigger className="w-full h-9">
                                        <SelectValue>
                                            {(val) => typeOptions.find((item) => item.value === val)?.label}
                                        </SelectValue>
                                    </SelectTrigger>
                                    <SelectContent>
                                        {typeOptions.map((opt) => (
                                            <SelectItem key={opt.value} value={opt.value}>
                                                {opt.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-1.5">
                                <Label>
                                    Penanggung Biaya
                                    <FieldTooltip content="Pihak yang menanggung beban diskon voucher (Toko, Supplier/Principal, atau Co-funding) untuk laporan akuntansi." />
                                </Label>
                                <Select
                                    items={fundingOptions}
                                    value={funding}
                                    onValueChange={(val) => val && setFunding(val)}
                                >
                                    <SelectTrigger className="w-full h-9">
                                        <SelectValue>
                                            {(val) => fundingOptions.find((item) => item.value === val)?.label}
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

                            <div className="space-y-1.5">
                                <Label>
                                    Status Voucher
                                    <FieldTooltip content="Draft tidak bisa dipakai di kasir, Aktif langsung berlaku sesuai jadwal, Dijeda menghentikan sementara." />
                                </Label>
                                <Select
                                    items={statusOptions}
                                    value={status}
                                    onValueChange={(val) => val && setStatus(val)}
                                >
                                    <SelectTrigger className="w-full h-9">
                                        <SelectValue>
                                            {(val) => statusOptions.find((item) => item.value === val)?.label}
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

                        {(funding === 'supplier' || funding === 'shared') && (
                            <div className="rounded-lg border border-blue-200/80 bg-blue-50/40 dark:border-blue-900/60 dark:bg-blue-950/20 p-4 space-y-3">
                                <p className="text-xs font-semibold uppercase tracking-wider text-blue-700 dark:text-blue-300">
                                    Rincian Penanggung Biaya &amp; Pelacakan Klaim Supplier
                                </p>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div className="space-y-1.5">
                                        <Label>
                                            Supplier Penanggung
                                            <FieldTooltip content="Pilih supplier yang menanggung biaya voucher agar klaim penukaran dapat dilacak di Laporan Keuangan." />
                                        </Label>
                                        <Select
                                            items={suppliers.map((s) => ({ value: String(s.id), label: s.name }))}
                                            value={supplierId}
                                            onValueChange={(val) => setSupplierId(val ?? '')}
                                        >
                                            <SelectTrigger className="w-full h-9">
                                                <SelectValue placeholder="Pilih supplier">
                                                    {(val) =>
                                                        suppliers.find((s) => String(s.id) === val)?.name ??
                                                        'Pilih supplier'
                                                    }
                                                </SelectValue>
                                            </SelectTrigger>
                                            <SelectContent>
                                                {suppliers.map((s) => (
                                                    <SelectItem key={s.id} value={String(s.id)}>
                                                        {s.name}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    {funding === 'shared' && (
                                        <>
                                            <div className="space-y-1.5">
                                                <Label htmlFor="voucher-store-share">
                                                    Porsi Toko (%)
                                                    <FieldTooltip content="Persentase beban diskon voucher yang ditanggung toko (0-100%)." />
                                                </Label>
                                                <Input
                                                    id="voucher-store-share"
                                                    type="number"
                                                    min={0}
                                                    max={100}
                                                    step="0.01"
                                                    value={storeSharePercent}
                                                    onChange={(e) => {
                                                        const raw = Math.min(100, Math.max(0, Number(e.target.value) || 0))
                                                        setStoreSharePercent(e.target.value)
                                                        setSupplierSharePercent(String(Math.round((100 - raw) * 100) / 100))
                                                    }}
                                                    className="h-9 font-mono"
                                                />
                                            </div>
                                            <div className="space-y-1.5">
                                                <Label htmlFor="voucher-supplier-share">
                                                    Porsi Supplier (%)
                                                    <FieldTooltip content="Persentase beban diskon voucher yang akan diklaim ke supplier." />
                                                </Label>
                                                <Input
                                                    id="voucher-supplier-share"
                                                    type="number"
                                                    min={0}
                                                    max={100}
                                                    step="0.01"
                                                    value={supplierSharePercent}
                                                    onChange={(e) => {
                                                        const raw = Math.min(100, Math.max(0, Number(e.target.value) || 0))
                                                        setSupplierSharePercent(e.target.value)
                                                        setStoreSharePercent(String(Math.round((100 - raw) * 100) / 100))
                                                    }}
                                                    className="h-9 font-mono"
                                                />
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Parameter Potongan */}
                        <div className="rounded-lg border bg-muted/20 p-4 space-y-4">
                            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                Nilai Manfaat &amp; Syarat Minimal Belanja
                            </p>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                {type !== 'free_item' ? (
                                    <div className="space-y-1.5">
                                        <Label htmlFor="voucher-value">
                                            {type === 'percentage' ? 'Persentase Diskon (%)' : 'Nominal Potongan (Rp)'}{' '}
                                            <span className="text-destructive">*</span>
                                            <FieldTooltip
                                                content={
                                                    type === 'percentage'
                                                        ? 'Besar diskon dalam persen (1-100%) dari subtotal item yang memenuhi syarat.'
                                                        : 'Nominal potongan harga tetap dalam Rupiah.'
                                                }
                                            />
                                        </Label>
                                        <Input
                                            id="voucher-value"
                                            type="number"
                                            min={1}
                                            max={type === 'percentage' ? 100 : undefined}
                                            step="any"
                                            value={value}
                                            onChange={(e) => setValue(e.target.value)}
                                            className="h-9 font-mono"
                                            required
                                        />
                                        {errors.value && <p className="text-xs text-destructive">{errors.value}</p>}
                                    </div>
                                ) : (
                                    <div className="space-y-1.5">
                                        <Label>
                                            Produk Gratis <span className="text-destructive">*</span>
                                            <FieldTooltip content="Produk yang akan diberikan gratis (diskon 100%) saat voucher digunakan." />
                                        </Label>
                                        <Select
                                            items={freeProductItems}
                                            value={freeProductId}
                                            onValueChange={(val) => val && setFreeProductId(val)}
                                        >
                                            <SelectTrigger className="w-full h-9">
                                                <SelectValue placeholder="Pilih produk gratis">
                                                    {(val) =>
                                                        freeProductItems.find((item) => item.value === val)?.label ??
                                                        'Pilih produk gratis'
                                                    }
                                                </SelectValue>
                                            </SelectTrigger>
                                            <SelectContent>
                                                {freeProductItems.map((opt) => (
                                                    <SelectItem key={opt.value} value={opt.value}>
                                                        {opt.label}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        {errors.free_product_id && (
                                            <p className="text-xs text-destructive">{errors.free_product_id}</p>
                                        )}
                                    </div>
                                )}

                                <div className="space-y-1.5">
                                    <Label htmlFor="voucher-max-disc">
                                        Plafon Maks. Diskon (Rp)
                                        <FieldTooltip content="Batas maksimal nominal potongan dalam Rupiah (berguna untuk voucher persentase). Kosongkan jika tanpa batas." />
                                    </Label>
                                    <Input
                                        id="voucher-max-disc"
                                        type="number"
                                        min={0}
                                        value={maxDiscount}
                                        onChange={(e) => setMaxDiscount(e.target.value)}
                                        placeholder="Opsional"
                                        className="h-9 font-mono"
                                    />
                                </div>

                                <div className="space-y-1.5">
                                    <Label htmlFor="voucher-min-spend">
                                        Min. Belanja Eligible (Rp)
                                        <FieldTooltip content="Minimal total belanja item yang memenuhi syarat agar voucher dapat digunakan. Isi 0 jika tanpa minimal." />
                                    </Label>
                                    <Input
                                        id="voucher-min-spend"
                                        type="number"
                                        min={0}
                                        value={minSpend}
                                        onChange={(e) => setMinSpend(e.target.value)}
                                        className="h-9 font-mono"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Produk & Kategori Eligible (Opsional) */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="rounded-lg border p-4 space-y-2.5 bg-card">
                                <div className="flex items-center justify-between gap-2">
                                    <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                        Batasi Produk (Opsional)
                                        <FieldTooltip content="Jika diisi, voucher hanya berlaku untuk produk yang dipilih. Kosongkan agar berlaku untuk semua produk." />
                                    </Label>
                                    <Badge variant="secondary" className="font-mono text-[11px]">
                                        {selectedProducts.length} produk
                                    </Badge>
                                </div>
                                <SelectProductsMultiAsync
                                    value={selectedProducts}
                                    onChange={setSelectedProducts}
                                    disabled={isSubmitting}
                                    placeholder="Kosongkan untuk berlaku semua produk..."
                                />
                                <p className="text-[11px] text-muted-foreground">
                                    Produk yang dikecualikan dari promo (rokok, pulsa, donasi, dll.) otomatis ditolak.
                                </p>
                            </div>

                            <div className="rounded-lg border p-4 space-y-2.5 bg-card">
                                <div className="flex items-center justify-between gap-2">
                                    <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                        Batasi Kategori (Opsional)
                                        <FieldTooltip content="Jika dicentang, voucher hanya berlaku untuk produk dalam kategori terpilih." />
                                    </Label>
                                    <Badge variant="secondary" className="font-mono text-[11px]">
                                        {selectedCategoryIds.length} kategori
                                    </Badge>
                                </div>
                                <div className="relative">
                                    <Search className="h-3.5 w-3.5 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                                    <Input
                                        value={categorySearch}
                                        onChange={(e) => setCategorySearch(e.target.value)}
                                        placeholder="Filter kategori..."
                                        className="h-8 pl-8 text-xs"
                                    />
                                </div>
                                <div className="max-h-32 overflow-y-auto grid grid-cols-1 sm:grid-cols-2 gap-1 rounded-md border bg-background p-2">
                                    {filteredCategories.map((c) => {
                                        const checked = selectedCategoryIds.includes(c.id)
                                        return (
                                            <label
                                                key={c.id}
                                                className="flex items-center gap-2 rounded-md px-2 py-1 text-xs cursor-pointer hover:bg-muted/50"
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={checked}
                                                    onChange={() => toggleCategory(c.id)}
                                                    className="rounded border-input"
                                                />
                                                <span className="font-medium text-foreground truncate">{c.name}</span>
                                            </label>
                                        )
                                    })}
                                </div>
                            </div>
                        </div>

                        {/* Periode, Hari & Jam Berlaku (WIB 24 Jam) */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <Label htmlFor="voucher-valid-from">
                                    Mulai Berlaku (WIB, 24 Jam) <span className="text-destructive">*</span>
                                    <FieldTooltip content="Tanggal dan jam mulai voucher dapat digunakan di kasir (format 24 jam WIB)." />
                                </Label>
                                <DateTime24hInput
                                    id="voucher-valid-from"
                                    value={validFrom}
                                    onChange={setValidFrom}
                                    required
                                />
                                {errors.valid_from && <p className="text-xs text-destructive">{errors.valid_from}</p>}
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor="voucher-valid-until">
                                    Berakhir Pada (WIB, 24 Jam) <span className="text-destructive">*</span>
                                    <FieldTooltip content="Tanggal dan jam kedaluwarsa voucher (format 24 jam WIB)." />
                                </Label>
                                <DateTime24hInput
                                    id="voucher-valid-until"
                                    value={validUntil}
                                    onChange={setValidUntil}
                                    required
                                />
                                {errors.valid_until && <p className="text-xs text-destructive">{errors.valid_until}</p>}
                            </div>
                        </div>

                        <div className="space-y-3">
                            <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                                <div className="space-y-1.5">
                                    <Label>
                                        Hari Berlaku (WIB)
                                        <FieldTooltip content="Pilih hari-hari tertentu saat voucher aktif (misal khusus akhir pekan Sab-Min)." />
                                    </Label>
                                    <div className="flex flex-wrap gap-1.5">
                                        {DAY_BITS.map((day) => {
                                            const active = (allowedDays & day.bit) !== 0
                                            return (
                                                <Button
                                                    key={day.bit}
                                                    type="button"
                                                    size="sm"
                                                    variant={active ? 'default' : 'outline'}
                                                    onClick={() => toggleDayBit(day.bit)}
                                                    className="h-9 px-3 text-xs cursor-pointer"
                                                >
                                                    {day.label}
                                                </Button>
                                            )
                                        })}
                                    </div>
                                </div>

                                <div className="flex items-center gap-2.5 rounded-md border bg-muted/20 px-3 py-2">
                                    <div>
                                        <p className="text-xs font-medium flex items-center">
                                            Jam Khusus Harian (Happy Hour)
                                            <FieldTooltip content="Aktifkan hanya jika voucher berlaku di jam tertentu setiap harinya. Jika nonaktif, voucher berlaku 24 jam penuh." />
                                        </p>
                                        <p className="text-[10px] text-muted-foreground">
                                            Opsional • Format 24 jam
                                        </p>
                                    </div>
                                    <Switch
                                        checked={useHappyHour}
                                        onCheckedChange={(checked) => {
                                            setUseHappyHour(checked)
                                            if (!checked) {
                                                setAllowedHoursStart('')
                                                setAllowedHoursEnd('')
                                            }
                                        }}
                                    />
                                </div>
                            </div>

                            {useHappyHour && (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 rounded-md border bg-muted/20 p-3">
                                    <div className="space-y-1.5">
                                        <Label htmlFor="voucher-hours-start">
                                            Jam Mulai Harian (24 Jam)
                                            <FieldTooltip content="Jam mulai berlaku setiap hari (format 24 jam, misal 14:00)." />
                                        </Label>
                                        <Time24hInput
                                            id="voucher-hours-start"
                                            value={allowedHoursStart}
                                            onChange={setAllowedHoursStart}
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label htmlFor="voucher-hours-end">
                                            Jam Selesai Harian (24 Jam)
                                            <FieldTooltip content="Jam berakhir berlaku setiap hari (format 24 jam, misal 17:00)." />
                                        </Label>
                                        <Time24hInput
                                            id="voucher-hours-end"
                                            value={allowedHoursEnd}
                                            onChange={setAllowedHoursEnd}
                                        />
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Batas Kuota */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <div className="space-y-1.5">
                                <Label htmlFor="voucher-quota">
                                    Kuota Total
                                    <FieldTooltip content="Total maksimal berapa kali voucher ini boleh digunakan oleh seluruh pelanggan. Kosongkan jika tak terbatas." />
                                </Label>
                                <Input
                                    id="voucher-quota"
                                    type="number"
                                    min={1}
                                    value={totalQuota}
                                    onChange={(e) => setTotalQuota(e.target.value)}
                                    placeholder="Tanpa batas"
                                    className="h-9 font-mono"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor="voucher-per-customer">
                                    Batas / Pelanggan
                                    <FieldTooltip content="Maksimal pemakaian voucher oleh 1 pelanggan (member) yang sama. Kosongkan jika tak terbatas." />
                                </Label>
                                <Input
                                    id="voucher-per-customer"
                                    type="number"
                                    min={1}
                                    value={perCustomerLimit}
                                    onChange={(e) => setPerCustomerLimit(e.target.value)}
                                    placeholder="Tanpa batas"
                                    className="h-9 font-mono"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor="voucher-per-day">
                                    Batas / Hari
                                    <FieldTooltip content="Maksimal pemakaian voucher dalam 1 hari (reset setiap tengah malam WIB). Kosongkan jika tak terbatas." />
                                </Label>
                                <Input
                                    id="voucher-per-day"
                                    type="number"
                                    min={1}
                                    value={perDayLimit}
                                    onChange={(e) => setPerDayLimit(e.target.value)}
                                    placeholder="Tanpa batas"
                                    className="h-9 font-mono"
                                />
                            </div>
                        </div>

                        {/* Toggles */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            <div className="flex items-center justify-between rounded-lg border p-3 bg-muted/20">
                                <div className="pr-2">
                                    <p className="text-xs font-semibold flex items-center">
                                        Khusus Member
                                        <FieldTooltip content="Jika aktif, kasir wajib memilih pelanggan member terdaftar agar voucher bisa dipakai." />
                                    </p>
                                    <p className="text-[11px] text-muted-foreground">Wajib pilih member aktif</p>
                                </div>
                                <Switch checked={memberOnly} onCheckedChange={setMemberOnly} />
                            </div>
                            <div className="flex items-center justify-between rounded-lg border p-3 bg-muted/20">
                                <div className="pr-2">
                                    <p className="text-xs font-semibold flex items-center">
                                        Gabung Promo Item
                                        <FieldTooltip content="Izinkan voucher ini dipakai bersamaan dengan promo otomatis/harga grosir pada item." />
                                    </p>
                                    <p className="text-[11px] text-muted-foreground">Boleh gabung promo otomatis</p>
                                </div>
                                <Switch checked={stackableWithPromo} onCheckedChange={setStackableWithPromo} />
                            </div>
                            <div className="flex items-center justify-between rounded-lg border p-3 bg-muted/20">
                                <div className="pr-2">
                                    <p className="text-xs font-semibold flex items-center">
                                        Gabung Voucher Lain
                                        <FieldTooltip content="Izinkan voucher ini digabungkan dengan kode voucher lain dalam 1 transaksi yang sama." />
                                    </p>
                                    <p className="text-[11px] text-muted-foreground">Default 1 voucher/struk</p>
                                </div>
                                <Switch checked={stackableWithVoucher} onCheckedChange={setStackableWithVoucher} />
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
                            {isSubmitting ? 'Menyimpan...' : 'Simpan Voucher'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}

export default VoucherFormDialog

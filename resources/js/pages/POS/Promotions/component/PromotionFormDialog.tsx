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
import PromotionController from '@/actions/App/Http/Controllers/PromotionController'
import type { PromotionRow } from '@/types'
import { Plus, Search, Trash2 } from 'lucide-react'
import {
    SelectProductsMultiAsync,
    type PromotionProductOption,
} from './SelectProductsMultiAsync'

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

interface BundleItemDraft {
    product_id: string
    required_qty: string
}

interface PromotionFormDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    promotion: PromotionRow | null
    typeOptions: OptionItem[]
    scopeOptions: OptionItem[]
    fundingOptions: OptionItem[]
    paymentMethodOptions?: OptionItem[]
    products: ProductOption[]
    categories: CategoryOption[]
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

const DEFAULT_PAYMENT_METHODS: OptionItem[] = [
    { value: 'cash', label: 'Tunai' },
    { value: 'qris', label: 'QRIS' },
    { value: 'debit', label: 'Kartu Debit / EDC' },
    { value: 'transfer', label: 'Transfer Bank' },
]

const ITEM_SCOPED_TYPES = new Set([
    'percentage_discount',
    'fixed_discount',
    'buy_x_get_y',
    'multibuy_price',
    'nth_item_discount',
    'mix_match',
    'near_expiry',
])

function defaultDateTimeLocal(addDays = 0): string {
    const d = new Date()
    d.setDate(d.getDate() + addDays)
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function PromotionFormDialog({
    open,
    onOpenChange,
    promotion,
    typeOptions,
    scopeOptions,
    fundingOptions,
    paymentMethodOptions = DEFAULT_PAYMENT_METHODS,
    products,
    categories,
}: PromotionFormDialogProps) {
    const [code, setCode] = useState('')
    const [name, setName] = useState('')
    const [type, setType] = useState('percentage_discount')
    const [scope, setScope] = useState('all_products')
    const [funding, setFunding] = useState('store')
    const [discountValue, setDiscountValue] = useState('')
    const [maxDiscountAmount, setMaxDiscountAmount] = useState('')
    const [minPurchaseAmount, setMinPurchaseAmount] = useState('0')
    const [buyQty, setBuyQty] = useState('2')
    const [getQty, setGetQty] = useState('1')
    const [getDiscountPercent, setGetDiscountPercent] = useState('100')
    const [bundlePrice, setBundlePrice] = useState('')
    const [nthItem, setNthItem] = useState('2')
    const [rewardProductId, setRewardProductId] = useState('')
    const [specialPrice, setSpecialPrice] = useState('')
    const [paymentMethod, setPaymentMethod] = useState('qris')
    const [paymentBinPrefix, setPaymentBinPrefix] = useState('')
    const [nearExpiryDays, setNearExpiryDays] = useState('7')
    const [bundleItems, setBundleItems] = useState<BundleItemDraft[]>([])
    const [startsAt, setStartsAt] = useState(defaultDateTimeLocal(0))
    const [endsAt, setEndsAt] = useState(defaultDateTimeLocal(7))
    const [daysMask, setDaysMask] = useState(127)
    const [timeStart, setTimeStart] = useState('')
    const [timeEnd, setTimeEnd] = useState('')
    const [quotaTotal, setQuotaTotal] = useState('')
    const [maxQtyPerTx, setMaxQtyPerTx] = useState('')
    const [maxQtyPerCustomerPerDay, setMaxQtyPerCustomerPerDay] = useState('')
    const [stackable, setStackable] = useState(false)
    const [exclusiveGroup, setExclusiveGroup] = useState('')
    const [priority, setPriority] = useState('0')
    const [memberOnly, setMemberOnly] = useState(false)
    const [isActive, setIsActive] = useState(true)
    const [selectedProducts, setSelectedProducts] = useState<PromotionProductOption[]>([])
    const [selectedCategoryIds, setSelectedCategoryIds] = useState<number[]>([])
    const [categorySearch, setCategorySearch] = useState('')
    const [errors, setErrors] = useState<Record<string, string>>({})
    const [isSubmitting, setIsSubmitting] = useState(false)

    const resolvedPaymentMethods = paymentMethodOptions.length > 0 ? paymentMethodOptions : DEFAULT_PAYMENT_METHODS

    const productSelectItems = useMemo(
        () =>
            products.map((p) => ({
                value: String(p.id),
                label: `${p.name} (${p.barcode})`,
            })),
        [products]
    )

    useEffect(() => {
        if (!open) return
        setErrors({})
        setCategorySearch('')

        if (promotion) {
            setCode(promotion.code ?? '')
            setName(promotion.name)
            setType(promotion.type)
            setScope(promotion.scope)
            setFunding(promotion.funding)
            setDiscountValue(promotion.discount_value !== null ? String(promotion.discount_value) : '')
            setMaxDiscountAmount(promotion.max_discount_amount !== null ? String(promotion.max_discount_amount) : '')
            setMinPurchaseAmount(String(promotion.min_purchase_amount ?? 0))
            setBuyQty(promotion.buy_qty !== null ? String(promotion.buy_qty) : '2')
            setGetQty(promotion.get_qty !== null ? String(promotion.get_qty) : '1')
            setGetDiscountPercent(String(promotion.get_discount_percent ?? 100))
            setBundlePrice(promotion.bundle_price !== null ? String(promotion.bundle_price) : '')
            setNthItem(promotion.nth_item !== null && promotion.nth_item !== undefined ? String(promotion.nth_item) : '2')
            setRewardProductId(
                promotion.reward_product_id !== null && promotion.reward_product_id !== undefined
                    ? String(promotion.reward_product_id)
                    : ''
            )
            setSpecialPrice(
                promotion.special_price !== null && promotion.special_price !== undefined
                    ? String(promotion.special_price)
                    : ''
            )
            setPaymentMethod(promotion.payment_method ?? 'qris')
            setPaymentBinPrefix(promotion.payment_bin_prefix ?? '')
            setNearExpiryDays(
                promotion.near_expiry_days !== null && promotion.near_expiry_days !== undefined
                    ? String(promotion.near_expiry_days)
                    : '7'
            )
            setBundleItems(
                (promotion.bundle_items ?? []).map((bi) => ({
                    product_id: String(bi.product_id),
                    required_qty: String(bi.required_qty),
                }))
            )
            setStartsAt(promotion.starts_at)
            setEndsAt(promotion.ends_at)
            setDaysMask(promotion.days_mask ?? 127)
            setTimeStart(promotion.time_start ?? '')
            setTimeEnd(promotion.time_end ?? '')
            setQuotaTotal(promotion.quota_total !== null ? String(promotion.quota_total) : '')
            setMaxQtyPerTx(promotion.max_qty_per_transaction !== null ? String(promotion.max_qty_per_transaction) : '')
            setMaxQtyPerCustomerPerDay(
                promotion.max_qty_per_customer_per_day !== null
                    ? String(promotion.max_qty_per_customer_per_day)
                    : ''
            )
            setStackable(promotion.stackable)
            setExclusiveGroup(promotion.exclusive_group ?? '')
            setPriority(String(promotion.priority ?? 0))
            setMemberOnly(promotion.member_only)
            setIsActive(promotion.is_active)

            const initialProductRows =
                promotion.selected_products && promotion.selected_products.length > 0
                    ? promotion.selected_products
                    : products.filter((p) => (promotion.product_ids ?? []).includes(p.id))

            setSelectedProducts(
                initialProductRows.map((p) => ({
                    value: p.id,
                    label: `${p.name} (${p.barcode})`,
                    id: p.id,
                    name: p.name,
                    barcode: p.barcode,
                }))
            )
            setSelectedCategoryIds(promotion.category_ids ?? [])
        } else {
            setCode('')
            setName('')
            setType('percentage_discount')
            setScope('all_products')
            setFunding('store')
            setDiscountValue('')
            setMaxDiscountAmount('')
            setMinPurchaseAmount('0')
            setBuyQty('2')
            setGetQty('1')
            setGetDiscountPercent('100')
            setBundlePrice('')
            setNthItem('2')
            setRewardProductId(products[0] ? String(products[0].id) : '')
            setSpecialPrice('')
            setPaymentMethod('qris')
            setPaymentBinPrefix('')
            setNearExpiryDays('7')
            setBundleItems(
                products.length >= 2
                    ? [
                        { product_id: String(products[0].id), required_qty: '1' },
                        { product_id: String(products[1].id), required_qty: '1' },
                    ]
                    : products.length === 1
                      ? [{ product_id: String(products[0].id), required_qty: '1' }]
                      : []
            )
            setStartsAt(defaultDateTimeLocal(0))
            setEndsAt(defaultDateTimeLocal(7))
            setDaysMask(127)
            setTimeStart('')
            setTimeEnd('')
            setQuotaTotal('')
            setMaxQtyPerTx('')
            setMaxQtyPerCustomerPerDay('')
            setStackable(false)
            setExclusiveGroup('')
            setPriority('0')
            setMemberOnly(false)
            setIsActive(true)
            setSelectedProducts([])
            setSelectedCategoryIds([])
        }
    }, [open, promotion, products])

    const filteredCategories = useMemo(() => {
        const q = categorySearch.trim().toLowerCase()
        if (!q) return categories
        return categories.filter((c) => c.name.toLowerCase().includes(q))
    }, [categories, categorySearch])

    const usesItemScope = ITEM_SCOPED_TYPES.has(type)

    const toggleDayBit = (bit: number) => {
        setDaysMask((prev) => {
            const next = prev ^ bit
            return next === 0 ? prev : next
        })
    }

    const toggleCategory = (id: number) => {
        setSelectedCategoryIds((prev) =>
            prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
        )
    }

    const addBundleItemRow = () => {
        setBundleItems((prev) => [
            ...prev,
            { product_id: products[0] ? String(products[0].id) : '', required_qty: '1' },
        ])
    }

    const updateBundleItemRow = (index: number, patch: Partial<BundleItemDraft>) => {
        setBundleItems((prev) => prev.map((row, idx) => (idx === index ? { ...row, ...patch } : row)))
    }

    const removeBundleItemRow = (index: number) => {
        setBundleItems((prev) => prev.filter((_, idx) => idx !== index))
    }

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        setIsSubmitting(true)
        setErrors({})

        const normalizedBundleItems =
            type === 'bundle'
                ? bundleItems
                      .filter((row) => Number(row.product_id) > 0)
                      .map((row) => ({
                          product_id: Number(row.product_id),
                          required_qty: Math.max(1, Number(row.required_qty) || 1),
                      }))
                : []

        const payload = {
            code: code.trim() || null,
            name: name.trim(),
            type,
            scope: usesItemScope ? scope : 'all_products',
            funding,
            discount_value: discountValue !== '' ? Number(discountValue) : null,
            max_discount_amount: maxDiscountAmount !== '' ? Number(maxDiscountAmount) : null,
            min_purchase_amount: minPurchaseAmount !== '' ? Number(minPurchaseAmount) : 0,
            buy_qty: buyQty !== '' ? Number(buyQty) : null,
            get_qty: getQty !== '' ? Number(getQty) : null,
            get_discount_percent: getDiscountPercent !== '' ? Number(getDiscountPercent) : 100,
            bundle_price: bundlePrice !== '' ? Number(bundlePrice) : null,
            nth_item: type === 'nth_item_discount' && nthItem !== '' ? Number(nthItem) : null,
            reward_product_id:
                (type === 'tebus_murah' || type === 'gift_with_purchase') && rewardProductId !== ''
                    ? Number(rewardProductId)
                    : null,
            special_price: type === 'tebus_murah' && specialPrice !== '' ? Number(specialPrice) : null,
            payment_method: type === 'payment_promo' ? paymentMethod : null,
            payment_bin_prefix:
                type === 'payment_promo' && paymentBinPrefix.trim() !== '' ? paymentBinPrefix.trim() : null,
            near_expiry_days: type === 'near_expiry' && nearExpiryDays !== '' ? Number(nearExpiryDays) : null,
            bundle_items: normalizedBundleItems,
            starts_at: startsAt,
            ends_at: endsAt,
            days_mask: daysMask,
            time_start: timeStart || null,
            time_end: timeEnd || null,
            quota_total: quotaTotal !== '' ? Number(quotaTotal) : null,
            max_qty_per_transaction: maxQtyPerTx !== '' ? Number(maxQtyPerTx) : null,
            max_qty_per_customer_per_day:
                maxQtyPerCustomerPerDay !== '' ? Number(maxQtyPerCustomerPerDay) : null,
            stackable,
            exclusive_group: exclusiveGroup.trim() || null,
            priority: Number(priority) || 0,
            member_only: memberOnly,
            is_active: isActive,
            product_ids: usesItemScope && scope === 'product' ? selectedProducts.map((p) => p.id) : [],
            category_ids: usesItemScope && scope === 'category' ? selectedCategoryIds : [],
        }

        if (promotion) {
            router.patch(PromotionController.update.url({ promotion: promotion.id }), payload, {
                preserveScroll: true,
                onError: (errs) => setErrors(errs),
                onSuccess: () => onOpenChange(false),
                onFinish: () => setIsSubmitting(false),
            })
        } else {
            router.post(PromotionController.store.url(), payload, {
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
                        {promotion ? 'Edit Promo Penjualan' : 'Tambah Promo Penjualan'}
                    </DialogTitle>
                    <DialogDescription>
                        Konfigurasi promo item, bundel, level transaksi (Min. Belanja, Tebus Murah, GWP, Cashback), dan promo metode bayar.
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
                    <div className="flex-1 overflow-y-auto overflow-x-hidden px-6 py-5 space-y-5">
                        {/* Identitas Promo */}
                        <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                            <div className="md:col-span-8 space-y-1.5">
                                <Label htmlFor="promo-name">
                                    Nama Promo <span className="text-destructive">*</span>
                                    <FieldTooltip content="Nama promo yang akan tampil di kasir, struk belanja, dan laporan penjualan." />
                                </Label>
                                <Input
                                    id="promo-name"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    placeholder="Contoh: Promo Akhir Pekan Minuman 15%"
                                    className="h-9"
                                    required
                                />
                                {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
                            </div>

                            <div className="md:col-span-4 space-y-1.5">
                                <Label htmlFor="promo-code">
                                    Kode Promo (Opsional)
                                    <FieldTooltip content="Kode referensi internal promo (opsional, untuk memudahkan pencarian dan pelaporan)." />
                                </Label>
                                <Input
                                    id="promo-code"
                                    value={code}
                                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                                    placeholder="WEEKEND15"
                                    className="h-9 font-mono uppercase"
                                />
                                {errors.code && <p className="text-xs text-destructive">{errors.code}</p>}
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="space-y-1.5">
                                <Label>
                                    Tipe Promo
                                    <FieldTooltip content="Pilih mekanisme promo: diskon %, potongan nominal, Beli X Gratis Y, paket bundel, tebus murah, cashback, atau promo metode bayar." />
                                </Label>
                                <Select
                                    items={typeOptions}
                                    value={type}
                                    onValueChange={(val) => val && setType(val)}
                                >
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

                            {usesItemScope ? (
                                <div className="space-y-1.5">
                                    <Label>
                                        Lingkup Target
                                        <FieldTooltip content="Tentukan apakah promo berlaku untuk semua produk, kategori tertentu, atau produk tertentu saja." />
                                    </Label>
                                    <Select
                                        items={scopeOptions}
                                        value={scope}
                                        onValueChange={(val) => val && setScope(val)}
                                    >
                                        <SelectTrigger className="w-full h-9">
                                            <SelectValue>
                                                {(val) => scopeOptions.find((item) => item.value === val)?.label}
                                            </SelectValue>
                                        </SelectTrigger>
                                        <SelectContent>
                                            {scopeOptions.map((opt) => (
                                                <SelectItem key={opt.value} value={opt.value}>
                                                    {opt.label}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            ) : (
                                <div className="space-y-1.5">
                                    <Label>Lingkup Evaluasi</Label>
                                    <div className="flex h-9 items-center rounded-md border bg-muted/40 px-3 text-xs text-muted-foreground">
                                        {type === 'bundle'
                                            ? 'Multi-SKU Bundel'
                                            : type === 'payment_promo'
                                              ? 'Level Metode Pembayaran'
                                              : 'Level Transaksi / Struk'}
                                    </div>
                                </div>
                            )}

                            <div className="space-y-1.5">
                                <Label>
                                    Penanggung Biaya
                                    <FieldTooltip content="Pihak yang menanggung beban diskon promo (Toko, Supplier/Principal, atau Co-funding) untuk laporan margin." />
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
                        </div>

                        {/* Parameter manfaat sesuai tipe promo */}
                        <div className="rounded-lg border bg-muted/20 p-4 space-y-4">
                            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                Aturan Potongan &amp; Syarat
                            </p>

                            {type === 'percentage_discount' && (
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div className="space-y-1.5">
                                        <Label htmlFor="promo-disc-pct">
                                            Diskon (%) <span className="text-destructive">*</span>
                                            <FieldTooltip content="Persentase potongan harga (1-100%) dari harga jual normal." />
                                        </Label>
                                        <Input
                                            id="promo-disc-pct"
                                            type="number"
                                            min={1}
                                            max={100}
                                            step="any"
                                            value={discountValue}
                                            onChange={(e) => setDiscountValue(e.target.value)}
                                            className="h-9 font-mono"
                                            required
                                        />
                                        {errors.discount_value && (
                                            <p className="text-xs text-destructive">{errors.discount_value}</p>
                                        )}
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label htmlFor="promo-max-disc">
                                            Plafon Maks. Diskon (Rp)
                                            <FieldTooltip content="Batas maksimal nominal diskon dalam Rupiah. Kosongkan jika tanpa batas." />
                                        </Label>
                                        <Input
                                            id="promo-max-disc"
                                            type="number"
                                            min={0}
                                            value={maxDiscountAmount}
                                            onChange={(e) => setMaxDiscountAmount(e.target.value)}
                                            placeholder="Opsional"
                                            className="h-9 font-mono"
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label htmlFor="promo-min-spend">
                                            Min. Belanja Eligible (Rp)
                                            <FieldTooltip content="Minimal total belanja item yang memenuhi syarat agar promo aktif. Isi 0 jika tanpa minimal." />
                                        </Label>
                                        <Input
                                            id="promo-min-spend"
                                            type="number"
                                            min={0}
                                            value={minPurchaseAmount}
                                            onChange={(e) => setMinPurchaseAmount(e.target.value)}
                                            className="h-9 font-mono"
                                        />
                                    </div>
                                </div>
                            )}

                            {type === 'fixed_discount' && (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-1.5">
                                        <Label htmlFor="promo-disc-fixed">
                                            Potongan Nominal per Unit (Rp) <span className="text-destructive">*</span>
                                            <FieldTooltip content="Besar potongan harga dalam Rupiah untuk setiap 1 unit produk." />
                                        </Label>
                                        <Input
                                            id="promo-disc-fixed"
                                            type="number"
                                            min={1}
                                            value={discountValue}
                                            onChange={(e) => setDiscountValue(e.target.value)}
                                            className="h-9 font-mono"
                                            required
                                        />
                                        {errors.discount_value && (
                                            <p className="text-xs text-destructive">{errors.discount_value}</p>
                                        )}
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label htmlFor="promo-min-spend-fixed">Min. Belanja Eligible (Rp)</Label>
                                        <Input
                                            id="promo-min-spend-fixed"
                                            type="number"
                                            min={0}
                                            value={minPurchaseAmount}
                                            onChange={(e) => setMinPurchaseAmount(e.target.value)}
                                            className="h-9 font-mono"
                                        />
                                    </div>
                                </div>
                            )}

                            {type === 'buy_x_get_y' && (
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div className="space-y-1.5">
                                        <Label htmlFor="promo-buy-qty">
                                            Beli (X) <span className="text-destructive">*</span>
                                            <FieldTooltip content="Jumlah unit yang wajib dibeli untuk mendapatkan bonus (misal Beli 2 Gratis 1 -> isi 2)." />
                                        </Label>
                                        <Input
                                            id="promo-buy-qty"
                                            type="number"
                                            min={1}
                                            value={buyQty}
                                            onChange={(e) => setBuyQty(e.target.value)}
                                            className="h-9 font-mono"
                                            required
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label htmlFor="promo-get-qty">
                                            Gratis / Bonus (Y) <span className="text-destructive">*</span>
                                            <FieldTooltip content="Jumlah unit bonus yang diberikan setelah membeli X unit." />
                                        </Label>
                                        <Input
                                            id="promo-get-qty"
                                            type="number"
                                            min={1}
                                            value={getQty}
                                            onChange={(e) => setGetQty(e.target.value)}
                                            className="h-9 font-mono"
                                            required
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label htmlFor="promo-get-pct">
                                            Potongan Bonus (%)
                                            <FieldTooltip content="Persentase diskon pada item bonus. Isi 100 untuk gratis penuh, atau 50 untuk setengah harga." />
                                        </Label>
                                        <Input
                                            id="promo-get-pct"
                                            type="number"
                                            min={1}
                                            max={100}
                                            value={getDiscountPercent}
                                            onChange={(e) => setGetDiscountPercent(e.target.value)}
                                            className="h-9 font-mono"
                                        />
                                    </div>
                                </div>
                            )}

                            {type === 'multibuy_price' && (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-1.5">
                                        <Label htmlFor="promo-multibuy-qty">
                                            Qty per Paket (Min. 2) <span className="text-destructive">*</span>
                                            <FieldTooltip content="Jumlah unit dalam 1 paket harga spesial (misal Beli 3 Rp 10.000 -> isi 3)." />
                                        </Label>
                                        <Input
                                            id="promo-multibuy-qty"
                                            type="number"
                                            min={2}
                                            value={buyQty}
                                            onChange={(e) => setBuyQty(e.target.value)}
                                            className="h-9 font-mono"
                                            required
                                        />
                                        {errors.buy_qty && <p className="text-xs text-destructive">{errors.buy_qty}</p>}
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label htmlFor="promo-bundle-price">
                                            Harga Paket (Rp) <span className="text-destructive">*</span>
                                            <FieldTooltip content="Total harga spesial dalam Rupiah untuk 1 paket sesuai Qty per Paket." />
                                        </Label>
                                        <Input
                                            id="promo-bundle-price"
                                            type="number"
                                            min={1}
                                            value={bundlePrice}
                                            onChange={(e) => setBundlePrice(e.target.value)}
                                            placeholder="Contoh: 10000"
                                            className="h-9 font-mono"
                                            required
                                        />
                                        {errors.bundle_price && (
                                            <p className="text-xs text-destructive">{errors.bundle_price}</p>
                                        )}
                                    </div>
                                </div>
                            )}

                            {type === 'nth_item_discount' && (
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div className="space-y-1.5">
                                        <Label htmlFor="promo-nth-item">
                                            Item Ke-N (Min. 2) <span className="text-destructive">*</span>
                                            <FieldTooltip content="Urutan item yang mendapat diskon (misal isi 2 untuk diskon pada pembelian item ke-2)." />
                                        </Label>
                                        <Input
                                            id="promo-nth-item"
                                            type="number"
                                            min={2}
                                            value={nthItem}
                                            onChange={(e) => setNthItem(e.target.value)}
                                            className="h-9 font-mono"
                                            required
                                        />
                                        {errors.nth_item && <p className="text-xs text-destructive">{errors.nth_item}</p>}
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label htmlFor="promo-nth-disc">
                                            Nilai Diskon (% ≤100 atau Rp &gt;100)
                                            <FieldTooltip content="Isi angka ≤100 untuk diskon persen (misal 50 = 50%), atau >100 untuk potongan nominal Rupiah." />
                                        </Label>
                                        <Input
                                            id="promo-nth-disc"
                                            type="number"
                                            min={1}
                                            step="any"
                                            value={discountValue}
                                            onChange={(e) => setDiscountValue(e.target.value)}
                                            placeholder="Contoh: 50 (%) atau 2500 (Rp)"
                                            className="h-9 font-mono"
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label htmlFor="promo-nth-max">Plafon Maks. Diskon (Rp)</Label>
                                        <Input
                                            id="promo-nth-max"
                                            type="number"
                                            min={0}
                                            value={maxDiscountAmount}
                                            onChange={(e) => setMaxDiscountAmount(e.target.value)}
                                            placeholder="Opsional"
                                            className="h-9 font-mono"
                                        />
                                    </div>
                                </div>
                            )}

                            {type === 'mix_match' && (
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div className="space-y-1.5">
                                        <Label htmlFor="promo-mix-qty">
                                            Total Qty Gabungan (Min. 2) <span className="text-destructive">*</span>
                                            <FieldTooltip content="Total jumlah item gabungan dari produk/kategori terpilih yang wajib dibeli." />
                                        </Label>
                                        <Input
                                            id="promo-mix-qty"
                                            type="number"
                                            min={2}
                                            value={buyQty}
                                            onChange={(e) => setBuyQty(e.target.value)}
                                            className="h-9 font-mono"
                                            required
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label htmlFor="promo-mix-bundle">
                                            Harga Paket Mix &amp; Match (Rp)
                                            <FieldTooltip content="Total harga paket untuk qty gabungan terpilih. Kosongkan jika memakai potongan persen/nominal." />
                                        </Label>
                                        <Input
                                            id="promo-mix-bundle"
                                            type="number"
                                            min={1}
                                            value={bundlePrice}
                                            onChange={(e) => setBundlePrice(e.target.value)}
                                            placeholder="Contoh: 25000"
                                            className="h-9 font-mono"
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label htmlFor="promo-mix-disc">Atau Potongan (% ≤100 / Rp &gt;100)</Label>
                                        <Input
                                            id="promo-mix-disc"
                                            type="number"
                                            min={1}
                                            value={discountValue}
                                            onChange={(e) => setDiscountValue(e.target.value)}
                                            placeholder="Opsional jika tanpa harga paket"
                                            className="h-9 font-mono"
                                        />
                                    </div>
                                </div>
                            )}

                            {type === 'bundle' && (
                                <div className="space-y-3">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="space-y-1.5">
                                            <Label htmlFor="promo-bundle-pkg-price">
                                                Harga Paket Bundel (Rp) <span className="text-destructive">*</span>
                                                <FieldTooltip content="Total harga spesial untuk seluruh kombinasi SKU bundel yang ditentukan di bawah." />
                                            </Label>
                                            <Input
                                                id="promo-bundle-pkg-price"
                                                type="number"
                                                min={1}
                                                value={bundlePrice}
                                                onChange={(e) => setBundlePrice(e.target.value)}
                                                placeholder="Contoh: 18000"
                                                className="h-9 font-mono"
                                                required
                                            />
                                            {errors.bundle_price && (
                                                <p className="text-xs text-destructive">{errors.bundle_price}</p>
                                            )}
                                        </div>
                                        <div className="flex items-end">
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                onClick={addBundleItemRow}
                                                className="h-9 gap-1.5 border-dashed cursor-pointer"
                                            >
                                                <Plus className="h-3.5 w-3.5" />
                                                Tambah SKU Bundel
                                            </Button>
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        {bundleItems.map((row, idx) => (
                                            <div
                                                key={`bundle-row-${idx}`}
                                                className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-end rounded-md border bg-background p-2.5"
                                            >
                                                <div className="sm:col-span-8 space-y-1 min-w-0">
                                                    <Label className="text-xs">SKU Produk #{idx + 1}</Label>
                                                    <Select
                                                        items={productSelectItems}
                                                        value={row.product_id}
                                                        onValueChange={(val) =>
                                                            val && updateBundleItemRow(idx, { product_id: val })
                                                        }
                                                    >
                                                        <SelectTrigger className="w-full h-9">
                                                            <SelectValue>
                                                                {(val) =>
                                                                    productSelectItems.find((p) => p.value === val)?.label ??
                                                                    'Pilih produk'
                                                                }
                                                            </SelectValue>
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            {productSelectItems.map((p) => (
                                                                <SelectItem key={p.value} value={p.value}>
                                                                    {p.label}
                                                                </SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                                <div className="sm:col-span-3 space-y-1">
                                                    <Label className="text-xs">Qty Wajib</Label>
                                                    <Input
                                                        type="number"
                                                        min={1}
                                                        value={row.required_qty}
                                                        onChange={(e) =>
                                                            updateBundleItemRow(idx, { required_qty: e.target.value })
                                                        }
                                                        className="h-9 font-mono"
                                                    />
                                                </div>
                                                <div className="sm:col-span-1 flex justify-end">
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={() => removeBundleItemRow(idx)}
                                                        disabled={bundleItems.length <= 1}
                                                        className="h-9 w-9 text-destructive hover:text-destructive cursor-pointer"
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            </div>
                                        ))}
                                        {errors.bundle_items && (
                                            <p className="text-xs text-destructive">{errors.bundle_items}</p>
                                        )}
                                    </div>
                                </div>
                            )}

                            {type === 'near_expiry' && (
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div className="space-y-1.5">
                                        <Label htmlFor="promo-near-days">
                                            Batas Hari Kedaluwarsa (H-N) <span className="text-destructive">*</span>
                                            <FieldTooltip content="Diskon otomatis aktif jika sisa umur simpan produk ≤ jumlah hari ini (misal 7 = H-7 expired)." />
                                        </Label>
                                        <Input
                                            id="promo-near-days"
                                            type="number"
                                            min={1}
                                            max={365}
                                            value={nearExpiryDays}
                                            onChange={(e) => setNearExpiryDays(e.target.value)}
                                            className="h-9 font-mono"
                                            required
                                        />
                                        {errors.near_expiry_days && (
                                            <p className="text-xs text-destructive">{errors.near_expiry_days}</p>
                                        )}
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label htmlFor="promo-near-pct">
                                            Diskon (%) <span className="text-destructive">*</span>
                                        </Label>
                                        <Input
                                            id="promo-near-pct"
                                            type="number"
                                            min={1}
                                            max={100}
                                            value={discountValue}
                                            onChange={(e) => setDiscountValue(e.target.value)}
                                            className="h-9 font-mono"
                                            required
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label htmlFor="promo-near-max">Plafon Maks. Diskon (Rp)</Label>
                                        <Input
                                            id="promo-near-max"
                                            type="number"
                                            min={0}
                                            value={maxDiscountAmount}
                                            onChange={(e) => setMaxDiscountAmount(e.target.value)}
                                            placeholder="Opsional"
                                            className="h-9 font-mono"
                                        />
                                    </div>
                                </div>
                            )}

                            {type === 'min_spend_discount' && (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-1.5">
                                        <Label htmlFor="promo-ms-min">
                                            Min. Belanja Eligible (Rp) <span className="text-destructive">*</span>
                                        </Label>
                                        <Input
                                            id="promo-ms-min"
                                            type="number"
                                            min={1}
                                            value={minPurchaseAmount}
                                            onChange={(e) => setMinPurchaseAmount(e.target.value)}
                                            className="h-9 font-mono"
                                            required
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label htmlFor="promo-ms-disc">
                                            Potongan Nominal (Rp) <span className="text-destructive">*</span>
                                        </Label>
                                        <Input
                                            id="promo-ms-disc"
                                            type="number"
                                            min={1}
                                            value={discountValue}
                                            onChange={(e) => setDiscountValue(e.target.value)}
                                            className="h-9 font-mono"
                                            required
                                        />
                                    </div>
                                </div>
                            )}

                            {type === 'min_spend_percent' && (
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div className="space-y-1.5">
                                        <Label htmlFor="promo-msp-min">
                                            Min. Belanja Eligible (Rp) <span className="text-destructive">*</span>
                                        </Label>
                                        <Input
                                            id="promo-msp-min"
                                            type="number"
                                            min={1}
                                            value={minPurchaseAmount}
                                            onChange={(e) => setMinPurchaseAmount(e.target.value)}
                                            className="h-9 font-mono"
                                            required
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label htmlFor="promo-msp-pct">
                                            Diskon (%) <span className="text-destructive">*</span>
                                        </Label>
                                        <Input
                                            id="promo-msp-pct"
                                            type="number"
                                            min={1}
                                            max={100}
                                            value={discountValue}
                                            onChange={(e) => setDiscountValue(e.target.value)}
                                            className="h-9 font-mono"
                                            required
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label htmlFor="promo-msp-max">Plafon Maks. Diskon (Rp)</Label>
                                        <Input
                                            id="promo-msp-max"
                                            type="number"
                                            min={0}
                                            value={maxDiscountAmount}
                                            onChange={(e) => setMaxDiscountAmount(e.target.value)}
                                            placeholder="Opsional"
                                            className="h-9 font-mono"
                                        />
                                    </div>
                                </div>
                            )}

                            {type === 'tebus_murah' && (
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div className="space-y-1.5">
                                        <Label htmlFor="promo-tm-min">
                                            Min. Belanja Eligible (Rp) <span className="text-destructive">*</span>
                                        </Label>
                                        <Input
                                            id="promo-tm-min"
                                            type="number"
                                            min={1}
                                            value={minPurchaseAmount}
                                            onChange={(e) => setMinPurchaseAmount(e.target.value)}
                                            className="h-9 font-mono"
                                            required
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label>
                                            Produk Tebus Murah <span className="text-destructive">*</span>
                                        </Label>
                                        <Select
                                            items={productSelectItems}
                                            value={rewardProductId}
                                            onValueChange={(val) => val && setRewardProductId(val)}
                                        >
                                            <SelectTrigger className="w-full h-9">
                                                <SelectValue>
                                                    {(val) =>
                                                        productSelectItems.find((p) => p.value === val)?.label ??
                                                        'Pilih produk reward'
                                                    }
                                                </SelectValue>
                                            </SelectTrigger>
                                            <SelectContent>
                                                {productSelectItems.map((p) => (
                                                    <SelectItem key={p.value} value={p.value}>
                                                        {p.label}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        {errors.reward_product_id && (
                                            <p className="text-xs text-destructive">{errors.reward_product_id}</p>
                                        )}
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label htmlFor="promo-tm-price">
                                            Harga Spesial (Rp) <span className="text-destructive">*</span>
                                            <FieldTooltip content="Harga tebus murah untuk produk reward saat syarat minimal belanja terpenuhi." />
                                        </Label>
                                        <Input
                                            id="promo-tm-price"
                                            type="number"
                                            min={0}
                                            value={specialPrice}
                                            onChange={(e) => setSpecialPrice(e.target.value)}
                                            placeholder="Contoh: 5000"
                                            className="h-9 font-mono"
                                            required
                                        />
                                        {errors.special_price && (
                                            <p className="text-xs text-destructive">{errors.special_price}</p>
                                        )}
                                    </div>
                                </div>
                            )}

                            {type === 'gift_with_purchase' && (
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div className="space-y-1.5">
                                        <Label htmlFor="promo-gwp-min">
                                            Min. Belanja Eligible (Rp) <span className="text-destructive">*</span>
                                        </Label>
                                        <Input
                                            id="promo-gwp-min"
                                            type="number"
                                            min={1}
                                            value={minPurchaseAmount}
                                            onChange={(e) => setMinPurchaseAmount(e.target.value)}
                                            className="h-9 font-mono"
                                            required
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label>
                                            Produk Hadiah Gratis <span className="text-destructive">*</span>
                                        </Label>
                                        <Select
                                            items={productSelectItems}
                                            value={rewardProductId}
                                            onValueChange={(val) => val && setRewardProductId(val)}
                                        >
                                            <SelectTrigger className="w-full h-9">
                                                <SelectValue>
                                                    {(val) =>
                                                        productSelectItems.find((p) => p.value === val)?.label ??
                                                        'Pilih produk hadiah'
                                                    }
                                                </SelectValue>
                                            </SelectTrigger>
                                            <SelectContent>
                                                {productSelectItems.map((p) => (
                                                    <SelectItem key={p.value} value={p.value}>
                                                        {p.label}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label htmlFor="promo-gwp-qty">Qty Hadiah</Label>
                                        <Input
                                            id="promo-gwp-qty"
                                            type="number"
                                            min={1}
                                            value={getQty}
                                            onChange={(e) => setGetQty(e.target.value)}
                                            className="h-9 font-mono"
                                        />
                                    </div>
                                </div>
                            )}

                            {type === 'payment_promo' && (
                                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                    <div className="space-y-1.5">
                                        <Label>
                                            Metode Bayar <span className="text-destructive">*</span>
                                        </Label>
                                        <Select
                                            items={resolvedPaymentMethods}
                                            value={paymentMethod}
                                            onValueChange={(val) => val && setPaymentMethod(val)}
                                        >
                                            <SelectTrigger className="w-full h-9">
                                                <SelectValue>
                                                    {(val) =>
                                                        resolvedPaymentMethods.find((m) => m.value === val)?.label ??
                                                        'Pilih metode'
                                                    }
                                                </SelectValue>
                                            </SelectTrigger>
                                            <SelectContent>
                                                {resolvedPaymentMethods.map((m) => (
                                                    <SelectItem key={m.value} value={m.value}>
                                                        {m.label}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label htmlFor="promo-pay-bin">
                                            Prefix BIN Kartu (6-8 digit)
                                            <FieldTooltip content="6-8 digit awal nomor kartu debit/kredit tertentu (opsional). Kosongkan agar berlaku untuk semua kartu." />
                                        </Label>
                                        <Input
                                            id="promo-pay-bin"
                                            value={paymentBinPrefix}
                                            onChange={(e) =>
                                                setPaymentBinPrefix(e.target.value.replace(/\D/g, '').slice(0, 8))
                                            }
                                            placeholder="Opsional (mis. 411111)"
                                            className="h-9 font-mono"
                                        />
                                        {errors.payment_bin_prefix && (
                                            <p className="text-xs text-destructive">{errors.payment_bin_prefix}</p>
                                        )}
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label htmlFor="promo-pay-val">
                                            Diskon (% ≤100 / Rp &gt;100) <span className="text-destructive">*</span>
                                        </Label>
                                        <Input
                                            id="promo-pay-val"
                                            type="number"
                                            min={1}
                                            step="any"
                                            value={discountValue}
                                            onChange={(e) => setDiscountValue(e.target.value)}
                                            className="h-9 font-mono"
                                            required
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label htmlFor="promo-pay-max">Plafon Maks. (Rp)</Label>
                                        <Input
                                            id="promo-pay-max"
                                            type="number"
                                            min={0}
                                            value={maxDiscountAmount}
                                            onChange={(e) => setMaxDiscountAmount(e.target.value)}
                                            placeholder="Opsional"
                                            className="h-9 font-mono"
                                        />
                                    </div>
                                </div>
                            )}

                            {type === 'cashback' && (
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div className="space-y-1.5">
                                        <Label htmlFor="promo-cb-min">Min. Belanja Eligible (Rp)</Label>
                                        <Input
                                            id="promo-cb-min"
                                            type="number"
                                            min={0}
                                            value={minPurchaseAmount}
                                            onChange={(e) => setMinPurchaseAmount(e.target.value)}
                                            className="h-9 font-mono"
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label htmlFor="promo-cb-val">
                                            Nilai Cashback (% ≤100 / Rp &gt;100) <span className="text-destructive">*</span>
                                        </Label>
                                        <Input
                                            id="promo-cb-val"
                                            type="number"
                                            min={1}
                                            step="any"
                                            value={discountValue}
                                            onChange={(e) => setDiscountValue(e.target.value)}
                                            className="h-9 font-mono"
                                            required
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label htmlFor="promo-cb-max">Plafon Maks. Cashback (Rp)</Label>
                                        <Input
                                            id="promo-cb-max"
                                            type="number"
                                            min={0}
                                            value={maxDiscountAmount}
                                            onChange={(e) => setMaxDiscountAmount(e.target.value)}
                                            placeholder="Opsional"
                                            className="h-9 font-mono"
                                        />
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Pemilih Produk (react-select/async) atau Kategori */}
                        {usesItemScope && scope === 'product' && (
                            <div className="rounded-lg border p-4 space-y-2.5 bg-card">
                                <div className="flex items-center justify-between gap-2">
                                    <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                        Pilih Produk Target <span className="text-destructive">*</span>
                                    </Label>
                                    <Badge variant="secondary" className="font-mono text-[11px]">
                                        {selectedProducts.length} produk dipilih
                                    </Badge>
                                </div>
                                <SelectProductsMultiAsync
                                    value={selectedProducts}
                                    onChange={setSelectedProducts}
                                    disabled={isSubmitting}
                                    error={errors.product_ids}
                                />
                                <p className="text-[11px] text-muted-foreground">
                                    Cari berdasarkan nama atau barcode produk. Produk donasi dan produk nonaktif otomatis dikecualikan.
                                </p>
                            </div>
                        )}

                        {usesItemScope && scope === 'category' && (
                            <div className="rounded-lg border p-4 space-y-3 bg-card">
                                <div className="flex items-center justify-between gap-2">
                                    <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                        Pilih Kategori Target <span className="text-destructive">*</span>
                                    </Label>
                                    <Badge variant="secondary" className="font-mono text-[11px]">
                                        {selectedCategoryIds.length} kategori dipilih
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
                                <div className="max-h-40 overflow-y-auto grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-1.5 rounded-md border bg-background p-2">
                                    {filteredCategories.map((c) => {
                                        const checked = selectedCategoryIds.includes(c.id)
                                        return (
                                            <label
                                                key={c.id}
                                                className="flex items-center gap-2 rounded-md px-2.5 py-1.5 text-xs cursor-pointer hover:bg-muted/50"
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={checked}
                                                    onChange={() => toggleCategory(c.id)}
                                                    className="rounded border-input"
                                                />
                                                <span className="font-medium text-foreground truncate">
                                                    {c.name}
                                                </span>
                                            </label>
                                        )
                                    })}
                                </div>
                                {errors.category_ids && <p className="text-xs text-destructive">{errors.category_ids}</p>}
                            </div>
                        )}

                        {/* Periode, Jam & Hari Berlaku (WIB) */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <Label htmlFor="promo-starts">
                                    Mulai Berlaku (WIB) <span className="text-destructive">*</span>
                                    <FieldTooltip content="Tanggal dan jam mulai promo otomatis berlaku di kasir (WIB)." />
                                </Label>
                                <Input
                                    id="promo-starts"
                                    type="datetime-local"
                                    value={startsAt}
                                    onChange={(e) => setStartsAt(e.target.value)}
                                    className="h-9 font-mono text-xs"
                                    required
                                />
                                {errors.starts_at && <p className="text-xs text-destructive">{errors.starts_at}</p>}
                            </div>

                            <div className="space-y-1.5">
                                <Label htmlFor="promo-ends">
                                    Berakhir Pada (WIB) <span className="text-destructive">*</span>
                                    <FieldTooltip content="Tanggal dan jam promo otomatis berhenti berlaku (WIB)." />
                                </Label>
                                <Input
                                    id="promo-ends"
                                    type="datetime-local"
                                    value={endsAt}
                                    onChange={(e) => setEndsAt(e.target.value)}
                                    className="h-9 font-mono text-xs"
                                    required
                                />
                                {errors.ends_at && <p className="text-xs text-destructive">{errors.ends_at}</p>}
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
                            <div className="md:col-span-6 space-y-1.5">
                                <Label>
                                    Hari Berlaku (WIB)
                                    <FieldTooltip content="Pilih hari aktif promo dalam seminggu (misal aktifkan Sab-Min saja untuk promo weekend)." />
                                </Label>
                                <div className="flex flex-wrap gap-1.5">
                                    {DAY_BITS.map((day) => {
                                        const active = (daysMask & day.bit) !== 0
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
                            <div className="md:col-span-3 space-y-1.5">
                                <Label htmlFor="promo-time-start">
                                    Jam Mulai (Opsional)
                                    <FieldTooltip content="Jam mulai berlaku setiap hari (happy hour). Kosongkan jika berlaku 24 jam." />
                                </Label>
                                <Input
                                    id="promo-time-start"
                                    type="time"
                                    value={timeStart}
                                    onChange={(e) => setTimeStart(e.target.value)}
                                    className="h-9 font-mono text-xs"
                                />
                            </div>
                            <div className="md:col-span-3 space-y-1.5">
                                <Label htmlFor="promo-time-end">
                                    Jam Selesai (Opsional)
                                    <FieldTooltip content="Jam berakhir berlaku setiap hari. Kosongkan jika berlaku 24 jam." />
                                </Label>
                                <Input
                                    id="promo-time-end"
                                    type="time"
                                    value={timeEnd}
                                    onChange={(e) => setTimeEnd(e.target.value)}
                                    className="h-9 font-mono text-xs"
                                />
                            </div>
                        </div>

                        {/* Kuota, Batas Harian, Prioritas & Grup */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4">
                            <div className="space-y-1.5">
                                <Label htmlFor="promo-quota">
                                    Kuota Total
                                    <FieldTooltip content="Batas total pemakaian promo selama periode berlangsung. Kosongkan jika tanpa batas." />
                                </Label>
                                <Input
                                    id="promo-quota"
                                    type="number"
                                    min={1}
                                    value={quotaTotal}
                                    onChange={(e) => setQuotaTotal(e.target.value)}
                                    placeholder="Tanpa batas"
                                    className="h-9 font-mono"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor="promo-max-tx">
                                    Maks. Qty / Struk
                                    <FieldTooltip content="Batas maksimal jumlah item yang mendapat harga promo dalam 1 struk transaksi." />
                                </Label>
                                <Input
                                    id="promo-max-tx"
                                    type="number"
                                    min={1}
                                    value={maxQtyPerTx}
                                    onChange={(e) => setMaxQtyPerTx(e.target.value)}
                                    placeholder="Tanpa batas"
                                    className="h-9 font-mono"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor="promo-max-daily">
                                    Kuota Harian / Plg
                                    <FieldTooltip content="Batas maksimal pemakaian promo per pelanggan dalam 1 hari (reset tengah malam WIB)." />
                                </Label>
                                <Input
                                    id="promo-max-daily"
                                    type="number"
                                    min={1}
                                    value={maxQtyPerCustomerPerDay}
                                    onChange={(e) => setMaxQtyPerCustomerPerDay(e.target.value)}
                                    placeholder="Tanpa batas"
                                    className="h-9 font-mono"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor="promo-priority">
                                    Prioritas
                                    <FieldTooltip content="Angka lebih tinggi diprioritaskan jika ada dua promo dengan nilai penghematan yang sama." />
                                </Label>
                                <Input
                                    id="promo-priority"
                                    type="number"
                                    value={priority}
                                    onChange={(e) => setPriority(e.target.value)}
                                    className="h-9 font-mono"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor="promo-group">
                                    Grup Eksklusif
                                    <FieldTooltip content="Promo dengan nama grup eksklusif yang sama tidak bisa digabungkan (hanya 1 terbaik yang menang)." />
                                </Label>
                                <Input
                                    id="promo-group"
                                    value={exclusiveGroup}
                                    onChange={(e) => setExclusiveGroup(e.target.value)}
                                    placeholder="Opsional"
                                    className="h-9 text-xs"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            <div className="flex items-center justify-between rounded-lg border p-3.5 bg-muted/20">
                                <div className="pr-2">
                                    <p className="text-sm font-medium">Dapat Digabung</p>
                                    <p className="text-xs text-muted-foreground">
                                        Izinkan stacking dengan promo item / voucher.
                                    </p>
                                </div>
                                <Switch checked={stackable} onCheckedChange={setStackable} />
                            </div>

                            <div className="flex items-center justify-between rounded-lg border p-3.5 bg-muted/20">
                                <div className="pr-2">
                                    <p className="text-sm font-medium">Khusus Member</p>
                                    <p className="text-xs text-muted-foreground">
                                        Hanya berlaku jika pelanggan terdaftar dipilih.
                                    </p>
                                </div>
                                <Switch checked={memberOnly} onCheckedChange={setMemberOnly} />
                            </div>

                            <div className="flex items-center justify-between rounded-lg border p-3.5 bg-muted/20">
                                <div className="pr-2">
                                    <p className="text-sm font-medium">Status Aktif</p>
                                    <p className="text-xs text-muted-foreground">
                                        Nonaktifkan untuk menjeda promo kapan saja.
                                    </p>
                                </div>
                                <Switch checked={isActive} onCheckedChange={setIsActive} />
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
                            {isSubmitting ? 'Menyimpan...' : 'Simpan Promo'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}

export default PromotionFormDialog

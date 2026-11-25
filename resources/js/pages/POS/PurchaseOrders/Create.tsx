import * as React from 'react'
import { Link, useForm } from '@inertiajs/react'
import AuthenticatedLayout from '@/layouts/AuthenticatedLayout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Field, FieldError } from '@/components/ui/field'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { ArrowLeft, Plus, Trash2, ShoppingBag, Calendar, Calculator, Info, ShieldCheck } from 'lucide-react'
import PurchaseOrderController from '@/actions/App/Http/Controllers/PurchaseOrderController'
import SelectSupplierAsync, { type SupplierOption as AsyncSupplierOption } from './component/SelectSupplierAsync'
import SelectProductAsync, { type ProductOption as AsyncProductOption } from './component/SelectProductAsync'
import {
    formatRupiah,
    calculateItemLine,
    calculateOrderSummary,
    type ProductUnitOption,
} from './component/purchaseOrderUtils'

interface SupplierOption {
    id: number
    name: string
    code: string | null
    payment_term_days: number
    phone: string
}

interface ProductOption {
    id: number
    name: string
    base_unit: string
    barcode: string
    buy_price: number | string
    sell_price: number | string
    stock: number
    min_stock: number
    category_id: number
    category?: { id: number; name: string } | null
    units?: ProductUnitOption[]
}

interface CreatePOPageProps {
    suppliers: SupplierOption[]
    products: ProductOption[]
    isAdmin: boolean
}

interface ItemRow {
    product_id: string
    product_unit_id: string
    unit_name: string
    conversion_factor: number
    base_unit: string
    quantity_ordered: number
    free_qty_ordered: number
    unit_cost: number
    discount_type: 'fixed' | 'percent'
    discount_value: number
    expired_date: string
    available_units: ProductUnitOption[]
    product_detail?: {
        name: string
        barcode: string
        stock: number
        buy_price: number
        category_name?: string
    } | null
}

const createEmptyItem = (): ItemRow => ({
    product_id: '',
    product_unit_id: '',
    unit_name: 'pcs',
    conversion_factor: 1,
    base_unit: 'pcs',
    quantity_ordered: 1,
    free_qty_ordered: 0,
    unit_cost: 0,
    discount_type: 'fixed',
    discount_value: 0,
    expired_date: '',
    available_units: [],
    product_detail: null,
})

export function PurchaseOrdersCreate({ suppliers, products, isAdmin }: CreatePOPageProps) {
    const todayStr = new Date().toISOString().split('T')[0]

    const [items, setItems] = React.useState<ItemRow[]>([createEmptyItem()])

    const { data, setData, transform, post, processing, errors } = useForm({
        supplier_id: '',
        po_number: '',
        order_date: todayStr,
        expected_date: '',
        due_date: '',
        action: 'draft' as 'draft' | 'submit',
        discount_type: 'fixed' as 'fixed' | 'percent',
        discount_value: '' as string | number,
        tax_type: 'percent' as 'percent' | 'fixed',
        tax_value: '' as string | number,
        notes: '',
        items: [] as Array<Record<string, string | number | null>>,
    })

    const [selectedSupplierData, setSelectedSupplierData] = React.useState<SupplierOption | AsyncSupplierOption | null>(
        () => suppliers.find((s) => String(s.id) === data.supplier_id) || null
    )

    const handleSupplierChange = (val: number | null, opt: AsyncSupplierOption | null) => {
        const idStr = val ? String(val) : ''
        setData('supplier_id', idStr)
        setSelectedSupplierData(opt || null)

        if (opt && opt.payment_term_days && opt.payment_term_days > 0 && data.order_date) {
            const date = new Date(data.order_date)
            date.setDate(date.getDate() + Number(opt.payment_term_days))
            setData('due_date', date.toISOString().split('T')[0])
        }
    }

    React.useEffect(() => {
        if (
            selectedSupplierData &&
            selectedSupplierData.payment_term_days &&
            selectedSupplierData.payment_term_days > 0 &&
            data.order_date
        ) {
            const date = new Date(data.order_date)
            date.setDate(date.getDate() + Number(selectedSupplierData.payment_term_days))
            setData('due_date', date.toISOString().split('T')[0])
        }
    }, [data.order_date, selectedSupplierData])

    const updateItem = (index: number, patch: Partial<ItemRow>) => {
        setItems((prev) => {
            const next = [...prev]
            next[index] = { ...next[index], ...patch }
            return next
        })
    }

    const handleProductSelect = (
        index: number,
        productId: string,
        option?: AsyncProductOption | null
    ) => {
        if (!productId) {
            setItems((prev) => {
                const next = [...prev]
                next[index] = createEmptyItem()
                return next
            })
            return
        }

        const prod = products.find((p) => String(p.id) === productId)
        const baseUnit = option?.base_unit || prod?.base_unit || 'pcs'
        const baseBuyPrice =
            option?.buy_price !== undefined
                ? Number(option.buy_price)
                : prod
                    ? Number(prod.buy_price) || 0
                    : 0
        const units = option?.units ?? prod?.units ?? []
        const defaultUnit = units.find((u) => u.is_default_purchase) ?? null

        const productDetail = {
            name: option?.name || prod?.name || '-',
            barcode: option?.barcode || prod?.barcode || '',
            stock: option?.stock ?? prod?.stock ?? 0,
            buy_price: baseBuyPrice,
            category_name: option?.category_name ?? prod?.category?.name,
        }

        updateItem(index, {
            product_id: productId,
            product_unit_id: defaultUnit ? String(defaultUnit.id) : '',
            unit_name: defaultUnit ? defaultUnit.unit_name : baseUnit,
            conversion_factor: defaultUnit ? defaultUnit.conversion_factor : 1,
            base_unit: baseUnit,
            unit_cost: defaultUnit ? Number(defaultUnit.buy_price) || baseBuyPrice * defaultUnit.conversion_factor : baseBuyPrice,
            available_units: units,
            product_detail: productDetail,
        })
    }

    const handleUnitChange = (index: number, unitValue: string) => {
        const row = items[index]
        if (!unitValue) {
            updateItem(index, {
                product_unit_id: '',
                unit_name: row.base_unit,
                conversion_factor: 1,
                unit_cost: row.product_detail?.buy_price ?? row.unit_cost,
            })
            return
        }

        const chosen = row.available_units.find((u) => String(u.id) === unitValue)
        if (!chosen) return

        updateItem(index, {
            product_unit_id: String(chosen.id),
            unit_name: chosen.unit_name,
            conversion_factor: chosen.conversion_factor,
            unit_cost:
                Number(chosen.buy_price) > 0
                    ? Number(chosen.buy_price)
                    : (row.product_detail?.buy_price ?? 0) * chosen.conversion_factor,
        })
    }

    const subtotal = React.useMemo(
        () => items.reduce((acc, it) => acc + calculateItemLine(it).subtotal, 0),
        [items]
    )

    const summary = React.useMemo(
        () =>
            calculateOrderSummary(
                subtotal,
                data.discount_type,
                Number(data.discount_value) || 0,
                data.tax_type,
                Number(data.tax_value) || 0
            ),
        [subtotal, data.discount_type, data.discount_value, data.tax_type, data.tax_value]
    )

    const handleSubmit = (action: 'draft' | 'submit') => {
        const payloadItems = items
            .filter((it) => Boolean(it.product_id))
            .map((it) => ({
                product_id: parseInt(it.product_id),
                product_unit_id: it.product_unit_id ? parseInt(it.product_unit_id) : null,
                quantity_ordered: it.quantity_ordered,
                free_qty_ordered: it.free_qty_ordered,
                unit_cost: it.unit_cost,
                discount_type: it.discount_type,
                discount_value: it.discount_value,
                expired_date: it.expired_date || null,
            }))

        transform((current) => ({
            ...current,
            action,
            discount_value: Math.max(0, Number(current.discount_value) || 0),
            tax_value: Math.max(0, Number(current.tax_value) || 0),
            items: payloadItems,
        }))

        post(PurchaseOrderController.store.url(), {
            preserveScroll: true,
        })
    }

    const validItemsCount = items.filter((it) => Boolean(it.product_id)).length

    return (
        <div className="w-full min-w-0 space-y-6">
            <div className="flex items-center gap-3">
                <Button
                    variant="ghost"
                    size="sm"
                    render={<Link href={PurchaseOrderController.index.url()} />}
                    className="gap-1.5 text-muted-foreground hover:text-foreground -ml-2"
                >
                    <ArrowLeft className="h-4 w-4" />
                    Kembali
                </Button>
                <div className="h-4 w-px bg-border" />
                <h1 className="text-xl font-bold tracking-tight text-foreground truncate">
                    Buat Purchase Order Baru
                </h1>
            </div>

            {!isAdmin && (
                <div className="flex items-start gap-2.5 rounded-lg border border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950/40 p-3.5 text-xs text-blue-900 dark:text-blue-200">
                    <Info className="h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400 mt-0.5" />
                    <div>
                        <strong className="block mb-0.5">Alur Persetujuan (Approval Admin)</strong>
                        PO yang Anda ajukan akan masuk ke status <strong>Menunggu Persetujuan</strong> dan harus disetujui
                        oleh Admin terlebih dahulu sebelum gudang dapat memproses penerimaan barang.
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Kolom Kiri */}
                <div className="lg:col-span-2 space-y-6">
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-base flex items-center gap-2">
                                <Calendar className="h-4 w-4 text-primary" />
                                Informasi Dasar Pesanan
                            </CardTitle>
                            <CardDescription>Pilih mitra supplier serta jadwal pengiriman dan jatuh tempo.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <Field>
                                    <Label htmlFor="supplier_id">
                                        Supplier <span className="text-destructive">*</span>
                                    </Label>
                                    <div className="mt-1">
                                        <SelectSupplierAsync
                                            id="supplier_id"
                                            value={data.supplier_id ? Number(data.supplier_id) : null}
                                            defaultOptions={suppliers.map((s) => ({
                                                value: s.id,
                                                label: s.code ? `${s.name} (${s.code})` : s.name,
                                                id: s.id,
                                                name: s.name,
                                                code: s.code,
                                                payment_term_days: s.payment_term_days,
                                                phone: s.phone,
                                            }))}
                                            onlyActive={true}
                                            onChange={handleSupplierChange}
                                            error={errors.supplier_id}
                                            placeholder="Ketik nama atau pilih supplier..."
                                        />
                                    </div>
                                    {selectedSupplierData && (
                                        <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1.5">
                                            <span>
                                                Tempo:{' '}
                                                <strong>
                                                    {selectedSupplierData.payment_term_days && selectedSupplierData.payment_term_days > 0
                                                        ? `${selectedSupplierData.payment_term_days} Hari`
                                                        : 'COD / Tunai'}
                                                </strong>
                                            </span>
                                            {selectedSupplierData.phone && (
                                                <>
                                                    <span>•</span>
                                                    <span>Telp: {selectedSupplierData.phone}</span>
                                                </>
                                            )}
                                        </div>
                                    )}
                                    <FieldError>{errors.supplier_id}</FieldError>
                                </Field>

                                <Field>
                                    <Label htmlFor="po_number">No. PO (Opsional)</Label>
                                    <Input
                                        id="po_number"
                                        placeholder="Otomatis (PO-YYYYMMDD-0001)"
                                        value={data.po_number}
                                        onChange={(e) => setData('po_number', e.target.value)}
                                        className="font-mono text-xs"
                                    />
                                    <FieldError>{errors.po_number}</FieldError>
                                </Field>

                                <Field>
                                    <Label htmlFor="order_date">
                                        Tanggal Pesanan <span className="text-destructive">*</span>
                                    </Label>
                                    <Input
                                        id="order_date"
                                        type="date"
                                        value={data.order_date}
                                        onChange={(e) => setData('order_date', e.target.value)}
                                        required
                                    />
                                    <FieldError>{errors.order_date}</FieldError>
                                </Field>

                                <Field>
                                    <Label htmlFor="expected_date">Estimasi Tanggal Datang</Label>
                                    <Input
                                        id="expected_date"
                                        type="date"
                                        value={data.expected_date}
                                        onChange={(e) => setData('expected_date', e.target.value)}
                                    />
                                    <FieldError>{errors.expected_date}</FieldError>
                                </Field>

                                <Field className="sm:col-span-2">
                                    <Label htmlFor="due_date">Jatuh Tempo Pembayaran</Label>
                                    <Input
                                        id="due_date"
                                        type="date"
                                        value={data.due_date}
                                        onChange={(e) => setData('due_date', e.target.value)}
                                    />
                                    <span className="text-[11px] text-muted-foreground mt-0.5 block">
                                        Otomatis terisi berdasarkan tempo pembayaran supplier.
                                    </span>
                                    <FieldError>{errors.due_date}</FieldError>
                                </Field>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Daftar Produk Multi-UOM */}
                    <Card>
                        <CardHeader className="pb-3 flex flex-row items-center justify-between">
                            <div>
                                <CardTitle className="text-base flex items-center gap-2">
                                    <ShoppingBag className="h-4 w-4 text-primary" />
                                    Daftar Produk Pesanan (Multi-UOM)
                                </CardTitle>
                                <CardDescription>
                                    Pilih produk, satuan beli, jumlah, barang bonus, dan diskon per item.
                                </CardDescription>
                            </div>
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => setItems((prev) => [...prev, createEmptyItem()])}
                                className="gap-1 text-xs"
                            >
                                <Plus className="h-3.5 w-3.5" />
                                Tambah Baris
                            </Button>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {errors.items && (
                                <div className="p-3 rounded-md bg-destructive/10 text-destructive text-xs font-medium border border-destructive/20">
                                    {errors.items}
                                </div>
                            )}

                            <div className="space-y-3">
                                {items.map((item, index) => {
                                    const lineCalc = calculateItemLine(item)
                                    const totalBaseQty = (item.quantity_ordered + item.free_qty_ordered) * item.conversion_factor

                                    return (
                                        <div
                                            key={index}
                                            className="p-3.5 rounded-lg border bg-card/60 space-y-3"
                                        >
                                            <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-2">
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <span className="font-semibold text-xs text-muted-foreground">
                                                        Baris #{index + 1}
                                                    </span>
                                                    {item.product_id && (
                                                        <Badge
                                                            variant="outline"
                                                            className="font-mono text-[11px] bg-primary/5 text-primary border-primary/20"
                                                        >
                                                            {item.quantity_ordered}
                                                            {item.free_qty_ordered > 0 ? ` + ${item.free_qty_ordered} bonus` : ''}{' '}
                                                            {item.unit_name} = {totalBaseQty.toLocaleString('id-ID')} {item.base_unit}
                                                        </Badge>
                                                    )}
                                                </div>
                                                {items.length > 1 && (
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="icon-xs"
                                                        onClick={() => setItems((prev) => prev.filter((_, i) => i !== index))}
                                                        className="text-destructive hover:bg-destructive/10"
                                                    >
                                                        <Trash2 className="h-3.5 w-3.5" />
                                                    </Button>
                                                )}
                                            </div>

                                            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                                                {/* Pilih Produk */}
                                                <div className="sm:col-span-6 min-w-0">
                                                    <Label className="text-xs">Produk *</Label>
                                                    <div className="mt-1">
                                                        <SelectProductAsync
                                                            value={item.product_id ? Number(item.product_id) : null}
                                                            defaultOptions={products.map((p) => ({
                                                                value: p.id,
                                                                label: `${p.name} (${p.barcode}) - Stok: ${p.stock} ${p.base_unit}`,
                                                                id: p.id,
                                                                name: p.name,
                                                                base_unit: p.base_unit,
                                                                barcode: p.barcode,
                                                                buy_price: Number(p.buy_price) || 0,
                                                                sell_price: Number(p.sell_price) || 0,
                                                                stock: p.stock,
                                                                min_stock: p.min_stock,
                                                                category_name: p.category?.name ?? '-',
                                                                units: p.units ?? [],
                                                            }))}
                                                            onlyActive={true}
                                                            onChange={(val, opt) => handleProductSelect(index, val ? String(val) : '', opt)}
                                                            placeholder="Cari barcode / nama produk..."
                                                        />
                                                    </div>
                                                    {item.product_detail && (
                                                        <span className="text-[10px] text-muted-foreground mt-1 block">
                                                            Stok: {item.product_detail.stock} {item.base_unit} | HPP Dasar:{' '}
                                                            {formatRupiah(item.product_detail.buy_price)}/{item.base_unit}
                                                        </span>
                                                    )}
                                                </div>

                                                {/* Pilih Satuan Beli (Multi-UOM) */}
                                                <div className="sm:col-span-3">
                                                    <Label className="text-xs">Satuan Beli *</Label>
                                                    <select
                                                        value={item.product_unit_id}
                                                        onChange={(e) => handleUnitChange(index, e.target.value)}
                                                        disabled={!item.product_id}
                                                        className="mt-1 flex h-9 w-full rounded-md border border-input bg-background px-2.5 py-1 text-xs shadow-xs disabled:opacity-50"
                                                    >
                                                        <option value="">
                                                            {item.base_unit} (Dasar — 1x)
                                                        </option>
                                                        {item.available_units.map((u) => (
                                                            <option key={u.id} value={String(u.id)}>
                                                                {u.unit_name} ({u.conversion_factor} {item.base_unit})
                                                            </option>
                                                        ))}
                                                    </select>
                                                </div>

                                                {/* Qty Pesan */}
                                                <div className="sm:col-span-3">
                                                    <Label className="text-xs">Qty Pesan ({item.unit_name}) *</Label>
                                                    <Input
                                                        type="number"
                                                        min={1}
                                                        value={item.quantity_ordered}
                                                        onChange={(e) =>
                                                            updateItem(index, {
                                                                quantity_ordered: Math.max(1, parseInt(e.target.value) || 1),
                                                            })
                                                        }
                                                        className="text-xs font-mono font-medium mt-1"
                                                        required
                                                    />
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                                                {/* Harga Beli per Satuan */}
                                                <div className="sm:col-span-4">
                                                    <Label className="text-xs">Harga / {item.unit_name} (Rp) *</Label>
                                                    <Input
                                                        type="number"
                                                        min={0}
                                                        step="any"
                                                        value={item.unit_cost}
                                                        onChange={(e) =>
                                                            updateItem(index, {
                                                                unit_cost: Math.max(0, parseFloat(e.target.value) || 0),
                                                            })
                                                        }
                                                        className="text-xs font-mono font-medium mt-1"
                                                        required
                                                    />
                                                </div>

                                                {/* Diskon Per Item */}
                                                <div className="sm:col-span-3">
                                                    <Label className="text-xs">Diskon Item</Label>
                                                    <div className="flex items-center mt-1">
                                                        <div className="inline-flex h-9 shrink-0 rounded-l-md border border-r-0 border-input bg-muted/50 p-0.5">
                                                            {(['fixed', 'percent'] as const).map((t) => (
                                                                <button
                                                                    key={t}
                                                                    type="button"
                                                                    onClick={() => updateItem(index, { discount_type: t, discount_value: 0 })}
                                                                    className={`px-1.5 text-[10px] font-semibold rounded-xs cursor-pointer ${item.discount_type === t
                                                                            ? 'bg-background text-foreground shadow-xs'
                                                                            : 'text-muted-foreground'
                                                                        }`}
                                                                >
                                                                    {t === 'fixed' ? 'Rp' : '%'}
                                                                </button>
                                                            ))}
                                                        </div>
                                                        <Input
                                                            type="number"
                                                            min={0}
                                                            max={item.discount_type === 'percent' ? 100 : undefined}
                                                            step="any"
                                                            value={item.discount_value || ''}
                                                            placeholder="0"
                                                            onChange={(e) => {
                                                                const raw = parseFloat(e.target.value) || 0
                                                                const clamped =
                                                                    item.discount_type === 'percent'
                                                                        ? Math.min(100, Math.max(0, raw))
                                                                        : Math.max(0, raw)
                                                                updateItem(index, { discount_value: clamped })
                                                            }}
                                                            className="h-9 text-xs font-mono rounded-l-none"
                                                        />
                                                    </div>
                                                </div>

                                                {/* Bonus / Free Qty */}
                                                <div className="sm:col-span-2">
                                                    <Label className="text-xs">Bonus (Free)</Label>
                                                    <Input
                                                        type="number"
                                                        min={0}
                                                        value={item.free_qty_ordered}
                                                        onChange={(e) =>
                                                            updateItem(index, {
                                                                free_qty_ordered: Math.max(0, parseInt(e.target.value) || 0),
                                                            })
                                                        }
                                                        className="text-xs font-mono mt-1"
                                                    />
                                                </div>

                                                {/* Subtotal Baris */}
                                                <div className="sm:col-span-3">
                                                    <Label className="text-xs">Subtotal Bersih</Label>
                                                    <div className="h-9 px-2.5 flex items-center justify-end font-mono text-xs font-semibold text-foreground bg-muted/40 rounded-md border mt-1">
                                                        {formatRupiah(lineCalc.subtotal)}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Kolom Kanan: Ringkasan */}
                <div className="space-y-6">
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-base flex items-center gap-2">
                                <Calculator className="h-4 w-4 text-primary" />
                                Ringkasan Total Pesanan
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-3 text-xs">
                                <div className="flex justify-between py-1 border-b">
                                    <span className="text-muted-foreground">Total Item:</span>
                                    <span className="font-mono font-medium">{validItemsCount} Jenis Produk</span>
                                </div>

                                <div className="flex justify-between py-1 border-b">
                                    <span className="text-muted-foreground">Subtotal Item:</span>
                                    <span className="font-mono font-bold text-foreground">
                                        {formatRupiah(subtotal)}
                                    </span>
                                </div>

                                {/* Diskon Global */}
                                <Field className="space-y-1.5">
                                    <div className="flex items-center justify-between gap-2">
                                        <Label htmlFor="discount" className="text-xs text-muted-foreground">
                                            Diskon Global
                                        </Label>
                                        <span className="font-mono text-xs font-medium text-rose-600 dark:text-rose-400">
                                            - {formatRupiah(summary.discountAmount)}
                                        </span>
                                    </div>
                                    <div className="flex items-center">
                                        <div className="inline-flex h-8 shrink-0 rounded-l-md border border-r-0 border-input bg-muted/50 p-0.5">
                                            {(['fixed', 'percent'] as const).map((t) => (
                                                <button
                                                    key={t}
                                                    type="button"
                                                    onClick={() => {
                                                        setData('discount_type', t)
                                                        if (t === 'percent' && Number(data.discount_value) > 100) {
                                                            setData('discount_value', '')
                                                        }
                                                    }}
                                                    className={`px-2 text-[11px] font-semibold rounded-xs cursor-pointer ${data.discount_type === t
                                                            ? 'bg-background text-foreground shadow-xs'
                                                            : 'text-muted-foreground'
                                                        }`}
                                                >
                                                    {t === 'fixed' ? 'Rp' : '%'}
                                                </button>
                                            ))}
                                        </div>
                                        <Input
                                            id="discount"
                                            type="number"
                                            min={0}
                                            max={data.discount_type === 'percent' ? 100 : undefined}
                                            step="any"
                                            placeholder="0"
                                            value={data.discount_value}
                                            onChange={(e) => setData('discount_value', e.target.value)}
                                            className="font-mono text-xs text-right h-8 rounded-l-none"
                                        />
                                    </div>
                                </Field>

                                {/* Pajak / PPN Fleksibel (% atau Rp) */}
                                <Field className="space-y-1.5">
                                    <div className="flex items-center justify-between gap-2">
                                        <div className="flex items-center gap-1.5">
                                            <Label htmlFor="tax_value" className="text-xs text-muted-foreground">
                                                Pajak / PPN
                                            </Label>
                                            {data.tax_type === 'percent' && (
                                                <div className="inline-flex items-center gap-1">
                                                    {[0, 11].map((preset) => (
                                                        <button
                                                            key={preset}
                                                            type="button"
                                                            onClick={() => setData('tax_value', preset)}
                                                            className={`px-1.5 py-0.5 text-[10px] font-mono rounded border cursor-pointer ${Number(data.tax_value || 0) === preset
                                                                    ? 'border-primary bg-primary/10 text-primary font-semibold'
                                                                    : 'border-input text-muted-foreground'
                                                                }`}
                                                        >
                                                            {preset}%
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                        <span className="font-mono text-xs font-medium text-emerald-600 dark:text-emerald-400">
                                            + {formatRupiah(summary.taxAmount)}
                                        </span>
                                    </div>
                                    <div className="flex items-center">
                                        <div className="inline-flex h-8 shrink-0 rounded-l-md border border-r-0 border-input bg-muted/50 p-0.5">
                                            {(['percent', 'fixed'] as const).map((t) => (
                                                <button
                                                    key={t}
                                                    type="button"
                                                    onClick={() => {
                                                        setData('tax_type', t)
                                                        if (t === 'percent' && Number(data.tax_value) > 100) {
                                                            setData('tax_value', '')
                                                        }
                                                    }}
                                                    className={`px-2 text-[11px] font-semibold rounded-xs cursor-pointer ${data.tax_type === t
                                                            ? 'bg-background text-foreground shadow-xs'
                                                            : 'text-muted-foreground'
                                                        }`}
                                                >
                                                    {t === 'percent' ? '%' : 'Rp'}
                                                </button>
                                            ))}
                                        </div>
                                        <Input
                                            id="tax_value"
                                            type="number"
                                            min={0}
                                            max={data.tax_type === 'percent' ? 100 : undefined}
                                            step="any"
                                            placeholder="0"
                                            value={data.tax_value}
                                            onChange={(e) => setData('tax_value', e.target.value)}
                                            className="font-mono text-xs text-right h-8 rounded-l-none"
                                        />
                                    </div>
                                    <span className="text-[10px] text-muted-foreground block">
                                        DPP: <strong className="font-mono">{formatRupiah(summary.taxableAmount)}</strong>
                                    </span>
                                </Field>

                                <div className="flex justify-between items-center py-2 border-t-2 border-foreground/20 text-sm">
                                    <span className="font-bold text-foreground">Grand Total:</span>
                                    <span className="font-mono text-base font-extrabold text-primary">
                                        {formatRupiah(summary.grandTotal)}
                                    </span>
                                </div>
                            </div>

                            <Field>
                                <Label htmlFor="notes" className="text-xs">
                                    Catatan Pesanan
                                </Label>
                                <textarea
                                    id="notes"
                                    rows={3}
                                    placeholder="Petunjuk pengiriman, syarat kemasan, dll..."
                                    value={data.notes}
                                    onChange={(e) => setData('notes', e.target.value)}
                                    className="w-full rounded-md border border-input bg-background p-2 text-xs shadow-xs"
                                />
                            </Field>

                            <div className="space-y-2 pt-2">
                                <Button
                                    type="button"
                                    onClick={() => handleSubmit('submit')}
                                    disabled={processing || validItemsCount === 0}
                                    className="w-full gap-1.5 font-semibold"
                                >
                                    {isAdmin && <ShieldCheck className="h-4 w-4" />}
                                    {processing
                                        ? 'Menyimpan...'
                                        : isAdmin
                                            ? 'Simpan & Setujui Langsung (Approved)'
                                            : 'Ajukan Persetujuan Admin'}
                                </Button>

                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => handleSubmit('draft')}
                                    disabled={processing || validItemsCount === 0}
                                    className="w-full text-xs"
                                >
                                    Simpan Sebagai Draft
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    )
}

PurchaseOrdersCreate.layout = (page: React.ReactNode) => (
    <AuthenticatedLayout>{page}</AuthenticatedLayout>
)

export default PurchaseOrdersCreate

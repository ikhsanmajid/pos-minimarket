import * as React from 'react'
import { Link, useForm } from '@inertiajs/react'
import AuthenticatedLayout from '@/layouts/AuthenticatedLayout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Field, FieldError } from '@/components/ui/field'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ArrowLeft, Plus, Trash2, ShoppingBag, Calendar, Calculator, AlertTriangle, Lock } from 'lucide-react'
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

interface ExistingItem {
    id: number
    product_id: number
    product_unit_id: number | null
    unit_name: string
    conversion_factor: number
    product_name: string
    barcode: string
    base_unit: string
    quantity_ordered: number
    quantity_received: number
    free_qty_ordered: number
    free_qty_received: number
    unit_cost: number
    discount_type: 'fixed' | 'percent' | string
    discount_value: number
    discount_amount: number
    subtotal: number
    expired_date?: string | null
    units: ProductUnitOption[]
}

interface EditPOPageProps {
    purchaseOrder: {
        id: number
        po_number: string
        supplier_id: number
        order_date: string
        expected_date?: string | null
        due_date?: string | null
        status: string
        status_label: string
        receiving_status: string
        rejection_reason?: string | null
        discount_type?: 'fixed' | 'percent' | string
        discount_value?: number | string
        discount_amount: number | string
        tax_type?: 'percent' | 'fixed' | string
        tax_value?: number | string
        tax_percentage?: number | string
        tax_amount: number | string
        paid_amount: number
        notes?: string | null
        is_supplier_locked: boolean
        items: ExistingItem[]
    }
    suppliers: SupplierOption[]
    products: ProductOption[]
    isAdmin: boolean
}

interface ItemRow {
    id: number | null
    product_id: string
    product_unit_id: string
    unit_name: string
    conversion_factor: number
    base_unit: string
    quantity_ordered: number
    quantity_received: number
    free_qty_ordered: number
    free_qty_received: number
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
    id: null,
    product_id: '',
    product_unit_id: '',
    unit_name: 'pcs',
    conversion_factor: 1,
    base_unit: 'pcs',
    quantity_ordered: 1,
    quantity_received: 0,
    free_qty_ordered: 0,
    free_qty_received: 0,
    unit_cost: 0,
    discount_type: 'fixed',
    discount_value: 0,
    expired_date: '',
    available_units: [],
    product_detail: null,
})

export function PurchaseOrdersEdit({ purchaseOrder, suppliers, products, isAdmin }: EditPOPageProps) {
    const [items, setItems] = React.useState<ItemRow[]>(() =>
        purchaseOrder.items.map((it) => {
            const prod = products.find((p) => p.id === it.product_id)
            return {
                id: it.id,
                product_id: String(it.product_id),
                product_unit_id: it.product_unit_id ? String(it.product_unit_id) : '',
                unit_name: it.unit_name || it.base_unit || 'pcs',
                conversion_factor: Math.max(1, it.conversion_factor),
                base_unit: it.base_unit || prod?.base_unit || 'pcs',
                quantity_ordered: it.quantity_ordered,
                quantity_received: it.quantity_received,
                free_qty_ordered: it.free_qty_ordered,
                free_qty_received: it.free_qty_received,
                unit_cost: Number(it.unit_cost) || 0,
                discount_type: it.discount_type === 'percent' ? 'percent' : 'fixed',
                discount_value: Number(it.discount_value) || 0,
                expired_date: it.expired_date || '',
                available_units: it.units?.length ? it.units : prod?.units ?? [],
                product_detail: {
                    name: it.product_name || prod?.name || '-',
                    barcode: it.barcode || prod?.barcode || '-',
                    stock: prod?.stock ?? 0,
                    buy_price: prod ? Number(prod.buy_price) || 0 : Number(it.unit_cost) || 0,
                    category_name: prod?.category?.name,
                },
            }
        })
    )

    const { data, setData, transform, patch, processing, errors } = useForm({
        supplier_id: String(purchaseOrder.supplier_id),
        order_date: purchaseOrder.order_date || '',
        expected_date: purchaseOrder.expected_date || '',
        due_date: purchaseOrder.due_date || '',
        action: '' as '' | 'draft' | 'submit',
        discount_type: (purchaseOrder.discount_type === 'percent' ? 'percent' : 'fixed') as 'fixed' | 'percent',
        discount_value: (Number(purchaseOrder.discount_value) || '') as string | number,
        tax_type: (purchaseOrder.tax_type === 'fixed' ? 'fixed' : 'percent') as 'percent' | 'fixed',
        tax_value: (Number(purchaseOrder.tax_value ?? purchaseOrder.tax_percentage) || '') as string | number,
        notes: purchaseOrder.notes || '',
        items: [] as Array<Record<string, string | number | null>>,
    })

    const updateItem = (index: number, patchRow: Partial<ItemRow>) => {
        setItems((prev) => {
            const next = [...prev]
            next[index] = { ...next[index], ...patchRow }
            return next
        })
    }

    const handleSupplierChange = (val: number | null, opt: AsyncSupplierOption | null) => {
        if (purchaseOrder.is_supplier_locked) return
        setData('supplier_id', val ? String(val) : '')
        if (opt && opt.payment_term_days && opt.payment_term_days > 0 && data.order_date) {
            const date = new Date(data.order_date)
            date.setDate(date.getDate() + Number(opt.payment_term_days))
            setData('due_date', date.toISOString().split('T')[0])
        }
    }

    const handleProductSelect = (
        index: number,
        productId: string,
        option?: AsyncProductOption | null
    ) => {
        if (!productId) return
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

        updateItem(index, {
            product_id: productId,
            product_unit_id: defaultUnit ? String(defaultUnit.id) : '',
            unit_name: defaultUnit ? defaultUnit.unit_name : baseUnit,
            conversion_factor: defaultUnit ? defaultUnit.conversion_factor : 1,
            base_unit: baseUnit,
            unit_cost: defaultUnit
                ? Number(defaultUnit.buy_price) || baseBuyPrice * defaultUnit.conversion_factor
                : baseBuyPrice,
            available_units: units,
            product_detail: {
                name: option?.name || prod?.name || '-',
                barcode: option?.barcode || prod?.barcode || '',
                stock: option?.stock ?? prod?.stock ?? 0,
                buy_price: baseBuyPrice,
                category_name: option?.category_name ?? prod?.category?.name,
            },
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

    const isBelowPaidAmount = purchaseOrder.paid_amount > 0 && summary.grandTotal < purchaseOrder.paid_amount

    const submitForm = (action: '' | 'draft' | 'submit') => {
        const payloadItems = items
            .filter((it) => Boolean(it.product_id))
            .map((it) => ({
                id: it.id,
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
            action: action || undefined,
            discount_value: Math.max(0, Number(current.discount_value) || 0),
            tax_value: Math.max(0, Number(current.tax_value) || 0),
            items: payloadItems,
        }))

        patch(PurchaseOrderController.update.url(purchaseOrder.id), {
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
                    render={<Link href={PurchaseOrderController.show.url(purchaseOrder.id)} />}
                    className="gap-1.5 text-muted-foreground hover:text-foreground -ml-2"
                >
                    <ArrowLeft className="h-4 w-4" />
                    Kembali
                </Button>
                <div className="h-4 w-px bg-border" />
                <h1 className="text-xl font-bold tracking-tight text-foreground truncate">
                    Edit Purchase Order: <span className="font-mono">{purchaseOrder.po_number}</span>
                </h1>
            </div>

            {purchaseOrder.rejection_reason && (
                <div className="flex items-start gap-2.5 rounded-lg border border-rose-300 bg-rose-50 dark:border-rose-900 dark:bg-rose-950/40 p-3.5 text-xs text-rose-900 dark:text-rose-200">
                    <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600 mt-0.5" />
                    <div>
                        <strong className="block mb-0.5">Catatan Penolakan Admin Sebelumnya:</strong>
                        {purchaseOrder.rejection_reason}
                    </div>
                </div>
            )}

            {purchaseOrder.is_supplier_locked && (
                <div className="flex items-start gap-2.5 rounded-lg border border-amber-300 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/40 p-3.5 text-xs text-amber-900 dark:text-amber-200">
                    <Lock className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
                    <div>
                        PO ini sudah disetujui/memiliki penerimaan sebagian. Supplier terkunci, item yang sudah diterima tidak
                        boleh dihapus atau diturunkan di bawah jumlah diterima, dan total tagihan tidak boleh lebih kecil dari
                        pembayaran yang sudah tercatat ({formatRupiah(purchaseOrder.paid_amount)}).
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-6">
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-base flex items-center gap-2">
                                <Calendar className="h-4 w-4 text-primary" />
                                Informasi Dasar Pesanan
                            </CardTitle>
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
                                            defaultOptions={suppliers.map((sup) => ({
                                                value: sup.id,
                                                label: sup.code ? `${sup.name} (${sup.code})` : sup.name,
                                                id: sup.id,
                                                name: sup.name,
                                                code: sup.code,
                                                payment_term_days: sup.payment_term_days,
                                                phone: sup.phone,
                                            }))}
                                            onlyActive={false}
                                            disabled={purchaseOrder.is_supplier_locked}
                                            onChange={handleSupplierChange}
                                            error={errors.supplier_id}
                                        />
                                    </div>
                                    <FieldError>{errors.supplier_id}</FieldError>
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

                                <Field>
                                    <Label htmlFor="due_date">Jatuh Tempo Pembayaran</Label>
                                    <Input
                                        id="due_date"
                                        type="date"
                                        value={data.due_date}
                                        onChange={(e) => setData('due_date', e.target.value)}
                                    />
                                    <FieldError>{errors.due_date}</FieldError>
                                </Field>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="pb-3 flex flex-row items-center justify-between">
                            <CardTitle className="text-base flex items-center gap-2">
                                <ShoppingBag className="h-4 w-4 text-primary" />
                                Daftar Produk Pesanan
                            </CardTitle>
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
                                    const hasReceipts = item.quantity_received > 0 || item.free_qty_received > 0
                                    const lineCalc = calculateItemLine(item)
                                    const totalBaseQty = (item.quantity_ordered + item.free_qty_ordered) * item.conversion_factor

                                    return (
                                        <div key={item.id ?? `new-${index}`} className="p-3.5 rounded-lg border bg-card/60 space-y-3">
                                            <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-2">
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <span className="font-semibold text-xs text-muted-foreground">
                                                        Baris #{index + 1}
                                                    </span>
                                                    {item.product_id && (
                                                        <Badge variant="outline" className="font-mono text-[11px] bg-primary/5 text-primary border-primary/20">
                                                            {item.quantity_ordered}
                                                            {item.free_qty_ordered > 0 ? ` + ${item.free_qty_ordered} bonus` : ''}{' '}
                                                            {item.unit_name} = {totalBaseQty.toLocaleString('id-ID')} {item.base_unit}
                                                        </Badge>
                                                    )}
                                                    {hasReceipts && (
                                                        <Badge variant="secondary" className="text-[10px] gap-1">
                                                            <Lock className="h-2.5 w-2.5" />
                                                            Sudah diterima: {item.quantity_received} {item.unit_name}
                                                        </Badge>
                                                    )}
                                                </div>
                                                {items.length > 1 && !hasReceipts && (
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
                                                            onlyActive={false}
                                                            disabled={hasReceipts}
                                                            onChange={(val, opt) => handleProductSelect(index, val ? String(val) : '', opt)}
                                                        />
                                                    </div>
                                                </div>

                                                <div className="sm:col-span-3">
                                                    <Label className="text-xs">Satuan Beli *</Label>
                                                    <select
                                                        value={item.product_unit_id}
                                                        onChange={(e) => handleUnitChange(index, e.target.value)}
                                                        disabled={!item.product_id || hasReceipts}
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

                                                <div className="sm:col-span-3">
                                                    <Label className="text-xs">Qty Pesan ({item.unit_name}) *</Label>
                                                    <Input
                                                        type="number"
                                                        min={Math.max(1, item.quantity_received)}
                                                        value={item.quantity_ordered}
                                                        onChange={(e) => {
                                                            const parsed = parseInt(e.target.value) || 1
                                                            updateItem(index, {
                                                                quantity_ordered: Math.max(
                                                                    Math.max(1, item.quantity_received),
                                                                    parsed
                                                                ),
                                                            })
                                                        }}
                                                        className="text-xs font-mono font-medium mt-1"
                                                        required
                                                    />
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
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
                                                                updateItem(index, {
                                                                    discount_value:
                                                                        item.discount_type === 'percent'
                                                                            ? Math.min(100, Math.max(0, raw))
                                                                            : Math.max(0, raw),
                                                                })
                                                            }}
                                                            className="h-9 text-xs font-mono rounded-l-none"
                                                        />
                                                    </div>
                                                </div>

                                                <div className="sm:col-span-2">
                                                    <Label className="text-xs">Bonus (Free)</Label>
                                                    <Input
                                                        type="number"
                                                        min={item.free_qty_received}
                                                        value={item.free_qty_ordered}
                                                        onChange={(e) =>
                                                            updateItem(index, {
                                                                free_qty_ordered: Math.max(
                                                                    item.free_qty_received,
                                                                    parseInt(e.target.value) || 0
                                                                ),
                                                            })
                                                        }
                                                        className="text-xs font-mono mt-1"
                                                    />
                                                </div>

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

                {/* Kolom Kanan */}
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
                                    <span className="text-muted-foreground">Subtotal Item:</span>
                                    <span className="font-mono font-bold text-foreground">
                                        {formatRupiah(subtotal)}
                                    </span>
                                </div>

                                <Field className="space-y-1.5">
                                    <div className="flex items-center justify-between gap-2">
                                        <Label htmlFor="edit_discount" className="text-xs text-muted-foreground">
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
                                                    onClick={() => setData('discount_type', t)}
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
                                            id="edit_discount"
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

                                <Field className="space-y-1.5">
                                    <div className="flex items-center justify-between gap-2">
                                        <Label htmlFor="edit_tax" className="text-xs text-muted-foreground">
                                            Pajak / PPN
                                        </Label>
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
                                                    onClick={() => setData('tax_type', t)}
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
                                            id="edit_tax"
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
                                </Field>

                                <div className="flex justify-between items-center py-2 border-t-2 border-foreground/20 text-sm">
                                    <span className="font-bold text-foreground">Grand Total:</span>
                                    <span className="font-mono text-base font-extrabold text-primary">
                                        {formatRupiah(summary.grandTotal)}
                                    </span>
                                </div>

                                {isBelowPaidAmount && (
                                    <div className="p-2.5 rounded-md bg-destructive/10 text-destructive text-[11px] border border-destructive/20">
                                        Grand Total tidak boleh lebih kecil dari pembayaran yang sudah tercatat (
                                        <strong>{formatRupiah(purchaseOrder.paid_amount)}</strong>).
                                    </div>
                                )}
                            </div>

                            <Field>
                                <Label htmlFor="edit_notes" className="text-xs">
                                    Catatan Pesanan
                                </Label>
                                <textarea
                                    id="edit_notes"
                                    rows={3}
                                    value={data.notes}
                                    onChange={(e) => setData('notes', e.target.value)}
                                    className="w-full rounded-md border border-input bg-background p-2 text-xs shadow-xs"
                                />
                            </Field>

                            <div className="space-y-2 pt-2">
                                {['draft', 'rejected'].includes(purchaseOrder.status) ? (
                                    <>
                                        <Button
                                            type="button"
                                            onClick={() => submitForm('submit')}
                                            disabled={processing || validItemsCount === 0 || isBelowPaidAmount}
                                            className="w-full font-semibold"
                                        >
                                            {processing
                                                ? 'Menyimpan...'
                                                : isAdmin
                                                    ? 'Simpan & Setujui Langsung'
                                                    : 'Simpan & Ajukan Persetujuan Admin'}
                                        </Button>
                                        <Button
                                            type="button"
                                            variant="outline"
                                            onClick={() => submitForm('draft')}
                                            disabled={processing || validItemsCount === 0 || isBelowPaidAmount}
                                            className="w-full text-xs"
                                        >
                                            Simpan Perubahan (Draft)
                                        </Button>
                                    </>
                                ) : (
                                    <Button
                                        type="button"
                                        onClick={() => submitForm('')}
                                        disabled={processing || validItemsCount === 0 || isBelowPaidAmount}
                                        className="w-full font-semibold"
                                    >
                                        {processing ? 'Menyimpan...' : 'Simpan Penyesuaian PO'}
                                    </Button>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    )
}

PurchaseOrdersEdit.layout = (page: React.ReactNode) => (
    <AuthenticatedLayout>{page}</AuthenticatedLayout>
)

export default PurchaseOrdersEdit

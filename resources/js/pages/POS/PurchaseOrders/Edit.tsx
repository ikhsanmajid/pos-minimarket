import * as React from 'react'
import { Link, useForm } from '@inertiajs/react'
import AuthenticatedLayout from '@/layouts/AuthenticatedLayout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Field, FieldError } from '@/components/ui/field'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { ArrowLeft, Plus, Trash2, ShoppingBag, Calendar, Calculator } from 'lucide-react'
import PurchaseOrderController from '@/actions/App/Http/Controllers/PurchaseOrderController'
import SelectSupplierAsync, { type SupplierOption as AsyncSupplierOption } from './component/SelectSupplierAsync'
import SelectProductAsync, { type ProductOption as AsyncProductOption } from './component/SelectProductAsync'

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
    barcode: string
    buy_price: number | string
    sell_price: number | string
    stock: number
    min_stock: number
    category_id: number
    category?: { id: number; name: string } | null
}

interface ExistingItem {
    id: number
    product_id: number
    product_name: string
    barcode: string
    quantity_ordered: number
    unit_cost: number | string
    subtotal: number | string
    expired_date?: string | null
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
        discount_type?: 'fixed' | 'percent' | string
        discount_value?: number | string
        discount_amount: number | string
        tax_percentage?: number | string
        tax_amount: number | string
        notes?: string | null
        items: ExistingItem[]
    }
    suppliers: SupplierOption[]
    products: ProductOption[]
}

interface ItemRow {
    product_id: string
    quantity_ordered: number
    unit_cost: number
    expired_date: string
    product_detail?: {
        name: string
        barcode: string
        stock: number
        buy_price: number
        category_name?: string
    } | null
}

const formatRupiah = (val: number | string) => {
    const num = Number(val) || 0
    return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0,
    }).format(num)
}

export function PurchaseOrdersEdit({ purchaseOrder, suppliers, products }: EditPOPageProps) {
    const [items, setItems] = React.useState<ItemRow[]>(() => {
        return purchaseOrder.items.map((it) => {
            const prod = products.find((p) => p.id === it.product_id)
            return {
                product_id: String(it.product_id),
                quantity_ordered: it.quantity_ordered,
                unit_cost: Number(it.unit_cost) || 0,
                expired_date: it.expired_date || '',
                product_detail: {
                    name: it.product_name || prod?.name || '-',
                    barcode: it.barcode || prod?.barcode || '-',
                    stock: prod?.stock ?? 0,
                    buy_price: prod ? Number(prod.buy_price) || 0 : Number(it.unit_cost) || 0,
                    category_name: prod?.category?.name,
                },
            }
        })
    })

    const { data, setData, transform, patch, processing, errors } = useForm({
        supplier_id: String(purchaseOrder.supplier_id),
        order_date: purchaseOrder.order_date || '',
        expected_date: purchaseOrder.expected_date || '',
        due_date: purchaseOrder.due_date || '',
        status: purchaseOrder.status,
        discount_type: (purchaseOrder.discount_type === 'percent' ? 'percent' : 'fixed') as 'fixed' | 'percent',
        discount_value: (Number(purchaseOrder.discount_value) || '') as string | number,
        tax_percentage: (Number(purchaseOrder.tax_percentage) || '') as string | number,
        notes: purchaseOrder.notes || '',
        items: [] as any[],
    })

    const [selectedSupplierData, setSelectedSupplierData] = React.useState<SupplierOption | AsyncSupplierOption | null>(() => {
        return suppliers.find((s) => String(s.id) === data.supplier_id) || null
    })

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
        if (selectedSupplierData && selectedSupplierData.payment_term_days && selectedSupplierData.payment_term_days > 0 && data.order_date) {
            const date = new Date(data.order_date)
            date.setDate(date.getDate() + Number(selectedSupplierData.payment_term_days))
            setData('due_date', date.toISOString().split('T')[0])
        }
    }, [data.order_date, selectedSupplierData])

    const handleAddItem = () => {
        setItems((prev) => [
            ...prev,
            {
                product_id: '',
                quantity_ordered: 1,
                unit_cost: 0,
                expired_date: '',
                product_detail: null,
            },
        ])
    }

    const handleRemoveItem = (index: number) => {
        if (items.length <= 1) return
        setItems((prev) => prev.filter((_, i) => i !== index))
    }

    const handleProductSelect = (
        index: number,
        productId: string,
        option?: AsyncProductOption | null
    ) => {
        const prod = products.find((p) => String(p.id) === productId)
        const cost = option?.buy_price !== undefined
            ? Number(option.buy_price)
            : prod
            ? Number(prod.buy_price) || 0
            : 0

        const productDetail = option
            ? {
                  name: option.name || option.label,
                  barcode: option.barcode || '',
                  stock: option.stock ?? 0,
                  buy_price: cost,
                  category_name: option.category_name,
              }
            : prod
            ? {
                  name: prod.name,
                  barcode: prod.barcode,
                  stock: prod.stock,
                  buy_price: cost,
                  category_name: prod.category?.name,
              }
            : null

        setItems((prev) => {
            const next = [...prev]
            next[index] = {
                ...next[index],
                product_id: productId,
                unit_cost: cost,
                product_detail: productDetail,
            }
            return next
        })
    }

    const handleQtyChange = (index: number, qtyStr: string) => {
        const val = parseInt(qtyStr) || 0
        setItems((prev) => {
            const next = [...prev]
            next[index] = {
                ...next[index],
                quantity_ordered: Math.max(1, val),
            }
            return next
        })
    }

    const handleCostChange = (index: number, costStr: string) => {
        const val = parseFloat(costStr) || 0
        setItems((prev) => {
            const next = [...prev]
            next[index] = {
                ...next[index],
                unit_cost: Math.max(0, val),
            }
            return next
        })
    }

    const handleExpDateChange = (index: number, dateStr: string) => {
        setItems((prev) => {
            const next = [...prev]
            next[index] = {
                ...next[index],
                expired_date: dateStr,
            }
            return next
        })
    }

    const subtotal = React.useMemo(() => {
        return items.reduce((acc, it) => acc + it.quantity_ordered * it.unit_cost, 0)
    }, [items])

    const discountValueNum = Math.max(0, Number(data.discount_value) || 0)
    const discountAmount = React.useMemo(() => {
        if (data.discount_type === 'percent') {
            const pct = Math.min(100, discountValueNum)
            return Math.round(subtotal * (pct / 100) * 100) / 100
        }
        return Math.round(Math.min(subtotal, discountValueNum) * 100) / 100
    }, [subtotal, data.discount_type, discountValueNum])

    const taxableAmount = Math.max(0, Math.round((subtotal - discountAmount) * 100) / 100)
    const taxPercentageNum = Math.min(100, Math.max(0, Number(data.tax_percentage) || 0))
    const taxAmount = Math.round(taxableAmount * (taxPercentageNum / 100) * 100) / 100
    const grandTotal = Math.round((taxableAmount + taxAmount) * 100) / 100

    const handleDiscountTypeChange = (nextType: 'fixed' | 'percent') => {
        if (nextType === data.discount_type) return
        setData('discount_type', nextType)
        if (nextType === 'percent' && Number(data.discount_value) > 100) {
            setData('discount_value', '')
        }
    }

    const handleDiscountValueChange = (raw: string) => {
        if (raw === '') {
            setData('discount_value', '')
            return
        }
        const parsed = parseFloat(raw)
        if (Number.isNaN(parsed)) return
        const clamped = data.discount_type === 'percent' ? Math.min(100, Math.max(0, parsed)) : Math.max(0, parsed)
        setData('discount_value', clamped)
    }

    const handleTaxPercentageChange = (raw: string) => {
        if (raw === '') {
            setData('tax_percentage', '')
            return
        }
        const parsed = parseFloat(raw)
        if (Number.isNaN(parsed)) return
        setData('tax_percentage', Math.min(100, Math.max(0, parsed)))
    }

    const submitForm = (targetStatus: string) => {
        const payloadItems = items
            .filter((it) => Boolean(it.product_id))
            .map((it) => ({
                product_id: parseInt(it.product_id),
                quantity_ordered: it.quantity_ordered,
                unit_cost: it.unit_cost,
                expired_date: it.expired_date || null,
            }))

        transform((current) => ({
            ...current,
            status: targetStatus,
            discount_value: Math.max(0, Number(current.discount_value) || 0),
            tax_percentage: Math.min(100, Math.max(0, Number(current.tax_percentage) || 0)),
            items: payloadItems,
        }))

        patch(PurchaseOrderController.update.url(purchaseOrder.id), {
            preserveScroll: true,
        })
    }

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        submitForm(data.status)
    }

    return (
        <div className="w-full min-w-0 space-y-6">
            {/* Top Bar: Tombol Kembali & Judul Halaman */}
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

                <form onSubmit={handleSubmit}>
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
                                                    onChange={handleSupplierChange}
                                                    error={errors.supplier_id}
                                                    placeholder="Ketik nama atau pilih supplier..."
                                                />
                                            </div>
                                            {selectedSupplierData && (
                                                <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1.5">
                                                    <span>
                                                        Tempo: <strong>{selectedSupplierData.payment_term_days && selectedSupplierData.payment_term_days > 0 ? `${selectedSupplierData.payment_term_days} Hari` : 'COD / Tunai'}</strong>
                                                    </span>
                                                    {selectedSupplierData.phone && (
                                                        <>
                                                            <span>•</span>
                                                            <span>Telp: {selectedSupplierData.phone}</span>
                                                        </>
                                                    )}
                                                </div>
                                            )}
                                            {errors.supplier_id && <FieldError>{errors.supplier_id}</FieldError>}
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
                                            {errors.order_date && <FieldError>{errors.order_date}</FieldError>}
                                        </Field>

                                        <Field>
                                            <Label htmlFor="expected_date">Estimasi Tanggal Datang</Label>
                                            <Input
                                                id="expected_date"
                                                type="date"
                                                value={data.expected_date}
                                                onChange={(e) => setData('expected_date', e.target.value)}
                                            />
                                            {errors.expected_date && <FieldError>{errors.expected_date}</FieldError>}
                                        </Field>

                                        <Field>
                                            <Label htmlFor="due_date">Jatuh Tempo Pembayaran</Label>
                                            <Input
                                                id="due_date"
                                                type="date"
                                                value={data.due_date}
                                                onChange={(e) => setData('due_date', e.target.value)}
                                            />
                                            {errors.due_date && <FieldError>{errors.due_date}</FieldError>}
                                        </Field>
                                    </div>
                                </CardContent>
                            </Card>

                            <Card>
                                <CardHeader className="pb-3 flex flex-row items-center justify-between">
                                    <div>
                                        <CardTitle className="text-base flex items-center gap-2">
                                            <ShoppingBag className="h-4 w-4 text-primary" />
                                            Daftar Produk Pesanan
                                        </CardTitle>
                                    </div>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={handleAddItem}
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
                                            const prodFromProp = products.find((p) => String(p.id) === item.product_id)
                                            const prodInfo = item.product_detail || (prodFromProp ? {
                                                name: prodFromProp.name,
                                                barcode: prodFromProp.barcode,
                                                stock: prodFromProp.stock,
                                                buy_price: Number(prodFromProp.buy_price) || 0,
                                                category_name: prodFromProp.category?.name,
                                            } : null)
                                            const rowSubtotal = item.quantity_ordered * item.unit_cost

                                            return (
                                                <div
                                                    key={index}
                                                    className="p-3.5 rounded-lg border bg-card/60 space-y-3"
                                                >
                                                    <div className="flex items-center justify-between border-b pb-2">
                                                        <span className="font-semibold text-xs text-muted-foreground">
                                                            Baris #{index + 1}
                                                        </span>
                                                        {items.length > 1 && (
                                                            <Button
                                                                type="button"
                                                                variant="ghost"
                                                                size="icon-xs"
                                                                onClick={() => handleRemoveItem(index)}
                                                                className="text-destructive hover:bg-destructive/10"
                                                            >
                                                                <Trash2 className="h-3.5 w-3.5" />
                                                            </Button>
                                                        )}
                                                    </div>

                                                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                                                        <div className="sm:col-span-5 min-w-0">
                                                            <Label className="text-xs">Produk *</Label>
                                                            <div className="mt-1">
                                                                <SelectProductAsync
                                                                    value={item.product_id ? Number(item.product_id) : null}
                                                                    defaultOptions={products.map((p) => ({
                                                                        value: p.id,
                                                                        label: `${p.name} (${p.barcode}) - Stok: ${p.stock}`,
                                                                        id: p.id,
                                                                        name: p.name,
                                                                        barcode: p.barcode,
                                                                        buy_price: Number(p.buy_price) || 0,
                                                                        sell_price: Number(p.sell_price) || 0,
                                                                        stock: p.stock,
                                                                        min_stock: p.min_stock,
                                                                        category_name: p.category?.name ?? '-',
                                                                    }))}
                                                                    onlyActive={false}
                                                                    onChange={(val, opt) => handleProductSelect(index, val ? String(val) : '', opt)}
                                                                    placeholder="Cari barcode / nama produk..."
                                                                />
                                                            </div>
                                                            {prodInfo && (
                                                                <span className="text-[10px] text-muted-foreground mt-1 block">
                                                                    Kategori: {prodInfo.category_name || '-'} | Stok Saat Ini: {prodInfo.stock} unit
                                                                </span>
                                                            )}
                                                        </div>

                                                        <div className="sm:col-span-2">
                                                            <Label className="text-xs">Qty *</Label>
                                                            <Input
                                                                type="number"
                                                                min={1}
                                                                value={item.quantity_ordered}
                                                                onChange={(e) => handleQtyChange(index, e.target.value)}
                                                                className="text-xs font-mono font-medium mt-1"
                                                                required
                                                            />
                                                        </div>

                                                        <div className="sm:col-span-3">
                                                            <Label className="text-xs">Harga Satuan (Rp) *</Label>
                                                            <Input
                                                                type="number"
                                                                min={0}
                                                                value={item.unit_cost}
                                                                onChange={(e) => handleCostChange(index, e.target.value)}
                                                                className="text-xs font-mono font-medium mt-1"
                                                                required
                                                            />
                                                            {prodInfo && (
                                                                <span className="text-[10px] text-muted-foreground mt-0.5 block">
                                                                    Harga saat ini: {formatRupiah(prodInfo.buy_price)}
                                                                </span>
                                                            )}
                                                        </div>

                                                        <div className="sm:col-span-2">
                                                            <Label className="text-xs">Subtotal</Label>
                                                            <div className="h-9 px-2 flex items-center font-mono text-xs font-semibold text-foreground bg-muted/40 rounded-md border mt-1">
                                                                {formatRupiah(rowSubtotal)}
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                                                        <div>
                                                            <Label className="text-[11px] text-muted-foreground">
                                                                Estimasi Kadaluarsa (Expired Date)
                                                            </Label>
                                                            <Input
                                                                type="date"
                                                                value={item.expired_date}
                                                                onChange={(e) => handleExpDateChange(index, e.target.value)}
                                                                className="text-xs mt-1 h-8"
                                                            />
                                                        </div>
                                                    </div>
                                                </div>
                                            )
                                        })}
                                    </div>
                                </CardContent>
                            </Card>
                        </div>

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
                                            <span className="text-muted-foreground">Subtotal:</span>
                                            <span className="font-mono font-bold text-foreground">
                                                {formatRupiah(subtotal)}
                                            </span>
                                        </div>

                                        {/* Input Diskon Gabungan (Fixed Rp / Persen %) */}
                                        <Field className="space-y-1.5">
                                            <div className="flex items-center justify-between gap-2">
                                                <Label htmlFor="edit_discount" className="text-xs text-muted-foreground">
                                                    Diskon
                                                </Label>
                                                <span className="font-mono text-xs font-medium text-rose-600 dark:text-rose-400">
                                                    - {formatRupiah(discountAmount)}
                                                </span>
                                            </div>
                                            <div className="flex items-center">
                                                <div className="inline-flex h-8 shrink-0 rounded-l-md border border-r-0 border-input bg-muted/50 p-0.5">
                                                    <button
                                                        type="button"
                                                        onClick={() => handleDiscountTypeChange('fixed')}
                                                        className={`px-2 text-[11px] font-semibold rounded-xs transition-colors cursor-pointer ${
                                                            data.discount_type === 'fixed'
                                                                ? 'bg-background text-foreground shadow-xs'
                                                                : 'text-muted-foreground hover:text-foreground'
                                                        }`}
                                                    >
                                                        Rp
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleDiscountTypeChange('percent')}
                                                        className={`px-2 text-[11px] font-semibold rounded-xs transition-colors cursor-pointer ${
                                                            data.discount_type === 'percent'
                                                                ? 'bg-background text-foreground shadow-xs'
                                                                : 'text-muted-foreground hover:text-foreground'
                                                        }`}
                                                    >
                                                        %
                                                    </button>
                                                </div>
                                                <Input
                                                    id="edit_discount"
                                                    type="number"
                                                    inputMode="decimal"
                                                    min={0}
                                                    max={data.discount_type === 'percent' ? 100 : undefined}
                                                    step="any"
                                                    placeholder="0"
                                                    value={data.discount_value}
                                                    onChange={(e) => handleDiscountValueChange(e.target.value)}
                                                    className="font-mono text-xs text-right h-8 rounded-l-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                                />
                                            </div>
                                            {(errors.discount_value || errors.discount_type) && (
                                                <FieldError>{errors.discount_value || errors.discount_type}</FieldError>
                                            )}
                                        </Field>

                                        {/* Input Pajak / PPN (%) */}
                                        <Field className="space-y-1.5">
                                            <div className="flex items-center justify-between gap-2">
                                                <div className="flex items-center gap-1.5">
                                                    <Label htmlFor="edit_tax_percentage" className="text-xs text-muted-foreground">
                                                        Pajak / PPN (%)
                                                    </Label>
                                                    <div className="inline-flex items-center gap-1">
                                                        {[0, 11].map((preset) => (
                                                            <button
                                                                key={preset}
                                                                type="button"
                                                                onClick={() => setData('tax_percentage', preset)}
                                                                className={`px-1.5 py-0.5 text-[10px] font-mono rounded border transition-colors cursor-pointer ${
                                                                    taxPercentageNum === preset
                                                                        ? 'border-primary bg-primary/10 text-primary font-semibold'
                                                                        : 'border-input text-muted-foreground hover:text-foreground'
                                                                }`}
                                                            >
                                                                {preset}%
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>
                                                <span className="font-mono text-xs font-medium text-emerald-600 dark:text-emerald-400">
                                                    + {formatRupiah(taxAmount)}
                                                </span>
                                            </div>
                                            <div className="relative flex items-center">
                                                <Input
                                                    id="edit_tax_percentage"
                                                    type="number"
                                                    inputMode="decimal"
                                                    min={0}
                                                    max={100}
                                                    step="any"
                                                    placeholder="0"
                                                    value={data.tax_percentage}
                                                    onChange={(e) => handleTaxPercentageChange(e.target.value)}
                                                    className="font-mono text-xs text-right h-8 pr-7 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                                />
                                                <span className="pointer-events-none absolute right-2.5 text-xs font-mono text-muted-foreground">
                                                    %
                                                </span>
                                            </div>
                                            <span className="text-[10px] text-muted-foreground block">
                                                DPP (Subtotal - Diskon): <strong className="font-mono">{formatRupiah(taxableAmount)}</strong>
                                            </span>
                                            {errors.tax_percentage && <FieldError>{errors.tax_percentage}</FieldError>}
                                        </Field>

                                        <div className="flex justify-between items-center py-2 border-t-2 border-foreground/20 text-sm">
                                            <span className="font-bold text-foreground">Grand Total:</span>
                                            <span className="font-mono text-base font-extrabold text-primary">
                                                {formatRupiah(grandTotal)}
                                            </span>
                                        </div>
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
                                        {purchaseOrder.status === 'draft' ? (
                                            <>
                                                <Button
                                                    type="button"
                                                    onClick={() => submitForm('ordered')}
                                                    disabled={processing || items.filter((it) => it.product_id).length === 0}
                                                    className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
                                                >
                                                    {processing ? 'Menyimpan...' : 'Simpan & Kirim Pesanan (Ordered)'}
                                                </Button>
                                                <Button
                                                    type="submit"
                                                    variant="outline"
                                                    disabled={processing || items.filter((it) => it.product_id).length === 0}
                                                    className="w-full text-xs"
                                                >
                                                    {processing ? 'Menyimpan...' : 'Simpan Perubahan (Tetap Draft)'}
                                                </Button>
                                            </>
                                        ) : (
                                            <Button
                                                type="submit"
                                                disabled={processing || items.filter((it) => it.product_id).length === 0}
                                                className="w-full font-semibold"
                                            >
                                                {processing ? 'Menyimpan...' : 'Perbarui Purchase Order'}
                                            </Button>
                                        )}
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    </div>
                </form>
            </div>
    )
}

PurchaseOrdersEdit.layout = (page: React.ReactNode) => (
    <AuthenticatedLayout>{page}</AuthenticatedLayout>
)

export default PurchaseOrdersEdit

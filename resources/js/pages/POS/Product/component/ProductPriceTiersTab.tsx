import React, { useState } from 'react'
import { router } from '@inertiajs/react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
import ProductPriceTierController from '@/actions/App/Http/Controllers/ProductPriceTierController'
import type { ProductPriceTierRow } from '@/types'
import { Pencil, Plus, Tag, Trash2 } from 'lucide-react'
import type { DetailProductData } from '../DetailProduct'

interface ProductPriceTiersTabProps {
    product: DetailProductData
    canManage: boolean
}

interface TierFormState {
    product_unit_id: string
    min_qty: string
    unit_price: string
    is_active: boolean
}

const formatRupiah = (val: number | string): string =>
    new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0,
    }).format(Number(val) || 0)

export function ProductPriceTiersTab({ product, canManage }: ProductPriceTiersTabProps) {
    const tiers = product.price_tiers ?? []
    const units = product.units ?? []
    const baseUnit = product.base_unit || 'pcs'

    const [dialogOpen, setDialogOpen] = useState(false)
    const [editingTier, setEditingTier] = useState<ProductPriceTierRow | null>(null)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [errors, setErrors] = useState<Record<string, string>>({})
    const [form, setForm] = useState<TierFormState>({
        product_unit_id: 'base',
        min_qty: '3',
        unit_price: '',
        is_active: true,
    })

    const unitItems = [
        {
            value: 'base',
            label: `${baseUnit} (Satuan Dasar — ${formatRupiah(product.sell_price)})`,
        },
        ...units
            .filter((u) => u.is_active)
            .map((u) => ({
                value: String(u.id),
                label: `${u.unit_name} (1 = ${u.conversion_factor} ${baseUnit} — ${formatRupiah(u.sell_price ?? product.sell_price)})`,
            })),
    ]

    const getRegularPriceForUnit = (unitId: number | null): number => {
        if (unitId === null) {
            return Number(product.sell_price) || 0
        }
        const found = units.find((u) => u.id === unitId)
        return Number(found?.sell_price ?? product.sell_price) || 0
    }

    const openCreateDialog = () => {
        setEditingTier(null)
        setErrors({})
        setForm({
            product_unit_id: 'base',
            min_qty: '3',
            unit_price: '',
            is_active: true,
        })
        setDialogOpen(true)
    }

    const openEditDialog = (tier: ProductPriceTierRow) => {
        setEditingTier(tier)
        setErrors({})
        setForm({
            product_unit_id: tier.product_unit_id !== null ? String(tier.product_unit_id) : 'base',
            min_qty: String(tier.min_qty),
            unit_price: String(Math.round(tier.unit_price)),
            is_active: tier.is_active,
        })
        setDialogOpen(true)
    }

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        setIsSubmitting(true)
        setErrors({})

        const payload = {
            product_unit_id: form.product_unit_id === 'base' ? null : Number(form.product_unit_id),
            min_qty: Number(form.min_qty),
            unit_price: Number(form.unit_price),
            is_active: form.is_active,
        }

        if (editingTier) {
            router.patch(
                ProductPriceTierController.update.url({
                    product: product.id,
                    priceTier: editingTier.id,
                }),
                payload,
                {
                    preserveScroll: true,
                    onError: (errs) => setErrors(errs),
                    onSuccess: () => setDialogOpen(false),
                    onFinish: () => setIsSubmitting(false),
                }
            )
        } else {
            router.post(
                ProductPriceTierController.store.url({ product: product.id }),
                payload,
                {
                    preserveScroll: true,
                    onError: (errs) => setErrors(errs),
                    onSuccess: () => setDialogOpen(false),
                    onFinish: () => setIsSubmitting(false),
                }
            )
        }
    }

    const handleDelete = (tier: ProductPriceTierRow) => {
        if (!window.confirm(`Hapus aturan harga grosir min. ${tier.min_qty} ${tier.unit_name}?`)) {
            return
        }

        router.delete(
            ProductPriceTierController.destroy.url({
                product: product.id,
                priceTier: tier.id,
            }),
            { preserveScroll: true }
        )
    }

    return (
        <div className="space-y-4">
            <Card>
                <CardHeader className="pb-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div className="flex items-start gap-2.5">
                        <Tag className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                        <div>
                            <CardTitle className="text-base font-semibold">
                                Harga Grosir Bertingkat (Tiered Pricing)
                            </CardTitle>
                            <CardDescription>
                                Harga satuan otomatis turun saat qty pembelian di kasir mencapai minimal jumlah pada satuan terkait.
                            </CardDescription>
                        </div>
                    </div>
                    {canManage && (
                        <Button
                            type="button"
                            size="sm"
                            onClick={openCreateDialog}
                            className="gap-1.5 h-9 shrink-0 cursor-pointer"
                        >
                            <Plus className="h-4 w-4" />
                            Tambah Tier Grosir
                        </Button>
                    )}
                </CardHeader>

                <CardContent className="p-0">
                    {tiers.length === 0 ? (
                        <div className="p-8 text-center text-xs text-muted-foreground border-t">
                            Belum ada aturan harga grosir untuk produk ini.
                            {canManage && ' Klik "Tambah Tier Grosir" untuk menambahkan harga bertingkat.'}
                        </div>
                    ) : (
                        <div className="overflow-x-auto border-t">
                            <table className="w-full min-w-[680px] table-fixed text-xs text-left">
                                <thead className="bg-muted/70 text-muted-foreground font-semibold border-b">
                                    <tr>
                                        <th className="p-3 w-[22%]">Satuan</th>
                                        <th className="p-3 w-[14%] text-center">Min. Qty</th>
                                        <th className="p-3 w-[18%] text-right">Harga Normal</th>
                                        <th className="p-3 w-[18%] text-right">Harga Grosir</th>
                                        <th className="p-3 w-[12%] text-center">Status</th>
                                        <th className="p-3 w-[16%] text-right">Aksi</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y">
                                    {tiers.map((tier) => {
                                        const regularPrice = getRegularPriceForUnit(tier.product_unit_id)
                                        const savingsPerUnit = Math.max(0, regularPrice - tier.unit_price)

                                        return (
                                            <tr key={tier.id} className="hover:bg-muted/30 transition-colors">
                                                <td className="p-3 overflow-hidden text-ellipsis">
                                                    <div className="flex items-center gap-1.5 min-w-0">
                                                        <span className="font-semibold text-foreground truncate">
                                                            {tier.unit_name}
                                                        </span>
                                                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 shrink-0">
                                                            {tier.product_unit_id === null ? 'Dasar' : 'Multi-UOM'}
                                                        </Badge>
                                                    </div>
                                                </td>
                                                <td className="p-3 text-center font-mono font-semibold text-foreground">
                                                    ≥ {tier.min_qty}
                                                </td>
                                                <td className="p-3 text-right font-mono text-muted-foreground">
                                                    {formatRupiah(regularPrice)}
                                                </td>
                                                <td className="p-3 text-right">
                                                    <div className="font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                                                        {formatRupiah(tier.unit_price)}
                                                    </div>
                                                    {savingsPerUnit > 0 && (
                                                        <div className="font-mono text-[10px] text-muted-foreground">
                                                            Hemat {formatRupiah(savingsPerUnit)}/unit
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="p-3 text-center">
                                                    {tier.is_active ? (
                                                        <Badge variant="success">Aktif</Badge>
                                                    ) : (
                                                        <Badge variant="secondary">Nonaktif</Badge>
                                                    )}
                                                </td>
                                                <td className="p-3 text-right">
                                                    {canManage ? (
                                                        <div className="flex items-center justify-end gap-1">
                                                            <Button
                                                                type="button"
                                                                variant="ghost"
                                                                size="icon"
                                                                onClick={() => openEditDialog(tier)}
                                                                className="h-7 w-7 cursor-pointer"
                                                                title="Edit tier grosir"
                                                            >
                                                                <Pencil className="h-3.5 w-3.5" />
                                                            </Button>
                                                            <Button
                                                                type="button"
                                                                variant="ghost"
                                                                size="icon"
                                                                onClick={() => handleDelete(tier)}
                                                                className="h-7 w-7 text-destructive hover:text-destructive cursor-pointer"
                                                                title="Hapus tier grosir"
                                                            >
                                                                <Trash2 className="h-3.5 w-3.5" />
                                                            </Button>
                                                        </div>
                                                    ) : (
                                                        <span className="text-muted-foreground">-</span>
                                                    )}
                                                </td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </CardContent>
            </Card>

            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogContent className="max-w-lg max-h-[85vh] flex flex-col p-0 gap-0 overflow-hidden">
                    <DialogHeader className="p-6 pb-4 border-b shrink-0">
                        <DialogTitle>
                            {editingTier ? 'Edit Aturan Harga Grosir' : 'Tambah Aturan Harga Grosir'}
                        </DialogTitle>
                        <DialogDescription>
                            Atur jumlah pembelian minimal dan harga satuan grosir untuk {product.name}.
                        </DialogDescription>
                    </DialogHeader>

                    <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
                        <div className="flex-1 overflow-y-auto overflow-x-hidden p-6 space-y-4">
                            <div className="space-y-1.5">
                                <Label>Satuan Produk</Label>
                                <Select
                                    items={unitItems}
                                    value={form.product_unit_id}
                                    onValueChange={(val) => {
                                        if (val != null) {
                                            setForm((prev) => ({ ...prev, product_unit_id: val }))
                                        }
                                    }}
                                >
                                    <SelectTrigger className="w-full h-9">
                                        <SelectValue placeholder="Pilih satuan">
                                            {(val) => unitItems.find((item) => item.value === val)?.label}
                                        </SelectValue>
                                    </SelectTrigger>
                                    <SelectContent>
                                        {unitItems.map((item) => (
                                            <SelectItem key={item.value} value={item.value}>
                                                {item.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                {errors.product_unit_id && (
                                    <p className="text-xs text-destructive">{errors.product_unit_id}</p>
                                )}
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <Label htmlFor="tier-min-qty">
                                        Minimal Qty <span className="text-destructive">*</span>
                                    </Label>
                                    <Input
                                        id="tier-min-qty"
                                        type="number"
                                        min={2}
                                        step={1}
                                        value={form.min_qty}
                                        onChange={(e) => setForm((prev) => ({ ...prev, min_qty: e.target.value }))}
                                        className="h-9 font-mono"
                                        required
                                    />
                                    {errors.min_qty && (
                                        <p className="text-xs text-destructive">{errors.min_qty}</p>
                                    )}
                                </div>

                                <div className="space-y-1.5">
                                    <Label htmlFor="tier-unit-price">
                                        Harga Satuan Grosir (Rp) <span className="text-destructive">*</span>
                                    </Label>
                                    <Input
                                        id="tier-unit-price"
                                        type="number"
                                        min={1}
                                        step={1}
                                        value={form.unit_price}
                                        onChange={(e) => setForm((prev) => ({ ...prev, unit_price: e.target.value }))}
                                        placeholder="Contoh: 2800"
                                        className="h-9 font-mono"
                                        required
                                    />
                                    {errors.unit_price && (
                                        <p className="text-xs text-destructive">{errors.unit_price}</p>
                                    )}
                                </div>
                            </div>

                            <div className="flex items-center justify-between rounded-lg border p-3 bg-muted/20">
                                <div>
                                    <p className="text-sm font-medium">Status Aktif</p>
                                    <p className="text-xs text-muted-foreground">
                                        Aktifkan agar harga grosir otomatis diterapkan di Terminal Kasir.
                                    </p>
                                </div>
                                <Switch
                                    checked={form.is_active}
                                    onCheckedChange={(checked) => setForm((prev) => ({ ...prev, is_active: checked }))}
                                />
                            </div>
                        </div>

                        <DialogFooter className="p-6 pt-4 border-t shrink-0 flex items-center justify-end gap-2 bg-muted/20">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => setDialogOpen(false)}
                                className="cursor-pointer"
                            >
                                Batal
                            </Button>
                            <Button type="submit" disabled={isSubmitting} className="cursor-pointer">
                                {isSubmitting ? 'Menyimpan...' : 'Simpan'}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    )
}

export default ProductPriceTiersTab

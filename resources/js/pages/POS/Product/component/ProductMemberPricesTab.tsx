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
import ProductMemberPriceController from '@/actions/App/Http/Controllers/ProductMemberPriceController'
import type { CustomerTierOption, ProductMemberPriceRow } from '@/types'
import { Crown, Pencil, Plus, Trash2 } from 'lucide-react'
import type { DetailProductData } from '../DetailProduct'

interface ProductMemberPricesTabProps {
    product: DetailProductData
    canManage: boolean
    tierOptions: CustomerTierOption[]
}

interface MemberPriceFormState {
    product_unit_id: string
    tier: string
    member_price: string
    is_active: boolean
}

const formatRupiah = (val: number | string): string =>
    new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0,
    }).format(Number(val) || 0)

export function ProductMemberPricesTab({
    product,
    canManage,
    tierOptions,
}: ProductMemberPricesTabProps) {
    const memberPrices = product.member_prices ?? []
    const units = product.units ?? []
    const baseUnit = product.base_unit || 'pcs'

    const [dialogOpen, setDialogOpen] = useState(false)
    const [editingItem, setEditingItem] = useState<ProductMemberPriceRow | null>(null)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [errors, setErrors] = useState<Record<string, string>>({})
    const [form, setForm] = useState<MemberPriceFormState>({
        product_unit_id: 'base',
        tier: 'all',
        member_price: '',
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

    const tierItems = [
        { value: 'all', label: 'Semua Member (Semua Tier)' },
        ...tierOptions.map((t) => ({
            value: t.value,
            label: `${t.label} (${t.multiplier}x Poin)`,
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
        setEditingItem(null)
        setErrors({})
        setForm({
            product_unit_id: 'base',
            tier: 'all',
            member_price: '',
            is_active: true,
        })
        setDialogOpen(true)
    }

    const openEditDialog = (item: ProductMemberPriceRow) => {
        setEditingItem(item)
        setErrors({})
        setForm({
            product_unit_id: item.product_unit_id !== null ? String(item.product_unit_id) : 'base',
            tier: item.tier ?? 'all',
            member_price: String(Math.round(item.member_price)),
            is_active: item.is_active,
        })
        setDialogOpen(true)
    }

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        setIsSubmitting(true)
        setErrors({})

        const payload = {
            product_unit_id: form.product_unit_id === 'base' ? null : Number(form.product_unit_id),
            tier: form.tier === 'all' ? null : form.tier,
            member_price: Number(form.member_price),
            is_active: form.is_active,
        }

        if (editingItem) {
            router.patch(
                ProductMemberPriceController.update.url({
                    product: product.id,
                    memberPrice: editingItem.id,
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
                ProductMemberPriceController.store.url({ product: product.id }),
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

    const handleDelete = (item: ProductMemberPriceRow) => {
        if (!window.confirm(`Hapus harga member ${item.tier_label} untuk satuan ${item.unit_name}?`)) {
            return
        }

        router.delete(
            ProductMemberPriceController.destroy.url({
                product: product.id,
                memberPrice: item.id,
            }),
            { preserveScroll: true }
        )
    }

    return (
        <div className="space-y-4">
            <Card>
                <CardHeader className="pb-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div className="flex items-start gap-2.5">
                        <Crown className="h-5 w-5 text-violet-600 dark:text-violet-400 mt-0.5 shrink-0" />
                        <div>
                            <CardTitle className="text-base font-semibold">
                                Harga Khusus Member (Tiered Member Price)
                            </CardTitle>
                            <CardDescription>
                                Diterapkan otomatis di Langkah 2 pipeline harga untuk pelanggan member aktif sesuai tier (atau semua member).
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
                            Tambah Harga Member
                        </Button>
                    )}
                </CardHeader>

                <CardContent className="p-0">
                    {memberPrices.length === 0 ? (
                        <div className="p-8 text-center text-xs text-muted-foreground border-t">
                            Belum ada aturan harga khusus member untuk produk ini.
                            {canManage && ' Klik "Tambah Harga Member" untuk menambahkan harga khusus member.'}
                        </div>
                    ) : (
                        <div className="overflow-x-auto border-t">
                            <table className="w-full min-w-[680px] table-fixed text-xs text-left">
                                <thead className="bg-muted/70 text-muted-foreground font-semibold border-b">
                                    <tr>
                                        <th className="p-3 w-[22%]">Satuan</th>
                                        <th className="p-3 w-[18%]">Tier Member</th>
                                        <th className="p-3 w-[16%] text-right">Harga Normal</th>
                                        <th className="p-3 w-[18%] text-right">Harga Member</th>
                                        <th className="p-3 w-[12%] text-center">Status</th>
                                        <th className="p-3 w-[14%] text-right">Aksi</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y">
                                    {memberPrices.map((mp) => {
                                        const regularPrice = getRegularPriceForUnit(mp.product_unit_id)
                                        const savingsPerUnit = Math.max(0, regularPrice - mp.member_price)

                                        return (
                                            <tr key={mp.id} className="hover:bg-muted/30 transition-colors">
                                                <td className="p-3 overflow-hidden text-ellipsis">
                                                    <div className="flex items-center gap-1.5 min-w-0">
                                                        <span className="font-semibold text-foreground truncate">
                                                            {mp.unit_name}
                                                        </span>
                                                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 shrink-0">
                                                            {mp.product_unit_id === null ? 'Dasar' : 'Multi-UOM'}
                                                        </Badge>
                                                    </div>
                                                </td>
                                                <td className="p-3">
                                                    <Badge
                                                        variant="outline"
                                                        className={
                                                            mp.tier === 'platinum'
                                                                ? 'border-violet-300 bg-violet-50 text-violet-800 dark:border-violet-800 dark:bg-violet-950/60 dark:text-violet-300'
                                                                : mp.tier === 'gold'
                                                                  ? 'border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                                                                  : mp.tier === 'silver'
                                                                    ? 'border-slate-300 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300'
                                                                    : 'border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950/60 dark:text-blue-300'
                                                        }
                                                    >
                                                        {mp.tier_label}
                                                    </Badge>
                                                </td>
                                                <td className="p-3 text-right font-mono text-muted-foreground">
                                                    {formatRupiah(regularPrice)}
                                                </td>
                                                <td className="p-3 text-right">
                                                    <div className="font-mono font-semibold text-violet-600 dark:text-violet-400">
                                                        {formatRupiah(mp.member_price)}
                                                    </div>
                                                    {savingsPerUnit > 0 && (
                                                        <div className="font-mono text-[10px] text-muted-foreground">
                                                            Hemat {formatRupiah(savingsPerUnit)}/unit
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="p-3 text-center">
                                                    {mp.is_active ? (
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
                                                                onClick={() => openEditDialog(mp)}
                                                                className="h-7 w-7 cursor-pointer"
                                                                title="Edit harga member"
                                                            >
                                                                <Pencil className="h-3.5 w-3.5" />
                                                            </Button>
                                                            <Button
                                                                type="button"
                                                                variant="ghost"
                                                                size="icon"
                                                                onClick={() => handleDelete(mp)}
                                                                className="h-7 w-7 text-destructive hover:text-destructive cursor-pointer"
                                                                title="Hapus harga member"
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
                            {editingItem ? 'Edit Harga Khusus Member' : 'Tambah Harga Khusus Member'}
                        </DialogTitle>
                        <DialogDescription>
                            Atur harga khusus member berdasarkan tier pelanggan untuk {product.name}.
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
                                    <Label>Tier Member</Label>
                                    <Select
                                        items={tierItems}
                                        value={form.tier}
                                        onValueChange={(val) => {
                                            if (val != null) {
                                                setForm((prev) => ({ ...prev, tier: val }))
                                            }
                                        }}
                                    >
                                        <SelectTrigger className="w-full h-9">
                                            <SelectValue placeholder="Pilih tier">
                                                {(val) => tierItems.find((item) => item.value === val)?.label}
                                            </SelectValue>
                                        </SelectTrigger>
                                        <SelectContent>
                                            {tierItems.map((item) => (
                                                <SelectItem key={item.value} value={item.value}>
                                                    {item.label}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    {errors.tier && <p className="text-xs text-destructive">{errors.tier}</p>}
                                </div>

                                <div className="space-y-1.5">
                                    <Label htmlFor="member-price-input">
                                        Harga Member (Rp) <span className="text-destructive">*</span>
                                    </Label>
                                    <Input
                                        id="member-price-input"
                                        type="number"
                                        min={1}
                                        step={1}
                                        value={form.member_price}
                                        onChange={(e) => setForm((prev) => ({ ...prev, member_price: e.target.value }))}
                                        placeholder="Contoh: 9000"
                                        className="h-9 font-mono"
                                        required
                                    />
                                    {errors.member_price && (
                                        <p className="text-xs text-destructive">{errors.member_price}</p>
                                    )}
                                </div>
                            </div>

                            <div className="flex items-center justify-between rounded-lg border p-3 bg-muted/20">
                                <div>
                                    <p className="text-sm font-medium">Status Aktif</p>
                                    <p className="text-xs text-muted-foreground">
                                        Aktifkan agar harga member otomatis diterapkan saat pelanggan terpilih di kasir.
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

export default ProductMemberPricesTab

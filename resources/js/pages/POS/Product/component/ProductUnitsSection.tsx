import * as React from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Plus, Trash2, Boxes, Star } from 'lucide-react'

export interface ProductUnitFormRow {
    id?: number | null
    unit_name: string
    conversion_factor: string
    barcode: string
    buy_price: string
    sell_price: string
    is_default_purchase: boolean
    is_active: boolean
}

interface ProductUnitsSectionProps {
    baseUnit: string
    baseBuyPrice: number
    units: ProductUnitFormRow[]
    onChange: (units: ProductUnitFormRow[]) => void
    errors: Record<string, string | undefined>
}

const COMMON_PACK_UNITS = ['Dus', 'Karton', 'Pack', 'Renceng', 'Bal', 'Slop', 'Box']

const formatRupiah = (val: number) =>
    new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0,
    }).format(val)

export function ProductUnitsSection({
    baseUnit,
    baseBuyPrice,
    units,
    onChange,
    errors,
}: ProductUnitsSectionProps) {
    const normalizedBaseUnit = baseUnit.trim() || 'pcs'

    const handleAddRow = () => {
        const defaultFactor = 12
        const estimatedBuy = baseBuyPrice > 0 ? String(Math.round(baseBuyPrice * defaultFactor)) : ''
        onChange([
            ...units,
            {
                id: null,
                unit_name: '',
                conversion_factor: String(defaultFactor),
                barcode: '',
                buy_price: estimatedBuy,
                sell_price: '',
                is_default_purchase: units.length === 0,
                is_active: true,
            },
        ])
    }

    const handleRemoveRow = (index: number) => {
        onChange(units.filter((_, i) => i !== index))
    }

    const handleFieldChange = <K extends keyof ProductUnitFormRow>(
        index: number,
        field: K,
        value: ProductUnitFormRow[K]
    ) => {
        const next = units.map((row, idx) => {
            if (idx !== index) {
                // Pastikan hanya satu satuan yang menjadi default PO
                if (field === 'is_default_purchase' && value === true) {
                    return { ...row, is_default_purchase: false }
                }
                return row
            }

            const updated = { ...row, [field]: value }

            // Jika dinonaktifkan, matikan juga is_default_purchase
            if (field === 'is_active' && value === false) {
                updated.is_default_purchase = false
            }

            // Jika dijadikan default PO, pastikan aktif
            if (field === 'is_default_purchase' && value === true) {
                updated.is_active = true
            }

            return updated
        })

        onChange(next)
    }

    const handleAutoEstimatePrice = (index: number) => {
        const row = units[index]
        const factor = Number(row.conversion_factor) || 0
        if (factor > 0 && baseBuyPrice > 0) {
            handleFieldChange(index, 'buy_price', String(Math.round(baseBuyPrice * factor)))
        }
    }

    return (
        <div className="rounded-lg border border-border bg-muted/20 p-3.5 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="space-y-0.5">
                    <div className="flex items-center gap-1.5">
                        <Boxes className="h-4 w-4 text-primary" />
                        <Label className="text-sm font-semibold">
                            Konversi Multi-Satuan (Multi-UOM)
                        </Label>
                        {units.length > 0 && (
                            <Badge variant="secondary" className="text-[10px] font-mono px-1.5 py-0">
                                {units.length} satuan
                            </Badge>
                        )}
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                        Tambahkan satuan pembelian besar (misal: Dus, Karton, Renceng). Stok di sistem selalu disimpan dalam satuan dasar{' '}
                        <strong className="font-mono text-foreground">{normalizedBaseUnit}</strong>.
                    </p>
                </div>

                <Button
                    type="button"
                    variant="outline"
                    size="xs"
                    onClick={handleAddRow}
                    className="gap-1 shrink-0 self-start sm:self-center"
                >
                    <Plus className="h-3.5 w-3.5" />
                    Tambah Satuan
                </Button>
            </div>

            {errors.units && (
                <p className="text-xs font-medium text-destructive">{errors.units}</p>
            )}

            {units.length === 0 ? (
                <div className="rounded-md border border-dashed border-border/80 bg-background/60 p-3 text-center text-xs text-muted-foreground">
                    Belum ada satuan konversi tambahan. Produk hanya menggunakan satuan dasar{' '}
                    <span className="font-mono font-semibold text-foreground">{normalizedBaseUnit}</span>.
                </div>
            ) : (
                <div className="space-y-2.5">
                    {units.map((row, index) => {
                        const factorNum = Number(row.conversion_factor) || 0
                        const buyNum = Number(row.buy_price) || 0
                        const perBaseCost = factorNum > 0 && buyNum > 0 ? buyNum / factorNum : 0

                        const nameError = errors[`units.${index}.unit_name`]
                        const factorError = errors[`units.${index}.conversion_factor`]
                        const barcodeError = errors[`units.${index}.barcode`]
                        const buyPriceError = errors[`units.${index}.buy_price`]
                        const sellPriceError = errors[`units.${index}.sell_price`]

                        return (
                            <div
                                key={row.id ? `existing-${row.id}` : `new-${index}`}
                                className="rounded-md border border-border bg-background p-3 space-y-2.5"
                            >
                                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-2">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <span className="text-xs font-semibold text-muted-foreground">
                                            Satuan #{index + 1}
                                        </span>
                                        {row.unit_name.trim() && factorNum > 0 && (
                                            <Badge variant="outline" className="text-[11px] font-mono bg-primary/5 border-primary/20 text-primary">
                                                1 {row.unit_name.trim()} = {factorNum} {normalizedBaseUnit}
                                            </Badge>
                                        )}
                                        {row.is_default_purchase && (
                                            <Badge variant="secondary" className="text-[10px] gap-1 bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                                                <Star className="h-2.5 w-2.5 fill-current" />
                                                Default PO
                                            </Badge>
                                        )}
                                    </div>

                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon-xs"
                                        onClick={() => handleRemoveRow(index)}
                                        className="text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                                        title="Hapus satuan ini"
                                    >
                                        <Trash2 className="h-3.5 w-3.5" />
                                    </Button>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
                                    {/* Nama Satuan */}
                                    <div className="sm:col-span-4 space-y-1">
                                        <Label className="text-[11px]">
                                            Nama Satuan <span className="text-destructive">*</span>
                                        </Label>
                                        <Input
                                            value={row.unit_name}
                                            onChange={(e) => handleFieldChange(index, 'unit_name', e.target.value)}
                                            placeholder="Contoh: Dus, Karton"
                                            className="h-8 text-xs"
                                            aria-invalid={!!nameError}
                                            required
                                        />
                                        <div className="flex flex-wrap gap-1">
                                            {COMMON_PACK_UNITS.slice(0, 4).map((preset) => (
                                                <button
                                                    key={preset}
                                                    type="button"
                                                    onClick={() => handleFieldChange(index, 'unit_name', preset)}
                                                    className="px-1.5 py-0.5 text-[10px] rounded border border-border/80 bg-muted/40 hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer"
                                                >
                                                    {preset}
                                                </button>
                                            ))}
                                        </div>
                                        {nameError && <p className="text-[11px] text-destructive">{nameError}</p>}
                                    </div>

                                    {/* Faktor Konversi */}
                                    <div className="sm:col-span-4 space-y-1">
                                        <Label className="text-[11px]">
                                            Isi per Satuan ({normalizedBaseUnit}) <span className="text-destructive">*</span>
                                        </Label>
                                        <Input
                                            type="number"
                                            min={1}
                                            step={1}
                                            value={row.conversion_factor}
                                            onChange={(e) => handleFieldChange(index, 'conversion_factor', e.target.value)}
                                            placeholder="40"
                                            className="h-8 text-xs font-mono"
                                            aria-invalid={!!factorError}
                                            required
                                        />
                                        {factorError && <p className="text-[11px] text-destructive">{factorError}</p>}
                                    </div>

                                    {/* Barcode Kemasan */}
                                    <div className="sm:col-span-4 space-y-1">
                                        <Label className="text-[11px]">Barcode Kemasan (Opsional)</Label>
                                        <Input
                                            value={row.barcode}
                                            onChange={(e) => handleFieldChange(index, 'barcode', e.target.value)}
                                            placeholder="Scan / ketik barcode"
                                            className="h-8 text-xs font-mono"
                                            aria-invalid={!!barcodeError}
                                        />
                                        {barcodeError && <p className="text-[11px] text-destructive">{barcodeError}</p>}
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
                                    {/* Harga Beli */}
                                    <div className="sm:col-span-6 space-y-1">
                                        <div className="flex items-center justify-between gap-1">
                                            <Label className="text-[11px]">
                                                Estimasi Harga Beli (Rp) <span className="text-destructive">*</span>
                                            </Label>
                                            {baseBuyPrice > 0 && factorNum > 0 && (
                                                <button
                                                    type="button"
                                                    onClick={() => handleAutoEstimatePrice(index)}
                                                    className="text-[10px] text-primary hover:underline cursor-pointer"
                                                >
                                                    Hitung ({formatRupiah(baseBuyPrice * factorNum)})
                                                </button>
                                            )}
                                        </div>
                                        <Input
                                            type="number"
                                            min={0}
                                            step="any"
                                            value={row.buy_price}
                                            onChange={(e) => handleFieldChange(index, 'buy_price', e.target.value)}
                                            placeholder="0"
                                            className="h-8 text-xs font-mono"
                                            aria-invalid={!!buyPriceError}
                                            required
                                        />
                                        {perBaseCost > 0 && (
                                            <p className="text-[10px] text-muted-foreground font-mono">
                                                ≈ {formatRupiah(perBaseCost)} / {normalizedBaseUnit}
                                            </p>
                                        )}
                                        {buyPriceError && <p className="text-[11px] text-destructive">{buyPriceError}</p>}
                                    </div>

                                    {/* Harga Jual Grosir */}
                                    <div className="sm:col-span-6 space-y-1">
                                        <Label className="text-[11px]">Harga Jual Grosir (Opsional)</Label>
                                        <Input
                                            type="number"
                                            min={0}
                                            step="any"
                                            value={row.sell_price}
                                            onChange={(e) => handleFieldChange(index, 'sell_price', e.target.value)}
                                            placeholder="Kosongkan jika tidak dijual grosir"
                                            className="h-8 text-xs font-mono"
                                            aria-invalid={!!sellPriceError}
                                        />
                                        {sellPriceError && <p className="text-[11px] text-destructive">{sellPriceError}</p>}
                                    </div>
                                </div>

                                <div className="flex flex-wrap items-center justify-between gap-3 pt-1 border-t border-border/50">
                                    <label className="flex items-center gap-2 text-xs cursor-pointer select-none">
                                        <Switch
                                            checked={row.is_default_purchase}
                                            onCheckedChange={(checked) =>
                                                handleFieldChange(index, 'is_default_purchase', checked)
                                            }
                                        />
                                        <span className="text-muted-foreground">Jadikan satuan default PO</span>
                                    </label>

                                    <label className="flex items-center gap-2 text-xs cursor-pointer select-none">
                                        <Switch
                                            checked={row.is_active}
                                            onCheckedChange={(checked) =>
                                                handleFieldChange(index, 'is_active', checked)
                                            }
                                        />
                                        <span className="text-muted-foreground">
                                            {row.is_active ? 'Aktif' : 'Nonaktif'}
                                        </span>
                                    </label>
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}
        </div>
    )
}

export default ProductUnitsSection

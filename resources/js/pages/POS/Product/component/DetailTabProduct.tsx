import React from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
    Barcode,
    Tag,
    Layers,
    Calendar,
    Clock,
    Package,
    TrendingUp,
    Boxes,
    Star,
} from 'lucide-react'
import type { DetailProductData } from '../DetailProduct'

function DetailItem({
    icon: Icon,
    label,
    value,
}: {
    icon: React.ElementType
    label: string
    value: React.ReactNode
}) {
    return (
        <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                <Icon className="h-4 w-4" />
            </div>
            <div className="flex-1 space-y-0.5">
                <p className="text-xs text-muted-foreground">{label}</p>
                <div className="text-sm font-medium">{value}</div>
            </div>
        </div>
    )
}

interface DetailTabProductProps {
    product: DetailProductData
}

export function DetailTabProduct({ product }: DetailTabProductProps) {
    const formatCurrency = (val: number | string) => {
        return new Intl.NumberFormat('id-ID', {
            style: 'currency',
            currency: 'IDR',
            minimumFractionDigits: 0,
        }).format(Number(val))
    }

    const baseUnit = product.base_unit || 'pcs'
    const buyPrice = Number(product.buy_price) || 0
    const sellPrice = Number(product.sell_price) || 0
    const profit = sellPrice - buyPrice
    const margin = buyPrice > 0 ? ((profit / buyPrice) * 100).toFixed(1) : '0'
    const units = product.units ?? []

    const getStockStatus = () => {
        if (product.stock === 0) {
            return <Badge className="bg-red-300 text-red-700 dark:bg-red-950 dark:text-red-300">Habis!</Badge>
        }
        if (product.stock <= product.min_stock) {
            return <Badge className="bg-orange-300 text-orange-700 dark:bg-orange-950 dark:text-orange-300">Hampir Habis</Badge>
        }
        return <Badge className="bg-green-300 text-green-700 dark:bg-green-950 dark:text-green-300">Aman</Badge>
    }

    return (
        <div className="space-y-6">
            {/* Header Ringkasan Produk */}
            <Card>
                <CardContent className="p-6">
                    <div className="flex items-center gap-4">
                        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl border bg-muted overflow-hidden">
                            {product.image ? (
                                <img
                                    src={product.image}
                                    alt={product.name}
                                    className="h-full w-full object-cover"
                                />
                            ) : (
                                <Package className="h-8 w-8 text-muted-foreground" />
                            )}
                        </div>
                        <div>
                            <h2 className="text-xl font-bold tracking-tight text-foreground">{product.name}</h2>
                            <div className="mt-1.5 flex flex-wrap items-center gap-2">
                                <Badge variant="outline" className="font-mono text-xs">
                                    {product.barcode}
                                </Badge>
                                <Badge variant="secondary">
                                    {product.category_name || product.category || '-'}
                                </Badge>
                                <Badge variant="outline" className="font-mono text-xs">
                                    Satuan Dasar: {baseUnit}
                                </Badge>
                                {product.active ? (
                                    <Badge variant="success">Aktif (Dijual)</Badge>
                                ) : (
                                    <Badge variant="secondary">Nonaktif</Badge>
                                )}
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Informasi Detail Produk & Inventaris */}
            <Card>
                <CardContent className="p-6 space-y-6">
                    {/* Ringkasan Harga & Margin */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 rounded-xl border bg-muted/20 p-4">
                        <div>
                            <p className="text-xs text-muted-foreground">Harga Beli / HPP (per {baseUnit})</p>
                            <p className="text-lg font-bold font-mono">{formatCurrency(product.buy_price)}</p>
                        </div>
                        <div>
                            <p className="text-xs text-muted-foreground">Harga Jual (per {baseUnit})</p>
                            <p className="text-lg font-bold font-mono text-primary">{formatCurrency(product.sell_price)}</p>
                        </div>
                        <div>
                            <p className="text-xs text-muted-foreground">Margin Keuntungan</p>
                            <p className="text-lg font-bold font-mono text-green-600 dark:text-green-400">
                                +{formatCurrency(profit)} ({margin}%)
                            </p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Kolom Kiri: Informasi Produk */}
                        <div className="space-y-4">
                            <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                                Data Produk
                            </h3>

                            <DetailItem
                                icon={Barcode}
                                label="Barcode Utama"
                                value={<span className="font-mono">{product.barcode}</span>}
                            />

                            <Separator />

                            <DetailItem
                                icon={Tag}
                                label="Kategori"
                                value={product.category_name || product.category || '-'}
                            />

                            <Separator />

                            <DetailItem
                                icon={Boxes}
                                label="Satuan Dasar"
                                value={<span className="font-mono">{baseUnit}</span>}
                            />

                            <Separator />

                            <DetailItem
                                icon={TrendingUp}
                                label="Status Penjualan"
                                value={
                                    product.active ? (
                                        <Badge variant="success">Dijual di Kasir POS</Badge>
                                    ) : (
                                        <Badge variant="secondary">Tidak Dijual (Nonaktif)</Badge>
                                    )
                                }
                            />
                        </div>

                        {/* Kolom Kanan: Inventaris & Waktu */}
                        <div className="space-y-4">
                            <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                                Inventaris & Waktu
                            </h3>

                            <DetailItem
                                icon={Layers}
                                label="Stok Saat Ini"
                                value={
                                    <div className="flex items-center gap-2">
                                        <span className="text-base font-bold font-mono">
                                            {product.stock} {baseUnit}
                                        </span>
                                        {getStockStatus()}
                                    </div>
                                }
                            />

                            <Separator />

                            <DetailItem
                                icon={Layers}
                                label="Batas Minimum Stok"
                                value={
                                    <span className="font-mono">
                                        {product.min_stock} {baseUnit}
                                    </span>
                                }
                            />

                            <Separator />

                            <DetailItem
                                icon={Calendar}
                                label="Tanggal Ditambahkan"
                                value={product.created_at || '-'}
                            />

                            <Separator />

                            <DetailItem
                                icon={Clock}
                                label="Terakhir Diperbarui"
                                value={product.updated_at || '-'}
                            />
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Konversi Multi-Satuan (Multi-UOM) */}
            <Card>
                <CardHeader className="pb-3">
                    <div className="flex items-center gap-2">
                        <Boxes className="h-5 w-5 text-primary" />
                        <div>
                            <CardTitle className="text-base font-semibold">
                                Daftar Konversi Multi-Satuan (Multi-UOM)
                            </CardTitle>
                            <CardDescription>
                                Konversi satuan pembelian/kemasan terhadap satuan dasar{' '}
                                <span className="font-mono font-semibold text-foreground">{baseUnit}</span>.
                            </CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    {units.length === 0 ? (
                        <div className="p-6 text-center text-xs text-muted-foreground border-t">
                            Belum ada satuan konversi tambahan. Produk saat ini dibeli & dijual dalam satuan dasar{' '}
                            <span className="font-mono font-semibold text-foreground">{baseUnit}</span>.
                        </div>
                    ) : (
                        <div className="overflow-x-auto border-t">
                            <table className="w-full min-w-[700px] table-fixed text-xs text-left">
                                <thead className="bg-muted/70 text-muted-foreground font-semibold border-b">
                                    <tr>
                                        <th className="p-3 w-[18%]">Satuan</th>
                                        <th className="p-3 w-[18%]">Konversi</th>
                                        <th className="p-3 w-[18%]">Barcode Kemasan</th>
                                        <th className="p-3 w-[16%] text-right">Est. Harga Beli</th>
                                        <th className="p-3 w-[16%] text-right">Harga Grosir</th>
                                        <th className="p-3 w-[14%] text-center">Status</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y">
                                    {units.map((unit) => (
                                        <tr key={unit.id} className="hover:bg-muted/30 transition-colors">
                                            <td className="p-3 overflow-hidden text-ellipsis">
                                                <div className="flex items-center gap-1.5 min-w-0">
                                                    <span className="font-semibold text-foreground truncate">
                                                        {unit.unit_name}
                                                    </span>
                                                    {unit.is_default_purchase && (
                                                        <Badge
                                                            variant="secondary"
                                                            className="text-[10px] px-1.5 py-0 gap-0.5 bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 shrink-0"
                                                        >
                                                            <Star className="h-2.5 w-2.5 fill-current" />
                                                            Default PO
                                                        </Badge>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="p-3 font-mono text-foreground overflow-hidden text-ellipsis">
                                                1 {unit.unit_name} = {unit.conversion_factor} {baseUnit}
                                            </td>
                                            <td className="p-3 font-mono text-muted-foreground overflow-hidden text-ellipsis">
                                                {unit.barcode || '-'}
                                            </td>
                                            <td className="p-3 text-right font-mono font-semibold text-foreground">
                                                {formatCurrency(unit.buy_price)}
                                            </td>
                                            <td className="p-3 text-right font-mono text-muted-foreground">
                                                {unit.sell_price !== null ? formatCurrency(unit.sell_price) : '-'}
                                            </td>
                                            <td className="p-3 text-center">
                                                {unit.is_active ? (
                                                    <Badge variant="success">Aktif</Badge>
                                                ) : (
                                                    <Badge variant="secondary">Nonaktif</Badge>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}

export default DetailTabProduct

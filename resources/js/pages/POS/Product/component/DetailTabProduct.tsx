import React from 'react'
import { Card, CardContent } from '@/components/ui/card'
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

    const buyPrice = Number(product.buy_price) || 0
    const sellPrice = Number(product.sell_price) || 0
    const profit = sellPrice - buyPrice
    const margin = buyPrice > 0 ? ((profit / buyPrice) * 100).toFixed(1) : '0'

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
                            <p className="text-xs text-muted-foreground">Harga Beli</p>
                            <p className="text-lg font-bold">{formatCurrency(product.buy_price)}</p>
                        </div>
                        <div>
                            <p className="text-xs text-muted-foreground">Harga Jual</p>
                            <p className="text-lg font-bold text-primary">{formatCurrency(product.sell_price)}</p>
                        </div>
                        <div>
                            <p className="text-xs text-muted-foreground">Margin Keuntungan</p>
                            <p className="text-lg font-bold text-green-600 dark:text-green-400">
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
                                label="Barcode / Kode Barang"
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
                                        <span className="text-base font-bold">{product.stock} unit</span>
                                        {getStockStatus()}
                                    </div>
                                }
                            />

                            <Separator />

                            <DetailItem
                                icon={Layers}
                                label="Batas Minimum Stok"
                                value={<span>{product.min_stock} unit</span>}
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
        </div>
    )
}

export default DetailTabProduct

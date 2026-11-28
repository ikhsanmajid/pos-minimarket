import React, { useEffect, useRef, useState } from 'react'
import { Barcode, Loader2, Package, Plus, Sparkles, Tag, X } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import PosController from '@/actions/App/Http/Controllers/PosController'
import type { PosLookupProduct } from '@/types'
import { formatRupiah } from './posUtils'

interface PromoCheckPromotionItem {
    id: number
    name: string
    code: string | null
    type: string
    type_label: string
    discount_value: number | null
    max_discount_amount: number | null
    min_purchase_amount: number
    buy_qty: number | null
    get_qty: number | null
    get_discount_percent: number
    bundle_price: number | null
    member_only: boolean
    start_date: string | null
    end_date: string | null
}

interface PromoCheckTierItem {
    id: number
    min_qty: number
    unit_price: number
    unit_name: string
}

interface PromoCheckProductResult {
    product: PosLookupProduct
    category_name: string | null
    is_promo_excluded: boolean
    price_tiers: PromoCheckTierItem[]
    promotions: PromoCheckPromotionItem[]
}

interface CheckPromoDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    onAddToCart?: (product: PosLookupProduct, unitId: number | null) => void
}

function formatPromoDetail(promo: PromoCheckPromotionItem): string {
    if (promo.type === 'percent' && promo.discount_value !== null) {
        const cap = promo.max_discount_amount ? ` (maks. ${formatRupiah(promo.max_discount_amount)})` : ''
        return `Diskon ${promo.discount_value}%${cap}`
    }
    if (promo.type === 'fixed' && promo.discount_value !== null) {
        return `Potongan ${formatRupiah(promo.discount_value)}`
    }
    if (promo.type === 'special_price' && promo.discount_value !== null) {
        return `Harga Spesial ${formatRupiah(promo.discount_value)}`
    }
    if (promo.type === 'buy_x_get_y' && promo.buy_qty && promo.get_qty) {
        const discLabel = promo.get_discount_percent >= 100 ? 'Gratis' : `Diskon ${promo.get_discount_percent}%`
        return `Beli ${promo.buy_qty} ${discLabel} ${promo.get_qty}`
    }
    if ((promo.type === 'bundle' || promo.type === 'mix_match') && promo.bundle_price !== null) {
        return `Harga Paket ${formatRupiah(promo.bundle_price)}`
    }
    if (promo.type === 'tebus_murah' && promo.discount_value !== null) {
        return `Tebus Murah ${formatRupiah(promo.discount_value)} (min. belanja ${formatRupiah(promo.min_purchase_amount)})`
    }
    return promo.type_label
}

export function CheckPromoDialog({ open, onOpenChange, onAddToCart }: CheckPromoDialogProps) {
    const [query, setQuery] = useState('')
    const [results, setResults] = useState<PromoCheckProductResult[]>([])
    const [isLoading, setIsLoading] = useState(false)
    const inputRef = useRef<HTMLInputElement>(null)

    useEffect(() => {
        if (open) {
            const timer = window.setTimeout(() => {
                inputRef.current?.focus()
                inputRef.current?.select()
            }, 60)
            return () => window.clearTimeout(timer)
        }
    }, [open])

    useEffect(() => {
        if (!open) return

        const trimmed = query.trim()
        if (!trimmed) {
            setResults([])
            return
        }

        const controller = new AbortController()
        const timer = window.setTimeout(async () => {
            setIsLoading(true)
            try {
                const url = `${PosController.checkProductPromo.url()}?q=${encodeURIComponent(trimmed)}`
                const res = await fetch(url, {
                    headers: { Accept: 'application/json' },
                    signal: controller.signal,
                })
                if (res.ok) {
                    const data = (await res.json()) as { products: PromoCheckProductResult[] }
                    setResults(data.products ?? [])
                }
            } catch {
                // Ignore abort
            } finally {
                setIsLoading(false)
            }
        }, 200)

        return () => {
            window.clearTimeout(timer)
            controller.abort()
        }
    }, [query, open])

    return (
        <Dialog
            open={open}
            onOpenChange={(nextOpen, eventDetails) => {
                if (!nextOpen && eventDetails?.reason === 'outside-press') {
                    return
                }
                onOpenChange(nextOpen)
            }}
        >
            <DialogContent className="w-[calc(100%-2rem)] sm:max-w-3xl max-h-[85vh] flex flex-col p-0 gap-0 overflow-hidden">
                <DialogHeader className="p-6 pb-4 pr-12 border-b shrink-0">
                    <DialogTitle className="flex items-center gap-2">
                        <Sparkles className="h-4 w-4 text-primary" />
                        Cek Promo Produk
                    </DialogTitle>
                    <DialogDescription>
                        Scan barcode atau ketik nama produk untuk melihat promo aktif dan harga grosir yang berlaku.
                    </DialogDescription>
                </DialogHeader>

                <div className="px-6 pt-4 pb-3 border-b shrink-0">
                    <div className="relative">
                        <Barcode className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                            ref={inputRef}
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder="Scan barcode atau ketik nama produk..."
                            className="h-10 pl-9 pr-9 font-mono text-sm"
                        />
                        {isLoading ? (
                            <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
                        ) : (
                            query && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        setQuery('')
                                        inputRef.current?.focus()
                                    }}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
                                    title="Bersihkan input"
                                >
                                    <X className="h-4 w-4" />
                                </button>
                            )
                        )}
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto overflow-x-hidden p-6 space-y-3">
                    {!query.trim() ? (
                        <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
                            <Tag className="h-10 w-10 mb-2 opacity-40" />
                            <p className="text-sm font-medium">Scan barcode atau ketik nama produk</p>
                            <p className="text-xs mt-1">
                                Daftar promo aktif &amp; harga grosir produk akan tampil di sini.
                            </p>
                        </div>
                    ) : results.length === 0 && !isLoading ? (
                        <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
                            <Package className="h-10 w-10 mb-2 opacity-40" />
                            <p className="text-sm">Tidak ada produk aktif yang cocok dengan &ldquo;{query}&rdquo;.</p>
                        </div>
                    ) : (
                        results.map((entry) => {
                            const { product, price_tiers, promotions, is_promo_excluded, category_name } = entry
                            const outOfStock = !product.is_donation && product.stock <= 0
                            const hasAnyOffer = price_tiers.length > 0 || promotions.length > 0

                            return (
                                <div
                                    key={product.id}
                                    className="rounded-lg border bg-card p-4 space-y-3"
                                >
                                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                                        <div className="min-w-0 space-y-1">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <span className="font-semibold text-sm text-foreground">
                                                    {product.name}
                                                </span>
                                                {category_name && (
                                                    <Badge variant="outline" className="text-[10px]">
                                                        {category_name}
                                                    </Badge>
                                                )}
                                                <Badge
                                                    variant={outOfStock ? 'destructive' : 'secondary'}
                                                    className="font-mono text-[11px]"
                                                >
                                                    Stok: {product.stock} {product.base_unit}
                                                </Badge>
                                            </div>
                                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground font-mono">
                                                <span>{product.barcode}</span>
                                                <span className="font-semibold text-foreground">
                                                    Harga Normal: {formatRupiah(product.sell_price)} / {product.base_unit}
                                                </span>
                                            </div>
                                        </div>

                                        {onAddToCart && (
                                            <Button
                                                type="button"
                                                size="sm"
                                                disabled={outOfStock}
                                                onClick={() => onAddToCart(product, product.matched_unit_id ?? null)}
                                                className="h-8 gap-1 text-xs shrink-0 cursor-pointer"
                                            >
                                                <Plus className="h-3.5 w-3.5" />
                                                Tambah ke Keranjang
                                            </Button>
                                        )}
                                    </div>

                                    {is_promo_excluded ? (
                                        <p className="text-xs text-amber-600 dark:text-amber-400">
                                            Produk ini dikecualikan dari promo.
                                        </p>
                                    ) : !hasAnyOffer ? (
                                        <p className="text-xs text-muted-foreground">
                                            Tidak ada promo atau harga grosir aktif untuk produk ini saat ini.
                                        </p>
                                    ) : (
                                        <div className="space-y-2 pt-1 border-t">
                                            {promotions.length > 0 && (
                                                <div className="space-y-1.5">
                                                    <p className="text-[11px] font-semibold uppercase tracking-wide text-blue-600 dark:text-blue-400 flex items-center gap-1">
                                                        <Sparkles className="h-3 w-3" />
                                                        Promo Aktif ({promotions.length})
                                                    </p>
                                                    <div className="space-y-1.5">
                                                        {promotions.map((promo) => (
                                                            <div
                                                                key={promo.id}
                                                                className="rounded-md border border-blue-200/80 bg-blue-50/50 dark:border-blue-900 dark:bg-blue-950/30 px-3 py-2 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between"
                                                            >
                                                                <div className="min-w-0">
                                                                    <div className="flex flex-wrap items-center gap-1.5">
                                                                        <span className="text-xs font-semibold text-foreground">
                                                                            {promo.name}
                                                                        </span>
                                                                        <Badge variant="outline" className="text-[10px]">
                                                                            {promo.type_label}
                                                                        </Badge>
                                                                        {promo.member_only && (
                                                                            <Badge variant="secondary" className="text-[10px]">
                                                                                Khusus Member
                                                                            </Badge>
                                                                        )}
                                                                    </div>
                                                                    {(promo.start_date || promo.end_date) && (
                                                                        <p className="text-[11px] text-muted-foreground mt-0.5">
                                                                            Periode: {promo.start_date ?? '-'} s/d {promo.end_date ?? '-'}
                                                                        </p>
                                                                    )}
                                                                </div>
                                                                <span className="font-mono text-xs font-semibold text-blue-700 dark:text-blue-300 shrink-0">
                                                                    {formatPromoDetail(promo)}
                                                                </span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}

                                            {price_tiers.length > 0 && (
                                                <div className="space-y-1.5">
                                                    <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                                                        <Tag className="h-3 w-3" />
                                                        Harga Grosir ({price_tiers.length})
                                                    </p>
                                                    <div className="flex flex-wrap gap-1.5">
                                                        {price_tiers.map((tier) => (
                                                            <Badge
                                                                key={tier.id}
                                                                variant="outline"
                                                                className="font-mono text-xs border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300"
                                                            >
                                                                Min. {tier.min_qty} {tier.unit_name}: {formatRupiah(tier.unit_price)}
                                                            </Badge>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )
                        })
                    )}
                </div>

                <DialogFooter className="p-6 pt-4 border-t shrink-0 flex items-center justify-end gap-2 bg-muted/20">
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                        className="cursor-pointer"
                    >
                        Tutup (Esc)
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

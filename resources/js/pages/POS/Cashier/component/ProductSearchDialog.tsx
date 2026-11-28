import React, { useEffect, useRef, useState } from 'react'
import { Loader2, Package, Plus, Search, X } from 'lucide-react'
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
import cashier from '@/routes/pos/cashier'
import type { PosLookupProduct } from '@/types'
import { formatRupiah } from './posUtils'

interface ProductSearchDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    onSelectProduct: (product: PosLookupProduct, unitId: number | null) => void
}

export function ProductSearchDialog({
    open,
    onOpenChange,
    onSelectProduct,
}: ProductSearchDialogProps) {
    const [query, setQuery] = useState('')
    const [results, setResults] = useState<PosLookupProduct[]>([])
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
                const url = `${cashier.lookup.url()}?q=${encodeURIComponent(trimmed)}&limit=20`
                const res = await fetch(url, {
                    headers: { Accept: 'application/json' },
                    signal: controller.signal,
                })
                if (res.ok) {
                    const data = (await res.json()) as { products: PosLookupProduct[] }
                    setResults(data.products ?? [])
                }
            } catch {
                // Ignore abort error
            } finally {
                setIsLoading(false)
            }
        }, 250)

        return () => {
            window.clearTimeout(timer)
            controller.abort()
        }
    }, [query, open])

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="w-[calc(100%-2rem)] sm:max-w-3xl max-h-[85vh] flex flex-col p-0 gap-0 overflow-hidden">
                <DialogHeader className="p-6 pb-4 border-b shrink-0">
                    <DialogTitle>Cari Produk (F2)</DialogTitle>
                    <DialogDescription>
                        Cari berdasarkan nama produk, barcode utama, atau barcode satuan multi-UOM.
                    </DialogDescription>
                </DialogHeader>

                <div className="px-6 pt-4 pb-3 border-b shrink-0">
                    <div className="relative">
                        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                            ref={inputRef}
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder="Ketik nama produk atau barcode..."
                            className="h-10 pl-9 pr-9"
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
                                    title="Bersihkan pencarian"
                                >
                                    <X className="h-4 w-4" />
                                </button>
                            )
                        )}
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto overflow-x-hidden p-6 space-y-2.5">
                    {!query.trim() ? (
                        <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
                            <Package className="h-10 w-10 mb-2 opacity-40" />
                            <p className="text-sm font-medium">Ketik kata kunci untuk mencari produk aktif</p>
                            <p className="text-xs mt-1">Tekan Esc untuk menutup jendela ini.</p>
                        </div>
                    ) : results.length === 0 && !isLoading ? (
                        <div className="py-12 text-center text-sm text-muted-foreground">
                            Tidak ada produk aktif yang cocok dengan &ldquo;{query}&rdquo;.
                        </div>
                    ) : (
                        results.map((product) => {
                            const outOfStock = product.stock <= 0
                            return (
                                <div
                                    key={product.id}
                                    className="flex flex-col gap-3 rounded-lg border bg-card p-3.5 md:flex-row md:items-center md:justify-between hover:border-primary/40 transition-colors"
                                >
                                    <div className="min-w-0 flex-1 space-y-1">
                                        <div className="flex flex-wrap items-start gap-2">
                                            <span className="font-semibold text-sm text-foreground break-words leading-snug">
                                                {product.name}
                                            </span>
                                            <Badge
                                                variant={outOfStock ? 'destructive' : 'secondary'}
                                                className="font-mono text-[11px] shrink-0"
                                            >
                                                Stok: {product.stock} {product.base_unit}
                                            </Badge>
                                        </div>
                                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                                            <span className="font-mono break-all">{product.barcode}</span>
                                            <span className="font-mono font-semibold text-foreground whitespace-nowrap">
                                                {formatRupiah(product.sell_price)} / {product.base_unit}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="flex flex-wrap items-center gap-1.5 md:justify-end md:max-w-[48%] shrink-0">
                                        <Button
                                            type="button"
                                            size="sm"
                                            disabled={outOfStock}
                                            onClick={() => {
                                                onSelectProduct(product, null)
                                                onOpenChange(false)
                                            }}
                                            className="h-8 gap-1 text-xs cursor-pointer whitespace-nowrap"
                                        >
                                            <Plus className="h-3.5 w-3.5 shrink-0" />
                                            {product.base_unit}
                                        </Button>

                                        {product.units.map((unit) => (
                                            <Button
                                                key={unit.id}
                                                type="button"
                                                size="sm"
                                                variant="outline"
                                                disabled={product.stock < unit.conversion_factor}
                                                onClick={() => {
                                                    onSelectProduct(product, unit.id)
                                                    onOpenChange(false)
                                                }}
                                                className="h-8 gap-1 text-xs cursor-pointer whitespace-nowrap"
                                                title={`Isi ${unit.conversion_factor} ${product.base_unit} — ${formatRupiah(unit.sell_price)}`}
                                            >
                                                <Plus className="h-3.5 w-3.5 shrink-0" />
                                                {unit.unit_name} ({formatRupiah(unit.sell_price)})
                                            </Button>
                                        ))}
                                    </div>
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

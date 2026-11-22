import React from 'react'
import { Button } from '@/components/ui/button'
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { History, ImageIcon, ExternalLink, Package, ArrowRight, ShoppingBag, CheckCircle2, Ban, CreditCard } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ActivityRow } from '../Index'

const fieldLabels: Record<string, string> = {
    name: 'Nama',
    email: 'Email',
    phone: 'No. HP',
    role: 'Role',
    is_active: 'Status Aktif',
    barcode: 'Barcode',
    category_id: 'Kategori Produk',
    buy_price: 'Harga Beli (HPP)',
    sell_price: 'Harga Jual',
    stock: 'Stok',
    min_stock: 'Minimum Stok',
    image: 'Foto Produk',
    code: 'Kode Kategori',
    slug: 'Slug',
    description: 'Deskripsi',
}

const formatRupiah = (val: number | string | undefined | null) => {
    const num = Number(val) || 0
    return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0,
    }).format(num)
}

const formatDiffValue = (key: string, val: any, categoryMap?: Record<string | number, string>) => {
    if (val === undefined || val === null || val === '') return '-'
    if (key === 'category_id') {
        const catName = categoryMap?.[val]
        return catName ? `${catName} (#${val})` : `Kategori #${val}`
    }
    if (key === 'image') {
        const filename = String(val).split('/').pop()
        return val ? `File: ${filename}` : 'Tidak ada foto'
    }
    if (key === 'buy_price' || key === 'sell_price') {
        const num = Number(val)
        if (!isNaN(num)) {
            return new Intl.NumberFormat('id-ID', {
                style: 'currency',
                currency: 'IDR',
                minimumFractionDigits: 0,
            }).format(num)
        }
    }
    if (key === 'is_active' || key === 'active') {
        return val ? 'Aktif' : 'Nonaktif'
    }
    if (typeof val === 'boolean') {
        return val ? 'Ya' : 'Tidak'
    }
    return String(val)
}

const getImageUrl = (path: any): string | null => {
    if (!path || typeof path !== 'string') return null
    if (path.startsWith('http://') || path.startsWith('https://') || path.startsWith('/')) {
        return path
    }
    return `/storage/${path}`
}

function ImagePreviewDiff({ val, label, isNew = false }: { val: any; label: string; isNew?: boolean }) {
    const [hasError, setHasError] = React.useState(false)
    const url = getImageUrl(val)

    if (!val || !url) {
        return (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground italic py-1">
                <ImageIcon className="h-4 w-4 text-muted-foreground/60" />
                <span>Tidak ada foto</span>
            </div>
        )
    }

    const filename = String(val).split('/').pop() || 'foto.jpg'

    return (
        <div className="flex items-start gap-2.5 py-1">
            <a
                href={url}
                target="_blank"
                rel="noreferrer"
                title="Buka ukuran penuh di tab baru"
                className={cn(
                    'group relative block h-14 w-14 shrink-0 overflow-hidden rounded-md border bg-muted/30 shadow-xs hover:ring-2 transition-all',
                    isNew ? 'border-primary/50 hover:ring-primary' : 'border-border hover:ring-muted-foreground/40'
                )}
            >
                {!hasError ? (
                    <img
                        src={url}
                        alt={label}
                        className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-105"
                        onError={() => setHasError(true)}
                    />
                ) : (
                    <div className="flex h-full w-full flex-col items-center justify-center bg-muted/60 p-1 text-center text-[9px] text-muted-foreground">
                        <ImageIcon className="h-3.5 w-3.5 mb-0.5 opacity-40" />
                        <span className="leading-tight">Tidak tersedia</span>
                    </div>
                )}
                {!hasError && (
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-white">
                        <ExternalLink className="h-3.5 w-3.5 drop-shadow" />
                    </div>
                )}
            </a>
            <div className="flex flex-col text-xs min-w-0">
                <span className="font-mono text-xs font-medium text-foreground truncate max-w-[170px]" title={filename}>
                    {filename}
                </span>
                <span className="text-[10px] text-muted-foreground mt-0.5">
                    {label}
                </span>
                {!hasError && (
                    <a
                        href={url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline font-medium mt-1"
                    >
                        <ExternalLink className="h-3 w-3" />
                        Buka Foto
                    </a>
                )}
            </div>
        </div>
    )
}

interface ActivityLogDetailDialogProps {
    activity: ActivityRow | null
    categoryMap?: Record<string | number, string>
    open: boolean
    onOpenChange: (open: boolean) => void
}

export default function ActivityLogDetailDialog({
    activity,
    categoryMap,
    open,
    onOpenChange,
}: ActivityLogDetailDialogProps) {
    if (!activity) return null

    const changes = activity.attribute_changes || {}
    const properties = activity.properties || {}
    const oldData = changes.old || properties.old || {}
    const newData = changes.attributes || properties.attributes || {}
    const allKeys = Array.from(new Set([...Object.keys(oldData), ...Object.keys(newData)]))

    const renderGoodsReceived = (props: Record<string, any>) => {
        const receivedItems = Array.isArray(props.received_items) ? props.received_items : []

        return (
            <div className="space-y-4">
                {/* Header Ringkasan Penerimaan */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs p-3 rounded-lg border bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/40">
                    <div>
                        <span className="text-muted-foreground block text-[11px]">No. PO:</span>
                        <p className="font-mono font-bold text-foreground text-sm mt-0.5">{props.po_number || '-'}</p>
                    </div>
                    <div>
                        <span className="text-muted-foreground block text-[11px]">Status Dokumen:</span>
                        <Badge variant="outline" className="mt-1 bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-300">
                            {props.status === 'received' ? 'Selesai / Diterima Penuh' : 'Diterima Sebagian'}
                        </Badge>
                    </div>
                    <div>
                        <span className="text-muted-foreground block text-[11px]">Waktu Penerimaan:</span>
                        <p className="font-mono text-muted-foreground mt-0.5">{props.received_at || '-'}</p>
                    </div>
                    <div>
                        <span className="text-muted-foreground block text-[11px]">Diterima Oleh:</span>
                        <p className="font-medium text-foreground mt-0.5">{props.received_by || '-'}</p>
                    </div>
                </div>

                {/* Tabel Rincian Barang yang Diterima */}
                {receivedItems.length > 0 && (
                    <div className="space-y-2">
                        <span className="font-semibold text-xs text-foreground flex items-center gap-1.5">
                            <Package className="h-3.5 w-3.5 text-primary" />
                            Rincian Barang Diterima & Penyesuaian Harga Beli (Weighted Average):
                        </span>
                        <div className="overflow-x-auto rounded-md border">
                            <table className="w-full text-xs text-left">
                                <thead className="bg-muted text-muted-foreground font-semibold border-b">
                                    <tr>
                                        <th className="p-2.5 min-w-[160px]">Produk & Barcode</th>
                                        <th className="p-2.5 text-center min-w-[110px]">Diterima Kali Ini</th>
                                        <th className="p-2.5 text-center min-w-[120px]">Akumulasi / Total</th>
                                        <th className="p-2.5 min-w-[120px]">Perubahan Stok</th>
                                        <th className="p-2.5 min-w-[200px]">Harga Beli Lama ➔ Weighted Baru</th>
                                        <th className="p-2.5 min-w-[100px]">Expired Date</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y font-mono">
                                    {receivedItems.map((item: any, idx: number) => (
                                        <tr key={idx} className="hover:bg-muted/40">
                                            <td className="p-2.5 font-sans">
                                                <div className="font-medium text-foreground">{item.product_name || '-'}</div>
                                                <div className="text-[11px] text-muted-foreground font-mono">{item.barcode || '-'}</div>
                                            </td>
                                            <td className="p-2.5 text-center">
                                                <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-300 font-bold text-[11px]">
                                                    +{item.quantity_received_now} unit
                                                </Badge>
                                            </td>
                                            <td className="p-2.5 text-center text-xs text-muted-foreground">
                                                <strong className="text-foreground">{item.total_quantity_received}</strong> / {item.quantity_ordered} unit
                                            </td>
                                            <td className="p-2.5 text-xs text-muted-foreground">
                                                <span>{item.old_stock}</span>
                                                <span className="mx-1 text-primary">➔</span>
                                                <strong className="text-foreground">{item.new_stock}</strong>
                                            </td>
                                            <td className="p-2.5 text-xs">
                                                <span className="line-through text-muted-foreground mr-1">
                                                    {formatRupiah(item.old_buy_price)}
                                                </span>
                                                <span className="mx-1 text-primary">➔</span>
                                                <strong className="text-emerald-600 dark:text-emerald-400 font-bold">
                                                    {formatRupiah(item.new_weighted_buy_price)}
                                                </strong>
                                            </td>
                                            <td className="p-2.5 text-[11px] text-muted-foreground">
                                                {item.expired_date || '-'}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>
        )
    }

    const renderPaymentStatusUpdated = (props: Record<string, any>) => (
        <div className="p-4 rounded-lg border bg-muted/30 space-y-3">
            <div className="flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-primary" />
                <span className="font-semibold text-xs">Pembaruan Status Pembayaran PO</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                    <span className="text-muted-foreground block text-[11px]">No. PO:</span>
                    <span className="font-mono font-bold">{props.po_number || '-'}</span>
                </div>
                <div>
                    <span className="text-muted-foreground block text-[11px]">Perubahan Status:</span>
                    <div className="flex items-center gap-2 mt-1">
                        <Badge variant="outline">{props.old_payment_status || '-'}</Badge>
                        <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                        <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                            {props.new_payment_status || '-'}
                        </Badge>
                    </div>
                </div>
            </div>
        </div>
    )

    const renderClosedRemaining = (props: Record<string, any>) => (
        <div className="p-4 rounded-lg border bg-amber-50/50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800/40 space-y-3 text-xs">
            <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-amber-600" />
                <span className="font-semibold text-foreground">Sisa Pesanan PO Ditutup (Selesai Lebih Awal)</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                    <span className="text-muted-foreground block text-[11px]">No. PO:</span>
                    <span className="font-mono font-bold">{props.po_number || '-'}</span>
                </div>
                <div>
                    <span className="text-muted-foreground block text-[11px]">Penyesuaian Total Tagihan:</span>
                    <span className="font-mono font-bold text-primary">{formatRupiah(props.adjusted_total_amount)}</span>
                </div>
                <div>
                    <span className="text-muted-foreground block text-[11px]">Perubahan Status:</span>
                    <span>{props.previous_status} ➔ <strong>{props.new_status}</strong></span>
                </div>
            </div>
            {props.reason && (
                <div className="pt-2 border-t border-amber-200/60 dark:border-amber-800/40">
                    <span className="text-muted-foreground block text-[11px]">Alasan Penutupan:</span>
                    <p className="mt-0.5 text-foreground italic">{props.reason}</p>
                </div>
            )}
        </div>
    )

    const renderCancelled = (props: Record<string, any>) => (
        <div className="p-4 rounded-lg border bg-rose-50/50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-800/40 space-y-3 text-xs">
            <div className="flex items-center gap-2">
                <Ban className="h-4 w-4 text-destructive" />
                <span className="font-semibold text-foreground">Purchase Order Dibatalkan</span>
            </div>
            <div>
                <span className="text-muted-foreground block text-[11px]">No. PO:</span>
                <span className="font-mono font-bold">{props.po_number || '-'}</span>
            </div>
            {props.reason && (
                <div className="pt-2 border-t border-rose-200/60 dark:border-rose-800/40">
                    <span className="text-muted-foreground block text-[11px]">Alasan Pembatalan:</span>
                    <p className="mt-0.5 text-foreground italic">{props.reason}</p>
                </div>
            )}
        </div>
    )

    const renderPOCreated = (props: Record<string, any>) => (
        <div className="p-4 rounded-lg border bg-muted/30 space-y-3 text-xs">
            <div className="flex items-center gap-2">
                <ShoppingBag className="h-4 w-4 text-primary" />
                <span className="font-semibold text-foreground">Pembuatan Purchase Order Baru</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                    <span className="text-muted-foreground block text-[11px]">No. PO:</span>
                    <span className="font-mono font-bold">{props.po_number || '-'}</span>
                </div>
                <div>
                    <span className="text-muted-foreground block text-[11px]">Status Awal:</span>
                    <Badge variant="outline" className="mt-0.5">{props.status || 'draft'}</Badge>
                </div>
                <div>
                    <span className="text-muted-foreground block text-[11px]">Total Nilai PO:</span>
                    <span className="font-mono font-bold text-primary">{formatRupiah(props.total_amount)}</span>
                </div>
                <div>
                    <span className="text-muted-foreground block text-[11px]">Jumlah Item:</span>
                    <span className="font-mono">{props.items_count ?? '-'} item</span>
                </div>
            </div>
        </div>
    )

    const renderPropertiesDiff = () => {
        // 1. Cek event khusus Purchase Order
        if (properties.event === 'goods_received' || Array.isArray(properties.received_items)) {
            return renderGoodsReceived(properties)
        }
        if (properties.event === 'payment_status_updated') {
            return renderPaymentStatusUpdated(properties)
        }
        if (properties.event === 'closed_remaining') {
            return renderClosedRemaining(properties)
        }
        if (properties.event === 'cancelled') {
            return renderCancelled(properties)
        }
        if (properties.event === 'created' && properties.po_number) {
            return renderPOCreated(properties)
        }

        // 2. Render perubahan atribut Model (Old vs New)
        if (allKeys.length > 0) {
            return (
                <div className="overflow-x-auto rounded-md border">
                    <table className="w-full text-xs text-left">
                        <thead className="bg-muted text-muted-foreground font-semibold border-b">
                            <tr>
                                <th className="p-3 w-[24%] min-w-[140px]">Field / Kolom</th>
                                <th className="p-3 w-[38%] min-w-[220px]">Nilai Sebelumnya (Old)</th>
                                <th className="p-3 w-[38%] min-w-[220px]">Nilai Sesudahnya (New)</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            {allKeys.map((key) => {
                                const oldVal = oldData[key]
                                const newVal = newData[key]
                                const isChanged = oldVal !== newVal
                                const friendlyLabel = fieldLabels[key] || key

                                return (
                                    <tr key={key} className={isChanged ? 'bg-amber-500/5 dark:bg-amber-500/10' : ''}>
                                        <td className="p-3 font-medium text-foreground align-top">
                                            <div>
                                                <span>{friendlyLabel}</span>
                                                {fieldLabels[key] && (
                                                    <span className="block text-[10px] font-mono text-muted-foreground">
                                                        {key}
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="p-3 font-mono text-muted-foreground align-top">
                                            {key === 'image' ? (
                                                <ImagePreviewDiff val={oldVal} label="Foto Sebelumnya" />
                                            ) : (
                                                formatDiffValue(key, oldVal, activity.category_map || categoryMap)
                                            )}
                                        </td>
                                        <td className="p-3 font-mono font-medium text-foreground align-top">
                                            {key === 'image' ? (
                                                <ImagePreviewDiff val={newVal} label="Foto Sesudahnya" isNew />
                                            ) : isChanged ? (
                                                <span className="text-primary font-semibold">
                                                    {formatDiffValue(key, newVal, activity.category_map || categoryMap)}
                                                </span>
                                            ) : (
                                                <span>{formatDiffValue(key, newVal, activity.category_map || categoryMap)}</span>
                                            )}
                                        </td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                </div>
            )
        }

        // 3. Fallback jika ada properties lain
        const remainingProps: Record<string, any> = { ...properties }
        delete remainingProps.old
        delete remainingProps.attributes

        const remainingKeys = Object.keys(remainingProps)
        if (remainingKeys.length > 0) {
            // Jika semua bernilai primitif, render grid rapi
            const isAllPrimitive = remainingKeys.every(
                (k) => typeof remainingProps[k] !== 'object' || remainingProps[k] === null
            )

            if (isAllPrimitive) {
                return (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 rounded-lg border bg-muted/30 text-xs">
                        {remainingKeys.map((k) => (
                            <div key={k}>
                                <span className="text-muted-foreground block text-[11px]">
                                    {fieldLabels[k] || k}:
                                </span>
                                <span className="font-mono font-medium text-foreground">
                                    {String(remainingProps[k] ?? '-')}
                                </span>
                            </div>
                        ))}
                    </div>
                )
            }

            return (
                <pre className="rounded-md bg-muted p-3 text-xs font-mono overflow-x-auto max-h-60">
                    {JSON.stringify(remainingProps, null, 2)}
                </pre>
            )
        }

        return (
            <p className="text-sm text-muted-foreground py-4 text-center">
                Tidak ada perubahan atribut data yang dicatat.
            </p>
        )
    }

    const isCustomEvent = Boolean(properties.event || properties.received_items)
    const sectionTitle = isCustomEvent
        ? 'Detail Rincian Aktivitas / Transaksi:'
        : allKeys.length > 0
        ? 'Perubahan Atribut (Old vs New):'
        : 'Data / Properti Tambahan:'

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-2xl md:max-w-3xl lg:max-w-4xl max-h-[85vh] flex flex-col p-0 overflow-hidden">
                <DialogHeader className="px-6 pt-5 pb-4 border-b shrink-0">
                    <DialogTitle className="flex items-center gap-2">
                        <History className="h-5 w-5 text-primary" />
                        Detail Log Aktivitas #{activity.id}
                    </DialogTitle>
                    <DialogDescription className="text-xs">
                        Informasi detail dan riwayat perubahan data pada sistem.
                    </DialogDescription>
                </DialogHeader>

                <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs p-3.5 rounded-lg bg-muted/50 border">
                        <div>
                            <span className="text-muted-foreground block text-[11px]">Waktu:</span>
                            <p className="font-medium font-mono mt-0.5">{activity.created_at}</p>
                        </div>
                        <div>
                            <span className="text-muted-foreground block text-[11px]">Pengguna:</span>
                            <p className="font-medium mt-0.5">
                                {activity.causer_name} ({activity.causer_role ?? 'Sistem'})
                            </p>
                        </div>
                        <div>
                            <span className="text-muted-foreground block text-[11px]">Kategori Log:</span>
                            <p className="font-medium mt-0.5">{activity.log_name_label ?? activity.log_name}</p>
                        </div>
                        <div>
                            <span className="text-muted-foreground block text-[11px]">Objek / Modul:</span>
                            <p className="font-medium font-mono mt-0.5">
                                {activity.subject_type ?? '-'} {activity.subject_id ? `#${activity.subject_id}` : ''}
                            </p>
                        </div>
                    </div>

                    <div>
                        <h4 className="text-xs font-semibold mb-2">Deskripsi:</h4>
                        <p className="text-sm p-2.5 rounded-md border bg-background font-medium">
                            {activity.description}
                        </p>
                    </div>

                    <div>
                        <h4 className="text-xs font-semibold mb-2">{sectionTitle}</h4>
                        {renderPropertiesDiff()}
                    </div>
                </div>

                <DialogFooter className="px-6 py-3 border-t bg-muted/20 shrink-0">
                    <DialogClose render={<Button variant="outline" size="sm">Tutup</Button>} />
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

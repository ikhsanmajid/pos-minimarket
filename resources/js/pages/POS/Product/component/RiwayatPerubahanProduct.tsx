import React, { useMemo, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
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
import { DataTable, type DataTableColumn } from '@/components/dataTable'
import DataTablePagination, { type PaginationMeta } from '@/components/dataTablePagination'
import { History, Eye, RefreshCw, Loader2, ArrowRight, ImageIcon, ExternalLink } from 'lucide-react'
import { cn } from '@/lib/utils'
import ProductController from '@/actions/App/Http/Controllers/ProductController'
import type { DetailProductData } from '../DetailProduct'

export type ProductActivity = {
    id: number
    description: string
    event: string | null
    causer_name: string
    causer_role: string | null
    attribute_changes?: {
        old?: Record<string, any>
        attributes?: Record<string, any>
        [key: string]: any
    } | null
    properties?: Record<string, any> | null
    category_map?: Record<string | number, string> | null
    created_at: string
    created_at_human: string
}

export interface PaginatedProductActivities extends PaginationMeta {
    data: ProductActivity[]
    category_map?: Record<string | number, string>
}

interface RiwayatPerubahanProductProps {
    product: DetailProductData
    activities?: PaginatedProductActivities
    isLoading?: boolean
    onRefresh?: () => void
}

const fieldLabels: Record<string, string> = {
    name: 'Nama Produk',
    barcode: 'Barcode',
    category_id: 'Kategori Produk',
    base_unit: 'Satuan Dasar',
    buy_price: 'Harga Beli (HPP)',
    sell_price: 'Harga Jual',
    min_stock: 'Minimum Stok',
    active: 'Status Aktif',
    is_tax_exempt: 'Status PPN',
    is_donation: 'Produk Donasi',
    image: 'Foto Produk',
}

const eventConfig: Record<string, { label: string; className: string }> = {
    created: {
        label: 'Dibuat',
        className: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
    },
    updated: {
        label: 'Diperbarui',
        className: 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 border-blue-200 dark:border-blue-800',
    },
    deleted: {
        label: 'Dihapus',
        className: 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 border-rose-200 dark:border-rose-800',
    },
}

const formatValue = (key: string, val: any, categoryMap?: Record<string | number, string> | null) => {
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
    if (key === 'active') {
        return val ? 'Aktif (Dijual)' : 'Nonaktif'
    }
    if (key === 'is_tax_exempt') {
        return val ? 'Bebas PPN' : 'Kena PPN'
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
    const [hasError, setHasError] = useState(false)
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

export function RiwayatPerubahanProduct({
    product,
    activities,
    isLoading = false,
    onRefresh,
}: RiwayatPerubahanProductProps) {
    const [selectedActivity, setSelectedActivity] = useState<ProductActivity | null>(null)

    const columns: DataTableColumn<ProductActivity>[] = useMemo(
        () => [
            {
                id: 'no',
                header: 'No',
                cell: (info) => {
                    const from = activities?.from ?? 1
                    return (
                        <span className="font-mono text-xs text-muted-foreground">
                            {from + info.row.index}
                        </span>
                    )
                },
                size: 6,
            },
            {
                accessorKey: 'created_at',
                header: 'Waktu',
                cell: (info) => {
                    const row = info.row.original
                    return (
                        <div className="flex flex-col py-0.5">
                            <span className="font-mono text-xs font-medium text-foreground">{row.created_at}</span>
                            <span className="text-[11px] text-muted-foreground">{row.created_at_human}</span>
                        </div>
                    )
                },
                size: 20,
            },
            {
                accessorKey: 'causer_name',
                header: 'Pengguna',
                cell: (info) => {
                    const row = info.row.original
                    return (
                        <div className="flex flex-col py-0.5">
                            <span className="text-xs font-medium text-foreground">{row.causer_name}</span>
                            {row.causer_role && (
                                <span className="text-[11px] text-muted-foreground">{row.causer_role}</span>
                            )}
                        </div>
                    )
                },
                size: 18,
            },
            {
                accessorKey: 'event',
                header: 'Event',
                cell: (info) => {
                    const row = info.row.original
                    const evtKey = row.event ?? 'updated'
                    const eventBadge = eventConfig[evtKey] || {
                        label: row.event ? row.event.toUpperCase() : 'AKTIVITAS',
                        className: 'bg-muted text-muted-foreground',
                    }
                    return (
                        <Badge variant="outline" className={`text-[11px] font-medium ${eventBadge.className}`}>
                            {eventBadge.label}
                        </Badge>
                    )
                },
                size: 14,
            },
            {
                id: 'changes_summary',
                header: 'Atribut Diubah',
                cell: (info) => {
                    const row = info.row.original
                    const changes = row.attribute_changes || {}
                    const properties = row.properties || {}
                    const oldData = changes.old || properties.old || {}
                    const newData = changes.attributes || properties.attributes || {}
                    const allKeys = Array.from(new Set([...Object.keys(oldData), ...Object.keys(newData)])).filter(
                        (key) => key !== 'stock'
                    )

                    if (row.event === 'created') {
                        return (
                            <Badge variant="secondary" className="text-[11px] font-normal">
                                Data baru dibuat ({allKeys.length} atribut)
                            </Badge>
                        )
                    }

                    if (allKeys.length === 0) {
                        return <span className="text-xs text-muted-foreground">-</span>
                    }

                    return (
                        <div className="flex flex-wrap items-center gap-1 py-0.5">
                            {allKeys.slice(0, 3).map((key) => {
                                let label = fieldLabels[key] || key
                                if (key === 'category_id') {
                                    const catMap = row.category_map || activities?.category_map
                                    const newCat = catMap?.[newData[key]] || catMap?.[oldData[key]]
                                    if (newCat) {
                                        label = `Kategori: ${newCat}`
                                    }
                                }
                                return (
                                    <Badge key={key} variant="outline" className="text-[10px] font-normal py-0">
                                        {label}
                                    </Badge>
                                )
                            })}
                            {allKeys.length > 3 && (
                                <span className="text-[10px] text-muted-foreground font-medium">
                                    +{allKeys.length - 3} lainnya
                                </span>
                            )}
                        </div>
                    )
                },
                size: 30,
            },
            {
                id: 'actions',
                header: 'Detail',
                cell: (info) => {
                    const row = info.row.original
                    return (
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setSelectedActivity(row)}
                            className="h-8 gap-1 text-xs text-muted-foreground hover:text-foreground"
                        >
                            <Eye className="h-3.5 w-3.5" />
                            Detail
                        </Button>
                    )
                },
                size: 12,
            },
        ],
        [activities?.from]
    )

    const renderDiffContent = (activity: ProductActivity) => {
        const changes = activity.attribute_changes || {}
        const properties = activity.properties || {}
        const oldData = changes.old || properties.old || {}
        const newData = changes.attributes || properties.attributes || {}
        const allKeys = Array.from(new Set([...Object.keys(oldData), ...Object.keys(newData)])).filter(
            (key) => key !== 'stock'
        )

        if (allKeys.length > 0) {
            return (
                <div className="overflow-x-auto rounded-md border">
                    <table className="w-full min-w-[560px] table-fixed text-xs text-left">
                        <thead className="bg-muted/70 text-muted-foreground font-semibold border-b">
                            <tr>
                                <th className="p-3 w-[24%]">Atribut / Kolom</th>
                                <th className="p-3 w-[38%]">Nilai Sebelumnya (Old)</th>
                                <th className="p-3 w-[38%]">Nilai Sesudahnya (New)</th>
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
                                                formatValue(key, oldVal, activity.category_map || activities?.category_map)
                                            )}
                                        </td>
                                        <td className="p-3 font-mono font-medium text-foreground align-top">
                                            {key === 'image' ? (
                                                <ImagePreviewDiff val={newVal} label="Foto Sesudahnya" isNew />
                                            ) : isChanged ? (
                                                <span className="text-primary font-semibold">
                                                    {formatValue(key, newVal, activity.category_map || activities?.category_map)}
                                                </span>
                                            ) : (
                                                <span>{formatValue(key, newVal, activity.category_map || activities?.category_map)}</span>
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

        return (
            <p className="text-xs text-muted-foreground italic py-3 text-center">
                Tidak ada perubahan atribut data yang dicatat.
            </p>
        )
    }

    // State saat data belum di-load sama sekali (awal buka tab)
    if (!activities && isLoading) {
        return (
            <div className="flex min-h-[220px] flex-col items-center justify-center rounded-lg border border-dashed p-8 text-center bg-card">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <h3 className="mt-4 text-sm font-semibold text-foreground">Memuat riwayat perubahan…</h3>
                <p className="mt-1 text-xs text-muted-foreground">
                    Sedang mengambil data log audit untuk produk {product.name}.
                </p>
            </div>
        )
    }

    return (
        <div className="space-y-4">
            {/* Toolbar Header */}
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h3 className="text-base font-semibold text-foreground">Riwayat Perubahan Data</h3>
                    <p className="text-xs text-muted-foreground">
                        {activities
                            ? `Menampilkan catatan perubahan data produk (Total ${activities.total} log).`
                            : `Audit log perubahan data untuk produk ${product.name}.`}
                    </p>
                </div>
                {onRefresh && (
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={onRefresh}
                        disabled={isLoading}
                        className="h-8 gap-1.5 text-xs text-muted-foreground hover:text-foreground"
                    >
                        <RefreshCw className={cn('h-3.5 w-3.5', isLoading && 'animate-spin')} />
                        Muat Ulang
                    </Button>
                )}
            </div>

            {/* DataTable */}
            <DataTable
                columns={columns}
                data={activities?.data ?? []}
                tableKey={`product-activities-${product.id}`}
                emptyMessage="Belum ada riwayat perubahan data untuk produk ini."
                isLoading={isLoading}
            />

            {/* Pagination */}
            {activities && (
                <DataTablePagination
                    meta={activities}
                    routeUrl={(opts) => ProductController.show(product.id, opts)}
                    only={['activities']}
                    isLoading={isLoading}
                />
            )}

            {/* Modal Detail Perubahan */}
            <Dialog open={!!selectedActivity} onOpenChange={(open) => !open && setSelectedActivity(null)}>
                <DialogContent className="sm:max-w-2xl md:max-w-3xl lg:max-w-4xl max-h-[85vh] flex flex-col p-0 overflow-hidden">
                    <DialogHeader className="px-6 pt-5 pb-4 border-b shrink-0">
                        <DialogTitle className="flex items-center gap-2 text-base">
                            <History className="h-4 w-4 text-primary" />
                            Detail Perubahan Data #{selectedActivity?.id}
                        </DialogTitle>
                        <DialogDescription className="text-xs">
                            Rincian perbandingan data sebelum dan sesudah perubahan.
                        </DialogDescription>
                    </DialogHeader>

                    {selectedActivity && (
                        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs p-3.5 rounded-lg bg-muted/50 border">
                                <div>
                                    <span className="text-muted-foreground block text-[11px]">Waktu:</span>
                                    <p className="font-medium font-mono mt-0.5">{selectedActivity.created_at}</p>
                                </div>
                                <div>
                                    <span className="text-muted-foreground block text-[11px]">Pengguna:</span>
                                    <p className="font-medium mt-0.5">
                                        {selectedActivity.causer_name}
                                        {selectedActivity.causer_role && ` (${selectedActivity.causer_role})`}
                                    </p>
                                </div>
                                <div>
                                    <span className="text-muted-foreground block text-[11px]">Tipe Event:</span>
                                    <p className="font-medium capitalize mt-0.5">{selectedActivity.event ?? '-'}</p>
                                </div>
                                <div>
                                    <span className="text-muted-foreground block text-[11px]">Deskripsi:</span>
                                    <p className="font-medium mt-0.5">{selectedActivity.description}</p>
                                </div>
                            </div>

                            <div>
                                <h4 className="text-xs font-semibold mb-2">Perubahan Atribut (Old vs New):</h4>
                                {renderDiffContent(selectedActivity)}
                            </div>
                        </div>
                    )}

                    <DialogFooter className="px-6 py-3 border-t bg-muted/20 shrink-0">
                        <DialogClose render={<Button variant="outline" size="sm">Tutup</Button>} />
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}

export default RiwayatPerubahanProduct

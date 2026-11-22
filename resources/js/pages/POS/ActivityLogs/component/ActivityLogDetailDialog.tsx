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
import { History, ImageIcon, ExternalLink } from 'lucide-react'
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

    const renderPropertiesDiff = () => {
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

        const remainingProps: Record<string, any> = { ...properties }
        delete remainingProps.old
        delete remainingProps.attributes

        if (Object.keys(remainingProps).length > 0) {
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

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-2xl md:max-w-3xl lg:max-w-4xl max-h-[88vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <History className="h-5 w-5 text-primary" />
                        Detail Log Aktivitas #{activity.id}
                    </DialogTitle>
                    <DialogDescription>
                        Informasi detail dan riwayat perubahan data pada sistem.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 pt-2">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs p-3.5 rounded-lg bg-muted/50 border">
                        <div>
                            <span className="text-muted-foreground">Waktu:</span>
                            <p className="font-medium font-mono mt-0.5">{activity.created_at}</p>
                        </div>
                        <div>
                            <span className="text-muted-foreground">Pengguna:</span>
                            <p className="font-medium mt-0.5">
                                {activity.causer_name} ({activity.causer_role ?? 'Sistem'})
                            </p>
                        </div>
                        <div>
                            <span className="text-muted-foreground">Kategori Log:</span>
                            <p className="font-medium mt-0.5">{activity.log_name_label ?? activity.log_name}</p>
                        </div>
                        <div>
                            <span className="text-muted-foreground">Objek / Modul:</span>
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
                        <h4 className="text-xs font-semibold mb-2">Perubahan Atribut (Old vs New):</h4>
                        {renderPropertiesDiff()}
                    </div>
                </div>

                <DialogFooter>
                    <DialogClose render={<Button variant="outline">Tutup</Button>} />
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

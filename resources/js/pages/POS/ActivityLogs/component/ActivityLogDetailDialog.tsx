import React, { useMemo } from 'react'
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
import { History } from 'lucide-react'
import { cn } from '@/lib/utils'
import { eventBadgeClass, type ActivityRow } from '../ActivityLog'
import ActivityLogImagePreview from './ActivityLogImagePreview'
import {
    formatDiffValue,
    formatKeyToLabel,
    normalizeActivityData,
} from './activityLogDetailUtils'

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
    const normalized = useMemo(
        () => (activity ? normalizeActivityData(activity) : null),
        [activity]
    )

    if (!activity || !normalized) {
        return null
    }

    const resolvedCategoryMap = activity.category_map || categoryMap
    const { diffRows, tableCollections } = normalized
    const eventCls = activity.event ? eventBadgeClass[activity.event] ?? '' : ''

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-2xl md:max-w-3xl lg:max-w-4xl max-h-[85vh] flex flex-col p-0 overflow-hidden">
                <DialogHeader className="px-6 pt-5 pb-4 border-b shrink-0">
                    <DialogTitle className="flex items-center gap-2">
                        <History className="h-5 w-5 text-primary" />
                        <span>Detail Log Aktivitas #{activity.id}</span>
                        {activity.event && (
                            <Badge className={cn('text-[10px] uppercase font-bold px-1.5 py-0', eventCls)}>
                                {activity.event}
                            </Badge>
                        )}
                    </DialogTitle>
                    <DialogDescription className="text-xs">
                        Informasi detail dan riwayat perubahan data pada sistem.
                    </DialogDescription>
                </DialogHeader>

                <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
                    {/* Metadata Seragam */}
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

                    {/* Deskripsi Seragam */}
                    <div>
                        <h4 className="text-xs font-semibold mb-2">Deskripsi:</h4>
                        <p className="text-sm p-2.5 rounded-md border bg-background font-medium">
                            {activity.description}
                        </p>
                    </div>

                    {/* Detail Perubahan Data Seragam */}
                    <div className="space-y-4">
                        <h4 className="text-xs font-semibold">Detail Perubahan Data:</h4>

                        {diffRows.length > 0 ? (
                            <div className="overflow-x-auto rounded-md border">
                                <table className="w-full min-w-[560px] table-fixed text-xs text-left">
                                    <thead className="bg-muted text-muted-foreground font-semibold border-b">
                                        <tr>
                                            <th className="p-3 w-[24%]">Field / Kolom</th>
                                            <th className="p-3 w-[38%]">Nilai Sebelumnya (Old)</th>
                                            <th className="p-3 w-[38%]">Nilai Sesudahnya (New)</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y">
                                        {diffRows.map(({ key, oldVal, newVal, isChanged }) => (
                                            <tr
                                                key={key}
                                                className={isChanged ? 'bg-amber-500/5 dark:bg-amber-500/10' : ''}
                                            >
                                                <td className="p-3 font-medium text-foreground align-top">
                                                    <div>
                                                        <span>{formatKeyToLabel(key)}</span>
                                                        <span className="block text-[10px] font-mono text-muted-foreground">
                                                            {key}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="p-3 font-mono text-muted-foreground align-top">
                                                    {key === 'image' || key === 'store_logo' ? (
                                                        <ActivityLogImagePreview
                                                            key={`old-${String(oldVal ?? '')}`}
                                                            val={oldVal}
                                                            label={key === 'store_logo' ? 'Logo Sebelumnya' : 'Foto Sebelumnya'}
                                                        />
                                                    ) : (
                                                        formatDiffValue(key, oldVal, resolvedCategoryMap)
                                                    )}
                                                </td>
                                                <td className="p-3 font-mono font-medium text-foreground align-top">
                                                    {key === 'image' || key === 'store_logo' ? (
                                                        <ActivityLogImagePreview
                                                            key={`new-${String(newVal ?? '')}`}
                                                            val={newVal}
                                                            label={key === 'store_logo' ? 'Logo Sesudahnya' : 'Foto Sesudahnya'}
                                                            isNew
                                                        />
                                                    ) : isChanged ? (
                                                        <span className="text-primary font-semibold">
                                                            {formatDiffValue(key, newVal, resolvedCategoryMap)}
                                                        </span>
                                                    ) : (
                                                        <span>{formatDiffValue(key, newVal, resolvedCategoryMap)}</span>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ) : tableCollections.length === 0 ? (
                            <p className="text-sm text-muted-foreground py-4 text-center rounded-md border bg-muted/20">
                                Tidak ada perubahan atribut data yang dicatat.
                            </p>
                        ) : null}

                        {/* Tabel Rincian Item Generik */}
                        {tableCollections.map(({ key, rows }) => {
                            const allColKeys = Array.from(
                                new Set(rows.flatMap((row) => Object.keys(row)))
                            )
                            const hasProductName = allColKeys.includes('product_name')
                            const visibleColKeys = allColKeys.filter((colKey) => {
                                if (hasProductName && (colKey === 'item_id' || colKey === 'product_id')) {
                                    return false
                                }
                                return true
                            })

                            return (
                                <div key={key} className="space-y-2">
                                    <h5 className="text-xs font-semibold text-foreground">
                                        {formatKeyToLabel(key)} ({rows.length} baris):
                                    </h5>
                                    <div className="overflow-x-auto rounded-md border">
                                        <table className="w-full text-xs text-left">
                                            <thead className="bg-muted text-muted-foreground font-semibold border-b">
                                                <tr>
                                                    {visibleColKeys.map((colKey) => (
                                                        <th key={colKey} className="p-2.5 whitespace-nowrap">
                                                            {formatKeyToLabel(colKey)}
                                                        </th>
                                                    ))}
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y font-mono">
                                                {rows.map((row, idx) => (
                                                    <tr key={idx} className="hover:bg-muted/40">
                                                        {visibleColKeys.map((colKey) => (
                                                            <td
                                                                key={colKey}
                                                                className={cn(
                                                                    'p-2.5 whitespace-nowrap',
                                                                    colKey === 'product_name' || colKey === 'name'
                                                                        ? 'font-sans font-medium text-foreground'
                                                                        : 'text-foreground'
                                                                )}
                                                            >
                                                                {formatDiffValue(colKey, row[colKey], resolvedCategoryMap)}
                                                            </td>
                                                        ))}
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </div>

                <DialogFooter className="px-6 py-3 border-t bg-muted/20 shrink-0">
                    <DialogClose render={<Button variant="outline" size="sm">Tutup</Button>} />
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

import React, { useMemo, useState } from 'react'
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
import { History, Eye, RefreshCw, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import SupplierController from '@/actions/App/Http/Controllers/SupplierController'
import type { SupplierRow } from '../Supplier'

export type SupplierActivity = {
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
    created_at: string
    created_at_human: string
}

export interface PaginatedSupplierActivities extends PaginationMeta {
    data: SupplierActivity[]
}

interface RiwayatPerubahanSupplierProps {
    supplier: SupplierRow
    activities?: PaginatedSupplierActivities
    isLoading?: boolean
    onRefresh?: () => void
}

const fieldLabels: Record<string, string> = {
    name: 'Nama Supplier',
    code: 'Kode Supplier',
    contact_person: 'Kontak PIC',
    phone: 'Nomor Telepon',
    email: 'Email',
    address: 'Alamat',
    city: 'Kota',
    npwp: 'NPWP',
    payment_term_days: 'Tempo Pembayaran',
    bank_name: 'Nama Bank',
    bank_account_number: 'Nomor Rekening',
    bank_account_name: 'Rekening Atas Nama',
    is_active: 'Status Aktif',
    notes: 'Catatan',
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

const formatValue = (key: string, val: any) => {
    if (val === undefined || val === null || val === '') return '-'
    if (key === 'is_active') {
        return val ? 'Aktif' : 'Nonaktif'
    }
    if (key === 'payment_term_days') {
        const num = Number(val)
        return num > 0 ? `${num} Hari` : 'COD / Tunai'
    }
    if (typeof val === 'boolean') {
        return val ? 'Ya' : 'Tidak'
    }
    return String(val)
}

export function RiwayatPerubahanSupplier({
    supplier,
    activities,
    isLoading = false,
    onRefresh,
}: RiwayatPerubahanSupplierProps) {
    const [selectedActivity, setSelectedActivity] = useState<SupplierActivity | null>(null)

    const columns: DataTableColumn<SupplierActivity>[] = useMemo(
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
                        (k) => !['updated_at', 'created_at', 'id', 'deleted_at'].includes(k)
                    )

                    if (row.event === 'created') {
                        return (
                            <Badge variant="secondary" className="text-[11px] font-normal">
                                Supplier dibuat ({allKeys.length} atribut)
                            </Badge>
                        )
                    }

                    if (allKeys.length === 0) {
                        return <span className="text-xs text-muted-foreground">-</span>
                    }

                    return (
                        <div className="flex flex-wrap items-center gap-1 py-0.5">
                            {allKeys.slice(0, 3).map((key) => (
                                <Badge key={key} variant="outline" className="text-[10px] font-normal py-0">
                                    {fieldLabels[key] || key}
                                </Badge>
                            ))}
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

    const renderDiffContent = (activity: SupplierActivity) => {
        const changes = activity.attribute_changes || {}
        const properties = activity.properties || {}
        const oldData = changes.old || properties.old || {}
        const newData = changes.attributes || properties.attributes || {}
        const allKeys = Array.from(new Set([...Object.keys(oldData), ...Object.keys(newData)])).filter(
            (k) => !['updated_at', 'created_at', 'id', 'deleted_at'].includes(k)
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
                                            {formatValue(key, oldVal)}
                                        </td>
                                        <td className="p-3 font-mono font-medium text-foreground align-top">
                                            {isChanged ? (
                                                <span className="text-primary font-semibold">
                                                    {formatValue(key, newVal)}
                                                </span>
                                            ) : (
                                                <span>{formatValue(key, newVal)}</span>
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

    if (!activities && isLoading) {
        return (
            <div className="flex min-h-[220px] flex-col items-center justify-center rounded-lg border border-dashed p-8 text-center bg-card">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <h3 className="mt-4 text-sm font-semibold text-foreground">Memuat riwayat perubahan…</h3>
                <p className="mt-1 text-xs text-muted-foreground">
                    Sedang mengambil data log audit untuk supplier {supplier.name}.
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
                            ? `Menampilkan catatan perubahan data supplier (Total ${activities.total} log).`
                            : `Audit log perubahan data untuk supplier ${supplier.name}.`}
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
                tableKey={`supplier-activities-${supplier.id}`}
                emptyMessage="Belum ada riwayat perubahan data untuk supplier ini."
                isLoading={isLoading}
            />

            {/* Pagination */}
            {activities && (
                <DataTablePagination
                    meta={activities}
                    routeUrl={(opts) => SupplierController.show(supplier.id, opts)}
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

export default RiwayatPerubahanSupplier

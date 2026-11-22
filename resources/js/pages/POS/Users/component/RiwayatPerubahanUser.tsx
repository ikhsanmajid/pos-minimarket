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
import { History, Eye, RefreshCw, Loader2, ArrowRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { show } from '@/actions/App/Http/Controllers/UserController'
import type { DetailUser } from '../DetailUser'

export type UserActivity = {
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

export interface PaginatedUserActivities extends PaginationMeta {
    data: UserActivity[]
}

interface RiwayatPerubahanUserProps {
    user: DetailUser
    activities?: PaginatedUserActivities
    isLoading?: boolean
    onRefresh?: () => void
}

const fieldLabels: Record<string, string> = {
    name: 'Nama Lengkap',
    email: 'Email',
    phone: 'Nomor Telepon / WhatsApp',
    role: 'Role / Peran',
    is_active: 'Status Akun',
    pin: 'PIN Otorisasi',
    password: 'Kata Sandi',
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
    if (key === 'role') {
        const roleMap: Record<string, string> = {
            admin: 'Admin',
            cashier: 'Kasir',
            warehouse: 'Staff Gudang',
            supervisor: 'Supervisor',
        }
        return roleMap[val] ?? String(val)
    }
    if (key === 'pin') {
        return '****** (PIN Enkripsi)'
    }
    if (key === 'password') {
        return '****** (Password Terenkripsi)'
    }
    if (typeof val === 'boolean') {
        return val ? 'Ya' : 'Tidak'
    }
    return String(val)
}

export function RiwayatPerubahanUser({
    user,
    activities,
    isLoading = false,
    onRefresh,
}: RiwayatPerubahanUserProps) {
    const [selectedActivity, setSelectedActivity] = useState<UserActivity | null>(null)

    const columns: DataTableColumn<UserActivity>[] = useMemo(
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
                    const allKeys = Array.from(new Set([...Object.keys(oldData), ...Object.keys(newData)]))

                    if (row.event === 'created') {
                        return (
                            <Badge variant="secondary" className="text-[11px] font-normal">
                                Akun dibuat ({allKeys.length} atribut)
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

    const filteredData = useMemo(() => {
        return (activities?.data ?? []).filter((act) => {
            const desc = act.description?.toLowerCase() ?? ''
            const evt = act.event?.toLowerCase() ?? ''
            return evt !== 'login' && evt !== 'logout' && !desc.includes('login') && !desc.includes('logout')
        })
    }, [activities?.data])

    const renderDiffContent = (activity: UserActivity) => {
        const changes = activity.attribute_changes || {}
        const properties = activity.properties || {}
        const oldData = changes.old || properties.old || {}
        const newData = changes.attributes || properties.attributes || {}
        const allKeys = Array.from(new Set([...Object.keys(oldData), ...Object.keys(newData)]))

        if (allKeys.length > 0) {
            return (
                <div className="overflow-x-auto rounded-md border">
                    <table className="w-full text-xs text-left">
                        <thead className="bg-muted/70 text-muted-foreground font-semibold border-b">
                            <tr>
                                <th className="p-2.5">Atribut / Kolom</th>
                                <th className="p-2.5">Nilai Sebelum (Old)</th>
                                <th className="p-2.5">Nilai Sesudah (New)</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            {allKeys.map((key) => {
                                const oldVal = oldData[key]
                                const newVal = newData[key]
                                const hasChanged = oldVal !== newVal && oldVal !== undefined && newVal !== undefined

                                return (
                                    <tr key={key} className={hasChanged ? 'bg-amber-50/50 dark:bg-amber-950/20' : ''}>
                                        <td className="p-2.5 font-medium text-foreground">
                                            {fieldLabels[key] || key}
                                            <span className="block text-[10px] text-muted-foreground font-mono">
                                                {key}
                                            </span>
                                        </td>
                                        <td className="p-2.5 text-rose-600 dark:text-rose-400 font-mono">
                                            {formatValue(key, oldVal)}
                                        </td>
                                        <td className="p-2.5 text-emerald-600 dark:text-emerald-400 font-mono">
                                            <div className="flex items-center gap-1.5">
                                                {formatValue(key, newVal)}
                                            </div>
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
            <div className="py-6 text-center text-xs text-muted-foreground bg-muted/20 rounded-lg border border-dashed">
                Tidak ada data perubahan atribut khusus yang tercatat pada entri log ini.
            </div>
        )
    }

    return (
        <Card>
            <CardContent className="p-6 space-y-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
                            <History className="h-4 w-4 text-primary" />
                            Riwayat Perubahan Data Akun
                        </h2>
                        <p className="text-xs text-muted-foreground">
                            Seluruh jejak audit perubahan profil, role, atau status pengguna ini (hanya perubahan data).
                        </p>
                    </div>

                    <div className="flex items-center gap-2">
                        {onRefresh && (
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={onRefresh}
                                disabled={isLoading}
                                className="gap-1.5 h-8 text-xs"
                            >
                                <RefreshCw className={cn('h-3.5 w-3.5', isLoading && 'animate-spin')} />
                                Refresh
                            </Button>
                        )}
                    </div>
                </div>

                {isLoading && !activities ? (
                    <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-3">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        <span className="text-xs">Memuat riwayat perubahan pengguna…</span>
                    </div>
                ) : (
                    <>
                        <DataTable
                            columns={columns}
                            data={filteredData}
                            tableKey={`user-activities-${user.id}`}
                            emptyMessage="Belum ada riwayat perubahan yang tercatat untuk pengguna ini."
                            isLoading={isLoading}
                        />

                        {activities && (
                            <DataTablePagination
                                meta={activities}
                                routeUrl={(opts) => show(user.id, opts)}
                                only={['activities']}
                                isLoading={isLoading}
                            />
                        )}
                    </>
                )}
            </CardContent>

            {/* Modal Dialog Detail & Diff Perubahan */}
            <Dialog open={!!selectedActivity} onOpenChange={(open) => !open && setSelectedActivity(null)}>
                <DialogContent className="sm:max-w-2xl max-h-[85vh] flex flex-col p-0">
                    <DialogHeader className="px-6 pt-5 pb-4 border-b shrink-0">
                        <div className="flex items-center gap-2">
                            <History className="h-5 w-5 text-primary" />
                            <DialogTitle className="text-base">
                                Detail Riwayat Perubahan #{selectedActivity?.id}
                            </DialogTitle>
                        </div>
                        <DialogDescription className="text-xs">
                            Informasi jejak audit dan perbandingan atribut sebelum dan sesudah perubahan.
                        </DialogDescription>
                    </DialogHeader>

                    {selectedActivity && (
                        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
                            {/* Meta Info */}
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3 bg-muted/40 rounded-lg text-xs">
                                <div>
                                    <span className="text-muted-foreground block text-[11px]">Waktu:</span>
                                    <span className="font-semibold text-foreground">{selectedActivity.created_at}</span>
                                </div>
                                <div>
                                    <span className="text-muted-foreground block text-[11px]">Dilakukan Oleh:</span>
                                    <span className="font-semibold text-foreground">{selectedActivity.causer_name}</span>
                                </div>
                                <div>
                                    <span className="text-muted-foreground block text-[11px]">Event:</span>
                                    <span className="font-semibold capitalize text-foreground">{selectedActivity.event ?? '-'}</span>
                                </div>
                                <div>
                                    <span className="text-muted-foreground block text-[11px]">Deskripsi:</span>
                                    <span className="font-semibold text-foreground capitalize">{selectedActivity.description}</span>
                                </div>
                            </div>

                            {/* Diff Table */}
                            <div className="space-y-2">
                                <h4 className="text-xs font-semibold text-foreground">
                                    Perubahan Nilai Atribut (Old vs New):
                                </h4>
                                {renderDiffContent(selectedActivity)}
                            </div>
                        </div>
                    )}

                    <DialogFooter className="px-6 py-3 border-t bg-muted/20 shrink-0">
                        <DialogClose render={<Button variant="outline" size="sm">Tutup</Button>} />
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </Card>
    )
}

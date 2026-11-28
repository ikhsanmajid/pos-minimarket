import React from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import DataTablePagination, { type PaginationMeta } from '@/components/dataTablePagination'
import CustomerController from '@/actions/App/Http/Controllers/CustomerController'
import { formatNumber } from '@/lib/utils'
import type { CustomerPointLedgerRow } from '@/types'
import { Award, RefreshCw } from 'lucide-react'
import type { CustomerRow } from '../Customer'

export interface PaginatedCustomerPointLedgers extends PaginationMeta {
    data: CustomerPointLedgerRow[]
}

interface RiwayatPoinCustomerProps {
    customer: CustomerRow
    pointLedgers?: PaginatedCustomerPointLedgers
    isLoading: boolean
    onRefresh: () => void
}

export function RiwayatPoinCustomer({
    customer,
    pointLedgers,
    isLoading,
    onRefresh,
}: RiwayatPoinCustomerProps) {
    const rows = pointLedgers?.data ?? []

    return (
        <div className="space-y-4">
            <Card>
                <CardHeader className="pb-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div className="flex items-start gap-2.5">
                        <Award className="h-5 w-5 text-amber-500 mt-0.5 shrink-0" />
                        <div>
                            <CardTitle className="text-base font-semibold">
                                Riwayat Mutasi Poin FIFO
                            </CardTitle>
                            <CardDescription>
                                Saldo aktif saat ini: <strong className="font-mono text-foreground">{formatNumber(customer.points)} poin</strong> (konsumsi otomatis urutan kedaluwarsa paling awal).
                            </CardDescription>
                        </div>
                    </div>
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={onRefresh}
                        disabled={isLoading}
                        className="h-8 gap-1.5 text-xs shrink-0 cursor-pointer"
                    >
                        <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                        Muat Ulang
                    </Button>
                </CardHeader>

                <CardContent className="p-0">
                    {isLoading && !pointLedgers ? (
                        <div className="p-8 text-center text-xs text-muted-foreground border-t">
                            Memuat riwayat mutasi poin...
                        </div>
                    ) : rows.length === 0 ? (
                        <div className="p-8 text-center text-xs text-muted-foreground border-t">
                            Belum ada riwayat mutasi poin untuk pelanggan ini.
                        </div>
                    ) : (
                        <div className="overflow-x-auto border-t">
                            <table className="w-full min-w-[780px] table-fixed text-xs text-left">
                                <thead className="bg-muted/70 text-muted-foreground font-semibold border-b">
                                    <tr>
                                        <th className="p-3 w-[16%]">Waktu</th>
                                        <th className="p-3 w-[15%]">Jenis Mutasi</th>
                                        <th className="p-3 w-[12%] text-right">Mutasi</th>
                                        <th className="p-3 w-[12%] text-right">Sisa Lot FIFO</th>
                                        <th className="p-3 w-[16%]">Kedaluwarsa</th>
                                        <th className="p-3 w-[29%]">Keterangan &amp; Referensi</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y">
                                    {rows.map((row) => (
                                        <tr key={row.id} className="hover:bg-muted/30 transition-colors">
                                            <td className="p-3 font-mono text-[11px] text-muted-foreground">
                                                {row.created_at}
                                            </td>
                                            <td className="p-3">
                                                <Badge
                                                    variant="outline"
                                                    className={
                                                        row.type === 'earn'
                                                            ? 'border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                                                            : row.type === 'redeem'
                                                              ? 'border-violet-300 bg-violet-50 text-violet-700 dark:border-violet-800 dark:bg-violet-950/60 dark:text-violet-300'
                                                              : row.type === 'expire'
                                                                ? 'border-slate-300 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300'
                                                                : 'border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                                                    }
                                                >
                                                    {row.type_label}
                                                </Badge>
                                            </td>
                                            <td
                                                className={`p-3 text-right font-mono font-semibold ${
                                                    row.points >= 0
                                                        ? 'text-emerald-600 dark:text-emerald-400'
                                                        : 'text-rose-600 dark:text-rose-400'
                                                }`}
                                            >
                                                {row.points > 0 ? `+${formatNumber(row.points)}` : formatNumber(row.points)}
                                            </td>
                                            <td className="p-3 text-right font-mono">
                                                {row.points > 0 ? (
                                                    <span
                                                        className={
                                                            row.is_expired
                                                                ? 'line-through text-muted-foreground'
                                                                : 'font-semibold text-foreground'
                                                        }
                                                    >
                                                        {formatNumber(row.remaining_points)}
                                                    </span>
                                                ) : (
                                                    <span className="text-muted-foreground">-</span>
                                                )}
                                            </td>
                                            <td className="p-3 font-mono text-[11px]">
                                                {row.expires_at ? (
                                                    <div className="flex items-center gap-1.5 flex-wrap">
                                                        <span className={row.is_expired ? 'text-rose-600 dark:text-rose-400' : 'text-foreground'}>
                                                            {row.expires_at}
                                                        </span>
                                                        {row.is_expired && (
                                                            <Badge variant="secondary" className="text-[9px] px-1 py-0 h-4">
                                                                Expired
                                                            </Badge>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <span className="text-muted-foreground">-</span>
                                                )}
                                            </td>
                                            <td className="p-3 overflow-hidden text-ellipsis">
                                                <p className="text-foreground whitespace-normal line-clamp-2">
                                                    {row.description}
                                                </p>
                                                <p className="text-[10px] text-muted-foreground mt-0.5 font-mono">
                                                    {row.invoice_number ? `Inv: ${row.invoice_number}` : ''}
                                                    {row.return_number ? ` • Retur: ${row.return_number}` : ''}
                                                    {` • Oleh: ${row.creator_name}`}
                                                </p>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </CardContent>
            </Card>

            {pointLedgers && pointLedgers.last_page > 1 && (
                <DataTablePagination
                    meta={pointLedgers}
                    routeUrl={(opts) => CustomerController.show(customer.id, opts)}
                    only={['pointLedgers']}
                    isLoading={isLoading}
                />
            )}
        </div>
    )
}

export default RiwayatPoinCustomer

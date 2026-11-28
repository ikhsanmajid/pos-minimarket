import React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { SummaryStatCard, SummaryStatGrid } from '@/components/SummaryStatCard'
import { formatNumber, formatRupiah } from '@/lib/utils'
import {
    Award,
    Calendar,
    Clock,
    Mail,
    MapPin,
    Phone,
    ReceiptText,
    StickyNote,
    TrendingUp,
    User,
    Wallet,
} from 'lucide-react'
import type { CustomerRow } from '../Customer'

export interface CustomerDetailStats {
    total_transactions: number
    total_spent: number
    average_spent: number
    last_visit_at: string | null
}

interface DetailTabCustomerProps {
    customer: CustomerRow
    stats: CustomerDetailStats
}

export function DetailTabCustomer({ customer, stats }: DetailTabCustomerProps) {
    return (
        <div className="space-y-6">
            <SummaryStatGrid>
                <SummaryStatCard
                    title="Total Transaksi Valid"
                    value={formatNumber(stats.total_transactions)}
                    icon={ReceiptText}
                    variant="blue"
                    subInfo="Transaksi selesai (non-void)"
                    periodLabel="Sepanjang Waktu"
                />
                <SummaryStatCard
                    title="Total Nilai Belanja"
                    value={formatRupiah(stats.total_spent)}
                    icon={Wallet}
                    variant="emerald"
                    subInfo="Akumulasi grand total struk"
                    periodLabel="Belanja Bersih"
                />
                <SummaryStatCard
                    title="Rata-rata Belanja"
                    value={formatRupiah(stats.average_spent)}
                    icon={TrendingUp}
                    variant="amber"
                    subInfo={stats.last_visit_at ? `Terakhir: ${stats.last_visit_at}` : 'Belum pernah bertransaksi'}
                    periodLabel="Per Struk"
                />
                <SummaryStatCard
                    title="Saldo Poin Member"
                    value={formatNumber(customer.points)}
                    icon={Award}
                    variant="rose"
                    subInfo={customer.is_active ? 'Status member aktif' : 'Status member nonaktif'}
                    periodLabel="Poin"
                />
            </SummaryStatGrid>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <Card className="lg:col-span-2">
                    <CardHeader className="border-b pb-3">
                        <CardTitle className="text-base flex items-center gap-2">
                            <User className="h-4 w-4 text-primary" />
                            Informasi Profil Pelanggan
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-4">
                        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                            <div>
                                <dt className="text-xs text-muted-foreground">Kode Member</dt>
                                <dd className="mt-1 font-mono font-semibold text-primary">
                                    {customer.member_code}
                                </dd>
                            </div>
                            <div>
                                <dt className="text-xs text-muted-foreground">Status Keanggotaan</dt>
                                <dd className="mt-1">
                                    {customer.is_active ? (
                                        <Badge variant="success">Aktif</Badge>
                                    ) : (
                                        <Badge variant="secondary">Nonaktif</Badge>
                                    )}
                                </dd>
                            </div>
                            <div>
                                <dt className="text-xs text-muted-foreground">Nomor HP</dt>
                                <dd className="mt-1 flex items-center gap-1.5 font-mono text-foreground">
                                    <Phone className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                    <span>{customer.phone || '-'}</span>
                                </dd>
                            </div>
                            <div>
                                <dt className="text-xs text-muted-foreground">Email</dt>
                                <dd className="mt-1 flex items-center gap-1.5 text-foreground">
                                    <Mail className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                    <span className="truncate">{customer.email || '-'}</span>
                                </dd>
                            </div>
                            <div className="sm:col-span-2">
                                <dt className="text-xs text-muted-foreground">Alamat</dt>
                                <dd className="mt-1 flex items-start gap-1.5 text-foreground">
                                    <MapPin className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
                                    <span className="whitespace-pre-line">{customer.address || '-'}</span>
                                </dd>
                            </div>
                            <div className="sm:col-span-2">
                                <dt className="text-xs text-muted-foreground">Catatan</dt>
                                <dd className="mt-1 flex items-start gap-1.5 text-foreground">
                                    <StickyNote className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
                                    <span className="whitespace-pre-line">{customer.notes || '-'}</span>
                                </dd>
                            </div>
                        </dl>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="border-b pb-3">
                        <CardTitle className="text-base flex items-center gap-2">
                            <Clock className="h-4 w-4 text-primary" />
                            Metadata Kunjungan
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-4 space-y-4 text-sm">
                        <div className="flex items-start gap-2.5">
                            <Calendar className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                            <div>
                                <p className="text-xs text-muted-foreground">Terdaftar Sejak</p>
                                <p className="font-mono text-xs font-medium text-foreground mt-0.5">
                                    {customer.created_at || '-'}
                                </p>
                            </div>
                        </div>
                        <div className="flex items-start gap-2.5">
                            <Clock className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                            <div>
                                <p className="text-xs text-muted-foreground">Terakhir Diperbarui</p>
                                <p className="font-mono text-xs font-medium text-foreground mt-0.5">
                                    {customer.updated_at || '-'}
                                </p>
                            </div>
                        </div>
                        <div className="flex items-start gap-2.5">
                            <ReceiptText className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                            <div>
                                <p className="text-xs text-muted-foreground">Kunjungan Belanja Terakhir</p>
                                <p className="font-mono text-xs font-medium text-foreground mt-0.5">
                                    {stats.last_visit_at || 'Belum ada transaksi'}
                                </p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}

export default DetailTabCustomer

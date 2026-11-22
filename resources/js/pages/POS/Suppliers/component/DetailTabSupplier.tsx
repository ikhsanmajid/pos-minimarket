import React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
    Building2,
    User,
    Phone,
    Mail,
    MapPin,
    FileText,
    Clock,
    Landmark,
    Hash,
    UserCheck,
    Calendar,
    ShoppingBag,
} from 'lucide-react'
import type { SupplierRow } from '../Supplier'

function DetailItem({
    icon: Icon,
    label,
    value,
}: {
    icon: React.ElementType
    label: string
    value: React.ReactNode
}) {
    return (
        <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                <Icon className="h-4 w-4" />
            </div>
            <div className="flex-1 space-y-0.5 min-w-0">
                <p className="text-xs text-muted-foreground">{label}</p>
                <div className="text-sm font-medium text-foreground truncate">{value}</div>
            </div>
        </div>
    )
}

interface DetailTabSupplierProps {
    supplier: SupplierRow
}

export function DetailTabSupplier({ supplier }: DetailTabSupplierProps) {
    return (
        <div className="space-y-6">
            {/* Header Ringkasan Supplier */}
            <Card>
                <CardContent className="p-6">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="flex items-center gap-4">
                            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl border bg-muted">
                                <Building2 className="h-8 w-8 text-muted-foreground" />
                            </div>
                            <div>
                                <h2 className="text-xl font-bold tracking-tight text-foreground">
                                    {supplier.name}
                                </h2>
                                <div className="mt-1.5 flex flex-wrap items-center gap-2">
                                    {supplier.code && (
                                        <Badge variant="outline" className="font-mono text-xs">
                                            {supplier.code}
                                        </Badge>
                                    )}
                                    {supplier.city && (
                                        <Badge variant="secondary" className="text-xs">
                                            {supplier.city}
                                        </Badge>
                                    )}
                                    {supplier.is_active ? (
                                        <Badge variant="success">Aktif</Badge>
                                    ) : (
                                        <Badge variant="secondary">Nonaktif</Badge>
                                    )}
                                    <Badge variant="outline" className="text-xs font-mono">
                                        {supplier.purchase_orders_count ?? 0} Purchase Order
                                    </Badge>
                                </div>
                            </div>
                        </div>

                        <div className="sm:text-right min-w-[180px] border-t sm:border-t-0 pt-3 sm:pt-0 space-y-1">
                            <span className="text-xs text-muted-foreground block">Tempo Pembayaran</span>
                            <div className="text-lg font-bold font-mono text-primary">
                                {supplier.payment_term_days > 0
                                    ? `${supplier.payment_term_days} Hari`
                                    : 'COD / Tunai Langsung'}
                            </div>
                            <div className="text-xs text-muted-foreground">
                                Terdaftar: {supplier.created_at || '-'}
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Grid 2 Kolom: Informasi Kontak & Info Pembayaran */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Informasi Kontak & Lokasi */}
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-semibold flex items-center gap-2">
                            <Building2 className="h-4 w-4 text-primary" />
                            Informasi Kontak & Lokasi
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <DetailItem
                            icon={Building2}
                            label="Nama Supplier & Kode"
                            value={
                                <span>
                                    {supplier.name} {supplier.code ? `(${supplier.code})` : ''}
                                </span>
                            }
                        />
                        <DetailItem
                            icon={User}
                            label="Kontak Person (PIC)"
                            value={supplier.contact_person || '-'}
                        />
                        <DetailItem
                            icon={Phone}
                            label="Nomor Telepon"
                            value={
                                <a
                                    href={`tel:${supplier.phone}`}
                                    className="hover:text-primary transition-colors hover:underline font-mono"
                                >
                                    {supplier.phone}
                                </a>
                            }
                        />
                        <DetailItem
                            icon={Mail}
                            label="Email"
                            value={
                                supplier.email ? (
                                    <a
                                        href={`mailto:${supplier.email}`}
                                        className="hover:text-primary transition-colors hover:underline"
                                    >
                                        {supplier.email}
                                    </a>
                                ) : (
                                    '-'
                                )
                            }
                        />
                        <DetailItem
                            icon={MapPin}
                            label="Kota & Alamat Lengkap"
                            value={
                                supplier.city || supplier.address
                                    ? `${supplier.city ? supplier.city + ', ' : ''}${supplier.address || ''}`
                                    : '-'
                            }
                        />
                        <DetailItem
                            icon={FileText}
                            label="Nomor Pokok Wajib Pajak (NPWP)"
                            value={supplier.npwp || '-'}
                        />
                    </CardContent>
                </Card>

                {/* Pembayaran & Rekening Bank */}
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-semibold flex items-center gap-2">
                            <Landmark className="h-4 w-4 text-primary" />
                            Ketentuan Pembayaran & Rekening Bank
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <DetailItem
                            icon={Clock}
                            label="Ketentuan Tempo Pembayaran"
                            value={
                                supplier.payment_term_days > 0
                                    ? `${supplier.payment_term_days} Hari Kalender`
                                    : 'COD / Tunai Langsung'
                            }
                        />
                        <DetailItem
                            icon={Landmark}
                            label="Nama Bank"
                            value={supplier.bank_name || '-'}
                        />
                        <DetailItem
                            icon={Hash}
                            label="Nomor Rekening Bank"
                            value={
                                supplier.bank_account_number ? (
                                    <span className="font-mono font-semibold text-primary">
                                        {supplier.bank_account_number}
                                    </span>
                                ) : (
                                    '-'
                                )
                            }
                        />
                        <DetailItem
                            icon={UserCheck}
                            label="Rekening Atas Nama"
                            value={supplier.bank_account_name || '-'}
                        />
                        <DetailItem
                            icon={ShoppingBag}
                            label="Total Transaksi PO"
                            value={`${supplier.purchase_orders_count ?? 0} Dokumen PO`}
                        />
                        <DetailItem
                            icon={Calendar}
                            label="Terakhir Diperbarui"
                            value={supplier.updated_at || supplier.created_at || '-'}
                        />
                    </CardContent>
                </Card>
            </div>

            {/* Catatan Internal */}
            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                        <FileText className="h-4 w-4 text-primary" />
                        Catatan Internal Supplier
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {supplier.notes ? (
                        <p className="text-xs text-foreground bg-muted/40 p-3 rounded-lg border whitespace-pre-line leading-relaxed">
                            {supplier.notes}
                        </p>
                    ) : (
                        <p className="text-xs text-muted-foreground italic bg-muted/20 p-3 rounded-lg border">
                            Tidak ada catatan internal untuk mitra supplier ini.
                        </p>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}

export default DetailTabSupplier

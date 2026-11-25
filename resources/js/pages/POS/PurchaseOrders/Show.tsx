import * as React from 'react'
import { Link, router, usePage } from '@inertiajs/react'
import AuthenticatedLayout from '@/layouts/AuthenticatedLayout'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
    ArrowLeft,
    PackageCheck,
    CreditCard,
    CheckCircle2,
    Ban,
    Pencil,
    Building2,
    Calendar,
    Phone,
    Mail,
    MapPin,
    Clock,
    History,
    FileText,
    ShoppingBag,
    Package,
    Landmark,
    Hash,
    UserCheck,
    User,
    Send,
    FileDown,
} from 'lucide-react'
import { useAuth } from '@/hooks/use-auth'
import { ReceiveGoodsDialog } from './component/ReceiveGoodsDialog'
import { PaymentStatusDialog } from './component/PaymentStatusDialog'
import PurchaseOrderController from '@/actions/App/Http/Controllers/PurchaseOrderController'

interface SupplierDetail {
    id: number
    code: string | null
    name: string
    contact_person: string | null
    phone: string
    email: string | null
    address: string | null
    city: string | null
    npwp?: string | null
    payment_term_days: number
    bank_name: string | null
    bank_account_number: string | null
    bank_account_name: string | null
}

interface ItemDetail {
    id: number
    product_id: number
    product_name: string
    barcode: string
    category_name: string
    current_stock: number
    current_buy_price: number | string
    quantity_ordered: number
    quantity_received: number
    remaining_quantity: number
    unit_cost: number | string
    subtotal: number | string
    expired_date?: string | null
    raw_expired_date?: string | null
}

interface POActivity {
    id: number
    description: string
    event: string | null
    causer_name: string
    properties?: Record<string, any>
    created_at: string
    created_at_human: string
}

interface ShowPOPageProps {
    purchaseOrder: {
        id: number
        po_number: string
        order_date: string
        raw_order_date: string
        expected_date?: string | null
        received_at?: string | null
        due_date?: string | null
        status: string
        status_label: string
        payment_status: string
        payment_status_label: string
        subtotal: number | string
        discount_type?: 'fixed' | 'percent' | string
        discount_value?: number | string
        discount_amount: number | string
        tax_percentage?: number | string
        tax_amount: number | string
        total_amount: number | string
        notes?: string | null
        created_at: string
        supplier: SupplierDetail | null
        creator: { id: number; name: string; role?: string } | null
        received_by: { id: number; name: string } | null
        items: ItemDetail[]
    }
    activities: POActivity[]
}

const formatRupiah = (val: number | string) => {
    const num = Number(val) || 0
    return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0,
    }).format(num)
}

const statusBadgeConfig: Record<string, { label: string; className: string }> = {
    draft: {
        label: 'Draft',
        className: 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300 border-slate-300 dark:border-slate-700',
    },
    ordered: {
        label: 'Dipesan',
        className: 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 border-blue-200 dark:border-blue-800',
    },
    partially_received: {
        label: 'Diterima Sebagian',
        className: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border-amber-200 dark:border-amber-800',
    },
    received: {
        label: 'Selesai',
        className: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
    },
    cancelled: {
        label: 'Dibatalkan',
        className: 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 border-rose-200 dark:border-rose-800',
    },
}

const paymentBadgeConfig: Record<string, { label: string; className: string }> = {
    unpaid: {
        label: 'Belum Dibayar',
        className: 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400 border-rose-200 dark:border-rose-900',
    },
    partial: {
        label: 'Dibayar Sebagian',
        className: 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400 border-amber-200 dark:border-amber-900',
    },
    paid: {
        label: 'Lunas',
        className: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900',
    },
}

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

export function PurchaseOrdersShow({ purchaseOrder, activities }: ShowPOPageProps) {
    const { user } = useAuth()
    const userRole = (user?.role as string) || ''

    const queryTab =
        typeof window !== 'undefined'
            ? new URLSearchParams(window.location.search).get('tab')
            : null
    const [activeTab, setActiveTab] = React.useState(
        queryTab === 'items' ? 'items' : queryTab === 'history' ? 'history' : 'detail'
    )

    const canMarkOrdered = ['admin', 'supervisor', 'warehouse'].includes(userRole) &&
        purchaseOrder.status === 'draft'
    const canReceive = ['admin', 'supervisor', 'warehouse'].includes(userRole) &&
        ['draft', 'ordered', 'partially_received'].includes(purchaseOrder.status)
    const canCloseRemaining = ['admin', 'supervisor'].includes(userRole) &&
        purchaseOrder.status === 'partially_received'
    const canUpdatePayment = ['admin', 'supervisor'].includes(userRole)
    const canEdit = ['admin', 'supervisor', 'warehouse'].includes(userRole) &&
        ['draft', 'ordered'].includes(purchaseOrder.status) &&
        purchaseOrder.items.every((it) => it.quantity_received === 0)
    const canCancel = ['admin', 'supervisor'].includes(userRole) &&
        !['received', 'cancelled'].includes(purchaseOrder.status) &&
        purchaseOrder.items.every((it) => it.quantity_received === 0)

    const [receiveOpen, setReceiveOpen] = React.useState(false)
    const [markOrderedOpen, setMarkOrderedOpen] = React.useState(false)
    const [paymentOpen, setPaymentOpen] = React.useState(false)
    const [closeRemainingOpen, setCloseRemainingOpen] = React.useState(false)
    const [closeReason, setCloseReason] = React.useState('')
    const [cancelOpen, setCancelOpen] = React.useState(false)
    const [cancelReason, setCancelReason] = React.useState('')
    const [processing, setProcessing] = React.useState(false)

    const handleMarkOrdered = () => {
        setProcessing(true)
        router.post(PurchaseOrderController.markOrdered.url(purchaseOrder.id), {}, {
            preserveScroll: true,
            onFinish: () => {
                setProcessing(false)
                setMarkOrderedOpen(false)
            },
        })
    }

    const handleCloseRemaining = () => {
        setProcessing(true)
        router.post(PurchaseOrderController.closeRemaining.url(purchaseOrder.id), {
            reason: closeReason,
        }, {
            preserveScroll: true,
            onFinish: () => {
                setProcessing(false)
                setCloseRemainingOpen(false)
            },
        })
    }

    const handleCancel = () => {
        setProcessing(true)
        router.post(PurchaseOrderController.cancel.url(purchaseOrder.id), {
            reason: cancelReason,
        }, {
            preserveScroll: true,
            onFinish: () => {
                setProcessing(false)
                setCancelOpen(false)
            },
        })
    }

    const statusCfg = statusBadgeConfig[purchaseOrder.status] || {
        label: purchaseOrder.status_label,
        className: '',
    }
    const paymentCfg = paymentBadgeConfig[purchaseOrder.payment_status] || {
        label: purchaseOrder.payment_status_label,
        className: '',
    }

    const totalOrderedQty = purchaseOrder.items.reduce((acc, it) => acc + it.quantity_ordered, 0)
    const totalReceivedQty = purchaseOrder.items.reduce((acc, it) => acc + it.quantity_received, 0)
    const totalRemainingQty = purchaseOrder.items.reduce((acc, it) => acc + it.remaining_quantity, 0)
    const overallProgress = totalOrderedQty > 0 ? Math.min(100, Math.round((totalReceivedQty / totalOrderedQty) * 100)) : 0

    return (
        <div className="w-full min-w-0 space-y-6">
            {/* Top Bar: Tombol Kembali, Judul & Actions */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex items-center gap-3">
                    <Button
                        variant="ghost"
                        size="sm"
                        render={<Link href={PurchaseOrderController.index.url()} />}
                        className="gap-1.5 text-muted-foreground hover:text-foreground -ml-2"
                    >
                        <ArrowLeft className="h-4 w-4" />
                        Kembali
                    </Button>
                    <div className="h-4 w-px bg-border" />
                    <div className="flex flex-wrap items-center gap-2.5">
                        <h1 className="text-xl font-bold font-mono tracking-tight text-foreground truncate">
                            {purchaseOrder.po_number}
                        </h1>
                        <Badge variant="outline" className={`text-xs ${statusCfg.className}`}>
                            {statusCfg.label}
                        </Badge>
                        <Badge variant="outline" className={`text-xs ${paymentCfg.className}`}>
                            {paymentCfg.label}
                        </Badge>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    {canMarkOrdered && (
                        <Button
                            size="sm"
                            onClick={() => setMarkOrderedOpen(true)}
                            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold gap-1.5 shadow-xs"
                        >
                            <Send className="h-3.5 w-3.5" />
                            <span>Tandai Dipesan</span>
                        </Button>
                    )}

                    {canReceive && (
                        <Button
                            size="sm"
                            onClick={() => setReceiveOpen(true)}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold gap-1.5 shadow-xs"
                        >
                            <PackageCheck className="h-4 w-4" />
                            <span>Terima Barang</span>
                        </Button>
                    )}

                    {canCloseRemaining && (
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setCloseRemainingOpen(true)}
                            className="border-amber-300 text-amber-700 hover:bg-amber-50 dark:hover:bg-amber-950/40 text-xs gap-1.5"
                        >
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            <span>Tutup Sisa</span>
                        </Button>
                    )}

                    {canUpdatePayment && (
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setPaymentOpen(true)}
                            className="text-xs gap-1.5"
                        >
                            <CreditCard className="h-3.5 w-3.5" />
                            <span>Status Bayar</span>
                        </Button>
                    )}

                    <Button
                        variant="outline"
                        size="sm"
                        render={
                            <a
                                href={PurchaseOrderController.downloadPdf.url(purchaseOrder.id)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1.5 text-xs"
                            >
                                <FileDown className="h-3.5 w-3.5" />
                                <span>Download PDF</span>
                            </a>
                        }
                    />

                    {canEdit && (
                        <Button
                            variant="outline"
                            size="sm"
                            render={
                                <Link href={PurchaseOrderController.edit.url(purchaseOrder.id)} className="flex items-center gap-1.5 text-xs">
                                    <Pencil className="h-3.5 w-3.5" />
                                    <span>Edit PO</span>
                                </Link>
                            }
                        />
                    )}

                    {canCancel && (
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setCancelOpen(true)}
                            className="text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-xs gap-1.5"
                        >
                            <Ban className="h-3.5 w-3.5" />
                            <span>Batalkan</span>
                        </Button>
                    )}
                </div>
            </div>

            {/* Tabs Navigasi: Detail PO, Rincian Barang, Riwayat Log */}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full space-y-4">
                <TabsList
                    variant="line"
                    className="w-full justify-start border-b border-border gap-6 rounded-none p-0 bg-transparent"
                >
                    <TabsTrigger value="detail" className="gap-2 pb-2.5">
                        <Building2 className="h-4 w-4" />
                        Detail PO
                    </TabsTrigger>
                    <TabsTrigger value="items" className="gap-2 pb-2.5">
                        <Package className="h-4 w-4" />
                        Rincian Barang
                        <Badge variant="secondary" className="ml-1 px-1.5 py-0 text-[10px] font-mono">
                            {purchaseOrder.items.length}
                        </Badge>
                    </TabsTrigger>
                    <TabsTrigger value="history" className="gap-2 pb-2.5">
                        <History className="h-4 w-4" />
                        Riwayat Penerimaan & Log
                        {activities.length > 0 && (
                            <Badge variant="secondary" className="ml-1 px-1.5 py-0 text-[10px] font-mono">
                                {activities.length}
                            </Badge>
                        )}
                    </TabsTrigger>
                </TabsList>

                {/* TAB 1: DETAIL PO */}
                <TabsContent value="detail" className="m-0 space-y-6 focus-visible:outline-none">
                    {/* Ringkasan Header PO (Gaya DetailTabProduct) */}
                    <Card>
                        <CardContent className="p-6">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                <div className="flex items-center gap-4">
                                    <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl border bg-muted">
                                        <ShoppingBag className="h-8 w-8 text-muted-foreground" />
                                    </div>
                                    <div>
                                        <h2 className="text-xl font-bold tracking-tight text-foreground font-mono">
                                            {purchaseOrder.po_number}
                                        </h2>
                                        <div className="mt-1.5 flex flex-wrap items-center gap-2">
                                            <Badge variant="outline" className="font-sans font-medium text-xs">
                                                Supplier: {purchaseOrder.supplier?.name || '-'}
                                            </Badge>
                                            {purchaseOrder.supplier?.code && (
                                                <Badge variant="secondary" className="font-mono text-xs">
                                                    {purchaseOrder.supplier.code}
                                                </Badge>
                                            )}
                                            <Badge variant="outline" className={`text-xs ${statusCfg.className}`}>
                                                {statusCfg.label}
                                            </Badge>
                                            <Badge variant="outline" className={`text-xs ${paymentCfg.className}`}>
                                                {paymentCfg.label}
                                            </Badge>
                                        </div>
                                    </div>
                                </div>

                                <div className="sm:text-right min-w-[200px] border-t sm:border-t-0 pt-3 sm:pt-0">
                                    <span className="text-xs text-muted-foreground block">Nilai Tagihan</span>
                                    <div className="text-2xl font-extrabold font-mono text-primary">
                                        {formatRupiah(purchaseOrder.total_amount)}
                                    </div>
                                    <div className="text-xs text-muted-foreground mt-1">
                                        Realisasi: <strong className="text-foreground">{overallProgress}%</strong> ({totalReceivedQty}/{totalOrderedQty} unit)
                                    </div>
                                    <div className="mt-1.5 h-2 w-full bg-muted rounded-full overflow-hidden">
                                        <div
                                            className={`h-full ${
                                                overallProgress >= 100
                                                    ? 'bg-emerald-500'
                                                    : overallProgress > 0
                                                    ? 'bg-amber-500'
                                                    : 'bg-muted-foreground/30'
                                            }`}
                                            style={{ width: `${overallProgress}%` }}
                                        />
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Grid Detail Item Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {/* Informasi Supplier */}
                        <Card>
                            <CardHeader className="pb-3">
                                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                                    <Building2 className="h-4 w-4 text-primary" />
                                    Informasi Supplier
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <DetailItem
                                    icon={Building2}
                                    label="Nama Supplier"
                                    value={purchaseOrder.supplier?.name || '-'}
                                />
                                <DetailItem
                                    icon={User}
                                    label="Kontak PIC"
                                    value={purchaseOrder.supplier?.contact_person || '-'}
                                />
                                <DetailItem
                                    icon={Phone}
                                    label="Telepon"
                                    value={purchaseOrder.supplier?.phone || '-'}
                                />
                                <DetailItem
                                    icon={Mail}
                                    label="Email"
                                    value={purchaseOrder.supplier?.email || '-'}
                                />
                                <DetailItem
                                    icon={MapPin}
                                    label="Kota & Alamat"
                                    value={
                                        purchaseOrder.supplier?.city || purchaseOrder.supplier?.address
                                            ? `${purchaseOrder.supplier.city ? purchaseOrder.supplier.city + ', ' : ''}${purchaseOrder.supplier.address || ''}`
                                            : '-'
                                    }
                                />
                                <DetailItem
                                    icon={FileText}
                                    label="NPWP"
                                    value={purchaseOrder.supplier?.npwp || '-'}
                                />
                            </CardContent>
                        </Card>

                        {/* Jadwal & PIC */}
                        <Card>
                            <CardHeader className="pb-3">
                                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                                    <Calendar className="h-4 w-4 text-primary" />
                                    Jadwal & Penanggung Jawab
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <DetailItem
                                    icon={Calendar}
                                    label="Tanggal Pemesanan"
                                    value={purchaseOrder.order_date}
                                />
                                <DetailItem
                                    icon={Calendar}
                                    label="Estimasi Kedatangan"
                                    value={purchaseOrder.expected_date || '-'}
                                />
                                <DetailItem
                                    icon={Clock}
                                    label="Jatuh Tempo Pembayaran"
                                    value={purchaseOrder.due_date ? (
                                        <span className="font-semibold text-primary">{purchaseOrder.due_date}</span>
                                    ) : '-'}
                                />
                                <DetailItem
                                    icon={UserCheck}
                                    label="Pembuat Dokumen (PO)"
                                    value={purchaseOrder.creator?.name || 'Sistem'}
                                />
                                <DetailItem
                                    icon={PackageCheck}
                                    label="Terakhir Diterima"
                                    value={
                                        purchaseOrder.received_at ? (
                                            <span>
                                                {purchaseOrder.received_at}{' '}
                                                <span className="text-xs text-muted-foreground">({purchaseOrder.received_by?.name || 'Gudang'})</span>
                                            </span>
                                        ) : 'Belum ada penerimaan'
                                    }
                                />
                            </CardContent>
                        </Card>

                        {/* Pembayaran & Rekening Bank */}
                        <Card className="md:col-span-2 lg:col-span-1">
                            <CardHeader className="pb-3">
                                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                                    <CreditCard className="h-4 w-4 text-primary" />
                                    Pembayaran & Rekening
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <DetailItem
                                    icon={Clock}
                                    label="Tempo Pembayaran"
                                    value={
                                        purchaseOrder.supplier?.payment_term_days && purchaseOrder.supplier.payment_term_days > 0
                                            ? `${purchaseOrder.supplier.payment_term_days} Hari`
                                            : 'COD / Tunai Langsung'
                                    }
                                />
                                <DetailItem
                                    icon={Landmark}
                                    label="Bank Supplier"
                                    value={purchaseOrder.supplier?.bank_name || '-'}
                                />
                                <DetailItem
                                    icon={Hash}
                                    label="Nomor Rekening"
                                    value={purchaseOrder.supplier?.bank_account_number || '-'}
                                />
                                <DetailItem
                                    icon={User}
                                    label="Rekening Atas Nama"
                                    value={purchaseOrder.supplier?.bank_account_name || '-'}
                                />
                                <DetailItem
                                    icon={CreditCard}
                                    label="Status Tagihan"
                                    value={
                                        <Badge variant="outline" className={`text-xs ${paymentCfg.className}`}>
                                            {paymentCfg.label}
                                        </Badge>
                                    }
                                />
                            </CardContent>
                        </Card>
                    </div>

                    {/* Ringkasan Nilai Finansial */}
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-sm font-semibold flex items-center gap-2">
                                <FileText className="h-4 w-4 text-primary" />
                                Rincian Finansial & Catatan
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                                <div className="space-y-2 text-xs">
                                    <div className="flex justify-between py-1 border-b">
                                        <span className="text-muted-foreground">Subtotal Kotor:</span>
                                        <span className="font-mono font-medium">{formatRupiah(purchaseOrder.subtotal)}</span>
                                    </div>
                                    <div className="flex justify-between py-1 border-b text-muted-foreground">
                                        <span>
                                            {purchaseOrder.discount_type === 'percent' &&
                                            Number(purchaseOrder.discount_value) > 0
                                                ? `Diskon (${Number(purchaseOrder.discount_value)}%):`
                                                : 'Diskon:'}
                                        </span>
                                        <span className="font-mono">- {formatRupiah(purchaseOrder.discount_amount)}</span>
                                    </div>
                                    <div className="flex justify-between py-1 border-b text-muted-foreground">
                                        <span>
                                            {Number(purchaseOrder.tax_percentage) > 0
                                                ? `Pajak / PPN (${Number(purchaseOrder.tax_percentage)}%):`
                                                : 'Pajak / PPN:'}
                                        </span>
                                        <span className="font-mono">+ {formatRupiah(purchaseOrder.tax_amount)}</span>
                                    </div>
                                    <div className="flex justify-between py-2.5 border-t-2 border-foreground/10 text-sm">
                                        <span className="font-bold text-foreground">Grand Total Tagihan:</span>
                                        <span className="font-mono text-base font-extrabold text-primary">
                                            {formatRupiah(purchaseOrder.total_amount)}
                                        </span>
                                    </div>
                                </div>

                                <div className="space-y-1.5 text-xs">
                                    <span className="text-xs text-muted-foreground font-medium block">Catatan Pesanan:</span>
                                    {purchaseOrder.notes ? (
                                        <p className="text-xs text-foreground bg-muted/40 p-3 rounded-lg border whitespace-pre-line leading-relaxed">
                                            {purchaseOrder.notes}
                                        </p>
                                    ) : (
                                        <p className="text-xs text-muted-foreground italic bg-muted/20 p-3 rounded-lg border">
                                            Tidak ada catatan tambahan untuk pesanan ini.
                                        </p>
                                    )}
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* TAB 2: RINCIAN BARANG */}
                <TabsContent value="items" className="m-0 space-y-6 focus-visible:outline-none">
                    <Card>
                        <CardHeader className="pb-3 flex flex-row items-center justify-between">
                            <div>
                                <CardTitle className="text-base flex items-center gap-2">
                                    <Package className="h-4 w-4 text-primary" />
                                    Daftar Barang & Status Penerimaan
                                </CardTitle>
                                <CardDescription>
                                    Total {purchaseOrder.items.length} item produk dipesan dengan total {totalOrderedQty} unit.
                                </CardDescription>
                            </div>
                        </CardHeader>
                        <CardContent className="p-0">
                            <div className="overflow-x-auto">
                                <table className="w-full min-w-[820px] table-fixed text-xs text-left">
                                    <thead className="bg-muted/70 text-muted-foreground font-semibold border-b">
                                        <tr>
                                            <th className="p-3 w-[6%] text-center">No</th>
                                            <th className="p-3 w-[26%]">Produk & Barcode</th>
                                            <th className="p-3 w-[14%]">Harga Beli PO</th>
                                            <th className="p-3 w-[9%] text-center">Dipesan</th>
                                            <th className="p-3 w-[9%] text-center">Diterima</th>
                                            <th className="p-3 w-[8%] text-center">Sisa</th>
                                            <th className="p-3 w-[14%]">Progres Item</th>
                                            <th className="p-3 w-[14%] text-right">Subtotal</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y">
                                        {purchaseOrder.items.map((item, idx) => {
                                            const percent = item.quantity_ordered > 0
                                                ? Math.min(100, Math.round((item.quantity_received / item.quantity_ordered) * 100))
                                                : 0

                                            return (
                                                <tr key={item.id} className="hover:bg-muted/30 transition-colors">
                                                    <td className="p-3 text-center font-mono text-muted-foreground">
                                                        {idx + 1}
                                                    </td>
                                                    <td className="p-3">
                                                        <div className="font-semibold text-foreground text-sm">
                                                            {item.product_name}
                                                        </div>
                                                        <div className="flex items-center gap-2 text-[11px] text-muted-foreground font-mono mt-0.5">
                                                            <span>{item.barcode}</span>
                                                            <span>•</span>
                                                            <span>Kat: {item.category_name}</span>
                                                            {item.expired_date && (
                                                                <>
                                                                    <span>•</span>
                                                                    <span className="text-amber-600 font-medium">
                                                                        Exp: {item.expired_date}
                                                                    </span>
                                                                </>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td className="p-3 font-mono font-medium">
                                                        {formatRupiah(item.unit_cost)}
                                                    </td>
                                                    <td className="p-3 text-center font-mono font-semibold">
                                                        {item.quantity_ordered}
                                                    </td>
                                                    <td className="p-3 text-center font-mono font-bold text-emerald-600">
                                                        {item.quantity_received}
                                                    </td>
                                                    <td className="p-3 text-center font-mono font-bold">
                                                        {item.remaining_quantity > 0 ? (
                                                            <span className="text-primary">{item.remaining_quantity}</span>
                                                        ) : (
                                                            <span className="text-muted-foreground">0</span>
                                                        )}
                                                    </td>
                                                    <td className="p-3">
                                                        <div className="flex items-center gap-2">
                                                            <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                                                                <div
                                                                    className={`h-full ${
                                                                        percent >= 100
                                                                            ? 'bg-emerald-500'
                                                                            : percent > 0
                                                                            ? 'bg-amber-500'
                                                                            : 'bg-muted-foreground/30'
                                                                    }`}
                                                                    style={{ width: `${percent}%` }}
                                                                />
                                                            </div>
                                                            <span className="font-mono text-[11px] font-medium text-muted-foreground w-8 text-right">
                                                                {percent}%
                                                            </span>
                                                        </div>
                                                    </td>
                                                    <td className="p-3 text-right font-mono font-bold text-foreground">
                                                        {formatRupiah(item.subtotal)}
                                                    </td>
                                                </tr>
                                            )
                                        })}
                                    </tbody>
                                    <tfoot className="bg-muted/40 border-t font-semibold text-xs">
                                        <tr>
                                            <td colSpan={3} className="p-3 text-right">
                                                Total Akumulasi:
                                            </td>
                                            <td className="p-3 text-center font-mono font-bold">
                                                {totalOrderedQty}
                                            </td>
                                            <td className="p-3 text-center font-mono font-bold text-emerald-600">
                                                {totalReceivedQty}
                                            </td>
                                            <td className="p-3 text-center font-mono font-bold text-primary">
                                                {totalRemainingQty}
                                            </td>
                                            <td className="p-3 text-center font-mono text-[11px] text-muted-foreground">
                                                {overallProgress}% Total
                                            </td>
                                            <td className="p-3 text-right font-mono font-extrabold text-foreground">
                                                {formatRupiah(purchaseOrder.subtotal)}
                                            </td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* TAB 3: RIWAYAT & AUDIT LOG */}
                <TabsContent value="history" className="m-0 space-y-6 focus-visible:outline-none">
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-base flex items-center gap-2">
                                <History className="h-4 w-4 text-primary" />
                                Riwayat Penerimaan Barang & Audit Log PO
                            </CardTitle>
                            <CardDescription>
                                Catatan kronologis penerimaan stok dan pembaruan harga beli rata-rata tertimbang (Weighted Average).
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {activities.length > 0 ? (
                                <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-border">
                                    {activities.map((act) => {
                                        const props = act.properties || {}
                                        const receivedItems = props.received_items as any[] | undefined

                                        return (
                                            <div key={act.id} className="relative group">
                                                <div className="absolute -left-[19px] top-1 h-3 w-3 rounded-full border-2 border-background bg-primary ring-2 ring-primary/20" />
                                                <div className="rounded-lg border bg-muted/20 p-3.5 space-y-2 text-xs">
                                                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                                                        <span className="font-semibold text-foreground">
                                                            {act.description}
                                                        </span>
                                                        <div className="flex items-center gap-2 font-mono text-[11px] text-muted-foreground">
                                                            <span>{act.created_at}</span>
                                                            <span>({act.created_at_human})</span>
                                                        </div>
                                                    </div>

                                                    <div className="text-muted-foreground">
                                                        Diproses oleh: <strong className="text-foreground">{act.causer_name}</strong>
                                                    </div>

                                                    {/* Detail Barang yang Diterima pada Batch Ini */}
                                                    {receivedItems && receivedItems.length > 0 && (
                                                        <div className="mt-3 pt-2 border-t space-y-2">
                                                            <span className="font-semibold text-muted-foreground text-[11px] block uppercase tracking-wider">
                                                                Rincian Kedatangan Barang & Pembaruan Harga Beli:
                                                            </span>
                                                            <div className="rounded-md border bg-background overflow-x-auto">
                                                                <table className="w-full min-w-[600px] table-fixed text-[11px] text-left">
                                                                    <thead className="bg-muted/50 border-b text-muted-foreground">
                                                                        <tr>
                                                                            <th className="p-2 w-[32%]">Produk</th>
                                                                            <th className="p-2 w-[18%] text-center">Diterima Kali Ini</th>
                                                                            <th className="p-2 w-[18%]">Perubahan Stok</th>
                                                                            <th className="p-2 w-[32%]">Harga Beli Lama ➔ Weighted Baru</th>
                                                                        </tr>
                                                                    </thead>
                                                                    <tbody className="divide-y font-mono">
                                                                        {receivedItems.map((r, i) => (
                                                                            <tr key={i}>
                                                                                <td className="p-2 font-sans font-medium text-foreground">
                                                                                    {r.product_name} ({r.barcode})
                                                                                </td>
                                                                                <td className="p-2 text-center font-bold text-emerald-600">
                                                                                    +{r.quantity_received_now} unit
                                                                                </td>
                                                                                <td className="p-2 text-muted-foreground">
                                                                                    {r.old_stock} ➔ <strong className="text-foreground">{r.new_stock}</strong>
                                                                                </td>
                                                                                <td className="p-2">
                                                                                    <span className="line-through text-muted-foreground mr-1.5">
                                                                                        {formatRupiah(r.old_buy_price)}
                                                                                    </span>
                                                                                    ➔{' '}
                                                                                    <strong className="text-emerald-600 font-bold ml-1.5">
                                                                                        {formatRupiah(r.new_weighted_buy_price)}
                                                                                    </strong>
                                                                                </td>
                                                                            </tr>
                                                                        ))}
                                                                    </tbody>
                                                                </table>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            ) : (
                                <div className="text-center py-6 text-xs text-muted-foreground italic">
                                    Belum ada riwayat aktivitas yang tercatat untuk PO ini.
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>

            {/* Modal Dialog Tandai Dipesan (Draft -> Ordered) */}
            <AlertDialog open={markOrderedOpen} onOpenChange={setMarkOrderedOpen}>
                <AlertDialogContent size="sm">
                    <AlertDialogHeader>
                        <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-blue-500/10">
                            <Send className="h-6 w-6 text-blue-600" />
                        </div>
                        <AlertDialogTitle className="text-center">Tandai PO Sebagai Dipesan</AlertDialogTitle>
                        <AlertDialogDescription className="text-center">
                            Ubah status Purchase Order <strong className="text-foreground">{purchaseOrder.po_number}</strong> dari{' '}
                            <strong className="text-foreground">Draft</strong> menjadi{' '}
                            <strong className="text-foreground">Dipesan (Ordered)</strong>?
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={processing}>Batal</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleMarkOrdered}
                            disabled={processing}
                            className="bg-blue-600 hover:bg-blue-700 text-white"
                        >
                            {processing ? 'Memproses...' : 'Ya, Tandai Dipesan'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Modal Dialog Penerimaan Barang (Receiving) */}
            <ReceiveGoodsDialog
                poId={purchaseOrder.id}
                poNumber={purchaseOrder.po_number}
                items={purchaseOrder.items}
                open={receiveOpen}
                onOpenChange={setReceiveOpen}
            />

            {/* Modal Dialog Status Pembayaran */}
            <PaymentStatusDialog
                poId={purchaseOrder.id}
                poNumber={purchaseOrder.po_number}
                currentStatus={purchaseOrder.payment_status}
                open={paymentOpen}
                onOpenChange={setPaymentOpen}
            />

            {/* Modal Dialog Tutup Sisa PO */}
            <AlertDialog open={closeRemainingOpen} onOpenChange={setCloseRemainingOpen}>
                <AlertDialogContent size="sm">
                    <AlertDialogHeader>
                        <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/10">
                            <CheckCircle2 className="h-6 w-6 text-amber-600" />
                        </div>
                        <AlertDialogTitle className="text-center">Tutup Sisa Pesanan PO</AlertDialogTitle>
                        <AlertDialogDescription className="text-center space-y-2">
                            <span>
                                Yakin ingin menutup sisa pesanan PO <strong className="text-foreground">{purchaseOrder.po_number}</strong>?
                                Status PO akan ditandai Selesai dan total nilai faktur akan disesuaikan dengan barang yang telah diterima aktual.
                            </span>
                            <textarea
                                placeholder="Alasan penutupan sisa (cth: supplier kehabisan stok pabrik)..."
                                value={closeReason}
                                onChange={(e) => setCloseReason(e.target.value)}
                                rows={2}
                                className="w-full mt-2 rounded-md border border-input bg-background p-2 text-xs"
                            />
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={processing}>Batal</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleCloseRemaining}
                            disabled={processing}
                            className="bg-amber-600 hover:bg-amber-700 text-white"
                        >
                            {processing ? 'Menutup...' : 'Ya, Tutup Sisa PO'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Modal Dialog Pembatalan PO */}
            <AlertDialog open={cancelOpen} onOpenChange={setCancelOpen}>
                <AlertDialogContent size="sm">
                    <AlertDialogHeader>
                        <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
                            <Ban className="h-6 w-6 text-destructive" />
                        </div>
                        <AlertDialogTitle className="text-center">Batalkan Dokumen PO</AlertDialogTitle>
                        <AlertDialogDescription className="text-center space-y-2">
                            <span>
                                Yakin ingin membatalkan Purchase Order <strong className="text-foreground">{purchaseOrder.po_number}</strong>?
                            </span>
                            <textarea
                                placeholder="Alasan pembatalan..."
                                value={cancelReason}
                                onChange={(e) => setCancelReason(e.target.value)}
                                rows={2}
                                className="w-full mt-2 rounded-md border border-input bg-background p-2 text-xs"
                            />
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={processing}>Kembali</AlertDialogCancel>
                        <AlertDialogAction
                            variant="destructive"
                            onClick={handleCancel}
                            disabled={processing}
                        >
                            {processing ? 'Membatalkan...' : 'Ya, Batalkan PO'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    )
}

PurchaseOrdersShow.layout = (page: React.ReactNode) => (
    <AuthenticatedLayout>{page}</AuthenticatedLayout>
)

export default PurchaseOrdersShow

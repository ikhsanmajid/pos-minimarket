import * as React from 'react'
import { Link, router } from '@inertiajs/react'
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
    Clock,
    History,
    FileText,
    ShoppingBag,
    Package,
    UserCheck,
    Send,
    FileDown,
    Lock,
    ShieldCheck,
    XCircle,
    RotateCcw,
    ClipboardList,
    Wallet,
    AlertTriangle,
} from 'lucide-react'
import { toast } from 'react-toastify'
import { useAuth } from '@/hooks/use-auth'
import { ReceiveGoodsDialog, type ReceiveItemInput } from './component/ReceiveGoodsDialog'
import { RecordPaymentDialog } from './component/RecordPaymentDialog'
import { RejectPurchaseOrderDialog } from './component/RejectPurchaseOrderDialog'
import PurchaseOrderController from '@/actions/App/Http/Controllers/PurchaseOrderController'
import {
    formatRupiah,
    poStatusBadgeConfig,
    receivingStatusBadgeConfig,
    paymentStatusBadgeConfig,
    type FinancialAccountOption,
    type SelectOptionItem,
} from './component/purchaseOrderUtils'

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

interface ItemDetail extends ReceiveItemInput {
    category_name: string
    base_qty_ordered: number
    base_qty_received: number
    discount_type: string
    discount_value: number
    discount_amount: number
    subtotal: number
    expired_date?: string | null
}

interface ReceiptItemDetail {
    id: number
    product_name: string
    base_unit: string
    unit_name: string
    conversion_factor: number
    qty_received: number
    free_qty_received: number
    base_qty_received: number
    unit_cost: number
    base_unit_cost: number
    batch_number: string | null
    expired_date: string | null
}

interface ReceiptDetail {
    id: number
    receipt_number: string
    supplier_delivery_note: string | null
    received_date: string
    received_by_name: string
    notes: string | null
    created_at: string
    items: ReceiptItemDetail[]
}

interface PaymentHistoryRow {
    id: number
    payment_number: string
    amount: number
    payment_date: string
    payment_method: string
    payment_method_label: string
    financial_account_name: string
    reference_number: string | null
    notes: string | null
    paid_by_name: string
    created_at: string
}

interface AccountPayableDetail {
    id: number
    payable_number: string
    invoice_number: string | null
    total_amount: number
    paid_amount: number
    remaining_amount: number
    due_date: string | null
    is_overdue: boolean
    status: string
    status_label: string
    payments: PaymentHistoryRow[]
}

interface POActivity {
    id: number
    description: string
    event: string | null
    causer_name: string
    created_at: string
    created_at_human: string
}

interface DetailPOPageProps {
    purchaseOrder: {
        id: number
        po_number: string
        order_date: string
        expected_date?: string | null
        received_at?: string | null
        due_date?: string | null
        submitted_at?: string | null
        approved_at?: string | null
        rejected_at?: string | null
        rejection_reason?: string | null
        status: string
        status_label: string
        receiving_status: string
        receiving_status_label: string
        payment_status: string
        payment_status_label: string
        is_locked: boolean
        subtotal: number | string
        discount_type: string
        discount_value: number | string
        discount_amount: number | string
        tax_type: string
        tax_value: number | string
        tax_percentage: number | string
        tax_amount: number | string
        total_amount: number | string
        notes?: string | null
        created_at: string
        supplier: SupplierDetail | null
        creator: { id: number; name: string; role?: string } | null
        approved_by: { id: number; name: string } | null
        rejected_by: { id: number; name: string } | null
        received_by: { id: number; name: string } | null
        items: ItemDetail[]
        receipts: ReceiptDetail[]
        account_payable: AccountPayableDetail | null
    }
    permissions: {
        canEdit: boolean
        canDelete: boolean
        canSubmit: boolean
        canApprove: boolean
        canReject: boolean
        canRevise: boolean
        canReceive: boolean
        canCloseRemaining: boolean
        canRecordPayment: boolean
        canCancel: boolean
    }
    financialAccounts: FinancialAccountOption[]
    paymentMethods: SelectOptionItem[]
    activities: POActivity[]
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

export function DetailPurchaseOrder({
    purchaseOrder,
    permissions,
    financialAccounts,
    paymentMethods,
    activities,
}: DetailPOPageProps) {
    const { flash } = useAuth()
    const [activeTab, setActiveTab] = React.useState('detail')
    const [receiveOpen, setReceiveOpen] = React.useState(false)
    const [paymentOpen, setPaymentOpen] = React.useState(false)
    const [rejectOpen, setRejectOpen] = React.useState(false)
    const [approveOpen, setApproveOpen] = React.useState(false)
    const [submitOpen, setSubmitOpen] = React.useState(false)
    const [closeRemainingOpen, setCloseRemainingOpen] = React.useState(false)
    const [closeReason, setCloseReason] = React.useState('')
    const [cancelOpen, setCancelOpen] = React.useState(false)
    const [cancelReason, setCancelReason] = React.useState('')
    const [processing, setProcessing] = React.useState(false)

    React.useEffect(() => {
        if (flash?.success) toast.success(flash.success)
        if (flash?.error) toast.error(flash.error)
    }, [flash?.success, flash?.error])

    const statusCfg = poStatusBadgeConfig[purchaseOrder.status] ?? {
        label: purchaseOrder.status_label,
        className: '',
    }
    const receivingCfg = receivingStatusBadgeConfig[purchaseOrder.receiving_status] ?? {
        label: purchaseOrder.receiving_status_label,
        className: '',
    }
    const paymentCfg = paymentStatusBadgeConfig[purchaseOrder.payment_status] ?? {
        label: purchaseOrder.payment_status_label,
        className: '',
    }

    const totalBaseOrdered = purchaseOrder.items.reduce((acc, it) => acc + it.base_qty_ordered, 0)
    const totalBaseReceived = purchaseOrder.items.reduce((acc, it) => acc + it.base_qty_received, 0)
    const overallProgress =
        totalBaseOrdered > 0 ? Math.min(100, Math.round((totalBaseReceived / totalBaseOrdered) * 100)) : 0

    const remainingPayable =
        purchaseOrder.account_payable?.remaining_amount ?? Number(purchaseOrder.total_amount)

    const runAction = (url: string, payload: Record<string, string> = {}, onDone?: () => void) => {
        setProcessing(true)
        router.post(url, payload, {
            preserveScroll: true,
            onFinish: () => {
                setProcessing(false)
                onDone?.()
            },
        })
    }

    return (
        <div className="w-full min-w-0 space-y-6">
            {/* Top Bar */}
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                    <Button
                        variant="ghost"
                        size="sm"
                        render={<Link href={PurchaseOrderController.index.url()} />}
                        className="gap-1.5 text-muted-foreground hover:text-foreground -ml-2 shrink-0"
                    >
                        <ArrowLeft className="h-4 w-4" />
                        Kembali
                    </Button>
                    <div className="h-4 w-px bg-border shrink-0" />
                    <div className="flex flex-wrap items-center gap-2 min-w-0">
                        <h1 className="text-xl font-bold font-mono tracking-tight text-foreground truncate">
                            {purchaseOrder.po_number}
                        </h1>
                        <Badge variant="outline" className={`text-xs ${statusCfg.className}`}>
                            {statusCfg.label}
                        </Badge>
                        <Badge variant="outline" className={`text-xs ${receivingCfg.className}`}>
                            {receivingCfg.label}
                        </Badge>
                        <Badge variant="outline" className={`text-xs ${paymentCfg.className}`}>
                            {paymentCfg.label}
                        </Badge>
                        {purchaseOrder.is_locked && (
                            <Badge className="text-xs gap-1 bg-emerald-700 text-white dark:bg-emerald-800">
                                <Lock className="h-3 w-3" />
                                Terkunci
                            </Badge>
                        )}
                    </div>
                </div>

                {/* Action Buttons */}
                <div className="flex flex-wrap items-center gap-2">
                    {permissions.canSubmit && (
                        <Button
                            size="sm"
                            onClick={() => setSubmitOpen(true)}
                            className="bg-blue-600 hover:bg-blue-700 text-white gap-1.5 text-xs"
                        >
                            <Send className="h-3.5 w-3.5" />
                            Ajukan Persetujuan
                        </Button>
                    )}

                    {permissions.canApprove && (
                        <Button
                            size="sm"
                            onClick={() => setApproveOpen(true)}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 text-xs"
                        >
                            <ShieldCheck className="h-3.5 w-3.5" />
                            Setujui PO (ACC)
                        </Button>
                    )}

                    {permissions.canReject && (
                        <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => setRejectOpen(true)}
                            className="gap-1.5 text-xs"
                        >
                            <XCircle className="h-3.5 w-3.5" />
                            Tolak PO
                        </Button>
                    )}

                    {permissions.canRevise && (
                        <Button
                            variant="outline"
                            size="sm"
                            disabled={processing}
                            onClick={() => runAction(PurchaseOrderController.revise.url(purchaseOrder.id))}
                            className="gap-1.5 text-xs"
                        >
                            <RotateCcw className="h-3.5 w-3.5" />
                            Revisi ke Draft
                        </Button>
                    )}

                    {permissions.canReceive && (
                        <Button
                            size="sm"
                            onClick={() => setReceiveOpen(true)}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 text-xs"
                        >
                            <PackageCheck className="h-4 w-4" />
                            Terima Barang (LPB)
                        </Button>
                    )}

                    {permissions.canRecordPayment && (
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setPaymentOpen(true)}
                            className="gap-1.5 text-xs border-primary/40 text-primary hover:bg-primary/5"
                        >
                            <CreditCard className="h-3.5 w-3.5" />
                            Catat Pembayaran
                        </Button>
                    )}

                    {permissions.canCloseRemaining && (
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setCloseRemainingOpen(true)}
                            className="border-amber-300 text-amber-700 hover:bg-amber-50 dark:hover:bg-amber-950/40 text-xs gap-1.5"
                        >
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            Tutup Sisa
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
                                Cetak PO (PDF)
                            </a>
                        }
                    />

                    {permissions.canEdit && !purchaseOrder.is_locked && (
                        <Button
                            variant="outline"
                            size="sm"
                            render={
                                <Link
                                    href={PurchaseOrderController.edit.url(purchaseOrder.id)}
                                    className="flex items-center gap-1.5 text-xs"
                                >
                                    <Pencil className="h-3.5 w-3.5" />
                                    Edit PO
                                </Link>
                            }
                        />
                    )}

                    {permissions.canCancel && !purchaseOrder.is_locked && (
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setCancelOpen(true)}
                            className="text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-xs gap-1.5"
                        >
                            <Ban className="h-3.5 w-3.5" />
                            Batalkan
                        </Button>
                    )}
                </div>
            </div>

            {/* Banner Terkunci Permanen */}
            {purchaseOrder.is_locked && (
                <div className="flex items-center gap-3 rounded-lg border border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/40 px-4 py-3 text-xs text-emerald-900 dark:text-emerald-200">
                    <Lock className="h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                    <div>
                        <strong className="block">Dokumen Terkunci Permanen (Lunas & Diterima Penuh)</strong>
                        Seluruh barang telah diterima dan tagihan hutang telah lunas dibayar. Dokumen ini bersifat
                        read-only dan tidak dapat diedit maupun dihapus demi integritas stok dan pembukuan.
                    </div>
                </div>
            )}

            {/* Banner Ditolak */}
            {purchaseOrder.status === 'rejected' && (
                <div className="flex items-start gap-3 rounded-lg border border-rose-300 bg-rose-50 dark:border-rose-800 dark:bg-rose-950/40 px-4 py-3 text-xs text-rose-900 dark:text-rose-200">
                    <AlertTriangle className="h-5 w-5 shrink-0 text-rose-600 dark:text-rose-400 mt-0.5" />
                    <div>
                        <strong className="block">
                            Purchase Order Ditolak oleh {purchaseOrder.rejected_by?.name || 'Admin'}{' '}
                            {purchaseOrder.rejected_at ? `(${purchaseOrder.rejected_at})` : ''}
                        </strong>
                        <p className="mt-1">{purchaseOrder.rejection_reason || '-'}</p>
                    </div>
                </div>
            )}

            {/* Tabs */}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full space-y-4">
                <TabsList
                    variant="line"
                    className="w-full justify-start border-b border-border gap-5 rounded-none p-0 bg-transparent overflow-x-auto"
                >
                    <TabsTrigger value="detail" className="gap-2 pb-2.5 shrink-0">
                        <Building2 className="h-4 w-4" />
                        Ringkasan PO
                    </TabsTrigger>
                    <TabsTrigger value="items" className="gap-2 pb-2.5 shrink-0">
                        <Package className="h-4 w-4" />
                        Daftar Item
                        <Badge variant="secondary" className="px-1.5 py-0 text-[10px] font-mono">
                            {purchaseOrder.items.length}
                        </Badge>
                    </TabsTrigger>
                    <TabsTrigger value="receipts" className="gap-2 pb-2.5 shrink-0">
                        <ClipboardList className="h-4 w-4" />
                        Riwayat Penerimaan (LPB)
                        <Badge variant="secondary" className="px-1.5 py-0 text-[10px] font-mono">
                            {purchaseOrder.receipts.length}
                        </Badge>
                    </TabsTrigger>
                    <TabsTrigger value="payments" className="gap-2 pb-2.5 shrink-0">
                        <Wallet className="h-4 w-4" />
                        Pembayaran & Hutang
                        {purchaseOrder.account_payable && (
                            <Badge variant="secondary" className="px-1.5 py-0 text-[10px] font-mono">
                                {purchaseOrder.account_payable.payments.length}
                            </Badge>
                        )}
                    </TabsTrigger>
                    <TabsTrigger value="history" className="gap-2 pb-2.5 shrink-0">
                        <History className="h-4 w-4" />
                        Log Aktivitas
                        <Badge variant="secondary" className="px-1.5 py-0 text-[10px] font-mono">
                            {activities.length}
                        </Badge>
                    </TabsTrigger>
                </TabsList>

                {/* TAB 1: RINGKASAN PO */}
                <TabsContent value="detail" className="m-0 space-y-6 focus-visible:outline-none">
                    <Card>
                        <CardContent className="p-6">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                <div className="flex items-center gap-4">
                                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border bg-muted">
                                        <ShoppingBag className="h-7 w-7 text-muted-foreground" />
                                    </div>
                                    <div>
                                        <h2 className="text-xl font-bold font-mono text-foreground">
                                            {purchaseOrder.po_number}
                                        </h2>
                                        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                                            <span className="font-semibold text-foreground">
                                                {purchaseOrder.supplier?.name || '-'}
                                            </span>
                                            {purchaseOrder.supplier?.code && (
                                                <Badge variant="secondary" className="font-mono text-[11px]">
                                                    {purchaseOrder.supplier.code}
                                                </Badge>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <div className="sm:text-right min-w-[220px] border-t sm:border-t-0 pt-3 sm:pt-0">
                                    <span className="text-xs text-muted-foreground block">Grand Total Tagihan</span>
                                    <div className="text-2xl font-extrabold font-mono text-primary">
                                        {formatRupiah(purchaseOrder.total_amount)}
                                    </div>
                                    <div className="text-xs text-muted-foreground mt-1">
                                        Realisasi Terima: <strong className="text-foreground">{overallProgress}%</strong> (
                                        {totalBaseReceived.toLocaleString('id-ID')}/{totalBaseOrdered.toLocaleString('id-ID')} unit dasar)
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

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <Card>
                            <CardHeader className="pb-3">
                                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                                    <Building2 className="h-4 w-4 text-primary" />
                                    Informasi Supplier
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-3.5">
                                <DetailItem icon={Building2} label="Supplier" value={purchaseOrder.supplier?.name || '-'} />
                                <DetailItem icon={Phone} label="Telepon" value={purchaseOrder.supplier?.phone || '-'} />
                                <DetailItem
                                    icon={Clock}
                                    label="Tempo Pembayaran"
                                    value={
                                        (purchaseOrder.supplier?.payment_term_days ?? 0) > 0
                                            ? `${purchaseOrder.supplier?.payment_term_days} Hari`
                                            : 'COD / Tunai'
                                    }
                                />
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader className="pb-3">
                                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                                    <Calendar className="h-4 w-4 text-primary" />
                                    Jadwal & Jejak Audit Approval
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-3.5">
                                <DetailItem icon={Calendar} label="Tanggal Pesan" value={purchaseOrder.order_date} />
                                <DetailItem icon={Clock} label="Jatuh Tempo" value={purchaseOrder.due_date || '-'} />
                                <DetailItem
                                    icon={UserCheck}
                                    label="Dibuat Oleh"
                                    value={`${purchaseOrder.creator?.name || 'Sistem'} (${purchaseOrder.creator?.role || '-'})`}
                                />
                                <DetailItem
                                    icon={ShieldCheck}
                                    label="Disetujui Oleh"
                                    value={
                                        purchaseOrder.approved_by
                                            ? `${purchaseOrder.approved_by.name} (${purchaseOrder.approved_at || '-'})`
                                            : 'Belum disetujui'
                                    }
                                />
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader className="pb-3">
                                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                                    <FileText className="h-4 w-4 text-primary" />
                                    Ringkasan Finansial
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-2 text-xs">
                                <div className="flex justify-between py-1 border-b">
                                    <span className="text-muted-foreground">Subtotal Item</span>
                                    <span className="font-mono font-medium">{formatRupiah(purchaseOrder.subtotal)}</span>
                                </div>
                                <div className="flex justify-between py-1 border-b text-muted-foreground">
                                    <span>Diskon Global</span>
                                    <span className="font-mono">- {formatRupiah(purchaseOrder.discount_amount)}</span>
                                </div>
                                <div className="flex justify-between py-1 border-b text-muted-foreground">
                                    <span>
                                        Pajak / PPN
                                        {purchaseOrder.tax_type === 'percent' && Number(purchaseOrder.tax_value) > 0
                                            ? ` (${Number(purchaseOrder.tax_value)}%)`
                                            : ''}
                                    </span>
                                    <span className="font-mono">+ {formatRupiah(purchaseOrder.tax_amount)}</span>
                                </div>
                                <div className="flex justify-between py-2 border-t text-sm font-bold">
                                    <span>Grand Total</span>
                                    <span className="font-mono text-primary">{formatRupiah(purchaseOrder.total_amount)}</span>
                                </div>
                                {purchaseOrder.notes && (
                                    <div className="pt-2 border-t">
                                        <span className="text-[11px] text-muted-foreground block mb-1">Catatan:</span>
                                        <p className="text-xs whitespace-pre-line text-foreground bg-muted/40 p-2.5 rounded-md border">
                                            {purchaseOrder.notes}
                                        </p>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>

                {/* TAB 2: DAFTAR ITEM */}
                <TabsContent value="items" className="m-0 focus-visible:outline-none">
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-base">Daftar Item Pesanan & Konversi Multi-UOM</CardTitle>
                            <CardDescription>
                                Snapshot satuan beli dan faktor konversi yang berlaku pada saat PO dibuat.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="p-0">
                            <div className="overflow-x-auto border-t">
                                <table className="w-full min-w-[920px] table-fixed text-xs text-left">
                                    <thead className="bg-muted/70 text-muted-foreground font-semibold border-b">
                                        <tr>
                                            <th className="p-3 w-[5%] text-center">No</th>
                                            <th className="p-3 w-[25%]">Produk & Konversi</th>
                                            <th className="p-3 w-[13%] text-center">Dipesan</th>
                                            <th className="p-3 w-[13%] text-center">Diterima</th>
                                            <th className="p-3 w-[14%] text-right">Harga Satuan</th>
                                            <th className="p-3 w-[13%] text-right">Diskon Item</th>
                                            <th className="p-3 w-[17%] text-right">Subtotal</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y">
                                        {purchaseOrder.items.map((item, idx) => (
                                            <tr key={item.id} className="hover:bg-muted/30">
                                                <td className="p-3 text-center font-mono text-muted-foreground">{idx + 1}</td>
                                                <td className="p-3 overflow-hidden text-ellipsis">
                                                    <div className="font-semibold text-foreground text-sm truncate">
                                                        {item.product_name}
                                                    </div>
                                                    <div className="font-mono text-[11px] text-muted-foreground">
                                                        1 {item.unit_name} = {item.conversion_factor} {item.base_unit}
                                                    </div>
                                                </td>
                                                <td className="p-3 text-center font-mono">
                                                    <div className="font-semibold">
                                                        {item.quantity_ordered} {item.unit_name}
                                                    </div>
                                                    {item.free_qty_ordered > 0 && (
                                                        <div className="text-[11px] text-emerald-600 dark:text-emerald-400">
                                                            +{item.free_qty_ordered} bonus
                                                        </div>
                                                    )}
                                                    <div className="text-[10px] text-muted-foreground">
                                                        ({item.base_qty_ordered} {item.base_unit})
                                                    </div>
                                                </td>
                                                <td className="p-3 text-center font-mono">
                                                    <div className="font-bold text-emerald-600 dark:text-emerald-400">
                                                        {item.quantity_received} {item.unit_name}
                                                    </div>
                                                    {item.free_qty_received > 0 && (
                                                        <div className="text-[11px] text-emerald-600 dark:text-emerald-400">
                                                            +{item.free_qty_received} bonus
                                                        </div>
                                                    )}
                                                    <div className="text-[10px] text-muted-foreground">
                                                        ({item.base_qty_received} {item.base_unit})
                                                    </div>
                                                </td>
                                                <td className="p-3 text-right font-mono">{formatRupiah(item.unit_cost)}</td>
                                                <td className="p-3 text-right font-mono text-muted-foreground">
                                                    {item.discount_amount > 0 ? `- ${formatRupiah(item.discount_amount)}` : '-'}
                                                </td>
                                                <td className="p-3 text-right font-mono font-bold text-foreground">
                                                    {formatRupiah(item.subtotal)}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* TAB 3: RIWAYAT PENERIMAAN BARANG (LPB) */}
                <TabsContent value="receipts" className="m-0 space-y-4 focus-visible:outline-none">
                    {purchaseOrder.receipts.length === 0 ? (
                        <Card>
                            <CardContent className="p-10 text-center text-xs text-muted-foreground">
                                Belum ada dokumen penerimaan barang (LPB) untuk PO ini.
                            </CardContent>
                        </Card>
                    ) : (
                        purchaseOrder.receipts.map((receipt) => (
                            <Card key={receipt.id}>
                                <CardHeader className="pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                    <div>
                                        <CardTitle className="text-sm font-mono flex items-center gap-2">
                                            <ClipboardList className="h-4 w-4 text-emerald-600" />
                                            {receipt.receipt_number}
                                        </CardTitle>
                                        <CardDescription className="text-xs">
                                            Tanggal Terima: <strong>{receipt.received_date}</strong> • Petugas:{' '}
                                            <strong>{receipt.received_by_name}</strong>
                                            {receipt.supplier_delivery_note && (
                                                <>
                                                    {' '}
                                                    • Surat Jalan: <strong className="font-mono">{receipt.supplier_delivery_note}</strong>
                                                </>
                                            )}
                                        </CardDescription>
                                    </div>
                                    <Button
                                        variant="outline"
                                        size="xs"
                                        render={
                                            <a
                                                href={PurchaseOrderController.downloadReceiptPdf.url({
                                                    purchaseOrder: purchaseOrder.id,
                                                    receipt: receipt.id,
                                                })}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="flex items-center gap-1.5"
                                            >
                                                <FileDown className="h-3.5 w-3.5" />
                                                Cetak LPB
                                            </a>
                                        }
                                    />
                                </CardHeader>
                                <CardContent className="p-0">
                                    <div className="overflow-x-auto border-t">
                                        <table className="w-full min-w-[780px] table-fixed text-xs text-left">
                                            <thead className="bg-muted/60 text-muted-foreground font-semibold border-b">
                                                <tr>
                                                    <th className="p-2.5 w-[28%]">Produk</th>
                                                    <th className="p-2.5 w-[16%] text-center">Qty Terima</th>
                                                    <th className="p-2.5 w-[12%] text-center">Bonus</th>
                                                    <th className="p-2.5 w-[16%] text-center">Masuk Stok Dasar</th>
                                                    <th className="p-2.5 w-[14%] text-right">HPP Dasar Batch</th>
                                                    <th className="p-2.5 w-[14%]">Batch / Exp</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y">
                                                {receipt.items.map((rItem) => (
                                                    <tr key={rItem.id}>
                                                        <td className="p-2.5 font-medium truncate">{rItem.product_name}</td>
                                                        <td className="p-2.5 text-center font-mono">
                                                            {rItem.qty_received} {rItem.unit_name}
                                                        </td>
                                                        <td className="p-2.5 text-center font-mono text-emerald-600">
                                                            {rItem.free_qty_received > 0 ? `+${rItem.free_qty_received}` : '-'}
                                                        </td>
                                                        <td className="p-2.5 text-center font-mono font-bold text-emerald-600">
                                                            +{rItem.base_qty_received} {rItem.base_unit}
                                                        </td>
                                                        <td className="p-2.5 text-right font-mono">
                                                            {formatRupiah(rItem.base_unit_cost)}
                                                        </td>
                                                        <td className="p-2.5 font-mono text-[11px] text-muted-foreground">
                                                            <div>{rItem.batch_number || '-'}</div>
                                                            {rItem.expired_date && <div>Exp: {rItem.expired_date}</div>}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                    {receipt.notes && (
                                        <div className="px-4 py-2.5 border-t bg-muted/20 text-xs text-muted-foreground">
                                            Catatan: {receipt.notes}
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        ))
                    )}
                </TabsContent>

                {/* TAB 4: PEMBAYARAN & HUTANG DAGANG */}
                <TabsContent value="payments" className="m-0 space-y-4 focus-visible:outline-none">
                    {!purchaseOrder.account_payable ? (
                        <Card>
                            <CardContent className="p-10 text-center text-xs text-muted-foreground">
                                Catatan hutang dagang akan otomatis terbentuk setelah Purchase Order disetujui (Approved).
                            </CardContent>
                        </Card>
                    ) : (
                        <>
                            <Card>
                                <CardContent className="p-5 grid grid-cols-1 sm:grid-cols-4 gap-4 text-xs">
                                    <div>
                                        <span className="text-muted-foreground block">No. Hutang (AP)</span>
                                        <span className="font-mono font-bold text-sm text-foreground">
                                            {purchaseOrder.account_payable.payable_number}
                                        </span>
                                        {purchaseOrder.account_payable.invoice_number && (
                                            <span className="block font-mono text-[11px] text-muted-foreground">
                                                Faktur: {purchaseOrder.account_payable.invoice_number}
                                            </span>
                                        )}
                                    </div>
                                    <div>
                                        <span className="text-muted-foreground block">Total Tagihan</span>
                                        <span className="font-mono font-bold text-sm text-foreground">
                                            {formatRupiah(purchaseOrder.account_payable.total_amount)}
                                        </span>
                                    </div>
                                    <div>
                                        <span className="text-muted-foreground block">Sudah Dibayar</span>
                                        <span className="font-mono font-bold text-sm text-emerald-600 dark:text-emerald-400">
                                            {formatRupiah(purchaseOrder.account_payable.paid_amount)}
                                        </span>
                                    </div>
                                    <div>
                                        <span className="text-muted-foreground block">Sisa Hutang</span>
                                        <span className="font-mono font-extrabold text-base text-rose-600 dark:text-rose-400">
                                            {formatRupiah(purchaseOrder.account_payable.remaining_amount)}
                                        </span>
                                    </div>
                                </CardContent>
                            </Card>

                            <Card>
                                <CardHeader className="pb-3 flex flex-row items-center justify-between">
                                    <div>
                                        <CardTitle className="text-base">Riwayat Pembayaran / Cicilan</CardTitle>
                                        <CardDescription>
                                            Setiap pembayaran otomatis memotong saldo akun kas/bank dan tercatat di buku arus kas.
                                        </CardDescription>
                                    </div>
                                    {permissions.canRecordPayment && (
                                        <Button size="sm" onClick={() => setPaymentOpen(true)} className="gap-1.5 text-xs">
                                            <CreditCard className="h-3.5 w-3.5" />
                                            Catat Pembayaran
                                        </Button>
                                    )}
                                </CardHeader>
                                <CardContent className="p-0">
                                    {purchaseOrder.account_payable.payments.length === 0 ? (
                                        <div className="p-8 text-center text-xs text-muted-foreground border-t">
                                            Belum ada pembayaran yang dicatat untuk tagihan ini.
                                        </div>
                                    ) : (
                                        <div className="overflow-x-auto border-t">
                                            <table className="w-full min-w-[760px] table-fixed text-xs text-left">
                                                <thead className="bg-muted/70 text-muted-foreground font-semibold border-b">
                                                    <tr>
                                                        <th className="p-3 w-[17%]">No. Bukti Bayar</th>
                                                        <th className="p-3 w-[13%]">Tanggal</th>
                                                        <th className="p-3 w-[19%]">Sumber Akun</th>
                                                        <th className="p-3 w-[14%]">Metode & Ref</th>
                                                        <th className="p-3 w-[16%] text-right">Nominal</th>
                                                        <th className="p-3 w-[21%]">Catatan & Petugas</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y">
                                                    {purchaseOrder.account_payable.payments.map((pay) => (
                                                        <tr key={pay.id} className="hover:bg-muted/30">
                                                            <td className="p-3 font-mono font-semibold text-primary truncate">
                                                                {pay.payment_number}
                                                            </td>
                                                            <td className="p-3 font-mono">{pay.payment_date}</td>
                                                            <td className="p-3 font-medium truncate">{pay.financial_account_name}</td>
                                                            <td className="p-3">
                                                                <div>{pay.payment_method_label}</div>
                                                                {pay.reference_number && (
                                                                    <div className="font-mono text-[10px] text-muted-foreground truncate">
                                                                        {pay.reference_number}
                                                                    </div>
                                                                )}
                                                            </td>
                                                            <td className="p-3 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                                                                {formatRupiah(pay.amount)}
                                                            </td>
                                                            <td className="p-3 text-muted-foreground">
                                                                <div className="truncate">{pay.notes || '-'}</div>
                                                                <div className="text-[10px]">Oleh: {pay.paid_by_name}</div>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        </>
                    )}
                </TabsContent>

                {/* TAB 5: LOG AKTIVITAS */}
                <TabsContent value="history" className="m-0 focus-visible:outline-none">
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-base">Log Aktivitas Dokumen PO</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            {activities.length === 0 ? (
                                <p className="text-xs text-muted-foreground text-center py-6">Belum ada log aktivitas.</p>
                            ) : (
                                activities.map((act) => (
                                    <div key={act.id} className="rounded-lg border p-3 text-xs space-y-1">
                                        <div className="flex items-center justify-between gap-2">
                                            <span className="font-semibold text-foreground">{act.description}</span>
                                            <span className="font-mono text-[11px] text-muted-foreground shrink-0">
                                                {act.created_at}
                                            </span>
                                        </div>
                                        <div className="text-[11px] text-muted-foreground">
                                            Oleh: <strong>{act.causer_name}</strong> ({act.created_at_human})
                                        </div>
                                    </div>
                                ))
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>

            {/* Modals */}
            {permissions.canReceive && (
                <ReceiveGoodsDialog
                    poId={purchaseOrder.id}
                    poNumber={purchaseOrder.po_number}
                    items={purchaseOrder.items}
                    open={receiveOpen}
                    onOpenChange={setReceiveOpen}
                />
            )}

            {permissions.canRecordPayment && (
                <RecordPaymentDialog
                    postUrl={PurchaseOrderController.recordPayment.url(purchaseOrder.id)}
                    title={`Catat Pembayaran: ${purchaseOrder.po_number}`}
                    remainingAmount={remainingPayable}
                    invoiceNumber={purchaseOrder.account_payable?.invoice_number}
                    financialAccounts={financialAccounts}
                    paymentMethods={paymentMethods}
                    open={paymentOpen}
                    onOpenChange={setPaymentOpen}
                />
            )}

            {permissions.canReject && (
                <RejectPurchaseOrderDialog
                    poId={purchaseOrder.id}
                    poNumber={purchaseOrder.po_number}
                    open={rejectOpen}
                    onOpenChange={setRejectOpen}
                />
            )}

            {/* Confirm Submit */}
            <AlertDialog open={submitOpen} onOpenChange={setSubmitOpen}>
                <AlertDialogContent size="sm">
                    <AlertDialogHeader>
                        <AlertDialogTitle>Ajukan Persetujuan PO</AlertDialogTitle>
                        <AlertDialogDescription>
                            Ajukan PO <strong>{purchaseOrder.po_number}</strong> untuk diproses persetujuan Admin?
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={processing}>Batal</AlertDialogCancel>
                        <AlertDialogAction
                            disabled={processing}
                            onClick={() =>
                                runAction(PurchaseOrderController.submit.url(purchaseOrder.id), {}, () => setSubmitOpen(false))
                            }
                        >
                            {processing ? 'Memproses...' : 'Ya, Ajukan'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Confirm Approve */}
            <AlertDialog open={approveOpen} onOpenChange={setApproveOpen}>
                <AlertDialogContent size="sm">
                    <AlertDialogHeader>
                        <AlertDialogTitle>Setujui Purchase Order</AlertDialogTitle>
                        <AlertDialogDescription>
                            Setujui PO <strong>{purchaseOrder.po_number}</strong> senilai{' '}
                            <strong>{formatRupiah(purchaseOrder.total_amount)}</strong>? Hutang dagang akan otomatis
                            terbentuk dan gudang dapat mulai menerima barang.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={processing}>Batal</AlertDialogCancel>
                        <AlertDialogAction
                            disabled={processing}
                            onClick={() =>
                                runAction(PurchaseOrderController.approve.url(purchaseOrder.id), {}, () =>
                                    setApproveOpen(false)
                                )
                            }
                            className="bg-emerald-600 hover:bg-emerald-700 text-white"
                        >
                            {processing ? 'Menyetujui...' : 'Ya, Setujui PO'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Confirm Close Remaining */}
            <AlertDialog open={closeRemainingOpen} onOpenChange={setCloseRemainingOpen}>
                <AlertDialogContent size="sm">
                    <AlertDialogHeader>
                        <AlertDialogTitle>Tutup Sisa Pesanan</AlertDialogTitle>
                        <AlertDialogDescription className="space-y-2">
                            <span>
                                Total PO dan hutang dagang akan disesuaikan hanya berdasarkan jumlah barang yang sudah
                                diterima, dan status penerimaan akan ditandai Selesai.
                            </span>
                            <textarea
                                rows={2}
                                value={closeReason}
                                onChange={(e) => setCloseReason(e.target.value)}
                                placeholder="Alasan penutupan sisa pesanan (opsional)..."
                                className="w-full rounded-md border border-input bg-background p-2 text-xs text-foreground"
                            />
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={processing}>Batal</AlertDialogCancel>
                        <AlertDialogAction
                            disabled={processing}
                            onClick={() =>
                                runAction(
                                    PurchaseOrderController.closeRemaining.url(purchaseOrder.id),
                                    { reason: closeReason },
                                    () => setCloseRemainingOpen(false)
                                )
                            }
                        >
                            {processing ? 'Memproses...' : 'Ya, Tutup Sisa'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Confirm Cancel */}
            <AlertDialog open={cancelOpen} onOpenChange={setCancelOpen}>
                <AlertDialogContent size="sm">
                    <AlertDialogHeader>
                        <AlertDialogTitle>Batalkan Purchase Order</AlertDialogTitle>
                        <AlertDialogDescription className="space-y-2">
                            <span>Yakin ingin membatalkan PO {purchaseOrder.po_number}?</span>
                            <textarea
                                rows={2}
                                value={cancelReason}
                                onChange={(e) => setCancelReason(e.target.value)}
                                placeholder="Alasan pembatalan (opsional)..."
                                className="w-full rounded-md border border-input bg-background p-2 text-xs text-foreground"
                            />
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={processing}>Batal</AlertDialogCancel>
                        <AlertDialogAction
                            variant="destructive"
                            disabled={processing}
                            onClick={() =>
                                runAction(
                                    PurchaseOrderController.cancel.url(purchaseOrder.id),
                                    { reason: cancelReason },
                                    () => setCancelOpen(false)
                                )
                            }
                        >
                            {processing ? 'Membatalkan...' : 'Ya, Batalkan PO'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    )
}

DetailPurchaseOrder.layout = (page: React.ReactNode) => (
    <AuthenticatedLayout>{page}</AuthenticatedLayout>
)

export default DetailPurchaseOrder

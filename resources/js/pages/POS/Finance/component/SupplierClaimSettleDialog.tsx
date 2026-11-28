import React, { useEffect, useMemo, useState } from 'react'
import { router } from '@inertiajs/react'
import { Button } from '@/components/ui/button'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import SupplierPromoClaimController from '@/actions/App/Http/Controllers/SupplierPromoClaimController'
import { Banknote, FileMinus2, PackagePlus } from 'lucide-react'
import { formatIdrCurrency, type SupplierPromoClaimRow } from './supplierPromoClaimColumns'

export interface OpenPayableOption {
    id: number
    supplier_id: number
    payable_number: string
    invoice_number: string | null
    supplier_name: string
    remaining_amount: number
}

export interface ClaimProductOption {
    id: number
    name: string
    barcode: string
    base_unit: string
}

export interface ClaimAccountOption {
    id: number
    code: string
    name: string
}

interface SupplierClaimSettleDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    targetRows: SupplierPromoClaimRow[]
    openPayables: OpenPayableOption[]
    products: ClaimProductOption[]
    financialAccounts: ClaimAccountOption[]
    incomeCategories: ClaimAccountOption[]
    onSuccess?: () => void
}

const SETTLEMENT_CARDS = [
    {
        value: 'credit_note' as const,
        label: 'Potong Tagihan (Credit Note)',
        desc: 'Kurangi sisa hutang dagang (AP) ke supplier terkait.',
        icon: FileMinus2,
    },
    {
        value: 'free_goods' as const,
        label: 'Ganti Barang (Free Goods)',
        desc: 'Terima barang pengganti gratis & tambah stok otomatis.',
        icon: PackagePlus,
    },
    {
        value: 'transfer_reimburse' as const,
        label: 'Transfer Reimburse',
        desc: 'Dana masuk ke akun kas/bank & tercatat di Buku Arus Kas.',
        icon: Banknote,
    },
]

export function SupplierClaimSettleDialog({
    open,
    onOpenChange,
    targetRows,
    openPayables,
    products,
    financialAccounts,
    incomeCategories,
    onSuccess,
}: SupplierClaimSettleDialogProps) {
    const [action, setAction] = useState<'settle' | 'mark_claimed'>('settle')
    const [method, setMethod] = useState<'credit_note' | 'free_goods' | 'transfer_reimburse'>(
        'credit_note'
    )
    const [accountPayableId, setAccountPayableId] = useState('')
    const [productId, setProductId] = useState('')
    const [productQty, setProductQty] = useState('1')
    const [financialAccountId, setFinancialAccountId] = useState('')
    const [financialCategoryId, setFinancialCategoryId] = useState('')
    const [claimReference, setClaimReference] = useState('')
    const [claimNotes, setClaimNotes] = useState('')
    const [errors, setErrors] = useState<Record<string, string>>({})
    const [isSubmitting, setIsSubmitting] = useState(false)

    const totalClaimAmount = useMemo(
        () => targetRows.reduce((sum, r) => sum + r.supplier_discount_amount, 0),
        [targetRows]
    )

    const targetSupplierIds = useMemo(
        () => new Set(targetRows.map((r) => r.supplier_id).filter((id): id is number => id !== null)),
        [targetRows]
    )

    const filteredPayables = useMemo(() => {
        if (targetSupplierIds.size === 0) return openPayables
        const matched = openPayables.filter((ap) => targetSupplierIds.has(ap.supplier_id))
        return matched.length > 0 ? matched : openPayables
    }, [openPayables, targetSupplierIds])

    const payableItems = useMemo(
        () => [
            { value: 'none', label: 'Tanpa potong AP spesifik (Catat Credit Note saja)' },
            ...filteredPayables.map((ap) => ({
                value: String(ap.id),
                label: `${ap.payable_number} • ${ap.supplier_name} (Sisa ${formatIdrCurrency(ap.remaining_amount)})`,
            })),
        ],
        [filteredPayables]
    )

    const productItems = useMemo(
        () =>
            products.map((p) => ({
                value: String(p.id),
                label: `${p.name} (${p.barcode}) — ${p.base_unit}`,
            })),
        [products]
    )

    const accountItems = useMemo(
        () =>
            financialAccounts.map((a) => ({
                value: String(a.id),
                label: `${a.name} (${a.code})`,
            })),
        [financialAccounts]
    )

    const categoryItems = useMemo(
        () => [
            { value: 'auto', label: 'Otomatis (Reimburse Klaim Promo Supplier)' },
            ...incomeCategories.map((c) => ({
                value: String(c.id),
                label: `${c.name} (${c.code})`,
            })),
        ],
        [incomeCategories]
    )

    useEffect(() => {
        if (!open) return
        setErrors({})
        setAction('settle')
        setMethod('credit_note')
        setAccountPayableId(filteredPayables[0] ? String(filteredPayables[0].id) : 'none')
        setProductId(products[0] ? String(products[0].id) : '')
        setProductQty('1')
        setFinancialAccountId(financialAccounts[0] ? String(financialAccounts[0].id) : '')
        setFinancialCategoryId('auto')
        setClaimReference(targetRows.length === 1 ? (targetRows[0].claim_reference ?? '') : '')
        setClaimNotes(targetRows.length === 1 ? (targetRows[0].claim_notes ?? '') : '')
    }, [open, targetRows, filteredPayables, products, financialAccounts])

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        if (targetRows.length === 0) return
        setIsSubmitting(true)
        setErrors({})

        router.post(
            SupplierPromoClaimController.settle.url(),
            {
                ids: targetRows.map((r) => r.id),
                action,
                settlement_method: action === 'settle' ? method : null,
                account_payable_id:
                    action === 'settle' && method === 'credit_note' && accountPayableId !== 'none'
                        ? Number(accountPayableId)
                        : null,
                product_id:
                    action === 'settle' && method === 'free_goods' && productId
                        ? Number(productId)
                        : null,
                product_qty:
                    action === 'settle' && method === 'free_goods'
                        ? Math.max(1, Number(productQty) || 1)
                        : null,
                financial_account_id:
                    action === 'settle' && method === 'transfer_reimburse' && financialAccountId
                        ? Number(financialAccountId)
                        : null,
                financial_category_id:
                    action === 'settle' &&
                    method === 'transfer_reimburse' &&
                    financialCategoryId !== 'auto'
                        ? Number(financialCategoryId)
                        : null,
                claim_reference: claimReference.trim() || null,
                claim_notes: claimNotes.trim() || null,
            },
            {
                preserveScroll: true,
                onError: (errs) => setErrors(errs),
                onSuccess: () => {
                    onOpenChange(false)
                    onSuccess?.()
                },
                onFinish: () => setIsSubmitting(false),
            }
        )
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="w-[calc(100%-2rem)] max-w-2xl sm:max-w-2xl max-h-[85vh] flex flex-col p-0 gap-0 overflow-hidden">
                <DialogHeader className="p-6 pb-4 pr-12 border-b shrink-0">
                    <DialogTitle>
                        Penyelesaian Klaim Promo Supplier ({targetRows.length} transaksi)
                    </DialogTitle>
                    <DialogDescription>
                        Total porsi yang ditagihkan ke supplier:{' '}
                        <span className="font-mono font-semibold text-foreground">
                            {formatIdrCurrency(totalClaimAmount)}
                        </span>
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
                    <div className="flex-1 overflow-y-auto overflow-x-hidden p-6 space-y-5">
                        {/* Tahap Tindakan */}
                        <div className="space-y-1.5">
                            <Label>Tindakan Klaim</Label>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                <button
                                    type="button"
                                    onClick={() => setAction('settle')}
                                    className={`rounded-lg border p-3 text-left transition-colors cursor-pointer ${
                                        action === 'settle'
                                            ? 'border-primary bg-primary/5 ring-1 ring-primary/30'
                                            : 'border-border hover:bg-muted/40'
                                    }`}
                                >
                                    <div className="text-xs font-semibold text-foreground">
                                        Selesaikan &amp; Lunaskan Klaim
                                    </div>
                                    <div className="text-[11px] text-muted-foreground mt-0.5">
                                        Pilih metode penyelesaian (Potong Tagihan / Ganti Barang / Transfer).
                                    </div>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setAction('mark_claimed')}
                                    className={`rounded-lg border p-3 text-left transition-colors cursor-pointer ${
                                        action === 'mark_claimed'
                                            ? 'border-primary bg-primary/5 ring-1 ring-primary/30'
                                            : 'border-border hover:bg-muted/40'
                                    }`}
                                >
                                    <div className="text-xs font-semibold text-foreground">
                                        Tandai Sudah Diajukan (Claimed)
                                    </div>
                                    <div className="text-[11px] text-muted-foreground mt-0.5">
                                        Catat bahwa klaim sudah dikirim ke supplier &amp; menunggu realisasi.
                                    </div>
                                </button>
                            </div>
                        </div>

                        {action === 'settle' && (
                            <>
                                {/* Metode Penyelesaian Supplier */}
                                <div className="space-y-2">
                                    <Label>
                                        Metode Penyelesaian Supplier <span className="text-destructive">*</span>
                                    </Label>
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                                        {SETTLEMENT_CARDS.map((card) => {
                                            const Icon = card.icon
                                            const active = method === card.value
                                            return (
                                                <button
                                                    key={card.value}
                                                    type="button"
                                                    onClick={() => setMethod(card.value)}
                                                    className={`rounded-lg border p-3 text-left transition-colors cursor-pointer space-y-1.5 ${
                                                        active
                                                            ? 'border-primary bg-primary/5 ring-1 ring-primary/30'
                                                            : 'border-border hover:bg-muted/40'
                                                    }`}
                                                >
                                                    <Icon
                                                        className={`h-4 w-4 ${active ? 'text-primary' : 'text-muted-foreground'}`}
                                                    />
                                                    <div className="text-xs font-semibold text-foreground leading-snug">
                                                        {card.label}
                                                    </div>
                                                    <div className="text-[11px] text-muted-foreground leading-snug">
                                                        {card.desc}
                                                    </div>
                                                </button>
                                            )
                                        })}
                                    </div>
                                    {errors.settlement_method && (
                                        <p className="text-xs text-destructive">{errors.settlement_method}</p>
                                    )}
                                </div>

                                {/* Detail input sesuai metode */}
                                {method === 'credit_note' && (
                                    <div className="rounded-lg border bg-muted/20 p-4 space-y-2">
                                        <Label>Pilih Hutang Dagang (AP) yang Dipotong</Label>
                                        <Select
                                            items={payableItems}
                                            value={accountPayableId}
                                            onValueChange={(v) => v && setAccountPayableId(v)}
                                        >
                                            <SelectTrigger className="w-full h-9">
                                                <SelectValue>
                                                    {(val) =>
                                                        payableItems.find((i) => i.value === val)?.label ??
                                                        'Pilih faktur hutang'
                                                    }
                                                </SelectValue>
                                            </SelectTrigger>
                                            <SelectContent>
                                                {payableItems.map((opt) => (
                                                    <SelectItem key={opt.value} value={opt.value}>
                                                        {opt.label}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <p className="text-[11px] text-muted-foreground">
                                            Sisa hutang dagang terpilih akan langsung berkurang sebesar{' '}
                                            <span className="font-mono font-semibold text-foreground">
                                                {formatIdrCurrency(totalClaimAmount)}
                                            </span>
                                            .
                                        </p>
                                        {errors.account_payable_id && (
                                            <p className="text-xs text-destructive">
                                                {errors.account_payable_id}
                                            </p>
                                        )}
                                    </div>
                                )}

                                {method === 'free_goods' && (
                                    <div className="rounded-lg border bg-muted/20 p-4 grid grid-cols-1 sm:grid-cols-12 gap-3">
                                        <div className="sm:col-span-8 space-y-1.5 min-w-0">
                                            <Label>
                                                Produk Pengganti (Free Goods) <span className="text-destructive">*</span>
                                            </Label>
                                            <Select
                                                items={productItems}
                                                value={productId}
                                                onValueChange={(v) => v && setProductId(v)}
                                            >
                                                <SelectTrigger className="w-full h-9">
                                                    <SelectValue>
                                                        {(val) =>
                                                            productItems.find((i) => i.value === val)?.label ??
                                                            'Pilih produk'
                                                        }
                                                    </SelectValue>
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {productItems.map((opt) => (
                                                        <SelectItem key={opt.value} value={opt.value}>
                                                            {opt.label}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                            {errors.product_id && (
                                                <p className="text-xs text-destructive">{errors.product_id}</p>
                                            )}
                                        </div>
                                        <div className="sm:col-span-4 space-y-1.5">
                                            <Label htmlFor="claim-free-qty">
                                                Qty Masuk Stok <span className="text-destructive">*</span>
                                            </Label>
                                            <Input
                                                id="claim-free-qty"
                                                type="number"
                                                min={1}
                                                value={productQty}
                                                onChange={(e) => setProductQty(e.target.value)}
                                                className="h-9 font-mono"
                                                required
                                            />
                                        </div>
                                    </div>
                                )}

                                {method === 'transfer_reimburse' && (
                                    <div className="rounded-lg border bg-muted/20 p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        <div className="space-y-1.5 min-w-0">
                                            <Label>
                                                Akun Kas / Bank Penerima <span className="text-destructive">*</span>
                                            </Label>
                                            <Select
                                                items={accountItems}
                                                value={financialAccountId}
                                                onValueChange={(v) => v && setFinancialAccountId(v)}
                                            >
                                                <SelectTrigger className="w-full h-9">
                                                    <SelectValue>
                                                        {(val) =>
                                                            accountItems.find((i) => i.value === val)?.label ??
                                                            'Pilih akun'
                                                        }
                                                    </SelectValue>
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {accountItems.map((opt) => (
                                                        <SelectItem key={opt.value} value={opt.value}>
                                                            {opt.label}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                            {errors.financial_account_id && (
                                                <p className="text-xs text-destructive">
                                                    {errors.financial_account_id}
                                                </p>
                                            )}
                                        </div>
                                        <div className="space-y-1.5 min-w-0">
                                            <Label>Kategori Pemasukan</Label>
                                            <Select
                                                items={categoryItems}
                                                value={financialCategoryId}
                                                onValueChange={(v) => v && setFinancialCategoryId(v)}
                                            >
                                                <SelectTrigger className="w-full h-9">
                                                    <SelectValue>
                                                        {(val) =>
                                                            categoryItems.find((i) => i.value === val)?.label ??
                                                            'Otomatis'
                                                        }
                                                    </SelectValue>
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {categoryItems.map((opt) => (
                                                        <SelectItem key={opt.value} value={opt.value}>
                                                            {opt.label}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>
                                )}
                            </>
                        )}

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <Label htmlFor="settle-ref">No. Referensi / Credit Note / Transfer</Label>
                                <Input
                                    id="settle-ref"
                                    value={claimReference}
                                    onChange={(e) => setClaimReference(e.target.value)}
                                    placeholder="Contoh: CN-2026-001 / TRF-9821"
                                    className="h-9 font-mono text-xs"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor="settle-notes">Catatan Penyelesaian (Opsional)</Label>
                                <Input
                                    id="settle-notes"
                                    value={claimNotes}
                                    onChange={(e) => setClaimNotes(e.target.value)}
                                    placeholder="Keterangan tambahan..."
                                    className="h-9 text-xs"
                                />
                            </div>
                        </div>
                    </div>

                    <DialogFooter className="p-6 pt-4 border-t shrink-0 flex items-center justify-end gap-2 bg-muted/20">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => onOpenChange(false)}
                            className="cursor-pointer"
                        >
                            Batal
                        </Button>
                        <Button type="submit" disabled={isSubmitting} className="cursor-pointer">
                            {isSubmitting
                                ? 'Memproses...'
                                : action === 'mark_claimed'
                                  ? 'Tandai Diajukan'
                                  : 'Simpan Penyelesaian'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}

export default SupplierClaimSettleDialog

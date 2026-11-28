import React, { useEffect, useMemo, useState } from 'react'
import { useForm } from '@inertiajs/react'
import { KeyRound, RotateCcw } from 'lucide-react'
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
import { Switch } from '@/components/ui/switch'
import transactions from '@/routes/pos/transactions'
import type {
    PosFinancialAccount,
    PosPaymentMethodOption,
    TransactionDetailLine,
} from '@/types'
import { formatRupiah } from './transactionUtils'

interface ReturnLineState {
    transaction_detail_id: number
    selected: boolean
    qty: number
    max_qty: number
    is_restockable: boolean
    unit_price: number
    product_name: string
    unit_name: string
}

interface SalesReturnDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    transactionId: number
    invoiceNumber: string
    details: TransactionDetailLine[]
    paymentMethods: PosPaymentMethodOption[]
    financialAccounts: PosFinancialAccount[]
}

export function SalesReturnDialog({
    open,
    onOpenChange,
    transactionId,
    invoiceNumber,
    details,
    paymentMethods,
    financialAccounts,
}: SalesReturnDialogProps) {
    const returnableDetails = useMemo(
        () => details.filter((d) => d.returnable_qty > 0),
        [details]
    )

    const [lines, setLines] = useState<ReturnLineState[]>([])
    const [localError, setLocalError] = useState<string | null>(null)

    const defaultAccountId = useMemo(() => {
        const drawer = financialAccounts.find((a) => a.code === 'KAS-001')
        return drawer ? String(drawer.id) : financialAccounts[0] ? String(financialAccounts[0].id) : ''
    }, [financialAccounts])

    const form = useForm({
        refund_method: 'cash',
        financial_account_id: defaultAccountId,
        reason: '',
        supervisor_pin: '',
        items: [] as { transaction_detail_id: number; qty: number; is_restockable: boolean }[],
    })

    const methodItems = useMemo(
        () => paymentMethods.map((m) => ({ value: m.value, label: m.label })),
        [paymentMethods]
    )

    const accountItems = useMemo(
        () =>
            financialAccounts.map((a) => ({
                value: String(a.id),
                label: `${a.name} (${a.code})`,
            })),
        [financialAccounts]
    )

    useEffect(() => {
        if (!open) return
        setLines(
            returnableDetails.map((d) => ({
                transaction_detail_id: d.id,
                selected: false,
                qty: 1,
                max_qty: d.returnable_qty,
                is_restockable: true,
                unit_price: d.qty > 0 ? d.subtotal / d.qty : d.unit_price,
                product_name: d.product_name,
                unit_name: d.unit_name,
            }))
        )
        form.reset()
        form.setData('financial_account_id', defaultAccountId)
        form.clearErrors()
        setLocalError(null)
    }, [open, returnableDetails, defaultAccountId])

    const estimatedRefund = useMemo(
        () =>
            lines
                .filter((l) => l.selected && l.qty > 0)
                .reduce((sum, l) => sum + Math.round(l.unit_price * l.qty * 100) / 100, 0),
        [lines]
    )

    const updateLine = (detailId: number, patch: Partial<ReturnLineState>) => {
        setLines((prev) =>
            prev.map((l) => (l.transaction_detail_id === detailId ? { ...l, ...patch } : l))
        )
    }

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        setLocalError(null)

        const selectedItems = lines
            .filter((l) => l.selected && l.qty > 0)
            .map((l) => ({
                transaction_detail_id: l.transaction_detail_id,
                qty: l.qty,
                is_restockable: l.is_restockable,
            }))

        if (selectedItems.length === 0) {
            setLocalError('Pilih minimal 1 item yang akan diretur.')
            return
        }

        form.transform((data) => ({
            ...data,
            financial_account_id: Number(data.financial_account_id),
            items: selectedItems,
        }))

        form.post(transactions.returns.store.url({ transaction: transactionId }), {
            preserveScroll: true,
            onSuccess: () => {
                onOpenChange(false)
            },
        })
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="w-[calc(100%-2rem)] sm:max-w-3xl max-h-[85vh] flex flex-col p-0 gap-0 overflow-hidden">
                <DialogHeader className="p-6 pb-4 border-b shrink-0">
                    <div className="flex items-center gap-2.5">
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-500/15 text-amber-600 dark:text-amber-400">
                            <RotateCcw className="h-5 w-5" />
                        </div>
                        <div>
                            <DialogTitle>Proses Retur Penjualan ({invoiceNumber})</DialogTitle>
                            <DialogDescription>
                                Pilih item yang dikembalikan, tentukan kondisi barang (layak jual vs rusak), dan masukkan PIN Supervisor.
                            </DialogDescription>
                        </div>
                    </div>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
                    <div className="flex-1 overflow-y-auto overflow-x-hidden p-6 space-y-5">
                        {/* Item Selection Table */}
                        <div className="overflow-x-auto rounded-lg border">
                            <table className="table-fixed w-full min-w-[580px] text-sm">
                                <thead>
                                    <tr className="border-b bg-muted/40 text-xs text-muted-foreground">
                                        <th className="w-[8%] px-3 py-2 text-center">Pilih</th>
                                        <th className="w-[34%] px-3 py-2 text-left">Produk</th>
                                        <th className="w-[18%] px-2 py-2 text-center">Qty Retur</th>
                                        <th className="w-[22%] px-2 py-2 text-center">Kondisi Barang</th>
                                        <th className="w-[18%] px-3 py-2 text-right">Est. Refund</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y">
                                    {lines.map((line) => (
                                        <tr key={line.transaction_detail_id}>
                                            <td className="px-3 py-2.5 text-center">
                                                <input
                                                    type="checkbox"
                                                    checked={line.selected}
                                                    onChange={(e) =>
                                                        updateLine(line.transaction_detail_id, {
                                                            selected: e.target.checked,
                                                        })
                                                    }
                                                    className="h-4 w-4 rounded border-input accent-primary cursor-pointer"
                                                />
                                            </td>
                                            <td className="px-3 py-2.5">
                                                <p className="font-medium text-foreground truncate">
                                                    {line.product_name}
                                                </p>
                                                <p className="text-xs text-muted-foreground">
                                                    Maks. {line.max_qty} {line.unit_name} • {formatRupiah(line.unit_price)}
                                                </p>
                                            </td>
                                            <td className="px-2 py-2.5 text-center">
                                                <Input
                                                    type="number"
                                                    min={1}
                                                    max={line.max_qty}
                                                    value={line.qty}
                                                    disabled={!line.selected || form.processing}
                                                    onChange={(e) =>
                                                        updateLine(line.transaction_detail_id, {
                                                            qty: Math.max(
                                                                1,
                                                                Math.min(line.max_qty, Number(e.target.value) || 1)
                                                            ),
                                                        })
                                                    }
                                                    className="mx-auto h-8 w-16 text-center font-mono text-xs"
                                                />
                                            </td>
                                            <td className="px-2 py-2.5">
                                                <div className="flex items-center justify-center gap-2">
                                                    <Switch
                                                        checked={line.is_restockable}
                                                        disabled={!line.selected || form.processing}
                                                        onCheckedChange={(checked) =>
                                                            updateLine(line.transaction_detail_id, {
                                                                is_restockable: checked,
                                                            })
                                                        }
                                                    />
                                                    <span className="text-xs text-muted-foreground">
                                                        {line.is_restockable ? 'Layak Jual' : 'Rusak'}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-3 py-2.5 text-right font-mono text-xs font-semibold">
                                                {line.selected ? formatRupiah(line.unit_price * line.qty) : '-'}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Refund Method & Account */}
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <div className="space-y-1.5 min-w-0">
                                <Label>Metode Pengembalian Dana</Label>
                                <Select
                                    value={form.data.refund_method}
                                    onValueChange={(v) => v && form.setData('refund_method', v)}
                                    items={methodItems}
                                    disabled={form.processing}
                                >
                                    <SelectTrigger className="w-full h-9">
                                        <SelectValue>
                                            {(val) =>
                                                methodItems.find((m) => m.value === val)?.label ??
                                                'Pilih metode'
                                            }
                                        </SelectValue>
                                    </SelectTrigger>
                                    <SelectContent>
                                        {methodItems.map((m) => (
                                            <SelectItem key={m.value} value={m.value}>
                                                {m.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-1.5 min-w-0">
                                <Label>Akun Sumber Pengembalian</Label>
                                <Select
                                    value={form.data.financial_account_id}
                                    onValueChange={(v) => v && form.setData('financial_account_id', v)}
                                    items={accountItems}
                                    disabled={form.processing}
                                >
                                    <SelectTrigger className="w-full h-9">
                                        <SelectValue>
                                            {(val) =>
                                                accountItems.find((a) => a.value === val)?.label ??
                                                'Pilih akun'
                                            }
                                        </SelectValue>
                                    </SelectTrigger>
                                    <SelectContent>
                                        {accountItems.map((a) => (
                                            <SelectItem key={a.value} value={a.value}>
                                                {a.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <div className="space-y-1.5">
                                <Label htmlFor="return-reason">Alasan Retur (Wajib)</Label>
                                <textarea
                                    id="return-reason"
                                    rows={2}
                                    value={form.data.reason}
                                    onChange={(e) => form.setData('reason', e.target.value)}
                                    placeholder="Contoh: Kemasan rusak / salah beli varian..."
                                    disabled={form.processing}
                                    className="flex min-h-[64px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30"
                                />
                                {form.errors.reason && (
                                    <p className="text-xs font-medium text-destructive">{form.errors.reason}</p>
                                )}
                            </div>

                            <div className="space-y-1.5">
                                <Label htmlFor="return-pin" className="flex items-center gap-1.5">
                                    <KeyRound className="h-3.5 w-3.5 text-muted-foreground" />
                                    PIN Supervisor / Admin (Wajib)
                                </Label>
                                <Input
                                    id="return-pin"
                                    type="password"
                                    inputMode="numeric"
                                    autoComplete="off"
                                    value={form.data.supervisor_pin}
                                    onChange={(e) => form.setData('supervisor_pin', e.target.value)}
                                    placeholder="Masukkan PIN..."
                                    disabled={form.processing}
                                    className="h-10 font-mono tracking-[0.3em]"
                                />
                                {form.errors.supervisor_pin && (
                                    <p className="text-xs font-medium text-destructive">
                                        {form.errors.supervisor_pin}
                                    </p>
                                )}
                            </div>
                        </div>

                        {(localError || form.errors.items) && (
                            <p className="text-xs font-medium text-destructive">
                                {localError || form.errors.items}
                            </p>
                        )}
                    </div>

                    <DialogFooter className="p-6 pt-4 border-t shrink-0 flex items-center justify-between gap-2 bg-muted/20">
                        <div className="text-sm">
                            <span className="text-muted-foreground">Total Refund: </span>
                            <span className="font-mono font-bold text-foreground">
                                {formatRupiah(estimatedRefund)}
                            </span>
                        </div>
                        <div className="flex items-center gap-2">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => onOpenChange(false)}
                                disabled={form.processing}
                                className="cursor-pointer"
                            >
                                Batal
                            </Button>
                            <Button
                                type="submit"
                                disabled={form.processing || estimatedRefund <= 0}
                                className="cursor-pointer"
                            >
                                {form.processing ? 'Memproses Retur...' : 'Proses Retur'}
                            </Button>
                        </div>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}

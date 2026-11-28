import React, { useState } from 'react'
import { router } from '@inertiajs/react'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { ArrowRight, CheckCircle2, Loader2, XCircle } from 'lucide-react'
import { cn, formatRupiah } from '@/lib/utils'
import StockAdjustmentController from '@/actions/App/Http/Controllers/StockAdjustmentController'
import type { StockAdjustmentRow } from '../StockAdjustment'

interface DialogDetailStockAdjustmentProps {
    adjustment: StockAdjustmentRow | null
    open: boolean
    onOpenChange: (open: boolean) => void
    canApprove: boolean
}

export function DialogDetailStockAdjustment({
    adjustment,
    open,
    onOpenChange,
    canApprove,
}: DialogDetailStockAdjustmentProps) {
    const [showRejectForm, setShowRejectForm] = useState(false)
    const [rejectionReason, setRejectionReason] = useState('')
    const [isSubmitting, setIsSubmitting] = useState(false)

    if (!adjustment) {
        return null
    }

    const isPending = adjustment.status === 'pending'
    const isIn = adjustment.type === 'in'

    const handleClose = () => {
        if (isSubmitting) return
        setShowRejectForm(false)
        setRejectionReason('')
        onOpenChange(false)
    }

    const handleApprove = () => {
        setIsSubmitting(true)
        router.post(
            StockAdjustmentController.approve.url(adjustment.id),
            {},
            {
                preserveScroll: true,
                onFinish: () => setIsSubmitting(false),
                onSuccess: () => handleClose(),
            }
        )
    }

    const handleReject = (e: React.FormEvent) => {
        e.preventDefault()
        if (rejectionReason.trim().length < 3) return
        setIsSubmitting(true)
        router.post(
            StockAdjustmentController.reject.url(adjustment.id),
            { rejection_reason: rejectionReason.trim() },
            {
                preserveScroll: true,
                onFinish: () => setIsSubmitting(false),
                onSuccess: () => handleClose(),
            }
        )
    }

    const statusBadgeClass =
        adjustment.status === 'approved'
            ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800'
            : adjustment.status === 'rejected'
              ? 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800'
              : 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800'

    return (
        <Dialog open={open} onOpenChange={(next) => (next ? onOpenChange(true) : handleClose())}>
            <DialogContent className="flex max-h-[85vh] max-w-2xl flex-col gap-0 overflow-hidden p-0">
                <DialogHeader className="shrink-0 border-b p-6 pb-4">
                    <div className="flex flex-wrap items-center gap-2">
                        <DialogTitle className="font-mono">{adjustment.adjustment_number}</DialogTitle>
                        <Badge variant="outline" className={statusBadgeClass}>
                            {adjustment.status_label}
                        </Badge>
                    </div>
                    <DialogDescription>
                        Detail dokumen penyesuaian stok & audit dampak persediaan.
                    </DialogDescription>
                </DialogHeader>

                <div className="flex-1 space-y-4 overflow-y-auto overflow-x-hidden p-6">
                    {/* Info Grid */}
                    <div className="grid grid-cols-1 gap-3 rounded-lg border bg-muted/30 p-4 text-sm sm:grid-cols-2">
                        <div>
                            <p className="text-xs text-muted-foreground">Produk</p>
                            <p className="font-semibold text-foreground">{adjustment.product_name}</p>
                            <p className="font-mono text-xs text-muted-foreground">{adjustment.product_barcode}</p>
                        </div>
                        <div>
                            <p className="text-xs text-muted-foreground">Tipe & Alasan</p>
                            <p className="font-semibold text-foreground">{adjustment.type_label}</p>
                            <p className="text-xs text-muted-foreground">{adjustment.reason_label}</p>
                        </div>
                        <div>
                            <p className="text-xs text-muted-foreground">Perubahan Stok</p>
                            <div className="mt-0.5 flex items-center gap-1.5 font-mono text-sm font-semibold">
                                {adjustment.qty_before !== null && adjustment.qty_after !== null ? (
                                    <>
                                        <span>{adjustment.qty_before}</span>
                                        <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                                        <span>
                                            {adjustment.qty_after} {adjustment.base_unit}
                                        </span>
                                        <span
                                            className={cn(
                                                'ml-1 text-xs',
                                                isIn
                                                    ? 'text-emerald-600 dark:text-emerald-400'
                                                    : 'text-rose-600 dark:text-rose-400'
                                            )}
                                        >
                                            ({isIn ? `+${adjustment.qty_change}` : `-${adjustment.qty_change}`})
                                        </span>
                                    </>
                                ) : (
                                    <span
                                        className={cn(
                                            isIn
                                                ? 'text-emerald-600 dark:text-emerald-400'
                                                : 'text-rose-600 dark:text-rose-400'
                                        )}
                                    >
                                        {isIn ? `+${adjustment.qty_change}` : `-${adjustment.qty_change}`}{' '}
                                        {adjustment.base_unit}
                                    </span>
                                )}
                            </div>
                        </div>
                        <div>
                            <p className="text-xs text-muted-foreground">Dampak Nilai (HPP Snapshot)</p>
                            <p
                                className={cn(
                                    'font-mono text-sm font-bold',
                                    adjustment.total_cost_impact < 0
                                        ? 'text-rose-600 dark:text-rose-400'
                                        : 'text-emerald-600 dark:text-emerald-400'
                                )}
                            >
                                {adjustment.total_cost_impact > 0 ? '+' : ''}
                                {formatRupiah(adjustment.total_cost_impact)}
                            </p>
                            <p className="font-mono text-xs text-muted-foreground">
                                @ {formatRupiah(adjustment.unit_cost_snapshot)} / {adjustment.base_unit}
                            </p>
                        </div>
                    </div>

                    {/* Catatan */}
                    <div className="space-y-1">
                        <p className="text-xs font-medium text-muted-foreground">Catatan</p>
                        <div className="rounded-md border bg-card p-3 text-sm text-foreground">
                            {adjustment.notes}
                        </div>
                    </div>

                    {/* Audit Trail */}
                    <div className="grid grid-cols-1 gap-3 text-xs sm:grid-cols-2">
                        <div className="rounded-md border p-3">
                            <p className="text-muted-foreground">Diajukan / Dibuat Oleh</p>
                            <p className="mt-0.5 font-medium text-foreground">{adjustment.creator_name}</p>
                            <p className="text-muted-foreground">{adjustment.created_at}</p>
                        </div>
                        {adjustment.approver_name && (
                            <div className="rounded-md border border-emerald-200 bg-emerald-50/50 p-3 dark:border-emerald-900 dark:bg-emerald-950/30">
                                <p className="text-muted-foreground">Disetujui Oleh</p>
                                <p className="mt-0.5 font-medium text-emerald-700 dark:text-emerald-300">
                                    {adjustment.approver_name}
                                </p>
                                <p className="text-muted-foreground">{adjustment.approved_at}</p>
                            </div>
                        )}
                        {adjustment.rejecter_name && (
                            <div className="rounded-md border border-rose-200 bg-rose-50/50 p-3 dark:border-rose-900 dark:bg-rose-950/30">
                                <p className="text-muted-foreground">Ditolak Oleh</p>
                                <p className="mt-0.5 font-medium text-rose-700 dark:text-rose-300">
                                    {adjustment.rejecter_name}
                                </p>
                                <p className="text-muted-foreground">{adjustment.rejected_at}</p>
                                {adjustment.rejection_reason && (
                                    <p className="mt-1 text-rose-700 dark:text-rose-300">
                                        Alasan: {adjustment.rejection_reason}
                                    </p>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Form Penolakan */}
                    {canApprove && isPending && showRejectForm && (
                        <form id="reject-adjustment-form" onSubmit={handleReject} className="space-y-2 rounded-lg border border-rose-200 bg-rose-50/40 p-4 dark:border-rose-900 dark:bg-rose-950/30">
                            <Label htmlFor="reject-reason" className="text-xs font-semibold text-rose-700 dark:text-rose-300">
                                Alasan Penolakan <span className="text-rose-500">*</span>
                            </Label>
                            <textarea
                                id="reject-reason"
                                rows={2}
                                value={rejectionReason}
                                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                                    setRejectionReason(e.target.value)
                                }
                                placeholder="Tuliskan alasan penolakan pengajuan ini (minimal 3 karakter)…"
                                className="flex min-h-[64px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                                required
                            />
                        </form>
                    )}
                </div>

                <DialogFooter className="flex shrink-0 items-center justify-end gap-2 border-t bg-muted/20 p-6 pt-4">
                    <Button type="button" variant="outline" onClick={handleClose} disabled={isSubmitting}>
                        Tutup
                    </Button>

                    {canApprove && isPending && !showRejectForm && (
                        <>
                            <Button
                                type="button"
                                variant="destructive"
                                onClick={() => setShowRejectForm(true)}
                                disabled={isSubmitting}
                                className="gap-1.5"
                            >
                                <XCircle className="h-4 w-4" />
                                Tolak
                            </Button>
                            <Button
                                type="button"
                                onClick={handleApprove}
                                disabled={isSubmitting}
                                className="gap-1.5 bg-emerald-600 text-white hover:bg-emerald-700"
                            >
                                {isSubmitting ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                    <CheckCircle2 className="h-4 w-4" />
                                )}
                                Setujui & Terapkan Stok
                            </Button>
                        </>
                    )}

                    {canApprove && isPending && showRejectForm && (
                        <>
                            <Button
                                type="button"
                                variant="ghost"
                                onClick={() => setShowRejectForm(false)}
                                disabled={isSubmitting}
                            >
                                Kembali
                            </Button>
                            <Button
                                type="submit"
                                form="reject-adjustment-form"
                                variant="destructive"
                                disabled={isSubmitting || rejectionReason.trim().length < 3}
                                className="gap-1.5"
                            >
                                {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                                Konfirmasi Tolak
                            </Button>
                        </>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

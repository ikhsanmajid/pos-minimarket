import * as React from 'react'
import { Link, router } from '@inertiajs/react'
import { Button } from '@/components/ui/button'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
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
import { MoreHorizontal, Eye, Pencil, Trash2, Ban, FileDown } from 'lucide-react'
import type { PurchaseOrderRow } from '../Index'
import PurchaseOrderController from '@/actions/App/Http/Controllers/PurchaseOrderController'

interface PurchaseOrderActionsCellProps {
    po: PurchaseOrderRow
    canEdit: boolean
    canDelete: boolean
    canCancel: boolean
}

export function PurchaseOrderActionsCell({
    po,
    canEdit,
    canDelete,
    canCancel,
}: PurchaseOrderActionsCellProps) {
    const [deleteOpen, setDeleteOpen] = React.useState(false)
    const [cancelOpen, setCancelOpen] = React.useState(false)
    const [cancelReason, setCancelReason] = React.useState('')
    const [processing, setProcessing] = React.useState(false)

    const canBeEdited = canEdit && ['draft', 'ordered'].includes(po.status) && po.total_quantity_received === 0
    const canBeDeleted = canDelete && po.total_quantity_received === 0
    const canBeCancelled = canCancel && !['received', 'cancelled'].includes(po.status) && po.total_quantity_received === 0

    const handleDelete = () => {
        setProcessing(true)
        router.delete(PurchaseOrderController.destroy.url(po.id), {
            preserveScroll: true,
            onFinish: () => {
                setProcessing(false)
                setDeleteOpen(false)
            },
        })
    }

    const handleCancel = () => {
        setProcessing(true)
        router.post(PurchaseOrderController.cancel.url(po.id), {
            reason: cancelReason,
        }, {
            preserveScroll: true,
            onFinish: () => {
                setProcessing(false)
                setCancelOpen(false)
            },
        })
    }

    return (
        <>
            <DropdownMenu>
                <DropdownMenuTrigger
                    render={
                        <Button
                            variant="ghost"
                            size="icon-sm"
                            className="data-[popup-open]:bg-muted cursor-pointer"
                            aria-label="Aksi"
                        />
                    }
                >
                    <MoreHorizontal className="h-4 w-4" />
                </DropdownMenuTrigger>

                <DropdownMenuContent align="end" className="w-44">
                    <DropdownMenuItem
                        render={
                            <Link
                                href={PurchaseOrderController.show.url(po.id)}
                                className="flex items-center gap-2 cursor-pointer w-full"
                            >
                                <Eye className="h-3.5 w-3.5" />
                                <span>Lihat Detail</span>
                            </Link>
                        }
                    />

                    <DropdownMenuItem
                        render={
                            <a
                                href={PurchaseOrderController.downloadPdf.url(po.id)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-2 cursor-pointer w-full"
                            >
                                <FileDown className="h-3.5 w-3.5" />
                                <span>Download PDF</span>
                            </a>
                        }
                    />

                    {canBeEdited && (
                        <DropdownMenuItem
                            render={
                                <Link
                                    href={PurchaseOrderController.edit.url(po.id)}
                                    className="flex items-center gap-2 cursor-pointer w-full"
                                >
                                    <Pencil className="h-3.5 w-3.5" />
                                    <span>Edit PO</span>
                                </Link>
                            }
                        />
                    )}

                    {canBeCancelled && (
                        <DropdownMenuItem
                            onClick={() => setCancelOpen(true)}
                            className="cursor-pointer gap-2 text-amber-600 focus:text-amber-600"
                        >
                            <Ban className="h-3.5 w-3.5" />
                            <span>Batalkan PO</span>
                        </DropdownMenuItem>
                    )}

                    {canBeDeleted && (
                        <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                                onClick={() => setDeleteOpen(true)}
                                variant="destructive"
                                className="cursor-pointer gap-2"
                            >
                                <Trash2 className="h-3.5 w-3.5" />
                                <span>Hapus</span>
                            </DropdownMenuItem>
                        </>
                    )}
                </DropdownMenuContent>
            </DropdownMenu>

            {/* Modal Konfirmasi Hapus */}
            <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
                <AlertDialogContent size="sm">
                    <AlertDialogHeader>
                        <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
                            <Trash2 className="h-6 w-6 text-destructive" />
                        </div>
                        <AlertDialogTitle className="text-center">Hapus Purchase Order</AlertDialogTitle>
                        <AlertDialogDescription className="text-center">
                            Yakin ingin menghapus dokumen PO{' '}
                            <strong className="text-foreground">{po.po_number}</strong>?
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={processing}>Batal</AlertDialogCancel>
                        <AlertDialogAction
                            variant="destructive"
                            onClick={handleDelete}
                            disabled={processing}
                        >
                            {processing ? 'Menghapus...' : 'Ya, Hapus'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Modal Konfirmasi Pembatalan */}
            <AlertDialog open={cancelOpen} onOpenChange={setCancelOpen}>
                <AlertDialogContent size="sm">
                    <AlertDialogHeader>
                        <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/10">
                            <Ban className="h-6 w-6 text-amber-600" />
                        </div>
                        <AlertDialogTitle className="text-center">Batalkan Purchase Order</AlertDialogTitle>
                        <AlertDialogDescription className="text-center space-y-2">
                            <span>
                                Yakin ingin membatalkan pesanan PO <strong className="text-foreground">{po.po_number}</strong>?
                            </span>
                            <textarea
                                placeholder="Alasan pembatalan (opsional)..."
                                value={cancelReason}
                                onChange={(e) => setCancelReason(e.target.value)}
                                rows={2}
                                className="w-full mt-2 rounded-md border border-input bg-background p-2 text-xs"
                            />
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={processing}>Batal</AlertDialogCancel>
                        <AlertDialogAction
                            variant="destructive"
                            onClick={handleCancel}
                            disabled={processing}
                            className="bg-amber-600 hover:bg-amber-700 text-white"
                        >
                            {processing ? 'Membatalkan...' : 'Ya, Batalkan PO'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    )
}
export default PurchaseOrderActionsCell

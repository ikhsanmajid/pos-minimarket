import React from 'react'
import { useForm } from '@inertiajs/react'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import { EyeOff, Loader2 } from 'lucide-react'
import StockOpnameController from '@/actions/App/Http/Controllers/StockOpnameController'

interface DialogCreateStockOpnameProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    categories: { id: number; name: string }[]
}

export function DialogCreateStockOpname({
    open,
    onOpenChange,
    categories,
}: DialogCreateStockOpnameProps) {
    const { data, setData, post, processing, errors, reset, clearErrors } = useForm({
        category_id: '' as string,
        is_blind_count: true,
        notes: '',
    })

    const scopeItems = [
        { value: 'all', label: 'Seluruh Produk Aktif Toko' },
        ...categories.map((c) => ({ value: String(c.id), label: `Kategori: ${c.name}` })),
    ]

    const handleClose = () => {
        if (processing) return
        reset()
        clearErrors()
        onOpenChange(false)
    }

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        post(StockOpnameController.store.url(), {
            preserveScroll: true,
            onSuccess: () => {
                reset()
                clearErrors()
                onOpenChange(false)
            },
        })
    }

    return (
        <Dialog open={open} onOpenChange={(next) => (next ? onOpenChange(true) : handleClose())}>
            <DialogContent className="flex max-h-[85vh] max-w-xl flex-col gap-0 overflow-hidden p-0">
                <DialogHeader className="shrink-0 border-b p-6 pb-4">
                    <DialogTitle>Mulai Sesi Stock Opname Baru</DialogTitle>
                    <DialogDescription>
                        Sistem akan membuat snapshot daftar produk aktif sesuai cakupan untuk mulai dihitung secara fisik.
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
                    <div className="flex-1 space-y-4 overflow-y-auto overflow-x-hidden p-6">
                        {/* Cakupan Opname */}
                        <div className="space-y-1.5">
                            <Label>Cakupan Produk</Label>
                            <Select
                                value={data.category_id === '' ? 'all' : data.category_id}
                                items={scopeItems}
                                onValueChange={(val) =>
                                    setData('category_id', !val || val === 'all' ? '' : val)
                                }
                            >
                                <SelectTrigger className="h-9 w-full">
                                    <SelectValue>
                                        {(val) =>
                                            scopeItems.find((i) => i.value === val)?.label ??
                                            'Seluruh Produk Aktif Toko'
                                        }
                                    </SelectValue>
                                </SelectTrigger>
                                <SelectContent>
                                    {scopeItems.map((item) => (
                                        <SelectItem key={item.value} value={item.value}>
                                            {item.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            {errors.category_id && (
                                <p className="text-xs text-rose-500">{errors.category_id}</p>
                            )}
                        </div>

                        {/* Toggle Blind Count */}
                        <div className="flex items-start justify-between gap-4 rounded-lg border bg-muted/30 p-3.5">
                            <div className="space-y-1">
                                <div className="flex items-center gap-1.5 text-sm font-medium text-foreground">
                                    <EyeOff className="h-4 w-4 text-primary" />
                                    <span>Mode Blind Count (Direkomendasikan)</span>
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    Menyembunyikan stok sistem dari petugas penghitung selama sesi berlangsung agar hasil penghitungan fisik lebih objektif.
                                </p>
                            </div>
                            <Switch
                                checked={data.is_blind_count}
                                onCheckedChange={(checked) => setData('is_blind_count', checked)}
                            />
                        </div>

                        {/* Catatan Sesi */}
                        <div className="space-y-1.5">
                            <Label htmlFor="opname-notes">Catatan Sesi (Opsional)</Label>
                            <textarea
                                id="opname-notes"
                                rows={3}
                                value={data.notes}
                                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                                    setData('notes', e.target.value)
                                }
                                placeholder="Misal: Opname rutin bulanan rak minuman & snack…"
                                className="flex min-h-[76px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30"
                            />
                            {errors.notes && (
                                <p className="text-xs text-rose-500">{errors.notes}</p>
                            )}
                        </div>
                    </div>

                    <DialogFooter className="flex shrink-0 items-center justify-end gap-2 border-t bg-muted/20 p-6 pt-4">
                        <Button type="button" variant="outline" onClick={handleClose} disabled={processing}>
                            Batal
                        </Button>
                        <Button type="submit" disabled={processing}>
                            {processing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Mulai Sesi Opname
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}

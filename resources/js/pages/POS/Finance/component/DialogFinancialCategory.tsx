import * as React from 'react'
import { useForm } from '@inertiajs/react'
import { Button } from '@/components/ui/button'
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Field, FieldError } from '@/components/ui/field'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import { ShieldCheck, Tags } from 'lucide-react'
import FinancialCategoryController from '@/actions/App/Http/Controllers/FinancialCategoryController'
import type { FinancialCategoryRow } from '../FinancialCategory'

interface DialogFinancialCategoryProps {
    category?: FinancialCategoryRow | null
    categoryTypes: { value: string; label: string }[]
    open: boolean
    onOpenChange: (open: boolean) => void
}

export function DialogFinancialCategory({
    category,
    categoryTypes,
    open,
    onOpenChange,
}: DialogFinancialCategoryProps) {
    const isEdit = Boolean(category)
    const isSystem = Boolean(category?.is_system)
    const hasTransactions = (category?.transactions_count ?? 0) > 0
    const isTypeLocked = isEdit && (isSystem || hasTransactions)

    const { data, setData, post, patch, processing, errors, clearErrors } = useForm({
        code: category?.code ?? '',
        name: category?.name ?? '',
        type: category?.type ?? 'expense',
        is_active: category?.is_active ?? true,
        description: category?.description ?? '',
    })

    React.useEffect(() => {
        if (open) {
            clearErrors()
            setData({
                code: category?.code ?? '',
                name: category?.name ?? '',
                type: category?.type ?? 'expense',
                is_active: category?.is_active ?? true,
                description: category?.description ?? '',
            })
        }
    }, [open, category])

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()

        if (isEdit && category) {
            patch(FinancialCategoryController.update.url(category.id), {
                preserveScroll: true,
                onSuccess: () => onOpenChange(false),
            })
        } else {
            post(FinancialCategoryController.store.url(), {
                preserveScroll: true,
                onSuccess: () => onOpenChange(false),
            })
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-lg max-h-[85vh] flex flex-col p-0 gap-0 overflow-hidden">
                <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden">
                    <DialogHeader className="p-6 pb-4 border-b shrink-0">
                        <DialogTitle className="flex items-center gap-2">
                            <Tags className="h-5 w-5 text-primary" />
                            {isEdit ? `Edit Kategori: ${category?.name}` : 'Tambah Kategori Keuangan'}
                        </DialogTitle>
                        <DialogDescription className="text-xs">
                            Kelompokkan pos pemasukan dan biaya operasional toko untuk laporan arus kas dan laba bersih.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="flex-1 overflow-y-auto overflow-x-hidden p-6 space-y-4">
                        {isSystem && (
                            <div className="flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50/70 p-3 text-xs text-blue-800 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-300">
                                <ShieldCheck className="h-4 w-4 shrink-0 mt-0.5" />
                                <span>
                                    Ini adalah kategori bawaan sistem. Kode, tipe, dan status aktif terkunci demi integritas pencatatan otomatis.
                                </span>
                            </div>
                        )}

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <Field>
                                <Label htmlFor="fcat-code" className="text-xs">
                                    Kode Kategori (Opsional)
                                </Label>
                                <Input
                                    id="fcat-code"
                                    value={data.code}
                                    onChange={(e) => setData('code', e.target.value)}
                                    placeholder="Otomatis (INC-001 / EXP-001)"
                                    disabled={isSystem}
                                    className="font-mono text-xs mt-1"
                                />
                                <FieldError>{errors.code}</FieldError>
                            </Field>

                            <Field>
                                <Label htmlFor="fcat-type" className="text-xs">
                                    Tipe Kategori <span className="text-destructive">*</span>
                                </Label>
                                <Select
                                    items={categoryTypes}
                                    value={data.type}
                                    onValueChange={(val) => val && setData('type', val)}
                                    disabled={isTypeLocked}
                                >
                                    <SelectTrigger id="fcat-type" className="w-full mt-1">
                                        <SelectValue placeholder="Pilih tipe">
                                            {(val) => categoryTypes.find((t) => t.value === val)?.label}
                                        </SelectValue>
                                    </SelectTrigger>
                                    <SelectContent>
                                        {categoryTypes.map((t) => (
                                            <SelectItem key={t.value} value={t.value}>
                                                {t.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                {isTypeLocked && !isSystem && (
                                    <p className="text-[11px] text-muted-foreground mt-1">
                                        Tipe terkunci karena kategori sudah dipakai pada transaksi keuangan.
                                    </p>
                                )}
                                <FieldError>{errors.type}</FieldError>
                            </Field>
                        </div>

                        <Field>
                            <Label htmlFor="fcat-name" className="text-xs">
                                Nama Kategori <span className="text-destructive">*</span>
                            </Label>
                            <Input
                                id="fcat-name"
                                value={data.name}
                                onChange={(e) => setData('name', e.target.value)}
                                placeholder="Contoh: Listrik & Air, Sewa Ruko, Gaji Karyawan"
                                className="text-xs mt-1"
                                required
                            />
                            <FieldError>{errors.name}</FieldError>
                        </Field>

                        <Field>
                            <Label htmlFor="fcat-desc" className="text-xs">
                                Deskripsi
                            </Label>
                            <textarea
                                id="fcat-desc"
                                rows={2}
                                value={data.description}
                                onChange={(e) => setData('description', e.target.value)}
                                placeholder="Keterangan singkat penggunaan kategori ini"
                                className="w-full mt-1 rounded-md border border-input bg-background p-2 text-xs shadow-xs"
                            />
                            <FieldError>{errors.description}</FieldError>
                        </Field>

                        <div className="flex items-center justify-between rounded-lg border p-3">
                            <div>
                                <Label className="text-xs font-medium">Status Aktif</Label>
                                <p className="text-[11px] text-muted-foreground">
                                    Kategori nonaktif tidak dapat dipilih untuk transaksi baru.
                                </p>
                            </div>
                            <Switch
                                checked={data.is_active}
                                disabled={isSystem}
                                onCheckedChange={(checked) => setData('is_active', checked)}
                            />
                        </div>
                        <FieldError>{errors.is_active}</FieldError>
                    </div>

                    <DialogFooter className="p-6 pt-4 border-t shrink-0 flex items-center justify-end gap-2 bg-muted/20">
                        <DialogClose
                            render={
                                <Button type="button" variant="outline" size="sm">
                                    Batal
                                </Button>
                            }
                        />
                        <Button type="submit" size="sm" disabled={processing}>
                            {processing ? 'Menyimpan...' : isEdit ? 'Simpan Perubahan' : 'Simpan Kategori'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}

export default DialogFinancialCategory

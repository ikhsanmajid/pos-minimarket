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
import { Field, FieldError, FieldGroup } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import type { CategoryRow } from '../Category'

interface DialogEditCategoryProps {
    category: CategoryRow
    updateUrl: string
    open: boolean
    onOpenChange: (open: boolean) => void
}

export function DialogEditCategory({
    category,
    updateUrl,
    open,
    onOpenChange,
}: DialogEditCategoryProps) {
    const { data, setData, patch, processing, errors, reset } = useForm({
        code: category.code ?? '',
        name: category.name,
        description: category.description ?? '',
        is_active: Boolean(category.is_active),
    })

    React.useEffect(() => {
        if (open) {
            setData({
                code: category.code ?? '',
                name: category.name,
                description: category.description ?? '',
                is_active: Boolean(category.is_active),
            })
        }
    }, [open, category.id, category.code, category.name, category.description, category.is_active])

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        patch(updateUrl, {
            preserveScroll: true,
            onSuccess: () => {
                onOpenChange(false)
                reset()
            },
        })
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <form onSubmit={handleSubmit}>
                    <DialogHeader>
                        <DialogTitle>Edit Kategori</DialogTitle>
                        <DialogDescription>
                            Perbarui data kategori produk.
                        </DialogDescription>
                    </DialogHeader>

                    <FieldGroup className="py-4 space-y-4">
                        <Field>
                            <Label htmlFor={`edit-category-code-${category.id}`}>Kode Kategori (Opsional)</Label>
                            <Input
                                id={`edit-category-code-${category.id}`}
                                placeholder="Contoh: MKN, MNM"
                                maxLength={20}
                                value={data.code}
                                onChange={(e) => setData('code', e.target.value)}
                                aria-invalid={!!errors.code}
                            />
                            <FieldError>{errors.code}</FieldError>
                        </Field>

                        <Field>
                            <Label htmlFor={`edit-category-name-${category.id}`}>
                                Nama Kategori <span className="text-destructive">*</span>
                            </Label>
                            <Input
                                id={`edit-category-name-${category.id}`}
                                placeholder="Contoh: Makanan Ringan"
                                maxLength={100}
                                value={data.name}
                                onChange={(e) => setData('name', e.target.value)}
                                aria-invalid={!!errors.name}
                            />
                            <FieldError>{errors.name}</FieldError>
                        </Field>

                        <Field>
                            <Label htmlFor={`edit-category-description-${category.id}`}>Deskripsi (Opsional)</Label>
                            <Input
                                id={`edit-category-description-${category.id}`}
                                placeholder="Deskripsi singkat kategori..."
                                maxLength={500}
                                value={data.description}
                                onChange={(e) => setData('description', e.target.value)}
                                aria-invalid={!!errors.description}
                            />
                            <FieldError>{errors.description}</FieldError>
                        </Field>

                        <div className="flex items-center justify-between rounded-lg border p-3 bg-muted/20">
                            <div className="space-y-0.5">
                                <Label htmlFor={`edit-category-is_active-${category.id}`} className="text-sm font-medium">Status Aktif</Label>
                                <p className="text-xs text-muted-foreground">
                                    Kategori aktif dapat digunakan saat menambah atau mengedit produk
                                </p>
                            </div>
                            <Switch
                                id={`edit-category-is_active-${category.id}`}
                                checked={data.is_active}
                                onCheckedChange={(checked) => setData('is_active', checked)}
                            />
                        </div>
                    </FieldGroup>

                    <DialogFooter>
                        <DialogClose render={<Button type="button" variant="outline" />}>
                            Batal
                        </DialogClose>
                        <Button type="submit" disabled={processing}>
                            {processing ? 'Menyimpan…' : 'Simpan Perubahan'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}

export default DialogEditCategory

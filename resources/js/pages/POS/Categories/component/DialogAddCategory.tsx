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
    DialogTrigger,
} from '@/components/ui/dialog'
import { Field, FieldError, FieldGroup } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Plus } from 'lucide-react'

interface DialogAddCategoryProps {
    storeUrl: string
}

export function DialogAddCategory({ storeUrl }: DialogAddCategoryProps) {
    const [open, setOpen] = React.useState(false)

    const { data, setData, post, processing, errors, reset } = useForm({
        code: '',
        name: '',
        description: '',
        is_active: true,
    })

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        post(storeUrl, {
            preserveScroll: true,
            onSuccess: () => {
                setOpen(false)
                reset()
            },
        })
    }

    const handleOpenChange = (nextOpen: boolean) => {
        setOpen(nextOpen)
        if (!nextOpen) {
            reset()
        }
    }

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogTrigger
                render={
                    <Button className="w-full sm:w-auto">
                        <Plus className="h-4 w-4 mr-1.5" />
                        Tambah Kategori
                    </Button>
                }
            />

            <DialogContent className="sm:max-w-md">
                <form onSubmit={handleSubmit}>
                    <DialogHeader>
                        <DialogTitle>Tambah Kategori</DialogTitle>
                        <DialogDescription>
                            Isi informasi kategori baru untuk produk toko Anda.
                        </DialogDescription>
                    </DialogHeader>

                    <FieldGroup className="py-4 space-y-4">
                        <Field>
                            <Label htmlFor="create-category-code">Kode Kategori (Opsional)</Label>
                            <Input
                                id="create-category-code"
                                placeholder="Contoh: MKN, MNM"
                                maxLength={20}
                                value={data.code}
                                onChange={(e) => setData('code', e.target.value)}
                                aria-invalid={!!errors.code}
                            />
                            <FieldError>{errors.code}</FieldError>
                        </Field>

                        <Field>
                            <Label htmlFor="create-category-name">
                                Nama Kategori <span className="text-destructive">*</span>
                            </Label>
                            <Input
                                id="create-category-name"
                                placeholder="Contoh: Makanan Ringan"
                                maxLength={100}
                                value={data.name}
                                onChange={(e) => setData('name', e.target.value)}
                                aria-invalid={!!errors.name}
                            />
                            <FieldError>{errors.name}</FieldError>
                        </Field>

                        <Field>
                            <Label htmlFor="create-category-description">Deskripsi (Opsional)</Label>
                            <Input
                                id="create-category-description"
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
                                <Label htmlFor="create-category-is_active" className="text-sm font-medium">Status Aktif</Label>
                                <p className="text-xs text-muted-foreground">
                                    Kategori aktif dapat digunakan saat menambah atau mengedit produk
                                </p>
                            </div>
                            <Switch
                                id="create-category-is_active"
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
                            {processing ? 'Menyimpan…' : 'Simpan Kategori'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}

export default DialogAddCategory

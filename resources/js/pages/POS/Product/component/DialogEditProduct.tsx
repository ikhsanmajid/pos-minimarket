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
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import { Upload, Package, X } from 'lucide-react'
import ProductController from '@/actions/App/Http/Controllers/ProductController'
import type { Category, Product } from '../Product'

interface DialogEditProductProps {
    product: Product
    categories: Category[]
    open: boolean
    onOpenChange: (open: boolean) => void
}

export function DialogEditProduct({
    product,
    categories,
    open,
    onOpenChange,
}: DialogEditProductProps) {
    const [imagePreview, setImagePreview] = React.useState<string | null>(product.image || null)
    const fileInputRef = React.useRef<HTMLInputElement>(null)

    const { data, setData, post, processing, errors, reset } = useForm({
        _method: 'patch',
        category_id: String(product.category_id || ''),
        barcode: product.barcode,
        name: product.name,
        buy_price: String(product.buy_price),
        sell_price: String(product.sell_price),
        stock: String(product.stock),
        min_stock: String(product.min_stock),
        image: null as File | null,
        active: Boolean(product.active),
    })

    // Sync values when different product opened
    React.useEffect(() => {
        if (open) {
            setImagePreview(product.image || null)
            setData({
                _method: 'patch',
                category_id: String(product.category_id || ''),
                barcode: product.barcode,
                name: product.name,
                buy_price: String(product.buy_price),
                sell_price: String(product.sell_price),
                stock: String(product.stock),
                min_stock: String(product.min_stock),
                image: null,
                active: Boolean(product.active),
            })
        }
    }, [open, product.id])

    const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (file) {
            setData('image', file)
            setImagePreview(URL.createObjectURL(file))
        }
    }

    const handleRemoveImage = () => {
        setData('image', null)
        setImagePreview(product.image || null)
        if (fileInputRef.current) {
            fileInputRef.current.value = ''
        }
    }

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        post(ProductController.update.url(product.id), {
            forceFormData: true,
            preserveScroll: true,
            onSuccess: () => {
                onOpenChange(false)
                reset()
            },
        })
    }

    const categoryItems = React.useMemo(() => {
        return categories.map((c) => ({
            value: String(c.id),
            label: c.name,
        }))
    }, [categories])

    return (
        <Dialog
            open={open}
            onOpenChange={(nextOpen, eventDetails) => {
                // Cegah penutupan jika klik di luar area modal
                if (!nextOpen && eventDetails?.reason === 'outside-press') {
                    return
                }
                onOpenChange(nextOpen)
            }}
            disablePointerDismissal
        >
            <DialogContent className="sm:max-w-3xl p-0 gap-0 overflow-hidden max-h-[88vh] flex flex-col">
                <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden">
                    <DialogHeader className="px-6 pt-5 pb-4 border-b border-border/50 shrink-0">
                        <DialogTitle>Edit Produk</DialogTitle>
                        <DialogDescription>
                            Perbarui informasi produk <strong>{product.name}</strong>.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4 custom-scrollbar">
                        <FieldGroup className="space-y-4">
                            {/* Foto Produk */}
                            <div className="flex items-center gap-4 rounded-lg border bg-muted/20 p-3">
                                <div className="relative flex h-20 w-20 shrink-0 items-center justify-center rounded-lg border bg-muted overflow-hidden">
                                    {imagePreview ? (
                                        <img
                                            src={imagePreview}
                                            alt="Preview"
                                            className="h-full w-full object-cover"
                                        />
                                    ) : (
                                        <Package className="h-8 w-8 text-muted-foreground" />
                                    )}
                                </div>

                                <div className="space-y-1.5 flex-1">
                                    <Label className="text-xs font-semibold">Foto Produk</Label>
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="file"
                                            ref={fileInputRef}
                                            onChange={handleImageChange}
                                            accept="image/jpeg,image/png,image/webp"
                                            className="hidden"
                                        />
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="xs"
                                            onClick={() => fileInputRef.current?.click()}
                                            className="gap-1.5"
                                        >
                                            <Upload className="h-3.5 w-3.5" />
                                            {imagePreview ? 'Ganti Foto' : 'Unggah Foto'}
                                        </Button>

                                        {data.image && (
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="xs"
                                                onClick={handleRemoveImage}
                                                className="text-muted-foreground hover:text-destructive gap-1"
                                            >
                                                <X className="h-3.5 w-3.5" />
                                                Batal
                                            </Button>
                                        )}
                                    </div>
                                    <p className="text-[11px] text-muted-foreground">
                                        JPG, PNG, atau WEBP. Maks 2MB.
                                    </p>
                                    <FieldError>{errors.image}</FieldError>
                                </div>
                            </div>

                            {/* Barcode & Nama */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <Field>
                                    <Label htmlFor="edit-barcode">Barcode</Label>
                                    <Input
                                        id="edit-barcode"
                                        value={data.barcode}
                                        onChange={(e) => setData('barcode', e.target.value)}
                                        aria-invalid={!!errors.barcode}
                                    />
                                    <FieldError>{errors.barcode}</FieldError>
                                </Field>

                                <Field>
                                    <Label htmlFor="edit-name">Nama Produk</Label>
                                    <Input
                                        id="edit-name"
                                        value={data.name}
                                        onChange={(e) => setData('name', e.target.value)}
                                        aria-invalid={!!errors.name}
                                    />
                                    <FieldError>{errors.name}</FieldError>
                                </Field>
                            </div>

                            {/* Kategori */}
                            <Field>
                                <Label htmlFor="edit-category">Kategori</Label>
                                <Select
                                    items={categoryItems}
                                    value={data.category_id}
                                    onValueChange={(val) => val && setData('category_id', val)}
                                >
                                    <SelectTrigger id="edit-category" className="w-full" aria-invalid={!!errors.category_id}>
                                        <SelectValue placeholder="Pilih Kategori">
                                            {(val) => categoryItems.find((c) => c.value === val)?.label}
                                        </SelectValue>
                                    </SelectTrigger>
                                    <SelectContent>
                                        {categoryItems.map((c) => (
                                            <SelectItem key={c.value} value={c.value}>
                                                {c.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <FieldError>{errors.category_id}</FieldError>
                            </Field>

                            {/* Harga Beli & Jual */}
                            <div className="grid grid-cols-2 gap-3">
                                <Field>
                                    <Label htmlFor="edit-buy-price">Harga Beli (Rp)</Label>
                                    <Input
                                        id="edit-buy-price"
                                        type="number"
                                        min="0"
                                        value={data.buy_price}
                                        onChange={(e) => setData('buy_price', e.target.value)}
                                        aria-invalid={!!errors.buy_price}
                                    />
                                    <FieldError>{errors.buy_price}</FieldError>
                                </Field>

                                <Field>
                                    <Label htmlFor="edit-sell-price">Harga Jual (Rp)</Label>
                                    <Input
                                        id="edit-sell-price"
                                        type="number"
                                        min="0"
                                        value={data.sell_price}
                                        onChange={(e) => setData('sell_price', e.target.value)}
                                        aria-invalid={!!errors.sell_price}
                                    />
                                    <FieldError>{errors.sell_price}</FieldError>
                                </Field>
                            </div>

                            {/* Stok & Min Stok */}
                            <div className="grid grid-cols-2 gap-3">
                                <Field>
                                    <Label htmlFor="edit-stock">Stok</Label>
                                    <Input
                                        id="edit-stock"
                                        type="number"
                                        value={data.stock}
                                        disabled
                                        className="bg-muted text-muted-foreground cursor-not-allowed opacity-80"
                                        title="Stok tidak dapat diedit langsung untuk menjaga keakuratan mutasi stok"
                                    />
                                    <p className="text-[11px] text-muted-foreground mt-1">
                                        Terkunci (kelola via mutasi stok).
                                    </p>
                                    <FieldError>{errors.stock}</FieldError>
                                </Field>

                                <Field>
                                    <Label htmlFor="edit-min-stock">Min. Stok</Label>
                                    <Input
                                        id="edit-min-stock"
                                        type="number"
                                        min="0"
                                        value={data.min_stock}
                                        onChange={(e) => setData('min_stock', e.target.value)}
                                        aria-invalid={!!errors.min_stock}
                                    />
                                    <FieldError>{errors.min_stock}</FieldError>
                                </Field>
                            </div>

                            {/* Status Aktif */}
                            <div className="flex items-center justify-between rounded-lg border border-border p-3">
                                <div className="space-y-0.5">
                                    <Label htmlFor="edit-active" className="text-sm font-medium">
                                        Status Produk
                                    </Label>
                                    <p className="text-xs text-muted-foreground">
                                        Produk aktif akan muncul di kasir POS.
                                    </p>
                                </div>
                                <Switch
                                    id="edit-active"
                                    checked={data.active}
                                    onCheckedChange={(checked) => setData('active', checked)}
                                />
                            </div>
                        </FieldGroup>
                    </div>

                    <DialogFooter className="px-6 py-3.5 border-t border-border/50 bg-muted/20 shrink-0 gap-2">
                        <DialogClose render={<Button variant="outline" type="button" />}>
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

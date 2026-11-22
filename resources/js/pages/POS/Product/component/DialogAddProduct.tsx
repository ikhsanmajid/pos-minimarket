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
import { Plus, Barcode, Upload, DollarSign, Package, X } from 'lucide-react'
import { toast } from 'react-toastify'
import ProductController from '@/actions/App/Http/Controllers/ProductController'
import SelectKategoriProduct, { type CategoryOption } from './SelectKategoriProduct'
import type { Category } from '../Product'

export interface DialogAddProductProps {
    categories?: Category[]
    storeUrl?: string
    open?: boolean
    onOpenChange?: (open: boolean) => void
    trigger?: React.ReactNode
}

export function DialogAddProduct({
    categories = [],
    storeUrl,
    open: controlledOpen,
    onOpenChange: setControlledOpen,
    trigger,
}: DialogAddProductProps) {
    const [uncontrolledOpen, setUncontrolledOpen] = React.useState(false)
    const isControlled = controlledOpen !== undefined
    const open = isControlled ? controlledOpen : uncontrolledOpen

    const [imagePreview, setImagePreview] = React.useState<string | null>(null)
    const fileInputRef = React.useRef<HTMLInputElement>(null)

    const { data, setData, post, processing, errors, reset } = useForm({
        category_id: '',
        barcode: '',
        name: '',
        buy_price: '',
        sell_price: '',
        stock: '',
        min_stock: '',
        image: null as File | null,
        active: true,
    })

    const handleOpenChange = (nextOpen: boolean, eventDetails?: { reason?: string }) => {
        // Jangan tutup modal jika user mengklik area di luar modal (click outside)
        if (!nextOpen && eventDetails?.reason === 'outside-press') {
            return
        }

        if (!isControlled) {
            setUncontrolledOpen(nextOpen)
        }
        setControlledOpen?.(nextOpen)

        if (!nextOpen) {
            reset()
            setImagePreview(null)
            if (fileInputRef.current) {
                fileInputRef.current.value = ''
            }
        }
    }

    const generateBarcode = () => {
        const randomBarcode = '899' + Math.floor(100000000 + Math.random() * 900000000)
        setData('barcode', randomBarcode)
    }

    const buyPrice = Number(data.buy_price) || 0
    const sellPrice = Number(data.sell_price) || 0
    const profit = sellPrice - buyPrice
    const marginPercentage = buyPrice > 0 ? ((profit / buyPrice) * 100).toFixed(1) : '0'

    const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (file) {
            setData('image', file)
            setImagePreview(URL.createObjectURL(file))
        }
    }

    const handleRemoveImage = () => {
        setData('image', null)
        setImagePreview(null)
        if (fileInputRef.current) {
            fileInputRef.current.value = ''
        }
    }

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        post(storeUrl || ProductController.store.url(), {
            forceFormData: true,
            preserveScroll: true,
            onSuccess: () => {
                handleOpenChange(false)
            },
            onError: (err) => {
                if (err.forbidden) {
                    toast.error(err.forbidden)
                } else {
                    toast.error('Periksa kembali inputan Anda. Ada data yang belum valid.')
                }
            },
        })
    }

    const categoryOptions = React.useMemo<CategoryOption[]>(() => {
        return categories.map((c) => ({
            value: c.id,
            label: c.name,
        }))
    }, [categories])

    return (
        <Dialog open={open} onOpenChange={handleOpenChange} disablePointerDismissal>
            {!isControlled && (
                <DialogTrigger
                    render={
                        trigger ? (
                            trigger as React.ReactElement
                        ) : (
                            <Button className="w-full sm:w-auto gap-2">
                                <Plus className="h-4 w-4" />
                                Tambah Produk
                            </Button>
                        )
                    }
                />
            )}

            <DialogContent className="sm:max-w-3xl p-0 gap-0 overflow-hidden max-h-[88vh] flex flex-col">
                <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden">
                    <DialogHeader className="px-6 pt-5 pb-4 border-b border-border/50 shrink-0">
                        <DialogTitle className="flex items-center gap-2">
                            Tambah Produk Baru
                        </DialogTitle>
                        <DialogDescription>
                            Isi detail informasi produk baru untuk dimasukkan ke sistem POS.
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
                                    <Package className="h-8 w-8 text-muted-foreground/60" />
                                )}
                            </div>

                            <div className="space-y-1.5 flex-1 min-w-0">
                                <Label className="text-xs font-semibold">Foto Produk (Opsional)</Label>
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
                                            Hapus
                                        </Button>
                                    )}
                                </div>
                                <p className="text-[11px] text-muted-foreground">
                                    JPG, PNG, atau WEBP. Maks 2MB.
                                </p>
                                <FieldError>{errors.image}</FieldError>
                            </div>
                        </div>

                        {/* Barcode & Nama Produk */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <Field>
                                <Label htmlFor="add-barcode" className="flex items-center gap-1.5">
                                    <Barcode className="h-3.5 w-3.5 text-muted-foreground" />
                                    Barcode <span className="text-destructive">*</span>
                                </Label>
                                <div className="flex gap-2">
                                    <Input
                                        id="add-barcode"
                                        value={data.barcode}
                                        onChange={(e) => setData('barcode', e.target.value)}
                                        placeholder="Scan / ketik barcode"
                                        aria-invalid={!!errors.barcode}
                                        required
                                    />
                                    <Button
                                        type="button"
                                        variant="secondary"
                                        size="sm"
                                        onClick={generateBarcode}
                                        title="Generate Barcode Acak"
                                        className="shrink-0"
                                    >
                                        Generate
                                    </Button>
                                </div>
                                <FieldError>{errors.barcode}</FieldError>
                            </Field>

                            <Field>
                                <Label htmlFor="add-name">
                                    Nama Produk <span className="text-destructive">*</span>
                                </Label>
                                <Input
                                    id="add-name"
                                    value={data.name}
                                    onChange={(e) => setData('name', e.target.value)}
                                    placeholder="Contoh: Indomie Goreng 85g"
                                    aria-invalid={!!errors.name}
                                    required
                                />
                                <FieldError>{errors.name}</FieldError>
                            </Field>
                        </div>

                        {/* Kategori Produk (React-Select) */}
                        <Field>
                            <Label htmlFor="add-category">
                                Kategori Produk <span className="text-destructive">*</span>
                            </Label>
                            <SelectKategoriProduct
                                id="add-category"
                                value={data.category_id ? Number(data.category_id) : null}
                                defaultOptions={categoryOptions.length > 0 ? categoryOptions : true}
                                onChange={(val) => setData('category_id', val ? String(val) : '')}
                                error={errors.category_id}
                                placeholder="Cari atau pilih kategori produk..."
                                isClearable
                            />
                            <FieldError>{errors.category_id}</FieldError>
                        </Field>

                        {/* Harga Beli & Jual */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <Field>
                                <Label htmlFor="add-buy-price" className="flex items-center gap-1.5">
                                    <DollarSign className="h-3.5 w-3.5 text-muted-foreground" />
                                    Harga Beli / HPP (Rp) <span className="text-destructive">*</span>
                                </Label>
                                <Input
                                    id="add-buy-price"
                                    type="number"
                                    min="0"
                                    placeholder="0"
                                    value={data.buy_price}
                                    onChange={(e) => setData('buy_price', e.target.value)}
                                    aria-invalid={!!errors.buy_price}
                                    required
                                />
                                <FieldError>{errors.buy_price}</FieldError>
                            </Field>

                            <Field>
                                <Label htmlFor="add-sell-price" className="flex items-center gap-1.5">
                                    <DollarSign className="h-3.5 w-3.5 text-muted-foreground" />
                                    Harga Jual (Rp) <span className="text-destructive">*</span>
                                </Label>
                                <Input
                                    id="add-sell-price"
                                    type="number"
                                    min="0"
                                    placeholder="0"
                                    value={data.sell_price}
                                    onChange={(e) => setData('sell_price', e.target.value)}
                                    aria-invalid={!!errors.sell_price}
                                    required
                                />
                                <FieldError>{errors.sell_price}</FieldError>
                            </Field>
                        </div>

                        {/* Estimasi Profit Info */}
                        <div className="flex items-center justify-between text-xs p-2.5 bg-muted/40 rounded-md border border-border/60">
                            <span className="text-muted-foreground font-medium">
                                Estimasi Margin Keuntungan:
                            </span>
                            <span
                                className={`font-semibold ${profit > 0
                                        ? 'text-green-600 dark:text-green-400'
                                        : 'text-muted-foreground'
                                    }`}
                            >
                                Rp {profit.toLocaleString('id-ID')} ({marginPercentage}%)
                            </span>
                        </div>

                        {/* Stok Awal & Stok Minimum */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <Field>
                                <Label htmlFor="add-stock">
                                    Stok Awal <span className="text-destructive">*</span>
                                </Label>
                                <Input
                                    id="add-stock"
                                    type="number"
                                    min="0"
                                    placeholder="0"
                                    value={data.stock}
                                    onChange={(e) => setData('stock', e.target.value)}
                                    aria-invalid={!!errors.stock}
                                    required
                                />
                                <FieldError>{errors.stock}</FieldError>
                            </Field>

                            <Field>
                                <Label htmlFor="add-min-stock">
                                    Min. Stok Warning <span className="text-destructive">*</span>
                                </Label>
                                <Input
                                    id="add-min-stock"
                                    type="number"
                                    min="0"
                                    placeholder="0"
                                    value={data.min_stock}
                                    onChange={(e) => setData('min_stock', e.target.value)}
                                    aria-invalid={!!errors.min_stock}
                                    required
                                />
                                <FieldError>{errors.min_stock}</FieldError>
                            </Field>
                        </div>

                        {/* Status Etalase */}
                        <div className="flex items-center justify-between rounded-lg border border-border p-3">
                            <div className="space-y-0.5">
                                <Label htmlFor="add-active" className="text-sm font-medium cursor-pointer">
                                    Status Etalase
                                </Label>
                                <p className="text-xs text-muted-foreground">
                                    {data.active
                                        ? 'Produk aktif dan langsung dapat dijual di kasir POS'
                                        : 'Produk disimpan sebagai arsip/nonaktif'}
                                </p>
                            </div>
                            <Switch
                                id="add-active"
                                checked={data.active}
                                onCheckedChange={(checked) => setData('active', checked)}
                            />
                        </div>
                        </FieldGroup>
                    </div>

                    <DialogFooter className="px-6 py-3.5 border-t border-border/50 bg-muted/20 shrink-0 gap-2">
                        <DialogClose render={<Button variant="outline" type="button" disabled={processing} />}>
                            Batal
                        </DialogClose>
                        <Button type="submit" disabled={processing} className="gap-2">
                            <Plus className="h-4 w-4" />
                            {processing ? 'Menyimpan…' : 'Simpan Produk'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}

export default DialogAddProduct

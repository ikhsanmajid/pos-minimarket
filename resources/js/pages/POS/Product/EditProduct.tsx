import React, { useState, useRef } from 'react'
import { router, useForm, usePage } from '@inertiajs/react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Barcode, Upload, ArrowLeft, Package, DollarSign } from 'lucide-react'
import AuthenticatedLayout from '@/layouts/AuthenticatedLayout'
import type { PageProps } from '@/types'
import { toast } from 'react-toastify'
import ProductController from '@/actions/App/Http/Controllers/ProductController'
import type { Category, Product } from './Product'

interface EditProductProps extends PageProps {
    product: Product
    categories: Category[]
}

const EditProduct = () => {
    const { product, categories } = usePage<EditProductProps>().props
    const [imagePreview, setImagePreview] = useState<string | null>(product.image || null)
    const fileInputRef = useRef<HTMLInputElement>(null)

    const { data, setData, post, processing, errors } = useForm({
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

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        post(ProductController.update.url(product.id), {
            forceFormData: true,
            onError: (error) => {
                if (error.forbidden) {
                    toast.error(error.forbidden)
                } else {
                    toast.error('Periksa kembali inputan Anda. Ada data yang tidak valid.')
                }
            },
        })
    }

    return (
        <div className="max-w-4xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
            <Card className="shadow-lg border-border/50">
                <CardHeader className="bg-muted/30 border-b pb-6">
                    <div className="flex items-center justify-between">
                        <CardTitle className="text-2xl font-bold text-foreground">
                            Edit Produk: {product.name}
                        </CardTitle>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => router.get(ProductController.index.url())}
                            className="gap-2"
                        >
                            <ArrowLeft className="w-4 h-4" /> Kembali
                        </Button>
                    </div>
                </CardHeader>

                <form onSubmit={handleSubmit}>
                    <CardContent className="space-y-6 pt-6">
                        {/* Barcode & Nama Produk */}
                        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                            <div className="md:col-span-5 space-y-2">
                                <Label htmlFor="barcode" className="flex items-center gap-2">
                                    <Barcode className="w-4 h-4 text-muted-foreground" />
                                    Kode Barcode <span className="text-red-500">*</span>
                                </Label>
                                <div className="flex gap-2">
                                    <Input
                                        id="barcode"
                                        value={data.barcode}
                                        onChange={(e) => setData('barcode', e.target.value)}
                                        placeholder="Scan / Ketik Barcode"
                                        className={errors.barcode ? 'border-red-500 focus-visible:ring-red-500' : ''}
                                    />
                                    <Button
                                        type="button"
                                        variant="secondary"
                                        onClick={generateBarcode}
                                        title="Generate Barcode Acak"
                                    >
                                        Generate
                                    </Button>
                                </div>
                                {errors.barcode && <p className="text-red-500 text-xs">{errors.barcode}</p>}
                            </div>

                            <div className="md:col-span-7 space-y-2">
                                <Label htmlFor="name">
                                    Nama Produk <span className="text-red-500">*</span>
                                </Label>
                                <Input
                                    id="name"
                                    value={data.name}
                                    onChange={(e) => setData('name', e.target.value)}
                                    placeholder="Contoh: Indomie Goreng 85g"
                                    required
                                    className={errors.name ? 'border-red-500 focus-visible:ring-red-500' : ''}
                                />
                                {errors.name && <p className="text-red-500 text-xs">{errors.name}</p>}
                            </div>
                        </div>

                        {/* Kategori */}
                        <div className="space-y-2">
                            <Label htmlFor="category_id">
                                Kategori Produk <span className="text-red-500">*</span>
                            </Label>
                            <select
                                id="category_id"
                                value={data.category_id}
                                onChange={(e) => setData('category_id', e.target.value)}
                                className={`w-full px-3 py-2 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                                    errors.category_id ? 'border-red-500' : 'border-input'
                                }`}
                                required
                            >
                                <option value="">-- Pilih Kategori --</option>
                                {categories.map((cat) => (
                                    <option key={cat.id} value={cat.id}>
                                        {cat.name}
                                    </option>
                                ))}
                            </select>
                            {errors.category_id && <p className="text-red-500 text-xs">{errors.category_id}</p>}
                        </div>

                        {/* Harga */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-4 bg-muted/30 rounded-lg border border-border/50">
                            <div className="space-y-2">
                                <Label htmlFor="buy_price">Harga Beli (Modal)</Label>
                                <div className="relative">
                                    <span className="absolute left-3 top-2.5 text-xs text-muted-foreground font-bold">
                                        Rp
                                    </span>
                                    <Input
                                        id="buy_price"
                                        type="number"
                                        min="0"
                                        value={data.buy_price}
                                        onChange={(e) => setData('buy_price', e.target.value)}
                                        className={`pl-9 ${errors.buy_price ? 'border-red-500' : ''}`}
                                        placeholder="0"
                                        required
                                    />
                                </div>
                                {errors.buy_price && <p className="text-red-500 text-xs">{errors.buy_price}</p>}
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="sell_price">Harga Jual</Label>
                                <div className="relative">
                                    <span className="absolute left-3 top-2.5 text-xs text-muted-foreground font-bold">
                                        Rp
                                    </span>
                                    <Input
                                        id="sell_price"
                                        type="number"
                                        min="0"
                                        value={data.sell_price}
                                        onChange={(e) => setData('sell_price', e.target.value)}
                                        className={`pl-9 ${errors.sell_price ? 'border-red-500' : ''}`}
                                        placeholder="0"
                                        required
                                    />
                                </div>
                                {errors.sell_price && <p className="text-red-500 text-xs">{errors.sell_price}</p>}
                            </div>

                            {/* Estimasi Margin Info */}
                            <div className="md:col-span-2 flex items-center justify-between text-sm px-2 py-1 bg-background rounded border border-border/50 text-muted-foreground">
                                <div className="flex items-center gap-1.5">
                                    <DollarSign className="w-4 h-4 text-green-500" />
                                    <span>Estimasi Keuntungan:</span>
                                    <span className="font-semibold text-foreground">
                                        Rp {profit > 0 ? profit.toLocaleString('id-ID') : 0}
                                    </span>
                                </div>
                                <div>
                                    <span>Margin: </span>
                                    <span
                                        className={`font-semibold ${
                                            Number(marginPercentage) > 0 ? 'text-green-500' : 'text-muted-foreground'
                                        }`}
                                    >
                                        {marginPercentage}%
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Stok & Min Stok */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <Label htmlFor="stock">Stok Awal</Label>
                                <Input
                                    id="stock"
                                    type="number"
                                    min="0"
                                    value={data.stock}
                                    onChange={(e) => setData('stock', e.target.value)}
                                    placeholder="0"
                                    className={errors.stock ? 'border-red-500' : ''}
                                    required
                                />
                                {errors.stock && <p className="text-red-500 text-xs">{errors.stock}</p>}
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="min_stock">Peringatan Minimum Stok</Label>
                                <Input
                                    id="min_stock"
                                    type="number"
                                    min="0"
                                    value={data.min_stock}
                                    onChange={(e) => setData('min_stock', e.target.value)}
                                    placeholder="Contoh: 5"
                                    className={errors.min_stock ? 'border-red-500' : ''}
                                    required
                                />
                                {errors.min_stock && <p className="text-red-500 text-xs">{errors.min_stock}</p>}
                            </div>
                        </div>

                        {/* Foto Produk */}
                        <div className="space-y-2">
                            <Label>Foto Produk</Label>
                            <div className="flex items-center gap-4">
                                <div className="w-24 h-24 rounded-lg border-2 border-dashed border-border flex items-center justify-center overflow-hidden bg-muted/20 relative group">
                                    {imagePreview ? (
                                        <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                                    ) : (
                                        <Package className="w-8 h-8 text-muted-foreground" />
                                    )}
                                </div>
                                <div className="space-y-2 flex-1">
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
                                        onClick={() => fileInputRef.current?.click()}
                                        className="gap-2"
                                    >
                                        <Upload className="w-4 h-4" /> Ganti Gambar
                                    </Button>
                                    <p className="text-xs text-muted-foreground">
                                        Format: JPG, PNG, WEBP. Maks: 2MB. Biarkan kosong jika tidak ingin mengganti.
                                    </p>
                                    {errors.image && <p className="text-red-500 text-xs">{errors.image}</p>}
                                </div>
                            </div>
                        </div>

                        {/* Status Aktif Switch */}
                        <div className="flex items-center justify-between p-4 bg-muted/20 rounded-lg border border-border/50">
                            <div className="space-y-0.5">
                                <Label htmlFor="active" className="text-base font-medium cursor-pointer">
                                    Status Produk
                                </Label>
                                <p className="text-xs text-muted-foreground">
                                    Jika dinonaktifkan, produk tidak akan muncul pada sistem kasir.
                                </p>
                            </div>
                            <Switch
                                id="active"
                                checked={data.active}
                                onCheckedChange={(checked) => setData('active', checked)}
                            />
                        </div>
                    </CardContent>

                    <CardFooter className="flex justify-end gap-3 border-t bg-muted/10 py-4">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => router.get(ProductController.index.url())}
                        >
                            Batal
                        </Button>
                        <Button type="submit" disabled={processing}>
                            {processing ? 'Menyimpan...' : 'Simpan Perubahan'}
                        </Button>
                    </CardFooter>
                </form>
            </Card>
        </div>
    )
}

EditProduct.layout = (page: React.ReactNode) => (
    <AuthenticatedLayout>{page}</AuthenticatedLayout>
)

export default EditProduct

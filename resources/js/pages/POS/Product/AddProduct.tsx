import React, { useState, useRef } from 'react';
import { router, useForm, usePage } from '@inertiajs/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, Barcode, Upload, ArrowLeft, DollarSign } from 'lucide-react';
import AuthenticatedLayout from '@/layouts/AuthenticatedLayout';
import { PageProps } from '@/types';
import { toast } from 'react-toastify';
import products from '@/routes/pos/products';

interface Category {
    id: number;
    name: string;
}

type CategoryProductProps = PageProps<{ categories: Category[] }>;

const CreateProduct = () => {
    const { categories } = usePage<CategoryProductProps>().props;
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const { data, setData, submit, processing, errors, reset } = useForm({
        category_id: '',
        barcode: '',
        name: '',
        buy_price: '',
        sell_price: '',
        stock: '',
        min_stock: '',
        image: null as File | null,
        active: true,
    });

    const generateBarcode = () => {
        const randomBarcode = '899' + Math.floor(100000000 + Math.random() * 900000000);
        setData('barcode', randomBarcode);
    };

    const buyPrice = Number(data.buy_price) || 0;
    const sellPrice = Number(data.sell_price) || 0;
    const profit = sellPrice - buyPrice;
    const marginPercentage = buyPrice > 0 ? ((profit / buyPrice) * 100).toFixed(1) : '0';

    const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setData('image', file);
            setImagePreview(URL.createObjectURL(file));
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        submit(products.store(), {
            forceFormData: true,
            onSuccess: () => {
                reset();
                setImagePreview(null);
            },
            onError: (error) => {
                if (error.forbidden) {
                    toast.error(error.forbidden);
                } else {
                    toast.error("Periksa kembali inputan Anda. Ada data yang tidak valid.");
                }
            },
        });
    };

    return (
        <div className="max-w-4xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
            <Card className="shadow-lg border-border/50">
                <CardHeader className="bg-muted/30 border-b pb-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle className="text-2xl font-bold text-foreground flex items-center gap-2">
                                Tambah Produk
                            </CardTitle>
                        </div>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => router.get(products.index.url())}
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
                                <Label htmlFor="name">Nama Produk <span className="text-red-500">*</span></Label>
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
                            <Label htmlFor="category_id">Kategori Produk <span className="text-red-500">*</span></Label>
                            <select
                                id="category_id"
                                value={data.category_id}
                                onChange={(e) => setData('category_id', e.target.value)}
                                className={`w-full px-3 py-2 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.category_id ? 'border-red-500' : 'border-input'}`}
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
                                <Label htmlFor="buy_price" className="flex items-center gap-2">
                                    <DollarSign className="w-4 h-4 text-muted-foreground" />
                                    Harga Beli / HPP (Rp) <span className="text-red-500">*</span>
                                </Label>
                                <Input
                                    id="buy_price"
                                    type="number"
                                    min="0"
                                    value={data.buy_price}
                                    onChange={(e) => setData('buy_price', e.target.value)}
                                    placeholder="0"
                                    required
                                    className={`[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${errors.buy_price ? 'border-red-500 focus-visible:ring-red-500' : ''
                                        }`}
                                />
                                {errors.buy_price && <p className="text-red-500 text-xs">{errors.buy_price}</p>}
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="sell_price" className="flex items-center gap-2">
                                    <DollarSign className="w-4 h-4 text-muted-foreground" />
                                    Harga Jual (Rp) <span className="text-red-500">*</span>
                                </Label>
                                <Input
                                    id="sell_price"
                                    type="number"
                                    min="0"
                                    value={data.sell_price}
                                    onChange={(e) => setData('sell_price', e.target.value)}
                                    placeholder="0"
                                    required
                                    className={`[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${errors.sell_price ? 'border-red-500 focus-visible:ring-red-500' : ''
                                        }`}
                                />
                                {errors.sell_price && <p className="text-red-500 text-xs">{errors.sell_price}</p>}
                            </div>

                            <div className="md:col-span-2 flex items-center justify-between text-sm p-3 bg-background rounded-md border border-border">
                                <span className="text-muted-foreground font-medium">Estimasi Profit:</span>
                                <span className={`font-bold text-base ${profit > 0 ? 'text-green-600 dark:text-green-500' : 'text-red-500'}`}>
                                    Rp {profit.toLocaleString('id-ID')} ({marginPercentage}%)
                                </span>
                            </div>

                        </div>

                        {/* Stok & Batas Minimum Stok */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <Label htmlFor="stock">Stok Awal <span className="text-red-500">*</span></Label>
                                <Input
                                    id="stock"
                                    type="number"
                                    min="0"
                                    placeholder="0"
                                    value={data.stock}
                                    onChange={(e) => setData('stock', e.target.value)}
                                    required
                                    className={`[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${errors.stock ? 'border-red-500 focus-visible:ring-red-500' : ''
                                        }`}
                                />
                                {errors.stock && <p className="text-red-500 text-xs">{errors.stock}</p>}
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="min_stock">Stok Minimum (Warning) <span className="text-red-500">*</span></Label>
                                <Input
                                    id="min_stock"
                                    type="number"
                                    min="0"
                                    placeholder="0"
                                    value={data.min_stock}
                                    onChange={(e) => setData('min_stock', e.target.value)}
                                    required
                                    className={`[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${errors.min_stock ? 'border-red-500 focus-visible:ring-red-500' : ''
                                        }`}
                                />
                                {errors.min_stock && <p className="text-red-500 text-xs">{errors.min_stock}</p>}
                            </div>
                        </div>

                        {/* Gambar & Switch Status */}
                        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start pt-2 border-t border-border/50 mt-6">
                            <div className="md:col-span-8 space-y-2">
                                <Label>Foto Produk (Opsional)</Label>
                                {/* Custom Dropzone untuk Gambar */}
                                <div
                                    className="flex items-center justify-center w-full h-36 px-4 transition bg-background border-2 border-dashed rounded-xl appearance-none cursor-pointer hover:border-blue-500 hover:bg-muted/50"
                                    onClick={() => fileInputRef.current?.click()}
                                >
                                    <span className="flex items-center space-x-2 text-muted-foreground">
                                        {imagePreview ? (
                                            <img src={imagePreview} alt="Preview" className="h-32 object-contain rounded-lg shadow-sm py-2" />
                                        ) : (
                                            <div className="flex flex-col items-center gap-2">
                                                <Upload className="w-8 h-8 text-muted-foreground/70" />
                                                <span className="font-medium text-sm">Klik untuk mengunggah gambar</span>
                                                <span className="text-xs">PNG, JPG maksimal 2MB</span>
                                            </div>
                                        )}
                                    </span>
                                    <Input
                                        type="file"
                                        accept="image/*"
                                        className="hidden"
                                        ref={fileInputRef}
                                        onChange={handleImageChange}
                                    />
                                </div>
                                {errors.image && <p className="text-red-500 text-xs">{errors.image}</p>}
                            </div>

                            <div className="md:col-span-4 flex flex-col items-start md:items-end justify-center h-full space-y-3 pt-8 md:pt-0">
                                <Label className="text-muted-foreground">Status Etalase</Label>
                                <div className="flex items-center space-x-3 bg-muted/30 p-4 rounded-xl border border-border/50">
                                    <Switch
                                        id="active"
                                        checked={data.active}
                                        onCheckedChange={(checked) => setData('active', checked)}
                                    />
                                    <Label htmlFor="active" className="cursor-pointer font-semibold">
                                        {data.active ? 'Produk Aktif' : 'Disembunyikan'}
                                    </Label>
                                </div>
                            </div>
                        </div>
                    </CardContent>

                    {/* Tombol Aksi di Footer Card */}
                    <CardFooter className="flex justify-end gap-3 bg-muted/20 border-t p-6 rounded-b-xl">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => router.get(products.index.url())}
                            disabled={processing}
                            className="w-full md:w-auto"
                        >
                            Batal
                        </Button>
                        <Button
                            type="submit"
                            disabled={processing}
                            className="w-full md:w-auto bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-500/20 gap-2"
                        >
                            <Plus className="w-4 h-4" />
                            {processing ? 'Menyimpan...' : 'Simpan Produk'}
                        </Button>
                    </CardFooter>
                </form>
            </Card>
        </div>
    );
};

CreateProduct.layout = (page: React.ReactNode) => (<AuthenticatedLayout>{page}</AuthenticatedLayout>);

export default CreateProduct;
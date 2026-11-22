import React from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { ArrowLeftRight, PackageSearch } from 'lucide-react'
import type { DetailProductData } from '../DetailProduct'

interface StokMutasiProductProps {
    product: DetailProductData
}

export function StokMutasiProduct({ product }: StokMutasiProductProps) {
    return (
        <Card>
            <CardHeader>
                <div className="flex items-center gap-2">
                    <ArrowLeftRight className="h-5 w-5 text-muted-foreground" />
                    <div>
                        <CardTitle className="text-base font-semibold">Riwayat Mutasi Stok</CardTitle>
                        <CardDescription>
                            Log pergerakan stok keluar dan masuk untuk produk {product.name}.
                        </CardDescription>
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                <div className="flex min-h-[220px] flex-col items-center justify-center rounded-lg border border-dashed p-8 text-center">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                        <PackageSearch className="h-6 w-6 text-muted-foreground" />
                    </div>
                    <h3 className="mt-4 text-sm font-semibold text-foreground">Belum ada riwayat mutasi stok</h3>
                    <p className="mt-1.5 max-w-sm text-xs text-muted-foreground">
                        Fitur mutasi stok akan segera hadir untuk melacak riwayat penerimaan barang, penjualan, dan penyesuaian inventaris.
                    </p>
                </div>
            </CardContent>
        </Card>
    )
}

export default StokMutasiProduct

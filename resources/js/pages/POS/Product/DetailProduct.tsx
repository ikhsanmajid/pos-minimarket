import React from 'react'
import { Link, usePage } from '@inertiajs/react'
import AuthenticatedLayout from '@/layouts/AuthenticatedLayout'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import ProductController from '@/actions/App/Http/Controllers/ProductController'
import {
    ArrowLeft,
    Package,
    ArrowLeftRight,
} from 'lucide-react'
import type { PageProps } from '@/types'
import { DetailTabProduct } from './component/DetailTabProduct'
import { StokMutasiProduct } from './component/StokMutasiProduct'
import type { Product } from './Product'

export interface DetailProductData extends Product {
    category_name?: string
    created_at?: string
    updated_at?: string
}

type DetailProductProps = PageProps<{ product: DetailProductData }>

const DetailProduct = () => {
    const { product } = usePage<DetailProductProps>().props

    return (
        <div className="w-full min-w-0 space-y-6">
            {/* Top Bar: Tombol Kembali & Judul Halaman */}
            <div className="flex items-center gap-3">
                <Button
                    variant="ghost"
                    size="sm"
                    render={<Link href={ProductController.index.url()} />}
                    className="gap-1.5 text-muted-foreground hover:text-foreground -ml-2"
                >
                    <ArrowLeft className="h-4 w-4" />
                    Kembali
                </Button>
                <div className="h-4 w-px bg-border" />
                <h1 className="text-xl font-bold tracking-tight text-foreground truncate">
                    {product.name}
                </h1>
            </div>

            {/* Tabs Detail & Mutasi Stok */}
            <Tabs defaultValue="detail" className="w-full space-y-4">
                <TabsList
                    variant="line"
                    className="w-full justify-start border-b border-border gap-6 rounded-none p-0 bg-transparent"
                >
                    <TabsTrigger value="detail" className="gap-2 pb-2.5">
                        <Package className="h-4 w-4" />
                        Detail Produk
                    </TabsTrigger>
                    <TabsTrigger value="mutation" className="gap-2 pb-2.5">
                        <ArrowLeftRight className="h-4 w-4" />
                        Mutasi Stok
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="detail" className="m-0 focus-visible:outline-none">
                    <DetailTabProduct product={product} />
                </TabsContent>

                <TabsContent value="mutation" className="m-0 focus-visible:outline-none">
                    <StokMutasiProduct product={product} />
                </TabsContent>
            </Tabs>
        </div>
    )
}

DetailProduct.layout = (page: React.ReactNode) => (
    <AuthenticatedLayout>{page}</AuthenticatedLayout>
)

export default DetailProduct

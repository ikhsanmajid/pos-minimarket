import React, { useState, useEffect } from 'react'
import { Link, router, usePage } from '@inertiajs/react'
import AuthenticatedLayout from '@/layouts/AuthenticatedLayout'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import ProductController from '@/actions/App/Http/Controllers/ProductController'
import {
    ArrowLeft,
    Crown,
    Package,
    ArrowLeftRight,
    History,
    Tag,
} from 'lucide-react'
import type {
    CustomerTierOption,
    PageProps,
    ProductMemberPriceRow,
    ProductPriceTierRow,
} from '@/types'
import { DetailTabProduct } from './component/DetailTabProduct'
import { ProductPriceTiersTab } from './component/ProductPriceTiersTab'
import { ProductMemberPricesTab } from './component/ProductMemberPricesTab'
import {
    StokMutasiProduct,
    type PaginatedStockMovements,
} from './component/StokMutasiProduct'
import {
    RiwayatPerubahanProduct,
    type PaginatedProductActivities,
} from './component/RiwayatPerubahanProduct'
import type { Product } from './Product'

export interface DetailProductData extends Product {
    category_name?: string
    created_at?: string
    updated_at?: string
    price_tiers?: ProductPriceTierRow[]
    member_prices?: ProductMemberPriceRow[]
}

type DetailProductProps = PageProps<{
    product: DetailProductData
    stockMovements?: PaginatedStockMovements | null
    activities?: PaginatedProductActivities
    canViewStock?: boolean
    canManagePriceTiers?: boolean
    tierOptions?: CustomerTierOption[]
}>

const DetailProduct = () => {
    const {
        product,
        stockMovements,
        activities,
        canViewStock = true,
        canManagePriceTiers = false,
        tierOptions = [],
    } = usePage<DetailProductProps>().props

    const queryTab =
        typeof window !== 'undefined'
            ? new URLSearchParams(window.location.search).get('tab')
            : null
    const [activeTab, setActiveTab] = useState(
        queryTab === 'history'
            ? 'history'
            : queryTab === 'tiers'
                ? 'tiers'
                : queryTab === 'member-prices'
                    ? 'member-prices'
                    : queryTab === 'mutation' && canViewStock
                        ? 'mutation'
                        : 'detail'
    )
    const [isLoadingActivities, setIsLoadingActivities] = useState(false)
    const [isLoadingMovements, setIsLoadingMovements] = useState(false)

    const loadActivities = () => {
        setIsLoadingActivities(true)
        router.reload({
            only: ['activities'],
            onFinish: () => setIsLoadingActivities(false),
        })
    }

    const loadStockMovements = () => {
        setIsLoadingMovements(true)
        router.reload({
            only: ['stockMovements'],
            onFinish: () => setIsLoadingMovements(false),
        })
    }

    const handleTabChange = (val: string) => {
        setActiveTab(val)
        if (val === 'history' && !activities && !isLoadingActivities) {
            loadActivities()
        }
        if (val === 'mutation' && canViewStock && !stockMovements && !isLoadingMovements) {
            loadStockMovements()
        }
    }

    useEffect(() => {
        if (activeTab === 'history' && !activities && !isLoadingActivities) {
            loadActivities()
        }
        if (activeTab === 'mutation' && canViewStock && !stockMovements && !isLoadingMovements) {
            loadStockMovements()
        }
    }, [activeTab, canViewStock])

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

            {/* Tabs Detail, Mutasi Stok, & Riwayat Perubahan */}
            <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full space-y-4">
                <TabsList
                    variant="line"
                    className="w-full justify-start border-b border-border gap-6 rounded-none p-0 bg-transparent"
                >
                    <TabsTrigger value="detail" className="gap-2 pb-2.5">
                        <Package className="h-4 w-4" />
                        Detail Produk
                    </TabsTrigger>
                    <TabsTrigger value="tiers" className="gap-2 pb-2.5">
                        <Tag className="h-4 w-4" />
                        Harga Grosir
                        {(product.price_tiers?.length ?? 0) > 0 && (
                            <Badge variant="secondary" className="ml-1 px-1.5 py-0 text-[10px] font-mono">
                                {product.price_tiers?.length}
                            </Badge>
                        )}
                    </TabsTrigger>
                    <TabsTrigger value="member-prices" className="gap-2 pb-2.5">
                        <Crown className="h-4 w-4" />
                        Harga Member
                        {(product.member_prices?.length ?? 0) > 0 && (
                            <Badge variant="secondary" className="ml-1 px-1.5 py-0 text-[10px] font-mono">
                                {product.member_prices?.length}
                            </Badge>
                        )}
                    </TabsTrigger>
                    {canViewStock && (
                        <TabsTrigger value="mutation" className="gap-2 pb-2.5">
                            <ArrowLeftRight className="h-4 w-4" />
                            Mutasi Stok
                            {stockMovements?.total !== undefined && (
                                <Badge variant="secondary" className="ml-1 px-1.5 py-0 text-[10px] font-mono">
                                    {stockMovements.total}
                                </Badge>
                            )}
                        </TabsTrigger>
                    )}
                    <TabsTrigger value="history" className="gap-2 pb-2.5">
                        <History className="h-4 w-4" />
                        Riwayat Perubahan
                        {activities?.total !== undefined && (
                            <Badge variant="secondary" className="ml-1 px-1.5 py-0 text-[10px] font-mono">
                                {activities.total}
                            </Badge>
                        )}
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="detail" className="m-0 focus-visible:outline-none">
                    <DetailTabProduct product={product} canViewStock={canViewStock} />
                </TabsContent>

                <TabsContent value="tiers" className="m-0 focus-visible:outline-none">
                    <ProductPriceTiersTab product={product} canManage={canManagePriceTiers} />
                </TabsContent>

                <TabsContent value="member-prices" className="m-0 focus-visible:outline-none">
                    <ProductMemberPricesTab
                        product={product}
                        canManage={canManagePriceTiers}
                        tierOptions={tierOptions}
                    />
                </TabsContent>

                {canViewStock && (
                    <TabsContent value="mutation" className="m-0 focus-visible:outline-none">
                        <StokMutasiProduct
                            product={product}
                            stockMovements={stockMovements ?? undefined}
                            isLoading={isLoadingMovements}
                            onRefresh={loadStockMovements}
                        />
                    </TabsContent>
                )}

                <TabsContent value="history" className="m-0 focus-visible:outline-none">
                    <RiwayatPerubahanProduct
                        product={product}
                        activities={activities}
                        isLoading={isLoadingActivities}
                        onRefresh={loadActivities}
                    />
                </TabsContent>
            </Tabs>
        </div>
    )
}

DetailProduct.layout = (page: React.ReactNode) => (
    <AuthenticatedLayout>{page}</AuthenticatedLayout>
)

export default DetailProduct

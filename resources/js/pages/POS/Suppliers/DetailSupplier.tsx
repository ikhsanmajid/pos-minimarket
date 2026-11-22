import React, { useState, useEffect } from 'react'
import { Link, router, usePage } from '@inertiajs/react'
import AuthenticatedLayout from '@/layouts/AuthenticatedLayout'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import SupplierController from '@/actions/App/Http/Controllers/SupplierController'
import { ArrowLeft, Building2, History, Pencil, Trash2 } from 'lucide-react'
import type { PageProps } from '@/types'
import { useAuth } from '@/hooks/use-auth'
import { DetailTabSupplier } from './component/DetailTabSupplier'
import {
    RiwayatPerubahanSupplier,
    type PaginatedSupplierActivities,
} from './component/RiwayatPerubahanSupplier'
import { DialogEditSupplier } from './component/DialogEditSupplier'
import { DialogDeleteSupplier } from './component/DialogDeleteSupplier'
import type { SupplierRow } from './Supplier'

type DetailSupplierProps = PageProps<{
    supplier: SupplierRow
    activities?: PaginatedSupplierActivities
}>

const DetailSupplier = () => {
    const { supplier, activities } = usePage<DetailSupplierProps>().props
    const { user } = useAuth()

    const userRole = (user?.role as string) || ''
    const canEdit = ['admin', 'supervisor', 'warehouse'].includes(userRole)
    const canDelete = ['admin', 'supervisor'].includes(userRole)

    const [editOpen, setEditOpen] = useState(false)
    const [deleteOpen, setDeleteOpen] = useState(false)

    // Dapatkan tab dari query param jika ada, default 'detail'
    const queryTab =
        typeof window !== 'undefined'
            ? new URLSearchParams(window.location.search).get('tab')
            : null
    const [activeTab, setActiveTab] = useState(queryTab === 'history' ? 'history' : 'detail')
    const [isLoadingActivities, setIsLoadingActivities] = useState(false)

    const loadActivities = () => {
        setIsLoadingActivities(true)
        router.reload({
            only: ['activities'],
            onFinish: () => setIsLoadingActivities(false),
        })
    }

    const handleTabChange = (val: string) => {
        setActiveTab(val)
        if (val === 'history' && !activities && !isLoadingActivities) {
            loadActivities()
        }
    }

    useEffect(() => {
        if (activeTab === 'history' && !activities && !isLoadingActivities) {
            loadActivities()
        }
    }, [activeTab])

    return (
        <div className="w-full min-w-0 space-y-6">
            {/* Top Bar: Tombol Kembali & Judul Halaman & Actions */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex items-center gap-3">
                    <Button
                        variant="ghost"
                        size="sm"
                        render={<Link href={SupplierController.index.url()} />}
                        className="gap-1.5 text-muted-foreground hover:text-foreground -ml-2"
                    >
                        <ArrowLeft className="h-4 w-4" />
                        Kembali
                    </Button>
                    <div className="h-4 w-px bg-border" />
                    <div className="flex flex-wrap items-center gap-2">
                        <h1 className="text-xl font-bold tracking-tight text-foreground truncate">
                            {supplier.name}
                        </h1>
                        {supplier.code && (
                            <Badge variant="outline" className="font-mono text-xs">
                                {supplier.code}
                            </Badge>
                        )}
                        {supplier.is_active ? (
                            <Badge variant="success">Aktif</Badge>
                        ) : (
                            <Badge variant="secondary">Nonaktif</Badge>
                        )}
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    {canEdit && (
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setEditOpen(true)}
                            className="gap-1.5 text-xs cursor-pointer"
                        >
                            <Pencil className="h-3.5 w-3.5" />
                            <span>Edit Supplier</span>
                        </Button>
                    )}

                    {canDelete && (
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setDeleteOpen(true)}
                            className="text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-xs gap-1.5 cursor-pointer"
                        >
                            <Trash2 className="h-3.5 w-3.5" />
                            <span>Hapus</span>
                        </Button>
                    )}
                </div>
            </div>

            {/* Tabs: Detail Supplier & Riwayat Perubahan */}
            <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full space-y-4">
                <TabsList
                    variant="line"
                    className="w-full justify-start border-b border-border gap-6 rounded-none p-0 bg-transparent"
                >
                    <TabsTrigger value="detail" className="gap-2 pb-2.5">
                        <Building2 className="h-4 w-4" />
                        Detail Supplier
                    </TabsTrigger>
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
                    <DetailTabSupplier supplier={supplier} />
                </TabsContent>

                <TabsContent value="history" className="m-0 focus-visible:outline-none">
                    <RiwayatPerubahanSupplier
                        supplier={supplier}
                        activities={activities}
                        isLoading={isLoadingActivities}
                        onRefresh={loadActivities}
                    />
                </TabsContent>
            </Tabs>

            {/* Dialog Edit Supplier */}
            {canEdit && (
                <DialogEditSupplier
                    supplier={supplier}
                    updateUrl={SupplierController.update.url(supplier.id)}
                    open={editOpen}
                    onOpenChange={setEditOpen}
                />
            )}

            {/* Dialog Delete Supplier */}
            {canDelete && (
                <DialogDeleteSupplier
                    supplier={supplier}
                    destroyUrl={SupplierController.destroy.url(supplier.id)}
                    open={deleteOpen}
                    onOpenChange={setDeleteOpen}
                />
            )}
        </div>
    )
}

DetailSupplier.layout = (page: React.ReactNode) => (
    <AuthenticatedLayout>{page}</AuthenticatedLayout>
)

export default DetailSupplier

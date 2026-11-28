import React, { useEffect, useState } from 'react'
import { Link, router, usePage } from '@inertiajs/react'
import AuthenticatedLayout from '@/layouts/AuthenticatedLayout'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import CustomerController from '@/actions/App/Http/Controllers/CustomerController'
import { ArrowLeft, Award, History, Pencil, ReceiptText, Trash2, User } from 'lucide-react'
import { toast } from 'react-toastify'
import type { PageProps } from '@/types'
import { useAuth } from '@/hooks/use-auth'
import { DetailTabCustomer, type CustomerDetailStats } from './component/DetailTabCustomer'
import {
    RiwayatTransaksiCustomer,
    type PaginatedCustomerTransactions,
} from './component/RiwayatTransaksiCustomer'
import {
    RiwayatPoinCustomer,
    type PaginatedCustomerPointLedgers,
} from './component/RiwayatPoinCustomer'
import {
    RiwayatPerubahanCustomer,
    type PaginatedCustomerActivities,
} from './component/RiwayatPerubahanCustomer'
import { DialogEditCustomer } from './component/DialogEditCustomer'
import { DialogDeleteCustomer } from './component/DialogDeleteCustomer'
import type { CustomerRow } from './Customer'

type DetailCustomerProps = PageProps<{
    customer: CustomerRow
    stats: CustomerDetailStats
    transactions?: PaginatedCustomerTransactions
    pointLedgers?: PaginatedCustomerPointLedgers
    activities?: PaginatedCustomerActivities
}>

const DetailCustomer = () => {
    const { customer, stats, transactions, pointLedgers, activities } =
        usePage<DetailCustomerProps>().props
    const { user, flash } = useAuth()

    const userRole = (user?.role as string) || ''
    const canEdit = ['admin', 'supervisor', 'cashier'].includes(userRole)
    const canDelete = ['admin', 'supervisor'].includes(userRole)

    const [editOpen, setEditOpen] = useState(false)
    const [deleteOpen, setDeleteOpen] = useState(false)

    const queryTab =
        typeof window !== 'undefined'
            ? new URLSearchParams(window.location.search).get('tab')
            : null
    const initialTab =
        queryTab === 'history' || queryTab === 'transactions' || queryTab === 'points'
            ? queryTab
            : 'detail'

    const [activeTab, setActiveTab] = useState(initialTab)
    const [isLoadingTransactions, setIsLoadingTransactions] = useState(false)
    const [isLoadingPointLedgers, setIsLoadingPointLedgers] = useState(false)
    const [isLoadingActivities, setIsLoadingActivities] = useState(false)

    useEffect(() => {
        if (flash?.success) toast.success(flash.success)
        if (flash?.error) toast.error(flash.error)
    }, [flash?.success, flash?.error])

    const loadTransactions = () => {
        setIsLoadingTransactions(true)
        router.reload({
            only: ['transactions'],
            onFinish: () => setIsLoadingTransactions(false),
        })
    }

    const loadPointLedgers = () => {
        setIsLoadingPointLedgers(true)
        router.reload({
            only: ['pointLedgers'],
            onFinish: () => setIsLoadingPointLedgers(false),
        })
    }

    const loadActivities = () => {
        setIsLoadingActivities(true)
        router.reload({
            only: ['activities'],
            onFinish: () => setIsLoadingActivities(false),
        })
    }

    const handleTabChange = (val: string) => {
        setActiveTab(val)
        if (val === 'transactions' && !transactions && !isLoadingTransactions) {
            loadTransactions()
        }
        if (val === 'points' && !pointLedgers && !isLoadingPointLedgers) {
            loadPointLedgers()
        }
        if (val === 'history' && !activities && !isLoadingActivities) {
            loadActivities()
        }
    }

    useEffect(() => {
        if (activeTab === 'transactions' && !transactions && !isLoadingTransactions) {
            loadTransactions()
        }
        if (activeTab === 'points' && !pointLedgers && !isLoadingPointLedgers) {
            loadPointLedgers()
        }
        if (activeTab === 'history' && !activities && !isLoadingActivities) {
            loadActivities()
        }
    }, [activeTab])

    return (
        <div className="w-full min-w-0 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                    <Button
                        variant="ghost"
                        size="sm"
                        render={<Link href={CustomerController.index.url()} />}
                        className="gap-1.5 text-muted-foreground hover:text-foreground -ml-2 shrink-0"
                    >
                        <ArrowLeft className="h-4 w-4" />
                        Kembali
                    </Button>
                    <div className="h-4 w-px bg-border shrink-0" />
                    <div className="flex flex-wrap items-center gap-2 min-w-0">
                        <h1 className="text-xl font-bold tracking-tight text-foreground truncate">
                            {customer.name}
                        </h1>
                        <Badge variant="outline" className="font-mono text-xs">
                            {customer.member_code}
                        </Badge>
                        {customer.is_active ? (
                            <Badge variant="success">Aktif</Badge>
                        ) : (
                            <Badge variant="secondary">Nonaktif</Badge>
                        )}
                    </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                    {canEdit && (
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setEditOpen(true)}
                            className="gap-1.5 text-xs cursor-pointer"
                        >
                            <Pencil className="h-3.5 w-3.5" />
                            <span>Edit Pelanggan</span>
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

            <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full space-y-4">
                <TabsList
                    variant="line"
                    className="w-full justify-start border-b border-border gap-6 rounded-none p-0 bg-transparent"
                >
                    <TabsTrigger value="detail" className="gap-2 pb-2.5">
                        <User className="h-4 w-4" />
                        Informasi &amp; Ringkasan Belanja
                    </TabsTrigger>
                    <TabsTrigger value="transactions" className="gap-2 pb-2.5">
                        <ReceiptText className="h-4 w-4" />
                        Riwayat Transaksi
                        <Badge variant="secondary" className="ml-1 px-1.5 py-0 text-[10px] font-mono">
                            {stats.total_transactions}
                        </Badge>
                    </TabsTrigger>
                    <TabsTrigger value="points" className="gap-2 pb-2.5">
                        <Award className="h-4 w-4" />
                        Riwayat Poin FIFO
                        <Badge variant="secondary" className="ml-1 px-1.5 py-0 text-[10px] font-mono">
                            {customer.points} pt
                        </Badge>
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
                    <DetailTabCustomer customer={customer} stats={stats} />
                </TabsContent>

                <TabsContent value="transactions" className="m-0 focus-visible:outline-none">
                    <RiwayatTransaksiCustomer
                        customer={customer}
                        transactions={transactions}
                        isLoading={isLoadingTransactions}
                        onRefresh={loadTransactions}
                    />
                </TabsContent>

                <TabsContent value="points" className="m-0 focus-visible:outline-none">
                    <RiwayatPoinCustomer
                        customer={customer}
                        pointLedgers={pointLedgers}
                        isLoading={isLoadingPointLedgers}
                        onRefresh={loadPointLedgers}
                    />
                </TabsContent>

                <TabsContent value="history" className="m-0 focus-visible:outline-none">
                    <RiwayatPerubahanCustomer
                        customer={customer}
                        activities={activities}
                        isLoading={isLoadingActivities}
                        onRefresh={loadActivities}
                    />
                </TabsContent>
            </Tabs>

            {canEdit && (
                <DialogEditCustomer
                    customer={customer}
                    updateUrl={CustomerController.update.url(customer.id)}
                    open={editOpen}
                    onOpenChange={setEditOpen}
                />
            )}

            {canDelete && (
                <DialogDeleteCustomer
                    customer={customer}
                    destroyUrl={CustomerController.destroy.url(customer.id)}
                    open={deleteOpen}
                    onOpenChange={setDeleteOpen}
                />
            )}
        </div>
    )
}

DetailCustomer.layout = (page: React.ReactNode) => (
    <AuthenticatedLayout>{page}</AuthenticatedLayout>
)

export default DetailCustomer

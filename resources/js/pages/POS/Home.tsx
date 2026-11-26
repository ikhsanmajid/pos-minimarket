import React, { useEffect } from 'react'
import { usePage } from '@inertiajs/react'
import AuthenticatedLayout from '@/layouts/AuthenticatedLayout'
import { toast } from 'react-toastify'
import type { PageProps } from '@/types'
import { useAuth } from '@/hooks/use-auth'
import { AdminDashboard, type AdminDashboardProps } from './Dashboard/component/AdminDashboard'
import { SupervisorDashboard, type SupervisorDashboardProps } from './Dashboard/component/SupervisorDashboard'
import { WarehouseDashboard, type WarehouseDashboardProps } from './Dashboard/component/WarehouseDashboard'
import { CashierDashboard } from './Dashboard/component/CashierDashboard'
import type { CashierDashboardData } from './Dashboard/component/dashboardUtils'

type HomePageProps = PageProps<{
    dashboardRole: 'admin' | 'supervisor' | 'warehouse' | 'cashier' | string
    cashierData?: CashierDashboardData
} & Partial<AdminDashboardProps> & Partial<SupervisorDashboardProps> & Partial<WarehouseDashboardProps>>

const Home = () => {
    const props = usePage<HomePageProps>().props
    const { user, flash } = useAuth()

    useEffect(() => {
        if (flash?.success) toast.success(flash.success)
        if (flash?.error) toast.error(flash.error)
    }, [flash?.success, flash?.error])

    if (props.dashboardRole === 'admin' && props.period && props.kpis && props.alertCounts) {
        return (
            <AdminDashboard
                period={props.period}
                kpis={props.kpis as AdminDashboardProps['kpis']}
                alertCounts={props.alertCounts as AdminDashboardProps['alertCounts']}
                activeShifts={props.activeShifts ?? []}
                salesTrend={props.salesTrend}
                paymentComposition={props.paymentComposition}
                actionableAlerts={props.actionableAlerts}
                topProducts={props.topProducts}
                recentActivities={props.recentActivities}
            />
        )
    }

    if (props.dashboardRole === 'supervisor' && props.kpis && props.alertCounts) {
        return (
            <SupervisorDashboard
                kpis={props.kpis as SupervisorDashboardProps['kpis']}
                alertCounts={props.alertCounts as SupervisorDashboardProps['alertCounts']}
                activeShifts={props.activeShifts ?? []}
                salesTrend7d={props.salesTrend7d}
                actionableAlerts={props.actionableAlerts}
                recentActivities={props.recentActivities}
            />
        )
    }

    if (props.dashboardRole === 'warehouse' && props.kpis) {
        return (
            <WarehouseDashboard
                kpis={props.kpis as WarehouseDashboardProps['kpis']}
                warehouseWidgets={props.warehouseWidgets}
            />
        )
    }

    return (
        <CashierDashboard
            userName={user?.name ?? 'Kasir'}
            cashierData={
                props.cashierData ?? {
                    myShift: null,
                    myTodayTransactionsCount: 0,
                    myRecentShifts: [],
                }
            }
        />
    )
}

Home.layout = (page: React.ReactNode) => <AuthenticatedLayout>{page}</AuthenticatedLayout>

export default Home

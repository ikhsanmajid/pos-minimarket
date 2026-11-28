"use client"

import * as React from "react"
import { NavMain } from "@/components/nav-main"
import { NavUser } from "@/components/nav-user"
import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
} from "@/components/ui/sidebar"
import { Users, House, Package, ShoppingCart, Truck, Wallet, Settings, BarChart3, Contact, Tags, TicketPercent } from "lucide-react"
import ThemeToggle from "./themetoggle"
import { useAuth } from "@/hooks/use-auth"
import { usePage } from "@inertiajs/react"
import users from "@/routes/pos/users"
import products from "@/routes/pos/products"
import categories from "@/routes/pos/categories"
import customers from "@/routes/pos/customers"
import dashboard from "@/routes/pos/dashboard"
import purchaseOrders from "@/routes/pos/purchase-orders"
import suppliers from "@/routes/pos/suppliers"
import financeAccounts from "@/routes/pos/finance/accounts"
import financeCategories from "@/routes/pos/finance/categories"
import financePayables from "@/routes/pos/finance/payables"
import financeTransactions from "@/routes/pos/finance/transactions"
import shifts from "@/routes/pos/shifts"
import cashRegisters from "@/routes/pos/cash-registers"
import cashier from "@/routes/pos/cashier"
import transactions from "@/routes/pos/transactions"
import settings from "@/routes/pos/settings"
import inventoryAdjustments from "@/routes/pos/inventory/adjustments"
import inventoryOpnames from "@/routes/pos/inventory/opnames"
import promotions from "@/routes/pos/promotions"
import vouchers from "@/routes/pos/vouchers"
import reports from "@/routes/pos/reports"

interface NavSubItem {
    title: string
    url: string
    roles?: string[]
}

interface NavItem {
    title: string
    url: string
    icon?: React.ReactNode
    isActive?: boolean
    roles?: string[]
    items?: NavSubItem[]
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
    const { url } = usePage()
    const { user } = useAuth()
    const userRole = (user?.role as string) || ''

    // Daftar menu beserta batasan role masing-masing
    const allNavItems: NavItem[] = [
        {
            title: "Dashboard",
            url: dashboard.index.url(),
            icon: <House />,
            isActive: url === dashboard.index.url(),
            items: [],
            // Terbuka untuk semua role
        },
        {
            title: "Kasir POS",
            url: "#",
            icon: <ShoppingCart />,
            isActive:
                url.startsWith('/pos/cashier') ||
                url.startsWith('/pos/shifts') ||
                url.startsWith('/pos/transactions') ||
                url.startsWith('/pos/cash-registers'),
            roles: ['admin', 'cashier', 'supervisor'],
            items: [
                {
                    title: "Transaksi Kasir",
                    url: cashier.index.url(),
                    roles: ['admin', 'cashier', 'supervisor'],
                },
                {
                    title: "Riwayat Transaksi",
                    url: transactions.index.url(),
                    roles: ['admin', 'cashier', 'supervisor'],
                },
                {
                    title: "Shift Aktif",
                    url: shifts.index.url(),
                    roles: ['admin', 'cashier', 'supervisor'],
                },
                {
                    title: "Riwayat Shift",
                    url: shifts.history.url(),
                    roles: ['admin', 'cashier', 'supervisor'],
                },
                {
                    title: "Kasir Fisik",
                    url: cashRegisters.index.url(),
                    roles: ['admin', 'supervisor'],
                },
            ],
        },
        {
            title: "Pelanggan / Member",
            url: customers.index.url(),
            icon: <Contact />,
            isActive: url.startsWith('/pos/customers'),
            roles: ['admin', 'supervisor', 'cashier'],
            items: [],
        },
        {
            title: "Promo & Diskon",
            url: promotions.index.url(),
            icon: <Tags />,
            isActive: url.startsWith('/pos/promotions'),
            roles: ['admin', 'supervisor'],
            items: [],
        },
        {
            title: "Voucher",
            url: vouchers.index.url(),
            icon: <TicketPercent />,
            isActive: url.startsWith('/pos/vouchers'),
            roles: ['admin', 'supervisor'],
            items: [],
        },
        {
            title: "Produk & Stok",
            url: "#",
            icon: <Package />,
            isActive:
                url.startsWith('/pos/products') ||
                url.startsWith('/pos/categories') ||
                url.startsWith('/pos/inventory'),
            roles: ['admin', 'cashier', 'warehouse', 'supervisor'],
            items: [
                {
                    title: "Daftar Produk",
                    url: products.index.url(),
                    roles: ['admin', 'cashier', 'warehouse', 'supervisor'],
                },
                {
                    title: "Kategori",
                    url: categories.index.url(),
                    roles: ['admin', 'cashier', 'warehouse', 'supervisor'],
                },
                {
                    title: "Stock Adjustment",
                    url: inventoryAdjustments.index.url(),
                    roles: ['admin', 'cashier', 'warehouse', 'supervisor'],
                },
                {
                    title: "Stock Opname",
                    url: inventoryOpnames.index.url(),
                    roles: ['admin', 'cashier', 'warehouse', 'supervisor'],
                },
            ],
        },
        {
            title: "Pengadaan / PO",
            url: "#",
            icon: <Truck />,
            isActive: url.startsWith('/pos/purchase-orders') || url.startsWith('/pos/suppliers'),
            roles: ['admin', 'warehouse', 'supervisor'],
            items: [
                {
                    title: "Purchase Orders",
                    url: purchaseOrders.index.url(),
                    roles: ['admin', 'warehouse', 'supervisor'],
                },
                {
                    title: "Suppliers",
                    url: suppliers.index.url(),
                    roles: ['admin', 'warehouse', 'supervisor'],
                },
            ],
        },
        {
            title: "Keuangan",
            url: "#",
            icon: <Wallet />,
            isActive: url.startsWith('/pos/finance'),
            roles: ['admin'],
            items: [
                {
                    title: "Akun Kas / Bank",
                    url: financeAccounts.index.url(),
                    roles: ['admin'],
                },
                {
                    title: "Kategori Keuangan",
                    url: financeCategories.index.url(),
                    roles: ['admin'],
                },
                {
                    title: "Hutang Dagang",
                    url: financePayables.index.url(),
                    roles: ['admin'],
                },
                {
                    title: "Buku Arus Kas",
                    url: financeTransactions.index.url(),
                    roles: ['admin'],
                },
            ],
        },
        {
            title: "Laporan",
            url: "#",
            icon: <BarChart3 />,
            isActive: url.startsWith('/pos/reports'),
            roles: ['admin', 'supervisor', 'warehouse'],
            items: [
                {
                    title: "Laporan Penjualan",
                    url: reports.sales.url(),
                    roles: ['admin', 'supervisor'],
                },
                {
                    title: "Laba Kotor (HPP)",
                    url: reports.profitLoss.url(),
                    roles: ['admin'],
                },
                {
                    title: "Valuasi & Stok",
                    url: reports.stockValuation.url(),
                    roles: ['admin', 'supervisor', 'warehouse'],
                },
                {
                    title: "Keuangan & Aging",
                    url: reports.financeAging.url(),
                    roles: ['admin'],
                },
            ],
        },
        {
            title: "Manajemen User",
            url: "#",
            icon: <Users />,
            isActive: url.startsWith('/pos/users') || url.startsWith('/pos/activity-logs'),
            roles: ['admin'],
            items: [
                {
                    title: "Karyawan",
                    url: users.index.url(),
                    roles: ['admin'],
                },
                {
                    title: "Log Aktifitas",
                    url: "/pos/activity-logs",
                    roles: ['admin'],
                },
            ],
        },
        {
            title: "Pengaturan Toko",
            url: settings.edit.url(),
            icon: <Settings />,
            isActive: url.startsWith('/pos/settings'),
            roles: ['admin'],
            items: [],
        },
    ]

    // Filter menu berdasarkan role pengguna yang sedang login
    const filteredNavMain = React.useMemo(() => {
        return allNavItems
            .filter((item) => {
                if (item.roles && !item.roles.includes(userRole)) {
                    return false
                }
                return true
            })
            .map((item) => {
                if (!item.items || item.items.length === 0) {
                    return item
                }

                // Filter sub-item berdasarkan role
                const filteredSubItems = item.items.filter((subItem) => {
                    if (subItem.roles && !subItem.roles.includes(userRole)) {
                        return false
                    }
                    return true
                })

                return {
                    ...item,
                    items: filteredSubItems,
                }
            })
            .filter((item) => {
                // Sembunyikan menu induk jika tidak punya sub-item yang bisa diakses dan URL hanya '#'
                if (item.url === '#' && item.items && item.items.length === 0) {
                    return false
                }
                return true
            })
    }, [userRole, url])

    return (
        <Sidebar collapsible="icon" {...props}>
            <SidebarContent>
                <NavMain items={filteredNavMain} currentPath={url} />
            </SidebarContent>
            <SidebarFooter>
                <div className="flex items-center justify-center space-x-2 border-b border-sidebar-border p-3 group-data-[collapsible=icon]:hidden">
                    <ThemeToggle />
                </div>
                {user && <NavUser user={user} />}
            </SidebarFooter>
        </Sidebar>
    )
}

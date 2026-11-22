"use client"

import * as React from "react"
import { NavMain } from "@/components/nav-main"
import { NavUser } from "@/components/nav-user"
import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
} from "@/components/ui/sidebar"
import { Users, House, Package, ShoppingCart, BarChart3 } from "lucide-react"
import ThemeToggle from "./themetoggle"
import { useAuth } from "@/hooks/use-auth"
import { usePage } from "@inertiajs/react"
import users from "@/routes/pos/users"
import products from "@/routes/pos/products"
import categories from "@/routes/pos/categories"
import dashboard from "@/routes/pos/dashboard"

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
            isActive: url.startsWith('/pos/pos') || url.startsWith('/pos/transactions'),
            roles: ['admin', 'cashier', 'supervisor'],
            items: [
                {
                    title: "Transaksi Kasir",
                    url: "#",
                    roles: ['admin', 'cashier'],
                },
                {
                    title: "Riwayat Transaksi",
                    url: "#",
                    roles: ['admin', 'cashier', 'supervisor'],
                },
            ],
        },
        {
            title: "Produk & Stok",
            url: "#",
            icon: <Package />,
            isActive: url.startsWith('/pos/products') || url.startsWith('/pos/categories'),
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
                    title: "Tambah Produk",
                    url: products.create.url(),
                    roles: ['admin', 'warehouse'],
                },
            ],
        },
        {
            title: "Manajemen User",
            url: "#",
            icon: <Users />,
            isActive: url.startsWith('/pos/users') || url.startsWith('/pos/activity-logs'),
            roles: ['admin', 'supervisor'],
            items: [
                {
                    title: "Karyawan",
                    url: users.index.url(),
                    roles: ['admin'],
                },
                {
                    title: "Log Aktifitas",
                    url: "/pos/activity-logs",
                    roles: ['admin', 'supervisor'],
                },
                {
                    title: "Sesi Shift",
                    url: "#",
                    roles: ['admin'],
                },
            ],
        },
        {
            title: "Laporan",
            url: "#",
            icon: <BarChart3 />,
            isActive: url.startsWith('/pos/reports'),
            roles: ['admin', 'supervisor'],
            items: [
                {
                    title: "Laporan Penjualan",
                    url: "#",
                    roles: ['admin', 'supervisor'],
                },
                {
                    title: "Laporan Stok",
                    url: "#",
                    roles: ['admin', 'supervisor', 'warehouse'],
                },
            ],
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

import React from 'react';
import { SidebarProvider, SidebarTrigger, SidebarInset } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/sidebarMenu';
import { Badge } from '@/components/ui/badge';
import { ShiftStatusBadge } from '@/components/ShiftStatusBadge';
import { useAuth } from '@/hooks/use-auth';

export default function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
    const { user } = useAuth()

    return (
        <SidebarProvider className="flex flex-col min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 transition-colors">
            <header className="sticky top-0 z-40 flex h-16 w-full shrink-0 items-center justify-between border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-800 px-4 sm:px-6 shadow-sm">
                <div className="flex items-center gap-3">
                    <SidebarTrigger className="-ml-1 cursor-pointer" />

                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-blue-600 text-white font-bold rounded-lg flex items-center justify-center text-sm shadow-sm">
                            P
                        </div>
                        <span className="font-bold text-gray-800 dark:text-gray-100 text-base tracking-wide">
                            POS Minimarket
                        </span>
                    </div>
                </div>

                <div className="flex items-center gap-3 sm:gap-4">
                    <ShiftStatusBadge />

                    <div className="text-right">
                        <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">{user?.name}</p>
                        <Badge className="bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                            {user?.role_name}
                        </Badge>
                    </div>
                </div>
            </header>

            <div className="flex flex-1 w-full relative min-w-0 overflow-x-hidden">
                <AppSidebar className="top-16 h-[calc(100svh-4rem)]" />

                <SidebarInset className="flex-1 min-w-0 min-h-[calc(100svh-4rem)] bg-transparent">
                    <div className="flex-1 min-w-0 p-4 sm:p-6 lg:p-8">
                        {children}
                    </div>
                </SidebarInset>
            </div>
        </SidebarProvider>
    );
}

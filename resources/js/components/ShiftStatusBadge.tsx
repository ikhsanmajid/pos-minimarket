import React from 'react'
import { Link } from '@inertiajs/react'
import { CircleDot, CircleOff, Clock } from 'lucide-react'
import { useAuth } from '@/hooks/use-auth'
import shifts from '@/routes/pos/shifts'

export function ShiftStatusBadge() {
    const { user, activeShift } = useAuth()
    const role = (user?.role as string) || ''

    if (!['admin', 'supervisor', 'cashier'].includes(role)) {
        return null
    }

    if (activeShift) {
        return (
            <Link
                href={shifts.index.url()}
                className="no-print inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700 transition-colors hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 dark:hover:bg-emerald-900/60"
                title={`Shift Aktif: ${activeShift.shift_number} (${activeShift.register_name}) dibuka ${activeShift.opened_at}`}
            >
                <CircleDot className="h-3.5 w-3.5 animate-pulse text-emerald-600 dark:text-emerald-400" />
                <span className="hidden sm:inline font-semibold">{activeShift.register_name}</span>
                <span className="hidden md:inline font-mono text-[11px] opacity-80">
                    {activeShift.shift_number}
                </span>
                <span className="sm:hidden font-semibold">Shift Aktif</span>
            </Link>
        )
    }

    return (
        <Link
            href={shifts.index.url()}
            className="no-print inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-700 transition-colors hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-950/60 dark:text-amber-300 dark:hover:bg-amber-900/60"
            title="Belum ada sesi shift aktif. Klik untuk membuka shift."
        >
            <CircleOff className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
            <span className="hidden sm:inline">Shift Belum Dibuka</span>
            <span className="sm:hidden flex items-center gap-1">
                <Clock className="h-3 w-3" /> Buka Shift
            </span>
        </Link>
    )
}

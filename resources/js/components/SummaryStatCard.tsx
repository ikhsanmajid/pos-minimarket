import React from 'react'
import { Link } from '@inertiajs/react'
import type { LucideIcon } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

export type SummaryStatVariant = 'blue' | 'emerald' | 'amber' | 'rose' | 'violet' | 'slate'

const VARIANT_CLASSES: Record<SummaryStatVariant, string> = {
    blue: 'bg-blue-600 dark:bg-blue-700',
    emerald: 'bg-emerald-500 dark:bg-emerald-600',
    amber: 'bg-amber-500 dark:bg-amber-600',
    rose: 'bg-rose-500 dark:bg-rose-600',
    violet: 'bg-violet-600 dark:bg-violet-700',
    slate: 'bg-slate-600 dark:bg-slate-700',
}

const ACTIVE_RING_CLASSES: Record<SummaryStatVariant, string> = {
    blue: 'ring-2 ring-blue-300 ring-offset-2 ring-offset-background dark:ring-blue-400',
    emerald: 'ring-2 ring-emerald-300 ring-offset-2 ring-offset-background dark:ring-emerald-400',
    amber: 'ring-2 ring-amber-300 ring-offset-2 ring-offset-background dark:ring-amber-400',
    rose: 'ring-2 ring-rose-300 ring-offset-2 ring-offset-background dark:ring-rose-400',
    violet: 'ring-2 ring-violet-300 ring-offset-2 ring-offset-background dark:ring-violet-400',
    slate: 'ring-2 ring-slate-300 ring-offset-2 ring-offset-background dark:ring-slate-400',
}

export interface SummaryStatGridProps {
    children: React.ReactNode
    className?: string
}

export function SummaryStatGrid({ children, className }: SummaryStatGridProps) {
    return (
        <div className={cn('grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4', className)}>
            {children}
        </div>
    )
}

export interface SummaryStatCardProps {
    title: string
    value: string | number
    icon: LucideIcon
    variant: SummaryStatVariant
    subInfo?: string
    periodLabel?: string
    href?: string
    onClick?: () => void
    isActive?: boolean
    isLoading?: boolean
    className?: string
}

export function SummaryStatCard({
    title,
    value,
    icon: Icon,
    variant,
    subInfo,
    periodLabel,
    href,
    onClick,
    isActive = false,
    isLoading = false,
    className,
}: SummaryStatCardProps) {
    if (isLoading) {
        return (
            <Card className={cn('rounded-xl border-0 ring-0 py-0 shadow-sm bg-muted/60', className)}>
                <CardContent className="px-4 py-3.5 gap-0">
                    <div className="flex items-start justify-between gap-2.5">
                        <div className="min-w-0 flex-1 space-y-1.5">
                            <Skeleton className="h-6 w-24" />
                            <Skeleton className="h-3.5 w-32" />
                        </div>
                        <Skeleton className="h-9 w-9 shrink-0 rounded-full" />
                    </div>
                    <div className="mt-3 flex items-center justify-between gap-2 border-t border-border/50 pt-2">
                        <Skeleton className="h-3 w-24" />
                        <Skeleton className="h-3 w-14" />
                    </div>
                </CardContent>
            </Card>
        )
    }

    const displayValue = String(value)
    const isLongValue = displayValue.length >= 13
    const isInteractive = Boolean(href || onClick)

    const cardNode = (
        <Card
            className={cn(
                'rounded-xl border-0 ring-0 py-0 text-white shadow-sm transition-all hover:shadow-md hover:-translate-y-0.5',
                VARIANT_CLASSES[variant],
                isInteractive && 'cursor-pointer',
                isActive && ACTIVE_RING_CLASSES[variant],
                className
            )}
        >
            <CardContent className="px-4 py-3.5 gap-0">
                <div className="flex items-start justify-between gap-2.5">
                    <div className="min-w-0 flex-1">
                        <p
                            title={displayValue}
                            className={cn(
                                'font-bold tracking-tight tabular-nums text-white truncate',
                                isLongValue ? 'text-lg sm:text-xl leading-tight' : 'text-xl sm:text-2xl leading-tight'
                            )}
                        >
                            {displayValue}
                        </p>
                        <p className="mt-0.5 text-xs font-medium text-white/90 truncate" title={title}>
                            {title}
                        </p>
                    </div>
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/20 text-white">
                        <Icon className="h-4 w-4" />
                    </div>
                </div>

                {(subInfo !== undefined || periodLabel !== undefined) && (
                    <div className="mt-3 flex items-center justify-between gap-2 border-t border-white/15 pt-2">
                        <span className="text-[11px] font-medium text-white/90 truncate" title={subInfo}>
                            {subInfo ?? ''}
                        </span>
                        {periodLabel && (
                            <span className="text-[11px] text-white/80 shrink-0" title={periodLabel}>
                                {periodLabel}
                            </span>
                        )}
                    </div>
                )}
            </CardContent>
        </Card>
    )

    if (href) {
        return (
            <Link
                href={href}
                className="block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
                {cardNode}
            </Link>
        )
    }

    if (onClick) {
        return (
            <button
                type="button"
                onClick={onClick}
                aria-pressed={isActive}
                className="block w-full text-left rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
                {cardNode}
            </button>
        )
    }

    return cardNode
}

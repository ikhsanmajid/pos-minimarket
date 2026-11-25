import React, { useState } from 'react'
import { ExternalLink, ImageIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getImageUrl } from './activityLogDetailUtils'

interface ActivityLogImagePreviewProps {
    val: unknown
    label: string
    isNew?: boolean
}

export default function ActivityLogImagePreview({
    val,
    label,
    isNew = false,
}: ActivityLogImagePreviewProps) {
    const [hasError, setHasError] = useState(false)
    const url = getImageUrl(val)

    if (!val || !url) {
        return (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground italic py-1">
                <ImageIcon className="h-4 w-4 text-muted-foreground/60" />
                <span>Tidak ada foto</span>
            </div>
        )
    }

    const filename = String(val).split('/').pop() || 'foto.jpg'

    return (
        <div className="flex items-start gap-2.5 py-1">
            <a
                href={url}
                target="_blank"
                rel="noreferrer"
                title="Buka ukuran penuh di tab baru"
                className={cn(
                    'group relative block h-14 w-14 shrink-0 overflow-hidden rounded-md border bg-muted/30 shadow-xs hover:ring-2 transition-all',
                    isNew
                        ? 'border-primary/50 hover:ring-primary'
                        : 'border-border hover:ring-muted-foreground/40'
                )}
            >
                {!hasError ? (
                    <img
                        src={url}
                        alt={label}
                        className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-105"
                        onError={() => setHasError(true)}
                    />
                ) : (
                    <div className="flex h-full w-full flex-col items-center justify-center bg-muted/60 p-1 text-center text-[9px] text-muted-foreground">
                        <ImageIcon className="h-3.5 w-3.5 mb-0.5 opacity-40" />
                        <span className="leading-tight">Tidak tersedia</span>
                    </div>
                )}
                {!hasError && (
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-white">
                        <ExternalLink className="h-3.5 w-3.5 drop-shadow" />
                    </div>
                )}
            </a>
            <div className="flex flex-col text-xs min-w-0">
                <span
                    className="font-mono text-xs font-medium text-foreground truncate max-w-[170px]"
                    title={filename}
                >
                    {filename}
                </span>
                <span className="text-[10px] text-muted-foreground mt-0.5">{label}</span>
                {!hasError && (
                    <a
                        href={url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline font-medium mt-1"
                    >
                        <ExternalLink className="h-3 w-3" />
                        Buka Foto
                    </a>
                )}
            </div>
        </div>
    )
}

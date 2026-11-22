import * as React from 'react'
import { router } from '@inertiajs/react'
import { Button } from '@/components/ui/button'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import {
    ChevronLeft,
    ChevronRight,
    ChevronsLeft,
    ChevronsRight,
} from 'lucide-react'
import { type RouteDefinition, type RouteQueryOptions } from '@/wayfinder'

export interface PaginationMeta {
    current_page: number
    last_page: number
    per_page: number
    total: number
    from: number | null
    to: number | null
}

interface DataTablePaginationProps {
    meta: PaginationMeta
    routeUrl: (options?: RouteQueryOptions) => RouteDefinition<'get'>
    pageSizeOptions?: number[]
    isLoading?: boolean
}

const DEFAULT_PAGE_SIZE_OPTIONS = [10, 25, 50, 100]

export default function DataTablePagination({
    meta,
    routeUrl,
    pageSizeOptions = DEFAULT_PAGE_SIZE_OPTIONS,
    isLoading = false,
}: DataTablePaginationProps) {
    const { current_page, last_page, per_page, total, from, to } = meta

    // Navigasi menggunakan mergeQuery agar filter (search, status) tidak hilang
    const navigateTo = (params: Record<string, string | number | undefined>) => {
        router.visit(
            routeUrl({
                mergeQuery: params,
            }),
            {
                preserveState: true,
                preserveScroll: true,
                replace: true,
            }
        )
    }

    const handlePageSizeChange = (value: string | null) => {
        // Abaikan jika nilai kosong
        if (value === null) return

        // Reset ke page 1 saat jumlah baris per halaman diubah
        navigateTo({ per_page: Number(value), page: 1 })
    }

    // Logika sliding window maksimal 5 angka dengan halaman aktif di tengah
    const getPageNumbers = (): number[] => {
        const maxVisible = 5

        if (last_page <= maxVisible) {
            return Array.from({ length: last_page }, (_, i) => i + 1)
        }

        const half = Math.floor(maxVisible / 2) // 2
        let start = current_page - half
        let end = current_page + half

        if (start < 1) {
            start = 1
            end = maxVisible
        } else if (end > last_page) {
            end = last_page
            start = last_page - maxVisible + 1
        }

        const pages: number[] = []
        for (let i = start; i <= end; i++) {
            pages.push(i)
        }
        return pages
    }

    const pageNumbers = getPageNumbers()
    const showFirstLast = last_page > 5

    // Pastikan per_page saat ini selalu ada di daftar opsi (misal per_page=15 dari backend)
    const sizeOptions = pageSizeOptions.includes(per_page)
        ? pageSizeOptions
        : [...pageSizeOptions, per_page].sort((a, b) => a - b)

    return (
        <div className="flex flex-col items-center justify-between gap-4 px-2 py-4 sm:flex-row">
            <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                <div>
                    Menampilkan <span className="font-medium text-foreground">{from ?? 0}</span> -{' '}
                    <span className="font-medium text-foreground">{to ?? 0}</span> dari{' '}
                    <span className="font-medium text-foreground">{total}</span> data
                </div>

                <div className="flex items-center gap-2">
                    <span>Rows per page</span>
                    <Select
                        value={String(per_page)}
                        onValueChange={handlePageSizeChange}
                        disabled={isLoading}
                    >
                        <SelectTrigger className="h-8 w-[75px]">
                            <SelectValue placeholder={String(per_page)} />
                        </SelectTrigger>
                        <SelectContent side="top">
                            {sizeOptions.map((size) => (
                                <SelectItem key={size} value={String(size)}>
                                    {size}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </div>

            {last_page > 1 && (
                <>
                    {/* Mobile pagination */}
                    <div className="flex w-full items-center justify-between gap-2 sm:hidden">
                        <Button
                            variant="outline"
                            size="sm"
                            className="h-8 px-2.5"
                            onClick={() => navigateTo({ page: current_page - 1 })}
                            disabled={isLoading || current_page === 1}
                        >
                            <ChevronLeft className="mr-1 h-4 w-4" />
                            Prev
                        </Button>
                        <span className="text-xs text-muted-foreground">
                            Halaman <span className="font-medium text-foreground">{current_page}</span> dari{' '}
                            <span className="font-medium text-foreground">{last_page}</span>
                        </span>
                        <Button
                            variant="outline"
                            size="sm"
                            className="h-8 px-2.5"
                            onClick={() => navigateTo({ page: current_page + 1 })}
                            disabled={isLoading || current_page === last_page}
                        >
                            Next
                            <ChevronRight className="ml-1 h-4 w-4" />
                        </Button>
                    </div>

                    {/* Desktop pagination */}
                    <div className="hidden sm:flex items-center space-x-1">
                        {showFirstLast && (
                            <Button
                                variant="outline"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => navigateTo({ page: 1 })}
                                disabled={isLoading || current_page === 1}
                                title="Halaman Pertama"
                            >
                                <ChevronsLeft className="h-4 w-4" />
                            </Button>
                        )}

                        <Button
                            variant="outline"
                            size="sm"
                            className="h-8 px-2.5"
                            onClick={() => navigateTo({ page: current_page - 1 })}
                            disabled={isLoading || current_page === 1}
                        >
                            <ChevronLeft className="mr-1 h-4 w-4" />
                            Previous
                        </Button>

                        <div className="flex items-center space-x-1">
                            {pageNumbers.map((page) => (
                                <Button
                                    key={page}
                                    variant={page === current_page ? 'default' : 'outline'}
                                    size="icon"
                                    className="h-8 w-8"
                                    onClick={() => navigateTo({ page })}
                                    disabled={isLoading}
                                    aria-current={page === current_page ? 'page' : undefined}
                                >
                                    {page}
                                </Button>
                            ))}
                        </div>

                        <Button
                            variant="outline"
                            size="sm"
                            className="h-8 px-2.5"
                            onClick={() => navigateTo({ page: current_page + 1 })}
                            disabled={isLoading || current_page === last_page}
                        >
                            Next
                            <ChevronRight className="ml-1 h-4 w-4" />
                        </Button>

                        {showFirstLast && (
                            <Button
                                variant="outline"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => navigateTo({ page: last_page })}
                                disabled={isLoading || current_page === last_page}
                                title="Halaman Terakhir"
                            >
                                <ChevronsRight className="h-4 w-4" />
                            </Button>
                        )}
                    </div>
                </>
            )}
        </div>
    )
}
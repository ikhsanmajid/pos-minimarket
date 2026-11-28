import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Head, Link, router, usePage } from '@inertiajs/react'
import AuthenticatedLayout from '@/layouts/AuthenticatedLayout'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { cn, formatNumber, formatRupiah } from '@/lib/utils'
import {
    ArrowLeft,
    Barcode,
    CheckCircle2,
    EyeOff,
    FileDown,
    Loader2,
    Save,
    Search,
    XCircle,
} from 'lucide-react'
import type { PageProps } from '@/types'
import StockOpnameController from '@/actions/App/Http/Controllers/StockOpnameController'
import { DialogFinalizeStockOpname } from './component/DialogFinalizeStockOpname'

export interface OpnameSessionItem {
    id: number
    product_id: number
    product_name: string
    barcode: string
    base_unit: string
    category_name: string
    physical_stock: number | null
    notes: string | null
    counted_by_name: string | null
    counted_at: string | null
    system_stock?: number
    variance_qty?: number
    unit_cost_snapshot?: number
    variance_value?: number
}

interface OpnameHeader {
    id: number
    opname_number: string
    status: 'draft' | 'in_progress' | 'completed' | 'cancelled' | string
    status_label: string
    is_editable: boolean
    is_locked: boolean
    category_id: number | null
    category_name: string
    is_blind_count: boolean
    hide_system_stock: boolean
    notes: string | null
    creator_name: string
    approver_name: string | null
    started_at: string | null
    completed_at: string | null
    cancelled_at: string | null
    total_items: number
    total_items_counted: number
    total_variance_items?: number
    total_variance_value?: number
}

type FilterTab = 'all' | 'uncounted' | 'counted' | 'variance'

type StockOpnameSessionPageProps = PageProps<{
    opname: OpnameHeader
    items: OpnameSessionItem[]
    canFinalize: boolean
    canCancel: boolean
    canReviewSystem: boolean
}>

export default function StockOpnameSession() {
    const { opname, items: serverItems, canFinalize, canCancel } =
        usePage<StockOpnameSessionPageProps>().props

    const [localItems, setLocalItems] = useState<OpnameSessionItem[]>(serverItems)
    const [dirtyIds, setDirtyIds] = useState<Set<number>>(new Set())
    const [activeTab, setActiveTab] = useState<FilterTab>('all')
    const [searchText, setSearchText] = useState('')
    const [barcodeInput, setBarcodeInput] = useState('')
    const [isScanning, setIsScanning] = useState(false)
    const [scanFeedback, setScanFeedback] = useState<{
        type: 'success' | 'error'
        message: string
    } | null>(null)
    const [highlightedId, setHighlightedId] = useState<number | null>(null)

    const [isSaving, setIsSaving] = useState(false)
    const [finalizeOpen, setFinalizeOpen] = useState(false)
    const [isFinalizing, setIsFinalizing] = useState(false)
    const [cancelOpen, setCancelOpen] = useState(false)
    const [cancelReason, setCancelReason] = useState('')
    const [isCancelling, setIsCancelling] = useState(false)

    const barcodeRef = useRef<HTMLInputElement>(null)
    const qtyInputRefs = useRef<Map<number, HTMLInputElement>>(new Map())

    useEffect(() => {
        setLocalItems(serverItems)
        setDirtyIds(new Set())
    }, [serverItems])

    useEffect(() => {
        if (opname.is_editable) {
            barcodeRef.current?.focus()
        }
    }, [opname.is_editable])

    const hideSystem = opname.hide_system_stock
    const hasUnsavedChanges = dirtyIds.size > 0

    const countedCount = useMemo(
        () => localItems.filter((i) => i.physical_stock !== null).length,
        [localItems]
    )
    const uncountedCount = localItems.length - countedCount
    const varianceCount = useMemo(() => {
        if (hideSystem) return 0
        return localItems.filter(
            (i) => i.physical_stock !== null && i.physical_stock !== (i.system_stock ?? 0)
        ).length
    }, [localItems, hideSystem])

    const progressPct =
        localItems.length > 0 ? Math.min(100, Math.round((countedCount / localItems.length) * 100)) : 0

    const filteredItems = useMemo(() => {
        const term = searchText.trim().toLowerCase()
        return localItems.filter((item) => {
            if (activeTab === 'uncounted' && item.physical_stock !== null) return false
            if (activeTab === 'counted' && item.physical_stock === null) return false
            if (
                activeTab === 'variance' &&
                (item.physical_stock === null || item.physical_stock === (item.system_stock ?? 0))
            ) {
                return false
            }

            if (term !== '') {
                const matchName = item.product_name.toLowerCase().includes(term)
                const matchBarcode = item.barcode.toLowerCase().includes(term)
                const matchCategory = item.category_name.toLowerCase().includes(term)
                if (!matchName && !matchBarcode && !matchCategory) return false
            }
            return true
        })
    }, [localItems, activeTab, searchText])

    const updateItemField = (
        itemId: number,
        field: 'physical_stock' | 'notes',
        value: number | null | string
    ) => {
        setLocalItems((prev) =>
            prev.map((item) => {
                if (item.id !== itemId) return item
                const updated = { ...item, [field]: value }
                if (field === 'physical_stock' && !hideSystem && updated.system_stock !== undefined) {
                    const phy = updated.physical_stock
                    updated.variance_qty = phy === null ? 0 : phy - updated.system_stock
                    updated.variance_value =
                        phy === null
                            ? 0
                            : updated.variance_qty * (updated.unit_cost_snapshot ?? 0)
                }
                return updated
            })
        )
        setDirtyIds((prev) => {
            const next = new Set(prev)
            next.add(itemId)
            return next
        })
    }

    const handleBarcodeScan = async (e: React.FormEvent) => {
        e.preventDefault()
        const code = barcodeInput.trim()
        if (!code || !opname.is_editable || isScanning) return

        setIsScanning(true)
        setScanFeedback(null)

        try {
            const url = StockOpnameController.lookupBarcode.url(opname.id, {
                query: { barcode: code },
            })
            const res = await fetch(url, {
                headers: {
                    Accept: 'application/json',
                    'X-Requested-With': 'XMLHttpRequest',
                },
                credentials: 'same-origin',
            })

            const json = (await res.json()) as {
                found: boolean
                message?: string
                item?: {
                    item_id: number
                    product_name: string
                    base_unit: string
                    matched_unit_name: string
                    conversion_factor: number
                }
            }

            if (!res.ok || !json.found || !json.item) {
                setScanFeedback({
                    type: 'error',
                    message: json.message ?? `Barcode "${code}" tidak ditemukan dalam sesi ini.`,
                })
                setBarcodeInput('')
                barcodeRef.current?.focus()
                return
            }

            const matched = json.item
            const increment = Math.max(1, matched.conversion_factor || 1)

            setLocalItems((prev) =>
                prev.map((row) => {
                    if (row.id !== matched.item_id) return row
                    const nextPhysical = (row.physical_stock ?? 0) + increment
                    const updated: OpnameSessionItem = { ...row, physical_stock: nextPhysical }
                    if (!hideSystem && updated.system_stock !== undefined) {
                        updated.variance_qty = nextPhysical - updated.system_stock
                        updated.variance_value =
                            updated.variance_qty * (updated.unit_cost_snapshot ?? 0)
                    }
                    return updated
                })
            )

            setDirtyIds((prev) => {
                const next = new Set(prev)
                next.add(matched.item_id)
                return next
            })

            setHighlightedId(matched.item_id)
            setActiveTab('all')
            setSearchText('')
            setScanFeedback({
                type: 'success',
                message:
                    increment > 1
                        ? `${matched.product_name}: +${increment} ${matched.base_unit} (1 ${matched.matched_unit_name})`
                        : `${matched.product_name}: +1 ${matched.base_unit}`,
            })

            setTimeout(() => {
                const inputEl = qtyInputRefs.current.get(matched.item_id)
                inputEl?.scrollIntoView({ behavior: 'smooth', block: 'center' })
            }, 80)
        } catch {
            setScanFeedback({
                type: 'error',
                message: 'Gagal memeriksa barcode. Periksa koneksi jaringan.',
            })
        } finally {
            setIsScanning(false)
            setBarcodeInput('')
            barcodeRef.current?.focus()
        }
    }

    const handleSaveDraft = () => {
        if (!hasUnsavedChanges || isSaving) return

        const payloadItems = localItems
            .filter((item) => dirtyIds.has(item.id))
            .map((item) => ({
                id: item.id,
                physical_stock: item.physical_stock,
                notes: item.notes,
            }))

        if (payloadItems.length === 0) return

        setIsSaving(true)
        router.patch(
            StockOpnameController.updateCounts.url(opname.id),
            { items: payloadItems },
            {
                preserveScroll: true,
                onFinish: () => setIsSaving(false),
                onSuccess: () => setDirtyIds(new Set()),
            }
        )
    }

    const handleConfirmFinalize = () => {
        setIsFinalizing(true)
        router.post(
            StockOpnameController.finalize.url(opname.id),
            {},
            {
                preserveScroll: true,
                onFinish: () => setIsFinalizing(false),
                onSuccess: () => setFinalizeOpen(false),
            }
        )
    }

    const handleConfirmCancel = () => {
        setIsCancelling(true)
        router.post(
            StockOpnameController.cancel.url(opname.id),
            { reason: cancelReason.trim() || undefined },
            {
                preserveScroll: true,
                onFinish: () => setIsCancelling(false),
                onSuccess: () => {
                    setCancelOpen(false)
                    setCancelReason('')
                },
            }
        )
    }

    const handleQtyKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, currentIndex: number) => {
        if (e.key === 'Enter') {
            e.preventDefault()
            const nextItem = filteredItems[currentIndex + 1]
            if (nextItem) {
                qtyInputRefs.current.get(nextItem.id)?.focus()
                qtyInputRefs.current.get(nextItem.id)?.select()
            }
        }
    }

    const statusBadgeClass =
        opname.status === 'completed'
            ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
            : opname.status === 'cancelled'
              ? 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-800 dark:bg-rose-950/60 dark:text-rose-300'
              : 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/60 dark:text-amber-300'

    return (
        <AuthenticatedLayout>
            <Head title={`Stock Opname ${opname.opname_number}`} />
            <div className="space-y-4">
                {/* Header & Action Bar */}
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                            <Link href={StockOpnameController.index.url()}>
                                <Button type="button" variant="outline" size="sm" className="h-8 gap-1 px-2.5">
                                    <ArrowLeft className="h-3.5 w-3.5" />
                                    Kembali
                                </Button>
                            </Link>
                            <h1 className="font-mono text-xl font-bold tracking-tight text-foreground sm:text-2xl">
                                {opname.opname_number}
                            </h1>
                            <Badge variant="outline" className={statusBadgeClass}>
                                {opname.status_label}
                            </Badge>
                            {opname.is_blind_count && (
                                <Badge variant="secondary" className="gap-1 text-xs">
                                    <EyeOff className="h-3 w-3" />
                                    Blind Count
                                </Badge>
                            )}
                        </div>
                        <p className="text-xs text-muted-foreground">
                            Cakupan: <strong className="text-foreground">{opname.category_name}</strong>
                            {' · '}Dibuat oleh <strong className="text-foreground">{opname.creator_name}</strong>
                            {opname.approver_name && (
                                <>
                                    {' · '}Disetujui oleh{' '}
                                    <strong className="text-foreground">{opname.approver_name}</strong>
                                </>
                            )}
                        </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        {opname.is_editable && (
                            <Button
                                type="button"
                                variant="outline"
                                onClick={handleSaveDraft}
                                disabled={!hasUnsavedChanges || isSaving}
                                className="gap-1.5"
                            >
                                {isSaving ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                    <Save className="h-4 w-4" />
                                )}
                                Simpan Draf
                                {hasUnsavedChanges && (
                                    <span className="rounded-full bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-bold text-amber-700 dark:text-amber-300">
                                        {dirtyIds.size}
                                    </span>
                                )}
                            </Button>
                        )}

                        {canFinalize && opname.is_editable && (
                            <Button
                                type="button"
                                onClick={() => setFinalizeOpen(true)}
                                className="gap-1.5 bg-emerald-600 text-white hover:bg-emerald-700"
                            >
                                <CheckCircle2 className="h-4 w-4" />
                                Review & Finalisasi
                            </Button>
                        )}

                        {canCancel && opname.is_editable && (
                            <Button
                                type="button"
                                variant="destructive"
                                onClick={() => setCancelOpen(true)}
                                className="gap-1.5"
                            >
                                <XCircle className="h-4 w-4" />
                                Batalkan Sesi
                            </Button>
                        )}

                        {opname.status === 'completed' && (
                            <a
                                href={StockOpnameController.downloadPdf.url(opname.id)}
                                target="_blank"
                                rel="noreferrer"
                            >
                                <Button type="button" variant="outline" className="gap-1.5">
                                    <FileDown className="h-4 w-4" />
                                    Cetak / Unduh PDF
                                </Button>
                            </a>
                        )}
                    </div>
                </div>

                {/* Progress & Ringkasan */}
                <div className="rounded-lg border bg-card p-4 shadow-xs">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="space-y-0.5">
                            <p className="text-xs font-medium text-muted-foreground">
                                Progress Penghitungan Fisik
                            </p>
                            <p className="font-mono text-lg font-bold text-foreground">
                                {formatNumber(countedCount)} / {formatNumber(localItems.length)} produk ({progressPct}%)
                            </p>
                        </div>

                        {!hideSystem && (
                            <div className="flex flex-wrap items-center gap-4 text-right">
                                <div>
                                    <p className="text-[11px] text-muted-foreground">Item Berselisih</p>
                                    <p className="font-mono text-sm font-bold text-foreground">
                                        {formatNumber(varianceCount)} produk
                                    </p>
                                </div>
                                <div>
                                    <p className="text-[11px] text-muted-foreground">Total Selisih (Rp)</p>
                                    <p
                                        className={cn(
                                            'font-mono text-sm font-bold',
                                            (opname.total_variance_value ?? 0) < 0
                                                ? 'text-rose-600 dark:text-rose-400'
                                                : (opname.total_variance_value ?? 0) > 0
                                                  ? 'text-emerald-600 dark:text-emerald-400'
                                                  : 'text-foreground'
                                        )}
                                    >
                                        {(opname.total_variance_value ?? 0) > 0 ? '+' : ''}
                                        {formatRupiah(opname.total_variance_value ?? 0)}
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>
                    <div className="mt-2.5 h-2 w-full overflow-hidden rounded-full bg-muted">
                        <div
                            className={cn(
                                'h-full rounded-full transition-all',
                                progressPct === 100 ? 'bg-emerald-500' : 'bg-primary'
                            )}
                            style={{ width: `${progressPct}%` }}
                        />
                    </div>
                </div>

                {/* Toolbar Cepat: Scan Barcode + Filter Tab + Pencarian */}
                <div className="space-y-3 rounded-lg border bg-card p-3.5 shadow-xs sm:p-4">
                    <div className="flex flex-wrap items-center gap-2.5">
                        {opname.is_editable && (
                            <form onSubmit={handleBarcodeScan} className="relative flex w-full gap-2 sm:w-80">
                                <div className="relative flex-1">
                                    <Barcode className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-primary" />
                                    <Input
                                        ref={barcodeRef}
                                        value={barcodeInput}
                                        onChange={(e) => setBarcodeInput(e.target.value)}
                                        placeholder="Scan barcode produk / dus lalu Enter…"
                                        className="h-9 pl-9 font-mono text-sm"
                                        disabled={isScanning}
                                    />
                                </div>
                                <Button type="submit" size="sm" className="h-9" disabled={isScanning || !barcodeInput.trim()}>
                                    {isScanning ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Scan'}
                                </Button>
                            </form>
                        )}

                        {/* Filter Pencarian Lokal */}
                        <div className="relative w-full sm:w-64">
                            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                            <Input
                                value={searchText}
                                onChange={(e) => setSearchText(e.target.value)}
                                placeholder="Filter nama / barcode…"
                                className="h-9 pl-9 text-sm"
                            />
                        </div>

                        {/* Filter Chips */}
                        <div className="flex flex-wrap items-center gap-1.5">
                            <Button
                                type="button"
                                size="sm"
                                variant={activeTab === 'all' ? 'default' : 'outline'}
                                onClick={() => setActiveTab('all')}
                                className="h-9 text-xs"
                            >
                                Semua ({localItems.length})
                            </Button>
                            <Button
                                type="button"
                                size="sm"
                                variant={activeTab === 'uncounted' ? 'default' : 'outline'}
                                onClick={() => setActiveTab('uncounted')}
                                className="h-9 text-xs"
                            >
                                Belum Dihitung ({uncountedCount})
                            </Button>
                            <Button
                                type="button"
                                size="sm"
                                variant={activeTab === 'counted' ? 'default' : 'outline'}
                                onClick={() => setActiveTab('counted')}
                                className="h-9 text-xs"
                            >
                                Sudah Dihitung ({countedCount})
                            </Button>
                            {!hideSystem && (
                                <Button
                                    type="button"
                                    size="sm"
                                    variant={activeTab === 'variance' ? 'default' : 'outline'}
                                    onClick={() => setActiveTab('variance')}
                                    className="h-9 text-xs"
                                >
                                    Ada Selisih ({varianceCount})
                                </Button>
                            )}
                        </div>
                    </div>

                    {scanFeedback && (
                        <div
                            className={cn(
                                'rounded-md border px-3 py-2 text-xs font-medium',
                                scanFeedback.type === 'success'
                                    ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300'
                                    : 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-800 dark:bg-rose-950/50 dark:text-rose-300'
                            )}
                        >
                            {scanFeedback.message}
                        </div>
                    )}
                </div>

                {/* Tabel Penghitungan */}
                <div className="overflow-x-auto rounded-lg border bg-card">
                    <table
                        className={cn(
                            'w-full table-fixed text-sm',
                            hideSystem ? 'min-w-[700px]' : 'min-w-[960px]'
                        )}
                    >
                        <thead className="border-b bg-muted/50 text-xs text-muted-foreground">
                            <tr>
                                <th className="w-[6%] px-3 py-2.5 text-left font-medium">No</th>
                                <th
                                    className={cn(
                                        'px-3 py-2.5 text-left font-medium',
                                        hideSystem ? 'w-[38%]' : 'w-[28%]'
                                    )}
                                >
                                    Produk & Barcode
                                </th>
                                {!hideSystem && (
                                    <th className="w-[11%] px-3 py-2.5 text-right font-medium">
                                        Stok Sistem
                                    </th>
                                )}
                                <th
                                    className={cn(
                                        'px-3 py-2.5 text-right font-medium',
                                        hideSystem ? 'w-[22%]' : 'w-[14%]'
                                    )}
                                >
                                    Stok Fisik
                                </th>
                                {!hideSystem && (
                                    <>
                                        <th className="w-[10%] px-3 py-2.5 text-right font-medium">
                                            Selisih Qty
                                        </th>
                                        <th className="w-[14%] px-3 py-2.5 text-right font-medium">
                                            Selisih (Rp)
                                        </th>
                                    </>
                                )}
                                <th
                                    className={cn(
                                        'px-3 py-2.5 text-left font-medium',
                                        hideSystem ? 'w-[34%]' : 'w-[17%]'
                                    )}
                                >
                                    Catatan
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            {filteredItems.length === 0 ? (
                                <tr>
                                    <td
                                        colSpan={hideSystem ? 4 : 7}
                                        className="h-24 text-center text-muted-foreground"
                                    >
                                        Tidak ada produk yang cocok dengan filter ini.
                                    </td>
                                </tr>
                            ) : (
                                filteredItems.map((item, index) => {
                                    const isDirty = dirtyIds.has(item.id)
                                    const isHighlighted = highlightedId === item.id
                                    const diff =
                                        !hideSystem && item.physical_stock !== null
                                            ? item.physical_stock - (item.system_stock ?? 0)
                                            : 0
                                    const diffVal =
                                        !hideSystem && item.physical_stock !== null
                                            ? diff * (item.unit_cost_snapshot ?? 0)
                                            : 0

                                    return (
                                        <tr
                                            key={item.id}
                                            className={cn(
                                                'transition-colors',
                                                isHighlighted && 'bg-primary/10',
                                                !isHighlighted && isDirty && 'bg-amber-50/50 dark:bg-amber-950/20'
                                            )}
                                        >
                                            <td className="px-3 py-2.5 font-mono text-xs text-muted-foreground">
                                                {index + 1}
                                            </td>
                                            <td className="overflow-hidden px-3 py-2.5">
                                                <p className="truncate font-medium text-foreground">
                                                    {item.product_name}
                                                </p>
                                                <p className="truncate font-mono text-[11px] text-muted-foreground">
                                                    {item.barcode} · {item.category_name} ({item.base_unit})
                                                </p>
                                            </td>
                                            {!hideSystem && (
                                                <td className="px-3 py-2.5 text-right font-mono text-xs text-muted-foreground">
                                                    {formatNumber(item.system_stock ?? 0)} {item.base_unit}
                                                </td>
                                            )}
                                            <td className="px-3 py-2.5 text-right">
                                                {opname.is_editable ? (
                                                    <Input
                                                        ref={(el) => {
                                                            if (el) {
                                                                qtyInputRefs.current.set(item.id, el)
                                                            } else {
                                                                qtyInputRefs.current.delete(item.id)
                                                            }
                                                        }}
                                                        type="number"
                                                        min={0}
                                                        value={item.physical_stock === null ? '' : item.physical_stock}
                                                        placeholder="—"
                                                        onChange={(e) => {
                                                            const raw = e.target.value
                                                            updateItemField(
                                                                item.id,
                                                                'physical_stock',
                                                                raw === '' ? null : Math.max(0, Number(raw))
                                                            )
                                                        }}
                                                        onKeyDown={(e) => handleQtyKeyDown(e, index)}
                                                        className="ml-auto h-8 w-24 text-right font-mono text-xs"
                                                    />
                                                ) : (
                                                    <span className="font-mono text-xs font-semibold text-foreground">
                                                        {item.physical_stock !== null
                                                            ? `${formatNumber(item.physical_stock)} ${item.base_unit}`
                                                            : '-'}
                                                    </span>
                                                )}
                                            </td>
                                            {!hideSystem && (
                                                <>
                                                    <td className="px-3 py-2.5 text-right font-mono text-xs font-bold">
                                                        {item.physical_stock === null ? (
                                                            <span className="text-muted-foreground">-</span>
                                                        ) : (
                                                            <span
                                                                className={cn(
                                                                    diff < 0
                                                                        ? 'text-rose-600 dark:text-rose-400'
                                                                        : diff > 0
                                                                          ? 'text-emerald-600 dark:text-emerald-400'
                                                                          : 'text-muted-foreground'
                                                                )}
                                                            >
                                                                {diff > 0 ? `+${diff}` : diff}
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td className="px-3 py-2.5 text-right font-mono text-xs font-semibold">
                                                        {item.physical_stock === null ? (
                                                            <span className="text-muted-foreground">-</span>
                                                        ) : (
                                                            <span
                                                                className={cn(
                                                                    diffVal < 0
                                                                        ? 'text-rose-600 dark:text-rose-400'
                                                                        : diffVal > 0
                                                                          ? 'text-emerald-600 dark:text-emerald-400'
                                                                          : 'text-muted-foreground'
                                                                )}
                                                            >
                                                                {diffVal > 0 ? '+' : ''}
                                                                {formatRupiah(diffVal)}
                                                            </span>
                                                        )}
                                                    </td>
                                                </>
                                            )}
                                            <td className="px-3 py-2.5">
                                                {opname.is_editable ? (
                                                    <Input
                                                        value={item.notes ?? ''}
                                                        placeholder="Catatan item…"
                                                        onChange={(e) =>
                                                            updateItemField(item.id, 'notes', e.target.value)
                                                        }
                                                        className="h-8 text-xs"
                                                    />
                                                ) : (
                                                    <span className="line-clamp-2 text-xs text-muted-foreground">
                                                        {item.notes || '-'}
                                                    </span>
                                                )}
                                            </td>
                                        </tr>
                                    )
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {canFinalize && (
                <DialogFinalizeStockOpname
                    open={finalizeOpen}
                    onOpenChange={setFinalizeOpen}
                    opnameNumber={opname.opname_number}
                    items={localItems}
                    hasUnsavedChanges={hasUnsavedChanges}
                    isFinalizing={isFinalizing}
                    onConfirmFinalize={handleConfirmFinalize}
                />
            )}

            <AlertDialog open={cancelOpen} onOpenChange={(next) => !isCancelling && setCancelOpen(next)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Batalkan Sesi {opname.opname_number}?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Sesi yang dibatalkan akan dikunci permanen dan tidak mengubah stok produk apa pun.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <div className="py-2">
                        <Input
                            value={cancelReason}
                            onChange={(e) => setCancelReason(e.target.value)}
                            placeholder="Alasan pembatalan (opsional)…"
                            className="h-9 text-sm"
                        />
                    </div>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isCancelling}>Kembali</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleConfirmCancel}
                            disabled={isCancelling}
                            className="bg-rose-600 text-white hover:bg-rose-700"
                        >
                            {isCancelling && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Ya, Batalkan Sesi
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </AuthenticatedLayout>
    )
}

import React, { useMemo, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ReceiptText, Store } from 'lucide-react'
import type { RoundingModeValue } from '@/types/store-setting'
import {
    SAMPLE_RECEIPT_ITEMS,
    calculateReceiptPreview,
    formatRupiah,
    formatSignedRupiah,
} from './storeSettingUtils'

export interface ReceiptPreviewCardProps {
    storeName: string
    storeAddress: string
    storePhone: string
    logoPreviewUrl: string | null
    receiptHeader: string
    receiptFooter: string
    defaultTaxRate: number
    roundingMode: RoundingModeValue
}

type PaperWidth = '58mm' | '80mm'

export default function ReceiptPreviewCard({
    storeName,
    storeAddress,
    storePhone,
    logoPreviewUrl,
    receiptHeader,
    receiptFooter,
    defaultTaxRate,
    roundingMode,
}: ReceiptPreviewCardProps) {
    const [paperWidth, setPaperWidth] = useState<PaperWidth>('80mm')

    const calc = useMemo(
        () => calculateReceiptPreview(defaultTaxRate, roundingMode),
        [defaultTaxRate, roundingMode]
    )

    const displayName = storeName.trim() || 'Nama Toko Anda'
    const isNarrow = paperWidth === '58mm'

    return (
        <Card className="lg:sticky lg:top-6">
            <CardHeader className="pb-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                        <ReceiptText className="h-5 w-5 text-primary" />
                        <CardTitle className="text-base">Live Preview Struk</CardTitle>
                    </div>
                    <div className="inline-flex rounded-md border bg-muted/50 p-0.5">
                        <Button
                            type="button"
                            size="sm"
                            variant={paperWidth === '58mm' ? 'default' : 'ghost'}
                            onClick={() => setPaperWidth('58mm')}
                            className="h-7 px-2.5 text-xs"
                        >
                            58mm
                        </Button>
                        <Button
                            type="button"
                            size="sm"
                            variant={paperWidth === '80mm' ? 'default' : 'ghost'}
                            onClick={() => setPaperWidth('80mm')}
                            className="h-7 px-2.5 text-xs"
                        >
                            80mm
                        </Button>
                    </div>
                </div>
                <CardDescription className="text-xs">
                    Simulasi cetak struk thermal secara real-time berdasarkan pengaturan di samping.
                </CardDescription>
            </CardHeader>

            <CardContent className="flex justify-center bg-muted/30 dark:bg-muted/15 py-6 px-4 border-t rounded-b-xl">
                {/* Kertas Struk Thermal — tetap kontras tinggi di Light & Dark Mode */}
                <div
                    className={`w-full transition-all duration-200 rounded-md border border-zinc-200 dark:border-zinc-700 bg-white text-zinc-900 shadow-sm font-mono ${
                        isNarrow ? 'max-w-[248px] p-3 text-[11px]' : 'max-w-[330px] p-4 text-xs'
                    }`}
                >
                    {/* Header Identitas Toko */}
                    <div className="text-center space-y-1 pb-2.5 border-b border-dashed border-zinc-400">
                        {logoPreviewUrl ? (
                            <div className="flex justify-center mb-1.5">
                                <img
                                    src={logoPreviewUrl}
                                    alt={`Logo ${displayName}`}
                                    className={`object-contain ${isNarrow ? 'max-h-10 max-w-[120px]' : 'max-h-12 max-w-[160px]'}`}
                                />
                            </div>
                        ) : (
                            <div className="flex justify-center mb-1">
                                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-100 text-zinc-500">
                                    <Store className="h-4 w-4" />
                                </div>
                            </div>
                        )}

                        <p className={`font-bold uppercase tracking-wide break-words ${isNarrow ? 'text-xs' : 'text-sm'}`}>
                            {displayName}
                        </p>

                        {storeAddress.trim() !== '' && (
                            <p className="text-[10px] leading-snug text-zinc-600 whitespace-pre-line break-words">
                                {storeAddress.trim()}
                            </p>
                        )}

                        {storePhone.trim() !== '' && (
                            <p className="text-[10px] text-zinc-600">Telp: {storePhone.trim()}</p>
                        )}

                        {receiptHeader.trim() !== '' && (
                            <p className="pt-1 text-[10px] italic text-zinc-700 whitespace-pre-line break-words">
                                {receiptHeader.trim()}
                            </p>
                        )}
                    </div>

                    {/* Metadata Transaksi Simulasi */}
                    <div className="py-2 space-y-0.5 text-[10px] text-zinc-600 border-b border-dashed border-zinc-400">
                        <div className="flex justify-between gap-2">
                            <span>No: INV-20261128-001</span>
                            <span>Kasir: Budi</span>
                        </div>
                        <div className="flex justify-between gap-2">
                            <span>28/11/2026 14:35</span>
                            <span>Shift #01</span>
                        </div>
                    </div>

                    {/* Daftar Item Simulasi */}
                    <div className="py-2.5 space-y-1.5 border-b border-dashed border-zinc-400">
                        {SAMPLE_RECEIPT_ITEMS.map((item) => {
                            const lineTotal = item.qty * item.unitPrice
                            return (
                                <div key={item.name} className="space-y-0.5">
                                    <p className="font-medium text-zinc-900 truncate">{item.name}</p>
                                    <div className="flex justify-between text-[10px] text-zinc-600">
                                        <span>
                                            {item.qty} x {formatRupiah(item.unitPrice)}
                                        </span>
                                        <span className="font-medium text-zinc-900">
                                            {formatRupiah(lineTotal)}
                                        </span>
                                    </div>
                                </div>
                            )
                        })}
                    </div>

                    {/* Ringkasan Subtotal, PPN & Pembulatan */}
                    <div className="py-2.5 space-y-1 border-b border-dashed border-zinc-400">
                        <div className="flex justify-between text-zinc-700">
                            <span>Subtotal</span>
                            <span>{formatRupiah(calc.subtotal)}</span>
                        </div>

                        {calc.taxRate > 0 && (
                            <div className="flex justify-between text-zinc-700">
                                <span>PPN ({calc.taxRate}%)</span>
                                <span>{formatRupiah(calc.taxAmount)}</span>
                            </div>
                        )}

                        {calc.roundingAdjustment !== 0 && (
                            <div className="flex justify-between text-zinc-700">
                                <span>Pembulatan</span>
                                <span>{formatSignedRupiah(calc.roundingAdjustment)}</span>
                            </div>
                        )}

                        <div className="flex justify-between pt-1.5 mt-1 border-t border-dotted border-zinc-400 font-bold text-zinc-900">
                            <span>TOTAL</span>
                            <span>{formatRupiah(calc.grandTotal)}</span>
                        </div>
                    </div>

                    {/* Simulasi Pembayaran Tunai */}
                    <div className="py-2 space-y-0.5 text-[10px] text-zinc-700 border-b border-dashed border-zinc-400">
                        <div className="flex justify-between">
                            <span>Tunai</span>
                            <span>{formatRupiah(calc.paidAmount)}</span>
                        </div>
                        <div className="flex justify-between font-semibold text-zinc-900">
                            <span>Kembali</span>
                            <span>{formatRupiah(calc.changeAmount)}</span>
                        </div>
                    </div>

                    {/* Footer Struk */}
                    <div className="pt-2.5 text-center space-y-1">
                        {receiptFooter.trim() !== '' ? (
                            <p className="text-[10px] leading-snug text-zinc-700 whitespace-pre-line break-words">
                                {receiptFooter.trim()}
                            </p>
                        ) : (
                            <p className="text-[10px] text-zinc-500">Terima kasih telah berbelanja.</p>
                        )}
                        <p className="text-[9px] text-zinc-400 pt-1">*** CONTOH STRUK ({paperWidth}) ***</p>
                    </div>
                </div>
            </CardContent>
        </Card>
    )
}

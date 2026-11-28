import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Head, useForm, usePage } from '@inertiajs/react'
import AuthenticatedLayout from '@/layouts/AuthenticatedLayout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import { toast } from 'react-toastify'
import {
    Calculator,
    ImagePlus,
    Loader2,
    ReceiptText,
    RotateCcw,
    Save,
    Store,
    Trash2,
    Upload,
} from 'lucide-react'
import StoreSettingController from '@/actions/App/Http/Controllers/StoreSettingController'
import type {
    PageProps,
    RoundingModeOption,
    RoundingModeValue,
    StoreSettingsData,
} from '@/types'
import { useAuth } from '@/hooks/use-auth'
import ReceiptPreviewCard from './component/ReceiptPreviewCard'
import { formatRupiah } from './component/storeSettingUtils'

type StoreSettingPageProps = PageProps<{
    settings: StoreSettingsData
    roundingModes: RoundingModeOption[]
}>

interface StoreSettingFormData {
    store_name: string
    store_address: string
    store_phone: string
    store_logo: File | null
    remove_logo: boolean
    receipt_header: string
    receipt_footer: string
    default_tax_rate: string
    rounding_mode: RoundingModeValue
    shift_variance_tolerance: string
}

const MAX_LOGO_SIZE_BYTES = 2 * 1024 * 1024

const StoreSettingPage = () => {
    const { settings, roundingModes } = usePage<StoreSettingPageProps>().props
    const { flash } = useAuth()
    const fileInputRef = useRef<HTMLInputElement | null>(null)
    const [localLogoUrl, setLocalLogoUrl] = useState<string | null>(null)

    const { data, setData, post, processing, errors, isDirty, reset, clearErrors } =
        useForm<StoreSettingFormData>({
            store_name: settings.store_name ?? '',
            store_address: settings.store_address ?? '',
            store_phone: settings.store_phone ?? '',
            store_logo: null,
            remove_logo: false,
            receipt_header: settings.receipt_header ?? '',
            receipt_footer: settings.receipt_footer ?? '',
            default_tax_rate: String(settings.default_tax_rate ?? 0),
            rounding_mode: settings.rounding_mode ?? 'none',
            shift_variance_tolerance: String(settings.shift_variance_tolerance ?? 0),
        })

    useEffect(() => {
        if (flash.success) {
            toast.success(flash.success)
        }
        if (flash.error) {
            toast.error(flash.error)
        }
    }, [flash.success, flash.error])

    useEffect(() => {
        return () => {
            if (localLogoUrl) {
                URL.revokeObjectURL(localLogoUrl)
            }
        }
    }, [localLogoUrl])

    const activeLogoUrl = useMemo(() => {
        if (localLogoUrl) {
            return localLogoUrl
        }
        if (data.remove_logo) {
            return null
        }
        return settings.store_logo_url
    }, [localLogoUrl, data.remove_logo, settings.store_logo_url])

    const selectedRoundingOption = useMemo(
        () => roundingModes.find((item) => item.value === data.rounding_mode) ?? roundingModes[0],
        [roundingModes, data.rounding_mode]
    )

    const parsedTaxRate = Number(data.default_tax_rate) || 0
    const parsedVarianceTolerance = Number(data.shift_variance_tolerance) || 0

    const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) {
            return
        }

        if (file.size > MAX_LOGO_SIZE_BYTES) {
            toast.error('Ukuran file logo maksimal 2 MB.')
            e.target.value = ''
            return
        }

        if (localLogoUrl) {
            URL.revokeObjectURL(localLogoUrl)
        }

        const nextUrl = URL.createObjectURL(file)
        setLocalLogoUrl(nextUrl)
        setData((prev) => ({
            ...prev,
            store_logo: file,
            remove_logo: false,
        }))
    }

    const handleRemoveLogo = () => {
        if (localLogoUrl) {
            URL.revokeObjectURL(localLogoUrl)
            setLocalLogoUrl(null)
        }
        if (fileInputRef.current) {
            fileInputRef.current.value = ''
        }
        setData((prev) => ({
            ...prev,
            store_logo: null,
            remove_logo: Boolean(settings.store_logo_url),
        }))
    }

    const handleReset = () => {
        if (localLogoUrl) {
            URL.revokeObjectURL(localLogoUrl)
            setLocalLogoUrl(null)
        }
        if (fileInputRef.current) {
            fileInputRef.current.value = ''
        }
        reset()
        clearErrors()
    }

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()

        post(StoreSettingController.update.url(), {
            forceFormData: true,
            preserveScroll: true,
            onSuccess: () => {
                if (localLogoUrl) {
                    URL.revokeObjectURL(localLogoUrl)
                    setLocalLogoUrl(null)
                }
                if (fileInputRef.current) {
                    fileInputRef.current.value = ''
                }
                setData((prev) => ({
                    ...prev,
                    store_logo: null,
                    remove_logo: false,
                }))
            },
            onError: () => {
                toast.error('Periksa kembali isian formulir pengaturan toko.')
            },
        })
    }

    return (
        <div className="w-full min-w-0 max-w-7xl mx-auto space-y-6 pb-12">
            <Head title="Pengaturan Toko" />

            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Pengaturan Toko</h1>
                    <p className="text-sm text-muted-foreground">
                        Kelola identitas minimarket, tampilan struk thermal, tarif pajak default, mode pembulatan, dan toleransi selisih kas shift.
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 items-start">
                {/* Kolom Kiri: Form Pengaturan */}
                <form onSubmit={handleSubmit} className="lg:col-span-7 xl:col-span-8 space-y-6">
                    {/* 1. Identitas Toko */}
                    <Card>
                        <CardHeader>
                            <div className="flex items-center gap-2">
                                <Store className="h-5 w-5 text-primary" />
                                <CardTitle className="text-lg">Identitas Toko</CardTitle>
                            </div>
                            <CardDescription>
                                Informasi dasar toko yang akan dicetak pada struk penjualan dan Z-Report shift.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-1.5">
                                <Label htmlFor="store-name">
                                    Nama Toko <span className="text-destructive">*</span>
                                </Label>
                                <Input
                                    id="store-name"
                                    value={data.store_name}
                                    onChange={(e) => setData('store_name', e.target.value)}
                                    placeholder="Contoh: Minimarket Berkah Jaya"
                                    maxLength={150}
                                    aria-invalid={Boolean(errors.store_name)}
                                    required
                                />
                                {errors.store_name && (
                                    <p className="text-xs font-medium text-destructive">
                                        {errors.store_name}
                                    </p>
                                )}
                            </div>

                            <div className="space-y-1.5">
                                <div className="flex items-center justify-between">
                                    <Label htmlFor="store-address">Alamat Toko</Label>
                                    <span className="text-[11px] text-muted-foreground font-mono">
                                        {data.store_address.length}/500
                                    </span>
                                </div>
                                <textarea
                                    id="store-address"
                                    rows={3}
                                    maxLength={500}
                                    value={data.store_address}
                                    onChange={(e) => setData('store_address', e.target.value)}
                                    placeholder="Jl. Merdeka No. 123, Kec. Sukamaju, Kota Bandung"
                                    className={`w-full rounded-md border bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                                        errors.store_address ? 'border-destructive' : 'border-input'
                                    }`}
                                />
                                {errors.store_address && (
                                    <p className="text-xs font-medium text-destructive">
                                        {errors.store_address}
                                    </p>
                                )}
                            </div>

                            <div className="space-y-1.5">
                                <Label htmlFor="store-phone">Nomor Telepon / WhatsApp</Label>
                                <Input
                                    id="store-phone"
                                    value={data.store_phone}
                                    onChange={(e) => setData('store_phone', e.target.value)}
                                    placeholder="Contoh: 0812-3456-7890"
                                    maxLength={30}
                                    aria-invalid={Boolean(errors.store_phone)}
                                />
                                {errors.store_phone && (
                                    <p className="text-xs font-medium text-destructive">
                                        {errors.store_phone}
                                    </p>
                                )}
                            </div>

                            {/* Logo Toko */}
                            <div className="space-y-2 pt-1">
                                <Label htmlFor="store-logo">Logo Toko</Label>
                                <div className="flex flex-col gap-4 rounded-lg border border-dashed bg-muted/20 p-4 sm:flex-row sm:items-center">
                                    <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-white dark:bg-zinc-900">
                                        {activeLogoUrl ? (
                                            <img
                                                src={activeLogoUrl}
                                                alt="Preview Logo Toko"
                                                className="h-full w-full object-contain p-1.5"
                                            />
                                        ) : (
                                            <ImagePlus className="h-7 w-7 text-muted-foreground" />
                                        )}
                                    </div>

                                    <div className="flex-1 space-y-2">
                                        <p className="text-xs text-muted-foreground">
                                            Format yang didukung: PNG, JPG, JPEG, atau WEBP. Ukuran maksimal 2 MB.
                                        </p>
                                        <div className="flex flex-wrap items-center gap-2">
                                            <input
                                                ref={fileInputRef}
                                                id="store-logo"
                                                type="file"
                                                accept="image/png,image/jpeg,image/webp"
                                                onChange={handleLogoChange}
                                                className="hidden"
                                            />
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                onClick={() => fileInputRef.current?.click()}
                                                className="gap-1.5"
                                            >
                                                <Upload className="h-3.5 w-3.5" />
                                                {activeLogoUrl ? 'Ganti Logo' : 'Upload Logo'}
                                            </Button>

                                            {activeLogoUrl && (
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={handleRemoveLogo}
                                                    className="gap-1.5 text-destructive hover:text-destructive hover:bg-destructive/10"
                                                >
                                                    <Trash2 className="h-3.5 w-3.5" />
                                                    Hapus Logo
                                                </Button>
                                            )}
                                        </div>
                                        {data.store_logo && (
                                            <p className="text-xs text-primary font-medium">
                                                File terpilih: {data.store_logo.name}
                                            </p>
                                        )}
                                    </div>
                                </div>
                                {errors.store_logo && (
                                    <p className="text-xs font-medium text-destructive">
                                        {errors.store_logo}
                                    </p>
                                )}
                            </div>
                        </CardContent>
                    </Card>

                    {/* 2. Tampilan Struk */}
                    <Card>
                        <CardHeader>
                            <div className="flex items-center gap-2">
                                <ReceiptText className="h-5 w-5 text-primary" />
                                <CardTitle className="text-lg">Tampilan Struk</CardTitle>
                            </div>
                            <CardDescription>
                                Pesan tambahan di bagian atas (header) dan bawah (footer) struk belanja.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-1.5">
                                <div className="flex items-center justify-between">
                                    <Label htmlFor="receipt-header">Header Struk</Label>
                                    <span className="text-[11px] text-muted-foreground font-mono">
                                        {data.receipt_header.length}/500
                                    </span>
                                </div>
                                <textarea
                                    id="receipt-header"
                                    rows={2}
                                    maxLength={500}
                                    value={data.receipt_header}
                                    onChange={(e) => setData('receipt_header', e.target.value)}
                                    placeholder="Contoh: Belanja Hemat Setiap Hari!"
                                    className={`w-full rounded-md border bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                                        errors.receipt_header ? 'border-destructive' : 'border-input'
                                    }`}
                                />
                                {errors.receipt_header && (
                                    <p className="text-xs font-medium text-destructive">
                                        {errors.receipt_header}
                                    </p>
                                )}
                            </div>

                            <div className="space-y-1.5">
                                <div className="flex items-center justify-between">
                                    <Label htmlFor="receipt-footer">Footer Struk</Label>
                                    <span className="text-[11px] text-muted-foreground font-mono">
                                        {data.receipt_footer.length}/500
                                    </span>
                                </div>
                                <textarea
                                    id="receipt-footer"
                                    rows={3}
                                    maxLength={500}
                                    value={data.receipt_footer}
                                    onChange={(e) => setData('receipt_footer', e.target.value)}
                                    placeholder="Contoh: Terima kasih atas kunjungan Anda. Barang yang sudah dibeli tidak dapat ditukar/dikembalikan."
                                    className={`w-full rounded-md border bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                                        errors.receipt_footer ? 'border-destructive' : 'border-input'
                                    }`}
                                />
                                {errors.receipt_footer && (
                                    <p className="text-xs font-medium text-destructive">
                                        {errors.receipt_footer}
                                    </p>
                                )}
                            </div>
                        </CardContent>
                    </Card>

                    {/* 3. Aturan Pajak, Pembulatan & Shift */}
                    <Card>
                        <CardHeader>
                            <div className="flex items-center gap-2">
                                <Calculator className="h-5 w-5 text-primary" />
                                <CardTitle className="text-lg">Aturan Pajak, Pembulatan &amp; Shift</CardTitle>
                            </div>
                            <CardDescription>
                                Konfigurasi kalkulasi PPN default, pembulatan kasir, dan batas toleransi selisih kas saat tutup shift.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                <div className="space-y-1.5">
                                    <Label htmlFor="default-tax-rate">
                                        Tarif PPN Default (%) <span className="text-destructive">*</span>
                                    </Label>
                                    <div className="relative">
                                        <Input
                                            id="default-tax-rate"
                                            type="number"
                                            min="0"
                                            max="100"
                                            step="0.01"
                                            value={data.default_tax_rate}
                                            onChange={(e) => setData('default_tax_rate', e.target.value)}
                                            aria-invalid={Boolean(errors.default_tax_rate)}
                                            className="pr-8 font-mono"
                                            required
                                        />
                                        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground font-mono">
                                            %
                                        </span>
                                    </div>
                                    <p className="text-xs text-muted-foreground">
                                        Isi 0 jika harga produk sudah termasuk pajak atau bebas PPN.
                                    </p>
                                    {errors.default_tax_rate && (
                                        <p className="text-xs font-medium text-destructive">
                                            {errors.default_tax_rate}
                                        </p>
                                    )}
                                </div>

                                <div className="space-y-1.5">
                                    <Label htmlFor="shift-variance-tolerance">
                                        Toleransi Selisih Kas Shift (Rp) <span className="text-destructive">*</span>
                                    </Label>
                                    <Input
                                        id="shift-variance-tolerance"
                                        type="number"
                                        min="0"
                                        step="500"
                                        value={data.shift_variance_tolerance}
                                        onChange={(e) =>
                                            setData('shift_variance_tolerance', e.target.value)
                                        }
                                        aria-invalid={Boolean(errors.shift_variance_tolerance)}
                                        className="font-mono"
                                        required
                                    />
                                    <p className="text-xs text-muted-foreground">
                                        Batas toleransi:{' '}
                                        <span className="font-mono font-semibold text-foreground">
                                            {formatRupiah(parsedVarianceTolerance)}
                                        </span>{' '}
                                        sebelum wajib PIN Supervisor/Admin.
                                    </p>
                                    {errors.shift_variance_tolerance && (
                                        <p className="text-xs font-medium text-destructive">
                                            {errors.shift_variance_tolerance}
                                        </p>
                                    )}
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <Label htmlFor="rounding-mode">
                                    Mode Pembulatan Total Kasir <span className="text-destructive">*</span>
                                </Label>
                                <Select
                                    items={roundingModes}
                                    value={data.rounding_mode}
                                    onValueChange={(val) => {
                                        if (val) {
                                            setData('rounding_mode', val as RoundingModeValue)
                                        }
                                    }}
                                >
                                    <SelectTrigger id="rounding-mode" className="w-full">
                                        <SelectValue placeholder="Pilih mode pembulatan">
                                            {(val) =>
                                                roundingModes.find((item) => item.value === val)?.label
                                            }
                                        </SelectValue>
                                    </SelectTrigger>
                                    <SelectContent className="w-auto min-w-(--anchor-width)">
                                        {roundingModes.map((item) => (
                                            <SelectItem key={item.value} value={item.value}>
                                                {item.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                {selectedRoundingOption && (
                                    <p className="text-xs text-muted-foreground">
                                        {selectedRoundingOption.description}
                                    </p>
                                )}
                                {errors.rounding_mode && (
                                    <p className="text-xs font-medium text-destructive">
                                        {errors.rounding_mode}
                                    </p>
                                )}
                            </div>
                        </CardContent>
                    </Card>

                    {/* Bar Aksi Simpan */}
                    <div className="flex flex-col-reverse gap-3 rounded-xl border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
                        <div className="text-xs text-muted-foreground">
                            {isDirty ? (
                                <span className="font-medium text-amber-600 dark:text-amber-400">
                                    Ada perubahan yang belum disimpan.
                                </span>
                            ) : (
                                <span>Semua pengaturan sudah tersimpan.</span>
                            )}
                        </div>
                        <div className="flex items-center justify-end gap-2">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={handleReset}
                                disabled={processing || !isDirty}
                                className="gap-1.5"
                            >
                                <RotateCcw className="h-4 w-4" />
                                Reset
                            </Button>
                            <Button
                                type="submit"
                                disabled={processing || !isDirty}
                                className="gap-1.5 min-w-[165px]"
                            >
                                {processing ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                    <Save className="h-4 w-4" />
                                )}
                                {processing ? 'Menyimpan…' : 'Simpan Pengaturan'}
                            </Button>
                        </div>
                    </div>
                </form>

                {/* Kolom Kanan: Live Preview Struk Thermal */}
                <div className="lg:col-span-5 xl:col-span-4">
                    <ReceiptPreviewCard
                        storeName={data.store_name}
                        storeAddress={data.store_address}
                        storePhone={data.store_phone}
                        logoPreviewUrl={activeLogoUrl}
                        receiptHeader={data.receipt_header}
                        receiptFooter={data.receipt_footer}
                        defaultTaxRate={parsedTaxRate}
                        roundingMode={data.rounding_mode}
                    />
                </div>
            </div>
        </div>
    )
}

StoreSettingPage.layout = (page: React.ReactNode) => (
    <AuthenticatedLayout>{page}</AuthenticatedLayout>
)

export default StoreSettingPage

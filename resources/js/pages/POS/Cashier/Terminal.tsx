import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, router, usePage } from '@inertiajs/react'
import { toast } from 'react-toastify'
import AuthenticatedLayout from '@/layouts/AuthenticatedLayout'
import { ReceiptPrint } from '@/components/pos/ReceiptPrint'
import { SupervisorPinDialog } from '@/components/pos/SupervisorPinDialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import {
    Barcode,
    Clock,
    CreditCard,
    FolderClock,
    Gift,
    Heart,
    Minus,
    PauseCircle,
    Plus,
    ReceiptText,
    Search,
    ShoppingCart,
    Sparkles,
    Tag,
    TicketPercent,
    Trash2,
    X,
} from 'lucide-react'
import cashier from '@/routes/pos/cashier'
import PosController from '@/actions/App/Http/Controllers/PosController'
import shifts from '@/routes/pos/shifts'
import transactions from '@/routes/pos/transactions'
import type {
    PageProps,
    PosCartCalculationResponse,
    PosCartItem,
    PosCartPricingLine,
    PosCustomerOption,
    PosDonationProduct,
    PosFinancialAccount,
    PosHeldTransaction,
    PosLookupProduct,
    PosPaymentMethodOption,
    PosReceiptData,
    PosTebusMurahOffer,
} from '@/types'
import { CheckoutSuccessDialog } from './component/CheckoutSuccessDialog'
import { CheckPromoDialog } from './component/CheckPromoDialog'
import { CustomerPicker } from './component/CustomerPicker'
import { HeldBillsDialog } from './component/HeldBillsDialog'
import {
    PaymentDialog,
    type PaymentDonationPayload,
    type PaymentEntryPayload,
    type PaymentPromoPreviewResult,
} from './component/PaymentDialog'
import { ProductSearchDialog } from './component/ProductSearchDialog'
import { calculateCartSummary, formatRupiah, getXsrfToken } from './component/posUtils'

type TerminalPageProps = PageProps<{
    shiftSummary: {
        id: number
        shift_number: string
        register_name: string
        opened_at: string
        starting_cash: number
        transactions_count: number
    } | null
    financialAccounts: PosFinancialAccount[]
    paymentMethods: PosPaymentMethodOption[]
    customers: PosCustomerOption[]
    donationProducts?: PosDonationProduct[]
    heldTransactions: PosHeldTransaction[]
    policyRules: {
        manual_discount_pin_threshold: number
        is_privileged: boolean
    }
}>

const Terminal = () => {
    const {
        shiftSummary,
        financialAccounts,
        paymentMethods,
        customers,
        donationProducts = [],
        heldTransactions: initialHeld,
        policyRules,
        storeSettings,
    } = usePage<TerminalPageProps>().props

    const [barcodeInput, setBarcodeInput] = useState('')
    const [isScanning, setIsScanning] = useState(false)
    const [cart, setCart] = useState<PosCartItem[]>([])
    const [selectedCustomerId, setSelectedCustomerId] = useState<string>('guest')
    const [transactionDiscount, setTransactionDiscount] = useState<number>(0)
    const [activeHeldId, setActiveHeldId] = useState<number | null>(null)
    const [heldList, setHeldList] = useState<PosHeldTransaction[]>(initialHeld)

    // Dialog states
    const [searchOpen, setSearchOpen] = useState(false)
    const [checkPromoOpen, setCheckPromoOpen] = useState(false)
    const [paymentOpen, setPaymentOpen] = useState(false)
    const [heldOpen, setHeldOpen] = useState(false)
    const [holdPromptOpen, setHoldPromptOpen] = useState(false)
    const [holdLabel, setHoldLabel] = useState('')
    const [pinDialogOpen, setPinDialogOpen] = useState(false)
    const [customerModalOpen, setCustomerModalOpen] = useState(false)
    const [pinError, setPinError] = useState<string | null>(null)
    const [pendingPayments, setPendingPayments] = useState<PaymentEntryPayload[] | null>(null)
    const [pendingDonation, setPendingDonation] = useState<PaymentDonationPayload | null>(null)

    const [isSubmitting, setIsSubmitting] = useState(false)
    const [paymentError, setPaymentError] = useState<string | null>(null)
    const [serverPricing, setServerPricing] = useState<PosCartCalculationResponse | null>(null)

    // Voucher & Tebus Murah state (mendukung > 1 voucher)
    const [voucherInput, setVoucherInput] = useState('')
    const [appliedVouchers, setAppliedVouchers] = useState<
        Array<{ code: string; name?: string | null; discount_amount: number; reservation_token: string | null }>
    >([])
    const [voucherError, setVoucherError] = useState<string | null>(null)
    const [isApplyingVoucher, setIsApplyingVoucher] = useState(false)
    const [selectedTebusMurahPromoId, setSelectedTebusMurahPromoId] = useState<number | null>(null)

    // Receipt & success state
    const [lastReceipt, setLastReceipt] = useState<PosReceiptData | null>(null)
    const [successOpen, setSuccessOpen] = useState(false)
    const [paperWidth, setPaperWidth] = useState<'58mm' | '80mm'>('80mm')

    const barcodeRef = useRef<HTMLInputElement>(null)

    useEffect(() => {
        setHeldList(initialHeld)
    }, [initialHeld])

    const focusBarcode = useCallback(() => {
        window.setTimeout(() => {
            barcodeRef.current?.focus()
        }, 60)
    }, [])

    // Auto-focus barcode input on mount and whenever modals close
    useEffect(() => {
        if (
            !searchOpen &&
            !checkPromoOpen &&
            !paymentOpen &&
            !heldOpen &&
            !holdPromptOpen &&
            !pinDialogOpen &&
            !successOpen &&
            !customerModalOpen
        ) {
            focusBarcode()
        }
    }, [
        searchOpen,
        checkPromoOpen,
        paymentOpen,
        heldOpen,
        holdPromptOpen,
        pinDialogOpen,
        successOpen,
        customerModalOpen,
        focusBarcode,
    ])

    // Evaluasi harga grosir, promo & voucher secara real-time di server saat keranjang / pelanggan berubah
    useEffect(() => {
        if (cart.length === 0) {
            setServerPricing(null)
            if (appliedVouchers.length > 0) {
                appliedVouchers.forEach((v) => {
                    if (v.reservation_token) {
                        void fetch(PosController.releaseVoucher.url(), {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                Accept: 'application/json',
                                'X-XSRF-TOKEN': getXsrfToken(),
                            },
                            body: JSON.stringify({ reservation_token: v.reservation_token }),
                        }).catch(() => undefined)
                    }
                })
                setAppliedVouchers([])
            }
            return
        }

        const controller = new AbortController()
        const timer = window.setTimeout(async () => {
            try {
                const res = await fetch(cashier.calculateCart.url(), {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Accept: 'application/json',
                        'X-XSRF-TOKEN': getXsrfToken(),
                    },
                    signal: controller.signal,
                    body: JSON.stringify({
                        customer_id: selectedCustomerId !== 'guest' ? Number(selectedCustomerId) : null,
                        discount_amount: transactionDiscount,
                        has_cash_payment: true,
                        vouchers: appliedVouchers.map((v) => ({
                            code: v.code,
                            reservation_token: v.reservation_token,
                        })),
                        selected_tebus_murah_promotion_id: selectedTebusMurahPromoId,
                        items: cart.map((l) => ({
                            product_id: l.product.id,
                            product_unit_id: l.product_unit_id,
                            qty: l.qty,
                            discount_amount: l.discount_amount,
                        })),
                    }),
                })

                if (!res.ok) return
                const data = (await res.json()) as PosCartCalculationResponse
                setServerPricing(data)

                if (appliedVouchers.length > 0 && Array.isArray(data.vouchers)) {
                    const removed = data.vouchers.filter((v) => v.auto_removed)
                    if (removed.length > 0) {
                        const removedCodes = new Set(removed.map((v) => v.code.toUpperCase()))
                        setAppliedVouchers((prev) =>
                            prev.filter((v) => !removedCodes.has(v.code.toUpperCase()))
                        )
                        const reason =
                            removed[0].message ?? 'Syarat voucher tidak lagi terpenuhi sehingga dilepas otomatis.'
                        setVoucherError(reason)
                        toast.warning(reason)
                    }
                }
            } catch {
                // Abaikan abort atau error sementara; fallback lokal tetap menjaga UI responsif
            }
        }, 120)

        return () => {
            window.clearTimeout(timer)
            controller.abort()
        }
    }, [
        cart,
        selectedCustomerId,
        transactionDiscount,
        appliedVouchers,
        selectedTebusMurahPromoId,
    ])

    const localSummary = useMemo(
        () =>
            calculateCartSummary(
                cart,
                transactionDiscount,
                storeSettings?.default_tax_rate ?? 0,
                storeSettings?.rounding_mode ?? 'none'
            ),
        [cart, transactionDiscount, storeSettings]
    )

    const summary = useMemo(() => {
        if (serverPricing && serverPricing.items.length === cart.length) {
            const s = serverPricing.summary
            return {
                grossSubtotal: s.gross_subtotal,
                autoDiscountTotal: s.auto_discount_total,
                itemDiscountTotal: s.item_discount_total,
                transactionPromoDiscountTotal: s.transaction_promo_discount_total ?? 0,
                voucherDiscountTotal: s.voucher_discount_total ?? 0,
                transactionDiscount: s.transaction_discount,
                paymentPromoDiscountTotal: s.payment_promo_discount_total ?? 0,
                cashbackTotal: s.cashback_total ?? 0,
                manualDiscountTotal: s.manual_discount_total,
                totalDiscount: s.total_discount,
                netSubtotal: s.net_subtotal,
                taxableAmount: s.taxable_amount,
                taxExemptAmount: s.tax_exempt_amount,
                taxAmount: s.tax_amount,
                roundingAmount: s.rounding_amount,
                grandTotal: s.grand_total,
                totalItemsQty: s.total_items_qty,
                hasTaxExemptItems: s.has_tax_exempt_items,
            }
        }

        return {
            ...localSummary,
            autoDiscountTotal: 0,
            transactionPromoDiscountTotal: 0,
            voucherDiscountTotal: 0,
            paymentPromoDiscountTotal: 0,
            cashbackTotal: 0,
            manualDiscountTotal: localSummary.totalDiscount,
        }
    }, [serverPricing, cart.length, localSummary])

    const getUsedBaseQtyForProduct = useCallback(
        (productId: number, excludeLineId?: string): number =>
            cart
                .filter((line) => line.product.id === productId && line.line_id !== excludeLineId)
                .reduce((sum, line) => sum + line.qty * line.conversion_factor, 0),
        [cart]
    )

    const addProductToCart = useCallback(
        (product: PosLookupProduct, preferredUnitId: number | null = null) => {
            const targetUnitId = preferredUnitId ?? product.matched_unit_id ?? null
            const matchedUnit = targetUnitId ? product.units.find((u) => u.id === targetUnitId) : null
            const conversionFactor = matchedUnit ? matchedUnit.conversion_factor : 1
            const unitName = matchedUnit ? matchedUnit.unit_name : product.base_unit
            const unitPrice = matchedUnit ? matchedUnit.sell_price : product.sell_price

            setCart((prev) => {
                const usedBaseQty = prev
                    .filter((l) => l.product.id === product.id)
                    .reduce((s, l) => s + l.qty * l.conversion_factor, 0)

                if (!product.is_donation && usedBaseQty + conversionFactor > product.stock) {
                    toast.error(
                        `Stok ${product.name} tidak mencukupi (tersedia ${product.stock} ${product.base_unit}).`
                    )
                    return prev
                }

                const existingIdx = prev.findIndex(
                    (l) => l.product.id === product.id && l.product_unit_id === (matchedUnit ? matchedUnit.id : null)
                )

                if (existingIdx >= 0) {
                    return prev.map((line, idx) =>
                        idx === existingIdx ? { ...line, qty: line.qty + 1 } : line
                    )
                }

                return [
                    ...prev,
                    {
                        line_id: `${product.id}-${matchedUnit ? matchedUnit.id : 'base'}-${Date.now()}`,
                        product,
                        product_unit_id: matchedUnit ? matchedUnit.id : null,
                        unit_name: unitName,
                        conversion_factor: conversionFactor,
                        unit_price: unitPrice,
                        qty: 1,
                        discount_amount: 0,
                    },
                ]
            })
        },
        []
    )

    const handleBarcodeSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        const code = barcodeInput.trim()
        if (!code || isScanning) return

        setIsScanning(true)
        try {
            const res = await fetch(`${cashier.lookup.url()}?q=${encodeURIComponent(code)}&limit=5`, {
                headers: { Accept: 'application/json' },
            })
            if (!res.ok) {
                toast.error('Gagal mencari produk.')
                return
            }
            const data = (await res.json()) as { products: PosLookupProduct[] }
            const found = data.products ?? []
            if (found.length === 0) {
                toast.warning(`Produk dengan kode/nama "${code}" tidak ditemukan.`)
                return
            }

            if (found.length === 1 || found[0].barcode === code || found[0].matched_unit_id !== null) {
                addProductToCart(found[0], found[0].matched_unit_id)
                setBarcodeInput('')
            } else {
                setSearchOpen(true)
            }
        } finally {
            setIsScanning(false)
            focusBarcode()
        }
    }

    const updateLineQty = (lineId: string, newQty: number) => {
        if (newQty <= 0) {
            setCart((prev) => prev.filter((l) => l.line_id !== lineId))
            return
        }

        const target = cart.find((l) => l.line_id === lineId)
        if (!target) return

        const otherBaseQty = getUsedBaseQtyForProduct(target.product.id, lineId)
        if (!target.product.is_donation && otherBaseQty + newQty * target.conversion_factor > target.product.stock) {
            toast.error(
                `Stok ${target.product.name} tidak mencukupi (tersedia ${target.product.stock} ${target.product.base_unit}).`
            )
            return
        }

        setCart((prev) => prev.map((l) => (l.line_id === lineId ? { ...l, qty: newQty } : l)))
    }

    const updateLineUnit = (lineId: string, unitValue: string | null) => {
        if (!unitValue) return
        const target = cart.find((l) => l.line_id === lineId)
        if (!target) return

        const isBase = unitValue === 'base'
        const unit = isBase ? null : target.product.units.find((u) => String(u.id) === unitValue) ?? null
        const newFactor = unit ? unit.conversion_factor : 1
        const otherBaseQty = getUsedBaseQtyForProduct(target.product.id, lineId)

        if (otherBaseQty + target.qty * newFactor > target.product.stock) {
            toast.error(
                `Stok ${target.product.name} tidak cukup untuk satuan ${unit?.unit_name ?? target.product.base_unit}.`
            )
            return
        }

        setCart((prev) =>
            prev.map((l) =>
                l.line_id === lineId
                    ? {
                        ...l,
                        product_unit_id: unit ? unit.id : null,
                        unit_name: unit ? unit.unit_name : l.product.base_unit,
                        conversion_factor: newFactor,
                        unit_price: unit ? unit.sell_price : l.product.sell_price,
                    }
                    : l
            )
        )
    }

    const updateLineDiscount = (lineId: string, discountValue: number) => {
        setCart((prev) =>
            prev.map((l) => {
                if (l.line_id !== lineId) return l
                const maxDisc = l.unit_price * l.qty
                return {
                    ...l,
                    discount_amount: Math.max(0, Math.min(discountValue, maxDisc)),
                }
            })
        )
    }

    const handleApplyVoucher = async (e: React.FormEvent) => {
        e.preventDefault()
        const code = voucherInput.trim().toUpperCase().replace(/\s+/g, '')
        if (!code || cart.length === 0 || isApplyingVoucher) return

        if (appliedVouchers.some((v) => v.code.toUpperCase() === code)) {
            const msg = `Voucher ${code} sudah terpasang di keranjang.`
            setVoucherError(msg)
            toast.warning(msg)
            return
        }

        setIsApplyingVoucher(true)
        setVoucherError(null)
        try {
            const res = await fetch(PosController.reserveVoucher.url(), {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Accept: 'application/json',
                    'X-XSRF-TOKEN': getXsrfToken(),
                },
                body: JSON.stringify({
                    code,
                    customer_id: selectedCustomerId !== 'guest' ? Number(selectedCustomerId) : null,
                    discount_amount: transactionDiscount,
                    has_cash_payment: true,
                    existing_vouchers: appliedVouchers.map((v) => ({
                        code: v.code,
                        reservation_token: v.reservation_token,
                    })),
                    items: cart.map((l) => ({
                        product_id: l.product.id,
                        product_unit_id: l.product_unit_id,
                        qty: l.qty,
                        discount_amount: l.discount_amount,
                    })),
                }),
            })

            const data = (await res.json()) as {
                valid?: boolean
                reservation_token?: string
                message?: string
                voucher?: { code?: string; name?: string; discount_amount?: number }
                pricing?: PosCartCalculationResponse
            }

            if (!res.ok || !data.valid) {
                const msg = data.message ?? 'Kode voucher tidak valid.'
                setVoucherError(msg)
                toast.error(msg)
                return
            }

            const appliedCode = data.voucher?.code ?? code
            setAppliedVouchers((prev) => [
                ...prev,
                {
                    code: appliedCode,
                    name: data.voucher?.name ?? null,
                    discount_amount: data.voucher?.discount_amount ?? 0,
                    reservation_token: data.reservation_token ?? null,
                },
            ])
            setVoucherInput('')
            setVoucherError(null)
            if (data.pricing) {
                setServerPricing(data.pricing)
            }
            toast.success(`Voucher ${appliedCode} berhasil dipasang.`)
        } catch {
            setVoucherError('Gagal menghubungi server untuk validasi voucher.')
        } finally {
            setIsApplyingVoucher(false)
        }
    }

    const handleReleaseVoucher = async (codeToRemove: string) => {
        const target = appliedVouchers.find((v) => v.code === codeToRemove)
        setAppliedVouchers((prev) => prev.filter((v) => v.code !== codeToRemove))
        setVoucherError(null)

        if (target?.reservation_token) {
            try {
                await fetch(PosController.releaseVoucher.url(), {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Accept: 'application/json',
                        'X-XSRF-TOKEN': getXsrfToken(),
                    },
                    body: JSON.stringify({ reservation_token: target.reservation_token }),
                })
            } catch {
                // Abaikan error release
            }
        }
    }

    const resetCart = useCallback(() => {
        setCart([])
        setSelectedCustomerId('guest')
        setTransactionDiscount(0)
        setActiveHeldId(null)
        setPaymentError(null)
        setPinError(null)
        setPendingPayments(null)
        setPendingDonation(null)
        setVoucherInput('')
        setAppliedVouchers([])
        setVoucherError(null)
        setSelectedTebusMurahPromoId(null)
    }, [])

    const handleRedeemTebusMurah = async (offer: PosTebusMurahOffer) => {
        const alreadyInCart = cart.some(
            (line) => line.product.id === offer.reward_product_id && line.product_unit_id === null
        )

        if (!alreadyInCart) {
            try {
                const res = await fetch(
                    `${cashier.lookup.url()}?q=${encodeURIComponent(offer.reward_product_barcode)}&limit=5`,
                    { headers: { Accept: 'application/json' } }
                )
                if (res.ok) {
                    const data = (await res.json()) as { products: PosLookupProduct[] }
                    const matched = (data.products ?? []).find((p) => p.id === offer.reward_product_id)
                    if (matched) {
                        addProductToCart(matched, null)
                    } else {
                        toast.error('Produk Tebus Murah tidak ditemukan atau stok kosong.')
                        return
                    }
                }
            } catch {
                toast.error('Gagal menambahkan produk Tebus Murah.')
                return
            }
        }

        setSelectedTebusMurahPromoId(offer.promotion_id)
        toast.success(`Penawaran Tebus Murah "${offer.reward_product_name}" dipilih (maks. 1/struk).`)
    }

    const handlePreviewPaymentPromo = useCallback(
        async (
            payments: Array<{
                payment_method: string
                amount: number
                card_bin?: string | null
                reference_number?: string | null
            }>
        ): Promise<PaymentPromoPreviewResult | null> => {
            if (cart.length === 0) return null

            try {
                const res = await fetch(cashier.calculateCart.url(), {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Accept: 'application/json',
                        'X-XSRF-TOKEN': getXsrfToken(),
                    },
                    body: JSON.stringify({
                        customer_id: selectedCustomerId !== 'guest' ? Number(selectedCustomerId) : null,
                        discount_amount: transactionDiscount,
                        has_cash_payment: payments.some((p) => p.payment_method === 'cash'),
                        vouchers: appliedVouchers.map((v) => ({
                            code: v.code,
                            reservation_token: v.reservation_token,
                        })),
                        selected_tebus_murah_promotion_id: selectedTebusMurahPromoId,
                        items: cart.map((l) => ({
                            product_id: l.product.id,
                            product_unit_id: l.product_unit_id,
                            qty: l.qty,
                            discount_amount: l.discount_amount,
                        })),
                        payments,
                    }),
                })

                if (!res.ok) return null
                const data = (await res.json()) as PosCartCalculationResponse
                return {
                    grandTotal: data.summary.grand_total,
                    paymentPromotion: data.payment_promotion ?? null,
                }
            } catch {
                return null
            }
        },
        [
            cart,
            selectedCustomerId,
            transactionDiscount,
            appliedVouchers,
            selectedTebusMurahPromoId,
        ]
    )

    const executeCheckout = async (
        payments: PaymentEntryPayload[],
        donation?: PaymentDonationPayload | null,
        supervisorPin?: string
    ) => {
        setIsSubmitting(true)
        setPaymentError(null)
        setPinError(null)

        try {
            const res = await fetch(cashier.checkout.url(), {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Accept: 'application/json',
                    'X-XSRF-TOKEN': getXsrfToken(),
                },
                body: JSON.stringify({
                    customer_id: selectedCustomerId !== 'guest' ? Number(selectedCustomerId) : null,
                    held_transaction_id: activeHeldId,
                    discount_amount: summary.transactionDiscount,
                    vouchers: appliedVouchers.map((v) => ({
                        code: v.code,
                        reservation_token: v.reservation_token,
                    })),
                    selected_tebus_murah_promotion_id: selectedTebusMurahPromoId,
                    donation_product_id: donation?.donation_product_id ?? null,
                    donation_amount: donation?.donation_amount ?? 0,
                    supervisor_pin: supervisorPin ?? null,
                    items: cart.map((l) => ({
                        product_id: l.product.id,
                        product_unit_id: l.product_unit_id,
                        qty: l.qty,
                        discount_amount: l.discount_amount,
                    })),
                    payments,
                }),
            })

            const data = (await res.json()) as {
                message?: string
                errors?: Record<string, string[]>
                transaction?: PosReceiptData
            }

            if (!res.ok) {
                const firstError =
                    data.errors?.supervisor_pin?.[0] ??
                    data.errors?.donation_amount?.[0] ??
                    data.errors?.donation_product_id?.[0] ??
                    data.errors?.payments?.[0] ??
                    data.errors?.items?.[0] ??
                    Object.values(data.errors ?? {})[0]?.[0] ??
                    data.message ??
                    'Checkout gagal diproses.'

                if (data.errors?.supervisor_pin) {
                    setPinError(data.errors.supervisor_pin[0])
                    setPinDialogOpen(true)
                } else {
                    setPaymentError(firstError)
                }
                return
            }

            if (data.transaction) {
                setLastReceipt(data.transaction)
                setPaymentOpen(false)
                setPinDialogOpen(false)
                setSuccessOpen(true)
                resetCart()
                toast.success(data.message ?? 'Transaksi berhasil diproses.')
                router.reload({ only: ['heldTransactions', 'shiftSummary'] })
            }
        } catch {
            setPaymentError('Terjadi kesalahan jaringan saat memproses transaksi.')
        } finally {
            setIsSubmitting(false)
        }
    }

    const handlePaymentSubmit = (
        payments: PaymentEntryPayload[],
        donation?: PaymentDonationPayload | null
    ) => {
        const needsPin =
            summary.manualDiscountTotal > policyRules.manual_discount_pin_threshold && !policyRules.is_privileged

        if (needsPin) {
            setPendingPayments(payments)
            setPendingDonation(donation ?? null)
            setPinError(null)
            setPinDialogOpen(true)
            return
        }

        void executeCheckout(payments, donation)
    }

    const handlePinConfirm = (pin: string) => {
        if (!pendingPayments) return
        void executeCheckout(pendingPayments, pendingDonation, pin)
    }

    const handleHoldBill = async (e: React.FormEvent) => {
        e.preventDefault()
        if (cart.length === 0 || isSubmitting) return

        setIsSubmitting(true)
        try {
            const res = await fetch(cashier.hold.url(), {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Accept: 'application/json',
                    'X-XSRF-TOKEN': getXsrfToken(),
                },
                body: JSON.stringify({
                    label: holdLabel.trim() || null,
                    customer_id: selectedCustomerId !== 'guest' ? Number(selectedCustomerId) : null,
                    discount_amount: summary.transactionDiscount,
                    items: cart.map((l) => ({
                        product_id: l.product.id,
                        product_unit_id: l.product_unit_id,
                        qty: l.qty,
                        discount_amount: l.discount_amount,
                    })),
                }),
            })

            const data = (await res.json()) as {
                message?: string
                heldTransactions?: PosHeldTransaction[]
            }

            if (!res.ok) {
                toast.error(data.message ?? 'Gagal menahan transaksi.')
                return
            }

            if (data.heldTransactions) {
                setHeldList(data.heldTransactions)
            }
            setHoldLabel('')
            setHoldPromptOpen(false)
            resetCart()
            toast.success(data.message ?? 'Transaksi berhasil ditahan.')
        } finally {
            setIsSubmitting(false)
        }
    }

    const handleResumeHeld = (held: PosHeldTransaction) => {
        const resumedItems: PosCartItem[] = held.items.map((item, idx) => {
            const matchedUnit = item.product_unit_id
                ? item.product.units.find((u) => u.id === item.product_unit_id) ?? null
                : null

            return {
                line_id: `resumed-${held.id}-${idx}-${Date.now()}`,
                product: item.product,
                product_unit_id: matchedUnit ? matchedUnit.id : null,
                unit_name: matchedUnit ? matchedUnit.unit_name : item.product.base_unit,
                conversion_factor: matchedUnit ? matchedUnit.conversion_factor : 1,
                unit_price: matchedUnit ? matchedUnit.sell_price : item.product.sell_price,
                qty: item.qty,
                discount_amount: item.discount_amount,
            }
        })

        setCart(resumedItems)
        setSelectedCustomerId(held.customer_id ? String(held.customer_id) : 'guest')
        setTransactionDiscount(held.discount_amount)
        setActiveHeldId(held.id)
        toast.info(`Transaksi ${held.hold_code} dimuat kembali ke keranjang.`)
    }

    const handleDeleteHeld = async (held: PosHeldTransaction) => {
        setIsSubmitting(true)
        try {
            const res = await fetch(cashier.held.destroy.url({ heldTransaction: held.id }), {
                method: 'DELETE',
                headers: {
                    Accept: 'application/json',
                    'X-XSRF-TOKEN': getXsrfToken(),
                },
            })
            const data = (await res.json()) as {
                message?: string
                heldTransactions?: PosHeldTransaction[]
            }
            if (res.ok) {
                if (data.heldTransactions) setHeldList(data.heldTransactions)
                if (activeHeldId === held.id) setActiveHeldId(null)
                toast.success(data.message ?? 'Transaksi tertahan dihapus.')
            }
        } finally {
            setIsSubmitting(false)
        }
    }

    // Global Keyboard Shortcuts: F2, F4, F8, Esc
    useEffect(() => {
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'F2') {
                e.preventDefault()
                setSearchOpen(true)
            } else if (e.key === 'F4') {
                e.preventDefault()
                if (cart.length > 0) {
                    setHoldPromptOpen(true)
                } else {
                    setHeldOpen(true)
                }
            } else if (e.key === 'F8') {
                e.preventDefault()
                if (cart.length > 0) {
                    setPaymentError(null)
                    setPaymentOpen(true)
                }
            } else if (e.key === 'Escape') {
                if (
                    !searchOpen &&
                    !checkPromoOpen &&
                    !paymentOpen &&
                    !heldOpen &&
                    !holdPromptOpen &&
                    !pinDialogOpen &&
                    !successOpen
                ) {
                    setBarcodeInput('')
                    focusBarcode()
                }
            }
        }

        window.addEventListener('keydown', onKeyDown)
        return () => window.removeEventListener('keydown', onKeyDown)
    }, [
        cart.length,
        searchOpen,
        checkPromoOpen,
        paymentOpen,
        heldOpen,
        holdPromptOpen,
        pinDialogOpen,
        successOpen,
        focusBarcode,
    ])

    return (
        <>
            <div className="no-print space-y-4">
                {/* Header Bar */}
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <div className="flex flex-wrap items-center gap-2">
                            <h1 className="text-xl font-bold tracking-tight text-foreground">
                                Terminal Kasir POS
                            </h1>
                            {shiftSummary && (
                                <Badge variant="success" className="font-mono text-[11px]">
                                    {shiftSummary.shift_number} • {shiftSummary.register_name}
                                </Badge>
                            )}
                            {activeHeldId && (
                                <Badge variant="secondary" className="text-[11px]">
                                    Dari Hold Bill
                                </Badge>
                            )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                            Shortcut: <kbd className="rounded border px-1 font-mono text-[10px]">F2</kbd> Cari Produk •{' '}
                            <kbd className="rounded border px-1 font-mono text-[10px]">F4</kbd> Hold Bill •{' '}
                            <kbd className="rounded border px-1 font-mono text-[10px]">F8</kbd> Bayar •{' '}
                            <kbd className="rounded border px-1 font-mono text-[10px]">Esc</kbd> Reset Input
                        </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setCheckPromoOpen(true)}
                            className="h-9 gap-1.5 cursor-pointer"
                        >
                            <Sparkles className="h-4 w-4 text-primary" />
                            Cek Promo
                        </Button>
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setHeldOpen(true)}
                            className="h-9 gap-1.5 cursor-pointer"
                        >
                            <FolderClock className="h-4 w-4" />
                            Hold Bill
                            {heldList.length > 0 && (
                                <Badge variant="secondary" className="ml-0.5 h-5 px-1.5 font-mono text-[11px]">
                                    {heldList.length}
                                </Badge>
                            )}
                        </Button>
                        <Link href={transactions.index.url()}>
                            <Button variant="outline" size="sm" className="h-9 gap-1.5 cursor-pointer">
                                <ReceiptText className="h-4 w-4" />
                                Riwayat
                            </Button>
                        </Link>
                        <Link href={shifts.index.url()}>
                            <Button variant="outline" size="sm" className="h-9 gap-1.5 cursor-pointer">
                                <Clock className="h-4 w-4" />
                                Shift
                            </Button>
                        </Link>
                    </div>
                </div>

                {/* Main Split Layout */}
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
                    {/* Left: Barcode Scanner & Cart Table */}
                    <div className="lg:col-span-8 space-y-3">
                        <Card className="py-0 gap-0">
                            <CardContent className="p-3">
                                <form onSubmit={handleBarcodeSubmit} className="flex flex-col gap-2 sm:flex-row">
                                    <div className="relative flex-1">
                                        <Barcode className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                        <Input
                                            ref={barcodeRef}
                                            value={barcodeInput}
                                            onChange={(e) => setBarcodeInput(e.target.value)}
                                            placeholder="Scan barcode produk / satuan atau ketik nama lalu tekan Enter..."
                                            disabled={isScanning}
                                            className="h-9 pl-9 font-mono text-sm"
                                        />
                                    </div>
                                    <div className="flex gap-2">
                                        <Button
                                            type="submit"
                                            disabled={isScanning || !barcodeInput.trim()}
                                            className="h-9 cursor-pointer"
                                        >
                                            Tambah
                                        </Button>
                                        <Button
                                            type="button"
                                            variant="outline"
                                            onClick={() => setSearchOpen(true)}
                                            className="h-9 gap-1.5 cursor-pointer"
                                        >
                                            <Search className="h-4 w-4" />
                                            Cari (F2)
                                        </Button>
                                    </div>
                                </form>
                            </CardContent>
                        </Card>

                        <Card className="gap-0 py-0 overflow-hidden">
                            <div className="flex items-center justify-between gap-2 border-b bg-muted/20 px-3.5 py-2">
                                <div className="flex items-center gap-2 min-w-0">
                                    <ShoppingCart className="h-4 w-4 text-primary shrink-0" />
                                    <h2 className="text-sm font-semibold text-foreground truncate">
                                        Keranjang Belanja
                                    </h2>
                                    <Badge variant="secondary" className="font-mono text-[11px] shrink-0">
                                        {cart.length} item • {summary.totalItemsQty} qty
                                    </Badge>
                                </div>
                                {cart.length > 0 && (
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        onClick={resetCart}
                                        className="h-7 px-2 text-xs text-destructive hover:text-destructive cursor-pointer shrink-0"
                                    >
                                        Kosongkan
                                    </Button>
                                )}
                            </div>
                            <CardContent className="p-0 overflow-x-auto">
                                {cart.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
                                        <ShoppingCart className="h-10 w-10 mb-2 opacity-30" />
                                        <p className="text-sm font-medium">Keranjang masih kosong</p>
                                        <p className="text-xs mt-1">
                                            Scan barcode di atas atau tekan <kbd className="rounded border px-1 font-mono text-[10px]">F2</kbd> untuk memilih produk.
                                        </p>
                                    </div>
                                ) : (
                                    <table className="table-fixed w-full min-w-[680px] text-sm">
                                        <thead>
                                            <tr className="border-b bg-muted/40 text-xs text-muted-foreground">
                                                <th className="w-[5%] px-2 py-2 text-center font-medium">No</th>
                                                <th className="w-[31%] px-3 py-2 text-left font-medium">Produk &amp; Barcode</th>
                                                <th className="w-[16%] px-2 py-2 text-left font-medium">Satuan</th>
                                                <th className="w-[16%] px-2 py-2 text-center font-medium">Qty</th>
                                                <th className="w-[13%] px-2 py-2 text-right font-medium">Diskon (Rp)</th>
                                                <th className="w-[14%] px-3 py-2 text-right font-medium">Subtotal</th>
                                                <th className="w-[5%] px-2 py-2 text-right font-medium"></th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y">
                                            {cart.map((line, index) => {
                                                const pricingLine: PosCartPricingLine | undefined =
                                                    serverPricing?.items[index]?.product_id === line.product.id &&
                                                    serverPricing?.items[index]?.product_unit_id === line.product_unit_id
                                                        ? serverPricing.items[index]
                                                        : undefined
                                                const autoDiscount = pricingLine?.auto_discount_amount ?? 0
                                                const hasAutoPricing =
                                                    autoDiscount > 0 &&
                                                    (pricingLine?.pricing_source === 'wholesale_tier' ||
                                                        pricingLine?.pricing_source === 'promotion')
                                                const lineTotal = pricingLine
                                                    ? pricingLine.line_subtotal
                                                    : Math.max(0, line.unit_price * line.qty - line.discount_amount)
                                                const matchedUnitObj = line.product_unit_id
                                                    ? line.product.units.find((u) => u.id === line.product_unit_id) ?? null
                                                    : null
                                                const displayBarcode = matchedUnitObj?.barcode || line.product.barcode
                                                const unitOptions = [
                                                    {
                                                        value: 'base',
                                                        label: `${line.product.base_unit} (${formatRupiah(line.product.sell_price)})`,
                                                    },
                                                    ...line.product.units.map((u) => ({
                                                        value: String(u.id),
                                                        label: `${u.unit_name} x${u.conversion_factor} (${formatRupiah(u.sell_price)})`,
                                                    })),
                                                ]

                                                return (
                                                    <tr key={line.line_id} className="hover:bg-muted/20">
                                                        <td className="px-2 py-2.5 align-middle text-center font-mono text-xs text-muted-foreground">
                                                            {index + 1}
                                                        </td>
                                                        <td className="px-3 py-2.5 align-middle">
                                                            <div className="flex items-center gap-1.5 min-w-0">
                                                                <p className="font-medium text-foreground truncate" title={line.product.name}>
                                                                    {line.product.name}
                                                                </p>
                                                                {line.product.is_donation ? (
                                                                    <Badge
                                                                        variant="outline"
                                                                        className="h-4 px-1.5 py-0 text-[10px] gap-0.5 shrink-0 border-pink-300 bg-pink-50 text-pink-700 dark:border-pink-800 dark:bg-pink-950/60 dark:text-pink-300"
                                                                    >
                                                                        <Heart className="h-2.5 w-2.5" />
                                                                        Donasi
                                                                    </Badge>
                                                                ) : line.product.is_tax_exempt ? (
                                                                    <Badge
                                                                        variant="outline"
                                                                        className="h-4 px-1.5 py-0 text-[10px] shrink-0 border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
                                                                    >
                                                                        Bebas PPN
                                                                    </Badge>
                                                                ) : null}
                                                            </div>
                                                            <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 font-mono text-[11px] text-muted-foreground">
                                                                <span className="inline-flex items-center gap-1 text-foreground/80">
                                                                    <Barcode className="h-3 w-3 text-muted-foreground shrink-0" />
                                                                    {displayBarcode}
                                                                </span>
                                                                <span>•</span>
                                                                {hasAutoPricing && pricingLine ? (
                                                                    <span className="inline-flex items-center gap-1">
                                                                        <span className="line-through text-muted-foreground">
                                                                            {formatRupiah(pricingLine.base_unit_price)}
                                                                        </span>
                                                                        <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                                                                            {formatRupiah(pricingLine.effective_unit_price)}
                                                                        </span>
                                                                    </span>
                                                                ) : (
                                                                    <span>{formatRupiah(line.unit_price)}</span>
                                                                )}
                                                                <span>•</span>
                                                                <span>Stok: {line.product.stock} {line.product.base_unit}</span>
                                                            </div>
                                                            {hasAutoPricing && pricingLine && (
                                                                <div className="mt-1 flex flex-wrap items-center gap-1.5">
                                                                    <Badge
                                                                        variant="outline"
                                                                        className={
                                                                            pricingLine.pricing_source === 'wholesale_tier'
                                                                                ? 'h-4 px-1.5 py-0 text-[10px] gap-1 border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                                                                                : 'h-4 px-1.5 py-0 text-[10px] gap-1 border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950/60 dark:text-blue-300'
                                                                        }
                                                                    >
                                                                        {pricingLine.pricing_source === 'wholesale_tier' ? (
                                                                            <Tag className="h-2.5 w-2.5" />
                                                                        ) : (
                                                                            <Sparkles className="h-2.5 w-2.5" />
                                                                        )}
                                                                        {pricingLine.badge_label}
                                                                    </Badge>
                                                                    <span className="font-mono text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
                                                                        Hemat {formatRupiah(autoDiscount)}
                                                                    </span>
                                                                </div>
                                                            )}
                                                        </td>
                                                        <td className="px-2 py-2.5 align-middle">
                                                            {line.product.units.length > 0 ? (
                                                                <Select
                                                                    value={line.product_unit_id ? String(line.product_unit_id) : 'base'}
                                                                    onValueChange={(v) => updateLineUnit(line.line_id, v)}
                                                                    items={unitOptions}
                                                                >
                                                                    <SelectTrigger className="w-full h-8 text-xs">
                                                                        <SelectValue>
                                                                            {(val) => {
                                                                                if (val === 'base') return line.product.base_unit
                                                                                const found = line.product.units.find(
                                                                                    (u) => String(u.id) === val
                                                                                )
                                                                                return found ? found.unit_name : line.unit_name
                                                                            }}
                                                                        </SelectValue>
                                                                    </SelectTrigger>
                                                                    <SelectContent>
                                                                        {unitOptions.map((opt) => (
                                                                            <SelectItem key={opt.value} value={opt.value}>
                                                                                {opt.label}
                                                                            </SelectItem>
                                                                        ))}
                                                                    </SelectContent>
                                                                </Select>
                                                            ) : (
                                                                <span className="text-xs text-muted-foreground">
                                                                    {line.unit_name}
                                                                </span>
                                                            )}
                                                        </td>
                                                        <td className="px-2 py-2.5 align-middle">
                                                            <div className="flex items-center justify-center gap-1">
                                                                <Button
                                                                    type="button"
                                                                    variant="outline"
                                                                    size="icon"
                                                                    onClick={() => updateLineQty(line.line_id, line.qty - 1)}
                                                                    className="h-7 w-7 shrink-0 cursor-pointer"
                                                                >
                                                                    <Minus className="h-3 w-3" />
                                                                </Button>
                                                                <Input
                                                                    type="number"
                                                                    min={1}
                                                                    value={line.qty}
                                                                    onChange={(e) =>
                                                                        updateLineQty(
                                                                            line.line_id,
                                                                            Math.max(1, Number(e.target.value) || 1)
                                                                        )
                                                                    }
                                                                    className="h-7 w-12 px-1 text-center font-mono text-xs"
                                                                />
                                                                <Button
                                                                    type="button"
                                                                    variant="outline"
                                                                    size="icon"
                                                                    onClick={() => updateLineQty(line.line_id, line.qty + 1)}
                                                                    className="h-7 w-7 shrink-0 cursor-pointer"
                                                                >
                                                                    <Plus className="h-3 w-3" />
                                                                </Button>
                                                            </div>
                                                        </td>
                                                        <td className="px-2 py-2.5 align-middle text-right">
                                                            <Input
                                                                type="number"
                                                                min={0}
                                                                step="100"
                                                                value={line.discount_amount || ''}
                                                                placeholder="0"
                                                                onChange={(e) =>
                                                                    updateLineDiscount(
                                                                        line.line_id,
                                                                        Number(e.target.value) || 0
                                                                    )
                                                                }
                                                                className="h-7 w-full text-right font-mono text-xs"
                                                            />
                                                        </td>
                                                        <td className="px-3 py-2.5 align-middle text-right font-mono text-xs font-semibold text-foreground whitespace-nowrap">
                                                            {formatRupiah(lineTotal)}
                                                        </td>
                                                        <td className="px-2 py-2.5 align-middle text-right">
                                                            <Button
                                                                type="button"
                                                                variant="ghost"
                                                                size="icon"
                                                                onClick={() => updateLineQty(line.line_id, 0)}
                                                                className="h-7 w-7 text-destructive hover:text-destructive cursor-pointer"
                                                                title="Hapus item"
                                                            >
                                                                <Trash2 className="h-3.5 w-3.5" />
                                                            </Button>
                                                        </td>
                                                    </tr>
                                                )
                                            })}
                                        </tbody>
                                    </table>
                                )}
                            </CardContent>
                        </Card>
                    </div>

                    {/* Right: Customer, Summary & Checkout Actions */}
                    <div className="lg:col-span-4 space-y-3">
                        <Card className="py-0 gap-0 overflow-hidden">
                            <div className="flex items-center justify-between border-b bg-muted/20 px-3.5 py-2">
                                <h2 className="text-sm font-semibold text-foreground">Ringkasan Pembayaran</h2>
                            </div>
                            <CardContent className="p-4 space-y-3.5">
                                <CustomerPicker
                                    initialCustomers={customers}
                                    selectedCustomerId={selectedCustomerId}
                                    onSelectCustomer={setSelectedCustomerId}
                                    onModalToggle={setCustomerModalOpen}
                                />

                                {/* Penawaran Tebus Murah (Maks. 1 per struk) */}
                                {(serverPricing?.tebus_murah_offers?.length ?? 0) > 0 && (
                                    <div className="rounded-lg border border-amber-300/80 bg-amber-50/60 dark:border-amber-800 dark:bg-amber-950/30 p-3 space-y-2">
                                        <div className="flex items-center justify-between gap-2">
                                            <span className="text-xs font-semibold text-amber-800 dark:text-amber-200 flex items-center gap-1.5">
                                                <Gift className="h-3.5 w-3.5" />
                                                Penawaran Tebus Murah (Maks. 1/Struk)
                                            </span>
                                        </div>
                                        <div className="space-y-1.5">
                                            {(serverPricing?.tebus_murah_offers ?? []).map((offer) => (
                                                <div
                                                    key={offer.promotion_id}
                                                    className="flex items-center justify-between gap-2 rounded-md border bg-background/90 px-2.5 py-2"
                                                >
                                                    <div className="min-w-0">
                                                        <p className="text-xs font-medium text-foreground truncate">
                                                            {offer.reward_product_name}
                                                        </p>
                                                        <p className="font-mono text-[11px] text-muted-foreground">
                                                            <span className="line-through mr-1">
                                                                {formatRupiah(offer.normal_price)}
                                                            </span>
                                                            <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                                                                {formatRupiah(offer.special_price)}
                                                            </span>
                                                        </p>
                                                    </div>
                                                    {offer.is_applied ? (
                                                        <Badge variant="success" className="text-[10px] shrink-0">
                                                            Terpasang
                                                        </Badge>
                                                    ) : (
                                                        <Button
                                                            type="button"
                                                            size="sm"
                                                            variant="outline"
                                                            onClick={() => void handleRedeemTebusMurah(offer)}
                                                            className="h-7 px-2.5 text-xs shrink-0 cursor-pointer"
                                                        >
                                                            Tebus
                                                        </Button>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Voucher / Kode Promo (mendukung > 1 voucher) */}
                                <div className="space-y-1.5">
                                    <Label htmlFor="voucher-code-input" className="text-xs flex items-center gap-1.5">
                                        <TicketPercent className="h-3.5 w-3.5 text-primary" />
                                        Voucher / Kode Promo
                                        {appliedVouchers.length > 0 && (
                                            <Badge variant="secondary" className="font-mono text-[10px] h-4 px-1.5">
                                                {appliedVouchers.length} terpasang
                                            </Badge>
                                        )}
                                    </Label>
                                    <form onSubmit={handleApplyVoucher} className="flex gap-1.5">
                                        <Input
                                            id="voucher-code-input"
                                            value={voucherInput}
                                            onChange={(e) => {
                                                setVoucherInput(e.target.value.toUpperCase())
                                                if (voucherError) setVoucherError(null)
                                            }}
                                            placeholder="Scan / ketik kode voucher..."
                                            disabled={cart.length === 0 || isApplyingVoucher}
                                            className="h-9 font-mono text-xs uppercase"
                                        />
                                        <Button
                                            type="submit"
                                            variant="outline"
                                            size="sm"
                                            disabled={cart.length === 0 || !voucherInput.trim() || isApplyingVoucher}
                                            className="h-9 px-3 shrink-0 cursor-pointer"
                                        >
                                            {isApplyingVoucher ? '...' : 'Pakai'}
                                        </Button>
                                    </form>
                                    {appliedVouchers.length > 0 && (
                                        <div className="space-y-1.5 pt-1">
                                            {appliedVouchers.map((v) => {
                                                const serverVoucher = serverPricing?.vouchers?.find(
                                                    (sv) => sv.code.toUpperCase() === v.code.toUpperCase()
                                                )
                                                const displayDiscount =
                                                    serverVoucher?.discount_amount ?? v.discount_amount
                                                const displayName = serverVoucher?.name ?? v.name

                                                return (
                                                    <div
                                                        key={v.code}
                                                        className="flex items-center justify-between gap-2 rounded-md border border-emerald-300 bg-emerald-50/70 dark:border-emerald-800 dark:bg-emerald-950/40 px-2.5 py-1.5"
                                                    >
                                                        <div className="min-w-0">
                                                            <div className="flex items-center gap-1.5">
                                                                <Badge variant="success" className="font-mono text-[10px]">
                                                                    {v.code}
                                                                </Badge>
                                                                <span className="font-mono text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                                                                    -{formatRupiah(displayDiscount)}
                                                                </span>
                                                            </div>
                                                            {displayName && (
                                                                <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                                                                    {displayName}
                                                                </p>
                                                            )}
                                                        </div>
                                                        <Button
                                                            type="button"
                                                            variant="ghost"
                                                            size="icon"
                                                            onClick={() => void handleReleaseVoucher(v.code)}
                                                            className="h-6 w-6 shrink-0 text-muted-foreground hover:text-destructive cursor-pointer"
                                                            title={`Lepas voucher ${v.code}`}
                                                        >
                                                            <X className="h-3.5 w-3.5" />
                                                        </Button>
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    )}
                                    {voucherError && (
                                        <p className="text-[11px] text-destructive">{voucherError}</p>
                                    )}
                                </div>

                                <div className="space-y-1.5">
                                    <Label htmlFor="tx-discount" className="text-xs">
                                        Diskon Nota Manual (Rp)
                                    </Label>
                                    <Input
                                        id="tx-discount"
                                        type="number"
                                        min={0}
                                        step="100"
                                        value={transactionDiscount || ''}
                                        placeholder="0"
                                        onChange={(e) => setTransactionDiscount(Math.max(0, Number(e.target.value) || 0))}
                                        className="h-9 font-mono text-sm"
                                    />
                                    {summary.manualDiscountTotal > policyRules.manual_discount_pin_threshold &&
                                        !policyRules.is_privileged && (
                                            <p className="text-[11px] text-amber-600 dark:text-amber-400">
                                                Diskon manual memerlukan otorisasi PIN Supervisor saat bayar.
                                            </p>
                                        )}
                                </div>

                                <div className="space-y-2 border-t pt-3 text-sm">
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">Subtotal</span>
                                        <span className="font-mono font-medium">{formatRupiah(summary.grossSubtotal)}</span>
                                    </div>
                                    {summary.autoDiscountTotal > 0 && (
                                        <div className="flex justify-between text-emerald-600 dark:text-emerald-400">
                                            <span>Hemat Grosir / Promo Item</span>
                                            <span className="font-mono">-{formatRupiah(summary.autoDiscountTotal)}</span>
                                        </div>
                                    )}
                                    {summary.transactionPromoDiscountTotal > 0 && (
                                        <div className="flex justify-between text-emerald-600 dark:text-emerald-400">
                                            <span className="truncate pr-2">
                                                {serverPricing?.transaction_promotion?.name ?? 'Promo Transaksi / Tebus Murah'}
                                            </span>
                                            <span className="font-mono shrink-0">
                                                -{formatRupiah(summary.transactionPromoDiscountTotal)}
                                            </span>
                                        </div>
                                    )}
                                    {summary.voucherDiscountTotal > 0 && (
                                        <div className="flex justify-between text-emerald-600 dark:text-emerald-400">
                                            <span className="truncate pr-2">
                                                Voucher
                                                {appliedVouchers.length > 0
                                                    ? ` (${appliedVouchers.map((v) => v.code).join(', ')})`
                                                    : ''}
                                            </span>
                                            <span className="font-mono shrink-0">-{formatRupiah(summary.voucherDiscountTotal)}</span>
                                        </div>
                                    )}
                                    {summary.cashbackTotal > 0 && (
                                        <div className="flex justify-between text-xs text-blue-600 dark:text-blue-400">
                                            <span>Estimasi Cashback</span>
                                            <span className="font-mono">+{formatRupiah(summary.cashbackTotal)}</span>
                                        </div>
                                    )}
                                    {summary.manualDiscountTotal > 0 && (
                                        <div className="flex justify-between text-rose-600 dark:text-rose-400">
                                            <span>Diskon Manual</span>
                                            <span className="font-mono">-{formatRupiah(summary.manualDiscountTotal)}</span>
                                        </div>
                                    )}
                                    {(storeSettings?.default_tax_rate ?? 0) > 0 && (
                                        <>
                                            {summary.hasTaxExemptItems && (
                                                <>
                                                    <div className="flex justify-between text-xs text-muted-foreground">
                                                        <span>DPP (Kena PPN)</span>
                                                        <span className="font-mono">{formatRupiah(summary.taxableAmount)}</span>
                                                    </div>
                                                    <div className="flex justify-between text-xs text-emerald-600 dark:text-emerald-400">
                                                        <span>Subtotal Bebas PPN</span>
                                                        <span className="font-mono">{formatRupiah(summary.taxExemptAmount)}</span>
                                                    </div>
                                                </>
                                            )}
                                            <div className="flex justify-between">
                                                <span className="text-muted-foreground">
                                                    PPN ({storeSettings.default_tax_rate}%)
                                                </span>
                                                <span className="font-mono">{formatRupiah(summary.taxAmount)}</span>
                                            </div>
                                        </>
                                    )}
                                    {summary.roundingAmount !== 0 && (
                                        <div className="flex justify-between">
                                            <span className="text-muted-foreground">Pembulatan</span>
                                            <span className="font-mono">
                                                {summary.roundingAmount > 0 ? '+' : ''}
                                                {formatRupiah(summary.roundingAmount)}
                                            </span>
                                        </div>
                                    )}
                                    <div className="flex justify-between items-baseline border-t pt-3">
                                        <span className="font-semibold text-base text-foreground">Grand Total</span>
                                        <span className="font-mono text-2xl font-bold text-primary">
                                            {formatRupiah(summary.grandTotal)}
                                        </span>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-2 pt-2">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        disabled={cart.length === 0 || isSubmitting}
                                        onClick={() => setHoldPromptOpen(true)}
                                        className="h-11 gap-1.5 cursor-pointer"
                                    >
                                        <PauseCircle className="h-4 w-4" />
                                        Tahan (F4)
                                    </Button>
                                    <Button
                                        type="button"
                                        disabled={cart.length === 0 || isSubmitting}
                                        onClick={() => {
                                            setPaymentError(null)
                                            setPaymentOpen(true)
                                        }}
                                        className="h-11 gap-1.5 font-semibold cursor-pointer"
                                    >
                                        <CreditCard className="h-4 w-4" />
                                        Bayar (F8)
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </div>

            {/* Hold Bill Label Prompt Dialog */}
            <Dialog open={holdPromptOpen} onOpenChange={setHoldPromptOpen}>
                <DialogContent className="max-w-md max-h-[85vh] flex flex-col p-0 gap-0 overflow-hidden">
                    <DialogHeader className="p-6 pb-4 border-b shrink-0">
                        <DialogTitle>Tahan Transaksi (Hold Bill)</DialogTitle>
                        <DialogDescription>
                            Simpan keranjang sementara tanpa mengambil nomor invoice resmi.
                        </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleHoldBill} className="flex flex-col flex-1 overflow-hidden">
                        <div className="flex-1 overflow-y-auto overflow-x-hidden p-6 space-y-3">
                            <div className="space-y-1.5">
                                <Label htmlFor="hold-label-input">Catatan / Nama Pembeli (Opsional)</Label>
                                <Input
                                    id="hold-label-input"
                                    value={holdLabel}
                                    onChange={(e) => setHoldLabel(e.target.value)}
                                    placeholder="Contoh: Ibu Ani — ambil tambahan barang"
                                    autoFocus
                                    className="h-9"
                                />
                            </div>
                        </div>
                        <DialogFooter className="p-6 pt-4 border-t shrink-0 flex items-center justify-end gap-2 bg-muted/20">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => setHoldPromptOpen(false)}
                                className="cursor-pointer"
                            >
                                Batal
                            </Button>
                            <Button type="submit" disabled={isSubmitting} className="cursor-pointer">
                                {isSubmitting ? 'Menyimpan...' : 'Simpan Hold Bill'}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            <ProductSearchDialog
                open={searchOpen}
                onOpenChange={setSearchOpen}
                onSelectProduct={addProductToCart}
            />

            <CheckPromoDialog
                open={checkPromoOpen}
                onOpenChange={setCheckPromoOpen}
                onAddToCart={(product, unitId) => {
                    addProductToCart(product, unitId)
                    toast.success(`${product.name} ditambahkan ke keranjang.`)
                }}
            />

            <PaymentDialog
                open={paymentOpen}
                onOpenChange={setPaymentOpen}
                grandTotal={summary.grandTotal}
                paymentMethods={paymentMethods}
                financialAccounts={financialAccounts}
                donationProducts={donationProducts}
                isSubmitting={isSubmitting}
                errorMessage={paymentError}
                onPreviewPaymentPromo={handlePreviewPaymentPromo}
                onSubmitPayment={handlePaymentSubmit}
            />

            <HeldBillsDialog
                open={heldOpen}
                onOpenChange={setHeldOpen}
                heldTransactions={heldList}
                onResume={handleResumeHeld}
                onDelete={(held) => void handleDeleteHeld(held)}
                isBusy={isSubmitting}
            />

            <SupervisorPinDialog
                open={pinDialogOpen}
                onOpenChange={setPinDialogOpen}
                title="Otorisasi Diskon Manual"
                description="Masukkan PIN Supervisor / Admin untuk menyetujui diskon manual pada transaksi ini."
                error={pinError}
                isSubmitting={isSubmitting}
                onConfirm={handlePinConfirm}
            />

            <CheckoutSuccessDialog
                open={successOpen}
                onOpenChange={setSuccessOpen}
                receipt={lastReceipt}
                paperWidth={paperWidth}
                onPaperWidthChange={setPaperWidth}
                onPrint={() => window.print()}
                onNewTransaction={() => {
                    setSuccessOpen(false)
                    focusBarcode()
                }}
            />

            {lastReceipt && <ReceiptPrint receipt={lastReceipt} paperWidth={paperWidth} />}
        </>
    )
}

Terminal.layout = (page: React.ReactNode) => <AuthenticatedLayout>{page}</AuthenticatedLayout>

export default Terminal

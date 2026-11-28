import React, { useEffect, useRef, useState } from 'react'
import { toast } from 'react-toastify'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Award, Loader2, Phone, Search, User, UserPlus, X } from 'lucide-react'
import CustomerController from '@/actions/App/Http/Controllers/CustomerController'
import { formatNumber } from '@/lib/utils'
import type { PosCustomerOption } from '@/types'
import { getXsrfToken } from './posUtils'

interface CustomerPickerProps {
    initialCustomers: PosCustomerOption[]
    selectedCustomerId: string
    onSelectCustomer: (customerId: string) => void
    onModalToggle?: (open: boolean) => void
}

export function CustomerPicker({
    initialCustomers,
    selectedCustomerId,
    onSelectCustomer,
    onModalToggle,
}: CustomerPickerProps) {
    const [knownCustomers, setKnownCustomers] = useState<PosCustomerOption[]>(initialCustomers)
    const [query, setQuery] = useState('')
    const [results, setResults] = useState<PosCustomerOption[]>(initialCustomers.slice(0, 10))
    const [dropdownOpen, setDropdownOpen] = useState(false)
    const [isSearching, setIsSearching] = useState(false)

    // Quick-create modal state
    const [quickAddOpen, setQuickAddOpen] = useState(false)
    const [newName, setNewName] = useState('')
    const [newPhone, setNewPhone] = useState('')
    const [newEmail, setNewEmail] = useState('')
    const [newAddress, setNewAddress] = useState('')
    const [isCreating, setIsCreating] = useState(false)
    const [createError, setCreateError] = useState<string | null>(null)

    const containerRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        setKnownCustomers((prev) => {
            const merged = new Map<number, PosCustomerOption>()
            for (const c of prev) merged.set(c.id, c)
            for (const c of initialCustomers) merged.set(c.id, c)
            return Array.from(merged.values())
        })
    }, [initialCustomers])

    useEffect(() => {
        onModalToggle?.(quickAddOpen)
    }, [quickAddOpen, onModalToggle])

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setDropdownOpen(false)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    useEffect(() => {
        if (!dropdownOpen) return

        const timer = window.setTimeout(async () => {
            setIsSearching(true)
            try {
                const url = `${CustomerController.search.url()}?q=${encodeURIComponent(query.trim())}&limit=15`
                const res = await fetch(url, {
                    headers: { Accept: 'application/json' },
                })
                if (res.ok) {
                    const data = (await res.json()) as { customers: PosCustomerOption[] }
                    const fetched = data.customers ?? []
                    setResults(fetched)
                    setKnownCustomers((prev) => {
                        const map = new Map<number, PosCustomerOption>()
                        for (const c of prev) map.set(c.id, c)
                        for (const c of fetched) map.set(c.id, c)
                        return Array.from(map.values())
                    })
                }
            } finally {
                setIsSearching(false)
            }
        }, 250)

        return () => window.clearTimeout(timer)
    }, [query, dropdownOpen])

    const selectedCustomer =
        selectedCustomerId !== 'guest'
            ? knownCustomers.find((c) => String(c.id) === selectedCustomerId) ?? null
            : null

    const handleQuickCreate = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!newName.trim() || isCreating) return

        setIsCreating(true)
        setCreateError(null)

        try {
            const res = await fetch(CustomerController.store.url(), {
                method: 'POST',
                headers: {
                    Accept: 'application/json',
                    'Content-Type': 'application/json',
                    'X-XSRF-TOKEN': getXsrfToken(),
                },
                body: JSON.stringify({
                    name: newName.trim(),
                    phone: newPhone.trim() || null,
                    email: newEmail.trim() || null,
                    address: newAddress.trim() || null,
                    is_active: true,
                }),
            })

            const body = (await res.json()) as {
                message?: string
                customer?: PosCustomerOption
                errors?: Record<string, string[]>
            }

            if (!res.ok) {
                const firstErr = body.errors
                    ? Object.values(body.errors).flat()[0]
                    : body.message ?? 'Gagal mendaftarkan member baru.'
                setCreateError(firstErr)
                return
            }

            if (body.customer) {
                const created = body.customer
                setKnownCustomers((prev) => [created, ...prev.filter((c) => c.id !== created.id)])
                onSelectCustomer(String(created.id))
                toast.success(body.message ?? `Member ${created.name} berhasil ditambahkan.`)
            }

            setNewName('')
            setNewPhone('')
            setNewEmail('')
            setNewAddress('')
            setQuickAddOpen(false)
            setDropdownOpen(false)
        } catch {
            setCreateError('Terjadi kesalahan jaringan saat mendaftarkan member.')
        } finally {
            setIsCreating(false)
        }
    }

    return (
        <div className="space-y-2" ref={containerRef}>
            <div className="flex items-center justify-between gap-2">
                <Label className="text-xs">Pelanggan / Member (Opsional)</Label>
                <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                        setCreateError(null)
                        setQuickAddOpen(true)
                    }}
                    className="h-6 px-2 text-[11px] gap-1 text-primary hover:text-primary cursor-pointer"
                >
                    <UserPlus className="h-3 w-3" />
                    + Member Cepat
                </Button>
            </div>

            {selectedCustomer ? (
                <div className="flex items-center justify-between gap-2 rounded-md border border-primary/30 bg-primary/5 px-3 py-2">
                    <div className="min-w-0 space-y-0.5">
                        <div className="flex items-center gap-1.5">
                            <User className="h-3.5 w-3.5 text-primary shrink-0" />
                            <span className="text-xs font-semibold text-foreground truncate">
                                {selectedCustomer.name}
                            </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground font-mono">
                            {selectedCustomer.member_code && <span>{selectedCustomer.member_code}</span>}
                            {selectedCustomer.phone && (
                                <span className="inline-flex items-center gap-0.5">
                                    <Phone className="h-2.5 w-2.5" />
                                    {selectedCustomer.phone}
                                </span>
                            )}
                            <Badge
                                variant="outline"
                                className="h-4 px-1.5 py-0 text-[10px] gap-0.5 bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800"
                            >
                                <Award className="h-2.5 w-2.5" />
                                {formatNumber(selectedCustomer.points ?? 0)} poin
                            </Badge>
                        </div>
                    </div>
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                            onSelectCustomer('guest')
                            setQuery('')
                        }}
                        className="h-7 w-7 shrink-0 text-muted-foreground hover:text-foreground cursor-pointer"
                        title="Kembali ke Pelanggan Umum"
                    >
                        <X className="h-3.5 w-3.5" />
                    </Button>
                </div>
            ) : (
                <div className="relative">
                    <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                    <Input
                        value={query}
                        onFocus={() => setDropdownOpen(true)}
                        onChange={(e) => {
                            setQuery(e.target.value)
                            setDropdownOpen(true)
                        }}
                        placeholder="Cari No. HP / Kode Member / Nama..."
                        className="h-9 pl-8 pr-8 text-xs"
                    />
                    {isSearching ? (
                        <Loader2 className="absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 animate-spin text-muted-foreground" />
                    ) : query ? (
                        <button
                            type="button"
                            onClick={() => setQuery('')}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
                        >
                            <X className="h-3.5 w-3.5" />
                        </button>
                    ) : null}

                    {dropdownOpen && (
                        <div className="absolute z-30 mt-1 w-full rounded-md border bg-popover shadow-md max-h-56 overflow-y-auto">
                            <button
                                type="button"
                                onClick={() => {
                                    onSelectCustomer('guest')
                                    setDropdownOpen(false)
                                    setQuery('')
                                }}
                                className="w-full px-3 py-2 text-left text-xs hover:bg-muted/60 border-b text-muted-foreground flex items-center justify-between cursor-pointer"
                            >
                                <span>Pelanggan Umum (Tanpa Member)</span>
                            </button>

                            {results.length === 0 && !isSearching ? (
                                <div className="px-3 py-4 text-center text-xs text-muted-foreground">
                                    Member tidak ditemukan.
                                </div>
                            ) : (
                                results.map((cust) => (
                                    <button
                                        key={cust.id}
                                        type="button"
                                        onClick={() => {
                                            onSelectCustomer(String(cust.id))
                                            setDropdownOpen(false)
                                            setQuery('')
                                        }}
                                        className="w-full px-3 py-2 text-left hover:bg-muted/60 flex items-center justify-between gap-2 cursor-pointer border-b last:border-b-0"
                                    >
                                        <div className="min-w-0">
                                            <p className="text-xs font-medium text-foreground truncate">
                                                {cust.name}
                                            </p>
                                            <p className="text-[10px] font-mono text-muted-foreground truncate">
                                                {cust.member_code || '-'}
                                                {cust.phone ? ` • ${cust.phone}` : ''}
                                            </p>
                                        </div>
                                        <Badge
                                            variant="secondary"
                                            className="font-mono text-[10px] px-1.5 py-0 shrink-0"
                                        >
                                            {formatNumber(cust.points ?? 0)} pt
                                        </Badge>
                                    </button>
                                ))
                            )}
                        </div>
                    )}
                </div>
            )}

            <Dialog open={quickAddOpen} onOpenChange={setQuickAddOpen}>
                <DialogContent className="sm:max-w-md max-h-[85vh] flex flex-col p-0 gap-0 overflow-hidden">
                    <form onSubmit={handleQuickCreate} className="flex flex-col flex-1 min-h-0 overflow-hidden">
                        <DialogHeader className="p-6 pb-4 border-b shrink-0">
                            <DialogTitle className="flex items-center gap-2 text-base">
                                <UserPlus className="h-4 w-4 text-primary" />
                                Tambah Member Cepat
                            </DialogTitle>
                            <DialogDescription className="text-xs">
                                Daftarkan member baru langsung dari meja kasir tanpa mengosongkan keranjang belanja.
                            </DialogDescription>
                        </DialogHeader>

                        <div className="flex-1 overflow-y-auto overflow-x-hidden p-6 space-y-3.5">
                            {createError && (
                                <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                                    {createError}
                                </div>
                            )}

                            <div>
                                <Label htmlFor="quick-cust-name" className="text-xs">
                                    Nama Pelanggan <span className="text-destructive">*</span>
                                </Label>
                                <Input
                                    id="quick-cust-name"
                                    value={newName}
                                    onChange={(e) => setNewName(e.target.value)}
                                    placeholder="Nama lengkap member"
                                    className="mt-1 h-9 text-xs"
                                    required
                                />
                            </div>

                            <div>
                                <Label htmlFor="quick-cust-phone" className="text-xs">
                                    Nomor HP
                                </Label>
                                <Input
                                    id="quick-cust-phone"
                                    value={newPhone}
                                    onChange={(e) => setNewPhone(e.target.value)}
                                    placeholder="081234567890"
                                    className="mt-1 h-9 font-mono text-xs"
                                />
                            </div>

                            <div>
                                <Label htmlFor="quick-cust-email" className="text-xs">
                                    Email (Opsional)
                                </Label>
                                <Input
                                    id="quick-cust-email"
                                    type="email"
                                    value={newEmail}
                                    onChange={(e) => setNewEmail(e.target.value)}
                                    placeholder="pelanggan@email.com"
                                    className="mt-1 h-9 text-xs"
                                />
                            </div>

                            <div>
                                <Label htmlFor="quick-cust-address" className="text-xs">
                                    Alamat (Opsional)
                                </Label>
                                <textarea
                                    id="quick-cust-address"
                                    rows={2}
                                    value={newAddress}
                                    onChange={(e) => setNewAddress(e.target.value)}
                                    placeholder="Alamat singkat"
                                    className="w-full mt-1 rounded-md border border-input bg-background p-2 text-xs shadow-xs"
                                />
                            </div>
                        </div>

                        <DialogFooter className="p-6 pt-4 border-t bg-muted/20 shrink-0 flex items-center justify-end gap-2">
                            <DialogClose
                                render={
                                    <Button type="button" variant="outline" size="sm" disabled={isCreating}>
                                        Batal
                                    </Button>
                                }
                            />
                            <Button type="submit" size="sm" disabled={isCreating || !newName.trim()}>
                                {isCreating ? 'Menyimpan...' : 'Simpan & Pilih'}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    )
}

export default CustomerPicker

import React, { useId, useMemo, useState } from 'react'
import AsyncSelect from 'react-select/async'
import { useDebouncedCallback } from 'use-debounce'
import { cn } from '@/lib/utils'
import SupplierController from '@/actions/App/Http/Controllers/SupplierController'
import type { ActionMeta, SingleValue } from 'react-select'

export interface SupplierOption {
    value: number
    label: string
    id?: number
    name?: string
    code?: string | null
    payment_term_days?: number
    phone?: string
}

export interface SelectSupplierAsyncProps {
    /** Nilai terpilih (berupa ID supplier atau objek SupplierOption) */
    value?: number | null | SupplierOption
    /** Nilai default awal jika uncontrolled */
    defaultValue?: number | null | SupplierOption
    /** Opsi terpilih awal lengkap dengan label jika hanya memiliki ID */
    initialOption?: SupplierOption | null
    /**
     * Opsi default yang langsung ditampilkan tanpa request awal.
     * Bisa diisi array supplier dari props atau boolean true untuk fetch otomatis saat komponen dimuat.
     */
    defaultOptions?: SupplierOption[] | boolean
    /** Hanya ambil supplier yang berstatus aktif (default: false) */
    onlyActive?: boolean
    /** Callback saat pilihan berubah */
    onChange?: (value: number | null, option: SupplierOption | null) => void
    /** Placeholder teks */
    placeholder?: string
    /** Apakah opsi bisa di-clear */
    isClearable?: boolean
    /** Status disabled */
    disabled?: boolean
    /** Pesan error validasi */
    error?: string
    /** Custom class untuk wrapper container */
    className?: string
    /** Custom class untuk kontrol input */
    controlClassName?: string
    /** HTML ID untuk aksesibilitas form label */
    id?: string
    /** HTML Name untuk form */
    name?: string
    /** Wajib diisi */
    required?: boolean
}

/**
 * Fetch supplier dari backend POS (/pos/suppliers/search)
 */
async function fetchSuppliersApi(search: string, onlyActive: boolean = false): Promise<SupplierOption[]> {
    try {
        const url = SupplierController.search.url({
            query: {
                ...(search.trim() ? { search: search.trim() } : {}),
                only_active: onlyActive,
            },
        })

        const response = await fetch(url, {
            method: 'GET',
            headers: {
                Accept: 'application/json',
                'X-Requested-With': 'XMLHttpRequest',
            },
            credentials: 'same-origin',
        })

        if (!response.ok) {
            return []
        }

        const data = await response.json()
        return Array.isArray(data) ? data : []
    } catch {
        return []
    }
}

export default function SelectSupplierAsync({
    value,
    defaultValue,
    initialOption = null,
    defaultOptions = true,
    onlyActive = false,
    onChange,
    placeholder = 'Pilih supplier...',
    isClearable = true,
    disabled = false,
    error,
    className,
    controlClassName,
    id,
    name,
    required = false,
}: SelectSupplierAsyncProps) {
    const generatedId = useId()
    const selectId = id || generatedId

    // Internal state untuk uncontrolled atau sinkronisasi option label
    const [internalOption, setInternalOption] = useState<SupplierOption | null>(() => {
        if (initialOption) return initialOption
        if (typeof defaultValue === 'object' && defaultValue !== null) return defaultValue
        if (typeof value === 'object' && value !== null) return value
        return null
    })

    // Debounced search ketika user mengetik
    const debouncedSearch = useDebouncedCallback(
        (query: string, callback: (options: SupplierOption[]) => void) => {
            fetchSuppliersApi(query, onlyActive).then((options) => callback(options))
        },
        300
    )

    // loadOptions untuk react-select/async
    const handleLoadOptions = (
        inputValue: string,
        callback: (options: SupplierOption[]) => void
    ) => {
        if (!inputValue.trim()) {
            fetchSuppliersApi('', onlyActive).then((options) => callback(options))
            return
        }

        debouncedSearch(inputValue, callback)
    }

    // Resolusi value yang tepat untuk react-select
    const resolvedValue = useMemo<SupplierOption | null>(() => {
        if (value === undefined) {
            return internalOption
        }
        if (value === null) {
            return null
        }
        if (typeof value === 'object') {
            return value
        }

        // Jika value berupa ID (number)
        if (internalOption && internalOption.value === value) {
            return internalOption
        }
        if (initialOption && initialOption.value === value) {
            return initialOption
        }
        if (Array.isArray(defaultOptions)) {
            const found = defaultOptions.find((opt) => opt.value === value)
            if (found) return found
        }

        return internalOption?.value === value ? internalOption : null
    }, [value, internalOption, initialOption, defaultOptions])

    const handleChange = (
        selected: SingleValue<SupplierOption>,
        _actionMeta: ActionMeta<SupplierOption>
    ) => {
        setInternalOption(selected)
        if (onChange) {
            onChange(selected ? selected.value : null, selected)
        }
    }

    return (
        <div className={cn('w-full', className)}>
            <AsyncSelect<SupplierOption, false>
                instanceId={selectId}
                inputId={selectId}
                name={name}
                cacheOptions
                defaultOptions={defaultOptions}
                loadOptions={handleLoadOptions}
                value={resolvedValue}
                onChange={handleChange}
                isDisabled={disabled}
                isClearable={isClearable}
                placeholder={placeholder}
                menuPortalTarget={typeof document !== 'undefined' ? document.body : undefined}
                styles={{
                    menuPortal: (base) => ({ ...base, zIndex: 9999 }),
                }}
                noOptionsMessage={({ inputValue }) =>
                    inputValue
                        ? `Tidak ada supplier untuk "${inputValue}"`
                        : 'Tidak ada supplier tersedia'
                }
                loadingMessage={() => 'Mencari supplier...'}
                unstyled
                classNames={{
                    control: ({ isFocused, isDisabled }) =>
                        cn(
                            'flex h-9 min-h-9 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs transition-colors overflow-hidden',
                            isFocused && 'border-primary ring-2 ring-primary/20 outline-none',
                            isDisabled && 'cursor-not-allowed opacity-50 bg-muted/30',
                            error && 'border-destructive focus-visible:ring-destructive/30',
                            controlClassName
                        ),
                    valueContainer: () => 'flex flex-nowrap items-center gap-1 p-0 flex-1 min-w-0 overflow-hidden',
                    input: () => 'text-foreground text-sm m-0 p-0 min-w-0',
                    placeholder: () => 'text-muted-foreground text-sm truncate',
                    singleValue: () => 'text-foreground text-sm font-normal truncate min-w-0 max-w-full',
                    menu: () =>
                        'mt-1.5 overflow-hidden rounded-md border border-border bg-popover text-popover-foreground shadow-md z-50 animate-in fade-in-0 zoom-in-95',
                    menuList: () => 'p-1 max-h-60 overflow-y-auto text-sm',
                    option: ({ isFocused, isSelected }) =>
                        cn(
                            'relative flex cursor-pointer select-none items-center rounded-sm px-2.5 py-1.5 text-sm outline-none transition-colors',
                            isSelected && 'bg-primary text-primary-foreground font-medium',
                            !isSelected && isFocused && 'bg-accent text-accent-foreground',
                            !isSelected && !isFocused && 'text-foreground'
                        ),
                    noOptionsMessage: () => 'text-muted-foreground text-sm py-3 text-center',
                    loadingMessage: () => 'text-muted-foreground text-sm py-3 text-center',
                    indicatorsContainer: () => 'flex items-center gap-1 text-muted-foreground shrink-0',
                    dropdownIndicator: ({ isFocused }) =>
                        cn(
                            'p-0.5 cursor-pointer hover:text-foreground transition-colors',
                            isFocused && 'text-foreground'
                        ),
                    clearIndicator: () =>
                        'p-0.5 cursor-pointer hover:text-destructive transition-colors',
                    loadingIndicator: () => 'text-primary p-0.5 animate-spin',
                }}
            />

            {required && (
                <input
                    tabIndex={-1}
                    autoComplete="off"
                    style={{
                        opacity: 0,
                        width: 0,
                        height: 0,
                        position: 'absolute',
                        pointerEvents: 'none',
                    }}
                    value={resolvedValue ? resolvedValue.value : ''}
                    onChange={() => { }}
                    required={required}
                />
            )}

            {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
        </div>
    )
}

export { SelectSupplierAsync }

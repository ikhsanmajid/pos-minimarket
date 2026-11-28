import React, { useId, useMemo, useState } from 'react'
import AsyncSelect from 'react-select/async'
import { useDebouncedCallback } from 'use-debounce'
import { cn } from '@/lib/utils'
import reports from '@/routes/pos/reports'
import type { ActionMeta, SingleValue } from 'react-select'

export interface CashierOption {
    value: number
    label: string
}

export interface SelectCashierAsyncProps {
    value?: number | null | CashierOption
    defaultValue?: number | null | CashierOption
    initialOption?: CashierOption | null
    defaultOptions?: CashierOption[] | boolean
    onChange?: (value: number | null, option: CashierOption | null) => void
    placeholder?: string
    isClearable?: boolean
    disabled?: boolean
    className?: string
    controlClassName?: string
    id?: string
    name?: string
}

async function fetchCashiersApi(search: string): Promise<CashierOption[]> {
    try {
        const url = reports.cashiers.search.url({
            query: search.trim() ? { search: search.trim() } : undefined,
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

export default function SelectCashierAsync({
    value,
    defaultValue,
    initialOption = null,
    defaultOptions = true,
    onChange,
    placeholder = 'Semua Kasir',
    isClearable = true,
    disabled = false,
    className,
    controlClassName,
    id,
    name,
}: SelectCashierAsyncProps) {
    const generatedId = useId()
    const selectId = id || generatedId

    const [internalOption, setInternalOption] = useState<CashierOption | null>(() => {
        if (initialOption) return initialOption
        if (typeof defaultValue === 'object' && defaultValue !== null) return defaultValue
        if (typeof value === 'object' && value !== null) return value
        return null
    })

    const debouncedSearch = useDebouncedCallback(
        (query: string, callback: (options: CashierOption[]) => void) => {
            fetchCashiersApi(query).then((options) => callback(options))
        },
        300
    )

    const handleLoadOptions = (
        inputValue: string,
        callback: (options: CashierOption[]) => void
    ) => {
        if (!inputValue.trim()) {
            fetchCashiersApi('').then((options) => callback(options))
            return
        }
        debouncedSearch(inputValue, callback)
    }

    const resolvedValue = useMemo<CashierOption | null>(() => {
        if (value === undefined) return internalOption
        if (value === null) return null
        if (typeof value === 'object') return value
        if (internalOption && internalOption.value === value) return internalOption
        if (initialOption && initialOption.value === value) return initialOption
        if (Array.isArray(defaultOptions)) {
            const found = defaultOptions.find((opt) => opt.value === value)
            if (found) return found
        }
        return internalOption?.value === value ? internalOption : null
    }, [value, internalOption, initialOption, defaultOptions])

    const handleChange = (
        selected: SingleValue<CashierOption>,
        _actionMeta: ActionMeta<CashierOption>
    ) => {
        setInternalOption(selected)
        if (onChange) {
            onChange(selected ? selected.value : null, selected)
        }
    }

    return (
        <div className={cn('w-full', className)}>
            <AsyncSelect<CashierOption, false>
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
                    inputValue ? `Tidak ada kasir untuk "${inputValue}"` : 'Tidak ada kasir tersedia'
                }
                loadingMessage={() => 'Mencari kasir...'}
                unstyled
                classNames={{
                    control: ({ isFocused, isDisabled }) =>
                        cn(
                            'flex h-9 min-h-9 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs transition-colors overflow-hidden',
                            isFocused && 'border-primary ring-2 ring-primary/20 outline-none',
                            isDisabled && 'cursor-not-allowed opacity-50 bg-muted/30',
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
        </div>
    )
}

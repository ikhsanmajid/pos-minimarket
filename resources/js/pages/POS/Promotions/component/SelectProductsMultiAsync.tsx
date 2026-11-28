import React, { useId } from 'react'
import AsyncSelect from 'react-select/async'
import { useDebouncedCallback } from 'use-debounce'
import type { MultiValue } from 'react-select'
import { cn } from '@/lib/utils'
import ProductController from '@/actions/App/Http/Controllers/ProductController'

export interface PromotionProductOption {
    value: number
    label: string
    id: number
    name: string
    barcode: string
    sell_price?: number
    category_name?: string
    is_donation?: boolean
}

interface SelectProductsMultiAsyncProps {
    value: PromotionProductOption[]
    onChange: (options: PromotionProductOption[]) => void
    placeholder?: string
    disabled?: boolean
    error?: string
    className?: string
}

async function fetchEligibleProducts(search: string): Promise<PromotionProductOption[]> {
    try {
        const url = ProductController.search.url({
            query: {
                ...(search.trim() ? { search: search.trim() } : {}),
                only_active: true,
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

        const data = (await response.json()) as PromotionProductOption[]
        if (!Array.isArray(data)) {
            return []
        }

        return data
            .filter((item) => !item.is_donation)
            .map((item) => ({
                value: item.id,
                label: `${item.name} (${item.barcode})`,
                id: item.id,
                name: item.name,
                barcode: item.barcode,
                sell_price: item.sell_price,
                category_name: item.category_name,
            }))
    } catch {
        return []
    }
}

export function SelectProductsMultiAsync({
    value,
    onChange,
    placeholder = 'Ketik nama atau barcode produk untuk menambahkan...',
    disabled = false,
    error,
    className,
}: SelectProductsMultiAsyncProps) {
    const selectId = useId()

    const debouncedSearch = useDebouncedCallback(
        (query: string, callback: (options: PromotionProductOption[]) => void) => {
            fetchEligibleProducts(query).then((options) => callback(options))
        },
        300
    )

    const handleLoadOptions = (
        inputValue: string,
        callback: (options: PromotionProductOption[]) => void
    ) => {
        if (!inputValue.trim()) {
            fetchEligibleProducts('').then((options) => callback(options))
            return
        }

        debouncedSearch(inputValue, callback)
    }

    const handleChange = (selected: MultiValue<PromotionProductOption>) => {
        onChange([...selected])
    }

    return (
        <div className={cn('w-full', className)}>
            <AsyncSelect<PromotionProductOption, true>
                instanceId={selectId}
                inputId={selectId}
                isMulti
                cacheOptions
                defaultOptions
                closeMenuOnSelect={false}
                loadOptions={handleLoadOptions}
                value={value}
                onChange={handleChange}
                isDisabled={disabled}
                isClearable
                placeholder={placeholder}
                formatOptionLabel={(option: PromotionProductOption, { context }) => {
                    if (context === 'value') {
                        return (
                            <span className="inline-flex items-center gap-1 text-xs font-medium">
                                <span className="truncate max-w-[180px]">{option.name}</span>
                                {option.barcode && (
                                    <span className="font-mono text-[10px] opacity-75">
                                        ({option.barcode})
                                    </span>
                                )}
                            </span>
                        )
                    }

                    return (
                        <div className="flex flex-col py-0.5 text-left w-full min-w-0">
                            <div className="flex items-center justify-between gap-2 min-w-0">
                                <span className="font-medium text-sm text-foreground truncate">
                                    {option.name}
                                </span>
                                {option.sell_price !== undefined && (
                                    <span className="font-mono text-xs font-semibold text-primary shrink-0">
                                        Rp {new Intl.NumberFormat('id-ID').format(option.sell_price)}
                                    </span>
                                )}
                            </div>
                            <div className="flex items-center gap-2 text-[11px] text-muted-foreground font-mono truncate">
                                <span>{option.barcode}</span>
                                {option.category_name && <span>• {option.category_name}</span>}
                            </div>
                        </div>
                    )
                }}
                menuPortalTarget={typeof document !== 'undefined' ? document.body : undefined}
                styles={{
                    menuPortal: (base) => ({ ...base, zIndex: 9999 }),
                }}
                noOptionsMessage={({ inputValue }) =>
                    inputValue
                        ? `Tidak ada produk untuk "${inputValue}"`
                        : 'Ketik untuk mencari produk...'
                }
                loadingMessage={() => 'Mencari produk...'}
                unstyled
                classNames={{
                    control: ({ isFocused, isDisabled }) =>
                        cn(
                            'flex min-h-10 w-full items-center justify-between rounded-md border border-input bg-background px-2.5 py-1.5 text-sm shadow-xs transition-colors',
                            isFocused && 'border-primary ring-2 ring-primary/20 outline-none',
                            isDisabled && 'cursor-not-allowed opacity-50 bg-muted/30',
                            error && 'border-destructive focus-visible:ring-destructive/30'
                        ),
                    valueContainer: () => 'flex flex-wrap items-center gap-1.5 p-0 flex-1 min-w-0',
                    input: () => 'text-foreground text-sm m-0 p-0 min-w-[80px]',
                    placeholder: () => 'text-muted-foreground text-xs truncate',
                    multiValue: () =>
                        'inline-flex items-center gap-1 rounded-md border border-primary/25 bg-primary/10 px-2 py-0.5 text-xs text-foreground',
                    multiValueLabel: () => 'truncate',
                    multiValueRemove: () =>
                        'rounded-sm p-0.5 text-muted-foreground hover:bg-destructive/15 hover:text-destructive cursor-pointer transition-colors',
                    menu: () =>
                        'mt-1.5 overflow-hidden rounded-md border border-border bg-popover text-popover-foreground shadow-lg z-50',
                    menuList: () => 'p-1 max-h-60 overflow-y-auto overflow-x-hidden text-sm',
                    option: ({ isFocused, isSelected }) =>
                        cn(
                            'relative flex cursor-pointer select-none items-center rounded-sm px-2.5 py-1.5 text-sm outline-none transition-colors',
                            isSelected && 'bg-primary/15 text-foreground font-medium',
                            !isSelected && isFocused && 'bg-accent text-accent-foreground',
                            !isSelected && !isFocused && 'text-foreground'
                        ),
                    noOptionsMessage: () => 'text-muted-foreground text-xs py-3 text-center',
                    loadingMessage: () => 'text-muted-foreground text-xs py-3 text-center',
                    indicatorsContainer: () => 'flex items-center gap-1 text-muted-foreground shrink-0 self-start pt-0.5',
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
            {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
        </div>
    )
}

export default SelectProductsMultiAsync

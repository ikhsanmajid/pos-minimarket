import React, { useId } from 'react'
import AsyncCreatableSelect from 'react-select/async-creatable'
import { useDebouncedCallback } from 'use-debounce'
import type { SingleValue } from 'react-select'
import { Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import PromotionController from '@/actions/App/Http/Controllers/PromotionController'

export interface ExclusiveGroupOption {
    value: string
    label: string
}

interface SelectExclusiveGroupAsyncProps {
    value: string
    onChange: (value: string) => void
    placeholder?: string
    disabled?: boolean
    className?: string
}

async function fetchExclusiveGroups(search: string): Promise<ExclusiveGroupOption[]> {
    try {
        const url = PromotionController.searchExclusiveGroups.url({
            query: search.trim() ? { search: search.trim() } : {},
        })
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                Accept: 'application/json',
                'X-Requested-With': 'XMLHttpRequest',
            },
            credentials: 'same-origin',
        })
        if (!response.ok) return []
        const data = (await response.json()) as ExclusiveGroupOption[]
        return Array.isArray(data) ? data : []
    } catch {
        return []
    }
}

export function SelectExclusiveGroupAsync({
    value,
    onChange,
    placeholder = 'Cari / buat grup...',
    disabled = false,
    className,
}: SelectExclusiveGroupAsyncProps) {
    const selectId = useId()

    const debouncedSearch = useDebouncedCallback(
        (query: string, callback: (options: ExclusiveGroupOption[]) => void) => {
            fetchExclusiveGroups(query).then((options) => callback(options))
        },
        250
    )

    const handleLoadOptions = (
        inputValue: string,
        callback: (options: ExclusiveGroupOption[]) => void
    ) => {
        if (!inputValue.trim()) {
            fetchExclusiveGroups('').then((options) => callback(options))
            return
        }
        debouncedSearch(inputValue, callback)
    }

    const selectedOption: ExclusiveGroupOption | null = value.trim()
        ? { value: value.trim(), label: value.trim() }
        : null

    return (
        <div className={cn('w-full', className)}>
            <AsyncCreatableSelect<ExclusiveGroupOption, false>
                instanceId={selectId}
                inputId={selectId}
                cacheOptions
                defaultOptions
                isClearable
                isDisabled={disabled}
                loadOptions={handleLoadOptions}
                value={selectedOption}
                onChange={(opt: SingleValue<ExclusiveGroupOption>) => {
                    onChange(opt ? opt.value.trim() : '')
                }}
                onCreateOption={(inputVal: string) => {
                    const cleaned = inputVal.trim()
                    if (cleaned) {
                        onChange(cleaned)
                    }
                }}
                formatCreateLabel={(inputVal: string) => (
                    <span className="inline-flex items-center gap-1.5 text-primary font-medium">
                        <Plus className="h-3.5 w-3.5" />
                        Buat grup &ldquo;{inputVal}&rdquo;
                    </span>
                )}
                placeholder={placeholder}
                noOptionsMessage={({ inputValue }) =>
                    inputValue
                        ? `Ketik lalu tekan Enter untuk membuat "${inputValue}"`
                        : 'Belum ada grup eksklusif. Ketik nama grup baru...'
                }
                loadingMessage={() => 'Memuat grup...'}
                menuPortalTarget={typeof document !== 'undefined' ? document.body : undefined}
                styles={{
                    menuPortal: (base) => ({ ...base, zIndex: 9999 }),
                }}
                unstyled
                classNames={{
                    control: ({ isFocused, isDisabled }) =>
                        cn(
                            'flex h-9 w-full items-center justify-between rounded-md border border-input bg-background px-2.5 text-xs shadow-xs transition-colors',
                            isFocused && 'border-primary ring-2 ring-primary/20 outline-none',
                            isDisabled && 'cursor-not-allowed opacity-50 bg-muted/30'
                        ),
                    valueContainer: () => 'flex items-center gap-1 p-0 flex-1 min-w-0',
                    singleValue: () => 'text-foreground text-xs truncate',
                    input: () => 'text-foreground text-xs m-0 p-0',
                    placeholder: () => 'text-muted-foreground text-xs truncate',
                    menu: () =>
                        'mt-1 overflow-hidden rounded-md border border-border bg-popover text-popover-foreground shadow-lg z-50',
                    menuList: () => 'p-1 max-h-52 overflow-y-auto text-xs',
                    option: ({ isFocused, isSelected }) =>
                        cn(
                            'relative flex cursor-pointer select-none items-center rounded-sm px-2.5 py-1.5 text-xs outline-none transition-colors',
                            isSelected && 'bg-primary/15 text-foreground font-medium',
                            !isSelected && isFocused && 'bg-accent text-accent-foreground',
                            !isSelected && !isFocused && 'text-foreground'
                        ),
                    noOptionsMessage: () => 'text-muted-foreground text-xs py-2.5 text-center',
                    loadingMessage: () => 'text-muted-foreground text-xs py-2.5 text-center',
                    indicatorsContainer: () => 'flex items-center gap-0.5 text-muted-foreground shrink-0',
                    dropdownIndicator: () => 'p-0.5 cursor-pointer hover:text-foreground',
                    clearIndicator: () => 'p-0.5 cursor-pointer hover:text-destructive',
                }}
            />
        </div>
    )
}

export default SelectExclusiveGroupAsync

import React from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { X } from 'lucide-react'

const HOURS_24 = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'))
const MINUTES_60 = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0'))

interface DateTime24hInputProps {
    id?: string
    value: string // format: YYYY-MM-DDTHH:mm
    onChange: (value: string) => void
    required?: boolean
    disabled?: boolean
}

export function DateTime24hInput({
    id,
    value,
    onChange,
    required = false,
    disabled = false,
}: DateTime24hInputProps) {
    const [datePart = '', timePart = '00:00'] = (value || '').split('T')
    const [hourPart = '00', minutePart = '00'] = timePart.split(':')

    const emit = (nextDate: string, nextHour: string, nextMin: string) => {
        if (!nextDate) {
            onChange('')
            return
        }
        onChange(`${nextDate}T${nextHour}:${nextMin}`)
    }

    return (
        <div className="flex items-center gap-1.5">
            <Input
                id={id}
                type="date"
                value={datePart}
                onChange={(e) => emit(e.target.value, hourPart, minutePart)}
                required={required}
                disabled={disabled}
                className="h-9 font-mono text-xs flex-1 min-w-0"
            />
            <div className="inline-flex items-center rounded-md border border-input bg-background px-1.5 h-9 font-mono text-xs shrink-0">
                <select
                    aria-label="Jam (24 jam)"
                    value={hourPart}
                    onChange={(e) => emit(datePart, e.target.value, minutePart)}
                    disabled={disabled}
                    className="bg-transparent outline-none cursor-pointer pr-0.5 text-foreground"
                >
                    {HOURS_24.map((h) => (
                        <option key={h} value={h} className="bg-popover text-popover-foreground">
                            {h}
                        </option>
                    ))}
                </select>
                <span className="text-muted-foreground px-0.5">:</span>
                <select
                    aria-label="Menit"
                    value={minutePart}
                    onChange={(e) => emit(datePart, hourPart, e.target.value)}
                    disabled={disabled}
                    className="bg-transparent outline-none cursor-pointer pl-0.5 text-foreground"
                >
                    {MINUTES_60.map((m) => (
                        <option key={m} value={m} className="bg-popover text-popover-foreground">
                            {m}
                        </option>
                    ))}
                </select>
                <span className="text-[10px] text-muted-foreground ml-1">WIB</span>
            </div>
        </div>
    )
}

interface Time24hInputProps {
    id?: string
    value: string // format: HH:mm or ''
    onChange: (value: string) => void
    disabled?: boolean
}

export function Time24hInput({ id, value, onChange, disabled = false }: Time24hInputProps) {
    const hasValue = Boolean(value && value.includes(':'))
    const [hourPart = '', minutePart = '00'] = hasValue ? value.split(':') : ['', '00']

    return (
        <div className="flex items-center gap-1">
            <div className="inline-flex items-center rounded-md border border-input bg-background px-2 h-9 font-mono text-xs w-full justify-between">
                <div className="flex items-center">
                    <select
                        id={id}
                        aria-label="Jam (24 jam)"
                        value={hourPart}
                        onChange={(e) => {
                            const h = e.target.value
                            if (!h) {
                                onChange('')
                            } else {
                                onChange(`${h}:${minutePart || '00'}`)
                            }
                        }}
                        disabled={disabled}
                        className="bg-transparent outline-none cursor-pointer text-foreground"
                    >
                        <option value="" className="bg-popover text-popover-foreground">
                            --
                        </option>
                        {HOURS_24.map((h) => (
                            <option key={h} value={h} className="bg-popover text-popover-foreground">
                                {h}
                            </option>
                        ))}
                    </select>
                    <span className="text-muted-foreground px-1">:</span>
                    <select
                        aria-label="Menit"
                        value={hasValue ? minutePart : ''}
                        onChange={(e) => {
                            const m = e.target.value
                            if (!m) {
                                onChange('')
                            } else {
                                onChange(`${hourPart || '00'}:${m}`)
                            }
                        }}
                        disabled={disabled || !hasValue}
                        className="bg-transparent outline-none cursor-pointer text-foreground disabled:opacity-50"
                    >
                        <option value="" className="bg-popover text-popover-foreground">
                            --
                        </option>
                        {MINUTES_60.map((m) => (
                            <option key={m} value={m} className="bg-popover text-popover-foreground">
                                {m}
                            </option>
                        ))}
                    </select>
                </div>
                {hasValue && !disabled && (
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => onChange('')}
                        className="h-5 w-5 text-muted-foreground hover:text-destructive cursor-pointer"
                        title="Hapus jam"
                    >
                        <X className="h-3 w-3" />
                    </Button>
                )}
            </div>
        </div>
    )
}

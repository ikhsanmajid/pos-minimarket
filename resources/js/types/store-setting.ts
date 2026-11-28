export type RoundingModeValue =
    | 'none'
    | 'nearest_100'
    | 'down_100'
    | 'up_100'
    | 'nearest_500'

export interface RoundingModeOption {
    value: RoundingModeValue
    label: string
    description: string
}

export interface StoreSettingsData {
    store_name: string
    store_address: string | null
    store_phone: string | null
    store_logo: string | null
    store_logo_url: string | null
    receipt_header: string | null
    receipt_footer: string | null
    default_tax_rate: number
    rounding_mode: RoundingModeValue
    shift_variance_tolerance: number
}

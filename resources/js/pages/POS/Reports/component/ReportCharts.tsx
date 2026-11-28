import React, { useMemo } from 'react'
import {
    Area,
    AreaChart,
    Bar,
    BarChart,
    CartesianGrid,
    Cell,
    Label,
    Pie,
    PieChart,
    XAxis,
    YAxis,
} from 'recharts'
import {
    ChartContainer,
    ChartLegend,
    ChartLegendContent,
    ChartTooltip,
    ChartTooltipContent,
    type ChartConfig,
} from '@/components/ui/chart'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { BarChart3, Boxes, CreditCard, Landmark, TrendingUp } from 'lucide-react'
import { formatCompactIdr, formatIdr, formatQty } from './reportUtils'

const CHART_PALETTE = [
    'var(--chart-1)',
    'var(--chart-2)',
    'var(--chart-3)',
    'var(--chart-4)',
    'var(--chart-5)',
]

// 1. Sales Daily Trend Chart
export interface SalesDailyPoint {
    date: string
    label: string
    net_sales: number
    returns: number
    transactions_count: number
}

const salesTrendConfig = {
    net_sales: { label: 'Omzet Bersih', color: 'var(--chart-1)' },
    returns: { label: 'Retur', color: 'var(--chart-5)' },
} satisfies ChartConfig

export function SalesTrendChart({ data }: { data: SalesDailyPoint[] }) {
    const hasData = useMemo(() => data.some((d) => d.net_sales > 0 || d.returns > 0), [data])

    return (
        <Card className="h-full flex flex-col">
            <CardHeader className="pb-2">
                <CardTitle className="text-base">Tren Omzet Harian</CardTitle>
                <CardDescription className="text-xs">
                    Pergerakan omzet bersih harian (eksklusif transaksi void).
                </CardDescription>
            </CardHeader>
            <CardContent className="flex-1">
                {!hasData ? (
                    <EmptyChart icon={TrendingUp} title="Belum Ada Penjualan" />
                ) : (
                    <ChartContainer config={salesTrendConfig} className="h-[270px] w-full aspect-auto">
                        <AreaChart data={data} margin={{ top: 10, right: 12, left: 4, bottom: 0 }}>
                            <defs>
                                <linearGradient id="reportFillNetSales" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="var(--color-net_sales)" stopOpacity={0.35} />
                                    <stop offset="95%" stopColor="var(--color-net_sales)" stopOpacity={0.02} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid vertical={false} strokeDasharray="3 3" />
                            <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} minTickGap={20} />
                            <YAxis
                                tickLine={false}
                                axisLine={false}
                                width={66}
                                tickFormatter={(v: number) => formatCompactIdr(v)}
                            />
                            <ChartTooltip
                                cursor={false}
                                content={
                                    <ChartTooltipContent
                                        indicator="dot"
                                        formatter={(value, name) => (
                                            <div className="flex flex-1 items-center justify-between gap-4">
                                                <span className="text-muted-foreground">
                                                    {name === 'net_sales' ? 'Omzet Bersih' : 'Retur'}
                                                </span>
                                                <span className="font-mono font-semibold text-foreground">
                                                    {formatIdr(Number(value))}
                                                </span>
                                            </div>
                                        )}
                                    />
                                }
                            />
                            <Area
                                dataKey="net_sales"
                                type="monotone"
                                fill="url(#reportFillNetSales)"
                                stroke="var(--color-net_sales)"
                                strokeWidth={2.2}
                            />
                            <ChartLegend content={<ChartLegendContent />} />
                        </AreaChart>
                    </ChartContainer>
                )}
            </CardContent>
        </Card>
    )
}

// 2. Payment Method Donut Chart
export interface PaymentBreakdownRow {
    method: string
    label: string
    count: number
    amount: number
    percentage: number
}

export function SalesPaymentChart({ data }: { data: PaymentBreakdownRow[] }) {
    const total = useMemo(() => data.reduce((acc, row) => acc + row.amount, 0), [data])
    const totalTrx = useMemo(() => data.reduce((acc, row) => acc + row.count, 0), [data])

    const chartConfig = useMemo<ChartConfig>(() => {
        const cfg: ChartConfig = { amount: { label: 'Nominal' } }
        data.forEach((row, idx) => {
            cfg[row.method] = { label: row.label, color: CHART_PALETTE[idx % CHART_PALETTE.length] }
        })
        return cfg
    }, [data])

    const rows = useMemo(
        () => data.map((row, idx) => ({ ...row, fill: CHART_PALETTE[idx % CHART_PALETTE.length] })),
        [data]
    )

    return (
        <Card className="h-full flex flex-col">
            <CardHeader className="pb-2">
                <CardTitle className="text-base">Metode Pembayaran</CardTitle>
                <CardDescription className="text-xs">
                    Proporsi pembayaran dari transaksi non-voided.
                </CardDescription>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col justify-between">
                {rows.length === 0 || total <= 0 ? (
                    <EmptyChart icon={CreditCard} title="Belum Ada Pembayaran" />
                ) : (
                    <>
                        <ChartContainer config={chartConfig} className="mx-auto h-[190px] w-full max-w-[220px] aspect-square">
                            <PieChart>
                                <ChartTooltip
                                    cursor={false}
                                    content={
                                        <ChartTooltipContent
                                            hideLabel
                                            formatter={(value, _name, item) => (
                                                <div className="flex flex-1 items-center justify-between gap-3">
                                                    <span className="text-muted-foreground">
                                                        {(item?.payload as { label?: string })?.label ?? 'Metode'}
                                                    </span>
                                                    <span className="font-mono font-semibold text-foreground">
                                                        {formatIdr(Number(value))}
                                                    </span>
                                                </div>
                                            )}
                                        />
                                    }
                                />
                                <Pie data={rows} dataKey="amount" nameKey="method" innerRadius={54} outerRadius={80} strokeWidth={3}>
                                    {rows.map((entry, idx) => (
                                        <Cell key={entry.method} fill={CHART_PALETTE[idx % CHART_PALETTE.length]} />
                                    ))}
                                    <Label
                                        content={({ viewBox }) => {
                                            if (viewBox && 'cx' in viewBox && 'cy' in viewBox) {
                                                return (
                                                    <text x={viewBox.cx} y={viewBox.cy} textAnchor="middle" dominantBaseline="middle">
                                                        <tspan x={viewBox.cx} y={(viewBox.cy ?? 0) - 4} className="fill-foreground text-xs font-bold font-mono">
                                                            {formatCompactIdr(total)}
                                                        </tspan>
                                                        <tspan x={viewBox.cx} y={(viewBox.cy ?? 0) + 12} className="fill-muted-foreground text-[11px]">
                                                            {formatQty(totalTrx)} trx
                                                        </tspan>
                                                    </text>
                                                )
                                            }
                                            return null
                                        }}
                                    />
                                </Pie>
                            </PieChart>
                        </ChartContainer>
                        <div className="space-y-1.5 border-t pt-2">
                            {rows.map((item) => (
                                <div key={item.method} className="flex items-center justify-between text-xs">
                                    <div className="flex items-center gap-2 min-w-0">
                                        <span className="h-2.5 w-2.5 rounded-sm shrink-0" style={{ backgroundColor: item.fill }} />
                                        <span className="truncate font-medium text-foreground">{item.label}</span>
                                        <span className="text-muted-foreground">({item.percentage}%)</span>
                                    </div>
                                    <span className="font-mono font-semibold text-foreground shrink-0 ml-2">
                                        {formatIdr(item.amount)}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </>
                )}
            </CardContent>
        </Card>
    )
}

// 3. Profit & Loss Grouped Bar Chart
export interface ProfitLossTrendPoint {
    date: string
    label: string
    net_revenue: number
    net_cogs: number
    gross_profit: number
}

const profitLossConfig = {
    net_revenue: { label: 'Omzet Bersih', color: 'var(--chart-1)' },
    net_cogs: { label: 'HPP Bersih', color: 'var(--chart-4)' },
    gross_profit: { label: 'Laba Kotor', color: 'var(--chart-2)' },
} satisfies ChartConfig

export function ProfitLossTrendChart({ data }: { data: ProfitLossTrendPoint[] }) {
    const hasData = useMemo(() => data.some((d) => d.net_revenue > 0 || d.net_cogs > 0), [data])

    return (
        <Card className="h-full flex flex-col">
            <CardHeader className="pb-2">
                <CardTitle className="text-base">Tren Omzet vs HPP vs Laba Kotor</CardTitle>
                <CardDescription className="text-xs">
                    Perbandingan omzet bersih (eksklusif PPN), HPP snapshot, dan laba kotor harian.
                </CardDescription>
            </CardHeader>
            <CardContent className="flex-1">
                {!hasData ? (
                    <EmptyChart icon={BarChart3} title="Belum Ada Data Laba Kotor" />
                ) : (
                    <ChartContainer config={profitLossConfig} className="h-[280px] w-full aspect-auto">
                        <BarChart data={data} margin={{ top: 10, right: 12, left: 4, bottom: 0 }}>
                            <CartesianGrid vertical={false} strokeDasharray="3 3" />
                            <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} minTickGap={16} />
                            <YAxis tickLine={false} axisLine={false} width={66} tickFormatter={(v: number) => formatCompactIdr(v)} />
                            <ChartTooltip
                                content={
                                    <ChartTooltipContent
                                        indicator="dot"
                                        formatter={(value, name) => (
                                            <div className="flex flex-1 items-center justify-between gap-4">
                                                <span className="text-muted-foreground">
                                                    {name === 'net_revenue'
                                                        ? 'Omzet Bersih'
                                                        : name === 'net_cogs'
                                                          ? 'HPP Bersih'
                                                          : 'Laba Kotor'}
                                                </span>
                                                <span className="font-mono font-semibold text-foreground">
                                                    {formatIdr(Number(value))}
                                                </span>
                                            </div>
                                        )}
                                    />
                                }
                            />
                            <Bar dataKey="net_revenue" fill="var(--color-net_revenue)" radius={[3, 3, 0, 0]} />
                            <Bar dataKey="net_cogs" fill="var(--color-net_cogs)" radius={[3, 3, 0, 0]} />
                            <Bar dataKey="gross_profit" fill="var(--color-gross_profit)" radius={[3, 3, 0, 0]} />
                            <ChartLegend content={<ChartLegendContent />} />
                        </BarChart>
                    </ChartContainer>
                )}
            </CardContent>
        </Card>
    )
}

// 4. Stock Composition Chart
export interface StockCompositionItem {
    key: string
    label: string
    count: number
}

const STOCK_CLASS_COLORS: Record<string, string> = {
    fast_moving: 'var(--chart-2)',
    slow_moving: 'var(--chart-4)',
    dead_stock: 'var(--chart-5)',
    out_of_stock: 'var(--chart-3)',
}

const stockCompConfig = {
    count: { label: 'Jumlah SKU', color: 'var(--chart-1)' },
} satisfies ChartConfig

export function StockCompositionChart({ data }: { data: StockCompositionItem[] }) {
    const hasData = useMemo(() => data.some((d) => d.count > 0), [data])

    return (
        <Card className="h-full flex flex-col">
            <CardHeader className="pb-2">
                <CardTitle className="text-base">Komposisi Pergerakan Stok</CardTitle>
                <CardDescription className="text-xs">
                    Distribusi SKU aktif berdasarkan kecepatan penjualan pada periode evaluasi.
                </CardDescription>
            </CardHeader>
            <CardContent className="flex-1">
                {!hasData ? (
                    <EmptyChart icon={Boxes} title="Belum Ada Produk Aktif" />
                ) : (
                    <ChartContainer config={stockCompConfig} className="h-[250px] w-full aspect-auto">
                        <BarChart data={data} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
                            <CartesianGrid vertical={false} strokeDasharray="3 3" />
                            <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} />
                            <YAxis tickLine={false} axisLine={false} width={42} allowDecimals={false} />
                            <ChartTooltip
                                content={
                                    <ChartTooltipContent
                                        indicator="dot"
                                        formatter={(value) => (
                                            <div className="flex flex-1 items-center justify-between gap-4">
                                                <span className="text-muted-foreground">Jumlah SKU</span>
                                                <span className="font-mono font-semibold text-foreground">
                                                    {formatQty(Number(value))} SKU
                                                </span>
                                            </div>
                                        )}
                                    />
                                }
                            />
                            <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                                {data.map((entry) => (
                                    <Cell
                                        key={entry.key}
                                        fill={STOCK_CLASS_COLORS[entry.key] ?? 'var(--chart-1)'}
                                    />
                                ))}
                            </Bar>
                        </BarChart>
                    </ChartContainer>
                )}
            </CardContent>
        </Card>
    )
}

// 5. Finance Cashflow by Category Chart
export interface CashflowCategoryRow {
    category_id: number
    code: string
    name: string
    type: string
    income: number
    expense: number
    transactions_count: number
}

const cashflowConfig = {
    income: { label: 'Pemasukan', color: 'var(--chart-2)' },
    expense: { label: 'Pengeluaran', color: 'var(--chart-5)' },
} satisfies ChartConfig

export function FinanceCashflowChart({ data }: { data: CashflowCategoryRow[] }) {
    const hasData = useMemo(() => data.some((d) => d.income > 0 || d.expense > 0), [data])

    return (
        <Card className="h-full flex flex-col">
            <CardHeader className="pb-2">
                <CardTitle className="text-base">Arus Kas per Kategori</CardTitle>
                <CardDescription className="text-xs">
                    Perbandingan pemasukan dan pengeluaran per kategori keuangan.
                </CardDescription>
            </CardHeader>
            <CardContent className="flex-1">
                {!hasData ? (
                    <EmptyChart icon={Landmark} title="Belum Ada Transaksi Keuangan" />
                ) : (
                    <ChartContainer config={cashflowConfig} className="h-[260px] w-full aspect-auto">
                        <BarChart data={data.slice(0, 8)} margin={{ top: 10, right: 12, left: 4, bottom: 0 }}>
                            <CartesianGrid vertical={false} strokeDasharray="3 3" />
                            <XAxis dataKey="code" tickLine={false} axisLine={false} tickMargin={8} />
                            <YAxis tickLine={false} axisLine={false} width={66} tickFormatter={(v: number) => formatCompactIdr(v)} />
                            <ChartTooltip
                                content={
                                    <ChartTooltipContent
                                        indicator="dot"
                                        formatter={(value, name) => (
                                            <div className="flex flex-1 items-center justify-between gap-4">
                                                <span className="text-muted-foreground">
                                                    {name === 'income' ? 'Pemasukan' : 'Pengeluaran'}
                                                </span>
                                                <span className="font-mono font-semibold text-foreground">
                                                    {formatIdr(Number(value))}
                                                </span>
                                            </div>
                                        )}
                                    />
                                }
                            />
                            <Bar dataKey="income" fill="var(--color-income)" radius={[4, 4, 0, 0]} />
                            <Bar dataKey="expense" fill="var(--color-expense)" radius={[4, 4, 0, 0]} />
                            <ChartLegend content={<ChartLegendContent />} />
                        </BarChart>
                    </ChartContainer>
                )}
            </CardContent>
        </Card>
    )
}

// 6. AP Aging Buckets Chart
export interface AgingBucketRow {
    key: string
    label: string
    amount: number
    count: number
}

const AGING_COLORS: Record<string, string> = {
    current: 'var(--chart-2)',
    '1_30': 'var(--chart-4)',
    '31_60': 'var(--chart-3)',
    '61_90': 'var(--chart-5)',
    over_90: 'var(--destructive)',
}

const agingConfig = {
    amount: { label: 'Sisa Hutang', color: 'var(--chart-5)' },
} satisfies ChartConfig

export function PayablesAgingChart({ data }: { data: AgingBucketRow[] }) {
    const hasData = useMemo(() => data.some((d) => d.amount > 0), [data])

    return (
        <Card className="h-full flex flex-col">
            <CardHeader className="pb-2">
                <CardTitle className="text-base">Aging Hutang Supplier</CardTitle>
                <CardDescription className="text-xs">
                    Distribusi sisa hutang dagang berdasarkan umur jatuh tempo per hari ini.
                </CardDescription>
            </CardHeader>
            <CardContent className="flex-1">
                {!hasData ? (
                    <EmptyChart icon={Landmark} title="Tidak Ada Hutang Dagang Aktif" />
                ) : (
                    <ChartContainer config={agingConfig} className="h-[260px] w-full aspect-auto">
                        <BarChart data={data} margin={{ top: 10, right: 12, left: 4, bottom: 0 }}>
                            <CartesianGrid vertical={false} strokeDasharray="3 3" />
                            <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} />
                            <YAxis tickLine={false} axisLine={false} width={66} tickFormatter={(v: number) => formatCompactIdr(v)} />
                            <ChartTooltip
                                content={
                                    <ChartTooltipContent
                                        indicator="dot"
                                        formatter={(value) => (
                                            <div className="flex flex-1 items-center justify-between gap-4">
                                                <span className="text-muted-foreground">Sisa Hutang</span>
                                                <span className="font-mono font-semibold text-foreground">
                                                    {formatIdr(Number(value))}
                                                </span>
                                            </div>
                                        )}
                                    />
                                }
                            />
                            <Bar dataKey="amount" radius={[4, 4, 0, 0]}>
                                {data.map((entry) => (
                                    <Cell key={entry.key} fill={AGING_COLORS[entry.key] ?? 'var(--chart-5)'} />
                                ))}
                            </Bar>
                        </BarChart>
                    </ChartContainer>
                )}
            </CardContent>
        </Card>
    )
}

function EmptyChart({
    icon: Icon,
    title,
}: {
    icon: React.ComponentType<{ className?: string }>
    title: string
}) {
    return (
        <div className="flex h-[240px] flex-col items-center justify-center rounded-lg border border-dashed px-6 text-center">
            <Icon className="mb-2 h-8 w-8 text-muted-foreground/40" />
            <p className="text-sm font-medium text-foreground">{title}</p>
            <p className="mt-1 text-xs text-muted-foreground">
                Data akan tampil otomatis sesuai filter dan rentang tanggal yang dipilih.
            </p>
        </div>
    )
}

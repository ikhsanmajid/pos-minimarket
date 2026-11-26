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
import { Skeleton } from '@/components/ui/skeleton'
import { CreditCard, Package, TrendingUp } from 'lucide-react'
import {
    formatCompactRupiah,
    formatRupiah,
    type PaymentCompositionData,
    type SalesTrendPoint,
    type StockMovementTrendPoint,
} from './dashboardUtils'

const salesProfitConfig = {
    net_sales: {
        label: 'Penjualan Bersih',
        color: 'var(--chart-1)',
    },
    gross_profit: {
        label: 'Estimasi Laba Kotor',
        color: 'var(--chart-2)',
    },
} satisfies ChartConfig

const salesOnlyConfig = {
    net_sales: {
        label: 'Omzet Penjualan',
        color: 'var(--chart-1)',
    },
} satisfies ChartConfig

export function SalesProfitChart({
    data,
    showProfit = true,
    title = 'Tren Penjualan & Laba Kotor',
    description = 'Perbandingan omzet bersih dan estimasi laba kotor pada periode terpilih.',
}: {
    data?: SalesTrendPoint[]
    showProfit?: boolean
    title?: string
    description?: string
}) {
    const hasAnyValue = useMemo(
        () => Boolean(data && data.some((d) => d.net_sales > 0 || d.gross_profit > 0)),
        [data]
    )

    return (
        <Card className="h-full flex flex-col">
            <CardHeader className="pb-3">
                <CardTitle className="text-base">{title}</CardTitle>
                <CardDescription className="text-xs">{description}</CardDescription>
            </CardHeader>
            <CardContent className="flex-1">
                {data === undefined ? (
                    <div className="space-y-3">
                        <Skeleton className="h-[270px] w-full rounded-lg" />
                        <div className="flex justify-center gap-4">
                            <Skeleton className="h-3 w-28" />
                            {showProfit && <Skeleton className="h-3 w-28" />}
                        </div>
                    </div>
                ) : !hasAnyValue ? (
                    <div className="flex h-[290px] flex-col items-center justify-center rounded-lg border border-dashed text-center px-6">
                        <TrendingUp className="h-9 w-9 text-muted-foreground/40 mb-2" />
                        <p className="text-sm font-medium text-foreground">
                            Belum Ada Data Penjualan
                        </p>
                        <p className="text-xs text-muted-foreground mt-1 max-w-xs">
                            Grafik tren akan terisi otomatis begitu transaksi kasir tercatat pada rentang tanggal terpilih.
                        </p>
                    </div>
                ) : (
                    <ChartContainer
                        config={showProfit ? salesProfitConfig : salesOnlyConfig}
                        className="h-[290px] w-full aspect-auto"
                    >
                        <AreaChart data={data} margin={{ top: 10, right: 12, left: 4, bottom: 0 }}>
                            <defs>
                                <linearGradient id="fillNetSales" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="var(--color-net_sales)" stopOpacity={0.35} />
                                    <stop offset="95%" stopColor="var(--color-net_sales)" stopOpacity={0.02} />
                                </linearGradient>
                                {showProfit && (
                                    <linearGradient id="fillGrossProfit" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="var(--color-gross_profit)" stopOpacity={0.35} />
                                        <stop offset="95%" stopColor="var(--color-gross_profit)" stopOpacity={0.02} />
                                    </linearGradient>
                                )}
                            </defs>
                            <CartesianGrid vertical={false} strokeDasharray="3 3" />
                            <XAxis
                                dataKey="label"
                                tickLine={false}
                                axisLine={false}
                                tickMargin={8}
                                minTickGap={20}
                            />
                            <YAxis
                                tickLine={false}
                                axisLine={false}
                                width={66}
                                tickFormatter={(val: number) => formatCompactRupiah(val)}
                            />
                            <ChartTooltip
                                cursor={false}
                                content={
                                    <ChartTooltipContent
                                        indicator="dot"
                                        formatter={(value, name) => (
                                            <div className="flex flex-1 items-center justify-between gap-4">
                                                <span className="text-muted-foreground">
                                                    {name === 'net_sales'
                                                        ? showProfit
                                                            ? 'Penjualan Bersih'
                                                            : 'Omzet Penjualan'
                                                        : 'Estimasi Laba Kotor'}
                                                </span>
                                                <span className="font-mono font-semibold text-foreground">
                                                    {formatRupiah(Number(value))}
                                                </span>
                                            </div>
                                        )}
                                    />
                                }
                            />
                            <Area
                                dataKey="net_sales"
                                type="monotone"
                                fill="url(#fillNetSales)"
                                stroke="var(--color-net_sales)"
                                strokeWidth={2.2}
                            />
                            {showProfit && (
                                <Area
                                    dataKey="gross_profit"
                                    type="monotone"
                                    fill="url(#fillGrossProfit)"
                                    stroke="var(--color-gross_profit)"
                                    strokeWidth={2.2}
                                />
                            )}
                            <ChartLegend content={<ChartLegendContent />} />
                        </AreaChart>
                    </ChartContainer>
                )}
            </CardContent>
        </Card>
    )
}

const CHART_COLORS = [
    'var(--chart-1)',
    'var(--chart-2)',
    'var(--chart-3)',
    'var(--chart-4)',
    'var(--chart-5)',
]

export function PaymentMethodDonutChart({ data }: { data?: PaymentCompositionData }) {
    const chartConfig = useMemo<ChartConfig>(() => {
        const cfg: ChartConfig = { amount: { label: 'Nominal' } }
        data?.items.forEach((item, idx) => {
            cfg[item.method] = {
                label: item.label,
                color: CHART_COLORS[idx % CHART_COLORS.length],
            }
        })
        return cfg
    }, [data])

    const chartRows = useMemo(
        () =>
            (data?.items ?? []).map((item, idx) => ({
                ...item,
                fill: CHART_COLORS[idx % CHART_COLORS.length],
            })),
        [data]
    )

    return (
        <Card className="h-full flex flex-col">
            <CardHeader className="pb-2">
                <CardTitle className="text-base">Metode Pembayaran</CardTitle>
                <CardDescription className="text-xs">
                    Proporsi pembayaran Tunai, QRIS, Debit, dan Transfer.
                </CardDescription>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col justify-between">
                {data === undefined ? (
                    <div className="space-y-4">
                        <div className="flex justify-center py-4">
                            <Skeleton className="h-44 w-44 rounded-full" />
                        </div>
                        <div className="space-y-2">
                            <Skeleton className="h-4 w-full" />
                            <Skeleton className="h-4 w-5/6" />
                            <Skeleton className="h-4 w-4/6" />
                        </div>
                    </div>
                ) : chartRows.length === 0 || data.total <= 0 ? (
                    <div className="flex h-[290px] flex-col items-center justify-center rounded-lg border border-dashed text-center px-6">
                        <CreditCard className="h-9 w-9 text-muted-foreground/40 mb-2" />
                        <p className="text-sm font-medium text-foreground">Belum Ada Transaksi</p>
                        <p className="text-xs text-muted-foreground mt-1">
                            Komposisi metode pembayaran akan tampil setelah ada transaksi selesai.
                        </p>
                    </div>
                ) : (
                    <>
                        <ChartContainer config={chartConfig} className="mx-auto h-[200px] w-full max-w-[230px] aspect-square">
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
                                                        {formatRupiah(Number(value))}
                                                    </span>
                                                </div>
                                            )}
                                        />
                                    }
                                />
                                <Pie
                                    data={chartRows}
                                    dataKey="amount"
                                    nameKey="method"
                                    innerRadius={58}
                                    outerRadius={84}
                                    strokeWidth={3}
                                >
                                    {chartRows.map((entry, idx) => (
                                        <Cell key={entry.method} fill={CHART_COLORS[idx % CHART_COLORS.length]} />
                                    ))}
                                    <Label
                                        content={({ viewBox }) => {
                                            if (viewBox && 'cx' in viewBox && 'cy' in viewBox) {
                                                return (
                                                    <text
                                                        x={viewBox.cx}
                                                        y={viewBox.cy}
                                                        textAnchor="middle"
                                                        dominantBaseline="middle"
                                                    >
                                                        <tspan
                                                            x={viewBox.cx}
                                                            y={(viewBox.cy ?? 0) - 4}
                                                            className="fill-foreground text-sm font-bold font-mono"
                                                        >
                                                            {formatCompactRupiah(data.total)}
                                                        </tspan>
                                                        <tspan
                                                            x={viewBox.cx}
                                                            y={(viewBox.cy ?? 0) + 14}
                                                            className="fill-muted-foreground text-[11px]"
                                                        >
                                                            {data.transactions_count} trx
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

                        <div className="space-y-2 pt-2 border-t">
                            {chartRows.map((item) => (
                                <div key={item.method} className="flex items-center justify-between text-xs">
                                    <div className="flex items-center gap-2 min-w-0">
                                        <span
                                            className="h-2.5 w-2.5 rounded-sm shrink-0"
                                            style={{ backgroundColor: item.fill }}
                                        />
                                        <span className="truncate font-medium text-foreground">
                                            {item.label}
                                        </span>
                                        <span className="text-muted-foreground">({item.percentage}%)</span>
                                    </div>
                                    <span className="font-mono font-semibold text-foreground shrink-0 ml-2">
                                        {formatRupiah(item.amount)}
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

const stockMovementConfig = {
    stock_in: {
        label: 'Stok Masuk (Qty Dasar)',
        color: 'var(--chart-2)',
    },
    stock_out: {
        label: 'Stok Keluar (Qty Dasar)',
        color: 'var(--chart-5)',
    },
} satisfies ChartConfig

export function WarehouseStockChart({ data }: { data?: StockMovementTrendPoint[] }) {
    const hasActivity = Boolean(data && data.some((d) => d.stock_in > 0 || d.stock_out > 0))

    return (
        <Card className="h-full">
            <CardHeader className="pb-3">
                <CardTitle className="text-base">Tren Pergerakan Stok (7 Hari Terakhir)</CardTitle>
                <CardDescription className="text-xs">
                    Perbandingan total barang masuk (LPB / penyesuaian) vs barang keluar dalam satuan dasar.
                </CardDescription>
            </CardHeader>
            <CardContent>
                {data === undefined ? (
                    <Skeleton className="h-[260px] w-full rounded-lg" />
                ) : !hasActivity ? (
                    <div className="flex h-[260px] flex-col items-center justify-center rounded-lg border border-dashed text-center px-6">
                        <Package className="h-9 w-9 text-muted-foreground/40 mb-2" />
                        <p className="text-sm font-medium text-foreground">Belum Ada Pergerakan Stok</p>
                        <p className="text-xs text-muted-foreground mt-1">
                            Data stok masuk dari penerimaan PO dan stok keluar 7 hari terakhir akan muncul di sini.
                        </p>
                    </div>
                ) : (
                    <ChartContainer config={stockMovementConfig} className="h-[260px] w-full aspect-auto">
                        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                            <CartesianGrid vertical={false} strokeDasharray="3 3" />
                            <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} />
                            <YAxis tickLine={false} axisLine={false} width={44} />
                            <ChartTooltip content={<ChartTooltipContent indicator="dot" />} />
                            <Bar dataKey="stock_in" fill="var(--color-stock_in)" radius={[4, 4, 0, 0]} />
                            <Bar dataKey="stock_out" fill="var(--color-stock_out)" radius={[4, 4, 0, 0]} />
                            <ChartLegend content={<ChartLegendContent />} />
                        </BarChart>
                    </ChartContainer>
                )}
            </CardContent>
        </Card>
    )
}

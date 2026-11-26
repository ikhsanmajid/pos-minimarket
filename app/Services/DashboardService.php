<?php

namespace App\Services;

use App\Enums\CashierShiftStatus;
use App\Enums\FinancialAccountType;
use App\Enums\PaymentMethod;
use App\Enums\PaymentStatus;
use App\Enums\PurchaseOrderStatus;
use App\Enums\ReceivingStatus;
use App\Enums\StockMovementType;
use App\Models\AccountPayable;
use App\Models\CashierShift;
use App\Models\FinancialAccount;
use App\Models\Product;
use App\Models\PurchaseOrder;
use App\Models\StockMovement;
use App\Models\Transaction;
use App\Models\TransactionDetail;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Spatie\Activitylog\Models\Activity;

class DashboardService
{
    /**
     * Resolusi rentang periode filter dashboard global.
     *
     * @return array{
     *     preset: string,
     *     start: CarbonImmutable,
     *     end: CarbonImmutable,
     *     prev_start: CarbonImmutable,
     *     prev_end: CarbonImmutable,
     *     start_date: string,
     *     end_date: string,
     *     label: string
     * }
     */
    public function resolvePeriod(Request $request): array
    {
        $preset = (string) $request->input('period', '7d');
        $now = CarbonImmutable::now();

        if ($preset === 'today') {
            $start = $now->startOfDay();
            $end = $now->endOfDay();
            $label = 'Hari Ini';
        } elseif ($preset === 'month') {
            $start = $now->startOfMonth();
            $end = $now->endOfDay();
            $label = 'Bulan Ini';
        } elseif ($preset === 'custom' && $request->filled('start_date') && $request->filled('end_date')) {
            try {
                $parsedStart = CarbonImmutable::parse((string) $request->input('start_date'))->startOfDay();
                $parsedEnd = CarbonImmutable::parse((string) $request->input('end_date'))->endOfDay();
                if ($parsedEnd->lessThan($parsedStart)) {
                    [$parsedStart, $parsedEnd] = [$parsedEnd->startOfDay(), $parsedStart->endOfDay()];
                }
                // Batasi maksimal 90 hari agar agregasi tetap cepat
                if ($parsedStart->diffInDays($parsedEnd) > 90) {
                    $parsedStart = $parsedEnd->subDays(89)->startOfDay();
                }
                $start = $parsedStart;
                $end = $parsedEnd;
                $label = $start->format('d M Y').' - '.$end->format('d M Y');
            } catch (\Throwable) {
                $preset = '7d';
                $start = $now->subDays(6)->startOfDay();
                $end = $now->endOfDay();
                $label = '7 Hari Terakhir';
            }
        } else {
            $preset = '7d';
            $start = $now->subDays(6)->startOfDay();
            $end = $now->endOfDay();
            $label = '7 Hari Terakhir';
        }

        $spanDays = max(1, (int) $start->startOfDay()->diffInDays($end->startOfDay()) + 1);
        $prevEnd = $start->subDay()->endOfDay();
        $prevStart = $prevEnd->subDays($spanDays - 1)->startOfDay();

        return [
            'preset' => $preset,
            'start' => $start,
            'end' => $end,
            'prev_start' => $prevStart,
            'prev_end' => $prevEnd,
            'start_date' => $start->toDateString(),
            'end_date' => $end->toDateString(),
            'label' => $label,
        ];
    }

    /**
     * Ringkasan KPI ringan untuk role Admin (dikirim pada initial response).
     *
     * @param  array{start: CarbonImmutable, end: CarbonImmutable, prev_start: CarbonImmutable, prev_end: CarbonImmutable}  $period
     * @return array<string, mixed>
     */
    public function getAdminImmediateData(array $period): array
    {
        $currentSales = $this->getSalesMetrics($period['start'], $period['end']);
        $previousSales = $this->getSalesMetrics($period['prev_start'], $period['prev_end']);

        $currentProfit = $this->getGrossProfitMetrics($period['start'], $period['end'], $currentSales['net_sales']);
        $previousProfit = $this->getGrossProfitMetrics($period['prev_start'], $period['prev_end'], $previousSales['net_sales']);

        $accountsSummary = FinancialAccount::query()
            ->where('is_active', true)
            ->selectRaw('type, COALESCE(SUM(current_balance), 0) as balance, COUNT(*) as total_count')
            ->groupBy('type')
            ->get();

        $cashTotal = 0.0;
        $bankTotal = 0.0;
        $ewalletTotal = 0.0;
        $accountsCount = 0;

        foreach ($accountsSummary as $row) {
            $bal = round((float) $row->balance, 2);
            $accountsCount += (int) $row->total_count;
            $typeVal = $row->type instanceof FinancialAccountType ? $row->type->value : (string) $row->type;
            if ($typeVal === FinancialAccountType::Cash->value) {
                $cashTotal = $bal;
            } elseif ($typeVal === FinancialAccountType::Bank->value) {
                $bankTotal = $bal;
            } elseif ($typeVal === FinancialAccountType::Ewallet->value) {
                $ewalletTotal = $bal;
            }
        }

        $dueLimit = CarbonImmutable::now()->addDays(7)->toDateString();
        $todayStr = CarbonImmutable::today()->toDateString();

        $payableBase = AccountPayable::query()
            ->where('status', '!=', PaymentStatus::Paid->value)
            ->where('remaining_amount', '>', 0);

        $totalApRemaining = round((float) (clone $payableBase)->sum('remaining_amount'), 2);
        $unpaidApCount = (clone $payableBase)->count();
        $dueSoonApCount = (clone $payableBase)
            ->whereNotNull('due_date')
            ->whereDate('due_date', '<=', $dueLimit)
            ->count();
        $overdueApCount = (clone $payableBase)
            ->whereNotNull('due_date')
            ->whereDate('due_date', '<', $todayStr)
            ->count();

        $alertCounts = [
            'pending_po' => PurchaseOrder::where('status', PurchaseOrderStatus::PendingApproval->value)->count(),
            'low_stock' => Product::where('active', true)->whereColumn('stock', '<=', 'min_stock')->count(),
            'due_payables' => $dueSoonApCount,
            'shift_anomalies' => CashierShift::where('status', CashierShiftStatus::Closed->value)
                ->where('closed_at', '>=', CarbonImmutable::now()->subDays(7))
                ->whereNotNull('cash_variance')
                ->where('cash_variance', '!=', 0)
                ->count(),
        ];

        return [
            'kpis' => [
                'net_sales' => [
                    'value' => $currentSales['net_sales'],
                    'previous' => $previousSales['net_sales'],
                    'growth_pct' => $this->calculateGrowth($currentSales['net_sales'], $previousSales['net_sales']),
                    'transactions_count' => $currentSales['transactions_count'],
                    'avg_basket_size' => $currentSales['avg_basket_size'],
                ],
                'gross_profit' => [
                    'value' => $currentProfit['gross_profit'],
                    'previous' => $previousProfit['gross_profit'],
                    'growth_pct' => $this->calculateGrowth($currentProfit['gross_profit'], $previousProfit['gross_profit']),
                    'margin_pct' => $currentProfit['margin_pct'],
                    'cogs' => $currentProfit['cogs'],
                ],
                'cash_bank_balance' => [
                    'total' => round($cashTotal + $bankTotal + $ewalletTotal, 2),
                    'cash_total' => $cashTotal,
                    'bank_total' => round($bankTotal + $ewalletTotal, 2),
                    'accounts_count' => $accountsCount,
                ],
                'active_payables' => [
                    'total_remaining' => $totalApRemaining,
                    'unpaid_count' => $unpaidApCount,
                    'due_soon_count' => $dueSoonApCount,
                    'overdue_count' => $overdueApCount,
                ],
            ],
            'alertCounts' => $alertCounts,
            'activeShifts' => $this->getActiveShiftsSnapshot(),
        ];
    }

    /**
     * Grafik Tren Penjualan Bersih vs Estimasi Laba Kotor (Deferred untuk Admin).
     *
     * @param  array{start: CarbonImmutable, end: CarbonImmutable}  $period
     * @return array<int, array{date: string, label: string, net_sales: float, gross_profit: float, transactions_count: int}>
     */
    public function getSalesProfitTrend(array $period, bool $includeProfit = true): array
    {
        $salesByDate = Transaction::query()
            ->whereBetween('created_at', [$period['start'], $period['end']])
            ->whereIn('status', CashierShiftService::COMPLETED_TRANSACTION_STATUSES)
            ->selectRaw('DATE(created_at) as tx_date, COUNT(*) as tx_count, COALESCE(SUM(grand_total), 0) as net_sales')
            ->groupBy(DB::raw('DATE(created_at)'))
            ->get()
            ->keyBy('tx_date');

        $cogsByDate = collect();
        if ($includeProfit) {
            $cogsByDate = TransactionDetail::query()
                ->join('transactions', 'transactions.id', '=', 'transaction_details.transaction_id')
                ->whereBetween('transactions.created_at', [$period['start'], $period['end']])
                ->whereIn('transactions.status', CashierShiftService::COMPLETED_TRANSACTION_STATUSES)
                ->selectRaw("DATE(transactions.created_at) as tx_date, COALESCE(SUM(transaction_details.buy_price * CAST(COALESCE(NULLIF(transaction_details.quantity, ''), '0') AS NUMERIC)), 0) as total_cogs")
                ->groupBy(DB::raw('DATE(transactions.created_at)'))
                ->pluck('total_cogs', 'tx_date');
        }

        $series = [];
        $cursor = $period['start']->startOfDay();
        $endDay = $period['end']->startOfDay();

        while ($cursor->lessThanOrEqualTo($endDay)) {
            $dateKey = $cursor->toDateString();
            $row = $salesByDate->get($dateKey);
            $netSales = $row ? round((float) $row->net_sales, 2) : 0.0;
            $txCount = $row ? (int) $row->tx_count : 0;
            $cogs = $includeProfit ? round((float) ($cogsByDate[$dateKey] ?? 0), 2) : 0.0;
            $grossProfit = $includeProfit ? round(max(0, $netSales - $cogs), 2) : 0.0;

            $series[] = [
                'date' => $dateKey,
                'label' => $cursor->format('d M'),
                'net_sales' => $netSales,
                'gross_profit' => $grossProfit,
                'transactions_count' => $txCount,
            ];

            $cursor = $cursor->addDay();
        }

        return $series;
    }

    /**
     * Komposisi Metode Pembayaran untuk Donut Chart (Deferred untuk Admin).
     *
     * @param  array{start: CarbonImmutable, end: CarbonImmutable}  $period
     * @return array{total: float, transactions_count: int, items: array<int, array{method: string, label: string, count: int, amount: float, percentage: float}>}
     */
    public function getPaymentMethodComposition(array $period): array
    {
        $rows = Transaction::query()
            ->whereBetween('created_at', [$period['start'], $period['end']])
            ->whereIn('status', CashierShiftService::COMPLETED_TRANSACTION_STATUSES)
            ->selectRaw('LOWER(payment_method) as method_key, COUNT(*) as tx_count, COALESCE(SUM(grand_total), 0) as total_amount')
            ->groupBy(DB::raw('LOWER(payment_method)'))
            ->orderByDesc('total_amount')
            ->get();

        $grandTotal = round((float) $rows->sum('total_amount'), 2);
        $totalCount = (int) $rows->sum('tx_count');

        $items = $rows->map(function (object $row) use ($grandTotal): array {
            $methodKey = (string) ($row->method_key ?? 'other');
            $enum = PaymentMethod::tryFrom($methodKey);
            $amount = round((float) ($row->total_amount ?? 0), 2);
            $pct = $grandTotal > 0 ? round(($amount / $grandTotal) * 100, 1) : 0.0;

            return [
                'method' => $enum ? $enum->value : 'other',
                'label' => $enum ? $enum->label() : ucfirst($methodKey),
                'count' => (int) ($row->tx_count ?? 0),
                'amount' => $amount,
                'percentage' => $pct,
            ];
        })->values()->all();

        return [
            'total' => $grandTotal,
            'transactions_count' => $totalCount,
            'items' => $items,
        ];
    }

    /**
     * Daftar Actionable Alerts (Deferred untuk Admin & Supervisor).
     *
     * @return array<string, array<int, array<string, mixed>>>
     */
    public function getActionableAlerts(bool $includePayables = true): array
    {
        $pendingPos = PurchaseOrder::query()
            ->where('status', PurchaseOrderStatus::PendingApproval->value)
            ->with('supplier:id,name')
            ->orderBy('order_date')
            ->limit(6)
            ->get()
            ->map(fn (PurchaseOrder $po): array => [
                'id' => $po->id,
                'po_number' => $po->po_number,
                'supplier_name' => $po->supplier?->name ?? '-',
                'total_amount' => (float) $po->total_amount,
                'order_date' => $po->order_date?->format('d M Y') ?? '-',
            ])
            ->values()
            ->all();

        $lowStockProducts = Product::query()
            ->where('active', true)
            ->whereColumn('stock', '<=', 'min_stock')
            ->orderByRaw('(stock - min_stock) ASC')
            ->limit(8)
            ->get(['id', 'name', 'barcode', 'stock', 'min_stock', 'base_unit'])
            ->map(fn (Product $p): array => [
                'id' => $p->id,
                'name' => $p->name,
                'barcode' => $p->barcode,
                'stock' => (int) $p->stock,
                'min_stock' => (int) $p->min_stock,
                'base_unit' => $p->base_unit ?: 'pcs',
            ])
            ->values()
            ->all();

        $shiftAnomalies = CashierShift::query()
            ->where('status', CashierShiftStatus::Closed->value)
            ->where('closed_at', '>=', CarbonImmutable::now()->subDays(7))
            ->whereNotNull('cash_variance')
            ->where('cash_variance', '!=', 0)
            ->with('user:id,name')
            ->orderByDesc('closed_at')
            ->limit(6)
            ->get()
            ->map(fn (CashierShift $s): array => [
                'id' => $s->id,
                'shift_number' => $s->shift_number,
                'register_name' => $s->register_name,
                'cashier_name' => $s->user?->name ?? '-',
                'closed_at' => $s->closed_at?->format('d M Y H:i') ?? '-',
                'cash_variance' => (float) $s->cash_variance,
            ])
            ->values()
            ->all();

        $result = [
            'pending_pos' => $pendingPos,
            'low_stock_products' => $lowStockProducts,
            'shift_anomalies' => $shiftAnomalies,
        ];

        if ($includePayables) {
            $dueLimit = CarbonImmutable::now()->addDays(7)->toDateString();

            $result['due_payables'] = AccountPayable::query()
                ->where('status', '!=', PaymentStatus::Paid->value)
                ->where('remaining_amount', '>', 0)
                ->whereNotNull('due_date')
                ->whereDate('due_date', '<=', $dueLimit)
                ->with(['supplier:id,name', 'purchaseOrder:id,po_number'])
                ->orderBy('due_date')
                ->limit(6)
                ->get()
                ->map(fn (AccountPayable $ap): array => [
                    'id' => $ap->id,
                    'payable_number' => $ap->payable_number,
                    'po_number' => $ap->purchaseOrder?->po_number ?? '-',
                    'supplier_name' => $ap->supplier?->name ?? '-',
                    'remaining_amount' => (float) $ap->remaining_amount,
                    'due_date' => $ap->due_date?->format('d M Y') ?? '-',
                    'is_overdue' => $ap->isOverdue(),
                ])
                ->values()
                ->all();
        }

        return $result;
    }

    /**
     * Top 5 Produk Terlaris dalam satuan dasar + omzet (Deferred untuk Admin).
     *
     * @param  array{start: CarbonImmutable, end: CarbonImmutable}  $period
     * @return array<int, array{product_id: int, name: string, base_unit: string, qty_sold: float, revenue: float, share_pct: float}>
     */
    public function getTopProducts(array $period, int $limit = 5): array
    {
        $rows = TransactionDetail::query()
            ->join('transactions', 'transactions.id', '=', 'transaction_details.transaction_id')
            ->join('products', 'products.id', '=', 'transaction_details.product_id')
            ->whereBetween('transactions.created_at', [$period['start'], $period['end']])
            ->whereIn('transactions.status', CashierShiftService::COMPLETED_TRANSACTION_STATUSES)
            ->selectRaw("
                transaction_details.product_id,
                products.name as product_name,
                products.base_unit,
                COALESCE(SUM(CAST(COALESCE(NULLIF(transaction_details.quantity, ''), '0') AS NUMERIC)), 0) as qty_sold,
                COALESCE(SUM(transaction_details.subtotal), 0) as revenue
            ")
            ->groupBy('transaction_details.product_id', 'products.name', 'products.base_unit')
            ->orderByDesc('qty_sold')
            ->orderByDesc('revenue')
            ->limit($limit)
            ->get();

        $maxRevenue = (float) ($rows->max('revenue') ?? 0);

        return $rows->map(fn (object $r): array => [
            'product_id' => (int) ($r->product_id ?? 0),
            'name' => (string) ($r->product_name ?? '-'),
            'base_unit' => (string) ($r->base_unit ?: 'pcs'),
            'qty_sold' => round((float) ($r->qty_sold ?? 0), 2),
            'revenue' => round((float) ($r->revenue ?? 0), 2),
            'share_pct' => $maxRevenue > 0 ? round(((float) ($r->revenue ?? 0) / $maxRevenue) * 100, 1) : 0.0,
        ])->values()->all();
    }

    /**
     * 8 Aktivitas Kritis Terbaru dari Activity Log (Deferred untuk Admin & Supervisor).
     *
     * @return array<int, array{id: int, log_name: string, event: string|null, description: string, causer_name: string, created_at: string, created_at_human: string}>
     */
    public function getRecentActivities(int $limit = 8, bool $includeFinance = true): array
    {
        $query = Activity::query()
            ->with('causer:id,name')
            ->where('log_name', '!=', 'auth')
            ->latest('id');

        if (! $includeFinance) {
            $query->where('log_name', '!=', 'finance');
        }

        return $query->limit($limit)
            ->get()
            ->map(fn (Activity $act): array => [
                'id' => $act->id,
                'log_name' => (string) ($act->log_name ?? 'default'),
                'event' => $act->event,
                'description' => (string) $act->description,
                'causer_name' => $act->causer instanceof User ? $act->causer->name : 'Sistem',
                'created_at' => $act->created_at?->format('d M Y H:i') ?? '-',
                'created_at_human' => $act->created_at?->diffForHumans() ?? '-',
            ])
            ->values()
            ->all();
    }

    /**
     * Data segera untuk role Supervisor (fokus operasional harian, tanpa data saldo bank/laba owner).
     *
     * @return array<string, mixed>
     */
    public function getSupervisorImmediateData(): array
    {
        $now = CarbonImmutable::now();
        $todaySales = $this->getSalesMetrics($now->startOfDay(), $now->endOfDay());
        $yesterdaySales = $this->getSalesMetrics($now->subDay()->startOfDay(), $now->subDay()->endOfDay());
        $activeShifts = $this->getActiveShiftsSnapshot();

        $lowStockCount = Product::where('active', true)->whereColumn('stock', '<=', 'min_stock')->count();
        $pendingPoCount = PurchaseOrder::where('status', PurchaseOrderStatus::PendingApproval->value)->count();
        $shiftAnomalyCount = CashierShift::where('status', CashierShiftStatus::Closed->value)
            ->where('closed_at', '>=', $now->subDays(7))
            ->whereNotNull('cash_variance')
            ->where('cash_variance', '!=', 0)
            ->count();

        return [
            'kpis' => [
                'today_sales' => [
                    'value' => $todaySales['net_sales'],
                    'previous' => $yesterdaySales['net_sales'],
                    'growth_pct' => $this->calculateGrowth($todaySales['net_sales'], $yesterdaySales['net_sales']),
                ],
                'today_transactions' => [
                    'count' => $todaySales['transactions_count'],
                    'avg_basket_size' => $todaySales['avg_basket_size'],
                ],
                'active_shifts_count' => count($activeShifts),
                'shift_anomalies_count' => $shiftAnomalyCount,
            ],
            'alertCounts' => [
                'low_stock' => $lowStockCount,
                'pending_po' => $pendingPoCount,
                'shift_anomalies' => $shiftAnomalyCount,
            ],
            'activeShifts' => $activeShifts,
        ];
    }

    /**
     * Data segera untuk role Warehouse (fokus persediaan & penerimaan, nol data finansial/penjualan).
     *
     * @return array<string, mixed>
     */
    public function getWarehouseImmediateData(): array
    {
        $activeSkuCount = Product::where('active', true)->count();
        $lowStockCount = Product::where('active', true)->whereColumn('stock', '<=', 'min_stock')->count();
        $poReadyReceiveCount = PurchaseOrder::where('status', PurchaseOrderStatus::Approved->value)
            ->whereIn('receiving_status', [ReceivingStatus::Unreceived->value, ReceivingStatus::Partial->value])
            ->count();
        $poRejectedCount = PurchaseOrder::where('status', PurchaseOrderStatus::Rejected->value)->count();

        return [
            'kpis' => [
                'active_sku_count' => $activeSkuCount,
                'low_stock_count' => $lowStockCount,
                'po_ready_receive_count' => $poReadyReceiveCount,
                'po_rejected_count' => $poRejectedCount,
            ],
        ];
    }

    /**
     * Data deferred untuk role Warehouse (grafik pergerakan stok 7 hari, PO siap terima, PO ditolak, stok kritis).
     *
     * @return array<string, mixed>
     */
    public function getWarehouseDeferredData(): array
    {
        $now = CarbonImmutable::now();
        $start = $now->subDays(6)->startOfDay();
        $end = $now->endOfDay();

        $movementRows = StockMovement::query()
            ->whereBetween('created_at', [$start, $end])
            ->selectRaw('DATE(created_at) as move_date, type, COALESCE(SUM(ABS(qty_change)), 0) as total_qty')
            ->groupBy(DB::raw('DATE(created_at)'), 'type')
            ->get();

        $inTypes = [
            StockMovementType::PurchaseIn->value,
            StockMovementType::AdjustmentIn->value,
            StockMovementType::SaleReturnIn->value,
        ];

        $grouped = [];
        foreach ($movementRows as $row) {
            $dateKey = (string) $row->move_date;
            if (! isset($grouped[$dateKey])) {
                $grouped[$dateKey] = ['stock_in' => 0, 'stock_out' => 0];
            }
            $qty = (int) $row->total_qty;
            $moveType = $row->type instanceof StockMovementType ? $row->type->value : (string) $row->type;
            if (in_array($moveType, $inTypes, true)) {
                $grouped[$dateKey]['stock_in'] += $qty;
            } else {
                $grouped[$dateKey]['stock_out'] += $qty;
            }
        }

        $stockTrend = [];
        $cursor = $start;
        while ($cursor->lessThanOrEqualTo($end)) {
            $dateKey = $cursor->toDateString();
            $stockTrend[] = [
                'date' => $dateKey,
                'label' => $cursor->format('d M'),
                'stock_in' => $grouped[$dateKey]['stock_in'] ?? 0,
                'stock_out' => $grouped[$dateKey]['stock_out'] ?? 0,
            ];
            $cursor = $cursor->addDay();
        }

        $pendingReceivingPos = PurchaseOrder::query()
            ->where('status', PurchaseOrderStatus::Approved->value)
            ->whereIn('receiving_status', [ReceivingStatus::Unreceived->value, ReceivingStatus::Partial->value])
            ->with('supplier:id,name')
            ->orderBy('expected_date')
            ->orderBy('order_date')
            ->limit(8)
            ->get()
            ->map(fn (PurchaseOrder $po): array => [
                'id' => $po->id,
                'po_number' => $po->po_number,
                'supplier_name' => $po->supplier?->name ?? '-',
                'receiving_status' => $po->receiving_status->value,
                'receiving_status_label' => $po->receiving_status->label(),
                'order_date' => $po->order_date?->format('d M Y') ?? '-',
                'expected_date' => $po->expected_date?->format('d M Y'),
            ])
            ->values()
            ->all();

        $rejectedPos = PurchaseOrder::query()
            ->where('status', PurchaseOrderStatus::Rejected->value)
            ->with('supplier:id,name')
            ->latest('rejected_at')
            ->limit(5)
            ->get()
            ->map(fn (PurchaseOrder $po): array => [
                'id' => $po->id,
                'po_number' => $po->po_number,
                'supplier_name' => $po->supplier?->name ?? '-',
                'rejection_reason' => $po->rejection_reason ?? '-',
                'rejected_at' => $po->rejected_at?->format('d M Y H:i') ?? '-',
            ])
            ->values()
            ->all();

        $lowStockProducts = Product::query()
            ->where('active', true)
            ->whereColumn('stock', '<=', 'min_stock')
            ->orderByRaw('(stock - min_stock) ASC')
            ->limit(10)
            ->get(['id', 'name', 'barcode', 'stock', 'min_stock', 'base_unit'])
            ->map(fn (Product $p): array => [
                'id' => $p->id,
                'name' => $p->name,
                'barcode' => $p->barcode,
                'stock' => (int) $p->stock,
                'min_stock' => (int) $p->min_stock,
                'base_unit' => $p->base_unit ?: 'pcs',
            ])
            ->values()
            ->all();

        return [
            'stockMovementTrend' => $stockTrend,
            'pendingReceivingPos' => $pendingReceivingPos,
            'rejectedPos' => $rejectedPos,
            'lowStockProducts' => $lowStockProducts,
        ];
    }

    /**
     * Data khusus untuk role Cashier (fokus kesiapan shift pribadi, nol angka finansial toko).
     *
     * @return array<string, mixed>
     */
    public function getCashierData(User $user): array
    {
        $activeShift = CashierShift::query()
            ->where('user_id', $user->id)
            ->where('status', CashierShiftStatus::Open->value)
            ->latest('opened_at')
            ->first();

        $todayTransactionsCount = Transaction::query()
            ->where('user_id', $user->id)
            ->whereDate('created_at', CarbonImmutable::today()->toDateString())
            ->whereIn('status', CashierShiftService::COMPLETED_TRANSACTION_STATUSES)
            ->count();

        $activeShiftTransactionsCount = $activeShift
            ? Transaction::query()
                ->where('cashier_shift_id', $activeShift->id)
                ->whereIn('status', CashierShiftService::COMPLETED_TRANSACTION_STATUSES)
                ->count()
            : 0;

        $recentOwnShifts = CashierShift::query()
            ->where('user_id', $user->id)
            ->where('status', CashierShiftStatus::Closed->value)
            ->latest('closed_at')
            ->limit(5)
            ->get()
            ->map(fn (CashierShift $s): array => [
                'id' => $s->id,
                'shift_number' => $s->shift_number,
                'register_name' => $s->register_name,
                'opened_at' => $s->opened_at->format('d M Y H:i'),
                'closed_at' => $s->closed_at?->format('d M Y H:i') ?? '-',
                'total_transactions' => (int) $s->total_transactions,
                'cash_variance' => (float) $s->cash_variance,
            ])
            ->values()
            ->all();

        return [
            'myShift' => $activeShift ? [
                'id' => $activeShift->id,
                'shift_number' => $activeShift->shift_number,
                'register_name' => $activeShift->register_name,
                'opened_at' => $activeShift->opened_at->format('d M Y H:i'),
                'opened_at_human' => $activeShift->opened_at->diffForHumans(),
                'starting_cash' => (float) $activeShift->starting_cash,
                'transactions_count' => $activeShiftTransactionsCount,
            ] : null,
            'myTodayTransactionsCount' => $todayTransactionsCount,
            'myRecentShifts' => $recentOwnShifts,
        ];
    }

    /**
     * Daftar shift yang sedang berstatus open di toko.
     *
     * @return array<int, array{id: int, shift_number: string, register_name: string, cashier_name: string, opened_at: string, opened_at_human: string, transactions_count: int}>
     */
    private function getActiveShiftsSnapshot(): array
    {
        return CashierShift::query()
            ->where('status', CashierShiftStatus::Open->value)
            ->with('user:id,name')
            ->withCount([
                'transactions as completed_transactions_count' => fn ($q) => $q->whereIn('status', CashierShiftService::COMPLETED_TRANSACTION_STATUSES),
            ])
            ->orderBy('opened_at')
            ->get()
            ->map(fn (CashierShift $s): array => [
                'id' => $s->id,
                'shift_number' => $s->shift_number,
                'register_name' => $s->register_name,
                'cashier_name' => $s->user?->name ?? '-',
                'opened_at' => $s->opened_at->format('d M Y H:i'),
                'opened_at_human' => $s->opened_at->diffForHumans(),
                'transactions_count' => (int) ($s->completed_transactions_count ?? 0),
            ])
            ->values()
            ->all();
    }

    /**
     * @return array{net_sales: float, transactions_count: int, avg_basket_size: float}
     */
    private function getSalesMetrics(CarbonImmutable $start, CarbonImmutable $end): array
    {
        $row = Transaction::query()
            ->whereBetween('created_at', [$start, $end])
            ->whereIn('status', CashierShiftService::COMPLETED_TRANSACTION_STATUSES)
            ->selectRaw('COUNT(*) as tx_count, COALESCE(SUM(grand_total), 0) as net_sales')
            ->first();

        $netSales = round((float) ($row->net_sales ?? 0), 2);
        $txCount = (int) ($row->tx_count ?? 0);
        $avgBasket = $txCount > 0 ? round($netSales / $txCount, 2) : 0.0;

        return [
            'net_sales' => $netSales,
            'transactions_count' => $txCount,
            'avg_basket_size' => $avgBasket,
        ];
    }

    /**
     * @return array{cogs: float, gross_profit: float, margin_pct: float}
     */
    private function getGrossProfitMetrics(CarbonImmutable $start, CarbonImmutable $end, float $netSales): array
    {
        $cogs = round((float) TransactionDetail::query()
            ->join('transactions', 'transactions.id', '=', 'transaction_details.transaction_id')
            ->whereBetween('transactions.created_at', [$start, $end])
            ->whereIn('transactions.status', CashierShiftService::COMPLETED_TRANSACTION_STATUSES)
            ->selectRaw("COALESCE(SUM(transaction_details.buy_price * CAST(COALESCE(NULLIF(transaction_details.quantity, ''), '0') AS NUMERIC)), 0) as total_cogs")
            ->value('total_cogs'), 2);

        $grossProfit = round($netSales - $cogs, 2);
        $marginPct = $netSales > 0 ? round(($grossProfit / $netSales) * 100, 1) : 0.0;

        return [
            'cogs' => $cogs,
            'gross_profit' => $grossProfit,
            'margin_pct' => $marginPct,
        ];
    }

    private function calculateGrowth(float $current, float $previous): ?float
    {
        if (abs($previous) < 0.01) {
            return $current > 0 ? 100.0 : 0.0;
        }

        return round((($current - $previous) / abs($previous)) * 100, 1);
    }
}

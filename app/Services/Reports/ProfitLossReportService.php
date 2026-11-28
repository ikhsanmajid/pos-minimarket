<?php

namespace App\Services\Reports;

use App\Enums\FinancialTransactionType;
use App\Enums\SalesReturnStatus;
use App\Enums\StockAdjustmentReason;
use App\Enums\StockAdjustmentStatus;
use App\Enums\StockAdjustmentType;
use App\Enums\StockOpnameStatus;
use App\Enums\TransactionStatus;
use App\Models\FinancialTransaction;
use App\Models\SalesReturn;
use App\Models\SalesReturnItem;
use App\Models\StockAdjustment;
use App\Models\StockOpname;
use App\Models\StockOpnameItem;
use App\Models\Transaction;
use App\Models\TransactionDetail;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Pagination\LengthAwarePaginator;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

class ProfitLossReportService
{
    public function __construct(public ReportPeriodResolver $periodResolver) {}

    /**
     * @param  array<string, mixed>  $filters
     * @return array<string, mixed>
     */
    public function getReportData(array $filters, bool $paginate = true): array
    {
        $period = $this->periodResolver->resolve($filters, 'this_month');
        $categoryId = isset($filters['category_id']) && $filters['category_id'] !== '' ? (int) $filters['category_id'] : null;
        $productId = isset($filters['product_id']) && $filters['product_id'] !== '' ? (int) $filters['product_id'] : null;

        $summary = $this->calculateSummary($period['start'], $period['end'], $categoryId, $productId);
        $trend = $this->getDailyTrend($period['start'], $period['end'], $categoryId, $productId);
        $categoryMargins = $this->getCategoryMargins($period['start'], $period['end'], $categoryId, $productId);
        $products = $this->getProductProfitRows($period['start'], $period['end'], $categoryId, $productId, $filters, $paginate);

        return [
            'period' => [
                'preset' => $period['preset'],
                'start_date' => $period['start_date'],
                'end_date' => $period['end_date'],
                'label' => $period['label'],
                'days' => $period['days'],
            ],
            'summary' => $summary,
            'trend' => $trend,
            'categoryMargins' => $categoryMargins,
            'products' => $products,
        ];
    }

    /**
     * @return array{
     *     gross_revenue: float,
     *     total_returns: float,
     *     net_revenue: float,
     *     gross_cogs: float,
     *     restockable_return_cogs: float,
     *     net_cogs: float,
     *     gross_profit: float,
     *     gross_margin_pct: float,
     *     adjustment_loss: float,
     *     opname_loss: float,
     *     total_shrinkage: float,
     *     operational_expense: float,
     *     estimated_operating_profit: float
     * }
     */
    private function calculateSummary(
        CarbonImmutable $start,
        CarbonImmutable $end,
        ?int $categoryId,
        ?int $productId
    ): array {
        if ($categoryId !== null || $productId !== null) {
            $grossRevenue = round((float) $this->baseDetailQuery($start, $end, $categoryId, $productId)->sum('transaction_details.subtotal'), 2);
            $totalReturns = round((float) $this->baseReturnItemQuery($start, $end, $categoryId, $productId)->sum('sales_return_items.subtotal_refund'), 2);
        } else {
            // Omzet bersih eksklusif PPN & donasi agar margin laba kotor tidak terdistorsi pajak titipan
            $grossRevenue = round((float) Transaction::query()
                ->whereBetween('created_at', [$start, $end])
                ->where('status', '!=', TransactionStatus::Voided->value)
                ->selectRaw('COALESCE(SUM(grand_total - tax_amount - donation_amount), 0) as net_ex_tax')
                ->value('net_ex_tax'), 2);

            $totalReturns = round((float) SalesReturn::query()
                ->whereBetween('created_at', [$start, $end])
                ->where('status', SalesReturnStatus::Completed->value)
                ->sum('total_refund_amount'), 2);
        }

        $netRevenue = round(max(0.0, $grossRevenue - $totalReturns), 2);

        $grossCogs = round((float) $this->baseDetailQuery($start, $end, $categoryId, $productId)
            ->selectRaw("COALESCE(SUM({$this->detailCogsExpression()}), 0) as total_cogs")
            ->value('total_cogs'), 2);

        // Hanya item retur yang is_restockable = true yang mengurangi HPP (kembali ke persediaan)
        $restockableReturnCogs = round((float) $this->baseReturnItemQuery($start, $end, $categoryId, $productId)
            ->where('sales_return_items.is_restockable', true)
            ->selectRaw("COALESCE(SUM(sales_return_items.base_qty * {$this->unitCostSnapshotExpression()}), 0) as restock_cogs")
            ->value('restock_cogs'), 2);

        $netCogs = round(max(0.0, $grossCogs - $restockableReturnCogs), 2);
        $grossProfit = round($netRevenue - $netCogs, 2);
        $grossMarginPct = $netRevenue > 0 ? round(($grossProfit / $netRevenue) * 100, 2) : 0.0;

        // Dampak kerugian stok (Shrinkage) terpisah dari Laba Kotor
        $lossReasons = [
            StockAdjustmentReason::Damaged->value,
            StockAdjustmentReason::Expired->value,
            StockAdjustmentReason::Lost->value,
        ];

        $adjustmentLoss = round((float) StockAdjustment::query()
            ->join('products', 'products.id', '=', 'stock_adjustments.product_id')
            ->whereBetween('stock_adjustments.created_at', [$start, $end])
            ->where('stock_adjustments.status', StockAdjustmentStatus::Approved->value)
            ->where('stock_adjustments.type', StockAdjustmentType::Out->value)
            ->whereIn('stock_adjustments.reason', $lossReasons)
            ->when($categoryId !== null, fn (Builder $q) => $q->where('products.category_id', $categoryId))
            ->when($productId !== null, fn (Builder $q) => $q->where('stock_adjustments.product_id', $productId))
            ->selectRaw('COALESCE(SUM(ABS(stock_adjustments.total_cost_impact)), 0) as total_loss')
            ->value('total_loss'), 2);

        if ($categoryId !== null || $productId !== null) {
            $opnameLoss = round((float) StockOpnameItem::query()
                ->join('stock_opnames', 'stock_opnames.id', '=', 'stock_opname_items.stock_opname_id')
                ->join('products', 'products.id', '=', 'stock_opname_items.product_id')
                ->where('stock_opnames.status', StockOpnameStatus::Completed->value)
                ->whereBetween('stock_opnames.completed_at', [$start, $end])
                ->where('stock_opname_items.variance_value', '<', 0)
                ->when($categoryId !== null, fn (Builder $q) => $q->where('products.category_id', $categoryId))
                ->when($productId !== null, fn (Builder $q) => $q->where('stock_opname_items.product_id', $productId))
                ->selectRaw('COALESCE(SUM(ABS(stock_opname_items.variance_value)), 0) as total_loss')
                ->value('total_loss'), 2);
        } else {
            $opnameLoss = round((float) StockOpname::query()
                ->where('status', StockOpnameStatus::Completed->value)
                ->whereBetween('completed_at', [$start, $end])
                ->where('total_variance_value', '<', 0)
                ->selectRaw('COALESCE(SUM(ABS(total_variance_value)), 0) as total_loss')
                ->value('total_loss'), 2);
        }

        $totalShrinkage = round($adjustmentLoss + $opnameLoss, 2);

        // Pengeluaran operasional (di luar pelunasan hutang / pembelian stok EXP-PO)
        $operationalExpense = round((float) FinancialTransaction::query()
            ->join('financial_categories', 'financial_categories.id', '=', 'financial_transactions.financial_category_id')
            ->whereBetween('financial_transactions.transaction_date', [$start->toDateString(), $end->toDateString()])
            ->where('financial_transactions.type', FinancialTransactionType::Out->value)
            ->where('financial_categories.code', '!=', 'EXP-PO')
            ->sum('financial_transactions.amount'), 2);

        $estimatedOperatingProfit = round($grossProfit - $totalShrinkage - $operationalExpense, 2);

        return [
            'gross_revenue' => $grossRevenue,
            'total_returns' => $totalReturns,
            'net_revenue' => $netRevenue,
            'gross_cogs' => $grossCogs,
            'restockable_return_cogs' => $restockableReturnCogs,
            'net_cogs' => $netCogs,
            'gross_profit' => $grossProfit,
            'gross_margin_pct' => $grossMarginPct,
            'adjustment_loss' => $adjustmentLoss,
            'opname_loss' => $opnameLoss,
            'total_shrinkage' => $totalShrinkage,
            'operational_expense' => $operationalExpense,
            'estimated_operating_profit' => $estimatedOperatingProfit,
        ];
    }

    /**
     * @return array<int, array{date: string, label: string, net_revenue: float, net_cogs: float, gross_profit: float}>
     */
    private function getDailyTrend(
        CarbonImmutable $start,
        CarbonImmutable $end,
        ?int $categoryId,
        ?int $productId
    ): array {
        if ($categoryId !== null || $productId !== null) {
            $revByDate = $this->baseDetailQuery($start, $end, $categoryId, $productId)
                ->selectRaw('DATE(transactions.created_at) as tx_date, COALESCE(SUM(transaction_details.subtotal), 0) as rev')
                ->groupBy(DB::raw('DATE(transactions.created_at)'))
                ->pluck('rev', 'tx_date');

            $retByDate = $this->baseReturnItemQuery($start, $end, $categoryId, $productId)
                ->selectRaw('DATE(sales_returns.created_at) as ret_date, COALESCE(SUM(sales_return_items.subtotal_refund), 0) as refund')
                ->groupBy(DB::raw('DATE(sales_returns.created_at)'))
                ->pluck('refund', 'ret_date');
        } else {
            $revByDate = Transaction::query()
                ->whereBetween('created_at', [$start, $end])
                ->where('status', '!=', TransactionStatus::Voided->value)
                ->selectRaw('DATE(created_at) as tx_date, COALESCE(SUM(grand_total - tax_amount - donation_amount), 0) as rev')
                ->groupBy(DB::raw('DATE(created_at)'))
                ->pluck('rev', 'tx_date');

            $retByDate = SalesReturn::query()
                ->whereBetween('created_at', [$start, $end])
                ->where('status', SalesReturnStatus::Completed->value)
                ->selectRaw('DATE(created_at) as ret_date, COALESCE(SUM(total_refund_amount), 0) as refund')
                ->groupBy(DB::raw('DATE(created_at)'))
                ->pluck('refund', 'ret_date');
        }

        $cogsByDate = $this->baseDetailQuery($start, $end, $categoryId, $productId)
            ->selectRaw("DATE(transactions.created_at) as tx_date, COALESCE(SUM({$this->detailCogsExpression()}), 0) as cogs")
            ->groupBy(DB::raw('DATE(transactions.created_at)'))
            ->pluck('cogs', 'tx_date');

        $restockCogsByDate = $this->baseReturnItemQuery($start, $end, $categoryId, $productId)
            ->where('sales_return_items.is_restockable', true)
            ->selectRaw("DATE(sales_returns.created_at) as ret_date, COALESCE(SUM(sales_return_items.base_qty * {$this->unitCostSnapshotExpression()}), 0) as cogs")
            ->groupBy(DB::raw('DATE(sales_returns.created_at)'))
            ->pluck('cogs', 'ret_date');

        $series = [];
        $cursor = $start->startOfDay();
        $endDay = $end->startOfDay();

        while ($cursor->lessThanOrEqualTo($endDay)) {
            $dateKey = $cursor->toDateString();
            $rev = round((float) ($revByDate[$dateKey] ?? 0), 2);
            $ret = round((float) ($retByDate[$dateKey] ?? 0), 2);
            $netRev = round(max(0.0, $rev - $ret), 2);

            $cogs = round((float) ($cogsByDate[$dateKey] ?? 0), 2);
            $restockCogs = round((float) ($restockCogsByDate[$dateKey] ?? 0), 2);
            $netCogs = round(max(0.0, $cogs - $restockCogs), 2);

            $series[] = [
                'date' => $dateKey,
                'label' => $cursor->format('d M'),
                'net_revenue' => $netRev,
                'net_cogs' => $netCogs,
                'gross_profit' => round($netRev - $netCogs, 2),
            ];

            $cursor = $cursor->addDay();
        }

        return $series;
    }

    /**
     * @return array<int, array{category_id: int|null, category_name: string, net_revenue: float, net_cogs: float, gross_profit: float, margin_pct: float}>
     */
    private function getCategoryMargins(
        CarbonImmutable $start,
        CarbonImmutable $end,
        ?int $categoryId,
        ?int $productId
    ): array {
        $rows = $this->baseDetailQuery($start, $end, $categoryId, $productId)
            ->leftJoin('categories', 'categories.id', '=', 'products.category_id')
            ->selectRaw("
                products.category_id,
                COALESCE(categories.name, 'Tanpa Kategori') as category_name,
                COALESCE(SUM(transaction_details.subtotal), 0) as gross_revenue,
                COALESCE(SUM({$this->detailCogsExpression()}), 0) as gross_cogs
            ")
            ->groupBy('products.category_id', 'categories.name')
            ->get();

        $returnsByCategory = $this->baseReturnItemQuery($start, $end, $categoryId, $productId)
            ->selectRaw("
                products.category_id,
                COALESCE(SUM(sales_return_items.subtotal_refund), 0) as refund_amount,
                COALESCE(SUM(CASE WHEN sales_return_items.is_restockable = true THEN sales_return_items.base_qty * {$this->unitCostSnapshotExpression()} ELSE 0 END), 0) as restock_cogs
            ")
            ->groupBy('products.category_id')
            ->get()
            ->keyBy(fn (object $r): string => (string) ($r->category_id ?? 'none'));

        return $rows->map(function (object $row) use ($returnsByCategory): array {
            $key = (string) ($row->category_id ?? 'none');
            $ret = $returnsByCategory->get($key);
            $netRev = round(max(0.0, (float) ($row->gross_revenue ?? 0) - (float) ($ret->refund_amount ?? 0)), 2);
            $netCogs = round(max(0.0, (float) ($row->gross_cogs ?? 0) - (float) ($ret->restock_cogs ?? 0)), 2);
            $profit = round($netRev - $netCogs, 2);

            return [
                'category_id' => $row->category_id !== null ? (int) $row->category_id : null,
                'category_name' => (string) ($row->category_name ?? 'Tanpa Kategori'),
                'net_revenue' => $netRev,
                'net_cogs' => $netCogs,
                'gross_profit' => $profit,
                'margin_pct' => $netRev > 0 ? round(($profit / $netRev) * 100, 2) : 0.0,
            ];
        })->sortByDesc('gross_profit')->values()->all();
    }

    /**
     * @param  array<string, mixed>  $filters
     * @return LengthAwarePaginator<int, array<string, mixed>>|Collection<int, array<string, mixed>>
     */
    private function getProductProfitRows(
        CarbonImmutable $start,
        CarbonImmutable $end,
        ?int $categoryId,
        ?int $productId,
        array $filters,
        bool $paginate
    ): LengthAwarePaginator|Collection {
        $likeOperator = DB::getDriverName() === 'pgsql' ? 'ilike' : 'like';
        $search = isset($filters['search']) && is_string($filters['search']) ? trim($filters['search']) : '';

        $detailRows = $this->baseDetailQuery($start, $end, $categoryId, $productId)
            ->leftJoin('categories', 'categories.id', '=', 'products.category_id')
            ->when($search !== '', function (Builder $q) use ($search, $likeOperator): void {
                $q->where(function (Builder $sub) use ($search, $likeOperator): void {
                    $sub->where('products.name', $likeOperator, "%{$search}%")
                        ->orWhere('products.barcode', $likeOperator, "%{$search}%")
                        ->orWhere('categories.name', $likeOperator, "%{$search}%");
                });
            })
            ->selectRaw("
                transaction_details.product_id,
                products.barcode,
                products.name as product_name,
                products.base_unit,
                COALESCE(categories.name, 'Tanpa Kategori') as category_name,
                COALESCE(SUM(CASE WHEN transaction_details.base_qty > 0 THEN transaction_details.base_qty ELSE CAST(COALESCE(NULLIF(transaction_details.quantity, ''), '0') AS NUMERIC) END), 0) as qty_sold,
                COALESCE(SUM(transaction_details.subtotal), 0) as gross_revenue,
                COALESCE(SUM({$this->detailCogsExpression()}), 0) as gross_cogs
            ")
            ->groupBy(
                'transaction_details.product_id',
                'products.barcode',
                'products.name',
                'products.base_unit',
                'categories.name'
            )
            ->get();

        $returnsByProduct = $this->baseReturnItemQuery($start, $end, $categoryId, $productId)
            ->selectRaw("
                sales_return_items.product_id,
                COALESCE(SUM(sales_return_items.base_qty), 0) as qty_returned,
                COALESCE(SUM(sales_return_items.subtotal_refund), 0) as refund_amount,
                COALESCE(SUM(CASE WHEN sales_return_items.is_restockable = true THEN sales_return_items.base_qty * {$this->unitCostSnapshotExpression()} ELSE 0 END), 0) as restock_cogs
            ")
            ->groupBy('sales_return_items.product_id')
            ->get()
            ->keyBy('product_id');

        $mapped = $detailRows->map(function (object $row) use ($returnsByProduct): array {
            $pid = (int) ($row->product_id ?? 0);
            $ret = $returnsByProduct->get($pid);
            $qtySold = (int) round((float) ($row->qty_sold ?? 0));
            $qtyReturned = $ret ? (int) ($ret->qty_returned ?? 0) : 0;
            $netRevenue = round(max(0.0, (float) ($row->gross_revenue ?? 0) - (float) ($ret->refund_amount ?? 0)), 2);
            $netCogs = round(max(0.0, (float) ($row->gross_cogs ?? 0) - (float) ($ret->restock_cogs ?? 0)), 2);
            $grossProfit = round($netRevenue - $netCogs, 2);

            return [
                'product_id' => $pid,
                'barcode' => (string) ($row->barcode ?? '-'),
                'product_name' => (string) ($row->product_name ?? 'Produk Dihapus'),
                'base_unit' => (string) ($row->base_unit ?: 'pcs'),
                'category_name' => (string) ($row->category_name ?? 'Tanpa Kategori'),
                'qty_sold' => $qtySold,
                'qty_returned' => $qtyReturned,
                'net_revenue' => $netRevenue,
                'net_cogs' => $netCogs,
                'gross_profit' => $grossProfit,
                'margin_pct' => $netRevenue > 0 ? round(($grossProfit / $netRevenue) * 100, 2) : 0.0,
            ];
        });

        $sorted = $this->sortCollection($mapped, $filters, 'gross_profit', 'desc');

        if (! $paginate) {
            return $sorted->values();
        }

        $perPage = isset($filters['per_page']) ? max(5, min(100, (int) $filters['per_page'])) : 15;
        $page = max(1, (int) request()->integer('page', 1));
        $total = $sorted->count();
        $items = $sorted->forPage($page, $perPage)->values();

        return (new LengthAwarePaginator($items, $total, $perPage, $page, [
            'path' => request()->url(),
            'query' => request()->query(),
        ]));
    }

    /**
     * @return Builder<TransactionDetail>
     */
    private function baseDetailQuery(
        CarbonImmutable $start,
        CarbonImmutable $end,
        ?int $categoryId,
        ?int $productId
    ): Builder {
        return TransactionDetail::query()
            ->join('transactions', 'transactions.id', '=', 'transaction_details.transaction_id')
            ->join('products', 'products.id', '=', 'transaction_details.product_id')
            ->whereBetween('transactions.created_at', [$start, $end])
            ->where('transactions.status', '!=', TransactionStatus::Voided->value)
            ->when($categoryId !== null, fn (Builder $q) => $q->where('products.category_id', $categoryId))
            ->when($productId !== null, fn (Builder $q) => $q->where('transaction_details.product_id', $productId));
    }

    /**
     * @return Builder<SalesReturnItem>
     */
    private function baseReturnItemQuery(
        CarbonImmutable $start,
        CarbonImmutable $end,
        ?int $categoryId,
        ?int $productId
    ): Builder {
        return SalesReturnItem::query()
            ->join('sales_returns', 'sales_returns.id', '=', 'sales_return_items.sales_return_id')
            ->join('transaction_details', 'transaction_details.id', '=', 'sales_return_items.transaction_detail_id')
            ->join('products', 'products.id', '=', 'sales_return_items.product_id')
            ->whereBetween('sales_returns.created_at', [$start, $end])
            ->where('sales_returns.status', SalesReturnStatus::Completed->value)
            ->when($categoryId !== null, fn (Builder $q) => $q->where('products.category_id', $categoryId))
            ->when($productId !== null, fn (Builder $q) => $q->where('sales_return_items.product_id', $productId));
    }

    private function unitCostSnapshotExpression(): string
    {
        return 'COALESCE(NULLIF(transaction_details.cost_price_snapshot, 0), transaction_details.buy_price)';
    }

    private function detailCogsExpression(): string
    {
        return "({$this->unitCostSnapshotExpression()} * CASE WHEN transaction_details.cost_price_snapshot > 0 THEN transaction_details.base_qty ELSE CAST(COALESCE(NULLIF(transaction_details.quantity, ''), '0') AS NUMERIC) END)";
    }

    /**
     * @param  Collection<int, array<string, mixed>>  $collection
     * @param  array<string, mixed>  $filters
     * @return Collection<int, array<string, mixed>>
     */
    private function sortCollection(Collection $collection, array $filters, string $defaultKey, string $defaultDir): Collection
    {
        $allowed = ['product_name', 'category_name', 'qty_sold', 'net_revenue', 'net_cogs', 'gross_profit', 'margin_pct'];
        $tableSort = isset($filters['table_sort']) && is_string($filters['table_sort']) && in_array($filters['table_sort'], $allowed, true)
            ? $filters['table_sort']
            : null;
        $tableDir = strtolower((string) ($filters['table_direction'] ?? 'asc')) === 'desc' ? 'desc' : 'asc';

        $toolbarSort = isset($filters['sort']) && is_string($filters['sort']) && in_array($filters['sort'], $allowed, true)
            ? $filters['sort']
            : null;
        $toolbarDir = strtolower((string) ($filters['direction'] ?? 'desc')) === 'asc' ? 'asc' : 'desc';

        $sortKey = $tableSort ?? $toolbarSort ?? $defaultKey;
        $sortDir = $tableSort !== null ? $tableDir : ($toolbarSort !== null ? $toolbarDir : $defaultDir);

        return $collection->sort(function (array $a, array $b) use ($sortKey, $sortDir): int {
            $va = $a[$sortKey] ?? 0;
            $vb = $b[$sortKey] ?? 0;
            $cmp = is_string($va) && is_string($vb)
                ? strcasecmp($va, $vb)
                : ($va <=> $vb);

            return $sortDir === 'desc' ? -$cmp : $cmp;
        })->values();
    }
}

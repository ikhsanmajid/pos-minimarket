<?php

namespace App\Services\Reports;

use App\Enums\PaymentMethod;
use App\Enums\PromotionFunding;
use App\Enums\SalesReturnStatus;
use App\Enums\TransactionStatus;
use App\Models\AppliedPromotion;
use App\Models\SalesReturn;
use App\Models\SalesReturnItem;
use App\Models\Transaction;
use App\Models\TransactionDetail;
use App\Services\CashierShiftService;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Pagination\LengthAwarePaginator;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

class SalesReportService
{
    public function __construct(public ReportPeriodResolver $periodResolver) {}

    /**
     * @param  array<string, mixed>  $filters
     * @return array<string, mixed>
     */
    public function getReportData(array $filters, bool $paginate = true): array
    {
        $period = $this->periodResolver->resolve($filters, 'this_month');
        $cashierId = isset($filters['cashier_id']) && $filters['cashier_id'] !== '' ? (int) $filters['cashier_id'] : null;
        $categoryId = isset($filters['category_id']) && $filters['category_id'] !== '' ? (int) $filters['category_id'] : null;
        $productId = isset($filters['product_id']) && $filters['product_id'] !== '' ? (int) $filters['product_id'] : null;
        $paymentMethod = isset($filters['payment_method']) && is_string($filters['payment_method']) && $filters['payment_method'] !== '' && $filters['payment_method'] !== 'all'
            ? $filters['payment_method']
            : null;

        $summary = $this->calculateSummary($period['start'], $period['end'], $cashierId, $categoryId, $productId, $paymentMethod);
        $dailyTrend = $this->getDailyTrend($period['start'], $period['end'], $cashierId, $categoryId, $productId, $paymentMethod);
        $paymentBreakdown = $this->getPaymentMethodBreakdown($period['start'], $period['end'], $cashierId, $categoryId, $productId, $paymentMethod);
        $cashierBreakdown = $this->getCashierBreakdown($period['start'], $period['end'], $cashierId, $categoryId, $productId, $paymentMethod);
        $promotionFundingBreakdown = $this->getPromotionFundingBreakdown($period['start'], $period['end'], $cashierId, $categoryId, $productId, $paymentMethod);
        $productDetails = $this->getProductSales($period['start'], $period['end'], $cashierId, $categoryId, $productId, $paymentMethod, $filters, $paginate);

        return [
            'period' => [
                'preset' => $period['preset'],
                'start_date' => $period['start_date'],
                'end_date' => $period['end_date'],
                'label' => $period['label'],
                'days' => $period['days'],
            ],
            'summary' => $summary,
            'dailyTrend' => $dailyTrend,
            'paymentBreakdown' => $paymentBreakdown,
            'cashierBreakdown' => $cashierBreakdown,
            'promotionFundingBreakdown' => $promotionFundingBreakdown,
            'products' => $productDetails,
        ];
    }

    /**
     * @return array{
     *     gross_sales: float,
     *     total_discount: float,
     *     total_tax: float,
     *     total_returns: float,
     *     net_sales: float,
     *     transactions_count: int,
     *     total_items_sold: int,
     *     average_order_value: float
     * }
     */
    private function calculateSummary(
        CarbonImmutable $start,
        CarbonImmutable $end,
        ?int $cashierId,
        ?int $categoryId,
        ?int $productId,
        ?string $paymentMethod
    ): array {
        $txQuery = $this->baseTransactionQuery($start, $end, $cashierId, $categoryId, $productId, $paymentMethod);

        $txAgg = (clone $txQuery)
            ->selectRaw('
                COUNT(*) as tx_count,
                COALESCE(SUM(subtotal), 0) as gross_sales,
                COALESCE(SUM(discount_amount), 0) as total_discount,
                COALESCE(SUM(tax_amount), 0) as total_tax,
                COALESCE(SUM(grand_total), 0) as grand_total
            ')
            ->first();

        $txCount = (int) ($txAgg->tx_count ?? 0);

        $detailQuery = $this->baseDetailQuery($start, $end, $cashierId, $categoryId, $productId, $paymentMethod);
        $detailAgg = (clone $detailQuery)
            ->selectRaw("
                COALESCE(SUM(CASE WHEN transaction_details.base_qty > 0 THEN transaction_details.base_qty ELSE CAST(COALESCE(NULLIF(transaction_details.quantity, ''), '0') AS NUMERIC) END), 0) as total_items,
                COALESCE(SUM(transaction_details.subtotal), 0) as item_subtotal,
                COALESCE(SUM(transaction_details.discount_amount), 0) as item_discount
            ")
            ->first();

        $totalItems = (int) round((float) ($detailAgg->total_items ?? 0));

        if ($categoryId !== null || $productId !== null) {
            $grossSales = round((float) ($detailAgg->item_subtotal ?? 0) + (float) ($detailAgg->item_discount ?? 0), 2);
            $totalDiscount = round((float) ($detailAgg->item_discount ?? 0), 2);
            $totalTax = 0.0;
            $totalReturns = $this->calculateFilteredReturnAmount($start, $end, $cashierId, $categoryId, $productId, $paymentMethod);
            $netSales = round(max(0.0, (float) ($detailAgg->item_subtotal ?? 0) - $totalReturns), 2);
        } else {
            $grossSales = round((float) ($txAgg->gross_sales ?? 0), 2);
            $totalDiscount = round((float) ($txAgg->total_discount ?? 0), 2);
            $totalTax = round((float) ($txAgg->total_tax ?? 0), 2);
            $totalReturns = $this->calculateReturnAmount($start, $end, $cashierId, $paymentMethod);
            $netSales = round(max(0.0, (float) ($txAgg->grand_total ?? 0) - $totalReturns), 2);
        }

        $aov = $txCount > 0 ? round($netSales / $txCount, 2) : 0.0;

        return [
            'gross_sales' => $grossSales,
            'total_discount' => $totalDiscount,
            'total_tax' => $totalTax,
            'total_returns' => $totalReturns,
            'net_sales' => $netSales,
            'transactions_count' => $txCount,
            'total_items_sold' => $totalItems,
            'average_order_value' => $aov,
        ];
    }

    /**
     * @return array<int, array{date: string, label: string, net_sales: float, returns: float, transactions_count: int}>
     */
    private function getDailyTrend(
        CarbonImmutable $start,
        CarbonImmutable $end,
        ?int $cashierId,
        ?int $categoryId,
        ?int $productId,
        ?string $paymentMethod
    ): array {
        if ($categoryId !== null || $productId !== null) {
            $salesByDate = $this->baseDetailQuery($start, $end, $cashierId, $categoryId, $productId, $paymentMethod)
                ->selectRaw('DATE(transactions.created_at) as tx_date, COUNT(DISTINCT transactions.id) as tx_count, COALESCE(SUM(transaction_details.subtotal), 0) as sales_amount')
                ->groupBy(DB::raw('DATE(transactions.created_at)'))
                ->get()
                ->keyBy('tx_date');

            $returnsByDate = $this->baseReturnItemQuery($start, $end, $cashierId, $categoryId, $productId, $paymentMethod)
                ->selectRaw('DATE(sales_returns.created_at) as ret_date, COALESCE(SUM(sales_return_items.subtotal_refund), 0) as total_refunds')
                ->groupBy(DB::raw('DATE(sales_returns.created_at)'))
                ->pluck('total_refunds', 'ret_date');
        } else {
            $salesByDate = $this->baseTransactionQuery($start, $end, $cashierId, null, null, $paymentMethod)
                ->selectRaw('DATE(created_at) as tx_date, COUNT(*) as tx_count, COALESCE(SUM(grand_total), 0) as sales_amount')
                ->groupBy(DB::raw('DATE(created_at)'))
                ->get()
                ->keyBy('tx_date');

            $returnsByDate = $this->baseReturnQuery($start, $end, $cashierId, $paymentMethod)
                ->selectRaw('DATE(sales_returns.created_at) as ret_date, COALESCE(SUM(sales_returns.total_refund_amount), 0) as total_refunds')
                ->groupBy(DB::raw('DATE(sales_returns.created_at)'))
                ->pluck('total_refunds', 'ret_date');
        }

        $series = [];
        $cursor = $start->startOfDay();
        $endDay = $end->startOfDay();

        while ($cursor->lessThanOrEqualTo($endDay)) {
            $dateKey = $cursor->toDateString();
            $row = $salesByDate->get($dateKey);
            $salesAmount = $row ? round((float) $row->sales_amount, 2) : 0.0;
            $returns = round((float) ($returnsByDate[$dateKey] ?? 0), 2);
            $netSales = round(max(0.0, $salesAmount - $returns), 2);

            $series[] = [
                'date' => $dateKey,
                'label' => $cursor->format('d M'),
                'net_sales' => $netSales,
                'returns' => $returns,
                'transactions_count' => $row ? (int) $row->tx_count : 0,
            ];

            $cursor = $cursor->addDay();
        }

        return $series;
    }

    /**
     * @return array<int, array{method: string, label: string, count: int, amount: float, percentage: float}>
     */
    private function getPaymentMethodBreakdown(
        CarbonImmutable $start,
        CarbonImmutable $end,
        ?int $cashierId,
        ?int $categoryId,
        ?int $productId,
        ?string $paymentMethod
    ): array {
        $transactions = $this->baseTransactionQuery($start, $end, $cashierId, $categoryId, $productId, $paymentMethod)
            ->with('payments')
            ->get(['id', 'grand_total', 'change_amount', 'payment_method', 'status']);

        /** @var array<string, array{method: string, label: string, count: int, amount: float}> $map */
        $map = [];

        foreach ($transactions as $tx) {
            if ($tx->payments->isNotEmpty()) {
                $remainingChange = round((float) ($tx->change_amount ?? 0), 2);
                $seenMethods = [];

                foreach ($tx->payments as $payment) {
                    $methodKey = $payment->payment_method->value;
                    $netAmount = round((float) $payment->amount, 2);

                    if ($payment->payment_method === PaymentMethod::Cash && $remainingChange > 0) {
                        $deduct = min($netAmount, $remainingChange);
                        $netAmount = round($netAmount - $deduct, 2);
                        $remainingChange = round($remainingChange - $deduct, 2);
                    }

                    if ($paymentMethod !== null && $methodKey !== $paymentMethod) {
                        continue;
                    }

                    if (! isset($map[$methodKey])) {
                        $map[$methodKey] = [
                            'method' => $methodKey,
                            'label' => $payment->payment_method->label(),
                            'count' => 0,
                            'amount' => 0.0,
                        ];
                    }

                    if (! isset($seenMethods[$methodKey])) {
                        $map[$methodKey]['count']++;
                        $seenMethods[$methodKey] = true;
                    }

                    $map[$methodKey]['amount'] = round($map[$methodKey]['amount'] + $netAmount, 2);
                }

                continue;
            }

            $statusVal = $tx->status instanceof TransactionStatus ? $tx->status->value : strtolower((string) $tx->status);
            if (! in_array($statusVal, CashierShiftService::COMPLETED_TRANSACTION_STATUSES, true)) {
                continue;
            }

            $methodKey = strtolower((string) $tx->payment_method);
            $enum = PaymentMethod::tryFrom($methodKey);
            $normalizedKey = $enum ? $enum->value : 'other';

            if ($paymentMethod !== null && $normalizedKey !== $paymentMethod) {
                continue;
            }

            if (! isset($map[$normalizedKey])) {
                $map[$normalizedKey] = [
                    'method' => $normalizedKey,
                    'label' => $enum ? $enum->label() : ucfirst($methodKey),
                    'count' => 0,
                    'amount' => 0.0,
                ];
            }

            $map[$normalizedKey]['count']++;
            $map[$normalizedKey]['amount'] = round($map[$normalizedKey]['amount'] + (float) $tx->grand_total, 2);
        }

        usort($map, fn (array $a, array $b): int => $b['amount'] <=> $a['amount']);

        $total = round(array_reduce($map, fn (float $carry, array $item): float => $carry + $item['amount'], 0.0), 2);

        return array_map(fn (array $item): array => [
            ...$item,
            'percentage' => $total > 0 ? round(($item['amount'] / $total) * 100, 1) : 0.0,
        ], $map);
    }

    /**
     * @return array<int, array{cashier_id: int, cashier_name: string, transactions_count: int, gross_sales: float, returns_count: int, returns_amount: float, net_sales: float}>
     */
    private function getCashierBreakdown(
        CarbonImmutable $start,
        CarbonImmutable $end,
        ?int $cashierId,
        ?int $categoryId,
        ?int $productId,
        ?string $paymentMethod
    ): array {
        $salesRows = $this->baseTransactionQuery($start, $end, $cashierId, $categoryId, $productId, $paymentMethod)
            ->join('users', 'users.id', '=', 'transactions.user_id')
            ->selectRaw('
                transactions.user_id as cashier_id,
                users.name as cashier_name,
                COUNT(*) as transactions_count,
                COALESCE(SUM(transactions.grand_total), 0) as gross_sales
            ')
            ->groupBy('transactions.user_id', 'users.name')
            ->orderByDesc('gross_sales')
            ->get();

        $returnRows = $this->baseReturnQuery($start, $end, $cashierId, $paymentMethod)
            ->join('transactions', 'transactions.id', '=', 'sales_returns.transaction_id')
            ->selectRaw('
                transactions.user_id as cashier_id,
                COUNT(sales_returns.id) as returns_count,
                COALESCE(SUM(sales_returns.total_refund_amount), 0) as returns_amount
            ')
            ->groupBy('transactions.user_id')
            ->get()
            ->keyBy('cashier_id');

        return $salesRows->map(function (object $row) use ($returnRows): array {
            $uid = (int) ($row->cashier_id ?? 0);
            $ret = $returnRows->get($uid);
            $gross = round((float) ($row->gross_sales ?? 0), 2);
            $retAmount = $ret ? round((float) ($ret->returns_amount ?? 0), 2) : 0.0;

            return [
                'cashier_id' => $uid,
                'cashier_name' => (string) ($row->cashier_name ?? 'Kasir'),
                'transactions_count' => (int) ($row->transactions_count ?? 0),
                'gross_sales' => $gross,
                'returns_count' => $ret ? (int) ($ret->returns_count ?? 0) : 0,
                'returns_amount' => $retAmount,
                'net_sales' => round(max(0.0, $gross - $retAmount), 2),
            ];
        })->values()->all();
    }

    /**
     * Ringkasan promo berdasarkan penanggung biaya (STORE / SUPPLIER / SHARED) dari applied_promotions.
     *
     * @return array<int, array{
     *     funding: string,
     *     label: string,
     *     applications_count: int,
     *     transactions_count: int,
     *     total_discount: float,
     *     percentage: float
     * }>
     */
    private function getPromotionFundingBreakdown(
        CarbonImmutable $start,
        CarbonImmutable $end,
        ?int $cashierId,
        ?int $categoryId,
        ?int $productId,
        ?string $paymentMethod
    ): array {
        $txIdsQuery = $this->baseTransactionQuery($start, $end, $cashierId, $categoryId, $productId, $paymentMethod)
            ->select('transactions.id');

        $rows = AppliedPromotion::query()
            ->whereIn('applied_promotions.transaction_id', $txIdsQuery)
            ->selectRaw('
                applied_promotions.funding as funding,
                COUNT(*) as applications_count,
                COUNT(DISTINCT applied_promotions.transaction_id) as transactions_count,
                COALESCE(SUM(applied_promotions.discount_amount), 0) as total_discount
            ')
            ->groupBy('applied_promotions.funding')
            ->get()
            ->keyBy(fn (object $r): string => (string) ($r->funding instanceof PromotionFunding ? $r->funding->value : $r->funding));

        $grandTotalDiscount = 0.0;
        $result = [];

        foreach (PromotionFunding::cases() as $fundingCase) {
            $row = $rows->get($fundingCase->value);
            $disc = $row ? round((float) $row->total_discount, 2) : 0.0;
            $grandTotalDiscount = round($grandTotalDiscount + $disc, 2);

            $result[] = [
                'funding' => $fundingCase->value,
                'label' => $fundingCase->label(),
                'applications_count' => $row ? (int) $row->applications_count : 0,
                'transactions_count' => $row ? (int) $row->transactions_count : 0,
                'total_discount' => $disc,
                'percentage' => 0.0,
            ];
        }

        return array_map(fn (array $item): array => [
            ...$item,
            'percentage' => $grandTotalDiscount > 0 ? round(($item['total_discount'] / $grandTotalDiscount) * 100, 1) : 0.0,
        ], $result);
    }

    /**
     * @param  array<string, mixed>  $filters
     * @return LengthAwarePaginator<int, array<string, mixed>>|Collection<int, array<string, mixed>>
     */
    private function getProductSales(
        CarbonImmutable $start,
        CarbonImmutable $end,
        ?int $cashierId,
        ?int $categoryId,
        ?int $productId,
        ?string $paymentMethod,
        array $filters,
        bool $paginate
    ): LengthAwarePaginator|Collection {
        $likeOperator = DB::getDriverName() === 'pgsql' ? 'ilike' : 'like';
        $search = isset($filters['search']) && is_string($filters['search']) ? trim($filters['search']) : '';

        $query = $this->baseDetailQuery($start, $end, $cashierId, $categoryId, $productId, $paymentMethod)
            ->leftJoin('categories', 'categories.id', '=', 'products.category_id')
            ->when($search !== '', function ($q) use ($search, $likeOperator): void {
                $q->where(function ($sub) use ($search, $likeOperator): void {
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
                COUNT(DISTINCT transactions.id) as transactions_count,
                COALESCE(SUM(CASE WHEN transaction_details.base_qty > 0 THEN transaction_details.base_qty ELSE CAST(COALESCE(NULLIF(transaction_details.quantity, ''), '0') AS NUMERIC) END), 0) as qty_sold,
                COALESCE(SUM(transaction_details.discount_amount), 0) as total_discount,
                COALESCE(SUM(transaction_details.subtotal), 0) as total_revenue
            ")
            ->groupBy(
                'transaction_details.product_id',
                'products.barcode',
                'products.name',
                'products.base_unit',
                'categories.name'
            );

        $allowedSorts = [
            'product_name' => 'products.name',
            'category_name' => 'categories.name',
            'qty_sold' => 'qty_sold',
            'transactions_count' => 'transactions_count',
            'total_discount' => 'total_discount',
            'total_revenue' => 'total_revenue',
        ];

        $this->applySorting($query, $filters, $allowedSorts, 'total_revenue', 'desc');

        $returnByProduct = $this->baseReturnItemQuery($start, $end, $cashierId, $categoryId, $productId, $paymentMethod)
            ->selectRaw('sales_return_items.product_id, COALESCE(SUM(sales_return_items.base_qty), 0) as qty_returned, COALESCE(SUM(sales_return_items.subtotal_refund), 0) as refund_amount')
            ->groupBy('sales_return_items.product_id')
            ->get()
            ->keyBy('product_id');

        $mapper = function (object $row) use ($returnByProduct): array {
            $pid = (int) ($row->product_id ?? 0);
            $ret = $returnByProduct->get($pid);
            $revenue = round((float) ($row->total_revenue ?? 0), 2);
            $refund = $ret ? round((float) ($ret->refund_amount ?? 0), 2) : 0.0;

            return [
                'product_id' => $pid,
                'barcode' => (string) ($row->barcode ?? '-'),
                'product_name' => (string) ($row->product_name ?? 'Produk Dihapus'),
                'base_unit' => (string) ($row->base_unit ?: 'pcs'),
                'category_name' => (string) ($row->category_name ?? 'Tanpa Kategori'),
                'transactions_count' => (int) ($row->transactions_count ?? 0),
                'qty_sold' => (int) round((float) ($row->qty_sold ?? 0)),
                'qty_returned' => $ret ? (int) ($ret->qty_returned ?? 0) : 0,
                'total_discount' => round((float) ($row->total_discount ?? 0), 2),
                'total_revenue' => $revenue,
                'refund_amount' => $refund,
                'net_revenue' => round(max(0.0, $revenue - $refund), 2),
            ];
        };

        if (! $paginate) {
            return $query->get()->map($mapper)->values();
        }

        $perPage = isset($filters['per_page']) ? max(5, min(100, (int) $filters['per_page'])) : 15;

        return $query->paginate($perPage)->withQueryString()->through($mapper);
    }

    /**
     * @return Builder<Transaction>
     */
    private function baseTransactionQuery(
        CarbonImmutable $start,
        CarbonImmutable $end,
        ?int $cashierId,
        ?int $categoryId,
        ?int $productId,
        ?string $paymentMethod
    ): Builder {
        return Transaction::query()
            ->whereBetween('transactions.created_at', [$start, $end])
            ->where('transactions.status', '!=', TransactionStatus::Voided->value)
            ->when($cashierId !== null, fn (Builder $q) => $q->where('transactions.user_id', $cashierId))
            ->when($paymentMethod !== null, function (Builder $q) use ($paymentMethod): void {
                $q->where(function (Builder $sub) use ($paymentMethod): void {
                    $sub->whereHas('payments', fn (Builder $pq) => $pq->where('payment_method', $paymentMethod))
                        ->orWhere(function (Builder $legacy) use ($paymentMethod): void {
                            $legacy->whereDoesntHave('payments')
                                ->where('transactions.payment_method', $paymentMethod);
                        });
                });
            })
            ->when($categoryId !== null || $productId !== null, function (Builder $q) use ($categoryId, $productId): void {
                $q->whereHas('details', function (Builder $dq) use ($categoryId, $productId): void {
                    $dq->when($productId !== null, fn (Builder $pq) => $pq->where('product_id', $productId))
                        ->when($categoryId !== null, fn (Builder $cq) => $cq->whereHas('product', fn (Builder $p) => $p->withTrashed()->where('category_id', $categoryId)));
                });
            });
    }

    /**
     * @return Builder<TransactionDetail>
     */
    private function baseDetailQuery(
        CarbonImmutable $start,
        CarbonImmutable $end,
        ?int $cashierId,
        ?int $categoryId,
        ?int $productId,
        ?string $paymentMethod
    ): Builder {
        return TransactionDetail::query()
            ->join('transactions', 'transactions.id', '=', 'transaction_details.transaction_id')
            ->join('products', 'products.id', '=', 'transaction_details.product_id')
            ->whereBetween('transactions.created_at', [$start, $end])
            ->where('transactions.status', '!=', TransactionStatus::Voided->value)
            ->when($cashierId !== null, fn (Builder $q) => $q->where('transactions.user_id', $cashierId))
            ->when($categoryId !== null, fn (Builder $q) => $q->where('products.category_id', $categoryId))
            ->when($productId !== null, fn (Builder $q) => $q->where('transaction_details.product_id', $productId))
            ->when($paymentMethod !== null, function (Builder $q) use ($paymentMethod): void {
                $q->where(function (Builder $sub) use ($paymentMethod): void {
                    $sub->whereExists(function ($exists) use ($paymentMethod): void {
                        $exists->select(DB::raw(1))
                            ->from('transaction_payments')
                            ->whereColumn('transaction_payments.transaction_id', 'transactions.id')
                            ->where('transaction_payments.payment_method', $paymentMethod);
                    })->orWhere(function (Builder $legacy) use ($paymentMethod): void {
                        $legacy->whereNotExists(function ($notExists): void {
                            $notExists->select(DB::raw(1))
                                ->from('transaction_payments')
                                ->whereColumn('transaction_payments.transaction_id', 'transactions.id');
                        })->where('transactions.payment_method', $paymentMethod);
                    });
                });
            });
    }

    /**
     * @return Builder<SalesReturn>
     */
    private function baseReturnQuery(
        CarbonImmutable $start,
        CarbonImmutable $end,
        ?int $cashierId,
        ?string $paymentMethod
    ): Builder {
        return SalesReturn::query()
            ->whereBetween('sales_returns.created_at', [$start, $end])
            ->where('sales_returns.status', SalesReturnStatus::Completed->value)
            ->when($cashierId !== null, function (Builder $q) use ($cashierId): void {
                $q->whereHas('transaction', fn (Builder $tq) => $tq->where('user_id', $cashierId));
            })
            ->when($paymentMethod !== null, fn (Builder $q) => $q->where('sales_returns.refund_method', $paymentMethod));
    }

    /**
     * @return Builder<SalesReturnItem>
     */
    private function baseReturnItemQuery(
        CarbonImmutable $start,
        CarbonImmutable $end,
        ?int $cashierId,
        ?int $categoryId,
        ?int $productId,
        ?string $paymentMethod
    ): Builder {
        return SalesReturnItem::query()
            ->join('sales_returns', 'sales_returns.id', '=', 'sales_return_items.sales_return_id')
            ->join('transactions', 'transactions.id', '=', 'sales_returns.transaction_id')
            ->join('products', 'products.id', '=', 'sales_return_items.product_id')
            ->whereBetween('sales_returns.created_at', [$start, $end])
            ->where('sales_returns.status', SalesReturnStatus::Completed->value)
            ->when($cashierId !== null, fn (Builder $q) => $q->where('transactions.user_id', $cashierId))
            ->when($categoryId !== null, fn (Builder $q) => $q->where('products.category_id', $categoryId))
            ->when($productId !== null, fn (Builder $q) => $q->where('sales_return_items.product_id', $productId))
            ->when($paymentMethod !== null, fn (Builder $q) => $q->where('sales_returns.refund_method', $paymentMethod));
    }

    private function calculateReturnAmount(
        CarbonImmutable $start,
        CarbonImmutable $end,
        ?int $cashierId,
        ?string $paymentMethod
    ): float {
        return round((float) $this->baseReturnQuery($start, $end, $cashierId, $paymentMethod)->sum('sales_returns.total_refund_amount'), 2);
    }

    private function calculateFilteredReturnAmount(
        CarbonImmutable $start,
        CarbonImmutable $end,
        ?int $cashierId,
        ?int $categoryId,
        ?int $productId,
        ?string $paymentMethod
    ): float {
        return round((float) $this->baseReturnItemQuery($start, $end, $cashierId, $categoryId, $productId, $paymentMethod)->sum('sales_return_items.subtotal_refund'), 2);
    }

    /**
     * @param  Builder<TransactionDetail>  $query
     * @param  array<string, mixed>  $filters
     * @param  array<string, string>  $allowedSorts
     */
    private function applySorting(Builder $query, array $filters, array $allowedSorts, string $defaultColumn, string $defaultDirection): void
    {
        $tableSort = isset($filters['table_sort']) && is_string($filters['table_sort']) ? $filters['table_sort'] : null;
        $tableDir = strtolower((string) ($filters['table_direction'] ?? 'asc')) === 'desc' ? 'desc' : 'asc';
        $hasTableSort = $tableSort !== null && isset($allowedSorts[$tableSort]);

        $toolbarSort = isset($filters['sort']) && is_string($filters['sort']) ? $filters['sort'] : null;
        $toolbarDir = strtolower((string) ($filters['direction'] ?? 'desc')) === 'asc' ? 'asc' : 'desc';
        $hasToolbarSort = $toolbarSort !== null && isset($allowedSorts[$toolbarSort]);

        if ($hasTableSort) {
            $query->orderBy($allowedSorts[$tableSort], $tableDir);
        }

        if ($hasToolbarSort && (! $hasTableSort || $toolbarSort !== $tableSort)) {
            $query->orderBy($allowedSorts[$toolbarSort], $toolbarDir);
        }

        if (! $hasTableSort && ! $hasToolbarSort) {
            $query->orderBy($allowedSorts[$defaultColumn] ?? $defaultColumn, $defaultDirection);
        }

        $query->orderBy('products.name');
    }
}

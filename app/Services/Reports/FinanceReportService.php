<?php

namespace App\Services\Reports;

use App\Enums\FinancialTransactionType;
use App\Enums\PaymentStatus;
use App\Enums\PromotionFunding;
use App\Enums\TransactionStatus;
use App\Models\AccountPayable;
use App\Models\AppliedPromotion;
use App\Models\FinancialAccount;
use App\Models\FinancialTransaction;
use Carbon\CarbonImmutable;
use Illuminate\Pagination\LengthAwarePaginator;
use Illuminate\Support\Collection;

class FinanceReportService
{
    public function __construct(public ReportPeriodResolver $periodResolver) {}

    /**
     * @param  array<string, mixed>  $filters
     * @return array<string, mixed>
     */
    public function getReportData(array $filters, bool $paginate = true): array
    {
        $period = $this->periodResolver->resolve($filters, 'this_month');
        $accountId = isset($filters['financial_account_id']) && $filters['financial_account_id'] !== '' ? (int) $filters['financial_account_id'] : null;
        $supplierId = isset($filters['supplier_id']) && $filters['supplier_id'] !== '' ? (int) $filters['supplier_id'] : null;

        $cashflow = $this->getCashflowByCategory($period['start'], $period['end'], $accountId);
        $accounts = $this->getAccountBalances($accountId);
        $aging = $this->getAccountsPayableAging($supplierId, $filters, $paginate);
        $promoReport = $this->getPromotionReport($period['start'], $period['end'], $supplierId, $filters);

        $totalIncome = $cashflow['total_income'];
        $totalExpense = $cashflow['total_expense'];
        $netCashflow = round($totalIncome - $totalExpense, 2);

        return [
            'period' => [
                'preset' => $period['preset'],
                'start_date' => $period['start_date'],
                'end_date' => $period['end_date'],
                'label' => $period['label'],
                'days' => $period['days'],
            ],
            'summary' => [
                'total_income' => $totalIncome,
                'total_expense' => $totalExpense,
                'net_cashflow' => $netCashflow,
                'total_account_balance' => round(array_reduce($accounts, fn (float $c, array $a): float => $c + $a['current_balance'], 0.0), 2),
                'total_ap_remaining' => $aging['total_remaining'],
                'total_overdue_amount' => $aging['total_overdue'],
                'overdue_count' => $aging['overdue_count'],
            ],
            'cashflowCategories' => $cashflow['categories'],
            'accountBalances' => $accounts,
            'agingBuckets' => $aging['buckets'],
            'supplierAging' => $aging['suppliers'],
            'overduePayables' => $aging['overdue_payables'],
            'promoSummary' => $promoReport['summary'],
            'supplierPromoClaims' => $promoReport['supplier_claims'],
            'promoHistory' => $promoReport['history'],
        ];
    }

    /**
     * @return array{
     *     total_income: float,
     *     total_expense: float,
     *     categories: array<int, array{category_id: int, code: string, name: string, type: string, income: float, expense: float, transactions_count: int}>
     * }
     */
    private function getCashflowByCategory(CarbonImmutable $start, CarbonImmutable $end, ?int $accountId): array
    {
        $rows = FinancialTransaction::query()
            ->join('financial_categories', 'financial_categories.id', '=', 'financial_transactions.financial_category_id')
            ->whereBetween('financial_transactions.transaction_date', [$start->toDateString(), $end->toDateString()])
            ->when($accountId !== null, fn ($q) => $q->where('financial_transactions.financial_account_id', $accountId))
            ->selectRaw('
                financial_categories.id as category_id,
                financial_categories.code,
                financial_categories.name,
                financial_transactions.type,
                COUNT(*) as transactions_count,
                COALESCE(SUM(financial_transactions.amount), 0) as total_amount
            ')
            ->groupBy('financial_categories.id', 'financial_categories.code', 'financial_categories.name', 'financial_transactions.type')
            ->get();

        $totalIncome = 0.0;
        $totalExpense = 0.0;

        /** @var array<int, array{category_id: int, code: string, name: string, type: string, income: float, expense: float, transactions_count: int}> $map */
        $map = [];

        foreach ($rows as $row) {
            $catId = (int) ($row->category_id ?? 0);
            $typeVal = $row->type instanceof FinancialTransactionType ? $row->type->value : (string) ($row->type ?? '');
            $amount = round((float) ($row->total_amount ?? 0), 2);
            $count = (int) ($row->transactions_count ?? 0);

            if (! isset($map[$catId])) {
                $map[$catId] = [
                    'category_id' => $catId,
                    'code' => (string) ($row->code ?? '-'),
                    'name' => (string) ($row->name ?? '-'),
                    'type' => $typeVal,
                    'income' => 0.0,
                    'expense' => 0.0,
                    'transactions_count' => 0,
                ];
            }

            if ($typeVal === FinancialTransactionType::In->value) {
                $map[$catId]['income'] = round($map[$catId]['income'] + $amount, 2);
                $totalIncome = round($totalIncome + $amount, 2);
            } else {
                $map[$catId]['expense'] = round($map[$catId]['expense'] + $amount, 2);
                $totalExpense = round($totalExpense + $amount, 2);
            }

            $map[$catId]['transactions_count'] += $count;
        }

        usort($map, fn (array $a, array $b): int => ($b['income'] + $b['expense']) <=> ($a['income'] + $a['expense']));

        return [
            'total_income' => $totalIncome,
            'total_expense' => $totalExpense,
            'categories' => array_values($map),
        ];
    }

    /**
     * @return array<int, array{id: int, code: string, name: string, type: string, type_label: string, current_balance: float}>
     */
    private function getAccountBalances(?int $accountId): array
    {
        return FinancialAccount::query()
            ->where('is_active', true)
            ->when($accountId !== null, fn ($q) => $q->where('id', $accountId))
            ->orderBy('code')
            ->get()
            ->map(fn (FinancialAccount $acc): array => [
                'id' => $acc->id,
                'code' => $acc->code,
                'name' => $acc->name,
                'type' => $acc->type->value,
                'type_label' => $acc->type->label(),
                'current_balance' => round((float) $acc->current_balance, 2),
            ])
            ->values()
            ->all();
    }

    /**
     * @param  array<string, mixed>  $filters
     * @return array{
     *     total_remaining: float,
     *     total_overdue: float,
     *     overdue_count: int,
     *     buckets: array<int, array{key: string, label: string, amount: float, count: int}>,
     *     suppliers: array<int, array{supplier_id: int, supplier_name: string, current: float, days_1_30: float, days_31_60: float, days_61_90: float, over_90: float, total: float}>,
     *     overdue_payables: LengthAwarePaginator<int, array<string, mixed>>|Collection<int, array<string, mixed>>
     * }
     */
    private function getAccountsPayableAging(?int $supplierId, array $filters, bool $paginate): array
    {
        $today = CarbonImmutable::now()->startOfDay();

        $payables = AccountPayable::query()
            ->where('status', '!=', PaymentStatus::Paid->value)
            ->where('remaining_amount', '>', 0)
            ->when($supplierId !== null, fn ($q) => $q->where('supplier_id', $supplierId))
            ->with(['supplier:id,name,code', 'purchaseOrder:id,po_number'])
            ->get();

        $bucketTotals = [
            'current' => ['key' => 'current', 'label' => 'Belum Jatuh Tempo', 'amount' => 0.0, 'count' => 0],
            '1_30' => ['key' => '1_30', 'label' => 'Terlambat 1–30 Hari', 'amount' => 0.0, 'count' => 0],
            '31_60' => ['key' => '31_60', 'label' => 'Terlambat 31–60 Hari', 'amount' => 0.0, 'count' => 0],
            '61_90' => ['key' => '61_90', 'label' => 'Terlambat 61–90 Hari', 'amount' => 0.0, 'count' => 0],
            'over_90' => ['key' => 'over_90', 'label' => 'Terlambat > 90 Hari', 'amount' => 0.0, 'count' => 0],
        ];

        /** @var array<int, array{supplier_id: int, supplier_name: string, current: float, days_1_30: float, days_31_60: float, days_61_90: float, over_90: float, total: float}> $supplierMap */
        $supplierMap = [];
        $overdueList = collect();
        $totalRemaining = 0.0;
        $totalOverdue = 0.0;

        foreach ($payables as $ap) {
            $remaining = round((float) $ap->remaining_amount, 2);
            $totalRemaining = round($totalRemaining + $remaining, 2);

            $daysOverdue = 0;
            if ($ap->due_date !== null) {
                $due = CarbonImmutable::parse($ap->due_date)->startOfDay();
                if ($due->lessThan($today)) {
                    $daysOverdue = (int) $due->diffInDays($today);
                }
            }

            if ($daysOverdue === 0) {
                $bucketKey = 'current';
                $supplierBucketCol = 'current';
            } elseif ($daysOverdue <= 30) {
                $bucketKey = '1_30';
                $supplierBucketCol = 'days_1_30';
            } elseif ($daysOverdue <= 60) {
                $bucketKey = '31_60';
                $supplierBucketCol = 'days_31_60';
            } elseif ($daysOverdue <= 90) {
                $bucketKey = '61_90';
                $supplierBucketCol = 'days_61_90';
            } else {
                $bucketKey = 'over_90';
                $supplierBucketCol = 'over_90';
            }

            $bucketTotals[$bucketKey]['amount'] = round($bucketTotals[$bucketKey]['amount'] + $remaining, 2);
            $bucketTotals[$bucketKey]['count']++;

            $sid = (int) $ap->supplier_id;
            if (! isset($supplierMap[$sid])) {
                $supplierMap[$sid] = [
                    'supplier_id' => $sid,
                    'supplier_name' => $ap->supplier?->name ?? 'Supplier Dihapus',
                    'current' => 0.0,
                    'days_1_30' => 0.0,
                    'days_31_60' => 0.0,
                    'days_61_90' => 0.0,
                    'over_90' => 0.0,
                    'total' => 0.0,
                ];
            }

            $supplierMap[$sid][$supplierBucketCol] = round($supplierMap[$sid][$supplierBucketCol] + $remaining, 2);
            $supplierMap[$sid]['total'] = round($supplierMap[$sid]['total'] + $remaining, 2);

            if ($daysOverdue > 0) {
                $totalOverdue = round($totalOverdue + $remaining, 2);
                $overdueList->push([
                    'id' => $ap->id,
                    'payable_number' => $ap->payable_number,
                    'po_number' => $ap->purchaseOrder?->po_number ?? '-',
                    'invoice_number' => $ap->invoice_number ?: '-',
                    'supplier_name' => $ap->supplier?->name ?? 'Supplier Dihapus',
                    'due_date' => $ap->due_date?->format('d M Y') ?? '-',
                    'due_date_raw' => $ap->due_date?->toDateString() ?? '',
                    'days_overdue' => $daysOverdue,
                    'aging_bucket' => $bucketTotals[$bucketKey]['label'],
                    'bucket_key' => $bucketKey,
                    'total_amount' => round((float) $ap->total_amount, 2),
                    'remaining_amount' => $remaining,
                    'status' => $ap->status->value,
                    'status_label' => $ap->status->label(),
                ]);
            }
        }

        usort($supplierMap, fn (array $a, array $b): int => $b['total'] <=> $a['total']);

        $sortedOverdue = $this->sortOverdue($overdueList, $filters);

        $overdueOutput = $paginate
            ? $this->paginateCollection($sortedOverdue, $filters)
            : $sortedOverdue;

        return [
            'total_remaining' => $totalRemaining,
            'total_overdue' => $totalOverdue,
            'overdue_count' => $overdueList->count(),
            'buckets' => array_values($bucketTotals),
            'suppliers' => array_values($supplierMap),
            'overdue_payables' => $overdueOutput,
        ];
    }

    /**
     * @param  Collection<int, array<string, mixed>>  $collection
     * @param  array<string, mixed>  $filters
     * @return Collection<int, array<string, mixed>>
     */
    private function sortOverdue(Collection $collection, array $filters): Collection
    {
        $allowed = ['payable_number', 'supplier_name', 'due_date_raw', 'days_overdue', 'remaining_amount'];
        $tableSort = isset($filters['table_sort']) && is_string($filters['table_sort']) && in_array($filters['table_sort'], $allowed, true)
            ? $filters['table_sort']
            : null;
        $tableDir = strtolower((string) ($filters['table_direction'] ?? 'asc')) === 'desc' ? 'desc' : 'asc';

        $toolbarSort = isset($filters['sort']) && is_string($filters['sort']) && in_array($filters['sort'], $allowed, true)
            ? $filters['sort']
            : null;
        $toolbarDir = strtolower((string) ($filters['direction'] ?? 'desc')) === 'asc' ? 'asc' : 'desc';

        $sortKey = $tableSort ?? $toolbarSort ?? 'days_overdue';
        $sortDir = $tableSort !== null ? $tableDir : ($toolbarSort !== null ? $toolbarDir : 'desc');

        return $collection->sort(function (array $a, array $b) use ($sortKey, $sortDir): int {
            $va = $a[$sortKey] ?? 0;
            $vb = $b[$sortKey] ?? 0;
            $cmp = is_string($va) && is_string($vb)
                ? strcasecmp($va, $vb)
                : ($va <=> $vb);

            return $sortDir === 'desc' ? -$cmp : $cmp;
        })->values();
    }

    /**
     * @param  Collection<int, array<string, mixed>>  $collection
     * @param  array<string, mixed>  $filters
     * @return LengthAwarePaginator<int, array<string, mixed>>
     */
    private function paginateCollection(Collection $collection, array $filters): LengthAwarePaginator
    {
        $perPage = isset($filters['per_page']) ? max(5, min(100, (int) $filters['per_page'])) : 15;
        $page = max(1, (int) request()->integer('page', 1));
        $total = $collection->count();
        $items = $collection->forPage($page, $perPage)->values();

        return new LengthAwarePaginator($items, $total, $perPage, $page, [
            'path' => request()->url(),
            'query' => request()->query(),
        ]);
    }

    /**
     * Detail promo & voucher pada periode laporan keuangan, termasuk pembagian beban Toko vs Supplier
     * serta pelacakan klaim/penukaran promo supplier & patungan.
     *
     * @param  array<string, mixed>  $filters
     * @return array{
     *     summary: array{
     *         total_discount: float,
     *         store_burden: float,
     *         supplier_burden: float,
     *         supplier_pending_claim: float,
     *         supplier_claimed_amount: float,
     *         supplier_paid_amount: float,
     *         transactions_count: int
     *     },
     *     supplier_claims: array<int, array{
     *         supplier_id: int|null,
     *         supplier_name: string,
     *         pending_count: int,
     *         pending_amount: float,
     *         claimed_amount: float,
     *         paid_amount: float,
     *         total_supplier_burden: float
     *     }>,
     *     history: array<int, array<string, mixed>>
     * }
     */
    private function getPromotionReport(
        CarbonImmutable $start,
        CarbonImmutable $end,
        ?int $supplierId,
        array $filters
    ): array {
        $tz = (string) config('pos_promotions.timezone', 'Asia/Jakarta');
        $claimStatusFilter = isset($filters['claim_status']) && is_string($filters['claim_status']) && $filters['claim_status'] !== '' && $filters['claim_status'] !== 'all'
            ? $filters['claim_status']
            : null;

        $rows = AppliedPromotion::query()
            ->with([
                'transaction:id,invoice_number,created_at,grand_total,status',
                'supplier:id,name',
                'promotion:id,name,code,store_share_percent,supplier_share_percent',
                'voucher:id,code,name,store_share_percent,supplier_share_percent',
            ])
            ->whereHas('transaction', function ($q) use ($start, $end): void {
                $q->whereBetween('created_at', [$start->startOfDay(), $end->endOfDay()])
                    ->where('status', '!=', TransactionStatus::Voided->value);
            })
            ->when($supplierId !== null, fn ($q) => $q->where('supplier_id', $supplierId))
            ->when($claimStatusFilter !== null, fn ($q) => $q->where('claim_status', $claimStatusFilter))
            ->orderByDesc('id')
            ->limit(200)
            ->get();

        $totalDiscount = 0.0;
        $storeBurden = 0.0;
        $supplierBurden = 0.0;
        $pendingClaim = 0.0;
        $claimedAmt = 0.0;
        $paidAmt = 0.0;
        $txIds = [];
        $supplierMap = [];
        $history = [];

        foreach ($rows as $row) {
            $discount = round((float) $row->discount_amount, 2);
            $storeAmt = round((float) $row->store_discount_amount, 2);
            $supplierAmt = round((float) $row->supplier_discount_amount, 2);

            // Fallback untuk data lama jika kolom split belum terisi
            if ($storeAmt === 0.0 && $supplierAmt === 0.0 && $discount > 0.0) {
                $fundingVal = $row->funding instanceof PromotionFunding ? $row->funding->value : (string) $row->funding;
                if ($fundingVal === PromotionFunding::Supplier->value) {
                    $supplierAmt = $discount;
                } elseif ($fundingVal === PromotionFunding::Shared->value) {
                    $storeAmt = round($discount / 2, 2);
                    $supplierAmt = round($discount - $storeAmt, 2);
                } else {
                    $storeAmt = $discount;
                }
            }

            $totalDiscount = round($totalDiscount + $discount, 2);
            $storeBurden = round($storeBurden + $storeAmt, 2);
            $supplierBurden = round($supplierBurden + $supplierAmt, 2);
            $txIds[$row->transaction_id] = true;

            $claimStatus = (string) ($row->claim_status ?: ($supplierAmt > 0 ? 'pending' : 'not_applicable'));

            if ($supplierAmt > 0) {
                if ($claimStatus === 'pending') {
                    $pendingClaim = round($pendingClaim + $supplierAmt, 2);
                } elseif ($claimStatus === 'claimed') {
                    $claimedAmt = round($claimedAmt + $supplierAmt, 2);
                } elseif ($claimStatus === 'paid') {
                    $paidAmt = round($paidAmt + $supplierAmt, 2);
                }

                $sKey = $row->supplier_id !== null ? (string) $row->supplier_id : 'unassigned';
                if (! isset($supplierMap[$sKey])) {
                    $supplierMap[$sKey] = [
                        'supplier_id' => $row->supplier_id,
                        'supplier_name' => $row->supplier?->name ?? 'Supplier Belum Ditentukan',
                        'pending_count' => 0,
                        'pending_amount' => 0.0,
                        'claimed_amount' => 0.0,
                        'paid_amount' => 0.0,
                        'total_supplier_burden' => 0.0,
                    ];
                }

                $supplierMap[$sKey]['total_supplier_burden'] = round($supplierMap[$sKey]['total_supplier_burden'] + $supplierAmt, 2);
                if ($claimStatus === 'pending') {
                    $supplierMap[$sKey]['pending_count']++;
                    $supplierMap[$sKey]['pending_amount'] = round($supplierMap[$sKey]['pending_amount'] + $supplierAmt, 2);
                } elseif ($claimStatus === 'claimed') {
                    $supplierMap[$sKey]['claimed_amount'] = round($supplierMap[$sKey]['claimed_amount'] + $supplierAmt, 2);
                } elseif ($claimStatus === 'paid') {
                    $supplierMap[$sKey]['paid_amount'] = round($supplierMap[$sKey]['paid_amount'] + $supplierAmt, 2);
                }
            }

            $history[] = [
                'id' => $row->id,
                'transaction_id' => $row->transaction_id,
                'invoice_number' => $row->transaction?->invoice_number ?? "#{$row->transaction_id}",
                'transaction_date' => $row->transaction?->created_at?->copy()->timezone($tz)->format('d M Y H:i') ?? '-',
                'transaction_grand_total' => round((float) ($row->transaction?->grand_total ?? 0), 2),
                'description' => $row->description_snapshot,
                'type' => $row->type,
                'funding' => $row->funding instanceof PromotionFunding ? $row->funding->value : (string) $row->funding,
                'funding_label' => $row->funding instanceof PromotionFunding ? $row->funding->label() : (string) $row->funding,
                'supplier_id' => $row->supplier_id,
                'supplier_name' => $row->supplier?->name,
                'discount_amount' => $discount,
                'store_discount_amount' => $storeAmt,
                'supplier_discount_amount' => $supplierAmt,
                'claim_status' => $claimStatus,
                'settlement_method_label' => $row->settlement_method
                    ? (\App\Services\SupplierPromoClaimService::SETTLEMENT_METHODS[$row->settlement_method] ?? $row->settlement_method)
                    : null,
                'claimed_at' => $row->claimed_at?->copy()->timezone($tz)->format('d M Y H:i'),
                'claim_reference' => $row->claim_reference,
                'claim_notes' => $row->claim_notes,
            ];
        }

        usort($supplierMap, fn (array $a, array $b): int => $b['total_supplier_burden'] <=> $a['total_supplier_burden']);

        return [
            'summary' => [
                'total_discount' => $totalDiscount,
                'store_burden' => $storeBurden,
                'supplier_burden' => $supplierBurden,
                'supplier_pending_claim' => $pendingClaim,
                'supplier_claimed_amount' => $claimedAmt,
                'supplier_paid_amount' => $paidAmt,
                'transactions_count' => count($txIds),
            ],
            'supplier_claims' => array_values($supplierMap),
            'history' => $history,
        ];
    }
}

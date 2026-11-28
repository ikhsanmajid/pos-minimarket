<?php

namespace App\Http\Controllers\Reports;

use App\Enums\PaymentMethod;
use App\Enums\UserRoles;
use App\Http\Controllers\Controller;
use App\Http\Requests\ReportFilterRequest;
use App\Models\Category;
use App\Models\FinancialAccount;
use App\Models\Product;
use App\Models\Supplier;
use App\Models\User;
use App\Services\Reports\FinanceReportService;
use App\Services\Reports\ProfitLossReportService;
use App\Services\Reports\ReportExportService;
use App\Services\Reports\SalesReportService;
use App\Services\Reports\StockReportService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response as HttpResponse;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpFoundation\StreamedResponse;

class ReportController extends Controller
{
    public function __construct(
        public SalesReportService $salesReportService,
        public ProfitLossReportService $profitLossReportService,
        public StockReportService $stockReportService,
        public FinanceReportService $financeReportService,
        public ReportExportService $exportService,
    ) {}

    public function searchCashiers(Request $request): JsonResponse
    {
        Gate::authorize('reports.sales');

        $search = trim((string) $request->input('search', ''));
        $likeOperator = DB::getDriverName() === 'pgsql' ? 'ilike' : 'like';

        $users = User::query()
            ->where('role', '!=', UserRoles::Warehouse->value)
            ->when($search !== '', function ($q) use ($search, $likeOperator): void {
                $q->where(function ($sub) use ($search, $likeOperator): void {
                    $sub->where('name', $likeOperator, "%{$search}%")
                        ->orWhere('email', $likeOperator, "%{$search}%");
                });
            })
            ->orderBy('name')
            ->limit(20)
            ->get(['id', 'name', 'role']);

        return response()->json(
            $users->map(fn (User $user): array => [
                'value' => $user->id,
                'label' => $user->name,
            ])->values()
        );
    }

    public function sales(ReportFilterRequest $request): Response
    {
        Gate::authorize('reports.sales');

        $filters = $request->validated();
        $data = $this->salesReportService->getReportData($filters, true);

        return Inertia::render('POS/Reports/SalesReport', [
            ...$data,
            'filters' => $this->normalizeUiFilters($filters, $data['period']),
            'options' => [
                'cashiers' => User::query()
                    ->where('role', '!=', UserRoles::Warehouse->value)
                    ->orderBy('name')
                    ->get(['id', 'name']),
                'categories' => Category::query()->where('is_active', true)->orderBy('name')->get(['id', 'name']),
                'products' => Product::query()->orderBy('name')->limit(200)->get(['id', 'name', 'barcode']),
                'paymentMethods' => array_map(
                    fn (PaymentMethod $m): array => ['value' => $m->value, 'label' => $m->label()],
                    PaymentMethod::cases()
                ),
            ],
        ]);
    }

    public function exportSalesCsv(ReportFilterRequest $request): StreamedResponse
    {
        Gate::authorize('reports.sales');

        /** @var User $actor */
        $actor = $request->user();
        $filters = $request->validated();
        $data = $this->salesReportService->getReportData($filters, false);
        /** @var array{start_date: string, end_date: string} $period */
        $period = $data['period'];
        /** @var Collection<int, array<string, mixed>> $products */
        $products = $data['products'];

        $filename = "laporan-penjualan-{$period['start_date']}-sd-{$period['end_date']}.csv";

        return $this->exportService->streamCsv(
            $filename,
            ['Barcode', 'Nama Produk', 'Kategori', 'Satuan', 'Jml Transaksi', 'Qty Terjual', 'Qty Retur', 'Total Diskon', 'Omzet Kotor', 'Total Retur', 'Omzet Bersih'],
            $this->exportService->yieldSalesCsvRows($products),
            $actor,
            'Laporan Penjualan',
            ['start_date' => $period['start_date'], 'end_date' => $period['end_date']]
        );
    }

    public function exportSalesPdf(ReportFilterRequest $request): HttpResponse
    {
        Gate::authorize('reports.sales');

        /** @var User $actor */
        $actor = $request->user();
        $filters = $request->validated();
        $data = $this->salesReportService->getReportData($filters, false);
        /** @var array{start_date: string, end_date: string} $period */
        $period = $data['period'];

        $filename = "laporan-penjualan-{$period['start_date']}-sd-{$period['end_date']}.pdf";

        return $this->exportService->downloadPdf(
            'pdf.sales-report',
            $filename,
            $data,
            $actor,
            'Laporan Penjualan',
            'portrait',
            ['start_date' => $period['start_date'], 'end_date' => $period['end_date']]
        );
    }

    public function profitLoss(ReportFilterRequest $request): Response
    {
        Gate::authorize('reports.profit-loss');

        $filters = $request->validated();
        $data = $this->profitLossReportService->getReportData($filters, true);

        return Inertia::render('POS/Reports/ProfitLossReport', [
            ...$data,
            'filters' => $this->normalizeUiFilters($filters, $data['period']),
            'options' => [
                'categories' => Category::query()->where('is_active', true)->orderBy('name')->get(['id', 'name']),
                'products' => Product::query()->orderBy('name')->limit(200)->get(['id', 'name', 'barcode']),
            ],
        ]);
    }

    public function exportProfitLossCsv(ReportFilterRequest $request): StreamedResponse
    {
        Gate::authorize('reports.profit-loss');

        /** @var User $actor */
        $actor = $request->user();
        $filters = $request->validated();
        $data = $this->profitLossReportService->getReportData($filters, false);
        /** @var array{start_date: string, end_date: string} $period */
        $period = $data['period'];
        /** @var Collection<int, array<string, mixed>> $products */
        $products = $data['products'];

        $filename = "laporan-laba-kotor-{$period['start_date']}-sd-{$period['end_date']}.csv";

        return $this->exportService->streamCsv(
            $filename,
            ['Barcode', 'Nama Produk', 'Kategori', 'Satuan', 'Qty Terjual', 'Qty Retur', 'Omzet Bersih', 'HPP Bersih', 'Laba Kotor', 'Margin (%)'],
            $this->exportService->yieldProfitLossCsvRows($products),
            $actor,
            'Laporan Laba Kotor (HPP)',
            ['start_date' => $period['start_date'], 'end_date' => $period['end_date']]
        );
    }

    public function exportProfitLossPdf(ReportFilterRequest $request): HttpResponse
    {
        Gate::authorize('reports.profit-loss');

        /** @var User $actor */
        $actor = $request->user();
        $filters = $request->validated();
        $data = $this->profitLossReportService->getReportData($filters, false);
        /** @var array{start_date: string, end_date: string} $period */
        $period = $data['period'];

        $filename = "laporan-laba-kotor-{$period['start_date']}-sd-{$period['end_date']}.pdf";

        return $this->exportService->downloadPdf(
            'pdf.profit-loss-report',
            $filename,
            $data,
            $actor,
            'Laporan Laba Kotor (HPP)',
            'portrait',
            ['start_date' => $period['start_date'], 'end_date' => $period['end_date']]
        );
    }

    public function stockValuation(ReportFilterRequest $request): Response
    {
        Gate::authorize('reports.stock');

        $filters = $request->validated();
        $data = $this->stockReportService->getReportData($filters, true);

        return Inertia::render('POS/Reports/StockValuationReport', [
            ...$data,
            'filters' => $this->normalizeUiFilters($filters, $data['period']),
            'options' => [
                'categories' => Category::query()->where('is_active', true)->orderBy('name')->get(['id', 'name']),
            ],
        ]);
    }

    public function exportStockCsv(ReportFilterRequest $request): StreamedResponse
    {
        Gate::authorize('reports.stock');

        /** @var User $actor */
        $actor = $request->user();
        $filters = $request->validated();
        $data = $this->stockReportService->getReportData($filters, false);
        /** @var array{start_date: string, end_date: string} $period */
        $period = $data['period'];
        /** @var Collection<int, array<string, mixed>> $products */
        $products = $data['products'];

        $filename = "laporan-valuasi-stok-{$period['start_date']}-sd-{$period['end_date']}.csv";

        return $this->exportService->streamCsv(
            $filename,
            ['Barcode', 'Nama Produk', 'Kategori', 'Satuan', 'Stok Dasar', 'HPP Satuan', 'Harga Jual', 'Nilai Aset (HPP)', 'Potensi Nilai Jual', 'Qty Terjual', 'Klasifikasi'],
            $this->exportService->yieldStockCsvRows($products),
            $actor,
            'Laporan Valuasi & Pergerakan Stok',
            ['start_date' => $period['start_date'], 'end_date' => $period['end_date']]
        );
    }

    public function exportStockPdf(ReportFilterRequest $request): HttpResponse
    {
        Gate::authorize('reports.stock');

        /** @var User $actor */
        $actor = $request->user();
        $filters = $request->validated();
        $data = $this->stockReportService->getReportData($filters, false);
        /** @var array{start_date: string, end_date: string} $period */
        $period = $data['period'];

        $filename = "laporan-valuasi-stok-{$period['start_date']}-sd-{$period['end_date']}.pdf";

        return $this->exportService->downloadPdf(
            'pdf.stock-valuation-report',
            $filename,
            $data,
            $actor,
            'Laporan Valuasi & Pergerakan Stok',
            'landscape',
            ['start_date' => $period['start_date'], 'end_date' => $period['end_date']]
        );
    }

    public function financeAging(ReportFilterRequest $request): Response
    {
        Gate::authorize('reports.finance');

        $filters = $request->validated();
        $data = $this->financeReportService->getReportData($filters, true);

        return Inertia::render('POS/Reports/FinanceAgingReport', [
            ...$data,
            'filters' => $this->normalizeUiFilters($filters, $data['period']),
            'options' => [
                'accounts' => FinancialAccount::query()->where('is_active', true)->orderBy('code')->get(['id', 'code', 'name']),
                'suppliers' => Supplier::query()->where('is_active', true)->orderBy('name')->get(['id', 'name']),
            ],
        ]);
    }

    public function exportFinanceCsv(ReportFilterRequest $request): StreamedResponse
    {
        Gate::authorize('reports.finance');

        /** @var User $actor */
        $actor = $request->user();
        $filters = $request->validated();
        $data = $this->financeReportService->getReportData($filters, false);
        /** @var array{start_date: string, end_date: string} $period */
        $period = $data['period'];
        /** @var array<int, array<string, mixed>> $categories */
        $categories = $data['cashflowCategories'];
        /** @var Collection<int, array<string, mixed>> $overdue */
        $overdue = $data['overduePayables'];

        $filename = "laporan-keuangan-aging-{$period['start_date']}-sd-{$period['end_date']}.csv";

        return $this->exportService->streamCsv(
            $filename,
            ['Bagian', 'Kode / No Faktur', 'Kategori / Supplier', 'Tipe / Bucket Aging', 'Jml Transaksi', 'Pemasukan (Rp)', 'Pengeluaran / Sisa Hutang (Rp)', 'Jatuh Tempo', 'Hari Terlambat'],
            $this->exportService->yieldFinanceCsvRows($categories, $overdue),
            $actor,
            'Laporan Keuangan & Aging Hutang',
            ['start_date' => $period['start_date'], 'end_date' => $period['end_date']]
        );
    }

    public function exportFinancePdf(ReportFilterRequest $request): HttpResponse
    {
        Gate::authorize('reports.finance');

        /** @var User $actor */
        $actor = $request->user();
        $filters = $request->validated();
        $data = $this->financeReportService->getReportData($filters, false);
        /** @var array{start_date: string, end_date: string} $period */
        $period = $data['period'];

        $filename = "laporan-keuangan-aging-{$period['start_date']}-sd-{$period['end_date']}.pdf";

        return $this->exportService->downloadPdf(
            'pdf.finance-aging-report',
            $filename,
            $data,
            $actor,
            'Laporan Keuangan & Aging Hutang',
            'portrait',
            ['start_date' => $period['start_date'], 'end_date' => $period['end_date']]
        );
    }

    /**
     * @param  array<string, mixed>  $filters
     * @param  array{preset: string, start_date: string, end_date: string}  $period
     * @return array<string, mixed>
     */
    private function normalizeUiFilters(array $filters, array $period): array
    {
        return [
            ...$filters,
            'preset' => $period['preset'],
            'start_date' => $period['start_date'],
            'end_date' => $period['end_date'],
        ];
    }
}

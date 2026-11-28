<?php

namespace App\Services\Reports;

use App\Enums\ActivityLogCategory;
use App\Models\User;
use App\Services\StoreSettingService;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Http\Response;
use Illuminate\Support\Collection;
use Symfony\Component\HttpFoundation\StreamedResponse;

class ReportExportService
{
    public function __construct(
        public ReportPeriodResolver $periodResolver,
        public StoreSettingService $storeSettingService,
    ) {}

    /**
     * Bangun StreamedResponse CSV dengan UTF-8 BOM dan proteksi CSV Formula Injection.
     *
     * @param  array<int, string>  $headers
     * @param  iterable<int, array<int, mixed>>  $rows
     * @param  array<string, mixed>  $logMeta
     */
    public function streamCsv(
        string $filename,
        array $headers,
        iterable $rows,
        User $actor,
        string $reportLabel,
        array $logMeta = []
    ): StreamedResponse {
        $this->logExportActivity($actor, $reportLabel, 'CSV', $filename, $logMeta);

        return response()->streamDownload(function () use ($headers, $rows): void {
            $handle = fopen('php://output', 'wb');
            if ($handle === false) {
                return;
            }

            // UTF-8 BOM agar terbuka rapi di Excel / LibreOffice
            fwrite($handle, "\xEF\xBB\xBF");
            fputcsv($handle, array_map(fn (string $h): string => $this->periodResolver->sanitizeCsvCell($h), $headers));

            $count = 0;
            foreach ($rows as $row) {
                $sanitized = array_map(
                    fn (mixed $cell): string => $this->periodResolver->sanitizeCsvCell($cell),
                    $row
                );
                fputcsv($handle, $sanitized);
                $count++;

                if ($count % 200 === 0) {
                    fflush($handle);
                }
            }

            fclose($handle);
        }, $filename, [
            'Content-Type' => 'text/csv; charset=UTF-8',
            'Cache-Control' => 'no-store, no-cache',
        ]);
    }

    /**
     * Bangun PDF DomPDF dengan kop surat dari StoreSettingService.
     *
     * @param  array<string, mixed>  $viewData
     * @param  array<string, mixed>  $logMeta
     */
    public function downloadPdf(
        string $view,
        string $filename,
        array $viewData,
        User $actor,
        string $reportLabel,
        string $orientation = 'portrait',
        array $logMeta = []
    ): Response {
        $this->logExportActivity($actor, $reportLabel, 'PDF', $filename, $logMeta);

        $store = $this->storeSettingService->get();
        $logoDataUri = $this->resolveStoreLogoDataUri($store->store_logo);

        $pdf = Pdf::loadView($view, [
            ...$viewData,
            'store' => $store,
            'logoDataUri' => $logoDataUri,
            'printedBy' => $actor->name,
            'printedAt' => now()->format('d M Y H:i'),
        ])->setPaper('a4', $orientation);

        return $pdf->stream($filename);
    }

    /**
     * @param  Collection<int, array<string, mixed>>  $products
     * @return \Generator<int, array<int, mixed>>
     */
    public function yieldSalesCsvRows(Collection $products): \Generator
    {
        foreach ($products->chunk(200) as $chunk) {
            foreach ($chunk as $row) {
                yield [
                    $row['barcode'] ?? '-',
                    $row['product_name'] ?? '-',
                    $row['category_name'] ?? '-',
                    $row['base_unit'] ?? 'pcs',
                    $row['transactions_count'] ?? 0,
                    $row['qty_sold'] ?? 0,
                    $row['qty_returned'] ?? 0,
                    $row['total_discount'] ?? 0,
                    $row['total_revenue'] ?? 0,
                    $row['refund_amount'] ?? 0,
                    $row['net_revenue'] ?? 0,
                ];
            }
        }
    }

    /**
     * @param  Collection<int, array<string, mixed>>  $products
     * @return \Generator<int, array<int, mixed>>
     */
    public function yieldProfitLossCsvRows(Collection $products): \Generator
    {
        foreach ($products->chunk(200) as $chunk) {
            foreach ($chunk as $row) {
                yield [
                    $row['barcode'] ?? '-',
                    $row['product_name'] ?? '-',
                    $row['category_name'] ?? '-',
                    $row['base_unit'] ?? 'pcs',
                    $row['qty_sold'] ?? 0,
                    $row['qty_returned'] ?? 0,
                    $row['net_revenue'] ?? 0,
                    $row['net_cogs'] ?? 0,
                    $row['gross_profit'] ?? 0,
                    $row['margin_pct'] ?? 0,
                ];
            }
        }
    }

    /**
     * @param  Collection<int, array<string, mixed>>  $products
     * @return \Generator<int, array<int, mixed>>
     */
    public function yieldStockCsvRows(Collection $products): \Generator
    {
        foreach ($products->chunk(200) as $chunk) {
            foreach ($chunk as $row) {
                yield [
                    $row['barcode'] ?? '-',
                    $row['product_name'] ?? '-',
                    $row['category_name'] ?? '-',
                    $row['base_unit'] ?? 'pcs',
                    $row['stock'] ?? 0,
                    $row['buy_price'] ?? 0,
                    $row['sell_price'] ?? 0,
                    $row['asset_value'] ?? 0,
                    $row['potential_sales'] ?? 0,
                    $row['qty_sold'] ?? 0,
                    $row['movement_label'] ?? '-',
                ];
            }
        }
    }

    /**
     * @param  array<int, array<string, mixed>>  $categories
     * @param  Collection<int, array<string, mixed>>  $overduePayables
     * @return \Generator<int, array<int, mixed>>
     */
    public function yieldFinanceCsvRows(array $categories, Collection $overduePayables): \Generator
    {
        foreach ($categories as $cat) {
            yield [
                'ARUS KAS',
                $cat['code'] ?? '-',
                $cat['name'] ?? '-',
                ($cat['type'] ?? '') === 'in' ? 'Pemasukan' : 'Pengeluaran',
                $cat['transactions_count'] ?? 0,
                $cat['income'] ?? 0,
                $cat['expense'] ?? 0,
                '-',
                0,
            ];
        }

        foreach ($overduePayables->chunk(200) as $chunk) {
            foreach ($chunk as $ap) {
                yield [
                    'HUTANG OVERDUE',
                    $ap['payable_number'] ?? '-',
                    $ap['supplier_name'] ?? '-',
                    $ap['aging_bucket'] ?? '-',
                    1,
                    0,
                    $ap['remaining_amount'] ?? 0,
                    $ap['due_date'] ?? '-',
                    $ap['days_overdue'] ?? 0,
                ];
            }
        }
    }

    private function resolveStoreLogoDataUri(?string $logoPath): ?string
    {
        if ($logoPath === null || $logoPath === '') {
            return null;
        }

        $fullPath = storage_path('app/public/'.ltrim($logoPath, '/'));
        if (! is_file($fullPath) || ! is_readable($fullPath)) {
            return null;
        }

        $contents = file_get_contents($fullPath);
        if ($contents === false) {
            return null;
        }

        $mime = mime_content_type($fullPath) ?: 'image/png';

        return 'data:'.$mime.';base64,'.base64_encode($contents);
    }

    /**
     * @param  array<string, mixed>  $meta
     */
    private function logExportActivity(User $actor, string $reportLabel, string $format, string $filename, array $meta): void
    {
        activity(ActivityLogCategory::Report->value)
            ->causedBy($actor)
            ->event('exported')
            ->withProperties([
                'report_name' => $reportLabel,
                'export_format' => $format,
                'filename' => $filename,
                ...$meta,
            ])
            ->log("Mengekspor {$reportLabel} ({$format}): {$filename}.");
    }
}

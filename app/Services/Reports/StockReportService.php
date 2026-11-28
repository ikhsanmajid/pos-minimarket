<?php

namespace App\Services\Reports;

use App\Enums\StockMovementType;
use App\Enums\TransactionStatus;
use App\Models\Product;
use App\Models\StockMovement;
use App\Models\TransactionDetail;
use Carbon\CarbonImmutable;
use Illuminate\Pagination\LengthAwarePaginator;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

class StockReportService
{
    public const int MIN_FAST_MOVING_THRESHOLD = 10;

    public function __construct(public ReportPeriodResolver $periodResolver) {}

    /**
     * @param  array<string, mixed>  $filters
     * @return array<string, mixed>
     */
    public function getReportData(array $filters, bool $paginate = true): array
    {
        $period = $this->periodResolver->resolve($filters, '30d');
        $categoryId = isset($filters['category_id']) && $filters['category_id'] !== '' ? (int) $filters['category_id'] : null;
        $movementClass = isset($filters['movement_class']) && is_string($filters['movement_class']) && $filters['movement_class'] !== ''
            ? $filters['movement_class']
            : 'all';
        $search = isset($filters['search']) && is_string($filters['search']) ? trim($filters['search']) : '';

        // Ambil total penjualan satuan dasar per produk (non-voided) dalam periode evaluasi
        $soldByProduct = TransactionDetail::query()
            ->join('transactions', 'transactions.id', '=', 'transaction_details.transaction_id')
            ->whereBetween('transactions.created_at', [$period['start'], $period['end']])
            ->where('transactions.status', '!=', TransactionStatus::Voided->value)
            ->selectRaw("
                transaction_details.product_id,
                COALESCE(SUM(CASE WHEN transaction_details.base_qty > 0 THEN transaction_details.base_qty ELSE CAST(COALESCE(NULLIF(transaction_details.quantity, ''), '0') AS NUMERIC) END), 0) as qty_sold
            ")
            ->groupBy('transaction_details.product_id')
            ->pluck('qty_sold', 'product_id')
            ->map(fn ($v): int => (int) round((float) $v));

        // Ambil seluruh produk aktif (soft-deleted otomatis dikecualikan)
        $allProducts = Product::query()
            ->leftJoin('categories', 'categories.id', '=', 'products.category_id')
            ->when($categoryId !== null, fn ($q) => $q->where('products.category_id', $categoryId))
            ->get([
                'products.id',
                'products.barcode',
                'products.name',
                'products.base_unit',
                'products.buy_price',
                'products.sell_price',
                'products.stock',
                'products.min_stock',
                'products.active',
                DB::raw("COALESCE(categories.name, 'Tanpa Kategori') as category_name"),
            ]);

        // Hitung ambang batas fast_moving yang deterministik: max(10, rata-rata qty terjual dari produk yang laku)
        $soldValues = $allProducts
            ->map(fn (Product $p): int => (int) ($soldByProduct[$p->id] ?? 0))
            ->filter(fn (int $qty): bool => $qty > 0);

        $avgSold = $soldValues->isNotEmpty() ? (float) $soldValues->avg() : 0.0;
        $fastThreshold = max(self::MIN_FAST_MOVING_THRESHOLD, (int) ceil($avgSold));

        $totalAssetValue = 0.0;
        $totalPotentialSales = 0.0;
        $fastCount = 0;
        $slowCount = 0;
        $deadCount = 0;
        $outOfStockCount = 0;

        $evaluated = $allProducts->map(function (Product $product) use (
            $soldByProduct,
            $fastThreshold,
            &$totalAssetValue,
            &$totalPotentialSales,
            &$fastCount,
            &$slowCount,
            &$deadCount,
            &$outOfStockCount
        ): array {
            $stock = (int) $product->stock;
            $buyPrice = round((float) $product->buy_price, 2);
            $sellPrice = round((float) $product->sell_price, 2);
            $assetValue = round($stock * $buyPrice, 2);
            $potentialSales = round($stock * $sellPrice, 2);
            $qtySold = (int) ($soldByProduct[$product->id] ?? 0);

            $totalAssetValue = round($totalAssetValue + $assetValue, 2);
            $totalPotentialSales = round($totalPotentialSales + $potentialSales, 2);

            if ($qtySold >= $fastThreshold) {
                $class = 'fast_moving';
                $classLabel = 'Fast Moving';
                $fastCount++;
            } elseif ($qtySold > 0) {
                $class = 'slow_moving';
                $classLabel = 'Slow Moving';
                $slowCount++;
            } elseif ($stock > 0) {
                $class = 'dead_stock';
                $classLabel = 'Dead Stock';
                $deadCount++;
            } else {
                $class = 'out_of_stock';
                $classLabel = 'Stok Habis';
                $outOfStockCount++;
            }

            return [
                'product_id' => $product->id,
                'barcode' => (string) ($product->barcode ?? '-'),
                'product_name' => (string) $product->name,
                'category_name' => (string) ($product->getAttribute('category_name') ?? 'Tanpa Kategori'),
                'base_unit' => (string) ($product->base_unit ?: 'pcs'),
                'stock' => $stock,
                'min_stock' => (int) $product->min_stock,
                'buy_price' => $buyPrice,
                'sell_price' => $sellPrice,
                'asset_value' => $assetValue,
                'potential_sales' => $potentialSales,
                'potential_profit' => round($potentialSales - $assetValue, 2),
                'qty_sold' => $qtySold,
                'movement_class' => $class,
                'movement_label' => $classLabel,
            ];
        });

        // Filter untuk tabel (movement_class & search)
        $filtered = $evaluated->filter(function (array $row) use ($movementClass, $search): bool {
            if ($movementClass !== 'all' && $row['movement_class'] !== $movementClass) {
                return false;
            }

            if ($search !== '') {
                $needle = mb_strtolower($search);
                $haystack = mb_strtolower($row['product_name'].' '.$row['barcode'].' '.$row['category_name']);

                return str_contains($haystack, $needle);
            }

            return true;
        })->values();

        $sorted = $this->sortCollection($filtered, $filters, 'asset_value', 'desc');

        $productsOutput = $paginate
            ? $this->paginateCollection($sorted, $filters)
            : $sorted;

        $movementSummary = $this->getMovementSummary($period['start'], $period['end'], $categoryId);

        return [
            'period' => [
                'preset' => $period['preset'],
                'start_date' => $period['start_date'],
                'end_date' => $period['end_date'],
                'label' => $period['label'],
                'days' => $period['days'],
            ],
            'summary' => [
                'total_asset_value' => $totalAssetValue,
                'total_potential_sales' => $totalPotentialSales,
                'total_potential_profit' => round($totalPotentialSales - $totalAssetValue, 2),
                'total_skus' => $allProducts->count(),
                'fast_moving_count' => $fastCount,
                'slow_moving_count' => $slowCount,
                'dead_stock_count' => $deadCount,
                'out_of_stock_count' => $outOfStockCount,
                'fast_moving_threshold' => $fastThreshold,
            ],
            'composition' => [
                ['key' => 'fast_moving', 'label' => 'Fast Moving', 'count' => $fastCount],
                ['key' => 'slow_moving', 'label' => 'Slow Moving', 'count' => $slowCount],
                ['key' => 'dead_stock', 'label' => 'Dead Stock', 'count' => $deadCount],
                ['key' => 'out_of_stock', 'label' => 'Stok Habis', 'count' => $outOfStockCount],
            ],
            'movementSummary' => $movementSummary,
            'products' => $productsOutput,
        ];
    }

    /**
     * @return array<int, array{type: string, label: string, qty_in: int, qty_out: int, movements_count: int}>
     */
    private function getMovementSummary(CarbonImmutable $start, CarbonImmutable $end, ?int $categoryId): array
    {
        $rows = StockMovement::query()
            ->join('products', 'products.id', '=', 'stock_movements.product_id')
            ->whereBetween('stock_movements.created_at', [$start, $end])
            ->when($categoryId !== null, fn ($q) => $q->where('products.category_id', $categoryId))
            ->selectRaw('
                stock_movements.type,
                COUNT(*) as movements_count,
                COALESCE(SUM(CASE WHEN stock_movements.qty_change >= 0 THEN stock_movements.qty_change ELSE 0 END), 0) as qty_in,
                COALESCE(SUM(CASE WHEN stock_movements.qty_change < 0 THEN ABS(stock_movements.qty_change) ELSE 0 END), 0) as qty_out
            ')
            ->groupBy('stock_movements.type')
            ->get();

        return $rows->map(function (object $row): array {
            $typeVal = $row->type instanceof StockMovementType ? $row->type->value : (string) ($row->type ?? '');
            $enum = StockMovementType::tryFrom($typeVal);

            return [
                'type' => $typeVal,
                'label' => $enum ? $enum->label() : ucfirst(str_replace('_', ' ', $typeVal)),
                'qty_in' => (int) ($row->qty_in ?? 0),
                'qty_out' => (int) ($row->qty_out ?? 0),
                'movements_count' => (int) ($row->movements_count ?? 0),
            ];
        })->sortByDesc('movements_count')->values()->all();
    }

    /**
     * @param  Collection<int, array<string, mixed>>  $collection
     * @param  array<string, mixed>  $filters
     * @return Collection<int, array<string, mixed>>
     */
    private function sortCollection(Collection $collection, array $filters, string $defaultKey, string $defaultDir): Collection
    {
        $allowed = ['product_name', 'category_name', 'stock', 'buy_price', 'asset_value', 'qty_sold', 'movement_class'];
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
}

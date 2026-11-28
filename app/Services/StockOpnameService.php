<?php

namespace App\Services;

use App\Enums\ActivityLogCategory;
use App\Enums\StockMovementType;
use App\Enums\StockOpnameStatus;
use App\Models\Product;
use App\Models\ProductUnit;
use App\Models\StockMovement;
use App\Models\StockOpname;
use App\Models\StockOpnameItem;
use App\Models\User;
use Illuminate\Database\Eloquent\Collection as EloquentCollection;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class StockOpnameService
{
    /**
     * Membuat sesi Stock Opname baru dan mengisi snapshot item produk aktif.
     *
     * @param  array{
     *     category_id?: int|null,
     *     is_blind_count?: bool,
     *     notes?: string|null
     * }  $data
     */
    public function createSession(array $data, User $actor): StockOpname
    {
        return DB::transaction(function () use ($data, $actor): StockOpname {
            $categoryId = isset($data['category_id']) && $data['category_id'] !== ''
                ? (int) $data['category_id']
                : null;

            $activeStatuses = [StockOpnameStatus::Draft->value, StockOpnameStatus::InProgress->value];

            // Cegah sesi opname tumpang tindih pada cakupan yang sama
            $conflictQuery = StockOpname::query()->whereIn('status', $activeStatuses);
            if ($categoryId === null) {
                $conflict = $conflictQuery->first();
                if ($conflict instanceof StockOpname) {
                    throw ValidationException::withMessages([
                        'category_id' => "Tidak dapat membuat sesi opname seluruh toko karena sesi {$conflict->opname_number} masih berlangsung. Selesaikan atau batalkan sesi tersebut terlebih dahulu.",
                    ]);
                }
            } else {
                $conflict = $conflictQuery
                    ->where(function ($q) use ($categoryId): void {
                        $q->whereNull('category_id')
                            ->orWhere('category_id', $categoryId);
                    })
                    ->first();

                if ($conflict instanceof StockOpname) {
                    $scopeLabel = $conflict->category_id === null ? 'seluruh toko' : 'kategori yang sama';
                    throw ValidationException::withMessages([
                        'category_id' => "Sudah ada sesi opname aktif ({$conflict->opname_number}) untuk {$scopeLabel}. Selesaikan atau batalkan sesi tersebut terlebih dahulu.",
                    ]);
                }
            }

            /** @var EloquentCollection<int, Product> $products */
            $products = Product::query()
                ->where('active', true)
                ->when($categoryId !== null, fn ($q) => $q->where('category_id', $categoryId))
                ->orderBy('name')
                ->get(['id', 'stock', 'buy_price']);

            if ($products->isEmpty()) {
                throw ValidationException::withMessages([
                    'category_id' => 'Tidak ada produk aktif yang ditemukan untuk cakupan opname yang dipilih.',
                ]);
            }

            $now = now();
            $opnameNumber = $this->generateOpnameNumber();
            $isBlindCount = array_key_exists('is_blind_count', $data) ? (bool) $data['is_blind_count'] : true;
            $notes = isset($data['notes']) && trim((string) $data['notes']) !== '' ? trim((string) $data['notes']) : null;

            $opname = StockOpname::create([
                'opname_number' => $opnameNumber,
                'status' => StockOpnameStatus::InProgress,
                'category_id' => $categoryId,
                'is_blind_count' => $isBlindCount,
                'notes' => $notes,
                'started_at' => $now,
                'created_by' => $actor->id,
                'total_items_counted' => 0,
                'total_variance_items' => 0,
                'total_variance_value' => 0,
            ]);

            $insertRows = [];
            foreach ($products as $product) {
                $insertRows[] = [
                    'stock_opname_id' => $opname->id,
                    'product_id' => $product->id,
                    'system_stock' => (int) $product->stock,
                    'physical_stock' => null,
                    'variance_qty' => 0,
                    'unit_cost_snapshot' => round((float) $product->buy_price, 2),
                    'variance_value' => 0,
                    'notes' => null,
                    'counted_by' => null,
                    'counted_at' => null,
                    'created_at' => $now,
                    'updated_at' => $now,
                ];
            }

            foreach (array_chunk($insertRows, 500) as $chunk) {
                StockOpnameItem::insert($chunk);
            }

            $opname->load(['category:id,name', 'creator:id,name,role']);

            activity(ActivityLogCategory::StockOpname->value)
                ->event('created')
                ->performedOn($opname)
                ->causedBy($actor)
                ->withProperties([
                    'opname_number' => $opname->opname_number,
                    'category_name' => $opname->category?->name ?? 'Seluruh Toko',
                    'is_blind_count' => $isBlindCount,
                    'items_count' => $products->count(),
                    'status' => StockOpnameStatus::InProgress->value,
                    'notes' => $notes,
                ])
                ->log(sprintf(
                    'Sesi Stock Opname %s (%s, %d produk) dimulai oleh %s.',
                    $opname->opname_number,
                    $opname->category?->name ?? 'Seluruh Toko',
                    $products->count(),
                    $actor->name
                ));

            return $opname;
        });
    }

    /**
     * Menyimpan penghitungan fisik secara bertahap (incremental draft save).
     *
     * @param  array<int, array{
     *     id: int,
     *     physical_stock: int|null,
     *     notes?: string|null
     * }>  $items
     */
    public function saveCounts(StockOpname $opname, array $items, User $actor): StockOpname
    {
        return DB::transaction(function () use ($opname, $items, $actor): StockOpname {
            /** @var StockOpname $lockedOpname */
            $lockedOpname = StockOpname::query()
                ->where('id', $opname->id)
                ->lockForUpdate()
                ->firstOrFail();

            if (! $lockedOpname->status->isEditable()) {
                throw ValidationException::withMessages([
                    'status' => "Sesi opname {$lockedOpname->opname_number} sudah berstatus {$lockedOpname->status->label()} dan tidak dapat diubah.",
                ]);
            }

            $itemIds = array_values(array_unique(array_map(
                fn (array $row): int => (int) $row['id'],
                $items
            )));

            /** @var EloquentCollection<int, StockOpnameItem> $existingItems */
            $existingItems = StockOpnameItem::query()
                ->where('stock_opname_id', $lockedOpname->id)
                ->whereIn('id', $itemIds)
                ->lockForUpdate()
                ->get()
                ->keyBy('id');

            $now = now();

            foreach ($items as $row) {
                $itemId = (int) $row['id'];
                /** @var StockOpnameItem|null $opnameItem */
                $opnameItem = $existingItems->get($itemId);

                if (! $opnameItem instanceof StockOpnameItem) {
                    continue;
                }

                $rawPhysical = $row['physical_stock'] ?? null;
                $physicalStock = ($rawPhysical === null || $rawPhysical === '')
                    ? null
                    : (int) $rawPhysical;

                if ($physicalStock !== null && $physicalStock < 0) {
                    throw ValidationException::withMessages([
                        'items' => 'Stok fisik tidak boleh bernilai negatif.',
                    ]);
                }

                $itemNotes = array_key_exists('notes', $row)
                    ? (trim((string) ($row['notes'] ?? '')) !== '' ? trim((string) $row['notes']) : null)
                    : $opnameItem->notes;

                if ($physicalStock === null) {
                    $opnameItem->physical_stock = null;
                    $opnameItem->variance_qty = 0;
                    $opnameItem->variance_value = 0;
                    $opnameItem->counted_by = null;
                    $opnameItem->counted_at = null;
                } else {
                    $varianceQty = $physicalStock - (int) $opnameItem->system_stock;
                    $varianceValue = round($varianceQty * (float) $opnameItem->unit_cost_snapshot, 2);

                    $opnameItem->physical_stock = $physicalStock;
                    $opnameItem->variance_qty = $varianceQty;
                    $opnameItem->variance_value = $varianceValue;
                    $opnameItem->counted_by = $actor->id;
                    $opnameItem->counted_at = $now;
                }

                $opnameItem->notes = $itemNotes;
                $opnameItem->save();
            }

            if ($lockedOpname->status === StockOpnameStatus::Draft) {
                $lockedOpname->status = StockOpnameStatus::InProgress;
                $lockedOpname->started_at ??= $now;
            }

            $this->refreshHeaderAggregates($lockedOpname);

            return $lockedOpname->fresh(['category:id,name', 'creator:id,name,role', 'approver:id,name,role']) ?? $lockedOpname;
        });
    }

    /**
     * Pencarian cepat barcode produk maupun barcode ProductUnit (Multi-UOM) di dalam sesi opname.
     *
     * @return array<string, mixed>|null
     */
    public function lookupBarcodeInSession(StockOpname $opname, string $barcode, bool $canSeeSystemStock): ?array
    {
        $term = trim($barcode);
        if ($term === '') {
            return null;
        }

        $matchedProductId = null;
        $conversionFactor = 1;
        $matchedUnitName = null;

        // 1. Cek kecocokan persis barcode unit (Multi-UOM) terlebih dahulu
        /** @var ProductUnit|null $matchedUnit */
        $matchedUnit = ProductUnit::query()
            ->where('barcode', $term)
            ->where('is_active', true)
            ->first(['id', 'product_id', 'unit_name', 'conversion_factor']);

        if ($matchedUnit instanceof ProductUnit) {
            $matchedProductId = $matchedUnit->product_id;
            $conversionFactor = max(1, (int) $matchedUnit->conversion_factor);
            $matchedUnitName = $matchedUnit->unit_name;
        } else {
            // 2. Cek kecocokan persis barcode produk
            /** @var Product|null $matchedProduct */
            $matchedProduct = Product::query()
                ->where('barcode', $term)
                ->first(['id', 'base_unit']);

            if ($matchedProduct instanceof Product) {
                $matchedProductId = $matchedProduct->id;
                $matchedUnitName = $matchedProduct->base_unit ?: 'pcs';
            }
        }

        if ($matchedProductId === null) {
            return null;
        }

        /** @var StockOpnameItem|null $item */
        $item = StockOpnameItem::query()
            ->where('stock_opname_id', $opname->id)
            ->where('product_id', $matchedProductId)
            ->with(['product:id,name,barcode,base_unit'])
            ->first();

        if (! $item instanceof StockOpnameItem) {
            return null;
        }

        $hideSystem = $opname->is_blind_count && $opname->status->isEditable() && ! $canSeeSystemStock;

        $payload = [
            'item_id' => $item->id,
            'product_id' => $item->product_id,
            'product_name' => $item->product?->name ?? '-',
            'barcode' => $item->product?->barcode ?? '',
            'base_unit' => $item->product?->base_unit ?: 'pcs',
            'matched_unit_name' => $matchedUnitName ?? ($item->product?->base_unit ?: 'pcs'),
            'conversion_factor' => $conversionFactor,
            'physical_stock' => $item->physical_stock,
            'notes' => $item->notes,
        ];

        if (! $hideSystem) {
            $payload['system_stock'] = (int) $item->system_stock;
            $payload['variance_qty'] = (int) $item->variance_qty;
            $payload['variance_value'] = round((float) $item->variance_value, 2);
        }

        return $payload;
    }

    /**
     * Finalisasi sesi opname (hanya Admin/Supervisor):
     * - Mengunci seluruh produk terkait secara terurut (anti-deadlock PostgreSQL).
     * - Menyinkronkan system_stock terhadap stok aktual produk saat momen finalisasi.
     * - Hanya meng-update products.stock dan membuat StockMovement untuk item dengan variance_qty != 0.
     * - Mengunci permanen dokumen opname menjadi completed.
     */
    public function finalize(StockOpname $opname, User $approver): StockOpname
    {
        return DB::transaction(function () use ($opname, $approver): StockOpname {
            /** @var StockOpname $lockedOpname */
            $lockedOpname = StockOpname::query()
                ->where('id', $opname->id)
                ->lockForUpdate()
                ->firstOrFail();

            if (! $lockedOpname->status->isEditable()) {
                throw ValidationException::withMessages([
                    'status' => "Sesi opname {$lockedOpname->opname_number} berstatus {$lockedOpname->status->label()} sehingga tidak dapat difinalisasi.",
                ]);
            }

            /** @var EloquentCollection<int, StockOpnameItem> $items */
            $items = StockOpnameItem::query()
                ->where('stock_opname_id', $lockedOpname->id)
                ->orderBy('product_id')
                ->lockForUpdate()
                ->get();

            if ($items->isEmpty()) {
                throw ValidationException::withMessages([
                    'items' => 'Sesi opname tidak memiliki item produk untuk difinalisasi.',
                ]);
            }

            $uncountedCount = $items->filter(fn (StockOpnameItem $item): bool => $item->physical_stock === null)->count();
            if ($uncountedCount > 0) {
                throw ValidationException::withMessages([
                    'items' => "Masih terdapat {$uncountedCount} produk yang belum dihitung stok fisiknya. Lengkapi seluruh penghitungan sebelum finalisasi.",
                ]);
            }

            // Kunci semua baris produk terkait terurut berdasarkan id untuk mencegah deadlock PostgreSQL
            $productIds = $items->pluck('product_id')->unique()->sort()->values()->all();

            /** @var EloquentCollection<int, Product> $lockedProducts */
            $lockedProducts = Product::query()
                ->whereIn('id', $productIds)
                ->orderBy('id')
                ->lockForUpdate()
                ->get()
                ->keyBy('id');

            $totalCounted = 0;
            $totalVarianceItems = 0;
            $totalVarianceValue = 0.0;

            foreach ($items as $item) {
                /** @var Product|null $product */
                $product = $lockedProducts->get($item->product_id);
                if (! $product instanceof Product) {
                    continue;
                }

                $physicalStock = (int) $item->physical_stock;
                // Perlindungan konkurensi: sinkronkan system_stock dengan stok produk aktual saat finalisasi
                $currentSystemStock = (int) $product->stock;
                $unitCost = (float) $item->unit_cost_snapshot > 0
                    ? round((float) $item->unit_cost_snapshot, 2)
                    : round((float) $product->buy_price, 2);

                $varianceQty = $physicalStock - $currentSystemStock;
                $varianceValue = round($varianceQty * $unitCost, 2);

                $item->system_stock = $currentSystemStock;
                $item->unit_cost_snapshot = $unitCost;
                $item->variance_qty = $varianceQty;
                $item->variance_value = $varianceValue;
                $item->save();

                $totalCounted++;

                if ($varianceQty !== 0) {
                    $totalVarianceItems++;
                    $totalVarianceValue = round($totalVarianceValue + $varianceValue, 2);

                    $product->stock = $physicalStock;
                    $product->save();

                    $movementNote = "Stock Opname {$lockedOpname->opname_number}";
                    if (! empty($item->notes)) {
                        $movementNote .= " — {$item->notes}";
                    }

                    StockMovement::create([
                        'product_id' => $product->id,
                        'type' => StockMovementType::Opname,
                        'reference_type' => StockOpname::class,
                        'reference_id' => $lockedOpname->id,
                        'stock_before' => $currentSystemStock,
                        'qty_change' => $varianceQty,
                        'stock_after' => $physicalStock,
                        'unit_cost' => $unitCost,
                        'notes' => $movementNote,
                        'created_by' => $approver->id,
                    ]);
                }
            }

            $oldStatus = $lockedOpname->status->value;
            $lockedOpname->update([
                'status' => StockOpnameStatus::Completed,
                'completed_at' => now(),
                'approved_by' => $approver->id,
                'total_items_counted' => $totalCounted,
                'total_variance_items' => $totalVarianceItems,
                'total_variance_value' => $totalVarianceValue,
            ]);

            activity(ActivityLogCategory::StockOpname->value)
                ->event('completed')
                ->performedOn($lockedOpname)
                ->causedBy($approver)
                ->withProperties([
                    'opname_number' => $lockedOpname->opname_number,
                    'old_status' => $oldStatus,
                    'new_status' => StockOpnameStatus::Completed->value,
                    'total_items_counted' => $totalCounted,
                    'total_variance_items' => $totalVarianceItems,
                    'total_variance_value' => $totalVarianceValue,
                    'approved_by' => $approver->name,
                ])
                ->log(sprintf(
                    'Stock Opname %s difinalisasi oleh %s (%d produk dihitung, %d item berselisih, total selisih Rp %s).',
                    $lockedOpname->opname_number,
                    $approver->name,
                    $totalCounted,
                    $totalVarianceItems,
                    number_format($totalVarianceValue, 0, ',', '.')
                ));

            return $lockedOpname->fresh(['category:id,name', 'creator:id,name,role', 'approver:id,name,role']) ?? $lockedOpname;
        });
    }

    /**
     * Membatalkan sesi opname yang belum selesai tanpa mengubah stok produk.
     */
    public function cancel(StockOpname $opname, User $actor, ?string $reason = null): StockOpname
    {
        return DB::transaction(function () use ($opname, $actor, $reason): StockOpname {
            /** @var StockOpname $lockedOpname */
            $lockedOpname = StockOpname::query()
                ->where('id', $opname->id)
                ->lockForUpdate()
                ->firstOrFail();

            if ($lockedOpname->status->isLocked()) {
                throw ValidationException::withMessages([
                    'status' => "Sesi opname {$lockedOpname->opname_number} sudah berstatus {$lockedOpname->status->label()} dan tidak dapat dibatalkan.",
                ]);
            }

            $oldStatus = $lockedOpname->status->value;
            $cleanReason = $reason !== null && trim($reason) !== '' ? trim($reason) : null;
            $updatedNotes = $lockedOpname->notes;

            if ($cleanReason !== null) {
                $updatedNotes = $updatedNotes
                    ? "{$updatedNotes}\n[Dibatalkan]: {$cleanReason}"
                    : "[Dibatalkan]: {$cleanReason}";
            }

            $lockedOpname->update([
                'status' => StockOpnameStatus::Cancelled,
                'cancelled_at' => now(),
                'notes' => $updatedNotes,
            ]);

            activity(ActivityLogCategory::StockOpname->value)
                ->event('cancelled')
                ->performedOn($lockedOpname)
                ->causedBy($actor)
                ->withProperties([
                    'opname_number' => $lockedOpname->opname_number,
                    'old_status' => $oldStatus,
                    'new_status' => StockOpnameStatus::Cancelled->value,
                    'reason' => $cleanReason,
                ])
                ->log(sprintf(
                    'Sesi Stock Opname %s dibatalkan oleh %s.%s',
                    $lockedOpname->opname_number,
                    $actor->name,
                    $cleanReason ? " Alasan: {$cleanReason}" : ''
                ));

            return $lockedOpname->fresh(['category:id,name', 'creator:id,name,role', 'approver:id,name,role']) ?? $lockedOpname;
        });
    }

    /**
     * Menghitung 4 metrik ringkasan KPI Stock Opname dalam 1 query agregasi.
     *
     * @return array{
     *     total_sessions: int,
     *     in_progress_sessions: int,
     *     completed_sessions: int,
     *     total_variance_value: float
     * }
     */
    public function getSummary(): array
    {
        $draftVal = StockOpnameStatus::Draft->value;
        $inProgressVal = StockOpnameStatus::InProgress->value;
        $completedVal = StockOpnameStatus::Completed->value;

        /** @var object{total_sessions: int|string|null, in_progress_sessions: int|string|null, completed_sessions: int|string|null, total_variance_value: float|int|string|null}|null $row */
        $row = StockOpname::query()
            ->selectRaw(
                'COUNT(*) as total_sessions,
                COALESCE(SUM(CASE WHEN status IN (?, ?) THEN 1 ELSE 0 END), 0) as in_progress_sessions,
                COALESCE(SUM(CASE WHEN status = ? THEN 1 ELSE 0 END), 0) as completed_sessions,
                COALESCE(SUM(CASE WHEN status = ? THEN total_variance_value ELSE 0 END), 0) as total_variance_value',
                [$draftVal, $inProgressVal, $completedVal, $completedVal]
            )
            ->first();

        return [
            'total_sessions' => (int) ($row->total_sessions ?? 0),
            'in_progress_sessions' => (int) ($row->in_progress_sessions ?? 0),
            'completed_sessions' => (int) ($row->completed_sessions ?? 0),
            'total_variance_value' => round((float) ($row->total_variance_value ?? 0), 2),
        ];
    }

    private function refreshHeaderAggregates(StockOpname $opname): void
    {
        /** @var object{counted: int|string|null, variance_items: int|string|null, variance_value: float|int|string|null}|null $agg */
        $agg = StockOpnameItem::query()
            ->where('stock_opname_id', $opname->id)
            ->selectRaw(
                'COALESCE(SUM(CASE WHEN physical_stock IS NOT NULL THEN 1 ELSE 0 END), 0) as counted,
                COALESCE(SUM(CASE WHEN physical_stock IS NOT NULL AND variance_qty != 0 THEN 1 ELSE 0 END), 0) as variance_items,
                COALESCE(SUM(CASE WHEN physical_stock IS NOT NULL THEN variance_value ELSE 0 END), 0) as variance_value'
            )
            ->first();

        $opname->total_items_counted = (int) ($agg->counted ?? 0);
        $opname->total_variance_items = (int) ($agg->variance_items ?? 0);
        $opname->total_variance_value = round((float) ($agg->variance_value ?? 0), 2);
        $opname->save();
    }

    private function generateOpnameNumber(): string
    {
        $prefix = 'OPN-'.now()->format('Ymd').'-';

        /** @var string|null $lastNumber */
        $lastNumber = StockOpname::query()
            ->where('opname_number', 'like', $prefix.'%')
            ->lockForUpdate()
            ->orderByDesc('opname_number')
            ->value('opname_number');

        $nextSeq = 1;
        if ($lastNumber !== null) {
            $suffix = substr($lastNumber, strlen($prefix));
            if (is_numeric($suffix)) {
                $nextSeq = ((int) $suffix) + 1;
            }
        }

        return $prefix.str_pad((string) $nextSeq, 4, '0', STR_PAD_LEFT);
    }
}

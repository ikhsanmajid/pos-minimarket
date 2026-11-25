<?php

namespace App\Services;

use App\Models\Product;
use App\Models\ProductUnit;
use Illuminate\Support\Facades\DB;

class ProductUnitService
{
    /**
     * Membuat produk baru beserta daftar konversi Multi-UOM secara atomik.
     *
     * @param  array<string, mixed>  $productData
     * @param  array<int, array<string, mixed>>  $unitsData
     */
    public function createProductWithUnits(array $productData, array $unitsData = []): Product
    {
        return DB::transaction(function () use ($productData, $unitsData): Product {
            unset($productData['units'], $productData['units_present']);

            $product = Product::create($productData);

            if (! empty($unitsData)) {
                $this->syncUnits($product, $unitsData);
            }

            return $product->load(['category', 'units']);
        });
    }

    /**
     * Memperbarui produk beserta daftar konversi Multi-UOM secara atomik.
     *
     * @param  array<string, mixed>  $productData
     * @param  array<int, array<string, mixed>>|null  $unitsData
     */
    public function updateProductWithUnits(Product $product, array $productData, ?array $unitsData = null): Product
    {
        return DB::transaction(function () use ($product, $productData, $unitsData): Product {
            unset($productData['stock'], $productData['units'], $productData['units_present']);

            $product->update($productData);

            if ($unitsData !== null) {
                $this->syncUnits($product, $unitsData);
            }

            return $product->load(['category', 'units']);
        });
    }

    /**
     * Sinkronisasi daftar satuan konversi (create / update / delete) untuk satu produk.
     * Memastikan maksimal hanya satu satuan yang menjadi default pembelian (is_default_purchase).
     *
     * @param  array<int, array<string, mixed>>  $unitsData
     */
    public function syncUnits(Product $product, array $unitsData): void
    {
        $existingUnits = $product->units()->get()->keyBy('id');
        $keptIds = [];
        $hasDefaultPurchase = false;

        foreach ($unitsData as $row) {
            $unitName = trim((string) ($row['unit_name'] ?? ''));
            if ($unitName === '') {
                continue;
            }

            $isActive = (bool) ($row['is_active'] ?? true);
            $isDefaultPurchase = $isActive && (bool) ($row['is_default_purchase'] ?? false);

            if ($isDefaultPurchase && $hasDefaultPurchase) {
                $isDefaultPurchase = false;
            } elseif ($isDefaultPurchase) {
                $hasDefaultPurchase = true;
            }

            $barcode = isset($row['barcode']) && trim((string) $row['barcode']) !== ''
                ? trim((string) $row['barcode'])
                : null;

            $sellPrice = isset($row['sell_price']) && $row['sell_price'] !== '' && $row['sell_price'] !== null
                ? round(max(0, (float) $row['sell_price']), 2)
                : null;

            $payload = [
                'unit_name' => $unitName,
                'conversion_factor' => max(1, (int) ($row['conversion_factor'] ?? 1)),
                'barcode' => $barcode,
                'buy_price' => round(max(0, (float) ($row['buy_price'] ?? 0)), 2),
                'sell_price' => $sellPrice,
                'is_default_purchase' => $isDefaultPurchase,
                'is_active' => $isActive,
            ];

            $unitId = isset($row['id']) && $row['id'] !== '' ? (int) $row['id'] : null;

            if ($unitId && $existingUnits->has($unitId)) {
                /** @var ProductUnit $unit */
                $unit = $existingUnits->get($unitId);
                $unit->update($payload);
                $keptIds[] = $unit->id;
            } else {
                $created = $product->units()->create($payload);
                $keptIds[] = $created->id;
            }
        }

        // Hapus satuan yang dihapus dari daftar
        $idsToDelete = $existingUnits->keys()->diff($keptIds)->all();
        if (! empty($idsToDelete)) {
            $product->units()->whereIn('id', $idsToDelete)->delete();
        }
    }
}

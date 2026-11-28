<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreProductPriceTierRequest;
use App\Http\Requests\UpdateProductPriceTierRequest;
use App\Models\Product;
use App\Models\ProductPriceTier;
use App\Support\PricingMath;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\Gate;

class ProductPriceTierController extends Controller
{
    public function store(StoreProductPriceTierRequest $request, Product $product): RedirectResponse
    {
        $validated = $request->validated();

        $product->priceTiers()->create([
            'product_unit_id' => $validated['product_unit_id'] ?? null,
            'min_qty' => (int) $validated['min_qty'],
            'unit_price' => PricingMath::toRupiah($validated['unit_price']),
            'is_active' => (bool) ($validated['is_active'] ?? true),
        ]);

        return back()->with('success', 'Aturan harga grosir berhasil ditambahkan.');
    }

    public function update(UpdateProductPriceTierRequest $request, Product $product, ProductPriceTier $priceTier): RedirectResponse
    {
        abort_unless($priceTier->product_id === $product->id, 404);

        $validated = $request->validated();

        $priceTier->update([
            'product_unit_id' => $validated['product_unit_id'] ?? null,
            'min_qty' => (int) $validated['min_qty'],
            'unit_price' => PricingMath::toRupiah($validated['unit_price']),
            'is_active' => (bool) ($validated['is_active'] ?? true),
        ]);

        return back()->with('success', 'Aturan harga grosir berhasil diperbarui.');
    }

    public function destroy(Product $product, ProductPriceTier $priceTier): RedirectResponse
    {
        Gate::authorize('update', $product);
        abort_unless($priceTier->product_id === $product->id, 404);

        $priceTier->delete();

        return back()->with('success', 'Aturan harga grosir berhasil dihapus.');
    }
}

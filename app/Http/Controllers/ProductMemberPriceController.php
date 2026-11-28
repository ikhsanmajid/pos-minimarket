<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreProductMemberPriceRequest;
use App\Http\Requests\UpdateProductMemberPriceRequest;
use App\Models\Product;
use App\Models\ProductMemberPrice;
use App\Support\PricingMath;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\Gate;

class ProductMemberPriceController extends Controller
{
    public function store(StoreProductMemberPriceRequest $request, Product $product): RedirectResponse
    {
        $validated = $request->validated();

        $product->memberPrices()->create([
            'product_unit_id' => $validated['product_unit_id'] ?? null,
            'tier' => isset($validated['tier']) && $validated['tier'] !== '' ? $validated['tier'] : null,
            'member_price' => PricingMath::toRupiah($validated['member_price']),
            'is_active' => (bool) ($validated['is_active'] ?? true),
        ]);

        return back()->with('success', 'Aturan harga member berhasil ditambahkan.');
    }

    public function update(
        UpdateProductMemberPriceRequest $request,
        Product $product,
        ProductMemberPrice $memberPrice
    ): RedirectResponse {
        abort_unless($memberPrice->product_id === $product->id, 404);

        $validated = $request->validated();

        $memberPrice->update([
            'product_unit_id' => $validated['product_unit_id'] ?? null,
            'tier' => isset($validated['tier']) && $validated['tier'] !== '' ? $validated['tier'] : null,
            'member_price' => PricingMath::toRupiah($validated['member_price']),
            'is_active' => (bool) ($validated['is_active'] ?? true),
        ]);

        return back()->with('success', 'Aturan harga member berhasil diperbarui.');
    }

    public function destroy(Product $product, ProductMemberPrice $memberPrice): RedirectResponse
    {
        Gate::authorize('update', $product);
        abort_unless($memberPrice->product_id === $product->id, 404);

        $memberPrice->delete();

        return back()->with('success', 'Aturan harga member berhasil dihapus.');
    }
}

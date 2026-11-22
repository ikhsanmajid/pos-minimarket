<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreProductRequest;
use App\Http\Requests\UpdateProductRequest;
use App\Models\Category;
use App\Models\Product;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Storage;
use Inertia\Inertia;
use Inertia\Response;

class ProductController extends Controller
{
    public function index(Request $request): Response
    {
        Gate::authorize('viewAny', Product::class);

        $filters = $request->only(['search', 'status', 'category_id', 'stock_status', 'sort', 'direction']);

        $perPage = $request->integer('per_page', 10);

        $sort = $request->input('sort', 'created_at');
        $direction = strtolower($request->input('direction', 'desc')) === 'asc' ? 'asc' : 'desc';
        $allowedSorts = ['name', 'barcode', 'buy_price', 'sell_price', 'stock', 'active', 'created_at'];
        if (! in_array($sort, $allowedSorts, true)) {
            $sort = 'created_at';
        }

        $products = Product::with('category')
            ->when($request->search, function ($query, $search) {
                $query->where(function ($q) use ($search) {
                    $q->where('name', 'ilike', "%{$search}%")
                        ->orWhere('barcode', 'ilike', "%{$search}%");
                });
            })
            ->when($request->category_id && $request->category_id !== 'all', function ($query) use ($request) {
                $query->where('category_id', $request->category_id);
            })
            ->when($request->status && $request->status !== 'all', function ($query) use ($request) {
                $isActive = match ($request->status) {
                    'active' => true,
                    'inactive' => false,
                    default => null,
                };

                if (! is_null($isActive)) {
                    $query->where('active', $isActive);
                }
            })
            ->when($request->stock_status && $request->stock_status !== 'all', function ($query) use ($request) {
                match ($request->stock_status) {
                    'out_of_stock' => $query->where('stock', '<=', 0),
                    'low_stock' => $query->where('stock', '>', 0)->whereColumn('stock', '<=', 'min_stock'),
                    'in_stock' => $query->whereColumn('stock', '>', 'min_stock'),
                    default => null,
                };
            })
            ->orderBy($sort, $direction)
            ->paginate($perPage)
            ->withQueryString()
            ->through(fn (Product $product) => [
                'id' => $product->id,
                'category_id' => $product->category_id,
                'barcode' => $product->barcode,
                'name' => $product->name,
                'category' => $product->category?->name,
                'buy_price' => $product->buy_price,
                'sell_price' => $product->sell_price,
                'stock' => $product->stock,
                'min_stock' => $product->min_stock,
                'image' => $product->image ? asset('storage/'.$product->image) : null,
                'active' => (bool) $product->active,
            ]);

        $categories = Category::orderBy('name')->get(['id', 'name']);

        return Inertia::render('POS/Product/Product', [
            'products' => $products,
            'filters' => $filters,
            'categories' => $categories,
        ]);
    }

    public function create(): Response
    {
        Gate::authorize('create', Product::class);

        $categories = Category::orderBy('name')
            ->get(['id', 'name']);

        return Inertia::render('POS/Product/AddProduct', [
            'categories' => $categories,
        ]);
    }

    public function store(StoreProductRequest $request): RedirectResponse
    {
        Gate::authorize('insertProduk', Product::class);

        $data = $request->validated();

        if ($request->hasFile('image')) {
            $data['image'] = $request->file('image')->store('products', 'public');
        }

        Product::create($data);

        return redirect()->route('pos.products.index')
            ->with('success', 'Produk berhasil ditambahkan.');
    }

    public function show(Product $product): Response
    {
        Gate::authorize('view', $product);

        $product->load('category');

        return Inertia::render('POS/Product/DetailProduct', [
            'product' => [
                'id' => $product->id,
                'category_id' => $product->category_id,
                'category_name' => $product->category?->name,
                'barcode' => $product->barcode,
                'name' => $product->name,
                'buy_price' => $product->buy_price,
                'sell_price' => $product->sell_price,
                'stock' => $product->stock,
                'min_stock' => $product->min_stock,
                'image' => $product->image ? asset('storage/'.$product->image) : null,
                'active' => (bool) $product->active,
                'created_at' => $product->created_at?->format('d M Y H:i'),
                'updated_at' => $product->updated_at?->format('d M Y H:i'),
            ],
        ]);
    }

    public function edit(Product $product): Response
    {
        Gate::authorize('update', $product);

        $categories = Category::orderBy('name')->get(['id', 'name']);

        return Inertia::render('POS/Product/EditProduct', [
            'product' => [
                'id' => $product->id,
                'category_id' => $product->category_id,
                'barcode' => $product->barcode,
                'name' => $product->name,
                'buy_price' => $product->buy_price,
                'sell_price' => $product->sell_price,
                'stock' => $product->stock,
                'min_stock' => $product->min_stock,
                'image' => $product->image ? asset('storage/'.$product->image) : null,
                'active' => (bool) $product->active,
            ],
            'categories' => $categories,
        ]);
    }

    public function update(UpdateProductRequest $request, Product $product): RedirectResponse
    {
        $data = $request->validated();

        if ($request->hasFile('image')) {
            if ($product->image) {
                Storage::disk('public')->delete($product->image);
            }
            $data['image'] = $request->file('image')->store('products', 'public');
        } else {
            unset($data['image']);
        }

        $product->update($data);

        return redirect()->route('pos.products.index')
            ->with('success', 'Data produk berhasil diperbarui.');
    }

    public function destroy(Product $product): RedirectResponse
    {
        Gate::authorize('delete', $product);

        if ($product->image) {
            Storage::disk('public')->delete($product->image);
        }

        $product->delete();

        return redirect()->route('pos.products.index')
            ->with('success', 'Produk berhasil dihapus.');
    }
}

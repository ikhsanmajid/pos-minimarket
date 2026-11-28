<?php

namespace App\Http\Requests;

use App\Models\Product;
use App\Models\ProductPriceTier;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

class StoreProductPriceTierRequest extends FormRequest
{
    public function authorize(): bool
    {
        $product = $this->route('product');

        return $this->user() !== null
            && $product instanceof Product
            && $this->user()->can('update', $product);
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        /** @var Product $product */
        $product = $this->route('product');

        return [
            'product_unit_id' => [
                'nullable',
                'integer',
                Rule::exists('product_units', 'id')->where('product_id', $product->id),
            ],
            'min_qty' => ['required', 'integer', 'min:2'],
            'unit_price' => ['required', 'numeric', 'gt:0'],
            'is_active' => ['nullable', 'boolean'],
        ];
    }

    public function after(): array
    {
        return [
            function (Validator $validator): void {
                /** @var Product $product */
                $product = $this->route('product');
                $unitId = $this->filled('product_unit_id') ? $this->integer('product_unit_id') : null;
                $minQty = $this->integer('min_qty');

                $exists = ProductPriceTier::query()
                    ->where('product_id', $product->id)
                    ->where('min_qty', $minQty)
                    ->when(
                        $unitId === null,
                        fn ($q) => $q->whereNull('product_unit_id'),
                        fn ($q) => $q->where('product_unit_id', $unitId)
                    )
                    ->exists();

                if ($exists) {
                    $validator->errors()->add(
                        'min_qty',
                        "Tier harga grosir untuk minimal {$minQty} pada satuan tersebut sudah ada."
                    );
                }
            },
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'min_qty.required' => 'Minimal qty wajib diisi.',
            'min_qty.min' => 'Minimal qty harga grosir adalah 2.',
            'unit_price.required' => 'Harga satuan grosir wajib diisi.',
            'unit_price.gt' => 'Harga satuan grosir harus lebih besar dari 0.',
        ];
    }
}

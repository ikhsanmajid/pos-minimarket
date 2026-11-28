<?php

namespace App\Http\Requests;

use App\Enums\CustomerTier;
use App\Models\Product;
use App\Models\ProductMemberPrice;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

class StoreProductMemberPriceRequest extends FormRequest
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
            'tier' => ['nullable', 'string', Rule::in(array_column(CustomerTier::cases(), 'value'))],
            'member_price' => ['required', 'numeric', 'gt:0'],
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
                $tier = $this->filled('tier') ? (string) $this->input('tier') : null;

                $exists = ProductMemberPrice::query()
                    ->where('product_id', $product->id)
                    ->when(
                        $unitId === null,
                        fn ($q) => $q->whereNull('product_unit_id'),
                        fn ($q) => $q->where('product_unit_id', $unitId)
                    )
                    ->when(
                        $tier === null,
                        fn ($q) => $q->whereNull('tier'),
                        fn ($q) => $q->where('tier', $tier)
                    )
                    ->exists();

                if ($exists) {
                    $tierLabel = $tier !== null ? ucfirst($tier) : 'Semua Member';
                    $validator->errors()->add(
                        'tier',
                        "Harga member untuk tier {$tierLabel} pada satuan tersebut sudah ada."
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
            'member_price.required' => 'Harga member wajib diisi.',
            'member_price.gt' => 'Harga member harus lebih besar dari 0.',
        ];
    }
}

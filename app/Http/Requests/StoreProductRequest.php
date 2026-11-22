<?php

namespace App\Http\Requests;

use App\Models\Product;
use App\Rules\BarcodeExists;
use App\Rules\CategoryExists;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

class StoreProductRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        return $this->user()->can('create', Product::class);
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'category_id' => ['bail', 'required', 'integer', new CategoryExists],
            'barcode' => ['required', 'string', 'max:255', new BarcodeExists],
            'name' => ['required', 'string', 'max:255'],
            'buy_price' => ['required', 'numeric', 'min:0'],
            'sell_price' => ['required', 'numeric', 'min:0'],
            'stock' => ['required', 'integer', 'min:0'],
            'min_stock' => ['required', 'integer', 'min:0'],
            'active' => ['required', 'boolean'],
            'image' => ['nullable', 'image', 'max:2048'],
        ];
    }

    public function messages(): array
    {
        return [
            'category_id.integer' => 'Kategori harus berupa angka.',
            'category_id.required' => 'Kategori wajib dipilih.',
        ];
    }
}

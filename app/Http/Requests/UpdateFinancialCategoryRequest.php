<?php

namespace App\Http\Requests;

use App\Enums\FinancialCategoryType;
use App\Models\FinancialCategory;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateFinancialCategoryRequest extends FormRequest
{
    public function authorize(): bool
    {
        $category = $this->route('financialCategory');

        return $category instanceof FinancialCategory
            && ($this->user()?->can('update', $category) ?? false);
    }

    protected function prepareForValidation(): void
    {
        $code = $this->input('code');

        $this->merge([
            'code' => is_string($code) && trim($code) !== ''
                ? strtoupper(trim($code))
                : null,
        ]);
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        $category = $this->route('financialCategory');
        $categoryId = $category instanceof FinancialCategory ? $category->id : null;

        return [
            'code' => ['nullable', 'string', 'max:30', Rule::unique('financial_categories', 'code')->ignore($categoryId)],
            'name' => ['required', 'string', 'max:100'],
            'type' => ['required', Rule::enum(FinancialCategoryType::class)],
            'is_active' => ['sometimes', 'boolean'],
            'description' => ['nullable', 'string', 'max:1000'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'code.unique' => 'Kode kategori keuangan sudah digunakan.',
            'name.required' => 'Nama kategori keuangan wajib diisi.',
            'type.required' => 'Tipe kategori (Pemasukan / Pengeluaran) wajib dipilih.',
        ];
    }
}

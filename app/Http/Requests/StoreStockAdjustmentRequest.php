<?php

namespace App\Http\Requests;

use App\Enums\StockAdjustmentReason;
use App\Enums\StockAdjustmentType;
use App\Models\StockAdjustment;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreStockAdjustmentRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->can('create', StockAdjustment::class) ?? false;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'product_id' => ['required', 'integer', 'exists:products,id'],
            'type' => ['required', 'string', Rule::enum(StockAdjustmentType::class)],
            'reason' => ['required', 'string', Rule::enum(StockAdjustmentReason::class)],
            'qty_change' => ['required', 'integer', 'min:1'],
            'notes' => ['required', 'string', 'min:3', 'max:1000'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'product_id.required' => 'Produk wajib dipilih.',
            'product_id.exists' => 'Produk tidak ditemukan.',
            'type.required' => 'Tipe penyesuaian wajib dipilih.',
            'reason.required' => 'Alasan penyesuaian wajib dipilih.',
            'qty_change.required' => 'Jumlah perubahan stok wajib diisi.',
            'qty_change.integer' => 'Jumlah perubahan stok harus berupa angka bulat.',
            'qty_change.min' => 'Jumlah perubahan stok minimal 1.',
            'notes.required' => 'Catatan keterangan wajib diisi.',
            'notes.min' => 'Catatan minimal 3 karakter.',
        ];
    }
}

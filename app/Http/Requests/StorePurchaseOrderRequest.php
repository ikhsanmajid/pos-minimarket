<?php

namespace App\Http\Requests;

use App\Enums\PurchaseOrderStatus;
use App\Models\PurchaseOrder;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Enum;

class StorePurchaseOrderRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()->can('create', PurchaseOrder::class);
    }

    public function rules(): array
    {
        return [
            'supplier_id' => ['required', 'integer', 'exists:suppliers,id'],
            'po_number' => ['nullable', 'string', 'max:30', 'unique:purchase_orders,po_number'],
            'order_date' => ['required', 'date'],
            'expected_date' => ['nullable', 'date', 'after_or_equal:order_date'],
            'due_date' => ['nullable', 'date'],
            'status' => ['nullable', new Enum(PurchaseOrderStatus::class)],
            'discount_type' => ['required', 'in:fixed,percent'],
            'discount_value' => [
                'nullable',
                'numeric',
                'min:0',
                Rule::when($this->input('discount_type') === 'percent', ['max:100']),
            ],
            'tax_percentage' => ['nullable', 'numeric', 'min:0', 'max:100'],
            'notes' => ['nullable', 'string'],
            'items' => ['required', 'array', 'min:1'],
            'items.*.product_id' => ['required', 'integer', 'exists:products,id'],
            'items.*.quantity_ordered' => ['required', 'integer', 'min:1'],
            'items.*.unit_cost' => ['required', 'numeric', 'min:0'],
            'items.*.expired_date' => ['nullable', 'date'],
        ];
    }

    public function messages(): array
    {
        return [
            'supplier_id.required' => 'Supplier wajib dipilih.',
            'supplier_id.exists' => 'Supplier yang dipilih tidak valid.',
            'items.required' => 'Minimal satu produk harus dipesan.',
            'items.min' => 'Minimal satu produk harus dipesan.',
            'items.*.product_id.required' => 'Produk wajib dipilih.',
            'items.*.quantity_ordered.min' => 'Jumlah pesanan minimal 1.',
            'items.*.unit_cost.min' => 'Harga beli satuan tidak boleh negatif.',
            'discount_type.in' => 'Tipe diskon harus berupa nominal (Rp) atau persen (%).',
            'discount_value.max' => 'Diskon persen maksimal 100%.',
            'tax_percentage.max' => 'Persentase pajak maksimal 100%.',
        ];
    }
}

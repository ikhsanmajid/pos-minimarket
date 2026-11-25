<?php

namespace App\Http\Requests;

use App\Models\PurchaseOrder;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdatePurchaseOrderRequest extends FormRequest
{
    public function authorize(): bool
    {
        /** @var PurchaseOrder $po */
        $po = $this->route('purchaseOrder');

        return $this->user()->can('update', $po);
    }

    public function rules(): array
    {
        /** @var PurchaseOrder $po */
        $po = $this->route('purchaseOrder');

        return [
            'supplier_id' => ['required', 'integer', 'exists:suppliers,id'],
            'po_number' => ['nullable', 'string', 'max:30', Rule::unique('purchase_orders', 'po_number')->ignore($po->id)],
            'order_date' => ['required', 'date'],
            'expected_date' => ['nullable', 'date', 'after_or_equal:order_date'],
            'due_date' => ['nullable', 'date'],
            'action' => ['nullable', 'in:draft,submit'],
            'discount_type' => ['required', 'in:fixed,percent'],
            'discount_value' => [
                'nullable',
                'numeric',
                'min:0',
                Rule::when($this->input('discount_type') === 'percent', ['max:100']),
            ],
            'tax_type' => ['nullable', 'in:percent,fixed'],
            'tax_value' => [
                'nullable',
                'numeric',
                'min:0',
                Rule::when(($this->input('tax_type') ?? 'percent') === 'percent', ['max:100']),
            ],
            'tax_percentage' => ['nullable', 'numeric', 'min:0', 'max:100'],
            'notes' => ['nullable', 'string'],
            'items' => ['required', 'array', 'min:1'],
            'items.*.id' => [
                'nullable',
                'integer',
                Rule::exists('purchase_order_items', 'id')->where('purchase_order_id', $po->id),
            ],
            'items.*.product_id' => ['required', 'integer', 'exists:products,id'],
            'items.*.product_unit_id' => ['nullable', 'integer', 'exists:product_units,id'],
            'items.*.quantity_ordered' => ['required', 'integer', 'min:1'],
            'items.*.free_qty_ordered' => ['nullable', 'integer', 'min:0'],
            'items.*.unit_cost' => ['required', 'numeric', 'min:0'],
            'items.*.discount_type' => ['nullable', 'in:fixed,percent'],
            'items.*.discount_value' => ['nullable', 'numeric', 'min:0'],
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
            'items.*.free_qty_ordered.min' => 'Jumlah bonus tidak boleh negatif.',
            'items.*.unit_cost.min' => 'Harga beli satuan tidak boleh negatif.',
            'discount_type.in' => 'Tipe diskon harus berupa nominal (Rp) atau persen (%).',
            'discount_value.max' => 'Diskon persen maksimal 100%.',
            'tax_type.in' => 'Tipe pajak harus berupa persen (%) atau nominal (Rp).',
            'tax_value.max' => 'Persentase pajak maksimal 100%.',
        ];
    }
}

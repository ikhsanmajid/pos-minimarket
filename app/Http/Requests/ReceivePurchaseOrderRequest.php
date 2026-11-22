<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class ReceivePurchaseOrderRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()->can('receive', $this->route('purchaseOrder'));
    }

    public function rules(): array
    {
        return [
            'items' => ['required', 'array', 'min:1'],
            'items.*.purchase_order_item_id' => ['required', 'integer', 'exists:purchase_order_items,id'],
            'items.*.receive_now_qty' => ['required', 'integer', 'min:0'],
            'items.*.expired_date' => ['nullable', 'date'],
        ];
    }

    public function messages(): array
    {
        return [
            'items.required' => 'Data barang yang diterima wajib dikirimkan.',
            'items.min' => 'Minimal satu barang harus dicantumkan.',
            'items.*.purchase_order_item_id.required' => 'Item PO tidak valid.',
            'items.*.receive_now_qty.min' => 'Jumlah barang diterima tidak boleh negatif.',
        ];
    }
}

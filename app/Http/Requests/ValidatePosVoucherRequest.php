<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class ValidatePosVoucherRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() !== null;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'code' => ['required', 'string', 'max:64'],
            'customer_id' => ['nullable', 'integer', 'exists:customers,id'],
            'discount_amount' => ['nullable', 'numeric', 'min:0'],
            'has_cash_payment' => ['nullable', 'boolean'],
            'reservation_token' => ['nullable', 'string', 'max:64'],
            'existing_vouchers' => ['nullable', 'array'],
            'existing_vouchers.*.code' => ['required_with:existing_vouchers', 'string', 'max:64'],
            'existing_vouchers.*.reservation_token' => ['nullable', 'string', 'max:64'],
            'device_id' => ['nullable', 'string', 'max:64'],
            'evaluated_at' => ['nullable', 'date'],
            'items' => ['present', 'array'],
            'items.*.product_id' => ['required', 'integer', 'exists:products,id'],
            'items.*.product_unit_id' => ['nullable', 'integer', 'exists:product_units,id'],
            'items.*.qty' => ['required', 'numeric', 'gt:0'],
            'items.*.discount_amount' => ['nullable', 'numeric', 'min:0'],
        ];
    }
}

<?php

namespace App\Http\Requests;

use App\Enums\PaymentMethod;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class CalculatePosCartRequest extends FormRequest
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
            'customer_id' => ['nullable', 'integer', 'exists:customers,id'],
            'discount_amount' => ['nullable', 'numeric', 'min:0'],
            'has_cash_payment' => ['nullable', 'boolean'],
            'voucher_code' => ['nullable', 'string', 'max:64'],
            'voucher_reservation_token' => ['nullable', 'string', 'max:64'],
            'vouchers' => ['nullable', 'array'],
            'vouchers.*.code' => ['required_with:vouchers', 'string', 'max:64'],
            'vouchers.*.reservation_token' => ['nullable', 'string', 'max:64'],
            'selected_tebus_murah_promotion_id' => ['nullable', 'integer', 'exists:promotions,id'],
            'evaluated_at' => ['nullable', 'date'],
            'items' => ['present', 'array'],
            'items.*.product_id' => ['required', 'integer', 'exists:products,id'],
            'items.*.product_unit_id' => ['nullable', 'integer', 'exists:product_units,id'],
            'items.*.qty' => ['required', 'numeric', 'gt:0'],
            'items.*.discount_amount' => ['nullable', 'numeric', 'min:0'],
            'payments' => ['nullable', 'array'],
            'payments.*.payment_method' => ['required_with:payments', 'string', Rule::in(array_column(PaymentMethod::cases(), 'value'))],
            'payments.*.amount' => ['nullable', 'numeric', 'min:0'],
            'payments.*.card_bin' => ['nullable', 'string', 'max:16'],
            'payments.*.reference_number' => ['nullable', 'string', 'max:100'],
        ];
    }
}

<?php

namespace App\Http\Requests;

use App\Enums\PaymentMethod;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class CheckoutPosRequest extends FormRequest
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
            'held_transaction_id' => ['nullable', 'integer', 'exists:held_transactions,id'],
            'discount_amount' => ['nullable', 'numeric', 'min:0'],
            'voucher_code' => ['nullable', 'string', 'max:64'],
            'voucher_reservation_token' => ['nullable', 'string', 'max:64'],
            'vouchers' => ['nullable', 'array'],
            'vouchers.*.code' => ['required_with:vouchers', 'string', 'max:64'],
            'vouchers.*.reservation_token' => ['nullable', 'string', 'max:64'],
            'selected_tebus_murah_promotion_id' => ['nullable', 'integer', 'exists:promotions,id'],
            'redeem_points' => ['nullable', 'integer', 'min:0'],
            'donation_product_id' => ['nullable', 'integer', 'exists:products,id'],
            'donation_amount' => ['nullable', 'numeric', 'min:0'],
            'supervisor_pin' => ['nullable', 'string', 'max:20'],
            'items' => ['required', 'array', 'min:1'],
            'items.*.product_id' => ['required', 'integer', 'exists:products,id'],
            'items.*.product_unit_id' => ['nullable', 'integer', 'exists:product_units,id'],
            'items.*.qty' => ['required', 'integer', 'min:1'],
            'items.*.discount_amount' => ['nullable', 'numeric', 'min:0'],
            'payments' => ['required', 'array', 'min:1'],
            'payments.*.payment_method' => ['required', 'string', Rule::in(array_column(PaymentMethod::cases(), 'value'))],
            'payments.*.financial_account_id' => ['required', 'integer', 'exists:financial_accounts,id'],
            'payments.*.amount' => ['required', 'numeric', 'min:0'],
            'payments.*.card_bin' => ['nullable', 'string', 'max:16'],
            'payments.*.reference_number' => ['nullable', 'string', 'max:100'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'items.required' => 'Keranjang belanja tidak boleh kosong.',
            'items.min' => 'Tambahkan minimal 1 produk ke keranjang sebelum checkout.',
            'items.*.product_id.required' => 'Produk pada keranjang tidak valid.',
            'items.*.qty.required' => 'Jumlah produk wajib diisi.',
            'items.*.qty.min' => 'Jumlah produk minimal 1.',
            'payments.required' => 'Metode pembayaran wajib diisi.',
            'payments.min' => 'Tambahkan minimal 1 metode pembayaran.',
            'payments.*.payment_method.required' => 'Pilih metode pembayaran.',
            'payments.*.financial_account_id.required' => 'Pilih akun kas/bank tujuan pembayaran.',
            'payments.*.amount.required' => 'Nominal pembayaran wajib diisi.',
            'payments.*.amount.gt' => 'Nominal pembayaran harus lebih dari 0.',
        ];
    }
}

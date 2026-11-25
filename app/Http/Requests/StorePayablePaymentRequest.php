<?php

namespace App\Http\Requests;

use App\Enums\PaymentMethod;
use App\Models\AccountPayable;
use App\Models\PurchaseOrder;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rules\Enum;

class StorePayablePaymentRequest extends FormRequest
{
    public function authorize(): bool
    {
        $po = $this->route('purchaseOrder');
        if ($po instanceof PurchaseOrder) {
            return $this->user()->can('recordPayment', $po);
        }

        $payable = $this->route('accountPayable');
        if ($payable instanceof AccountPayable) {
            return $this->user()->can('recordPayment', $payable);
        }

        return false;
    }

    public function rules(): array
    {
        return [
            'financial_account_id' => ['required', 'integer', 'exists:financial_accounts,id'],
            'amount' => ['required', 'numeric', 'gt:0'],
            'payment_date' => ['required', 'date'],
            'payment_method' => ['required', new Enum(PaymentMethod::class)],
            'reference_number' => ['nullable', 'string', 'max:100'],
            'invoice_number' => ['nullable', 'string', 'max:100'],
            'notes' => ['nullable', 'string', 'max:1000'],
        ];
    }

    public function messages(): array
    {
        return [
            'financial_account_id.required' => 'Rekening sumber pembayaran wajib dipilih.',
            'financial_account_id.exists' => 'Rekening sumber pembayaran tidak ditemukan.',
            'amount.required' => 'Nominal pembayaran wajib diisi.',
            'amount.gt' => 'Nominal pembayaran harus lebih besar dari 0.',
            'payment_date.required' => 'Tanggal pembayaran wajib diisi.',
            'payment_method.required' => 'Metode pembayaran wajib dipilih.',
        ];
    }
}

<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class CloseCashierShiftRequest extends FormRequest
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
            'actual_cash' => ['required', 'numeric', 'min:0', 'max:999999999999.99'],
            'denomination_breakdown' => ['nullable', 'array'],
            'denomination_breakdown.*.denomination' => ['required_with:denomination_breakdown', 'integer', 'min:100'],
            'denomination_breakdown.*.qty' => ['required_with:denomination_breakdown', 'integer', 'min:0'],
            'denomination_breakdown.*.subtotal' => ['required_with:denomination_breakdown', 'numeric', 'min:0'],
            'closing_notes' => ['nullable', 'string', 'max:1000'],
            'supervisor_pin' => ['nullable', 'string', 'min:4', 'max:20'],
            'cash_deposit_account_id' => ['nullable', 'integer', 'exists:financial_accounts,id'],
            'non_cash_deposit_account_id' => ['nullable', 'integer', 'exists:financial_accounts,id'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'actual_cash.required' => 'Total uang fisik hasil perhitungan wajib diisi.',
            'actual_cash.numeric' => 'Total uang fisik harus berupa angka.',
            'actual_cash.min' => 'Total uang fisik tidak boleh negatif.',
        ];
    }
}

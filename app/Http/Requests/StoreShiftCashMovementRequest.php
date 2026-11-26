<?php

namespace App\Http\Requests;

use App\Enums\ShiftCashMovementType;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreShiftCashMovementRequest extends FormRequest
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
            'type' => ['required', Rule::enum(ShiftCashMovementType::class)],
            'amount' => ['required', 'numeric', 'gt:0', 'max:999999999999.99'],
            'reason' => ['required', 'string', 'min:3', 'max:500'],
            'financial_account_id' => ['nullable', 'integer', 'exists:financial_accounts,id'],
            'supervisor_pin' => ['nullable', 'string', 'min:4', 'max:20'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'type.required' => 'Jenis mutasi kas wajib dipilih.',
            'amount.required' => 'Nominal mutasi kas wajib diisi.',
            'amount.gt' => 'Nominal mutasi kas harus lebih besar dari 0.',
            'reason.required' => 'Keterangan / alasan mutasi kas wajib diisi.',
            'reason.min' => 'Keterangan minimal 3 karakter.',
            'financial_account_id.exists' => 'Akun keuangan yang dipilih tidak valid.',
        ];
    }
}

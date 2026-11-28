<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class OpenCashierShiftRequest extends FormRequest
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
            'cash_register_id' => ['nullable', 'integer', 'exists:cash_registers,id'],
            'register_name' => ['required_without:cash_register_id', 'nullable', 'string', 'max:50'],
            'starting_cash' => ['required', 'numeric', 'min:0', 'max:999999999999.99'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'cash_register_id.exists' => 'Kasir fisik yang dipilih tidak ditemukan.',
            'register_name.required_without' => 'Kasir fisik wajib dipilih atau diisi.',
            'starting_cash.required' => 'Modal awal laci wajib diisi.',
            'starting_cash.numeric' => 'Modal awal laci harus berupa angka.',
            'starting_cash.min' => 'Modal awal laci tidak boleh bernilai negatif.',
        ];
    }
}

<?php

namespace App\Http\Requests;

use App\Models\CashRegister;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateCashRegisterRequest extends FormRequest
{
    public function authorize(): bool
    {
        /** @var CashRegister|null $cashRegister */
        $cashRegister = $this->route('cash_register');

        return $cashRegister !== null && ($this->user()?->can('update', $cashRegister) ?? false);
    }

    protected function prepareForValidation(): void
    {
        $this->merge([
            'code' => strtoupper(trim((string) $this->input('code'))),
            'name' => trim((string) $this->input('name')),
            'location' => $this->filled('location') ? trim((string) $this->input('location')) : null,
            'description' => $this->filled('description') ? trim((string) $this->input('description')) : null,
            'is_active' => $this->boolean('is_active', true),
        ]);
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        /** @var CashRegister $cashRegister */
        $cashRegister = $this->route('cash_register');

        return [
            'code' => [
                'required',
                'string',
                'max:20',
                Rule::unique('cash_registers', 'code')->ignore($cashRegister->id),
            ],
            'name' => [
                'required',
                'string',
                'max:50',
                Rule::unique('cash_registers', 'name')->ignore($cashRegister->id),
            ],
            'location' => ['nullable', 'string', 'max:100'],
            'description' => ['nullable', 'string', 'max:500'],
            'is_active' => ['boolean'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'code.required' => 'Kode kasir fisik wajib diisi.',
            'code.max' => 'Kode kasir fisik maksimal 20 karakter.',
            'code.unique' => 'Kode kasir fisik sudah digunakan.',
            'name.required' => 'Nama kasir fisik wajib diisi.',
            'name.max' => 'Nama kasir fisik maksimal 50 karakter.',
            'name.unique' => 'Nama kasir fisik sudah digunakan.',
            'location.max' => 'Lokasi maksimal 100 karakter.',
            'description.max' => 'Deskripsi maksimal 500 karakter.',
        ];
    }
}

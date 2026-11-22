<?php

namespace App\Http\Requests;

use App\Models\Supplier;
use Illuminate\Foundation\Http\FormRequest;

class StoreSupplierRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()->can('create', Supplier::class);
    }

    public function rules(): array
    {
        return [
            'code' => ['nullable', 'string', 'max:20', 'unique:suppliers,code'],
            'name' => ['required', 'string', 'max:150'],
            'contact_person' => ['nullable', 'string', 'max:100'],
            'phone' => ['required', 'string', 'max:20'],
            'email' => ['nullable', 'email', 'max:100'],
            'address' => ['nullable', 'string'],
            'city' => ['nullable', 'string', 'max:100'],
            'npwp' => ['nullable', 'string', 'max:30'],
            'payment_term_days' => ['nullable', 'integer', 'min:0'],
            'bank_name' => ['nullable', 'string', 'max:50'],
            'bank_account_number' => ['nullable', 'string', 'max:50'],
            'bank_account_name' => ['nullable', 'string', 'max:100'],
            'is_active' => ['boolean'],
            'notes' => ['nullable', 'string'],
        ];
    }

    public function messages(): array
    {
        return [
            'name.required' => 'Nama supplier wajib diisi.',
            'phone.required' => 'Nomor telepon wajib diisi.',
            'code.unique' => 'Kode supplier sudah digunakan.',
            'email.email' => 'Format email tidak valid.',
        ];
    }
}

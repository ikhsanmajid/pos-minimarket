<?php

namespace App\Http\Requests;

use App\Models\Customer;
use App\Services\CustomerService;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreCustomerRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->can('create', Customer::class) ?? false;
    }

    protected function prepareForValidation(): void
    {
        $memberCode = $this->input('member_code');
        $phone = $this->input('phone');
        $email = $this->input('email');

        $this->merge([
            'member_code' => is_string($memberCode) && trim($memberCode) !== ''
                ? strtoupper(trim($memberCode))
                : null,
            'phone' => CustomerService::normalizePhone(is_string($phone) ? $phone : null),
            'email' => is_string($email) && trim($email) !== ''
                ? strtolower(trim($email))
                : null,
        ]);
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'member_code' => [
                'nullable',
                'string',
                'max:30',
                Rule::unique('customers', 'member_code')->whereNull('deleted_at'),
            ],
            'name' => ['required', 'string', 'max:150'],
            'phone' => [
                'nullable',
                'string',
                'max:30',
                Rule::unique('customers', 'phone')->whereNull('deleted_at'),
            ],
            'email' => ['nullable', 'email', 'max:150'],
            'address' => ['nullable', 'string', 'max:1000'],
            'points' => ['nullable', 'integer', 'min:0'],
            'is_active' => ['sometimes', 'boolean'],
            'notes' => ['nullable', 'string', 'max:1000'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'member_code.unique' => 'Kode member sudah digunakan oleh pelanggan aktif lain.',
            'name.required' => 'Nama pelanggan wajib diisi.',
            'phone.unique' => 'Nomor HP sudah terdaftar pada pelanggan aktif lain.',
            'email.email' => 'Format alamat email tidak valid.',
            'points.integer' => 'Poin harus berupa bilangan bulat.',
            'points.min' => 'Poin tidak boleh kurang dari 0.',
        ];
    }
}

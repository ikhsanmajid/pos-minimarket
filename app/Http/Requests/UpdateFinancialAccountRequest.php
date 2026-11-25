<?php

namespace App\Http\Requests;

use App\Enums\FinancialAccountType;
use App\Models\FinancialAccount;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Enum;

class UpdateFinancialAccountRequest extends FormRequest
{
    public function authorize(): bool
    {
        /** @var FinancialAccount $account */
        $account = $this->route('financialAccount');

        return $this->user()->can('update', $account);
    }

    public function rules(): array
    {
        /** @var FinancialAccount $account */
        $account = $this->route('financialAccount');

        return [
            'code' => ['nullable', 'string', 'max:20', Rule::unique('financial_accounts', 'code')->ignore($account->id)],
            'name' => ['required', 'string', 'max:100'],
            'type' => ['required', new Enum(FinancialAccountType::class)],
            'account_number' => ['nullable', 'string', 'max:50'],
            'bank_name' => ['nullable', 'string', 'max:50'],
            'opening_balance' => ['nullable', 'numeric', 'min:0'],
            'is_default' => ['boolean'],
            'is_active' => ['boolean'],
            'notes' => ['nullable', 'string', 'max:500'],
        ];
    }

    public function messages(): array
    {
        return [
            'code.unique' => 'Kode akun keuangan sudah digunakan.',
            'name.required' => 'Nama akun kas/bank wajib diisi.',
            'type.required' => 'Tipe akun wajib dipilih.',
            'opening_balance.min' => 'Saldo awal tidak boleh negatif.',
        ];
    }
}

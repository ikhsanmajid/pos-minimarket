<?php

namespace App\Http\Requests;

use App\Enums\FinancialTransactionType;
use App\Models\FinancialTransaction;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreFinancialTransactionRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->can('create', FinancialTransaction::class) ?? false;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'financial_account_id' => ['required', 'integer', 'exists:financial_accounts,id'],
            'financial_category_id' => ['required', 'integer', 'exists:financial_categories,id'],
            'type' => ['required', Rule::enum(FinancialTransactionType::class)],
            'amount' => ['required', 'numeric', 'gt:0', 'max:999999999999.99'],
            'transaction_date' => ['required', 'date'],
            'reference_number' => ['nullable', 'string', 'max:100'],
            'description' => ['required', 'string', 'max:1000'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'financial_account_id.required' => 'Akun keuangan wajib dipilih.',
            'financial_account_id.exists' => 'Akun keuangan tidak ditemukan.',
            'financial_category_id.required' => 'Kategori keuangan wajib dipilih.',
            'financial_category_id.exists' => 'Kategori keuangan tidak ditemukan.',
            'type.required' => 'Tipe transaksi wajib dipilih.',
            'amount.required' => 'Nominal transaksi wajib diisi.',
            'amount.gt' => 'Nominal transaksi harus lebih besar dari 0.',
            'transaction_date.required' => 'Tanggal transaksi wajib diisi.',
            'description.required' => 'Keterangan transaksi wajib diisi.',
        ];
    }
}

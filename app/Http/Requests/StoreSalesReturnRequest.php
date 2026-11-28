<?php

namespace App\Http\Requests;

use App\Enums\PaymentMethod;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreSalesReturnRequest extends FormRequest
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
            'refund_method' => ['required', 'string', Rule::in(array_column(PaymentMethod::cases(), 'value'))],
            'financial_account_id' => ['required', 'integer', 'exists:financial_accounts,id'],
            'reason' => ['required', 'string', 'min:3', 'max:500'],
            'supervisor_pin' => ['required', 'string', 'max:20'],
            'items' => ['required', 'array', 'min:1'],
            'items.*.transaction_detail_id' => ['required', 'integer', 'exists:transaction_details,id'],
            'items.*.qty' => ['required', 'integer', 'min:1'],
            'items.*.is_restockable' => ['required', 'boolean'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'refund_method.required' => 'Metode pengembalian dana wajib dipilih.',
            'financial_account_id.required' => 'Akun sumber pengembalian dana wajib dipilih.',
            'reason.required' => 'Alasan retur wajib diisi.',
            'reason.min' => 'Alasan retur minimal 3 karakter.',
            'supervisor_pin.required' => 'PIN Supervisor / Admin wajib diisi untuk memproses retur.',
            'items.required' => 'Pilih minimal 1 item untuk diretur.',
            'items.min' => 'Pilih minimal 1 item untuk diretur.',
            'items.*.qty.min' => 'Jumlah retur minimal 1.',
        ];
    }
}

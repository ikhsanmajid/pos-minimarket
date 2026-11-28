<?php

namespace App\Http\Requests;

use App\Enums\PromotionFunding;
use App\Enums\VoucherStatus;
use App\Enums\VoucherType;
use App\Models\Voucher;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class GenerateBulkVouchersRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->can('create', Voucher::class) ?? false;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        $type = (string) $this->input('type');

        return [
            'prefix' => ['required', 'string', 'min:2', 'max:12', 'regex:/^[A-Za-z0-9]+$/'],
            'count' => ['required', 'integer', 'min:1', 'max:500'],
            'name' => ['required', 'string', 'max:180'],
            'type' => ['required', 'string', Rule::in(array_column(VoucherType::cases(), 'value'))],
            'value' => [
                Rule::requiredIf($type !== VoucherType::FreeItem->value),
                'nullable',
                'numeric',
                $type === VoucherType::FreeItem->value ? 'min:0' : 'gt:0',
                ...($type === VoucherType::Percentage->value ? ['lte:100'] : []),
            ],
            'max_discount' => ['nullable', 'numeric', 'gt:0'],
            'min_spend' => ['nullable', 'numeric', 'min:0'],
            'valid_from' => ['required', 'date'],
            'valid_until' => ['required', 'date', 'after:valid_from'],
            'total_quota' => ['nullable', 'integer', 'min:1'],
            'per_customer_limit' => ['nullable', 'integer', 'min:1'],
            'member_only' => ['nullable', 'boolean'],
            'stackable_with_promo' => ['nullable', 'boolean'],
            'funding' => ['nullable', 'string', Rule::in(array_column(PromotionFunding::cases(), 'value'))],
            'status' => ['nullable', 'string', Rule::in(array_column(VoucherStatus::cases(), 'value'))],
            'free_product_id' => [
                Rule::requiredIf($type === VoucherType::FreeItem->value),
                'nullable',
                'integer',
                'exists:products,id',
            ],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'prefix.required' => 'Prefix kode voucher wajib diisi.',
            'prefix.regex' => 'Prefix hanya boleh berisi huruf dan angka.',
            'count.required' => 'Jumlah voucher wajib diisi.',
            'count.max' => 'Maksimal generate 500 voucher dalam satu kali proses.',
            'valid_until.after' => 'Tanggal berakhir harus lebih besar dari tanggal mulai.',
        ];
    }
}

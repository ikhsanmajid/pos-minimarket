<?php

namespace App\Http\Requests;

use App\Enums\PromotionFunding;
use App\Enums\VoucherStatus;
use App\Enums\VoucherType;
use App\Models\Voucher;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreVoucherRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->can('create', Voucher::class) ?? false;
    }

    protected function prepareForValidation(): void
    {
        if ($this->filled('code')) {
            $normalized = strtoupper(preg_replace('/\s+/', '', trim((string) $this->input('code'))) ?? '');
            $this->merge(['code' => $normalized]);
        }
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        $type = (string) $this->input('type');

        return [
            'code' => [
                'nullable',
                'string',
                'min:4',
                'max:32',
                'regex:/^[A-Z0-9][A-Z0-9-]{2,30}[A-Z0-9]$/',
                'unique:vouchers,code',
            ],
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
            'allowed_days' => ['nullable', 'integer', 'min:1', 'max:127'],
            'allowed_hours_start' => ['nullable', 'date_format:H:i'],
            'allowed_hours_end' => ['nullable', 'date_format:H:i'],
            'total_quota' => ['nullable', 'integer', 'min:1'],
            'per_customer_limit' => ['nullable', 'integer', 'min:1'],
            'per_day_limit' => ['nullable', 'integer', 'min:1'],
            'store_ids' => ['nullable', 'array'],
            'store_ids.*' => ['integer', 'min:1'],
            'channel' => ['nullable', 'string', 'max:20'],
            'member_only' => ['nullable', 'boolean'],
            'member_tiers' => ['nullable', 'array'],
            'member_tiers.*' => ['string', 'max:30'],
            'applicable_skus' => ['nullable', 'array'],
            'applicable_skus.*' => ['string', 'max:64'],
            'applicable_categories' => ['nullable', 'array'],
            'applicable_categories.*' => ['integer', 'exists:categories,id'],
            'excluded_skus' => ['nullable', 'array'],
            'excluded_skus.*' => ['string', 'max:64'],
            'excluded_categories' => ['nullable', 'array'],
            'excluded_categories.*' => ['integer', 'exists:categories,id'],
            'free_product_id' => [
                Rule::requiredIf($type === VoucherType::FreeItem->value),
                'nullable',
                'integer',
                'exists:products,id',
            ],
            'stackable_with_promo' => ['nullable', 'boolean'],
            'stackable_with_voucher' => ['nullable', 'boolean'],
            'funding' => ['nullable', 'string', Rule::in(array_column(PromotionFunding::cases(), 'value'))],
            'supplier_id' => ['nullable', 'integer', 'exists:suppliers,id'],
            'store_share_percent' => ['nullable', 'numeric', 'min:0', 'max:100'],
            'supplier_share_percent' => ['nullable', 'numeric', 'min:0', 'max:100'],
            'status' => ['nullable', 'string', Rule::in(array_column(VoucherStatus::cases(), 'value'))],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'code.unique' => 'Kode voucher sudah digunakan.',
            'code.regex' => 'Kode voucher hanya boleh berisi huruf kapital, angka, dan tanda hubung (-).',
            'name.required' => 'Nama voucher wajib diisi.',
            'valid_until.after' => 'Tanggal berakhir harus lebih besar dari tanggal mulai.',
            'free_product_id.required' => 'Pilih produk gratis untuk voucher tipe Gratis Produk.',
        ];
    }
}

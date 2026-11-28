<?php

namespace App\Http\Requests;

use App\Enums\PaymentMethod;
use App\Enums\PromotionFunding;
use App\Enums\PromotionScope;
use App\Enums\PromotionType;
use App\Models\Promotion;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StorePromotionRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->can('create', Promotion::class) ?? false;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        $type = (string) $this->input('type');
        $scope = (string) $this->input('scope');

        $isPercentOnlyType = in_array($type, [
            PromotionType::PercentageDiscount->value,
            PromotionType::NearExpiry->value,
            PromotionType::MinSpendPercent->value,
        ], true);

        $requiresDiscountValue = in_array($type, [
            PromotionType::PercentageDiscount->value,
            PromotionType::FixedDiscount->value,
            PromotionType::NearExpiry->value,
            PromotionType::MinSpendDiscount->value,
            PromotionType::MinSpendPercent->value,
            PromotionType::PaymentPromo->value,
            PromotionType::Cashback->value,
        ], true);

        $requiresMinPurchase = in_array($type, [
            PromotionType::MinSpendDiscount->value,
            PromotionType::MinSpendPercent->value,
            PromotionType::TebusMurah->value,
            PromotionType::GiftWithPurchase->value,
        ], true);

        $requiresRewardProduct = in_array($type, [
            PromotionType::TebusMurah->value,
            PromotionType::GiftWithPurchase->value,
        ], true);

        $usesItemScope = in_array($type, [
            PromotionType::PercentageDiscount->value,
            PromotionType::FixedDiscount->value,
            PromotionType::BuyXGetY->value,
            PromotionType::MultibuyPrice->value,
            PromotionType::NthItemDiscount->value,
            PromotionType::MixMatch->value,
            PromotionType::NearExpiry->value,
        ], true);

        return [
            'code' => ['nullable', 'string', 'max:50', 'unique:promotions,code'],
            'name' => ['required', 'string', 'max:180'],
            'type' => ['required', 'string', Rule::in(array_column(PromotionType::cases(), 'value'))],
            'scope' => ['required', 'string', Rule::in(array_column(PromotionScope::cases(), 'value'))],
            'funding' => ['nullable', 'string', Rule::in(array_column(PromotionFunding::cases(), 'value'))],
            'discount_value' => [
                Rule::requiredIf($requiresDiscountValue),
                'nullable',
                'numeric',
                'gt:0',
                ...($isPercentOnlyType ? ['lte:100'] : []),
            ],
            'max_discount_amount' => ['nullable', 'numeric', 'gt:0'],
            'min_purchase_amount' => [
                Rule::requiredIf($requiresMinPurchase),
                'nullable',
                'numeric',
                $requiresMinPurchase ? 'gt:0' : 'min:0',
            ],
            'buy_qty' => [
                Rule::requiredIf(in_array($type, [
                    PromotionType::BuyXGetY->value,
                    PromotionType::MultibuyPrice->value,
                    PromotionType::MixMatch->value,
                ], true)),
                'nullable',
                'integer',
                in_array($type, [PromotionType::MultibuyPrice->value, PromotionType::MixMatch->value], true) ? 'min:2' : 'min:1',
            ],
            'get_qty' => [
                Rule::requiredIf($type === PromotionType::BuyXGetY->value),
                'nullable',
                'integer',
                'min:1',
            ],
            'get_discount_percent' => ['nullable', 'numeric', 'gt:0', 'lte:100'],
            'bundle_price' => [
                Rule::requiredIf(in_array($type, [
                    PromotionType::MultibuyPrice->value,
                    PromotionType::Bundle->value,
                ], true)),
                'nullable',
                'numeric',
                'gt:0',
            ],
            'nth_item' => [
                Rule::requiredIf($type === PromotionType::NthItemDiscount->value),
                'nullable',
                'integer',
                'min:2',
            ],
            'reward_product_id' => [
                Rule::requiredIf($requiresRewardProduct),
                'nullable',
                'integer',
                'exists:products,id',
            ],
            'special_price' => [
                Rule::requiredIf($type === PromotionType::TebusMurah->value),
                'nullable',
                'numeric',
                'min:0',
            ],
            'payment_method' => [
                Rule::requiredIf($type === PromotionType::PaymentPromo->value),
                'nullable',
                'string',
                Rule::in(array_column(PaymentMethod::cases(), 'value')),
            ],
            'payment_bin_prefix' => [
                'nullable',
                'string',
                'regex:/^[0-9]{6,8}$/',
            ],
            'near_expiry_days' => [
                Rule::requiredIf($type === PromotionType::NearExpiry->value),
                'nullable',
                'integer',
                'min:1',
                'max:365',
            ],
            'bundle_items' => [
                Rule::requiredIf($type === PromotionType::Bundle->value),
                'nullable',
                'array',
                ...($type === PromotionType::Bundle->value ? ['min:1'] : []),
            ],
            'bundle_items.*.product_id' => ['required_with:bundle_items', 'integer', 'exists:products,id'],
            'bundle_items.*.required_qty' => ['required_with:bundle_items', 'integer', 'min:1'],
            'starts_at' => ['required', 'date'],
            'ends_at' => ['required', 'date', 'after:starts_at'],
            'days_mask' => ['nullable', 'integer', 'min:1', 'max:127'],
            'time_start' => ['nullable', 'date_format:H:i'],
            'time_end' => ['nullable', 'date_format:H:i'],
            'quota_total' => ['nullable', 'integer', 'min:1'],
            'max_qty_per_transaction' => ['nullable', 'integer', 'min:1'],
            'max_qty_per_customer_per_day' => ['nullable', 'integer', 'min:1'],
            'stackable' => ['nullable', 'boolean'],
            'exclusive_group' => ['nullable', 'string', 'max:64'],
            'priority' => ['nullable', 'integer', 'min:-1000', 'max:1000'],
            'member_only' => ['nullable', 'boolean'],
            'is_active' => ['nullable', 'boolean'],
            'product_ids' => [
                Rule::requiredIf($usesItemScope && $scope === PromotionScope::Product->value),
                'nullable',
                'array',
            ],
            'product_ids.*' => ['integer', 'exists:products,id'],
            'category_ids' => [
                Rule::requiredIf($usesItemScope && $scope === PromotionScope::Category->value),
                'nullable',
                'array',
            ],
            'category_ids.*' => ['integer', 'exists:categories,id'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'name.required' => 'Nama promo wajib diisi.',
            'code.unique' => 'Kode promo sudah digunakan.',
            'ends_at.after' => 'Tanggal berakhir harus lebih besar dari tanggal mulai.',
            'product_ids.required' => 'Pilih minimal 1 produk untuk promo lingkup Produk.',
            'category_ids.required' => 'Pilih minimal 1 kategori untuk promo lingkup Kategori.',
            'bundle_price.required' => 'Harga paket wajib diisi untuk promo Multibuy / Bundel.',
            'bundle_items.required' => 'Tambahkan minimal 1 SKU produk untuk paket Bundel.',
            'nth_item.required' => 'Isi urutan item ke-N (minimal 2).',
            'reward_product_id.required' => 'Pilih produk hadiah / Tebus Murah.',
            'special_price.required' => 'Harga tebus murah wajib diisi.',
            'payment_method.required' => 'Pilih metode pembayaran untuk promo metode bayar.',
            'payment_bin_prefix.regex' => 'Prefix BIN kartu harus berupa 6 sampai 8 digit angka.',
            'near_expiry_days.required' => 'Isi jumlah hari mendekati kedaluwarsa (minimal 1 hari).',
        ];
    }
}

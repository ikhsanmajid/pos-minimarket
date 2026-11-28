<?php

namespace App\Http\Requests;

use App\Enums\PaymentMethod;
use Carbon\CarbonImmutable;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

class ReportFilterRequest extends FormRequest
{
    public const int MAX_DATE_RANGE_DAYS = 366;

    public function authorize(): bool
    {
        return $this->user() !== null;
    }

    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        $paymentMethods = array_map(
            fn (PaymentMethod $method): string => $method->value,
            PaymentMethod::cases()
        );

        return [
            'preset' => ['nullable', 'string', Rule::in(['today', '7d', '30d', 'this_month', 'last_month', 'this_year', 'custom'])],
            'start_date' => ['nullable', 'date_format:Y-m-d'],
            'end_date' => ['nullable', 'date_format:Y-m-d', 'after_or_equal:start_date'],
            'cashier_id' => ['nullable', 'integer', 'exists:users,id'],
            'category_id' => ['nullable', 'integer', 'exists:categories,id'],
            'product_id' => ['nullable', 'integer', 'exists:products,id'],
            'payment_method' => ['nullable', 'string', Rule::in(['all', ...$paymentMethods])],
            'movement_class' => ['nullable', 'string', Rule::in(['all', 'fast_moving', 'slow_moving', 'dead_stock'])],
            'financial_account_id' => ['nullable', 'integer', 'exists:financial_accounts,id'],
            'supplier_id' => ['nullable', 'integer', 'exists:suppliers,id'],
            'search' => ['nullable', 'string', 'max:100'],
            'per_page' => ['nullable', 'integer', 'min:5', 'max:100'],
            'sort' => ['nullable', 'string', 'max:50'],
            'direction' => ['nullable', 'string', Rule::in(['asc', 'desc'])],
            'table_sort' => ['nullable', 'string', 'max:50'],
            'table_direction' => ['nullable', 'string', Rule::in(['asc', 'desc'])],
        ];
    }

    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator): void {
            if ($validator->errors()->isNotEmpty()) {
                return;
            }

            $startDate = $this->input('start_date');
            $endDate = $this->input('end_date');

            if (is_string($startDate) && $startDate !== '' && is_string($endDate) && $endDate !== '') {
                $start = CarbonImmutable::parse($startDate)->startOfDay();
                $end = CarbonImmutable::parse($endDate)->startOfDay();

                if ($start->diffInDays($end) > self::MAX_DATE_RANGE_DAYS) {
                    $validator->errors()->add(
                        'end_date',
                        'Rentang tanggal laporan maksimal '.self::MAX_DATE_RANGE_DAYS.' hari.'
                    );
                }
            }
        });
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'start_date.date_format' => 'Format tanggal mulai harus YYYY-MM-DD.',
            'end_date.date_format' => 'Format tanggal selesai harus YYYY-MM-DD.',
            'end_date.after_or_equal' => 'Tanggal selesai tidak boleh lebih awal dari tanggal mulai.',
        ];
    }
}

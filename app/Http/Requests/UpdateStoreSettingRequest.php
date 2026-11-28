<?php

namespace App\Http\Requests;

use App\Enums\RoundingMode;
use App\Enums\UserRoles;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateStoreSettingRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        return $this->user()?->hasRoles(UserRoles::Admin) ?? false;
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'store_name' => ['required', 'string', 'max:150'],
            'store_address' => ['nullable', 'string', 'max:500'],
            'store_phone' => ['nullable', 'string', 'max:30'],
            'store_logo' => ['nullable', 'image', 'mimes:png,jpg,jpeg,webp', 'max:2048'],
            'remove_logo' => ['nullable', 'boolean'],
            'receipt_header' => ['nullable', 'string', 'max:500'],
            'receipt_footer' => ['nullable', 'string', 'max:500'],
            'default_tax_rate' => ['required', 'numeric', 'min:0', 'max:100'],
            'rounding_mode' => ['required', 'string', Rule::enum(RoundingMode::class)],
            'shift_variance_tolerance' => ['required', 'numeric', 'min:0'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'store_name.required' => 'Nama toko wajib diisi.',
            'store_name.max' => 'Nama toko maksimal 150 karakter.',
            'store_address.max' => 'Alamat toko maksimal 500 karakter.',
            'store_phone.max' => 'Nomor telepon maksimal 30 karakter.',
            'store_logo.image' => 'Logo toko harus berupa file gambar yang valid.',
            'store_logo.mimes' => 'Format logo harus PNG, JPG, JPEG, atau WEBP.',
            'store_logo.max' => 'Ukuran file logo maksimal 2 MB.',
            'receipt_header.max' => 'Header struk maksimal 500 karakter.',
            'receipt_footer.max' => 'Footer struk maksimal 500 karakter.',
            'default_tax_rate.required' => 'Tarif PPN default wajib diisi.',
            'default_tax_rate.numeric' => 'Tarif PPN harus berupa angka.',
            'default_tax_rate.min' => 'Tarif PPN minimal 0%.',
            'default_tax_rate.max' => 'Tarif PPN maksimal 100%.',
            'rounding_mode.required' => 'Mode pembulatan wajib dipilih.',
            'shift_variance_tolerance.required' => 'Batas toleransi selisih kas shift wajib diisi.',
            'shift_variance_tolerance.numeric' => 'Batas toleransi selisih kas harus berupa angka.',
            'shift_variance_tolerance.min' => 'Batas toleransi selisih kas tidak boleh negatif.',
        ];
    }
}

<?php

namespace App\Http\Requests;

use App\Models\Product;
use App\Models\ProductUnit;
use App\Rules\BarcodeExists;
use App\Rules\CategoryExists;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

class StoreProductRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()->can('create', Product::class);
    }

    protected function prepareForValidation(): void
    {
        $baseUnit = trim((string) $this->input('base_unit', 'pcs'));
        $rawUnits = $this->input('units', []);
        $normalizedUnits = [];

        if (is_array($rawUnits)) {
            foreach ($rawUnits as $unit) {
                if (! is_array($unit)) {
                    continue;
                }

                $normalizedUnits[] = [
                    'unit_name' => trim((string) ($unit['unit_name'] ?? '')),
                    'conversion_factor' => $unit['conversion_factor'] ?? null,
                    'barcode' => isset($unit['barcode']) && trim((string) $unit['barcode']) !== ''
                        ? trim((string) $unit['barcode'])
                        : null,
                    'buy_price' => $unit['buy_price'] ?? 0,
                    'sell_price' => isset($unit['sell_price']) && $unit['sell_price'] !== '' ? $unit['sell_price'] : null,
                    'is_default_purchase' => filter_var($unit['is_default_purchase'] ?? false, FILTER_VALIDATE_BOOLEAN),
                    'is_active' => filter_var($unit['is_active'] ?? true, FILTER_VALIDATE_BOOLEAN),
                ];
            }
        }

        $isDonation = filter_var($this->input('is_donation', false), FILTER_VALIDATE_BOOLEAN);
        $isTaxExempt = $isDonation || filter_var($this->input('is_tax_exempt', false), FILTER_VALIDATE_BOOLEAN);

        $this->merge([
            'base_unit' => $baseUnit !== '' ? $baseUnit : 'pcs',
            'active' => filter_var($this->input('active', true), FILTER_VALIDATE_BOOLEAN),
            'is_tax_exempt' => $isTaxExempt,
            'is_donation' => $isDonation,
            'units' => $normalizedUnits,
        ]);
    }

    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'category_id' => ['bail', 'required', 'integer', new CategoryExists],
            'barcode' => ['required', 'string', 'max:255', new BarcodeExists],
            'name' => ['required', 'string', 'max:255'],
            'base_unit' => ['required', 'string', 'max:30'],
            'buy_price' => ['required', 'numeric', 'min:0'],
            'sell_price' => ['required', 'numeric', 'min:0'],
            'stock' => ['required', 'integer', 'min:0'],
            'min_stock' => ['required', 'integer', 'min:0'],
            'active' => ['required', 'boolean'],
            'is_tax_exempt' => ['required', 'boolean'],
            'is_donation' => ['required', 'boolean'],
            'image' => ['nullable', 'image', 'max:2048'],
            'units' => ['nullable', 'array'],
            'units.*.unit_name' => ['required', 'string', 'max:30'],
            'units.*.conversion_factor' => ['required', 'integer', 'min:1'],
            'units.*.barcode' => ['nullable', 'string', 'max:255'],
            'units.*.buy_price' => ['required', 'numeric', 'min:0'],
            'units.*.sell_price' => ['nullable', 'numeric', 'min:0'],
            'units.*.is_default_purchase' => ['boolean'],
            'units.*.is_active' => ['boolean'],
        ];
    }

    public function after(): array
    {
        return [
            function (Validator $validator): void {
                $baseUnitLower = mb_strtolower(trim((string) $this->input('base_unit', 'pcs')));
                $productBarcode = trim((string) $this->input('barcode', ''));
                $units = $this->input('units', []);

                if (! is_array($units) || empty($units)) {
                    return;
                }

                $seenNames = [];
                $seenBarcodes = [];

                foreach ($units as $index => $unit) {
                    $nameLower = mb_strtolower(trim((string) ($unit['unit_name'] ?? '')));

                    if ($nameLower !== '' && $nameLower === $baseUnitLower) {
                        $validator->errors()->add(
                            "units.{$index}.unit_name",
                            "Nama satuan tidak boleh sama dengan satuan dasar ({$this->input('base_unit')})."
                        );
                    }

                    if ($nameLower !== '' && isset($seenNames[$nameLower])) {
                        $validator->errors()->add(
                            "units.{$index}.unit_name",
                            'Nama satuan konversi tidak boleh duplikat.'
                        );
                    }
                    $seenNames[$nameLower] = true;

                    $unitBarcode = isset($unit['barcode']) ? trim((string) $unit['barcode']) : '';
                    if ($unitBarcode !== '') {
                        if ($productBarcode !== '' && $unitBarcode === $productBarcode) {
                            $validator->errors()->add(
                                "units.{$index}.barcode",
                                'Barcode satuan tidak boleh sama dengan barcode utama produk.'
                            );
                        }

                        if (isset($seenBarcodes[$unitBarcode])) {
                            $validator->errors()->add(
                                "units.{$index}.barcode",
                                'Barcode satuan duplikat di dalam daftar.'
                            );
                        }
                        $seenBarcodes[$unitBarcode] = true;

                        if (ProductUnit::where('barcode', $unitBarcode)->exists() || Product::withTrashed()->where('barcode', $unitBarcode)->exists()) {
                            $validator->errors()->add(
                                "units.{$index}.barcode",
                                "Barcode {$unitBarcode} sudah digunakan produk/satuan lain."
                            );
                        }
                    }
                }
            },
        ];
    }

    public function messages(): array
    {
        return [
            'category_id.integer' => 'Kategori harus berupa angka.',
            'category_id.required' => 'Kategori wajib dipilih.',
            'base_unit.required' => 'Satuan dasar wajib diisi.',
            'units.*.unit_name.required' => 'Nama satuan wajib diisi.',
            'units.*.conversion_factor.required' => 'Faktor konversi wajib diisi.',
            'units.*.conversion_factor.integer' => 'Faktor konversi harus berupa bilangan bulat.',
            'units.*.conversion_factor.min' => 'Faktor konversi minimal 1.',
            'units.*.buy_price.required' => 'Harga beli satuan wajib diisi.',
            'units.*.buy_price.min' => 'Harga beli satuan tidak boleh negatif.',
            'units.*.sell_price.min' => 'Harga jual satuan tidak boleh negatif.',
        ];
    }
}

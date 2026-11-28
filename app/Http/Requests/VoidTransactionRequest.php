<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class VoidTransactionRequest extends FormRequest
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
            'reason' => ['required', 'string', 'min:3', 'max:500'],
            'supervisor_pin' => ['required', 'string', 'max:20'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'reason.required' => 'Alasan pembatalan (Void) wajib diisi.',
            'reason.min' => 'Alasan pembatalan minimal 3 karakter.',
            'supervisor_pin.required' => 'PIN Supervisor / Admin wajib diisi untuk melakukan Void.',
        ];
    }
}

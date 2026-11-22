<?php

namespace App\Http\Requests;

use App\Models\User;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Facades\Auth;
use Illuminate\Validation\ValidationException;

class LoginRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        return true;
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            //
            'email' => ['required', 'string', 'email'],
            'password' => ['required', 'string'],
        ];
    }

    public function authenticate(): void
    {
        $user = User::where('email', $this->input('email'))->first();
        if (! $user) {
            throw ValidationException::withMessages([
                'email' => __('Email tidak terdaftar'),
            ]);
        }

        if (! $user->is_active) {
            throw ValidationException::withMessages([
                'email' => __('Akun Anda telah dinonaktifkan. Silakan hubungi administrator.'),
            ]);
        }

        $auth = Auth::attempt($this->only('email', 'password'), $this->boolean('remember'));
        if (! $auth) {
            throw ValidationException::withMessages([
                'password' => __('Password yang anda masukkan salah'),
            ]);
        }
    }
}

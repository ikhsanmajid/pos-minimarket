<?php

namespace App\Http\Requests;

use App\Enums\UserRoles;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Enum;
use Illuminate\Validation\Rules\Password;

class StoreUserRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        return $this->user()?->hasRoles(UserRoles::Admin) ?? false;
    }

    protected function prepareForValidation(): void
    {
        $role = $this->input('role');
        if (! in_array($role, [UserRoles::Admin->value, UserRoles::Supervisor->value], true)) {
            $this->merge(['pin' => null]);
        }

        if ($this->has('is_active')) {
            $this->merge([
                'is_active' => filter_var($this->input('is_active'), FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE) ?? true,
            ]);
        }
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        $role = $this->input('role');
        $isPrivilegedRole = in_array($role, [UserRoles::Admin->value, UserRoles::Supervisor->value], true);

        return [
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'email', 'max:255', 'unique:users,email'],
            'phone' => ['nullable', 'string', 'max:20'],
            'password' => ['required', 'confirmed', Password::defaults()],
            'role' => ['required', new Enum(UserRoles::class)],
            'is_active' => ['boolean'],
            'pin' => [
                'nullable',
                Rule::excludeIf(! $isPrivilegedRole),
                'digits:6',
            ],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function attributes(): array
    {
        return [
            'name' => 'nama',
            'email' => 'email',
            'phone' => 'nomor telepon',
            'password' => 'kata sandi',
            'role' => 'role',
            'is_active' => 'status aktif',
            'pin' => 'PIN otorisasi',
        ];
    }
}

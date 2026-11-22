<?php

namespace App\Models;

// use Illuminate\Contracts\Auth\MustVerifyEmail;

use App\Enums\UserRoles;
use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Attributes\Appends;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property string $name
 * @property string $email
 * @property Carbon|null $email_verified_at
 * @property string $password
 * @property string|null $remember_token
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 */
#[Fillable(['name', 'email', 'password', 'role'])]
#[Hidden(['password', 'remember_token'])]
#[Appends(['role_name'])]
class User extends Authenticatable
{
    /** @use HasFactory<UserFactory> */
    use HasFactory, Notifiable;

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'role' => UserRoles::class,
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
        ];
    }

    protected function roleName(): Attribute
    {
        return Attribute::get(
            fn () => $this->role?->label()
        );
    }

    public function transaction(): HasMany
    {
        return $this->hasMany(Transaction::class);
    }

    public function hasRoles(UserRoles|string|array $roles): bool
    {
        if (! $this->role) {
            return false;
        }

        $roles = is_array($roles) ? $roles : [$roles];

        $normalizedRoles = array_map(
            fn (UserRoles|string $role) => $role instanceof UserRoles ? $role->value : $role,
            $roles
        );

        return in_array($this->role->value, $normalizedRoles, true);
    }
}

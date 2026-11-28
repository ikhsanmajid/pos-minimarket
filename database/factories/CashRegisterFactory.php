<?php

namespace Database\Factories;

use App\Models\CashRegister;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<CashRegister>
 */
class CashRegisterFactory extends Factory
{
    protected $model = CashRegister::class;

    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        $number = fake()->unique()->numberBetween(1, 999);

        return [
            'code' => sprintf('KSR-%02d', $number),
            'name' => "Kasir {$number}",
            'location' => 'Area Kasir Utama',
            'description' => null,
            'is_active' => true,
        ];
    }

    public function inactive(): static
    {
        return $this->state(fn (): array => [
            'is_active' => false,
        ]);
    }
}

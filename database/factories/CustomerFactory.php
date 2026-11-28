<?php

namespace Database\Factories;

use App\Enums\CustomerTier;
use App\Models\Customer;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Customer>
 */
class CustomerFactory extends Factory
{
    protected $model = Customer::class;

    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'member_code' => sprintf('MBR-%s-%04d', now()->format('Ymd'), fake()->unique()->numberBetween(1, 9999)),
            'name' => fake()->name(),
            'phone' => '08'.fake()->unique()->numerify('##########'),
            'email' => fake()->unique()->safeEmail(),
            'address' => fake()->address(),
            'points' => fake()->numberBetween(0, 500),
            'tier' => CustomerTier::Silver,
            'birth_date' => null,
            'is_active' => true,
            'notes' => null,
        ];
    }

    public function inactive(): static
    {
        return $this->state(fn (): array => [
            'is_active' => false,
        ]);
    }
}

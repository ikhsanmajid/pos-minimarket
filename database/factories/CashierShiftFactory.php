<?php

namespace Database\Factories;

use App\Enums\CashierShiftStatus;
use App\Models\CashierShift;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<CashierShift>
 */
class CashierShiftFactory extends Factory
{
    public function definition(): array
    {
        return [
            'user_id' => User::factory(),
            'register_name' => 'Kasir 1',
            'status' => CashierShiftStatus::Open,
            'opened_at' => now()->subHours(2),
            'closed_at' => null,
            'starting_cash' => 500000,
            'expected_cash' => null,
            'actual_cash' => null,
            'cash_variance' => null,
            'total_cash_sales' => 0,
            'total_non_cash_sales' => 0,
            'total_refunds' => 0,
            'total_cash_in' => 0,
            'total_cash_out' => 0,
            'total_cash_drop' => 0,
            'total_transactions' => 0,
            'denomination_breakdown' => null,
            'closing_notes' => null,
            'verified_by' => null,
        ];
    }

    public function closed(float $expectedCash = 500000, float $actualCash = 500000): static
    {
        return $this->state(fn (): array => [
            'status' => CashierShiftStatus::Closed,
            'closed_at' => now(),
            'expected_cash' => $expectedCash,
            'actual_cash' => $actualCash,
            'cash_variance' => round($actualCash - $expectedCash, 2),
        ]);
    }
}

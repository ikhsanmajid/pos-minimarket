<?php

namespace Database\Factories;

use App\Enums\ShiftCashMovementType;
use App\Models\CashierShift;
use App\Models\ShiftCashMovement;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<ShiftCashMovement>
 */
class ShiftCashMovementFactory extends Factory
{
    public function definition(): array
    {
        return [
            'cashier_shift_id' => CashierShift::factory(),
            'type' => ShiftCashMovementType::CashIn,
            'amount' => 100000,
            'reason' => 'Tambahan uang receh kembalian',
            'financial_account_id' => null,
            'approved_by' => null,
            'created_by' => User::factory(),
        ];
    }
}

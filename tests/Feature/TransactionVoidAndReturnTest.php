<?php

use App\Enums\CashierShiftStatus;
use App\Enums\FinancialAccountType;
use App\Enums\PaymentMethod;
use App\Enums\StockMovementType;
use App\Enums\TransactionStatus;
use App\Enums\UserRoles;
use App\Models\CashierShift;
use App\Models\Category;
use App\Models\FinancialAccount;
use App\Models\Product;
use App\Models\SalesReturn;
use App\Models\StockMovement;
use App\Models\Transaction;
use App\Models\User;
use App\Services\CashierShiftService;
use App\Services\PosTransactionService;
use Spatie\Activitylog\Models\Activity;

function seedCompletedPosTransaction(): array
{
    $category = Category::create([
        'name' => 'Makanan',
        'slug' => 'makanan',
        'code' => 'CAT-VR-01',
        'is_active' => true,
    ]);

    $productA = Product::create([
        'category_id' => $category->id,
        'barcode' => '8992002001',
        'name' => 'Mie Instan Goreng',
        'base_unit' => 'pcs',
        'buy_price' => 2500,
        'sell_price' => 4000,
        'stock' => 30,
        'min_stock' => 5,
        'active' => true,
    ]);

    $productB = Product::create([
        'category_id' => $category->id,
        'barcode' => '8992002002',
        'name' => 'Biskuit Coklat',
        'base_unit' => 'pcs',
        'buy_price' => 5000,
        'sell_price' => 8000,
        'stock' => 20,
        'min_stock' => 5,
        'active' => true,
    ]);

    $cashAccount = FinancialAccount::create([
        'code' => 'KAS-001',
        'name' => 'Kas Kasir (Laci POS)',
        'type' => FinancialAccountType::Cash,
        'opening_balance' => 500000,
        'current_balance' => 500000,
        'is_default' => true,
        'is_active' => true,
    ]);

    $cashier = User::factory()->create([
        'role' => UserRoles::Cashier,
        'pin' => '111111',
        'is_active' => true,
    ]);

    $supervisor = User::factory()->create([
        'role' => UserRoles::Supervisor,
        'pin' => '654321',
        'is_active' => true,
    ]);

    $shift = CashierShift::factory()->create([
        'user_id' => $cashier->id,
        'status' => CashierShiftStatus::Open,
        'starting_cash' => 500000,
    ]);

    // Checkout: 3x productA (12.000) + 2x productB (16.000) = 28.000
    $transaction = app(PosTransactionService::class)->checkout($cashier, [
        'items' => [
            ['product_id' => $productA->id, 'qty' => 3],
            ['product_id' => $productB->id, 'qty' => 2],
        ],
        'payments' => [
            [
                'payment_method' => PaymentMethod::Cash->value,
                'financial_account_id' => $cashAccount->id,
                'amount' => 30000,
            ],
        ],
    ]);

    return compact('productA', 'productB', 'cashAccount', 'cashier', 'supervisor', 'shift', 'transaction');
}

it('rejects void with wrong PIN or cashier PIN and succeeds with valid supervisor PIN', function () {
    $fx = seedCompletedPosTransaction();
    $tx = $fx['transaction'];

    // Wrong PIN -> rejected
    $this->actingAs($fx['cashier'])
        ->post(route('pos.transactions.void', $tx), [
            'reason' => 'Salah input barang',
            'supervisor_pin' => '999999',
        ])
        ->assertSessionHasErrors('supervisor_pin');

    // Cashier's own PIN -> rejected (must be Supervisor or Admin)
    $this->actingAs($fx['cashier'])
        ->post(route('pos.transactions.void', $tx), [
            'reason' => 'Salah input barang',
            'supervisor_pin' => '111111',
        ])
        ->assertSessionHasErrors('supervisor_pin');

    // Valid Supervisor PIN -> succeeds
    $this->actingAs($fx['cashier'])
        ->post(route('pos.transactions.void', $tx), [
            'reason' => 'Salah input barang oleh kasir',
            'supervisor_pin' => '654321',
        ])
        ->assertSessionHasNoErrors();

    $tx->refresh();
    $fx['productA']->refresh();
    $fx['productB']->refresh();
    $fx['cashAccount']->refresh();

    expect($tx->status)->toBe(TransactionStatus::Voided)
        ->and($tx->voided_by)->toBe($fx['supervisor']->id)
        ->and($tx->voided_at)->not->toBeNull()
        ->and($tx->void_reason)->toBe('Salah input barang oleh kasir')
        ->and($fx['productA']->stock)->toBe(30)
        ->and($fx['productB']->stock)->toBe(20)
        ->and(StockMovement::where('type', StockMovementType::SaleVoid->value)->count())->toBe(2)
        ->and((float) $fx['cashAccount']->current_balance)->toBe(500000.0)
        ->and(Activity::where('log_name', 'transaction')->where('event', 'voided')->exists())->toBeTrue();

    $shiftTotals = app(CashierShiftService::class)->calculateShiftTotals($fx['shift']);
    expect($shiftTotals['total_cash_sales'])->toBe(0.0)
        ->and($shiftTotals['total_transactions'])->toBe(0);
});

it('handles partial and full returns with restockable vs damaged stock handling and finance/shift sync', function () {
    $fx = seedCompletedPosTransaction();
    $tx = $fx['transaction'];
    $detailA = $tx->details->firstWhere('product_id', $fx['productA']->id);
    $detailB = $tx->details->firstWhere('product_id', $fx['productB']->id);

    // 1. Partial return: 2x productA (restockable=true) + 1x productB (is_restockable=false / damaged)
    // Refund = (2 * 4.000) + (1 * 8.000) = 16.000
    $this->actingAs($fx['cashier'])
        ->post(route('pos.transactions.returns.store', $tx), [
            'refund_method' => PaymentMethod::Cash->value,
            'financial_account_id' => $fx['cashAccount']->id,
            'reason' => '1 biskuit remuk, 2 mie batal',
            'supervisor_pin' => '654321',
            'items' => [
                [
                    'transaction_detail_id' => $detailA->id,
                    'qty' => 2,
                    'is_restockable' => true,
                ],
                [
                    'transaction_detail_id' => $detailB->id,
                    'qty' => 1,
                    'is_restockable' => false,
                ],
            ],
        ])
        ->assertSessionHasNoErrors();

    $tx->refresh();
    $fx['productA']->refresh();
    $fx['productB']->refresh();
    $fx['cashAccount']->refresh();

    // productA started 30 -> sold 3 (27) -> returned 2 restockable (29)
    // productB started 20 -> sold 2 (18) -> returned 1 damaged (stays 18!)
    // cashAccount started 500.000 -> +28.000 sale (528.000) -> -16.000 refund (512.000)
    expect($tx->status)->toBe(TransactionStatus::PartiallyRefunded)
        ->and($fx['productA']->stock)->toBe(29)
        ->and($fx['productB']->stock)->toBe(18)
        ->and(StockMovement::where('type', StockMovementType::SaleReturn->value)->count())->toBe(1)
        ->and((float) $fx['cashAccount']->current_balance)->toBe(512000.0)
        ->and(SalesReturn::count())->toBe(1)
        ->and(Activity::where('log_name', 'transaction')->where('event', 'returned')->exists())->toBeTrue();

    // 2. Attempt returning more than remaining qty (detailA only has 1 left, try returning 2) -> fails
    $this->actingAs($fx['cashier'])
        ->post(route('pos.transactions.returns.store', $tx), [
            'refund_method' => PaymentMethod::Cash->value,
            'financial_account_id' => $fx['cashAccount']->id,
            'reason' => 'Retur melebihi sisa',
            'supervisor_pin' => '654321',
            'items' => [
                [
                    'transaction_detail_id' => $detailA->id,
                    'qty' => 2,
                    'is_restockable' => true,
                ],
            ],
        ])
        ->assertSessionHasErrors('items.0.qty');

    // 3. Return remaining items (1x productA + 1x productB, both restockable) -> status becomes refunded
    $this->actingAs($fx['cashier'])
        ->post(route('pos.transactions.returns.store', $tx), [
            'refund_method' => PaymentMethod::Cash->value,
            'financial_account_id' => $fx['cashAccount']->id,
            'reason' => 'Retur sisa pembelian',
            'supervisor_pin' => '654321',
            'items' => [
                [
                    'transaction_detail_id' => $detailA->id,
                    'qty' => 1,
                    'is_restockable' => true,
                ],
                [
                    'transaction_detail_id' => $detailB->id,
                    'qty' => 1,
                    'is_restockable' => true,
                ],
            ],
        ])
        ->assertSessionHasNoErrors();

    $tx->refresh();
    $fx['cashAccount']->refresh();

    expect($tx->status)->toBe(TransactionStatus::Refunded)
        ->and((float) $fx['cashAccount']->current_balance)->toBe(500000.0);

    $shiftTotals = app(CashierShiftService::class)->calculateShiftTotals($fx['shift']);
    expect($shiftTotals['total_refunds'])->toBe(28000.0)
        ->and($shiftTotals['total_cash_refunds'])->toBe(28000.0)
        ->and($shiftTotals['expected_cash'])->toBe(500000.0);
});

it('enforces transaction policies across Admin, Supervisor, Cashier, and Warehouse roles', function () {
    $fx = seedCompletedPosTransaction();
    $tx = $fx['transaction'];

    $admin = User::factory()->create(['role' => UserRoles::Admin]);
    $warehouse = User::factory()->create(['role' => UserRoles::Warehouse]);
    $otherCashier = User::factory()->create(['role' => UserRoles::Cashier]);

    // Warehouse cannot access transactions index or detail
    $this->actingAs($warehouse)->get(route('pos.transactions.index'))->assertForbidden();
    $this->actingAs($warehouse)->get(route('pos.transactions.show', $tx))->assertForbidden();

    // Another cashier cannot view or void someone else's transaction
    $this->actingAs($otherCashier)->get(route('pos.transactions.show', $tx))->assertForbidden();
    $this->actingAs($otherCashier)->post(route('pos.transactions.void', $tx), [
        'reason' => 'Coba void milik orang lain',
        'supervisor_pin' => '654321',
    ])->assertForbidden();

    // Owner cashier, Supervisor, and Admin can view transaction detail
    $this->actingAs($fx['cashier'])->get(route('pos.transactions.show', $tx))->assertOk();
    $this->actingAs($fx['supervisor'])->get(route('pos.transactions.show', $tx))->assertOk();
    $this->actingAs($admin)->get(route('pos.transactions.show', $tx))->assertOk();
});

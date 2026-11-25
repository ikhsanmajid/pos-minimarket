<?php

use App\Enums\FinancialAccountType;
use App\Enums\FinancialTransactionType;
use App\Enums\PaymentMethod;
use App\Enums\PaymentStatus;
use App\Enums\ReceivingStatus;
use App\Enums\StockMovementType;
use App\Enums\UserRoles;
use App\Models\AccountPayable;
use App\Models\Category;
use App\Models\FinancialAccount;
use App\Models\FinancialTransaction;
use App\Models\PayablePayment;
use App\Models\Product;
use App\Models\ProductUnit;
use App\Models\PurchaseOrder;
use App\Models\PurchaseOrderReceipt;
use App\Models\StockMovement;
use App\Models\Supplier;
use App\Models\User;

it('processes partial and full receiving with Multi-UOM, free bonus qty, weighted average HPP, stock card, atomic payments, and enforces permanent paid+received lock', function () {
    $admin = User::factory()->create(['role' => UserRoles::Admin]);
    $warehouse = User::factory()->create(['role' => UserRoles::Warehouse]);

    $category = Category::create([
        'name' => 'Minuman',
        'slug' => 'minuman-'.uniqid(),
        'code' => 'CAT-'.random_int(100, 999),
        'is_active' => true,
    ]);

    $supplier = Supplier::create([
        'name' => 'PT Distribusi Nusantara',
        'phone' => '081999888777',
        'payment_term_days' => 30,
        'is_active' => true,
    ]);

    $otherSupplier = Supplier::create([
        'name' => 'PT Supplier Lain',
        'phone' => '081111222333',
        'payment_term_days' => 0,
        'is_active' => true,
    ]);

    // Stok awal 20 pcs @ HPP Rp 2.500 (nilai persediaan awal = Rp 50.000)
    $product = Product::create([
        'category_id' => $category->id,
        'barcode' => '8998887776665',
        'name' => 'Teh Kotak 250ml',
        'base_unit' => 'pcs',
        'buy_price' => 2500,
        'sell_price' => 4000,
        'stock' => 20,
        'min_stock' => 10,
        'active' => true,
    ]);

    $unitDus = ProductUnit::create([
        'product_id' => $product->id,
        'unit_name' => 'Dus',
        'conversion_factor' => 40,
        'buy_price' => 80000,
        'is_default_purchase' => true,
        'is_active' => true,
    ]);

    $cashAccount = FinancialAccount::create([
        'code' => 'KAS-TEST',
        'name' => 'Brankas Test',
        'type' => FinancialAccountType::Cash,
        'opening_balance' => 500000,
        'current_balance' => 500000,
        'is_default' => true,
        'is_active' => true,
    ]);

    // 1. Admin buat PO langsung Approved: 2 Dus @ Rp 80.000 + 1 Dus bonus (Total = Rp 160.000)
    $this->actingAs($admin)->post(route('pos.purchase-orders.store'), [
        'supplier_id' => $supplier->id,
        'order_date' => now()->toDateString(),
        'action' => 'submit',
        'discount_type' => 'fixed',
        'discount_value' => 0,
        'tax_type' => 'percent',
        'tax_value' => 0,
        'items' => [
            [
                'product_id' => $product->id,
                'product_unit_id' => $unitDus->id,
                'quantity_ordered' => 2,
                'free_qty_ordered' => 1,
                'unit_cost' => 80000,
                'discount_type' => 'fixed',
                'discount_value' => 0,
            ],
        ],
    ])->assertRedirect();

    $po = PurchaseOrder::with(['items', 'accountPayable'])->firstOrFail();
    $item = $po->items->firstOrFail();

    expect((float) $po->total_amount)->toBe(160000.0)
        ->and($item->base_qty_ordered)->toBe(120); // (2 + 1) * 40

    // 2. Partial Receiving #1: Terima 1 Dus berbayar (+40 pcs, biaya masuk Rp 80.000)
    $this->actingAs($warehouse)->post(route('pos.purchase-orders.receive', $po), [
        'supplier_delivery_note' => 'SJ-001',
        'received_date' => now()->toDateString(),
        'items' => [
            [
                'purchase_order_item_id' => $item->id,
                'receive_now_qty' => 1,
                'free_qty_received' => 0,
                'batch_number' => 'BATCH-A1',
                'expired_date' => now()->addMonths(6)->toDateString(),
            ],
        ],
    ])->assertRedirect();

    $product->refresh();
    $po->refresh();

    // Stok = 20 + 40 = 60 pcs; HPP = (20*2500 + 80000) / 60 = 2166.67
    expect($product->stock)->toBe(60)
        ->and((float) $product->buy_price)->toBe(2166.67)
        ->and($po->receiving_status)->toBe(ReceivingStatus::Partial)
        ->and(PurchaseOrderReceipt::where('purchase_order_id', $po->id)->count())->toBe(1);

    $movement1 = StockMovement::where('product_id', $product->id)->firstOrFail();
    expect($movement1->type)->toBe(StockMovementType::PurchaseIn)
        ->and($movement1->stock_before)->toBe(20)
        ->and($movement1->qty_change)->toBe(40)
        ->and($movement1->stock_after)->toBe(60)
        ->and((float) $movement1->unit_cost)->toBe(2166.67);

    // 3. Integrity Check saat Partial: dilarang ganti supplier, dilarang turunkan qty di bawah diterima, dilarang cancel
    $this->actingAs($admin)->patch(route('pos.purchase-orders.update', $po), [
        'supplier_id' => $otherSupplier->id,
        'order_date' => now()->toDateString(),
        'discount_type' => 'fixed',
        'discount_value' => 0,
        'tax_type' => 'percent',
        'tax_value' => 0,
        'items' => [
            [
                'id' => $item->id,
                'product_id' => $product->id,
                'product_unit_id' => $unitDus->id,
                'quantity_ordered' => 2,
                'free_qty_ordered' => 1,
                'unit_cost' => 80000,
            ],
        ],
    ])->assertSessionHasErrors(['supplier_id']);

    $this->actingAs($admin)->post(route('pos.purchase-orders.cancel', $po))->assertForbidden();

    // 4. Final Receiving #2: Terima sisa 1 Dus berbayar + 1 Dus bonus (+80 pcs, biaya masuk Rp 80.000)
    $this->actingAs($warehouse)->post(route('pos.purchase-orders.receive', $po), [
        'supplier_delivery_note' => 'SJ-002',
        'received_date' => now()->toDateString(),
        'items' => [
            [
                'purchase_order_item_id' => $item->id,
                'receive_now_qty' => 1,
                'free_qty_received' => 1,
                'batch_number' => 'BATCH-A2',
                'expired_date' => now()->addMonths(8)->toDateString(),
            ],
        ],
    ])->assertRedirect();

    $product->refresh();
    $po->refresh();

    // Stok = 60 + 80 = 140 pcs; HPP = (60 * 2166.67 + 80000) / 140 = 1500.00 (turun karena bonus)
    expect($product->stock)->toBe(140)
        ->and((float) $product->buy_price)->toBe(1500.0)
        ->and($po->receiving_status)->toBe(ReceivingStatus::Received)
        ->and(PurchaseOrderReceipt::where('purchase_order_id', $po->id)->count())->toBe(2)
        ->and(StockMovement::where('product_id', $product->id)->count())->toBe(2);

    // 5. Pembayaran Cicilan #1 (Rp 60.000) -> Saldo Kas 500.000 -> 440.000
    $this->actingAs($admin)->post(route('pos.purchase-orders.payments.store', $po), [
        'financial_account_id' => $cashAccount->id,
        'amount' => 60000,
        'payment_date' => now()->toDateString(),
        'payment_method' => PaymentMethod::Cash->value,
        'reference_number' => 'KW-01',
    ])->assertRedirect();

    $cashAccount->refresh();
    $po->refresh();
    $payable = AccountPayable::where('purchase_order_id', $po->id)->firstOrFail();

    expect((float) $cashAccount->current_balance)->toBe(440000.0)
        ->and((float) $payable->paid_amount)->toBe(60000.0)
        ->and((float) $payable->remaining_amount)->toBe(100000.0)
        ->and($payable->status)->toBe(PaymentStatus::Partial)
        ->and($po->payment_status)->toBe(PaymentStatus::Partial)
        ->and($po->isLocked())->toBeFalse();

    // Cek overpayment ditolak
    $this->actingAs($admin)->post(route('pos.purchase-orders.payments.store', $po), [
        'financial_account_id' => $cashAccount->id,
        'amount' => 150000,
        'payment_date' => now()->toDateString(),
        'payment_method' => PaymentMethod::Cash->value,
    ])->assertSessionHasErrors(['amount']);

    // 6. Pelunasan Cicilan #2 (Rp 100.000) via AccountPayable route -> Saldo Kas 440.000 -> 340.000
    $this->actingAs($admin)->post(route('pos.finance.payables.payments.store', $payable), [
        'financial_account_id' => $cashAccount->id,
        'amount' => 100000,
        'payment_date' => now()->toDateString(),
        'payment_method' => PaymentMethod::Transfer->value,
        'reference_number' => 'TRF-02',
    ])->assertRedirect();

    $cashAccount->refresh();
    $po->refresh();
    $payable->refresh();

    expect((float) $cashAccount->current_balance)->toBe(340000.0)
        ->and((float) $payable->paid_amount)->toBe(160000.0)
        ->and((float) $payable->remaining_amount)->toBe(0.0)
        ->and($payable->status)->toBe(PaymentStatus::Paid)
        ->and($po->payment_status)->toBe(PaymentStatus::Paid)
        ->and($po->isLocked())->toBeTrue()
        ->and(PayablePayment::where('account_payable_id', $payable->id)->count())->toBe(2)
        ->and(FinancialTransaction::where('financial_account_id', $cashAccount->id)->where('type', FinancialTransactionType::Out)->count())->toBe(2);

    // 7. STRICT IMMUTABILITY LOCK CHECK (paid + received)
    $this->actingAs($admin)->get(route('pos.purchase-orders.edit', $po))->assertForbidden();
    $this->actingAs($admin)->patch(route('pos.purchase-orders.update', $po), [
        'supplier_id' => $supplier->id,
        'order_date' => now()->toDateString(),
        'discount_type' => 'fixed',
        'discount_value' => 0,
        'items' => [
            [
                'id' => $item->id,
                'product_id' => $product->id,
                'quantity_ordered' => 2,
                'unit_cost' => 80000,
            ],
        ],
    ])->assertForbidden();
    $this->actingAs($admin)->delete(route('pos.purchase-orders.destroy', $po))->assertForbidden();
    $this->actingAs($admin)->post(route('pos.purchase-orders.cancel', $po))->assertForbidden();
    $this->actingAs($admin)->post(route('pos.purchase-orders.receive', $po), [
        'received_date' => now()->toDateString(),
        'items' => [['purchase_order_item_id' => $item->id, 'receive_now_qty' => 1]],
    ])->assertForbidden();
    $this->actingAs($admin)->post(route('pos.purchase-orders.payments.store', $po), [
        'financial_account_id' => $cashAccount->id,
        'amount' => 1000,
        'payment_date' => now()->toDateString(),
        'payment_method' => PaymentMethod::Cash->value,
    ])->assertForbidden();
});

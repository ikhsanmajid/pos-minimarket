<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('sales_returns', function (Blueprint $table): void {
            $table->id();
            $table->string('return_number')->unique();
            $table->foreignId('transaction_id')
                ->constrained('transactions')
                ->restrictOnDelete();
            $table->foreignId('cashier_shift_id')
                ->nullable()
                ->constrained('cashier_shifts')
                ->nullOnDelete();
            $table->foreignId('processed_by')
                ->constrained('users')
                ->restrictOnDelete();
            $table->foreignId('approved_by')
                ->constrained('users')
                ->restrictOnDelete();
            $table->string('status')->default('completed');
            $table->string('refund_method');
            $table->foreignId('financial_account_id')
                ->constrained('financial_accounts')
                ->restrictOnDelete();
            $table->decimal('total_refund_amount', 15, 2);
            $table->text('reason');
            $table->timestamps();

            $table->index(['transaction_id', 'created_at'], 'sales_returns_tx_created_index');
            $table->index(['cashier_shift_id', 'refund_method'], 'sales_returns_shift_method_index');
        });

        Schema::create('sales_return_items', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('sales_return_id')
                ->constrained('sales_returns')
                ->cascadeOnDelete();
            $table->foreignId('transaction_detail_id')
                ->constrained('transaction_details')
                ->restrictOnDelete();
            $table->foreignId('product_id')
                ->constrained('products')
                ->restrictOnDelete();
            $table->foreignId('product_unit_id')
                ->nullable()
                ->constrained('product_units')
                ->nullOnDelete();
            $table->string('unit_name_snapshot');
            $table->integer('conversion_factor')->default(1);
            $table->integer('qty');
            $table->integer('base_qty');
            $table->decimal('unit_price_snapshot', 15, 2);
            $table->decimal('subtotal_refund', 15, 2);
            $table->boolean('is_restockable')->default(true);
            $table->timestamps();

            $table->index('transaction_detail_id', 'sales_return_items_detail_index');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('sales_return_items');
        Schema::dropIfExists('sales_returns');
    }
};

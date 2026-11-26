<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('transactions', function (Blueprint $table) {
            $table->foreignId('cashier_shift_id')
                ->nullable()
                ->after('user_id')
                ->constrained('cashier_shifts')
                ->nullOnDelete();

            $table->index(['created_at', 'status'], 'transactions_created_status_index');
            $table->index(['cashier_shift_id', 'status'], 'transactions_shift_status_index');
            $table->index(['payment_method', 'created_at'], 'transactions_payment_method_created_index');
        });

        Schema::table('transaction_details', function (Blueprint $table) {
            $table->index(['transaction_id', 'product_id'], 'transaction_details_tx_product_index');
        });

        Schema::table('products', function (Blueprint $table) {
            $table->index(['active', 'stock'], 'products_active_stock_index');
        });

        Schema::table('stock_movements', function (Blueprint $table) {
            $table->index(['type', 'created_at'], 'stock_movements_type_created_index');
        });

        Schema::table('activity_log', function (Blueprint $table) {
            $table->index('created_at', 'activity_log_created_at_index');
        });
    }

    public function down(): void
    {
        Schema::table('activity_log', function (Blueprint $table) {
            $table->dropIndex('activity_log_created_at_index');
        });

        Schema::table('stock_movements', function (Blueprint $table) {
            $table->dropIndex('stock_movements_type_created_index');
        });

        Schema::table('products', function (Blueprint $table) {
            $table->dropIndex('products_active_stock_index');
        });

        Schema::table('transaction_details', function (Blueprint $table) {
            $table->dropIndex('transaction_details_tx_product_index');
        });

        Schema::table('transactions', function (Blueprint $table) {
            $table->dropIndex('transactions_created_status_index');
            $table->dropIndex('transactions_shift_status_index');
            $table->dropIndex('transactions_payment_method_created_index');
            $table->dropConstrainedForeignId('cashier_shift_id');
        });
    }
};

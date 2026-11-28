<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('transactions', function (Blueprint $table): void {
            $table->index(['status', 'created_at'], 'transactions_status_created_index');
            $table->index(['user_id', 'status', 'created_at'], 'transactions_user_status_created_index');
        });

        Schema::table('sales_returns', function (Blueprint $table): void {
            $table->index(['status', 'created_at'], 'sales_returns_status_created_index');
        });

        Schema::table('stock_adjustments', function (Blueprint $table): void {
            $table->index(['status', 'type', 'reason', 'created_at'], 'stock_adjustments_loss_report_index');
        });

        Schema::table('stock_opnames', function (Blueprint $table): void {
            $table->index(['status', 'completed_at'], 'stock_opnames_status_completed_index');
        });
    }

    public function down(): void
    {
        Schema::table('stock_opnames', function (Blueprint $table): void {
            $table->dropIndex('stock_opnames_status_completed_index');
        });

        Schema::table('stock_adjustments', function (Blueprint $table): void {
            $table->dropIndex('stock_adjustments_loss_report_index');
        });

        Schema::table('sales_returns', function (Blueprint $table): void {
            $table->dropIndex('sales_returns_status_created_index');
        });

        Schema::table('transactions', function (Blueprint $table): void {
            $table->dropIndex('transactions_user_status_created_index');
            $table->dropIndex('transactions_status_created_index');
        });
    }
};

<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('stock_adjustments', function (Blueprint $table) {
            $table->id();
            $table->string('adjustment_number', 35)->unique();
            $table->foreignId('product_id')->constrained('products')->restrictOnDelete();
            $table->string('type', 20);
            $table->string('reason', 30);
            $table->string('status', 20)->default('approved');
            $table->integer('qty_before');
            $table->unsignedInteger('qty_change');
            $table->integer('qty_after');
            $table->decimal('unit_cost_snapshot', 15, 2)->default(0);
            $table->decimal('total_cost_impact', 15, 2)->default(0);
            $table->text('notes');
            $table->foreignId('created_by')->constrained('users')->restrictOnDelete();
            $table->foreignId('approved_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('approved_at')->nullable();
            $table->foreignId('rejected_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('rejected_at')->nullable();
            $table->text('rejection_reason')->nullable();
            $table->timestamps();

            $table->index('product_id', 'stock_adjustments_product_id_index');
            $table->index('type', 'stock_adjustments_type_index');
            $table->index('reason', 'stock_adjustments_reason_index');
            $table->index('status', 'stock_adjustments_status_index');
            $table->index('created_at', 'stock_adjustments_created_at_index');
        });

        Schema::create('stock_opnames', function (Blueprint $table) {
            $table->id();
            $table->string('opname_number', 35)->unique();
            $table->string('status', 25)->default('draft');
            $table->foreignId('category_id')->nullable()->constrained('categories')->nullOnDelete();
            $table->boolean('is_blind_count')->default(true);
            $table->text('notes')->nullable();
            $table->timestamp('started_at')->nullable();
            $table->timestamp('completed_at')->nullable();
            $table->timestamp('cancelled_at')->nullable();
            $table->foreignId('created_by')->constrained('users')->restrictOnDelete();
            $table->foreignId('approved_by')->nullable()->constrained('users')->nullOnDelete();
            $table->unsignedInteger('total_items_counted')->default(0);
            $table->unsignedInteger('total_variance_items')->default(0);
            $table->decimal('total_variance_value', 15, 2)->default(0);
            $table->timestamps();

            $table->index('status', 'stock_opnames_status_index');
            $table->index('category_id', 'stock_opnames_category_id_index');
            $table->index('created_at', 'stock_opnames_created_at_index');
        });

        Schema::create('stock_opname_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('stock_opname_id')->constrained('stock_opnames')->cascadeOnDelete();
            $table->foreignId('product_id')->constrained('products')->restrictOnDelete();
            $table->integer('system_stock')->default(0);
            $table->integer('physical_stock')->nullable();
            $table->integer('variance_qty')->default(0);
            $table->decimal('unit_cost_snapshot', 15, 2)->default(0);
            $table->decimal('variance_value', 15, 2)->default(0);
            $table->text('notes')->nullable();
            $table->foreignId('counted_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('counted_at')->nullable();
            $table->timestamps();

            $table->unique(['stock_opname_id', 'product_id'], 'stock_opname_items_opname_product_unique');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('stock_opname_items');
        Schema::dropIfExists('stock_opnames');
        Schema::dropIfExists('stock_adjustments');
    }
};

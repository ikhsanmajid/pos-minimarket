<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('purchase_order_receipts', function (Blueprint $table) {
            $table->id();
            $table->string('receipt_number', 30)->unique();
            $table->foreignId('purchase_order_id')->constrained('purchase_orders')->cascadeOnDelete();
            $table->string('supplier_delivery_note', 100)->nullable();
            $table->date('received_date');
            $table->foreignId('received_by')->nullable()->constrained('users')->nullOnDelete();
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->index(['purchase_order_id', 'received_date'], 'po_receipts_po_date_index');
        });

        Schema::create('purchase_order_receipt_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('purchase_order_receipt_id')
                ->constrained('purchase_order_receipts')
                ->cascadeOnDelete();
            $table->foreignId('purchase_order_item_id')
                ->constrained('purchase_order_items')
                ->restrictOnDelete();
            $table->foreignId('product_id')->constrained('products')->restrictOnDelete();
            $table->string('unit_name', 30)->default('pcs');
            $table->unsignedInteger('conversion_factor')->default(1);
            $table->unsignedInteger('qty_received')->default(0);
            $table->unsignedInteger('free_qty_received')->default(0);
            $table->unsignedBigInteger('base_qty_received')->default(0);
            $table->decimal('unit_cost', 15, 2)->default(0);
            $table->decimal('base_unit_cost', 15, 2)->default(0);
            $table->string('batch_number', 60)->nullable();
            $table->date('expired_date')->nullable();
            $table->timestamps();
        });

        Schema::create('stock_movements', function (Blueprint $table) {
            $table->id();
            $table->foreignId('product_id')->constrained('products')->restrictOnDelete();
            $table->string('type', 30);
            $table->nullableMorphs('reference');
            $table->bigInteger('stock_before');
            $table->bigInteger('qty_change');
            $table->bigInteger('stock_after');
            $table->decimal('unit_cost', 15, 2)->default(0);
            $table->text('notes')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index(['product_id', 'created_at'], 'stock_movements_product_created_index');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('stock_movements');
        Schema::dropIfExists('purchase_order_receipt_items');
        Schema::dropIfExists('purchase_order_receipts');
    }
};

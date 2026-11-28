<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('promotions', function (Blueprint $table): void {
            $table->id();
            $table->string('code', 50)->nullable()->unique();
            $table->string('name');
            $table->string('type', 40);
            $table->string('scope', 30)->default('all_products');
            $table->string('funding', 20)->default('store');
            $table->decimal('discount_value', 15, 2)->nullable();
            $table->decimal('max_discount_amount', 15, 2)->nullable();
            $table->decimal('min_purchase_amount', 15, 2)->default(0);
            $table->unsignedInteger('buy_qty')->nullable();
            $table->unsignedInteger('get_qty')->nullable();
            $table->decimal('get_discount_percent', 5, 2)->default(100.00);
            $table->decimal('bundle_price', 15, 2)->nullable();
            $table->unsignedInteger('nth_item')->nullable();
            $table->foreignId('reward_product_id')->nullable()->constrained('products')->nullOnDelete();
            $table->decimal('special_price', 15, 2)->nullable();
            $table->string('payment_method', 30)->nullable();
            $table->string('payment_bin_prefix', 12)->nullable();
            $table->unsignedInteger('near_expiry_days')->nullable();
            $table->timestamp('starts_at');
            $table->timestamp('ends_at');
            $table->unsignedSmallInteger('days_mask')->default(127);
            $table->time('time_start')->nullable();
            $table->time('time_end')->nullable();
            $table->unsignedInteger('quota_total')->nullable();
            $table->unsignedInteger('quota_used')->default(0);
            $table->unsignedInteger('max_qty_per_transaction')->nullable();
            $table->unsignedInteger('max_qty_per_customer_per_day')->nullable();
            $table->boolean('stackable')->default(false);
            $table->string('exclusive_group', 64)->nullable();
            $table->integer('priority')->default(0);
            $table->boolean('member_only')->default(false);
            $table->boolean('is_active')->default(true);
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index(['is_active', 'starts_at', 'ends_at']);
            $table->index(['type', 'priority']);
            $table->index('exclusive_group');
        });

        Schema::create('promotion_products', function (Blueprint $table): void {
            $table->foreignId('promotion_id')->constrained('promotions')->cascadeOnDelete();
            $table->foreignId('product_id')->constrained('products')->cascadeOnDelete();
            $table->primary(['promotion_id', 'product_id']);
        });

        Schema::create('promotion_categories', function (Blueprint $table): void {
            $table->foreignId('promotion_id')->constrained('promotions')->cascadeOnDelete();
            $table->foreignId('category_id')->constrained('categories')->cascadeOnDelete();
            $table->primary(['promotion_id', 'category_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('promotion_categories');
        Schema::dropIfExists('promotion_products');
        Schema::dropIfExists('promotions');
    }
};

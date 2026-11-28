<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('vouchers', function (Blueprint $table): void {
            $table->id();
            $table->string('code', 32)->unique();
            $table->string('name', 180);
            $table->string('type', 30);
            $table->decimal('value', 15, 2)->default(0);
            $table->decimal('max_discount', 15, 2)->nullable();
            $table->decimal('min_spend', 15, 2)->default(0);
            $table->timestamp('valid_from');
            $table->timestamp('valid_until');
            $table->unsignedSmallInteger('allowed_days')->default(127);
            $table->time('allowed_hours_start')->nullable();
            $table->time('allowed_hours_end')->nullable();
            $table->unsignedInteger('total_quota')->nullable();
            $table->unsignedInteger('used_count')->default(0);
            $table->unsignedInteger('per_customer_limit')->nullable();
            $table->unsignedInteger('per_day_limit')->nullable();
            $table->json('store_ids')->nullable();
            $table->string('channel', 20)->default('pos');
            $table->boolean('member_only')->default(false);
            $table->json('member_tiers')->nullable();
            $table->json('applicable_skus')->nullable();
            $table->json('applicable_categories')->nullable();
            $table->json('excluded_skus')->nullable();
            $table->json('excluded_categories')->nullable();
            $table->foreignId('free_product_id')->nullable()->constrained('products')->nullOnDelete();
            $table->boolean('stackable_with_promo')->default(true);
            $table->boolean('stackable_with_voucher')->default(false);
            $table->string('funding', 20)->default('store');
            $table->string('status', 20)->default('draft');
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index(['status', 'valid_from', 'valid_until'], 'vouchers_status_period_idx');
            $table->index('type', 'vouchers_type_idx');
        });

        Schema::create('voucher_redemptions', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('voucher_id')->constrained('vouchers')->cascadeOnDelete();
            $table->foreignId('transaction_id')->nullable()->constrained('transactions')->nullOnDelete();
            $table->foreignId('customer_id')->nullable()->constrained('customers')->nullOnDelete();
            $table->foreignId('cashier_id')->constrained('users');
            $table->string('reservation_token', 64)->nullable();
            $table->string('status', 20);
            $table->decimal('discount_amount', 15, 2)->default(0);
            $table->timestamp('reserved_until')->nullable();
            $table->timestamp('redeemed_at')->nullable();
            $table->timestamp('released_at')->nullable();
            $table->timestamps();

            $table->index(['voucher_id', 'status'], 'voucher_redemptions_voucher_status_idx');
            $table->index(['voucher_id', 'customer_id', 'status'], 'voucher_redemptions_customer_idx');
            $table->index(['status', 'reserved_until'], 'voucher_redemptions_reserved_until_idx');
        });

        DB::statement('CREATE UNIQUE INDEX voucher_redemptions_tx_unique ON voucher_redemptions (voucher_id, transaction_id) WHERE transaction_id IS NOT NULL');
        DB::statement('CREATE UNIQUE INDEX voucher_redemptions_token_unique ON voucher_redemptions (reservation_token) WHERE reservation_token IS NOT NULL');
    }

    public function down(): void
    {
        Schema::dropIfExists('voucher_redemptions');
        Schema::dropIfExists('vouchers');
    }
};

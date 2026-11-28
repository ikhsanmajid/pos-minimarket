<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('customers', function (Blueprint $table): void {
            $table->string('tier', 20)->default('silver')->after('points');
            $table->date('birth_date')->nullable()->after('tier');
        });

        Schema::create('customer_point_ledgers', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('customer_id')->constrained('customers')->cascadeOnDelete();
            $table->foreignId('transaction_id')->nullable()->constrained('transactions')->nullOnDelete();
            $table->foreignId('sales_return_id')->nullable()->constrained('sales_returns')->nullOnDelete();
            $table->string('type', 30);
            $table->integer('points');
            $table->unsignedInteger('remaining_points')->default(0);
            $table->timestamp('expires_at')->nullable();
            $table->string('description');
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index(['customer_id', 'expires_at', 'remaining_points'], 'customer_point_ledgers_fifo_idx');
        });

        Schema::create('product_member_prices', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('product_id')->constrained('products')->cascadeOnDelete();
            $table->foreignId('product_unit_id')->nullable()->constrained('product_units')->cascadeOnDelete();
            $table->string('tier', 20)->nullable();
            $table->decimal('member_price', 15, 2);
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->index(['product_id', 'is_active']);
        });

        // Partial unique indexes kompatibel PostgreSQL & SQLite untuk kombinasi nullable (product_id, product_unit_id, tier)
        DB::statement(
            'CREATE UNIQUE INDEX product_member_prices_base_all_unique ON product_member_prices (product_id) WHERE product_unit_id IS NULL AND tier IS NULL'
        );
        DB::statement(
            'CREATE UNIQUE INDEX product_member_prices_base_tier_unique ON product_member_prices (product_id, tier) WHERE product_unit_id IS NULL AND tier IS NOT NULL'
        );
        DB::statement(
            'CREATE UNIQUE INDEX product_member_prices_unit_all_unique ON product_member_prices (product_id, product_unit_id) WHERE product_unit_id IS NOT NULL AND tier IS NULL'
        );
        DB::statement(
            'CREATE UNIQUE INDEX product_member_prices_unit_tier_unique ON product_member_prices (product_id, product_unit_id, tier) WHERE product_unit_id IS NOT NULL AND tier IS NOT NULL'
        );

        Schema::table('transactions', function (Blueprint $table): void {
            $table->unsignedInteger('points_redeemed')->default(0)->after('change_amount');
            $table->decimal('points_redeem_amount', 15, 2)->default(0)->after('points_redeemed');
            $table->unsignedInteger('points_earned')->default(0)->after('points_redeem_amount');
        });
    }

    public function down(): void
    {
        Schema::table('transactions', function (Blueprint $table): void {
            $table->dropColumn(['points_redeemed', 'points_redeem_amount', 'points_earned']);
        });

        DB::statement('DROP INDEX IF EXISTS product_member_prices_unit_tier_unique');
        DB::statement('DROP INDEX IF EXISTS product_member_prices_unit_all_unique');
        DB::statement('DROP INDEX IF EXISTS product_member_prices_base_tier_unique');
        DB::statement('DROP INDEX IF EXISTS product_member_prices_base_all_unique');
        Schema::dropIfExists('product_member_prices');

        Schema::dropIfExists('customer_point_ledgers');

        Schema::table('customers', function (Blueprint $table): void {
            $table->dropColumn(['tier', 'birth_date']);
        });
    }
};

<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('promotion_bundle_items', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('promotion_id')->constrained('promotions')->cascadeOnDelete();
            $table->foreignId('product_id')->constrained('products')->cascadeOnDelete();
            $table->unsignedInteger('required_qty')->default(1);
            $table->timestamps();

            $table->unique(['promotion_id', 'product_id']);
        });

        Schema::create('promotion_daily_usages', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('promotion_id')->constrained('promotions')->cascadeOnDelete();
            $table->date('usage_date');
            $table->foreignId('customer_id')->nullable()->constrained('customers')->nullOnDelete();
            $table->unsignedInteger('used_qty')->default(0);
            $table->unsignedInteger('used_count')->default(0);
            $table->timestamps();

            $table->index(['promotion_id', 'usage_date']);
        });

        // Partial unique index kompatibel PostgreSQL & SQLite
        DB::statement(
            'CREATE UNIQUE INDEX promotion_daily_usages_global_unique ON promotion_daily_usages (promotion_id, usage_date) WHERE customer_id IS NULL'
        );
        DB::statement(
            'CREATE UNIQUE INDEX promotion_daily_usages_customer_unique ON promotion_daily_usages (promotion_id, usage_date, customer_id) WHERE customer_id IS NOT NULL'
        );
    }

    public function down(): void
    {
        DB::statement('DROP INDEX IF EXISTS promotion_daily_usages_customer_unique');
        DB::statement('DROP INDEX IF EXISTS promotion_daily_usages_global_unique');
        Schema::dropIfExists('promotion_daily_usages');
        Schema::dropIfExists('promotion_bundle_items');
    }
};

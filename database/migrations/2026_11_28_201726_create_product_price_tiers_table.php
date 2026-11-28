<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('product_price_tiers', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('product_id')->constrained('products')->cascadeOnDelete();
            $table->foreignId('product_unit_id')->nullable()->constrained('product_units')->cascadeOnDelete();
            $table->unsignedInteger('min_qty');
            $table->decimal('unit_price', 15, 2);
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->index(['product_id', 'is_active']);
        });

        DB::statement('CREATE UNIQUE INDEX product_price_tiers_base_unique ON product_price_tiers (product_id, min_qty) WHERE product_unit_id IS NULL');
        DB::statement('CREATE UNIQUE INDEX product_price_tiers_unit_unique ON product_price_tiers (product_id, product_unit_id, min_qty) WHERE product_unit_id IS NOT NULL');
    }

    public function down(): void
    {
        Schema::dropIfExists('product_price_tiers');
    }
};

<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasColumn('products', 'base_unit')) {
            Schema::table('products', function (Blueprint $table) {
                $table->string('base_unit', 30)->default('pcs')->after('name');
            });
        }

        DB::table('products')
            ->whereNull('base_unit')
            ->orWhere('base_unit', '')
            ->update(['base_unit' => 'pcs']);

        Schema::create('product_units', function (Blueprint $table) {
            $table->id();
            $table->foreignId('product_id')->constrained('products')->cascadeOnDelete();
            $table->string('unit_name', 30);
            $table->unsignedInteger('conversion_factor');
            $table->string('barcode')->nullable()->unique();
            $table->decimal('buy_price', 15, 2)->default(0);
            $table->decimal('sell_price', 15, 2)->nullable();
            $table->boolean('is_default_purchase')->default(false);
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->unique(['product_id', 'unit_name'], 'product_units_product_unit_name_unique');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('product_units');

        if (Schema::hasColumn('products', 'base_unit')) {
            Schema::table('products', function (Blueprint $table) {
                $table->dropColumn('base_unit');
            });
        }
    }
};

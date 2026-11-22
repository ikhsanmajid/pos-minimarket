<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        //

        Schema::create('products', function (Blueprint $table) {
            $table->id();
            $table->foreignId('category_id')
                ->constrained('categories')
                ->onUpdate('cascade')
                ->onDelete('restrict');
            $table->string('barcode')->nullable();
            $table->string('name');
            $table->decimal('buy_price', 50, 2);
            $table->decimal('sell_price', 50, 2);
            $table->bigInteger('stock');
            $table->bigInteger('min_stock');
            $table->string('image')->nullable();
            $table->boolean('active');
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        //
        Schema::dropIfExists('products');
    }
};

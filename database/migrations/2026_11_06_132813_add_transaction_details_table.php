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
        Schema::create('transaction_details', function (Blueprint $table) {
            $table->id();
            $table->foreignId('transaction_id')
                ->constrained('transactions')
                ->onUpdate('cascade')
                ->onDelete('restrict');
            $table->foreignId('product_id')
                ->constrained('products')
                ->onUpdate('cascade')
                ->onDelete('restrict');
            $table->string('quantity'); // Sesuai SQL (varchar 255)
            $table->decimal('buy_price', 50, 2);
            $table->decimal('sell_price', 50, 2);
            $table->decimal('subtotal', 50, 2);
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        //
        Schema::dropIfExists('transaction_details');
    }
};

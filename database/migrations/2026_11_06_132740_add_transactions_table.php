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
        Schema::create('transactions', function (Blueprint $table) {
            $table->id();
            $table->string('invoice_number');
            $table->foreignId('user_id')
                ->constrained('users')
                ->onUpdate('cascade')
                ->onDelete('restrict');
            $table->foreignId('customer_id')
                ->nullable()
                ->constrained('customers')
                ->onUpdate('cascade')
                ->onDelete('restrict');
            $table->decimal('total_amount', 50, 2);
            $table->decimal('discount', 50, 2)->nullable();
            $table->decimal('grand_total', 50, 2);
            $table->decimal('pay_amount', 50, 2);
            $table->decimal('change_amount', 50, 2)->nullable();
            $table->string('payment_method');
            $table->string('status');
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        //
        Schema::dropIfExists('transactions');
    }
};

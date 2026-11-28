<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('transaction_payments', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('transaction_id')
                ->constrained('transactions')
                ->cascadeOnDelete();
            $table->string('payment_method');
            $table->foreignId('financial_account_id')
                ->constrained('financial_accounts')
                ->restrictOnDelete();
            $table->decimal('amount', 15, 2);
            $table->string('reference_number')->nullable();
            $table->timestamps();

            $table->index(['transaction_id', 'payment_method'], 'transaction_payments_tx_method_index');
            $table->index('financial_account_id', 'transaction_payments_account_index');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('transaction_payments');
    }
};

<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('held_transactions', function (Blueprint $table): void {
            $table->id();
            $table->string('hold_code')->unique();
            $table->string('label')->nullable();
            $table->foreignId('user_id')
                ->constrained('users')
                ->cascadeOnDelete();
            $table->foreignId('cashier_shift_id')
                ->constrained('cashier_shifts')
                ->cascadeOnDelete();
            $table->foreignId('customer_id')
                ->nullable()
                ->constrained('customers')
                ->nullOnDelete();
            $table->jsonb('payload');
            $table->timestamps();

            $table->index(['cashier_shift_id', 'created_at'], 'held_transactions_shift_created_index');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('held_transactions');
    }
};

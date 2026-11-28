<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('applied_promotions', function (Blueprint $table) {
            $table->string('settlement_method', 30)->nullable()->after('claim_status');
            $table->foreignId('settled_account_payable_id')->nullable()->after('settlement_method')->constrained('account_payables')->nullOnDelete();
            $table->foreignId('settled_product_id')->nullable()->after('settled_account_payable_id')->constrained('products')->nullOnDelete();
            $table->integer('settled_product_qty')->nullable()->after('settled_product_id');
            $table->foreignId('settled_financial_account_id')->nullable()->after('settled_product_qty')->constrained('financial_accounts')->nullOnDelete();
            $table->foreignId('settled_financial_transaction_id')->nullable()->after('settled_financial_account_id')->constrained('financial_transactions')->nullOnDelete();
            $table->foreignId('settled_by')->nullable()->after('settled_financial_transaction_id')->constrained('users')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('applied_promotions', function (Blueprint $table) {
            $table->dropConstrainedForeignId('settled_account_payable_id');
            $table->dropConstrainedForeignId('settled_product_id');
            $table->dropConstrainedForeignId('settled_financial_account_id');
            $table->dropConstrainedForeignId('settled_financial_transaction_id');
            $table->dropConstrainedForeignId('settled_by');
            $table->dropColumn(['settlement_method', 'settled_product_qty']);
        });
    }
};

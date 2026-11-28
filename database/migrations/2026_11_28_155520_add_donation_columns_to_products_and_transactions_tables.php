<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('products', function (Blueprint $table): void {
            $table->boolean('is_donation')->default(false)->after('is_tax_exempt');
        });

        Schema::table('transactions', function (Blueprint $table): void {
            $table->decimal('donation_amount', 15, 2)->default(0)->after('rounding_amount');
        });

        Schema::table('transaction_details', function (Blueprint $table): void {
            $table->boolean('is_donation')->default(false)->after('is_tax_exempt');
        });
    }

    public function down(): void
    {
        Schema::table('transaction_details', function (Blueprint $table): void {
            $table->dropColumn('is_donation');
        });

        Schema::table('transactions', function (Blueprint $table): void {
            $table->dropColumn('donation_amount');
        });

        Schema::table('products', function (Blueprint $table): void {
            $table->dropColumn('is_donation');
        });
    }
};

<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('products', function (Blueprint $table): void {
            $table->boolean('is_promo_excluded')->default(false)->after('is_donation');
            $table->string('tax_mode', 20)->default('exclusive')->after('is_tax_exempt');
        });

        DB::table('products')
            ->where('is_tax_exempt', true)
            ->orWhere('is_donation', true)
            ->update(['tax_mode' => 'exempt']);

        Schema::table('categories', function (Blueprint $table): void {
            $table->boolean('is_promo_excluded')->default(false)->after('is_active');
        });
    }

    public function down(): void
    {
        Schema::table('categories', function (Blueprint $table): void {
            $table->dropColumn('is_promo_excluded');
        });

        Schema::table('products', function (Blueprint $table): void {
            $table->dropColumn(['is_promo_excluded', 'tax_mode']);
        });
    }
};

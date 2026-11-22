<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('purchase_orders', function (Blueprint $table) {
            $table->string('discount_type', 10)->default('fixed')->after('subtotal');
            $table->decimal('discount_value', 15, 2)->default(0)->after('discount_type');
            $table->decimal('tax_percentage', 5, 2)->default(0)->after('discount_amount');
        });

        // Backfill PO lama: diskon lama dianggap nominal tetap (fixed),
        // persentase pajak diturunkan dari tax_amount / DPP (subtotal - diskon).
        DB::table('purchase_orders')
            ->where('discount_amount', '>', 0)
            ->update(['discount_value' => DB::raw('discount_amount')]);

        DB::table('purchase_orders')
            ->where('tax_amount', '>', 0)
            ->update([
                'tax_percentage' => DB::raw(
                    'CASE WHEN ROUND((tax_amount / NULLIF(subtotal - discount_amount, 0)) * 100, 2) > 100 '
                    .'THEN 100 '
                    .'ELSE COALESCE(ROUND((tax_amount / NULLIF(subtotal - discount_amount, 0)) * 100, 2), 0) END'
                ),
            ]);
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('purchase_orders', function (Blueprint $table) {
            $table->dropColumn(['discount_type', 'discount_value', 'tax_percentage']);
        });
    }
};

<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('promotions', function (Blueprint $table) {
            $table->foreignId('supplier_id')->nullable()->after('funding')->constrained('suppliers')->nullOnDelete();
            $table->decimal('store_share_percent', 5, 2)->default(100.00)->after('supplier_id');
            $table->decimal('supplier_share_percent', 5, 2)->default(0.00)->after('store_share_percent');
        });

        Schema::table('vouchers', function (Blueprint $table) {
            $table->foreignId('supplier_id')->nullable()->after('funding')->constrained('suppliers')->nullOnDelete();
            $table->decimal('store_share_percent', 5, 2)->default(100.00)->after('supplier_id');
            $table->decimal('supplier_share_percent', 5, 2)->default(0.00)->after('store_share_percent');
        });

        Schema::table('applied_promotions', function (Blueprint $table) {
            $table->foreignId('supplier_id')->nullable()->after('funding')->constrained('suppliers')->nullOnDelete();
            $table->decimal('store_discount_amount', 15, 2)->default(0)->after('discount_amount');
            $table->decimal('supplier_discount_amount', 15, 2)->default(0)->after('store_discount_amount');
            $table->string('claim_status', 20)->default('not_applicable')->after('supplier_discount_amount');
            $table->timestamp('claimed_at')->nullable()->after('claim_status');
            $table->string('claim_reference', 100)->nullable()->after('claimed_at');
            $table->text('claim_notes')->nullable()->after('claim_reference');
            $table->index(['claim_status', 'supplier_id']);
        });

        // Backfill share defaults on existing promotions & vouchers
        DB::table('promotions')->where('funding', 'supplier')->update([
            'store_share_percent' => 0,
            'supplier_share_percent' => 100,
        ]);
        DB::table('promotions')->where('funding', 'shared')->update([
            'store_share_percent' => 50,
            'supplier_share_percent' => 50,
        ]);
        DB::table('vouchers')->where('funding', 'supplier')->update([
            'store_share_percent' => 0,
            'supplier_share_percent' => 100,
        ]);
        DB::table('vouchers')->where('funding', 'shared')->update([
            'store_share_percent' => 50,
            'supplier_share_percent' => 50,
        ]);

        // Backfill existing applied_promotions
        DB::table('applied_promotions')->where('funding', 'store')->update([
            'store_discount_amount' => DB::raw('discount_amount'),
            'supplier_discount_amount' => 0,
            'claim_status' => 'not_applicable',
        ]);
        DB::table('applied_promotions')->where('funding', 'supplier')->update([
            'store_discount_amount' => 0,
            'supplier_discount_amount' => DB::raw('discount_amount'),
            'claim_status' => 'pending',
        ]);
        DB::table('applied_promotions')->where('funding', 'shared')->update([
            'store_discount_amount' => DB::raw('ROUND(discount_amount / 2, 2)'),
            'supplier_discount_amount' => DB::raw('discount_amount - ROUND(discount_amount / 2, 2)'),
            'claim_status' => 'pending',
        ]);
    }

    public function down(): void
    {
        Schema::table('applied_promotions', function (Blueprint $table) {
            $table->dropIndex(['claim_status', 'supplier_id']);
            $table->dropConstrainedForeignId('supplier_id');
            $table->dropColumn([
                'store_discount_amount',
                'supplier_discount_amount',
                'claim_status',
                'claimed_at',
                'claim_reference',
                'claim_notes',
            ]);
        });

        Schema::table('vouchers', function (Blueprint $table) {
            $table->dropConstrainedForeignId('supplier_id');
            $table->dropColumn(['store_share_percent', 'supplier_share_percent']);
        });

        Schema::table('promotions', function (Blueprint $table) {
            $table->dropConstrainedForeignId('supplier_id');
            $table->dropColumn(['store_share_percent', 'supplier_share_percent']);
        });
    }
};

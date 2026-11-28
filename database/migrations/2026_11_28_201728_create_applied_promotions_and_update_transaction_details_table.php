<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('transaction_details', function (Blueprint $table): void {
            $table->foreignId('applied_promotion_id')->nullable()->after('discount_amount')->constrained('promotions')->nullOnDelete();
            $table->string('applied_promotion_name')->nullable()->after('applied_promotion_id');
            $table->string('pricing_source', 30)->default('regular')->after('applied_promotion_name');
            $table->decimal('allocated_header_discount', 15, 2)->default(0)->after('pricing_source');
            $table->unsignedInteger('free_qty')->default(0)->after('allocated_header_discount');
            $table->boolean('is_promo_excluded')->default(false)->after('free_qty');

            $table->index('applied_promotion_id');
            $table->index('pricing_source');
        });

        Schema::create('applied_promotions', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('transaction_id')->constrained('transactions')->cascadeOnDelete();
            $table->foreignId('transaction_detail_id')->nullable()->constrained('transaction_details')->cascadeOnDelete();
            $table->foreignId('promotion_id')->nullable()->constrained('promotions')->nullOnDelete();
            $table->unsignedBigInteger('voucher_id')->nullable()->index();
            $table->string('type', 40);
            $table->string('funding', 20)->default('store');
            $table->decimal('discount_amount', 15, 2)->default(0);
            $table->string('description_snapshot');
            $table->json('meta')->nullable();
            $table->timestamps();

            $table->index('transaction_id');
            $table->index('transaction_detail_id');
            $table->index(['promotion_id', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('applied_promotions');

        Schema::table('transaction_details', function (Blueprint $table): void {
            $table->dropForeign(['applied_promotion_id']);
            $table->dropIndex(['applied_promotion_id']);
            $table->dropIndex(['pricing_source']);
            $table->dropColumn([
                'applied_promotion_id',
                'applied_promotion_name',
                'pricing_source',
                'allocated_header_discount',
                'free_qty',
                'is_promo_excluded',
            ]);
        });
    }
};

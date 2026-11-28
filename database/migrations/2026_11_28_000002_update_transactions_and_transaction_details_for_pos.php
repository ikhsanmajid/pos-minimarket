<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('transactions', function (Blueprint $table): void {
            $table->dropForeign(['customer_id']);
            $table->foreign('customer_id')
                ->references('id')
                ->on('customers')
                ->onUpdate('cascade')
                ->nullOnDelete();

            $table->string('status')->default('completed')->change();
            $table->decimal('total_amount', 50, 2)->default(0)->change();
            $table->decimal('discount', 50, 2)->nullable()->default(0)->change();
            $table->decimal('grand_total', 50, 2)->default(0)->change();
            $table->decimal('pay_amount', 50, 2)->default(0)->change();
            $table->decimal('change_amount', 50, 2)->nullable()->default(0)->change();
            $table->string('payment_method')->default('cash')->change();

            $table->decimal('subtotal', 15, 2)->default(0)->after('customer_id');
            $table->decimal('discount_amount', 15, 2)->default(0)->after('subtotal');
            $table->decimal('tax_amount', 15, 2)->default(0)->after('discount_amount');
            $table->decimal('rounding_amount', 15, 2)->default(0)->after('tax_amount');
            $table->decimal('paid_amount', 15, 2)->default(0)->after('grand_total');

            $table->foreignId('voided_by')
                ->nullable()
                ->after('status')
                ->constrained('users')
                ->nullOnDelete();
            $table->timestamp('voided_at')->nullable()->after('voided_by');
            $table->text('void_reason')->nullable()->after('voided_at');

            $table->foreignId('discount_approved_by')
                ->nullable()
                ->after('void_reason')
                ->constrained('users')
                ->nullOnDelete();

            $table->unique('invoice_number', 'transactions_invoice_number_unique');
            $table->index('status', 'transactions_status_index');
            $table->index('user_id', 'transactions_user_id_index');
        });

        Schema::table('transaction_details', function (Blueprint $table): void {
            $table->string('quantity')->default('1')->change();
            $table->decimal('buy_price', 50, 2)->default(0)->change();
            $table->decimal('sell_price', 50, 2)->default(0)->change();
            $table->decimal('subtotal', 50, 2)->default(0)->change();

            $table->foreignId('product_unit_id')
                ->nullable()
                ->after('product_id')
                ->constrained('product_units')
                ->nullOnDelete();
            $table->string('unit_name_snapshot')->default('pcs')->after('product_unit_id');
            $table->integer('conversion_factor')->default(1)->after('unit_name_snapshot');
            $table->integer('qty')->default(1)->after('conversion_factor');
            $table->integer('base_qty')->default(1)->after('qty');
            $table->decimal('unit_price', 15, 2)->default(0)->after('base_qty');
            $table->decimal('cost_price_snapshot', 15, 2)->default(0)->after('unit_price');
            $table->decimal('discount_amount', 15, 2)->default(0)->after('cost_price_snapshot');
        });
    }

    public function down(): void
    {
        Schema::table('transaction_details', function (Blueprint $table): void {
            $table->dropConstrainedForeignId('product_unit_id');
            $table->dropColumn([
                'unit_name_snapshot',
                'conversion_factor',
                'qty',
                'base_qty',
                'unit_price',
                'cost_price_snapshot',
                'discount_amount',
            ]);
        });

        Schema::table('transactions', function (Blueprint $table): void {
            $table->dropUnique('transactions_invoice_number_unique');
            $table->dropIndex('transactions_status_index');
            $table->dropIndex('transactions_user_id_index');
            $table->dropConstrainedForeignId('discount_approved_by');
            $table->dropConstrainedForeignId('voided_by');
            $table->dropColumn([
                'subtotal',
                'discount_amount',
                'tax_amount',
                'rounding_amount',
                'paid_amount',
                'voided_at',
                'void_reason',
            ]);
        });
    }
};

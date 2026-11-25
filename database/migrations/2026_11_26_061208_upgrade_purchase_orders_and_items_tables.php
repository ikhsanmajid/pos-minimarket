<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('purchase_orders', function (Blueprint $table) {
            $table->string('receiving_status', 20)->default('unreceived')->after('status');
            $table->string('tax_type', 10)->default('percent')->after('discount_amount');
            $table->decimal('tax_value', 15, 2)->default(0)->after('tax_type');
            $table->timestamp('submitted_at')->nullable()->after('due_date');
            $table->foreignId('approved_by')->nullable()->after('submitted_at')->constrained('users')->nullOnDelete();
            $table->timestamp('approved_at')->nullable()->after('approved_by');
            $table->foreignId('rejected_by')->nullable()->after('approved_at')->constrained('users')->nullOnDelete();
            $table->timestamp('rejected_at')->nullable()->after('rejected_by');
            $table->text('rejection_reason')->nullable()->after('rejected_at');

            $table->index(['status', 'receiving_status', 'payment_status'], 'po_three_statuses_index');
            $table->index('due_date', 'po_due_date_index');
        });

        // Backfill pajak lama ke tax_type/tax_value
        DB::table('purchase_orders')->update([
            'tax_type' => 'percent',
            'tax_value' => DB::raw('COALESCE(tax_percentage, 0)'),
        ]);

        // Backfill pemisahan status dokumen (status) & status penerimaan (receiving_status)
        DB::table('purchase_orders')
            ->where('status', 'received')
            ->update([
                'status' => 'approved',
                'receiving_status' => 'received',
                'approved_by' => DB::raw('user_id'),
                'approved_at' => DB::raw('created_at'),
            ]);

        DB::table('purchase_orders')
            ->where('status', 'partially_received')
            ->update([
                'status' => 'approved',
                'receiving_status' => 'partial',
                'approved_by' => DB::raw('user_id'),
                'approved_at' => DB::raw('created_at'),
            ]);

        DB::table('purchase_orders')
            ->where('status', 'ordered')
            ->update([
                'status' => 'approved',
                'receiving_status' => 'unreceived',
                'approved_by' => DB::raw('user_id'),
                'approved_at' => DB::raw('created_at'),
            ]);

        Schema::table('purchase_order_items', function (Blueprint $table) {
            $table->foreignId('product_unit_id')->nullable()->after('product_id')->constrained('product_units')->nullOnDelete();
            $table->string('unit_name', 30)->default('pcs')->after('product_unit_id');
            $table->unsignedInteger('conversion_factor')->default(1)->after('unit_name');
            $table->unsignedInteger('free_qty_ordered')->default(0)->after('quantity_received');
            $table->unsignedInteger('free_qty_received')->default(0)->after('free_qty_ordered');
            $table->unsignedBigInteger('base_qty_ordered')->default(0)->after('free_qty_received');
            $table->unsignedBigInteger('base_qty_received')->default(0)->after('base_qty_ordered');
            $table->string('discount_type', 10)->default('fixed')->after('unit_cost');
            $table->decimal('discount_value', 15, 2)->default(0)->after('discount_type');
            $table->decimal('discount_amount', 15, 2)->default(0)->after('discount_value');
        });

        // Backfill item PO lama (satuan dasar pcs, faktor konversi 1)
        DB::table('purchase_order_items')->update([
            'unit_name' => 'pcs',
            'conversion_factor' => 1,
            'base_qty_ordered' => DB::raw('quantity_ordered'),
            'base_qty_received' => DB::raw('quantity_received'),
        ]);
    }

    public function down(): void
    {
        // Kembalikan status gabungan semaksimal mungkin sebelum drop kolom
        DB::table('purchase_orders')
            ->where('status', 'approved')
            ->where('receiving_status', 'received')
            ->update(['status' => 'received']);

        DB::table('purchase_orders')
            ->where('status', 'approved')
            ->where('receiving_status', 'partial')
            ->update(['status' => 'partially_received']);

        DB::table('purchase_orders')
            ->where('status', 'approved')
            ->where('receiving_status', 'unreceived')
            ->update(['status' => 'ordered']);

        Schema::table('purchase_order_items', function (Blueprint $table) {
            $table->dropConstrainedForeignId('product_unit_id');
            $table->dropColumn([
                'unit_name',
                'conversion_factor',
                'free_qty_ordered',
                'free_qty_received',
                'base_qty_ordered',
                'base_qty_received',
                'discount_type',
                'discount_value',
                'discount_amount',
            ]);
        });

        Schema::table('purchase_orders', function (Blueprint $table) {
            $table->dropIndex('po_three_statuses_index');
            $table->dropIndex('po_due_date_index');
            $table->dropConstrainedForeignId('approved_by');
            $table->dropConstrainedForeignId('rejected_by');
            $table->dropColumn([
                'receiving_status',
                'tax_type',
                'tax_value',
                'submitted_at',
                'approved_at',
                'rejected_at',
                'rejection_reason',
            ]);
        });
    }
};

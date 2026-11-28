<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('customers', function (Blueprint $table) {
            if (! Schema::hasColumn('customers', 'member_code')) {
                $table->string('member_code', 30)->nullable()->after('id');
            }
            $table->text('address')->nullable()->change();
            if (! Schema::hasColumn('customers', 'points')) {
                $table->integer('points')->default(0)->after('address');
            }
            if (! Schema::hasColumn('customers', 'is_active')) {
                $table->boolean('is_active')->default(true)->after('points');
            }
            if (! Schema::hasColumn('customers', 'notes')) {
                $table->text('notes')->nullable()->after('is_active');
            }
            if (! Schema::hasColumn('customers', 'deleted_at')) {
                $table->softDeletes();
            }
        });

        // Backfill member_code untuk pelanggan eksisting yang belum memilikinya
        $existingCustomers = DB::table('customers')
            ->whereNull('member_code')
            ->orWhere('member_code', '')
            ->orderBy('id')
            ->get(['id']);

        foreach ($existingCustomers as $customer) {
            DB::table('customers')
                ->where('id', $customer->id)
                ->update([
                    'member_code' => sprintf('MBR-%05d', (int) $customer->id),
                ]);
        }

        Schema::table('customers', function (Blueprint $table) {
            $table->string('member_code', 30)->nullable(false)->change();

            $table->index('name', 'customers_name_index');
            $table->index('phone', 'customers_phone_index');
            $table->index('member_code', 'customers_member_code_index');
            $table->index('is_active', 'customers_is_active_index');
        });

        if (DB::getDriverName() === 'pgsql') {
            DB::statement('CREATE UNIQUE INDEX IF NOT EXISTS customers_member_code_unique_active ON customers (member_code) WHERE deleted_at IS NULL');
            DB::statement('CREATE UNIQUE INDEX IF NOT EXISTS customers_phone_unique_active ON customers (phone) WHERE deleted_at IS NULL AND phone IS NOT NULL');
        } else {
            Schema::table('customers', function (Blueprint $table) {
                $table->unique(['member_code', 'deleted_at'], 'customers_member_code_unique_active');
                $table->unique(['phone', 'deleted_at'], 'customers_phone_unique_active');
            });
        }

        Schema::table('financial_categories', function (Blueprint $table) {
            $table->index(['type', 'is_active'], 'fin_cat_type_active_index');
        });

        Schema::table('financial_transactions', function (Blueprint $table) {
            if (! Schema::hasColumn('financial_transactions', 'reference_number')) {
                $table->string('reference_number', 100)->nullable()->after('reference_id');
            }
            $table->index(['financial_category_id', 'transaction_date'], 'fin_tx_category_date_index');
        });
    }

    public function down(): void
    {
        Schema::table('financial_transactions', function (Blueprint $table) {
            $table->dropIndex('fin_tx_category_date_index');
            if (Schema::hasColumn('financial_transactions', 'reference_number')) {
                $table->dropColumn('reference_number');
            }
        });

        Schema::table('financial_categories', function (Blueprint $table) {
            $table->dropIndex('fin_cat_type_active_index');
        });

        if (DB::getDriverName() === 'pgsql') {
            DB::statement('DROP INDEX IF EXISTS customers_member_code_unique_active');
            DB::statement('DROP INDEX IF EXISTS customers_phone_unique_active');
        } else {
            Schema::table('customers', function (Blueprint $table) {
                $table->dropUnique('customers_member_code_unique_active');
                $table->dropUnique('customers_phone_unique_active');
            });
        }

        Schema::table('customers', function (Blueprint $table) {
            $table->dropIndex('customers_name_index');
            $table->dropIndex('customers_phone_index');
            $table->dropIndex('customers_member_code_index');
            $table->dropIndex('customers_is_active_index');

            $table->dropColumn(['member_code', 'points', 'is_active', 'notes', 'deleted_at']);
            $table->string('address')->nullable()->change();
        });
    }
};

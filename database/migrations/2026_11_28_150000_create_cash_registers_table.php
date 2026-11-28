<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('cash_registers', function (Blueprint $table) {
            $table->id();
            $table->string('code', 20)->unique();
            $table->string('name', 50)->unique();
            $table->string('location', 100)->nullable();
            $table->string('description', 500)->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();
            $table->softDeletes();

            $table->index(['is_active', 'name'], 'cash_registers_active_name_index');
        });

        Schema::table('cashier_shifts', function (Blueprint $table) {
            $table->foreignId('cash_register_id')
                ->nullable()
                ->after('user_id')
                ->constrained('cash_registers')
                ->nullOnDelete();
        });

        $driver = DB::connection()->getDriverName();
        if (in_array($driver, ['pgsql', 'sqlite'], true)) {
            DB::statement("CREATE UNIQUE INDEX cashier_shifts_one_open_per_register_unique ON cashier_shifts (cash_register_id) WHERE status = 'open' AND cash_register_id IS NOT NULL");
        }
    }

    public function down(): void
    {
        $driver = DB::connection()->getDriverName();
        if ($driver === 'pgsql') {
            DB::statement('DROP INDEX IF EXISTS cashier_shifts_one_open_per_register_unique');
        } elseif ($driver === 'sqlite') {
            DB::statement('DROP INDEX IF EXISTS cashier_shifts_one_open_per_register_unique');
        }

        Schema::table('cashier_shifts', function (Blueprint $table) {
            $table->dropConstrainedForeignId('cash_register_id');
        });

        Schema::dropIfExists('cash_registers');
    }
};

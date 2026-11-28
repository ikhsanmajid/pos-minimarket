<?php

use App\Enums\RoundingMode;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('store_settings', function (Blueprint $table) {
            $table->id();
            $table->string('store_name', 150);
            $table->text('store_address')->nullable();
            $table->string('store_phone', 30)->nullable();
            $table->string('store_logo')->nullable();
            $table->text('receipt_header')->nullable();
            $table->text('receipt_footer')->nullable();
            $table->decimal('default_tax_rate', 5, 2)->default(0.00);
            $table->string('rounding_mode', 30)->default(RoundingMode::None->value);
            $table->decimal('shift_variance_tolerance', 15, 2)->default(0.00);
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('store_settings');
    }
};

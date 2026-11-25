<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('financial_accounts', function (Blueprint $table) {
            $table->id();
            $table->string('code', 20)->unique();
            $table->string('name', 100);
            $table->string('type', 20);
            $table->string('account_number', 50)->nullable();
            $table->string('bank_name', 50)->nullable();
            $table->decimal('opening_balance', 15, 2)->default(0);
            $table->decimal('current_balance', 15, 2)->default(0);
            $table->boolean('is_default')->default(false);
            $table->boolean('is_active')->default(true);
            $table->text('notes')->nullable();
            $table->timestamps();
            $table->softDeletes();
        });

        Schema::create('financial_categories', function (Blueprint $table) {
            $table->id();
            $table->string('code', 30)->unique();
            $table->string('name', 100);
            $table->string('type', 20);
            $table->boolean('is_system')->default(false);
            $table->boolean('is_active')->default(true);
            $table->text('description')->nullable();
            $table->timestamps();
            $table->softDeletes();
        });

        Schema::create('account_payables', function (Blueprint $table) {
            $table->id();
            $table->string('payable_number', 30)->unique();
            $table->foreignId('purchase_order_id')->unique()->constrained('purchase_orders')->restrictOnDelete();
            $table->foreignId('supplier_id')->constrained('suppliers')->restrictOnDelete();
            $table->string('invoice_number', 100)->nullable();
            $table->decimal('total_amount', 15, 2)->default(0);
            $table->decimal('paid_amount', 15, 2)->default(0);
            $table->decimal('remaining_amount', 15, 2)->default(0);
            $table->date('due_date')->nullable();
            $table->string('status', 20)->default('unpaid');
            $table->text('notes')->nullable();
            $table->timestamps();
            $table->softDeletes();

            $table->index(['status', 'due_date'], 'account_payables_status_due_index');
        });

        Schema::create('payable_payments', function (Blueprint $table) {
            $table->id();
            $table->string('payment_number', 30)->unique();
            $table->foreignId('account_payable_id')->constrained('account_payables')->restrictOnDelete();
            $table->foreignId('financial_account_id')->constrained('financial_accounts')->restrictOnDelete();
            $table->decimal('amount', 15, 2);
            $table->date('payment_date');
            $table->string('payment_method', 30)->default('cash');
            $table->string('reference_number', 100)->nullable();
            $table->text('notes')->nullable();
            $table->foreignId('paid_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index(['account_payable_id', 'payment_date'], 'payable_payments_ap_date_index');
        });

        Schema::create('financial_transactions', function (Blueprint $table) {
            $table->id();
            $table->string('transaction_number', 30)->unique();
            $table->foreignId('financial_account_id')->constrained('financial_accounts')->restrictOnDelete();
            $table->foreignId('financial_category_id')->constrained('financial_categories')->restrictOnDelete();
            $table->string('type', 10);
            $table->decimal('amount', 15, 2);
            $table->decimal('balance_before', 15, 2);
            $table->decimal('balance_after', 15, 2);
            $table->date('transaction_date');
            $table->nullableMorphs('reference');
            $table->text('description');
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index(['financial_account_id', 'transaction_date'], 'fin_tx_account_date_index');
            $table->index(['type', 'transaction_date'], 'fin_tx_type_date_index');
        });

        // Backfill hutang dagang untuk PO eksisting yang sudah approved
        $approvedOrders = DB::table('purchase_orders')
            ->whereNull('deleted_at')
            ->where('status', 'approved')
            ->orderBy('id')
            ->get();

        $sequence = 1;
        foreach ($approvedOrders as $po) {
            $totalAmount = (float) $po->total_amount;
            $isPaid = $po->payment_status === 'paid';
            $paidAmount = $isPaid ? $totalAmount : 0.0;
            $remainingAmount = max(0, round($totalAmount - $paidAmount, 2));
            $datePrefix = $po->created_at
                ? date('Ymd', strtotime((string) $po->created_at))
                : date('Ymd');

            DB::table('account_payables')->insert([
                'payable_number' => sprintf('AP-%s-%04d', $datePrefix, $sequence++),
                'purchase_order_id' => $po->id,
                'supplier_id' => $po->supplier_id,
                'invoice_number' => null,
                'total_amount' => $totalAmount,
                'paid_amount' => $paidAmount,
                'remaining_amount' => $remainingAmount,
                'due_date' => $po->due_date,
                'status' => $isPaid ? 'paid' : 'unpaid',
                'notes' => "Hutang otomatis dari migrasi PO {$po->po_number}.",
                'created_at' => $po->created_at ?? now(),
                'updated_at' => $po->updated_at ?? now(),
            ]);
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('financial_transactions');
        Schema::dropIfExists('payable_payments');
        Schema::dropIfExists('account_payables');
        Schema::dropIfExists('financial_categories');
        Schema::dropIfExists('financial_accounts');
    }
};

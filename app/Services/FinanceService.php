<?php

namespace App\Services;

use App\Enums\ActivityLogCategory;
use App\Enums\FinancialAccountType;
use App\Enums\FinancialCategoryType;
use App\Enums\FinancialTransactionType;
use App\Enums\PaymentMethod;
use App\Enums\PaymentStatus;
use App\Enums\PurchaseOrderStatus;
use App\Enums\ShiftCashMovementType;
use App\Models\AccountPayable;
use App\Models\CashierShift;
use App\Models\FinancialAccount;
use App\Models\FinancialCategory;
use App\Models\FinancialTransaction;
use App\Models\PayablePayment;
use App\Models\PurchaseOrder;
use App\Models\SalesReturn;
use App\Models\ShiftCashMovement;
use App\Models\Transaction;
use App\Models\TransactionPayment;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class FinanceService
{
    /**
     * Kode kategori sistem yang hanya boleh diposting otomatis oleh alur POS / PO / Retur.
     *
     * @var array<int, string>
     */
    public const array AUTO_SYSTEM_CATEGORY_CODES = [
        'INC-SALES',
        'EXP-PO',
        'EXP-REFUND',
    ];

    /**
     * Membuat atau menyinkronkan data Hutang Dagang (AccountPayable) dari sebuah PO yang sudah disetujui.
     */
    public function syncPayableForPurchaseOrder(
        PurchaseOrder $po,
        User $actor,
        ?string $invoiceNumber = null
    ): AccountPayable {
        return DB::transaction(function () use ($po, $actor, $invoiceNumber): AccountPayable {
            $payable = AccountPayable::withTrashed()
                ->where('purchase_order_id', $po->id)
                ->lockForUpdate()
                ->first();

            $newTotal = round(max(0, (float) $po->total_amount), 2);

            if ($payable) {
                if ($payable->trashed()) {
                    $payable->restore();
                }

                $paidAmount = round((float) $payable->paid_amount, 2);

                if ($newTotal < $paidAmount) {
                    throw ValidationException::withMessages([
                        'total_amount' => sprintf(
                            'Total PO (%s) tidak boleh lebih kecil dari total pembayaran yang sudah tercatat (%s).',
                            number_format($newTotal, 0, ',', '.'),
                            number_format($paidAmount, 0, ',', '.')
                        ),
                    ]);
                }

                $remaining = max(0, round($newTotal - $paidAmount, 2));
                $status = $this->resolvePaymentStatus($newTotal, $paidAmount);

                $payable->update([
                    'supplier_id' => $po->supplier_id,
                    'invoice_number' => $invoiceNumber ?? $payable->invoice_number,
                    'total_amount' => $newTotal,
                    'remaining_amount' => $remaining,
                    'due_date' => $po->due_date,
                    'status' => $status,
                ]);

                if ($po->payment_status !== $status) {
                    $po->payment_status = $status;
                    $po->save();
                }

                return $payable->refresh();
            }

            $status = $newTotal <= 0 ? PaymentStatus::Paid : PaymentStatus::Unpaid;

            $payable = AccountPayable::create([
                'purchase_order_id' => $po->id,
                'supplier_id' => $po->supplier_id,
                'invoice_number' => $invoiceNumber,
                'total_amount' => $newTotal,
                'paid_amount' => 0,
                'remaining_amount' => $newTotal,
                'due_date' => $po->due_date,
                'status' => $status,
                'notes' => "Hutang dagang dari PO {$po->po_number}.",
            ]);

            if ($po->payment_status !== $status) {
                $po->payment_status = $status;
                $po->save();
            }

            activity(ActivityLogCategory::Finance->value)
                ->event('created')
                ->performedOn($payable)
                ->causedBy($actor)
                ->withProperties([
                    'payable_number' => $payable->payable_number,
                    'po_number' => $po->po_number,
                    'total_amount' => $payable->total_amount,
                    'due_date' => $payable->due_date?->toDateString(),
                ])
                ->log("Hutang Dagang {$payable->payable_number} terbentuk dari PO {$po->po_number}.");

            return $payable;
        });
    }

    /**
     * Menghapus (soft-delete) hutang dagang saat PO dibatalkan (hanya jika belum ada pembayaran).
     */
    public function voidPayableForPurchaseOrder(PurchaseOrder $po, User $actor): void
    {
        DB::transaction(function () use ($po, $actor): void {
            $payable = AccountPayable::where('purchase_order_id', $po->id)
                ->lockForUpdate()
                ->first();

            if (! $payable) {
                return;
            }

            if ((float) $payable->paid_amount > 0) {
                throw ValidationException::withMessages([
                    'status' => "Hutang {$payable->payable_number} sudah memiliki pembayaran sehingga PO tidak dapat dibatalkan.",
                ]);
            }

            $payable->delete();

            activity(ActivityLogCategory::Finance->value)
                ->event('deleted')
                ->performedOn($payable)
                ->causedBy($actor)
                ->withProperties([
                    'payable_number' => $payable->payable_number,
                    'po_number' => $po->po_number,
                ])
                ->log("Hutang Dagang {$payable->payable_number} dibatalkan karena PO {$po->po_number} dibatalkan.");
        });
    }

    /**
     * Mencatat pembayaran / cicilan hutang dagang secara atomik:
     * 1. Buat PayablePayment
     * 2. Potong current_balance FinancialAccount (dengan lockForUpdate)
     * 3. Catat mutasi kas keluar (out) di FinancialTransaction
     * 4. Update paid_amount, remaining_amount, status di AccountPayable
     * 5. Sinkronkan payment_status di PurchaseOrder
     *
     * @param  array{financial_account_id: int, amount: float|int|string, payment_date: string, payment_method: string, reference_number?: string|null, invoice_number?: string|null, notes?: string|null}  $data
     */
    public function recordPayablePayment(AccountPayable $payable, array $data, User $actor): PayablePayment
    {
        return DB::transaction(function () use ($payable, $data, $actor): PayablePayment {
            /** @var AccountPayable $lockedPayable */
            $lockedPayable = AccountPayable::where('id', $payable->id)
                ->lockForUpdate()
                ->firstOrFail();

            /** @var PurchaseOrder $lockedPo */
            $lockedPo = PurchaseOrder::where('id', $lockedPayable->purchase_order_id)
                ->lockForUpdate()
                ->firstOrFail();

            if ($lockedPo->isLocked()) {
                throw ValidationException::withMessages([
                    'status' => "PO {$lockedPo->po_number} sudah Lunas dan Diterima Penuh sehingga terkunci permanen.",
                ]);
            }

            if ($lockedPo->status !== PurchaseOrderStatus::Approved) {
                throw ValidationException::withMessages([
                    'status' => "Pembayaran hanya dapat dicatat untuk PO yang sudah disetujui ({$lockedPo->po_number}).",
                ]);
            }

            if ($lockedPayable->status === PaymentStatus::Paid || (float) $lockedPayable->remaining_amount <= 0) {
                throw ValidationException::withMessages([
                    'amount' => "Hutang {$lockedPayable->payable_number} sudah lunas.",
                ]);
            }

            $amount = round((float) $data['amount'], 2);
            $remainingBefore = round((float) $lockedPayable->remaining_amount, 2);

            if ($amount <= 0) {
                throw ValidationException::withMessages([
                    'amount' => 'Nominal pembayaran harus lebih besar dari 0.',
                ]);
            }

            if ($amount > $remainingBefore) {
                throw ValidationException::withMessages([
                    'amount' => sprintf(
                        'Nominal pembayaran (Rp %s) melebihi sisa hutang (Rp %s).',
                        number_format($amount, 0, ',', '.'),
                        number_format($remainingBefore, 0, ',', '.')
                    ),
                ]);
            }

            /** @var FinancialAccount $account */
            $account = FinancialAccount::where('id', (int) $data['financial_account_id'])
                ->lockForUpdate()
                ->firstOrFail();

            if (! $account->is_active) {
                throw ValidationException::withMessages([
                    'financial_account_id' => "Akun keuangan {$account->name} sedang nonaktif.",
                ]);
            }

            $balanceBefore = round((float) $account->current_balance, 2);
            if ($balanceBefore < $amount) {
                throw ValidationException::withMessages([
                    'amount' => sprintf(
                        'Saldo akun %s tidak mencukupi (Saldo tersedia: Rp %s).',
                        $account->name,
                        number_format($balanceBefore, 0, ',', '.')
                    ),
                ]);
            }

            $category = FinancialCategory::firstOrCreate(
                ['code' => 'EXP-PO'],
                [
                    'name' => 'Pembelian Stok / Pelunasan Hutang Supplier',
                    'type' => FinancialCategoryType::Expense,
                    'is_system' => true,
                    'is_active' => true,
                    'description' => 'Pengeluaran untuk pembayaran Purchase Order dan hutang dagang supplier.',
                ]
            );

            $paymentMethod = PaymentMethod::from((string) $data['payment_method']);

            $payment = PayablePayment::create([
                'account_payable_id' => $lockedPayable->id,
                'financial_account_id' => $account->id,
                'amount' => $amount,
                'payment_date' => $data['payment_date'],
                'payment_method' => $paymentMethod,
                'reference_number' => $data['reference_number'] ?? null,
                'notes' => $data['notes'] ?? null,
                'paid_by' => $actor->id,
            ]);

            // Potong saldo rekening kas/bank
            $balanceAfter = round($balanceBefore - $amount, 2);
            $account->current_balance = $balanceAfter;
            $account->save();

            // Catat buku besar arus kas (FinancialTransaction)
            FinancialTransaction::create([
                'financial_account_id' => $account->id,
                'financial_category_id' => $category->id,
                'type' => FinancialTransactionType::Out,
                'amount' => $amount,
                'balance_before' => $balanceBefore,
                'balance_after' => $balanceAfter,
                'transaction_date' => $data['payment_date'],
                'reference_type' => PayablePayment::class,
                'reference_id' => $payment->id,
                'description' => sprintf(
                    'Pembayaran hutang PO %s (%s) via %s%s',
                    $lockedPo->po_number,
                    $lockedPayable->supplier?->name ?? 'Supplier',
                    $paymentMethod->label(),
                    ! empty($data['reference_number']) ? " - Ref: {$data['reference_number']}" : ''
                ),
                'created_by' => $actor->id,
            ]);

            // Perbarui AccountPayable
            $oldPaymentStatus = $lockedPo->payment_status?->value ?? PaymentStatus::Unpaid->value;
            $newPaidAmount = round((float) $lockedPayable->paid_amount + $amount, 2);
            $newRemaining = max(0, round((float) $lockedPayable->total_amount - $newPaidAmount, 2));
            $newStatus = $this->resolvePaymentStatus((float) $lockedPayable->total_amount, $newPaidAmount);

            $lockedPayable->paid_amount = $newPaidAmount;
            $lockedPayable->remaining_amount = $newRemaining;
            $lockedPayable->status = $newStatus;
            if (! empty($data['invoice_number'])) {
                $lockedPayable->invoice_number = $data['invoice_number'];
            }
            $lockedPayable->save();

            // Sinkronkan payment_status pada PurchaseOrder
            $lockedPo->payment_status = $newStatus;
            $lockedPo->save();

            // Log aktivitas pada PO & Finance
            activity(ActivityLogCategory::PurchaseOrder->value)
                ->event('updated')
                ->performedOn($lockedPo)
                ->causedBy($actor)
                ->withProperties([
                    'event' => 'payment_recorded',
                    'po_number' => $lockedPo->po_number,
                    'payment_number' => $payment->payment_number,
                    'financial_account' => $account->name,
                    'payment_method' => $paymentMethod->label(),
                    'payment_amount' => $amount,
                    'paid_amount' => $newPaidAmount,
                    'remaining_amount' => $newRemaining,
                    'old_payment_status' => $oldPaymentStatus,
                    'new_payment_status' => $newStatus->value,
                    'reference_number' => $payment->reference_number,
                ])
                ->log(sprintf(
                    'Pembayaran %s sebesar Rp %s untuk PO %s melalui %s (%s).',
                    $payment->payment_number,
                    number_format($amount, 0, ',', '.'),
                    $lockedPo->po_number,
                    $account->name,
                    $newStatus->label()
                ));

            activity(ActivityLogCategory::Finance->value)
                ->event('created')
                ->performedOn($payment)
                ->causedBy($actor)
                ->withProperties([
                    'payment_number' => $payment->payment_number,
                    'payable_number' => $lockedPayable->payable_number,
                    'po_number' => $lockedPo->po_number,
                    'financial_account' => $account->name,
                    'amount' => $amount,
                    'old_balance' => $balanceBefore,
                    'new_balance' => $balanceAfter,
                ])
                ->log(sprintf(
                    'Pembayaran Hutang %s sebesar Rp %s dari akun %s.',
                    $payment->payment_number,
                    number_format($amount, 0, ',', '.'),
                    $account->name
                ));

            return $payment->load(['accountPayable.purchaseOrder', 'financialAccount', 'paidBy']);
        });
    }

    /**
     * Membuat akun kas/bank baru.
     *
     * @param  array<string, mixed>  $data
     */
    public function createAccount(array $data): FinancialAccount
    {
        return DB::transaction(function () use ($data): FinancialAccount {
            $isDefault = (bool) ($data['is_default'] ?? false);
            if ($isDefault) {
                FinancialAccount::where('is_default', true)->update(['is_default' => false]);
            }

            $openingBalance = round(max(0, (float) ($data['opening_balance'] ?? 0)), 2);

            return FinancialAccount::create([
                'code' => ! empty($data['code']) ? strtoupper(trim((string) $data['code'])) : null,
                'name' => trim((string) $data['name']),
                'type' => $data['type'],
                'account_number' => $data['account_number'] ?? null,
                'bank_name' => $data['bank_name'] ?? null,
                'opening_balance' => $openingBalance,
                'current_balance' => $openingBalance,
                'is_default' => $isDefault,
                'is_active' => (bool) ($data['is_active'] ?? true),
                'notes' => $data['notes'] ?? null,
            ]);
        });
    }

    /**
     * Memperbarui metadata akun kas/bank (current_balance dijaga tetap melalui mutasi transaksi).
     *
     * @param  array<string, mixed>  $data
     */
    public function updateAccount(FinancialAccount $account, array $data): FinancialAccount
    {
        return DB::transaction(function () use ($account, $data): FinancialAccount {
            $isDefault = (bool) ($data['is_default'] ?? false);
            if ($isDefault && ! $account->is_default) {
                FinancialAccount::where('id', '!=', $account->id)
                    ->where('is_default', true)
                    ->update(['is_default' => false]);
            }

            $payload = [
                'code' => ! empty($data['code']) ? strtoupper(trim((string) $data['code'])) : $account->code,
                'name' => trim((string) $data['name']),
                'type' => $data['type'],
                'account_number' => $data['account_number'] ?? null,
                'bank_name' => $data['bank_name'] ?? null,
                'is_default' => $isDefault,
                'is_active' => (bool) ($data['is_active'] ?? $account->is_active),
                'notes' => $data['notes'] ?? null,
            ];

            // Saldo awal hanya boleh diubah jika belum ada transaksi finansial pada akun ini
            if (array_key_exists('opening_balance', $data) && ! $account->transactions()->exists()) {
                $openingBalance = round(max(0, (float) $data['opening_balance']), 2);
                $payload['opening_balance'] = $openingBalance;
                $payload['current_balance'] = $openingBalance;
            }

            $account->update($payload);

            return $account->refresh();
        });
    }

    /**
     * Menghapus akun kas/bank (ditolak jika sudah memiliki riwayat transaksi).
     */
    public function deleteAccount(FinancialAccount $account): void
    {
        if ($account->transactions()->exists() || $account->payablePayments()->exists()) {
            throw ValidationException::withMessages([
                'account' => "Akun {$account->name} sudah memiliki riwayat transaksi keuangan sehingga tidak dapat dihapus. Nonaktifkan saja akun ini.",
            ]);
        }

        $account->delete();
    }

    /**
     * Membuat kategori keuangan baru dengan auto-generate kode unik jika tidak diisi.
     *
     * @param  array<string, mixed>  $data
     */
    public function createCategory(array $data): FinancialCategory
    {
        return DB::transaction(function () use ($data): FinancialCategory {
            $type = FinancialCategoryType::from((string) $data['type']);
            $code = ! empty($data['code'])
                ? strtoupper(trim((string) $data['code']))
                : $this->generateCategoryCode($type);

            return FinancialCategory::create([
                'code' => $code,
                'name' => trim((string) $data['name']),
                'type' => $type,
                'is_system' => false,
                'is_active' => array_key_exists('is_active', $data) ? (bool) $data['is_active'] : true,
                'description' => isset($data['description']) && trim((string) $data['description']) !== ''
                    ? trim((string) $data['description'])
                    : null,
            ]);
        });
    }

    /**
     * Memperbarui kategori keuangan dengan proteksi kategori sistem dan kategori yang sudah terpakai.
     *
     * @param  array<string, mixed>  $data
     */
    public function updateCategory(FinancialCategory $category, array $data): FinancialCategory
    {
        return DB::transaction(function () use ($category, $data): FinancialCategory {
            $newType = FinancialCategoryType::from((string) $data['type']);

            if ($newType !== $category->type) {
                if ($category->is_system) {
                    throw ValidationException::withMessages([
                        'type' => "Tipe kategori sistem {$category->name} tidak dapat diubah.",
                    ]);
                }

                if ($category->transactions()->exists()) {
                    throw ValidationException::withMessages([
                        'type' => "Tipe kategori {$category->name} tidak dapat diubah karena sudah digunakan pada transaksi keuangan.",
                    ]);
                }
            }

            if ($category->is_system && array_key_exists('is_active', $data) && ! (bool) $data['is_active']) {
                throw ValidationException::withMessages([
                    'is_active' => "Kategori sistem {$category->name} tidak dapat dinonaktifkan.",
                ]);
            }

            $payload = [
                'name' => trim((string) $data['name']),
                'type' => $newType,
                'is_active' => array_key_exists('is_active', $data) ? (bool) $data['is_active'] : $category->is_active,
                'description' => isset($data['description']) && trim((string) $data['description']) !== ''
                    ? trim((string) $data['description'])
                    : null,
            ];

            if (! $category->is_system && ! empty($data['code'])) {
                $payload['code'] = strtoupper(trim((string) $data['code']));
            }

            $category->update($payload);

            return $category->refresh();
        });
    }

    /**
     * Menghapus kategori keuangan (ditolak jika kategori sistem atau sudah dipakai di transaksi).
     */
    public function deleteCategory(FinancialCategory $category): void
    {
        if ($category->is_system) {
            throw ValidationException::withMessages([
                'category' => "Kategori bawaan sistem {$category->name} tidak dapat dihapus.",
            ]);
        }

        if ($category->transactions()->exists()) {
            throw ValidationException::withMessages([
                'category' => "Kategori {$category->name} sudah digunakan pada riwayat transaksi keuangan sehingga tidak dapat dihapus. Nonaktifkan saja kategori ini.",
            ]);
        }

        $category->delete();
    }

    /**
     * Ringkasan KPI kategori keuangan dalam 1 query agregasi PostgreSQL.
     *
     * @return array{
     *     total_categories: int,
     *     income_categories: int,
     *     expense_categories: int,
     *     active_categories: int,
     *     system_categories: int
     * }
     */
    public function getCategorySummary(): array
    {
        $row = FinancialCategory::query()
            ->selectRaw(
                'COUNT(*) as total_categories,
                COUNT(*) FILTER (WHERE type = ?) as income_categories,
                COUNT(*) FILTER (WHERE type = ?) as expense_categories,
                COUNT(*) FILTER (WHERE is_active = true) as active_categories,
                COUNT(*) FILTER (WHERE is_system = true) as system_categories',
                [
                    FinancialCategoryType::Income->value,
                    FinancialCategoryType::Expense->value,
                ]
            )
            ->first();

        return [
            'total_categories' => (int) ($row->total_categories ?? 0),
            'income_categories' => (int) ($row->income_categories ?? 0),
            'expense_categories' => (int) ($row->expense_categories ?? 0),
            'active_categories' => (int) ($row->active_categories ?? 0),
            'system_categories' => (int) ($row->system_categories ?? 0),
        ];
    }

    /**
     * Mencatat transaksi keuangan operasional manual (Pemasukan Lainnya / Pengeluaran Operasional)
     * secara atomik dengan pessimistic locking pada FinancialAccount.
     *
     * @param  array{
     *     financial_account_id: int|string,
     *     financial_category_id: int|string,
     *     type: string,
     *     amount: float|int|string,
     *     transaction_date: string,
     *     reference_number?: string|null,
     *     description: string
     * }  $data
     */
    public function recordManualTransaction(array $data, User $actor): FinancialTransaction
    {
        return DB::transaction(function () use ($data, $actor): FinancialTransaction {
            $type = FinancialTransactionType::from((string) $data['type']);
            $amount = round((float) $data['amount'], 2);

            if ($amount <= 0) {
                throw ValidationException::withMessages([
                    'amount' => 'Nominal transaksi harus lebih besar dari 0.',
                ]);
            }

            /** @var FinancialAccount $account */
            $account = FinancialAccount::query()
                ->where('id', (int) $data['financial_account_id'])
                ->lockForUpdate()
                ->firstOrFail();

            if (! $account->is_active) {
                throw ValidationException::withMessages([
                    'financial_account_id' => "Akun keuangan {$account->name} sedang nonaktif.",
                ]);
            }

            /** @var FinancialCategory $category */
            $category = FinancialCategory::query()
                ->where('id', (int) $data['financial_category_id'])
                ->firstOrFail();

            if (! $category->is_active) {
                throw ValidationException::withMessages([
                    'financial_category_id' => "Kategori keuangan {$category->name} sedang nonaktif.",
                ]);
            }

            if (in_array($category->code, self::AUTO_SYSTEM_CATEGORY_CODES, true)) {
                throw ValidationException::withMessages([
                    'financial_category_id' => "Kategori {$category->name} ({$category->code}) khusus untuk transaksi otomatis sistem dan tidak dapat digunakan untuk pencatatan manual.",
                ]);
            }

            $expectedCategoryType = $type === FinancialTransactionType::In
                ? FinancialCategoryType::Income
                : FinancialCategoryType::Expense;

            if ($category->type !== $expectedCategoryType) {
                throw ValidationException::withMessages([
                    'financial_category_id' => sprintf(
                        'Kategori %s bertipe %s sehingga tidak cocok untuk transaksi %s.',
                        $category->name,
                        $category->type->label(),
                        $type->label()
                    ),
                ]);
            }

            $balanceBefore = round((float) $account->current_balance, 2);

            if ($type === FinancialTransactionType::Out && $balanceBefore < $amount) {
                throw ValidationException::withMessages([
                    'amount' => sprintf(
                        'Saldo akun %s tidak mencukupi (Saldo tersedia: Rp %s).',
                        $account->name,
                        number_format($balanceBefore, 0, ',', '.')
                    ),
                ]);
            }

            $balanceAfter = $type === FinancialTransactionType::In
                ? round($balanceBefore + $amount, 2)
                : round($balanceBefore - $amount, 2);

            $account->current_balance = $balanceAfter;
            $account->save();

            $referenceNumber = isset($data['reference_number']) && trim((string) $data['reference_number']) !== ''
                ? trim((string) $data['reference_number'])
                : null;
            $description = trim((string) $data['description']);

            $transaction = FinancialTransaction::create([
                'financial_account_id' => $account->id,
                'financial_category_id' => $category->id,
                'type' => $type,
                'amount' => $amount,
                'balance_before' => $balanceBefore,
                'balance_after' => $balanceAfter,
                'transaction_date' => $data['transaction_date'],
                'reference_type' => null,
                'reference_id' => null,
                'reference_number' => $referenceNumber,
                'description' => $description,
                'created_by' => $actor->id,
            ]);

            activity(ActivityLogCategory::Finance->value)
                ->event('created')
                ->performedOn($transaction)
                ->causedBy($actor)
                ->withProperties([
                    'transaction_number' => $transaction->transaction_number,
                    'type' => $type->value,
                    'financial_account' => $account->name,
                    'financial_category' => $category->name,
                    'amount' => $amount,
                    'old_balance' => $balanceBefore,
                    'new_balance' => $balanceAfter,
                    'transaction_date' => (string) $data['transaction_date'],
                    'reference_number' => $referenceNumber,
                    'description' => $description,
                ])
                ->log(sprintf(
                    'Transaksi Keuangan Manual %s (%s - %s) sebesar Rp %s pada akun %s berhasil dicatat.',
                    $transaction->transaction_number,
                    $type->label(),
                    $category->name,
                    number_format($amount, 0, ',', '.'),
                    $account->name
                ));

            return $transaction->load(['financialAccount', 'financialCategory', 'creator']);
        });
    }

    private function generateCategoryCode(FinancialCategoryType $type): string
    {
        $prefix = $type === FinancialCategoryType::Income ? 'INC' : 'EXP';
        $nextNumber = (FinancialCategory::withTrashed()->max('id') ?? 0) + 1;

        do {
            $candidate = sprintf('%s-%03d', $prefix, $nextNumber);
            $exists = FinancialCategory::withTrashed()->where('code', $candidate)->exists();
            $nextNumber++;
        } while ($exists);

        return $candidate;
    }

    /**
     * Sinkronisasi mutasi kas tengah shift (cash_in, cash_out, cash_drop) ke buku besar keuangan.
     * Harus dipanggil di dalam DB::transaction() yang sama dengan penyimpanan ShiftCashMovement.
     */
    public function syncShiftCashMovement(
        ShiftCashMovement $movement,
        CashierShift $shift,
        User $actor
    ): ?FinancialTransaction {
        $amount = round((float) $movement->amount, 2);
        if ($amount <= 0) {
            return null;
        }

        if ($movement->type === ShiftCashMovementType::CashDrop) {
            $account = $this->resolveLockedCashAccount($movement->financial_account_id, preferSafe: true);
            if (! $account) {
                return null;
            }

            if ($movement->financial_account_id !== $account->id) {
                $movement->financial_account_id = $account->id;
                $movement->save();
            }

            $category = FinancialCategory::firstOrCreate(
                ['code' => 'INC-SALES'],
                [
                    'name' => 'Penjualan Kasir (POS)',
                    'type' => FinancialCategoryType::Income,
                    'is_system' => true,
                    'is_active' => true,
                    'description' => 'Pemasukan dari transaksi penjualan kasir minimarket.',
                ]
            );

            return $this->postFinancialMutation(
                account: $account,
                category: $category,
                type: FinancialTransactionType::In,
                amount: $amount,
                referenceType: ShiftCashMovement::class,
                referenceId: $movement->id,
                description: sprintf(
                    'Cash Drop shift %s (%s): %s',
                    $shift->shift_number,
                    $shift->register_name,
                    $movement->reason
                ),
                actor: $actor,
                allowNegativeBalance: false
            );
        }

        if ($movement->type === ShiftCashMovementType::CashOut) {
            $account = $this->resolveLockedCashAccount($movement->financial_account_id, preferSafe: false);
            if (! $account) {
                return null;
            }

            if ($movement->financial_account_id !== $account->id) {
                $movement->financial_account_id = $account->id;
                $movement->save();
            }

            $category = FinancialCategory::firstOrCreate(
                ['code' => 'EXP-OPEX'],
                [
                    'name' => 'Biaya Operasional Toko',
                    'type' => FinancialCategoryType::Expense,
                    'is_system' => true,
                    'is_active' => true,
                    'description' => 'Kebutuhan operasional rutin toko (plastik, struk, perlengkapan).',
                ]
            );

            return $this->postFinancialMutation(
                account: $account,
                category: $category,
                type: FinancialTransactionType::Out,
                amount: $amount,
                referenceType: ShiftCashMovement::class,
                referenceId: $movement->id,
                description: sprintf(
                    'Cash Out shift %s (%s): %s',
                    $shift->shift_number,
                    $shift->register_name,
                    $movement->reason
                ),
                actor: $actor,
                allowNegativeBalance: $account->code === 'KAS-001'
            );
        }

        // Cash In: jika kasir memilih sumber akun (misal ambil uang receh dari Brankas), catat keluar dari akun sumber.
        if ($movement->type === ShiftCashMovementType::CashIn && $movement->financial_account_id !== null) {
            $account = $this->resolveLockedCashAccount($movement->financial_account_id, preferSafe: true);
            if (! $account) {
                return null;
            }

            $category = FinancialCategory::firstOrCreate(
                ['code' => 'EXP-OTHER'],
                [
                    'name' => 'Pengeluaran Lain-lain',
                    'type' => FinancialCategoryType::Expense,
                    'is_system' => false,
                    'is_active' => true,
                    'description' => 'Pengeluaran lain yang tidak termasuk kategori utama.',
                ]
            );

            return $this->postFinancialMutation(
                account: $account,
                category: $category,
                type: FinancialTransactionType::Out,
                amount: $amount,
                referenceType: ShiftCashMovement::class,
                referenceId: $movement->id,
                description: sprintf(
                    'Pengambilan kas masuk (Cash In) shift %s (%s): %s',
                    $shift->shift_number,
                    $shift->register_name,
                    $movement->reason
                ),
                actor: $actor,
                allowNegativeBalance: false
            );
        }

        return null;
    }

    /**
     * Sinkronisasi setoran akhir tunai dan total non-tunai saat sesi shift ditutup (closed).
     * Harus dipanggil di dalam DB::transaction() yang sama dengan penutupan CashierShift.
     *
     * @return array{cash_transaction_id: int|null, non_cash_transaction_id: int|null, cash_deposited: float, non_cash_deposited: float}
     */
    public function syncShiftClosing(
        CashierShift $shift,
        float $netCashDeposit,
        float $nonCashSales,
        User $actor,
        ?int $cashDepositAccountId = null,
        ?int $nonCashDepositAccountId = null
    ): array {
        $salesCategory = FinancialCategory::firstOrCreate(
            ['code' => 'INC-SALES'],
            [
                'name' => 'Penjualan Kasir (POS)',
                'type' => FinancialCategoryType::Income,
                'is_system' => true,
                'is_active' => true,
                'description' => 'Pemasukan dari transaksi penjualan kasir minimarket.',
            ]
        );

        $cashTransaction = null;
        $nonCashTransaction = null;
        $cashDeposited = 0.0;
        $nonCashDeposited = 0.0;

        $roundedCash = round(max(0, $netCashDeposit), 2);
        if ($roundedCash > 0) {
            $cashAccount = $this->resolveLockedCashAccount($cashDepositAccountId, preferSafe: true);
            if ($cashAccount) {
                $cashTransaction = $this->postFinancialMutation(
                    account: $cashAccount,
                    category: $salesCategory,
                    type: FinancialTransactionType::In,
                    amount: $roundedCash,
                    referenceType: CashierShift::class,
                    referenceId: $shift->id,
                    description: sprintf(
                        'Setoran penutupan tunai shift %s (%s)',
                        $shift->shift_number,
                        $shift->register_name
                    ),
                    actor: $actor,
                    allowNegativeBalance: false
                );
                $cashDeposited = $roundedCash;
            }
        }

        $roundedNonCash = round(max(0, $nonCashSales), 2);
        if ($roundedNonCash > 0) {
            $nonCashAccount = $this->resolveLockedNonCashAccount($nonCashDepositAccountId);
            if ($nonCashAccount) {
                $nonCashTransaction = $this->postFinancialMutation(
                    account: $nonCashAccount,
                    category: $salesCategory,
                    type: FinancialTransactionType::In,
                    amount: $roundedNonCash,
                    referenceType: CashierShift::class,
                    referenceId: $shift->id,
                    description: sprintf(
                        'Penerimaan penjualan non-tunai shift %s (%s)',
                        $shift->shift_number,
                        $shift->register_name
                    ),
                    actor: $actor,
                    allowNegativeBalance: false
                );
                $nonCashDeposited = $roundedNonCash;
            }
        }

        return [
            'cash_transaction_id' => $cashTransaction?->id,
            'non_cash_transaction_id' => $nonCashTransaction?->id,
            'cash_deposited' => $cashDeposited,
            'non_cash_deposited' => $nonCashDeposited,
        ];
    }

    /**
     * Mencatat pemasukan dari pembayaran transaksi POS ke FinancialAccount & buku besar.
     * Harus dipanggil di dalam DB::transaction() yang sama dengan PosTransactionService::checkout().
     */
    public function recordPosSalePayment(
        Transaction $transaction,
        TransactionPayment $payment,
        float $netAmount,
        User $actor
    ): ?FinancialTransaction {
        $amount = round($netAmount, 2);
        if ($amount <= 0) {
            return null;
        }

        /** @var FinancialAccount|null $account */
        $account = FinancialAccount::query()
            ->where('id', $payment->financial_account_id)
            ->where('is_active', true)
            ->lockForUpdate()
            ->first();

        if (! $account instanceof FinancialAccount) {
            throw ValidationException::withMessages([
                'payments' => 'Akun keuangan tujuan pembayaran tidak ditemukan atau sedang nonaktif.',
            ]);
        }

        $salesCategory = FinancialCategory::firstOrCreate(
            ['code' => 'INC-SALES'],
            [
                'name' => 'Penjualan Kasir (POS)',
                'type' => FinancialCategoryType::Income,
                'is_system' => true,
                'is_active' => true,
                'description' => 'Pemasukan dari transaksi penjualan kasir minimarket.',
            ]
        );

        return $this->postFinancialMutation(
            account: $account,
            category: $salesCategory,
            type: FinancialTransactionType::In,
            amount: $amount,
            referenceType: Transaction::class,
            referenceId: $transaction->id,
            description: sprintf(
                'Penjualan POS %s via %s%s',
                $transaction->invoice_number,
                $payment->payment_method->label(),
                ! empty($payment->reference_number) ? " (Ref: {$payment->reference_number})" : ''
            ),
            actor: $actor,
            allowNegativeBalance: false
        );
    }

    /**
     * Mencatat pembalikan dana akibat Void transaksi POS.
     * Harus dipanggil di dalam DB::transaction() yang sama dengan PosTransactionService::void().
     */
    public function recordPosVoidReversal(
        Transaction $transaction,
        TransactionPayment $payment,
        float $netAmount,
        User $actor
    ): ?FinancialTransaction {
        $amount = round($netAmount, 2);
        if ($amount <= 0) {
            return null;
        }

        /** @var FinancialAccount|null $account */
        $account = FinancialAccount::query()
            ->where('id', $payment->financial_account_id)
            ->lockForUpdate()
            ->first();

        if (! $account instanceof FinancialAccount) {
            return null;
        }

        $refundCategory = FinancialCategory::firstOrCreate(
            ['code' => 'EXP-REFUND'],
            [
                'name' => 'Retur & Pembatalan Penjualan (POS)',
                'type' => FinancialCategoryType::Expense,
                'is_system' => true,
                'is_active' => true,
                'description' => 'Pengembalian dana untuk pembatalan (void) dan retur penjualan POS.',
            ]
        );

        return $this->postFinancialMutation(
            account: $account,
            category: $refundCategory,
            type: FinancialTransactionType::Out,
            amount: $amount,
            referenceType: Transaction::class,
            referenceId: $transaction->id,
            description: sprintf(
                'Pembalikan dana Void transaksi %s via %s',
                $transaction->invoice_number,
                $payment->payment_method->label()
            ),
            actor: $actor,
            allowNegativeBalance: true
        );
    }

    /**
     * Mencatat pengeluaran dana refund dari Retur Penjualan.
     * Harus dipanggil di dalam DB::transaction() yang sama dengan SalesReturnService::processReturn().
     */
    public function recordSalesReturnRefund(
        SalesReturn $salesReturn,
        Transaction $transaction,
        User $actor
    ): ?FinancialTransaction {
        $amount = round((float) $salesReturn->total_refund_amount, 2);
        if ($amount <= 0) {
            return null;
        }

        /** @var FinancialAccount|null $account */
        $account = FinancialAccount::query()
            ->where('id', $salesReturn->financial_account_id)
            ->where('is_active', true)
            ->lockForUpdate()
            ->first();

        if (! $account instanceof FinancialAccount) {
            throw ValidationException::withMessages([
                'financial_account_id' => 'Akun sumber pengembalian dana tidak ditemukan atau sedang nonaktif.',
            ]);
        }

        $refundCategory = FinancialCategory::firstOrCreate(
            ['code' => 'EXP-REFUND'],
            [
                'name' => 'Retur & Pembatalan Penjualan (POS)',
                'type' => FinancialCategoryType::Expense,
                'is_system' => true,
                'is_active' => true,
                'description' => 'Pengembalian dana untuk pembatalan (void) dan retur penjualan POS.',
            ]
        );

        return $this->postFinancialMutation(
            account: $account,
            category: $refundCategory,
            type: FinancialTransactionType::Out,
            amount: $amount,
            referenceType: SalesReturn::class,
            referenceId: $salesReturn->id,
            description: sprintf(
                'Refund retur %s (%s) via %s: %s',
                $salesReturn->return_number,
                $transaction->invoice_number,
                $salesReturn->refund_method->label(),
                $salesReturn->reason
            ),
            actor: $actor,
            allowNegativeBalance: $account->code === 'KAS-001' || $account->type === FinancialAccountType::Cash
        );
    }

    private function resolveLockedCashAccount(?int $accountId, bool $preferSafe): ?FinancialAccount
    {
        if ($accountId !== null) {
            /** @var FinancialAccount|null $selected */
            $selected = FinancialAccount::where('id', $accountId)
                ->where('is_active', true)
                ->lockForUpdate()
                ->first();

            if (! $selected) {
                throw ValidationException::withMessages([
                    'financial_account_id' => 'Akun keuangan yang dipilih tidak ditemukan atau sedang nonaktif.',
                ]);
            }

            return $selected;
        }

        if ($preferSafe) {
            /** @var FinancialAccount|null $safe */
            $safe = FinancialAccount::where('is_active', true)
                ->where('type', FinancialAccountType::Cash->value)
                ->orderByDesc('is_default')
                ->orderByRaw("CASE WHEN code = 'KAS-002' THEN 0 ELSE 1 END")
                ->orderBy('id')
                ->lockForUpdate()
                ->first();

            return $safe;
        }

        /** @var FinancialAccount|null $drawer */
        $drawer = FinancialAccount::where('is_active', true)
            ->where('type', FinancialAccountType::Cash->value)
            ->orderByRaw("CASE WHEN code = 'KAS-001' THEN 0 ELSE 1 END")
            ->orderByDesc('is_default')
            ->orderBy('id')
            ->lockForUpdate()
            ->first();

        return $drawer;
    }

    private function resolveLockedNonCashAccount(?int $accountId): ?FinancialAccount
    {
        if ($accountId !== null) {
            /** @var FinancialAccount|null $selected */
            $selected = FinancialAccount::where('id', $accountId)
                ->where('is_active', true)
                ->lockForUpdate()
                ->first();

            if (! $selected) {
                throw ValidationException::withMessages([
                    'non_cash_deposit_account_id' => 'Akun tujuan non-tunai tidak ditemukan atau sedang nonaktif.',
                ]);
            }

            return $selected;
        }

        /** @var FinancialAccount|null $bankAccount */
        $bankAccount = FinancialAccount::where('is_active', true)
            ->whereIn('type', [FinancialAccountType::Bank->value, FinancialAccountType::Ewallet->value])
            ->orderByDesc('is_default')
            ->orderBy('id')
            ->lockForUpdate()
            ->first();

        if ($bankAccount) {
            return $bankAccount;
        }

        return $this->resolveLockedCashAccount(null, preferSafe: true);
    }

    private function postFinancialMutation(
        FinancialAccount $account,
        FinancialCategory $category,
        FinancialTransactionType $type,
        float $amount,
        string $referenceType,
        int $referenceId,
        string $description,
        User $actor,
        bool $allowNegativeBalance
    ): FinancialTransaction {
        $balanceBefore = round((float) $account->current_balance, 2);

        if ($type === FinancialTransactionType::Out && ! $allowNegativeBalance && $balanceBefore < $amount) {
            throw ValidationException::withMessages([
                'amount' => sprintf(
                    'Saldo akun %s tidak mencukupi (Saldo tersedia: Rp %s).',
                    $account->name,
                    number_format($balanceBefore, 0, ',', '.')
                ),
            ]);
        }

        $balanceAfter = $type === FinancialTransactionType::In
            ? round($balanceBefore + $amount, 2)
            : round($balanceBefore - $amount, 2);

        $account->current_balance = $balanceAfter;
        $account->save();

        return FinancialTransaction::create([
            'financial_account_id' => $account->id,
            'financial_category_id' => $category->id,
            'type' => $type,
            'amount' => $amount,
            'balance_before' => $balanceBefore,
            'balance_after' => $balanceAfter,
            'transaction_date' => now()->toDateString(),
            'reference_type' => $referenceType,
            'reference_id' => $referenceId,
            'description' => $description,
            'created_by' => $actor->id,
        ]);
    }

    private function resolvePaymentStatus(float $totalAmount, float $paidAmount): PaymentStatus
    {
        if ($totalAmount <= 0 || $paidAmount >= $totalAmount) {
            return PaymentStatus::Paid;
        }

        if ($paidAmount > 0) {
            return PaymentStatus::Partial;
        }

        return PaymentStatus::Unpaid;
    }
}

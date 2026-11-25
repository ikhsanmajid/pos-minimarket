<?php

namespace App\Services;

use App\Enums\ActivityLogCategory;
use App\Enums\FinancialCategoryType;
use App\Enums\FinancialTransactionType;
use App\Enums\PaymentMethod;
use App\Enums\PaymentStatus;
use App\Enums\PurchaseOrderStatus;
use App\Models\AccountPayable;
use App\Models\FinancialAccount;
use App\Models\FinancialCategory;
use App\Models\FinancialTransaction;
use App\Models\PayablePayment;
use App\Models\PurchaseOrder;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class FinanceService
{
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

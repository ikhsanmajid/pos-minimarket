<?php

namespace App\Services;

use App\Enums\ActivityLogCategory;
use App\Enums\FinancialCategoryType;
use App\Enums\FinancialTransactionType;
use App\Enums\PaymentStatus;
use App\Enums\StockMovementType;
use App\Models\AccountPayable;
use App\Models\AppliedPromotion;
use App\Models\FinancialAccount;
use App\Models\FinancialCategory;
use App\Models\Product;
use App\Models\StockMovement;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class SupplierPromoClaimService
{
    public const array SETTLEMENT_METHODS = [
        'credit_note' => 'Potong Tagihan (Credit Note)',
        'free_goods' => 'Ganti Barang (Free Goods)',
        'transfer_reimburse' => 'Transfer Reimburse',
    ];

    public function __construct(public FinanceService $financeService) {}

    /**
     * Memproses pengajuan klaim atau penyelesaian (settlement) klaim promo supplier/patungan.
     *
     * @param  array<int, int>  $claimIds
     * @param  array<string, mixed>  $data
     */
    public function settleClaims(array $claimIds, array $data, User $actor): int
    {
        return DB::transaction(function () use ($claimIds, $data, $actor): int {
            $claims = AppliedPromotion::query()
                ->with(['supplier:id,name', 'transaction:id,invoice_number'])
                ->whereIn('id', $claimIds)
                ->where('supplier_discount_amount', '>', 0)
                ->lockForUpdate()
                ->get();

            if ($claims->isEmpty()) {
                throw ValidationException::withMessages([
                    'ids' => 'Tidak ada klaim promo supplier yang valid untuk diproses.',
                ]);
            }

            $action = (string) ($data['action'] ?? 'settle');
            $reference = isset($data['claim_reference']) && trim((string) $data['claim_reference']) !== ''
                ? trim((string) $data['claim_reference'])
                : null;
            $notes = isset($data['claim_notes']) && trim((string) $data['claim_notes']) !== ''
                ? trim((string) $data['claim_notes'])
                : null;

            if ($action === 'mark_claimed') {
                $pendingClaims = $claims->filter(fn (AppliedPromotion $c): bool => $c->claim_status !== 'paid');
                if ($pendingClaims->isEmpty()) {
                    throw ValidationException::withMessages([
                        'ids' => 'Semua klaim terpilih sudah berstatus Lunas.',
                    ]);
                }

                foreach ($pendingClaims as $claim) {
                    $claim->update([
                        'claim_status' => 'claimed',
                        'claimed_at' => $claim->claimed_at ?? now(),
                        'claim_reference' => $reference ?? $claim->claim_reference,
                        'claim_notes' => $notes ?? $claim->claim_notes,
                        'settled_by' => $actor->id,
                    ]);
                }

                return $pendingClaims->count();
            }

            // Action = settle (Lunas dengan salah satu dari 3 Metode Penyelesaian Supplier)
            $unsettledClaims = $claims->filter(fn (AppliedPromotion $c): bool => $c->claim_status !== 'paid')->values();
            if ($unsettledClaims->isEmpty()) {
                throw ValidationException::withMessages([
                    'ids' => 'Semua klaim terpilih sudah diselesaikan sebelumnya.',
                ]);
            }

            $method = (string) ($data['settlement_method'] ?? '');
            if (! array_key_exists($method, self::SETTLEMENT_METHODS)) {
                throw ValidationException::withMessages([
                    'settlement_method' => 'Pilih metode penyelesaian supplier yang valid.',
                ]);
            }

            $totalClaimAmount = round((float) $unsettledClaims->sum('supplier_discount_amount'), 2);
            /** @var AppliedPromotion $firstClaim */
            $firstClaim = $unsettledClaims->first();
            $supplierName = $firstClaim->supplier?->name ?? 'Supplier';

            $settledApId = null;
            $settledProductId = null;
            $settledProductQty = null;
            $settledAccountId = null;
            $settledFinTxId = null;

            if ($method === 'credit_note') {
                $apId = isset($data['account_payable_id']) && $data['account_payable_id'] !== ''
                    ? (int) $data['account_payable_id']
                    : null;

                if ($apId !== null) {
                    /** @var AccountPayable $payable */
                    $payable = AccountPayable::query()
                        ->where('id', $apId)
                        ->lockForUpdate()
                        ->firstOrFail();

                    $remaining = round((float) $payable->remaining_amount, 2);
                    if ($remaining <= 0) {
                        throw ValidationException::withMessages([
                            'account_payable_id' => "Hutang dagang {$payable->payable_number} sudah lunas.",
                        ]);
                    }

                    $creditApplied = min($totalClaimAmount, $remaining);
                    $newPaid = round((float) $payable->paid_amount + $creditApplied, 2);
                    $newRemaining = max(0.0, round((float) $payable->total_amount - $newPaid, 2));
                    $newStatus = $newRemaining <= 0 ? PaymentStatus::Paid : PaymentStatus::Partial;

                    $noteLine = sprintf(
                        '[Credit Note Promo %s] Potong tagihan Rp %s%s',
                        now()->format('d/m/Y'),
                        number_format($creditApplied, 0, ',', '.'),
                        $reference ? " (Ref: {$reference})" : ''
                    );

                    $payable->update([
                        'paid_amount' => $newPaid,
                        'remaining_amount' => $newRemaining,
                        'status' => $newStatus,
                        'notes' => trim(($payable->notes ? $payable->notes."\n" : '').$noteLine),
                    ]);

                    if ($payable->purchaseOrder !== null) {
                        $payable->purchaseOrder->update(['payment_status' => $newStatus]);
                    }

                    $settledApId = $payable->id;
                }
            } elseif ($method === 'free_goods') {
                $productId = isset($data['product_id']) ? (int) $data['product_id'] : 0;
                $qty = isset($data['product_qty']) ? (int) $data['product_qty'] : 0;

                if ($productId <= 0 || $qty < 1) {
                    throw ValidationException::withMessages([
                        'product_id' => 'Pilih produk pengganti dan jumlah unit (minimal 1) untuk metode Ganti Barang.',
                    ]);
                }

                /** @var Product $product */
                $product = Product::query()->where('id', $productId)->lockForUpdate()->firstOrFail();
                $stockBefore = (int) $product->stock;
                $stockAfter = $stockBefore + $qty;

                $product->update(['stock' => $stockAfter]);

                StockMovement::create([
                    'product_id' => $product->id,
                    'type' => StockMovementType::AdjustmentIn,
                    'reference_type' => AppliedPromotion::class,
                    'reference_id' => $firstClaim->id,
                    'stock_before' => $stockBefore,
                    'qty_change' => $qty,
                    'stock_after' => $stockAfter,
                    'unit_cost' => 0,
                    'notes' => trim(sprintf(
                        'Ganti Barang (Free Goods) klaim promo %s (%d transaksi)%s%s',
                        $supplierName,
                        $unsettledClaims->count(),
                        $reference ? " • Ref: {$reference}" : '',
                        $notes ? " • {$notes}" : ''
                    )),
                    'created_by' => $actor->id,
                ]);

                $settledProductId = $product->id;
                $settledProductQty = $qty;
            } elseif ($method === 'transfer_reimburse') {
                $accountId = isset($data['financial_account_id']) ? (int) $data['financial_account_id'] : 0;
                if ($accountId <= 0) {
                    throw ValidationException::withMessages([
                        'financial_account_id' => 'Pilih akun kas/bank penerima untuk metode Transfer Reimburse.',
                    ]);
                }

                $categoryId = isset($data['financial_category_id']) && $data['financial_category_id'] !== ''
                    ? (int) $data['financial_category_id']
                    : null;

                if ($categoryId === null) {
                    $category = FinancialCategory::query()
                        ->where('type', FinancialCategoryType::Income->value)
                        ->where('is_active', true)
                        ->whereNotIn('code', FinanceService::AUTO_SYSTEM_CATEGORY_CODES)
                        ->orderBy('id')
                        ->first();

                    if ($category === null) {
                        $category = FinancialCategory::create([
                            'code' => 'INC-CLAIM',
                            'name' => 'Reimburse Klaim Promo Supplier',
                            'type' => FinancialCategoryType::Income,
                            'is_active' => true,
                        ]);
                    }
                    $categoryId = $category->id;
                }

                $finTx = $this->financeService->recordManualTransaction([
                    'financial_account_id' => $accountId,
                    'financial_category_id' => $categoryId,
                    'type' => FinancialTransactionType::In->value,
                    'amount' => $totalClaimAmount,
                    'transaction_date' => now()->toDateString(),
                    'reference_number' => $reference,
                    'description' => trim(sprintf(
                        'Transfer Reimburse Klaim Promo %s (%d transaksi)%s',
                        $supplierName,
                        $unsettledClaims->count(),
                        $notes ? " — {$notes}" : ''
                    )),
                ], $actor);

                $settledAccountId = $accountId;
                $settledFinTxId = $finTx->id;
            }

            foreach ($unsettledClaims as $claim) {
                $claim->update([
                    'claim_status' => 'paid',
                    'settlement_method' => $method,
                    'settled_account_payable_id' => $settledApId,
                    'settled_product_id' => $settledProductId,
                    'settled_product_qty' => $settledProductQty,
                    'settled_financial_account_id' => $settledAccountId,
                    'settled_financial_transaction_id' => $settledFinTxId,
                    'settled_by' => $actor->id,
                    'claimed_at' => now(),
                    'claim_reference' => $reference,
                    'claim_notes' => $notes,
                ]);
            }

            $methodLabel = self::SETTLEMENT_METHODS[$method];
            activity(ActivityLogCategory::Finance->value)
                ->event('updated')
                ->performedOn($firstClaim)
                ->causedBy($actor)
                ->withProperties([
                    'claim_ids' => $unsettledClaims->pluck('id')->all(),
                    'supplier_name' => $supplierName,
                    'settlement_method' => $methodLabel,
                    'total_amount' => $totalClaimAmount,
                    'claim_reference' => $reference,
                    'settled_account_payable_id' => $settledApId,
                    'settled_product_id' => $settledProductId,
                    'settled_product_qty' => $settledProductQty,
                    'settled_financial_account_id' => $settledAccountId,
                ])
                ->log(sprintf(
                    'Klaim promo supplier %s (%d transaksi, Rp %s) diselesaikan via %s.',
                    $supplierName,
                    $unsettledClaims->count(),
                    number_format($totalClaimAmount, 0, ',', '.'),
                    $methodLabel
                ));

            return $unsettledClaims->count();
        });
    }
}

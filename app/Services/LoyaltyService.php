<?php

namespace App\Services;

use App\Enums\CustomerTier;
use App\Enums\PointLedgerType;
use App\Enums\TransactionStatus;
use App\Models\Customer;
use App\Models\CustomerPointLedger;
use App\Models\Product;
use App\Models\ProductMemberPrice;
use App\Models\SalesReturn;
use App\Models\Transaction;
use App\Models\TransactionDetail;
use App\Models\User;
use App\Support\PricingMath;
use Carbon\CarbonInterface;
use Illuminate\Database\Eloquent\Collection as EloquentCollection;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class LoyaltyService
{
    public const int EARN_RUPIAH_PER_POINT = 10000;

    public const int REDEEM_RUPIAH_PER_POINT = 100;

    public const float MAX_REDEEM_PERCENT = 50.0;

    public const int DEFAULT_EXPIRY_MONTHS = 12;

    /**
     * Hitung saldo poin aktif pelanggan yang belum kedaluwarsa dari ledger FIFO.
     */
    public function getActivePointBalance(Customer $customer, ?CarbonInterface $at = null): int
    {
        $now = ($at ?? now())->copy();

        return (int) CustomerPointLedger::query()
            ->where('customer_id', $customer->id)
            ->where('remaining_points', '>', 0)
            ->where(function ($q) use ($now): void {
                $q->whereNull('expires_at')
                    ->orWhere('expires_at', '>', $now);
            })
            ->sum('remaining_points');
    }

    /**
     * Sinkronkan kolom cache `customers.points` dengan total saldo poin aktif pada ledger FIFO.
     */
    public function syncCustomerPointsCache(Customer $customer, ?CarbonInterface $at = null): int
    {
        $balance = $this->getActivePointBalance($customer, $at);

        DB::table('customers')
            ->where('id', $customer->id)
            ->update(['points' => $balance]);

        $customer->points = $balance;

        return $balance;
    }

    /**
     * Selesaikan harga member aktif untuk (product, product_unit_id, customer->tier) pada Langkah 2.
     * Prioritas: harga spesifik tier pelanggan -> harga umum semua member (`tier = null`).
     *
     * @return array{
     *     member_price: int,
     *     discount_per_unit: int,
     *     tier: string|null,
     *     tier_label: string
     * }|null
     */
    public function resolveMemberPrice(
        Product $product,
        ?int $productUnitId,
        ?Customer $customer,
        int $baseUnitPrice
    ): ?array {
        if (! $customer instanceof Customer || ! $customer->is_active || $baseUnitPrice <= 0) {
            return null;
        }

        $customerTier = $customer->tier instanceof CustomerTier
            ? $customer->tier
            : CustomerTier::Silver;

        /** @var EloquentCollection<int, ProductMemberPrice> $unitMatches */
        $unitMatches = $product->activeMemberPrices
            ->filter(fn (ProductMemberPrice $mp): bool => $mp->product_unit_id === $productUnitId);

        if ($unitMatches->isEmpty()) {
            return null;
        }

        /** @var ProductMemberPrice|null $matched */
        $matched = $unitMatches->first(fn (ProductMemberPrice $mp): bool => $mp->tier === $customerTier)
            ?? $unitMatches->first(fn (ProductMemberPrice $mp): bool => $mp->tier === null);

        if (! $matched instanceof ProductMemberPrice) {
            return null;
        }

        $memberPrice = PricingMath::toRupiah($matched->member_price);
        if ($memberPrice >= $baseUnitPrice) {
            return null;
        }

        return [
            'member_price' => $memberPrice,
            'discount_per_unit' => $baseUnitPrice - $memberPrice,
            'tier' => $matched->tier?->value,
            'tier_label' => $matched->tier instanceof CustomerTier ? $matched->tier->label() : 'Semua Member',
        ];
    }

    /**
     * Cek apakah tanggal acuan (WIB) jatuh pada tanggal & bulan ulang tahun pelanggan.
     */
    public function isCustomerBirthday(?Customer $customer, CarbonInterface $at): bool
    {
        if (! $customer instanceof Customer || ! $customer->is_active || $customer->birth_date === null) {
            return false;
        }

        $tz = (string) config('pos_promotions.timezone', 'Asia/Jakarta');
        $localAt = $at->copy()->timezone($tz);

        return $customer->birth_date->month === $localAt->month
            && $customer->birth_date->day === $localAt->day;
    }

    /**
     * Cek apakah pelanggan belum pernah memiliki transaksi berstatus `completed`.
     */
    public function isCustomerFirstPurchase(?Customer $customer): bool
    {
        if (! $customer instanceof Customer || ! $customer->is_active) {
            return false;
        }

        return ! Transaction::query()
            ->where('customer_id', $customer->id)
            ->where('status', TransactionStatus::Completed->value)
            ->exists();
    }

    /**
     * Pratinjau penukaran poin (Langkah 9): 1 poin = Rp100, maks 50% dari total tagihan sebelum redeem.
     *
     * @return array{
     *     active_balance: int,
     *     max_redeemable_points: int,
     *     max_redeemable_amount: int,
     *     points_redeemed: int,
     *     points_redeem_amount: int,
     *     net_payable_after_redeem: int
     * }
     */
    public function calculateRedeemPreview(
        ?Customer $customer,
        int $requestedPoints,
        int $billTotalBeforeRedeem,
        ?CarbonInterface $at = null
    ): array {
        $safeBill = max(0, $billTotalBeforeRedeem);

        if (! $customer instanceof Customer || ! $customer->is_active || $safeBill <= 0) {
            return [
                'active_balance' => $customer instanceof Customer && $customer->is_active
                    ? $this->getActivePointBalance($customer, $at)
                    : 0,
                'max_redeemable_points' => 0,
                'max_redeemable_amount' => 0,
                'points_redeemed' => 0,
                'points_redeem_amount' => 0,
                'net_payable_after_redeem' => $safeBill,
            ];
        }

        $activeBalance = $this->getActivePointBalance($customer, $at);
        $maxAmountByPercent = PricingMath::floorRupiah($safeBill * (self::MAX_REDEEM_PERCENT / 100.0));
        $maxPointsByBill = intdiv($maxAmountByPercent, self::REDEEM_RUPIAH_PER_POINT);
        $maxRedeemablePoints = min($activeBalance, $maxPointsByBill);
        $maxRedeemableAmount = $maxRedeemablePoints * self::REDEEM_RUPIAH_PER_POINT;

        $pointsRedeemed = max(0, min($requestedPoints, $maxRedeemablePoints));
        $pointsRedeemAmount = $pointsRedeemed * self::REDEEM_RUPIAH_PER_POINT;

        return [
            'active_balance' => $activeBalance,
            'max_redeemable_points' => $maxRedeemablePoints,
            'max_redeemable_amount' => $maxRedeemableAmount,
            'points_redeemed' => $pointsRedeemed,
            'points_redeem_amount' => $pointsRedeemAmount,
            'net_payable_after_redeem' => max(0, $safeBill - $pointsRedeemAmount),
        ];
    }

    /**
     * Hitung perolehan poin (Langkah 12):
     * 1 poin per Rp10.000 dari nilai bayar bersih tanpa item excluded/donasi dan tanpa porsi redeem poin,
     * floor -> kali multiplier tier (Silver 1.0, Gold 1.5, Platinum 2.0) -> floor lagi.
     *
     * @param  array<int, array<string, mixed>>  $evaluatedItems
     */
    public function calculateEarnedPoints(
        ?Customer $customer,
        array $evaluatedItems,
        int $pointsRedeemAmount = 0
    ): int {
        if (! $customer instanceof Customer || ! $customer->is_active) {
            return 0;
        }

        $eligibleNetTotal = 0;
        foreach ($evaluatedItems as $line) {
            if (($line['is_promo_excluded'] ?? false) || ($line['is_donation'] ?? false)) {
                continue;
            }

            $eligibleNetTotal += max(0, (int) ($line['line_net_after_header'] ?? $line['line_subtotal'] ?? 0));
        }

        $earnBaseAmount = max(0, $eligibleNetTotal - max(0, $pointsRedeemAmount));
        if ($earnBaseAmount < self::EARN_RUPIAH_PER_POINT) {
            return 0;
        }

        $basePoints = intdiv($earnBaseAmount, self::EARN_RUPIAH_PER_POINT);
        $tier = $customer->tier instanceof CustomerTier ? $customer->tier : CustomerTier::Silver;
        $multiplier = $tier->multiplier();

        return (int) floor(($basePoints * $multiplier) + 1e-9);
    }

    /**
     * Konsumsi poin pelanggan secara FIFO (urut expires_at ASC, abaikan poin kedaluwarsa).
     */
    public function redeemPointsFifo(
        Customer $customer,
        int $pointsToRedeem,
        Transaction $transaction,
        User $actor,
        ?CarbonInterface $at = null
    ): CustomerPointLedger {
        if ($pointsToRedeem <= 0) {
            throw ValidationException::withMessages([
                'redeem_points' => 'Jumlah poin yang ditukar harus lebih besar dari 0.',
            ]);
        }

        $now = ($at ?? now())->copy();

        /** @var Customer $lockedCustomer */
        $lockedCustomer = Customer::query()
            ->where('id', $customer->id)
            ->lockForUpdate()
            ->firstOrFail();

        /** @var EloquentCollection<int, CustomerPointLedger> $activeLots */
        $activeLots = CustomerPointLedger::query()
            ->where('customer_id', $lockedCustomer->id)
            ->where('remaining_points', '>', 0)
            ->where(function ($q) use ($now): void {
                $q->whereNull('expires_at')
                    ->orWhere('expires_at', '>', $now);
            })
            ->orderByRaw('CASE WHEN expires_at IS NULL THEN 1 ELSE 0 END ASC')
            ->orderBy('expires_at')
            ->orderBy('id')
            ->lockForUpdate()
            ->get();

        $totalAvailable = (int) $activeLots->sum('remaining_points');
        if ($totalAvailable < $pointsToRedeem) {
            throw ValidationException::withMessages([
                'redeem_points' => sprintf(
                    'Saldo poin aktif tidak mencukupi (tersedia: %d poin, diminta: %d poin).',
                    $totalAvailable,
                    $pointsToRedeem
                ),
            ]);
        }

        $remainingToDeduct = $pointsToRedeem;
        foreach ($activeLots as $lot) {
            if ($remainingToDeduct <= 0) {
                break;
            }

            $take = min($remainingToDeduct, (int) $lot->remaining_points);
            if ($take > 0) {
                $lot->remaining_points = (int) $lot->remaining_points - $take;
                $lot->save();
                $remainingToDeduct -= $take;
            }
        }

        $ledger = CustomerPointLedger::create([
            'customer_id' => $lockedCustomer->id,
            'transaction_id' => $transaction->id,
            'sales_return_id' => null,
            'type' => PointLedgerType::Redeem,
            'points' => -$pointsToRedeem,
            'remaining_points' => 0,
            'expires_at' => null,
            'description' => sprintf(
                'Penukaran %d poin (Rp %s) pada transaksi %s.',
                $pointsToRedeem,
                number_format($pointsToRedeem * self::REDEEM_RUPIAH_PER_POINT, 0, ',', '.'),
                $transaction->invoice_number
            ),
            'created_by' => $actor->id,
        ]);

        $this->syncCustomerPointsCache($lockedCustomer, $now);

        return $ledger;
    }

    /**
     * Berikan poin hasil transaksi dengan masa berlaku +12 bulan.
     */
    public function earnPoints(
        Customer $customer,
        int $points,
        Transaction $transaction,
        User $actor,
        ?CarbonInterface $at = null
    ): ?CustomerPointLedger {
        if ($points <= 0) {
            return null;
        }

        $now = ($at ?? now())->copy();

        $ledger = CustomerPointLedger::create([
            'customer_id' => $customer->id,
            'transaction_id' => $transaction->id,
            'sales_return_id' => null,
            'type' => PointLedgerType::Earn,
            'points' => $points,
            'remaining_points' => $points,
            'expires_at' => $now->copy()->addMonths(self::DEFAULT_EXPIRY_MONTHS),
            'description' => sprintf(
                'Perolehan %d poin dari transaksi %s.',
                $points,
                $transaction->invoice_number
            ),
            'created_by' => $actor->id,
        ]);

        $this->syncCustomerPointsCache($customer, $now);

        return $ledger;
    }

    /**
     * Rollback poin saat transaksi di-void:
     * - Tarik kembali `points_earned` (`void_reversal` negatif)
     * - Kembalikan `points_redeemed` ke saldo pelanggan (`void_reversal` positif)
     */
    public function reverseForVoid(
        Transaction $transaction,
        User $actor,
        ?CarbonInterface $at = null
    ): void {
        if ($transaction->customer_id === null) {
            return;
        }

        $pointsEarned = (int) $transaction->points_earned;
        $pointsRedeemed = (int) $transaction->points_redeemed;

        if ($pointsEarned <= 0 && $pointsRedeemed <= 0) {
            return;
        }

        $now = ($at ?? now())->copy();

        /** @var Customer|null $customer */
        $customer = Customer::withTrashed()
            ->where('id', $transaction->customer_id)
            ->lockForUpdate()
            ->first();

        if (! $customer instanceof Customer) {
            return;
        }

        // 1. Tarik kembali poin yang diperoleh dari transaksi ini
        if ($pointsEarned > 0) {
            $this->deductFromTransactionOrFifo($customer, $transaction->id, $pointsEarned, $now);

            CustomerPointLedger::create([
                'customer_id' => $customer->id,
                'transaction_id' => $transaction->id,
                'sales_return_id' => null,
                'type' => PointLedgerType::VoidReversal,
                'points' => -$pointsEarned,
                'remaining_points' => 0,
                'expires_at' => null,
                'description' => sprintf(
                    'Penarikan %d poin perolehan karena void transaksi %s.',
                    $pointsEarned,
                    $transaction->invoice_number
                ),
                'created_by' => $actor->id,
            ]);
        }

        // 2. Kembalikan poin yang sempat ditukar pada transaksi ini
        if ($pointsRedeemed > 0) {
            CustomerPointLedger::create([
                'customer_id' => $customer->id,
                'transaction_id' => $transaction->id,
                'sales_return_id' => null,
                'type' => PointLedgerType::VoidReversal,
                'points' => $pointsRedeemed,
                'remaining_points' => $pointsRedeemed,
                'expires_at' => $now->copy()->addMonths(self::DEFAULT_EXPIRY_MONTHS),
                'description' => sprintf(
                    'Pengembalian %d poin penukaran karena void transaksi %s.',
                    $pointsRedeemed,
                    $transaction->invoice_number
                ),
                'created_by' => $actor->id,
            ]);
        }

        $this->syncCustomerPointsCache($customer, $now);
    }

    /**
     * Tarik kembali poin secara proporsional terhadap nilai item eligible yang diretur (`return_reversal`).
     *
     * @param  array<int, array{detail: TransactionDetail, qty: int, subtotal_refund: float}>  $returnedItems
     */
    public function reverseForSalesReturn(
        Transaction $transaction,
        SalesReturn $salesReturn,
        array $returnedItems,
        bool $allFullyReturned,
        User $actor,
        ?CarbonInterface $at = null
    ): int {
        if ($transaction->customer_id === null || (int) $transaction->points_earned <= 0) {
            return 0;
        }

        $now = ($at ?? now())->copy();
        $transaction->loadMissing('details');

        // Hitung total nilai bersih item eligible pada transaksi asal
        $totalEligibleNet = 0;
        foreach ($transaction->details as $detail) {
            if ($detail->is_promo_excluded || $detail->is_donation) {
                continue;
            }

            $lineNet = max(0, PricingMath::toRupiah($detail->subtotal) - PricingMath::toRupiah($detail->allocated_header_discount));
            $totalEligibleNet += $lineNet;
        }

        if ($totalEligibleNet <= 0) {
            return 0;
        }

        // Hitung nilai bersih item eligible yang diretur pada retur ini
        $returnedEligibleNet = 0;
        foreach ($returnedItems as $item) {
            /** @var TransactionDetail $detail */
            $detail = $item['detail'];
            if ($detail->is_promo_excluded || $detail->is_donation) {
                continue;
            }

            $purchasedQty = $detail->qty > 0 ? $detail->qty : max(1, (int) $detail->quantity);
            $lineNet = max(0, PricingMath::toRupiah($detail->subtotal) - PricingMath::toRupiah($detail->allocated_header_discount));
            $returnedEligibleNet += PricingMath::floorRupiah(($lineNet * $item['qty']) / $purchasedQty);
        }

        if ($returnedEligibleNet <= 0) {
            return 0;
        }

        // Hitung sisa poin earned yang belum pernah ditarik sebelumnya
        $alreadyReversed = (int) abs((int) CustomerPointLedger::query()
            ->where('transaction_id', $transaction->id)
            ->where('type', PointLedgerType::ReturnReversal->value)
            ->sum('points'));

        $remainingReversible = max(0, (int) $transaction->points_earned - $alreadyReversed);
        if ($remainingReversible <= 0) {
            return 0;
        }

        if ($allFullyReturned) {
            $pointsToReverse = $remainingReversible;
        } else {
            $proportional = (int) floor((((int) $transaction->points_earned) * $returnedEligibleNet) / $totalEligibleNet);
            $pointsToReverse = min($remainingReversible, max(0, $proportional));
        }

        if ($pointsToReverse <= 0) {
            return 0;
        }

        /** @var Customer|null $customer */
        $customer = Customer::withTrashed()
            ->where('id', $transaction->customer_id)
            ->lockForUpdate()
            ->first();

        if (! $customer instanceof Customer) {
            return 0;
        }

        $this->deductFromTransactionOrFifo($customer, $transaction->id, $pointsToReverse, $now);

        CustomerPointLedger::create([
            'customer_id' => $customer->id,
            'transaction_id' => $transaction->id,
            'sales_return_id' => $salesReturn->id,
            'type' => PointLedgerType::ReturnReversal,
            'points' => -$pointsToReverse,
            'remaining_points' => 0,
            'expires_at' => null,
            'description' => sprintf(
                'Penarikan %d poin proporsional dari retur %s (%s).',
                $pointsToReverse,
                $salesReturn->return_number,
                $transaction->invoice_number
            ),
            'created_by' => $actor->id,
        ]);

        $this->syncCustomerPointsCache($customer, $now);

        return $pointsToReverse;
    }

    /**
     * Penyesuaian poin manual (misalnya saldo awal atau koreksi admin) agar ledger FIFO selalu sinkron.
     */
    public function adjustPoints(
        Customer $customer,
        int $deltaPoints,
        string $description,
        User $actor,
        ?CarbonInterface $at = null
    ): ?CustomerPointLedger {
        if ($deltaPoints === 0) {
            return null;
        }

        $now = ($at ?? now())->copy();

        if ($deltaPoints > 0) {
            $ledger = CustomerPointLedger::create([
                'customer_id' => $customer->id,
                'transaction_id' => null,
                'sales_return_id' => null,
                'type' => PointLedgerType::Adjustment,
                'points' => $deltaPoints,
                'remaining_points' => $deltaPoints,
                'expires_at' => $now->copy()->addMonths(self::DEFAULT_EXPIRY_MONTHS),
                'description' => $description,
                'created_by' => $actor->id,
            ]);
        } else {
            $deduct = abs($deltaPoints);
            $this->deductFromTransactionOrFifo($customer, null, $deduct, $now);

            $ledger = CustomerPointLedger::create([
                'customer_id' => $customer->id,
                'transaction_id' => null,
                'sales_return_id' => null,
                'type' => PointLedgerType::Adjustment,
                'points' => -$deduct,
                'remaining_points' => 0,
                'expires_at' => null,
                'description' => $description,
                'created_by' => $actor->id,
            ]);
        }

        $this->syncCustomerPointsCache($customer, $now);

        return $ledger;
    }

    /**
     * Kurangi `remaining_points` dimulai dari lot transaksi asal (jika ada), lalu lot aktif FIFO lainnya.
     */
    private function deductFromTransactionOrFifo(
        Customer $customer,
        ?int $transactionId,
        int $pointsToDeduct,
        CarbonInterface $now
    ): void {
        $remaining = $pointsToDeduct;

        if ($transactionId !== null) {
            /** @var EloquentCollection<int, CustomerPointLedger> $txLots */
            $txLots = CustomerPointLedger::query()
                ->where('customer_id', $customer->id)
                ->where('transaction_id', $transactionId)
                ->where('remaining_points', '>', 0)
                ->orderBy('id')
                ->lockForUpdate()
                ->get();

            foreach ($txLots as $lot) {
                if ($remaining <= 0) {
                    break;
                }
                $take = min($remaining, (int) $lot->remaining_points);
                if ($take > 0) {
                    $lot->remaining_points = (int) $lot->remaining_points - $take;
                    $lot->save();
                    $remaining -= $take;
                }
            }
        }

        if ($remaining <= 0) {
            return;
        }

        /** @var EloquentCollection<int, CustomerPointLedger> $otherLots */
        $otherLots = CustomerPointLedger::query()
            ->where('customer_id', $customer->id)
            ->where('remaining_points', '>', 0)
            ->where(function ($q) use ($now): void {
                $q->whereNull('expires_at')
                    ->orWhere('expires_at', '>', $now);
            })
            ->orderByRaw('CASE WHEN expires_at IS NULL THEN 1 ELSE 0 END ASC')
            ->orderBy('expires_at')
            ->orderBy('id')
            ->lockForUpdate()
            ->get();

        foreach ($otherLots as $lot) {
            if ($remaining <= 0) {
                break;
            }
            $take = min($remaining, (int) $lot->remaining_points);
            if ($take > 0) {
                $lot->remaining_points = (int) $lot->remaining_points - $take;
                $lot->save();
                $remaining -= $take;
            }
        }
    }
}

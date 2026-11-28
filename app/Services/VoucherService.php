<?php

namespace App\Services;

use App\Enums\PromotionFunding;
use App\Enums\VoucherErrorCode;
use App\Enums\VoucherRedemptionStatus;
use App\Enums\VoucherStatus;
use App\Enums\VoucherType;
use App\Models\Customer;
use App\Models\Product;
use App\Models\Transaction;
use App\Models\User;
use App\Models\Voucher;
use App\Models\VoucherRedemption;
use App\Support\PricingMath;
use Carbon\CarbonInterface;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class VoucherService
{
    /**
     * Karakter tanpa ambiguitas (tanpa 0/O, 1/I/L).
     */
    private const string CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

    /**
     * TTL reservasi voucher saat dipasang di keranjang kasir (menit).
     */
    public const int RESERVATION_TTL_MINUTES = 15;

    /**
     * Batas percobaan kode voucher gagal per menit per kasir/perangkat.
     */
    public const int FAILED_ATTEMPT_LIMIT = 5;

    public const int FAILED_ATTEMPT_DECAY_SECONDS = 60;

    /**
     * Normalisasi kode voucher: trim, uppercase, hapus seluruh spasi.
     */
    public function normalizeCode(?string $code): string
    {
        if ($code === null) {
            return '';
        }

        return strtoupper(preg_replace('/\s+/', '', trim($code)) ?? '');
    }

    /**
     * Validasi format kode voucher (4–32 karakter alfanumerik / tanda hubung).
     */
    public function isValidFormat(string $normalizedCode): bool
    {
        if ($normalizedCode === '') {
            return false;
        }

        return preg_match('/^[A-Z0-9][A-Z0-9-]{2,30}[A-Z0-9]$/', $normalizedCode) === 1;
    }

    /**
     * Generator kode acak 6–12 karakter tanpa karakter ambigu (0/O, 1/I/L).
     */
    public function generateSingleCode(int $length = 8): string
    {
        $safeLength = max(6, min(12, $length));
        $alphabetLength = strlen(self::CODE_ALPHABET);

        for ($attempt = 0; $attempt < 25; $attempt++) {
            $code = '';
            for ($i = 0; $i < $safeLength; $i++) {
                $code .= self::CODE_ALPHABET[random_int(0, $alphabetLength - 1)];
            }

            if (! Voucher::query()->where('code', $code)->exists()) {
                return $code;
            }
        }

        return strtoupper(Str::random($safeLength));
    }

    /**
     * Generator kode massal berformat PREFIX-XXXX-XXXX dengan digit checksum pada karakter terakhir.
     */
    public function generateBulkCode(string $prefix): string
    {
        $cleanPrefix = strtoupper(preg_replace('/[^A-Z0-9]/', '', trim($prefix)) ?? '');
        if ($cleanPrefix === '') {
            $cleanPrefix = 'VCH';
        }
        $cleanPrefix = substr($cleanPrefix, 0, 12);

        $alphabetLength = strlen(self::CODE_ALPHABET);
        $part1 = '';
        for ($i = 0; $i < 4; $i++) {
            $part1 .= self::CODE_ALPHABET[random_int(0, $alphabetLength - 1)];
        }

        $part2Body = '';
        for ($i = 0; $i < 3; $i++) {
            $part2Body .= self::CODE_ALPHABET[random_int(0, $alphabetLength - 1)];
        }

        $checksum = $this->computeChecksumChar($cleanPrefix.$part1.$part2Body);

        return "{$cleanPrefix}-{$part1}-{$part2Body}{$checksum}";
    }

    /**
     * Verifikasi karakter checksum untuk kode massal PREFIX-XXXX-XXXX.
     */
    public function verifyBulkChecksum(string $code): bool
    {
        $normalized = $this->normalizeCode($code);
        $parts = explode('-', $normalized);
        if (count($parts) !== 3 || strlen($parts[1]) !== 4 || strlen($parts[2]) !== 4) {
            return false;
        }

        $payload = $parts[0].$parts[1].substr($parts[2], 0, 3);
        $expected = $this->computeChecksumChar($payload);

        return $parts[2][3] === $expected;
    }

    private function computeChecksumChar(string $payload): string
    {
        $alphabetLength = strlen(self::CODE_ALPHABET);
        $sum = 0;
        $len = strlen($payload);

        for ($i = 0; $i < $len; $i++) {
            $pos = strpos(self::CODE_ALPHABET, $payload[$i]);
            $val = $pos !== false ? $pos : (ord($payload[$i]) % $alphabetLength);
            $weight = ($i % 2 === 0) ? 3 : 7;
            $sum += $val * $weight;
        }

        return self::CODE_ALPHABET[$sum % $alphabetLength];
    }

    /**
     * Kunci rate limiter percobaan voucher gagal per kasir/perangkat.
     */
    public function rateLimitKey(int $cashierId, ?string $deviceKey = null): string
    {
        $suffix = $deviceKey !== null && trim($deviceKey) !== ''
            ? ':'.substr(sha1(trim($deviceKey)), 0, 12)
            : '';

        return "voucher-attempt:{$cashierId}{$suffix}";
    }

    public function isRateLimited(int $cashierId, ?string $deviceKey = null): bool
    {
        return RateLimiter::tooManyAttempts(
            $this->rateLimitKey($cashierId, $deviceKey),
            self::FAILED_ATTEMPT_LIMIT
        );
    }

    public function rateLimitAvailableIn(int $cashierId, ?string $deviceKey = null): int
    {
        return RateLimiter::availableIn($this->rateLimitKey($cashierId, $deviceKey));
    }

    public function recordFailedAttempt(int $cashierId, ?string $deviceKey = null): void
    {
        RateLimiter::hit(
            $this->rateLimitKey($cashierId, $deviceKey),
            self::FAILED_ATTEMPT_DECAY_SECONDS
        );
    }

    /**
     * Ringkasan 4 kartu KPI Voucher (kompatibel PostgreSQL & SQLite).
     *
     * @return array{
     *     total_vouchers: int,
     *     active_vouchers: int,
     *     total_redemptions: int,
     *     expired_or_exhausted: int
     * }
     */
    public function getSummary(?CarbonInterface $at = null): array
    {
        $now = ($at ?? now())->toDateTimeString();

        $row = Voucher::query()
            ->selectRaw(
                'COUNT(*) as total_vouchers,
                SUM(CASE WHEN status = ? AND valid_from <= ? AND valid_until >= ? AND (total_quota IS NULL OR used_count < total_quota) THEN 1 ELSE 0 END) as active_vouchers,
                COALESCE(SUM(used_count), 0) as total_redemptions,
                SUM(CASE WHEN status IN (?, ?) OR valid_until < ? OR (total_quota IS NOT NULL AND used_count >= total_quota) THEN 1 ELSE 0 END) as expired_or_exhausted',
                [
                    VoucherStatus::Active->value,
                    $now,
                    $now,
                    VoucherStatus::Expired->value,
                    VoucherStatus::Exhausted->value,
                    $now,
                ]
            )
            ->first();

        return [
            'total_vouchers' => (int) ($row->total_vouchers ?? 0),
            'active_vouchers' => (int) ($row->active_vouchers ?? 0),
            'total_redemptions' => (int) ($row->total_redemptions ?? 0),
            'expired_or_exhausted' => (int) ($row->expired_or_exhausted ?? 0),
        ];
    }

    /**
     * Buat satu voucher baru.
     *
     * @param  array<string, mixed>  $data
     */
    public function create(array $data, User $actor): Voucher
    {
        return DB::transaction(function () use ($data, $actor): Voucher {
            $payload = $this->normalizePayload($data);
            $payload['created_by'] = $actor->id;

            return Voucher::create($payload);
        });
    }

    /**
     * Perbarui voucher yang ada.
     *
     * @param  array<string, mixed>  $data
     */
    public function update(Voucher $voucher, array $data): Voucher
    {
        return DB::transaction(function () use ($voucher, $data): Voucher {
            $payload = $this->normalizePayload($data);
            $voucher->update($payload);

            return $voucher->fresh() ?? $voucher;
        });
    }

    /**
     * Hapus voucher.
     */
    public function delete(Voucher $voucher): void
    {
        DB::transaction(function () use ($voucher): void {
            $voucher->delete();
        });
    }

    /**
     * Generate voucher massal dengan format PREFIX-XXXX-XXXX + checksum.
     *
     * @param  array<string, mixed>  $templateData
     * @return array<int, Voucher>
     */
    public function generateBulk(string $prefix, int $count, array $templateData, User $actor): array
    {
        $safeCount = max(1, min(500, $count));

        return DB::transaction(function () use ($prefix, $safeCount, $templateData, $actor): array {
            $created = [];
            $basePayload = $this->normalizePayload(array_merge($templateData, [
                'code' => 'PLACEHOLDER',
            ]));
            $basePayload['created_by'] = $actor->id;

            $generatedCodes = [];
            for ($i = 0; $i < $safeCount; $i++) {
                $code = '';
                for ($attempt = 0; $attempt < 30; $attempt++) {
                    $candidate = $this->generateBulkCode($prefix);
                    if (! isset($generatedCodes[$candidate]) && ! Voucher::query()->where('code', $candidate)->exists()) {
                        $code = $candidate;
                        $generatedCodes[$candidate] = true;
                        break;
                    }
                }

                if ($code === '') {
                    throw ValidationException::withMessages([
                        'prefix' => 'Gagal menghasilkan kode voucher unik. Coba gunakan prefix lain.',
                    ]);
                }

                $payload = $basePayload;
                $payload['code'] = $code;
                $created[] = Voucher::create($payload);
            }

            return $created;
        });
    }

    /**
     * Evaluasi voucher terhadap baris keranjang POS sesuai 11 urutan validasi ketat.
     *
     * @param  array<int, array{
     *     index: int,
     *     product: Product,
     *     product_id: int,
     *     qty: int|float,
     *     base_unit_price: int,
     *     line_gross: int,
     *     auto_discount_amount: int,
     *     line_subtotal: int,
     *     is_promo_excluded: bool
     * }>  $evaluatedLines
     * @return array{
     *     valid: bool,
     *     voucher: Voucher|null,
     *     normalized_code: string,
     *     discount_amount: int,
     *     eligible_line_amounts: array<int, int>,
     *     eligible_subtotal_after_auto: int,
     *     error_code: VoucherErrorCode|null,
     *     message: string|null
     * }
     */
    public function evaluateVoucherForLines(
        string $rawCode,
        array $evaluatedLines,
        ?int $customerId = null,
        ?CarbonInterface $at = null,
        ?string $reservationToken = null,
        ?int $storeId = null,
        string $channel = 'pos',
        bool $hasOtherVoucher = false
    ): array {
        $referenceAt = ($at ?? now())->copy();
        $normalizedCode = $this->normalizeCode($rawCode);

        // 1. VOUCHER_INVALID_FORMAT
        if (! $this->isValidFormat($normalizedCode)) {
            return $this->failResult(VoucherErrorCode::VoucherInvalidFormat, $normalizedCode);
        }

        // 2. VOUCHER_NOT_FOUND
        /** @var Voucher|null $voucher */
        $voucher = Voucher::query()->where('code', $normalizedCode)->first();
        if (! $voucher instanceof Voucher) {
            return $this->failResult(VoucherErrorCode::VoucherNotFound, $normalizedCode);
        }

        // 3. VOUCHER_INACTIVE (draft / paused)
        if (in_array($voucher->status, [VoucherStatus::Draft, VoucherStatus::Paused], true)) {
            return $this->failResult(
                VoucherErrorCode::VoucherInactive,
                $normalizedCode,
                "Voucher {$voucher->code} sedang berstatus {$voucher->status->label()} dan tidak dapat digunakan."
            );
        }

        // 4. VOUCHER_NOT_YET_VALID / VOUCHER_EXPIRED (termasuk allowed_days & allowed_hours WIB)
        if ($referenceAt->lt($voucher->valid_from)) {
            $tz = (string) config('pos_promotions.timezone', 'Asia/Jakarta');
            $startLabel = $voucher->valid_from->copy()->timezone($tz)->format('d M Y H:i');

            return $this->failResult(
                VoucherErrorCode::VoucherNotYetValid,
                $normalizedCode,
                "Voucher {$voucher->code} baru berlaku mulai {$startLabel} WIB."
            );
        }

        if ($voucher->status === VoucherStatus::Expired || $referenceAt->gt($voucher->valid_until)) {
            return $this->failResult(
                VoucherErrorCode::VoucherExpired,
                $normalizedCode,
                "Voucher {$voucher->code} sudah kedaluwarsa."
            );
        }

        if (! $voucher->isWithinAllowedDayAndHours($referenceAt)) {
            return $this->failResult(
                VoucherErrorCode::VoucherExpired,
                $normalizedCode,
                "Voucher {$voucher->code} tidak berlaku pada hari atau jam saat ini (WIB)."
            );
        }

        // 5. VOUCHER_STORE_NOT_ALLOWED
        $voucherChannel = strtolower(trim($voucher->channel ?: 'pos'));
        if ($voucherChannel !== 'all' && $voucherChannel !== strtolower(trim($channel))) {
            return $this->failResult(
                VoucherErrorCode::VoucherStoreNotAllowed,
                $normalizedCode,
                "Voucher {$voucher->code} tidak berlaku untuk kanal {$channel}."
            );
        }

        if (is_array($voucher->store_ids) && count($voucher->store_ids) > 0) {
            $currentStoreId = $storeId ?? (int) config('pos_promotions.store_id', 1);
            $allowedStoreIds = array_map(fn (int|string $id): int => (int) $id, $voucher->store_ids);

            if (! in_array($currentStoreId, $allowedStoreIds, true)) {
                return $this->failResult(
                    VoucherErrorCode::VoucherStoreNotAllowed,
                    $normalizedCode,
                    "Voucher {$voucher->code} tidak berlaku di cabang/toko ini."
                );
            }
        }

        // 6. VOUCHER_QUOTA_EXHAUSTED (total_quota & per_day_limit, memperhitungkan reservasi aktif lain)
        $activeOtherReservations = VoucherRedemption::query()
            ->where('voucher_id', $voucher->id)
            ->where('status', VoucherRedemptionStatus::Reserved->value)
            ->where('reserved_until', '>', $referenceAt)
            ->when(
                $reservationToken !== null && trim($reservationToken) !== '',
                fn ($q) => $q->where('reservation_token', '!=', trim($reservationToken))
            )
            ->count();

        if ($voucher->status === VoucherStatus::Exhausted) {
            return $this->failResult(VoucherErrorCode::VoucherQuotaExhausted, $normalizedCode);
        }

        if ($voucher->total_quota !== null && ($voucher->used_count + $activeOtherReservations) >= $voucher->total_quota) {
            return $this->failResult(
                VoucherErrorCode::VoucherQuotaExhausted,
                $normalizedCode,
                "Kuota voucher {$voucher->code} sudah habis."
            );
        }

        if ($voucher->per_day_limit !== null) {
            $tz = (string) config('pos_promotions.timezone', 'Asia/Jakarta');
            $dayStartUtc = $referenceAt->copy()->timezone($tz)->startOfDay()->utc();
            $dayEndUtc = $referenceAt->copy()->timezone($tz)->endOfDay()->utc();

            $usedToday = VoucherRedemption::query()
                ->where('voucher_id', $voucher->id)
                ->where(function ($q) use ($dayStartUtc, $dayEndUtc, $referenceAt, $reservationToken): void {
                    $q->where(function ($sub) use ($dayStartUtc, $dayEndUtc): void {
                        $sub->where('status', VoucherRedemptionStatus::Redeemed->value)
                            ->whereBetween('redeemed_at', [$dayStartUtc, $dayEndUtc]);
                    })->orWhere(function ($sub) use ($referenceAt, $reservationToken): void {
                        $sub->where('status', VoucherRedemptionStatus::Reserved->value)
                            ->where('reserved_until', '>', $referenceAt)
                            ->when(
                                $reservationToken !== null && trim($reservationToken) !== '',
                                fn ($inner) => $inner->where('reservation_token', '!=', trim($reservationToken))
                            );
                    });
                })
                ->count();

            if ($usedToday >= $voucher->per_day_limit) {
                return $this->failResult(
                    VoucherErrorCode::VoucherQuotaExhausted,
                    $normalizedCode,
                    "Batas penggunaan harian voucher {$voucher->code} sudah tercapai."
                );
            }
        }

        // 7. VOUCHER_CUSTOMER_LIMIT
        if ($voucher->per_customer_limit !== null && $customerId !== null) {
            $customerUsed = VoucherRedemption::query()
                ->where('voucher_id', $voucher->id)
                ->where('customer_id', $customerId)
                ->where(function ($q) use ($referenceAt, $reservationToken): void {
                    $q->where('status', VoucherRedemptionStatus::Redeemed->value)
                        ->orWhere(function ($sub) use ($referenceAt, $reservationToken): void {
                            $sub->where('status', VoucherRedemptionStatus::Reserved->value)
                                ->where('reserved_until', '>', $referenceAt)
                                ->when(
                                    $reservationToken !== null && trim($reservationToken) !== '',
                                    fn ($inner) => $inner->where('reservation_token', '!=', trim($reservationToken))
                                );
                        });
                })
                ->count();

            if ($customerUsed >= $voucher->per_customer_limit) {
                return $this->failResult(
                    VoucherErrorCode::VoucherCustomerLimit,
                    $normalizedCode,
                    "Pelanggan ini sudah mencapai batas penggunaan voucher {$voucher->code} (maks. {$voucher->per_customer_limit}x)."
                );
            }
        }

        // 8. VOUCHER_MEMBER_ONLY
        if ($voucher->member_only) {
            $isActiveMember = $customerId !== null && Customer::query()
                ->where('id', $customerId)
                ->where('is_active', true)
                ->exists();

            if (! $isActiveMember) {
                return $this->failResult(
                    VoucherErrorCode::VoucherMemberOnly,
                    $normalizedCode,
                    "Voucher {$voucher->code} khusus untuk pelanggan member terdaftar."
                );
            }
        }

        // Hitung item eligible (tanpa item excluded, sesuai applicable/excluded SKU & kategori)
        $isProductVoucher = in_array($voucher->type, [VoucherType::ProductSpecific, VoucherType::FreeItem], true)
            || ! empty($voucher->applicable_skus)
            || ! empty($voucher->applicable_categories);

        $eligibleLineAmounts = [];
        $eligibleSubtotalAfterAuto = 0;
        $nonExcludedSubtotalAfterAuto = 0;
        $hasAutoPromo = false;
        $freeItemCandidateLine = null;

        foreach ($evaluatedLines as $index => $line) {
            if ($line['auto_discount_amount'] > 0) {
                $hasAutoPromo = true;
            }

            if ($line['is_promo_excluded']) {
                continue;
            }

            // Item yang terkena promo near_expiry tidak diikutkan dalam voucher produk
            if ($isProductVoucher && ($line['is_near_expiry_promo'] ?? false)) {
                continue;
            }

            $afterAuto = max(0, $line['line_gross'] - $line['auto_discount_amount']);
            $nonExcludedSubtotalAfterAuto += $afterAuto;

            if ($voucher->type === VoucherType::FreeItem) {
                if ($voucher->free_product_id !== null && $line['product_id'] === $voucher->free_product_id && $line['line_subtotal'] > 0) {
                    $freeItemCandidateLine = $line;
                }

                if ($this->isProductEligibleForVoucher($voucher, $line['product'])) {
                    $eligibleSubtotalAfterAuto += $afterAuto;
                    if ($line['line_subtotal'] > 0) {
                        $eligibleLineAmounts[$index] = $line['line_subtotal'];
                    }
                }

                continue;
            }

            if (! $this->isProductEligibleForVoucher($voucher, $line['product'])) {
                continue;
            }

            $eligibleSubtotalAfterAuto += $afterAuto;
            if ($line['line_subtotal'] > 0) {
                $eligibleLineAmounts[$index] = $line['line_subtotal'];
            }
        }

        // 9. VOUCHER_MIN_SPEND_NOT_MET (hanya item eligible, setelah diskon otomatis item, tanpa item excluded)
        $minSpend = PricingMath::toRupiah($voucher->min_spend);
        $spendBasis = $voucher->type === VoucherType::FreeItem
            ? $nonExcludedSubtotalAfterAuto
            : $eligibleSubtotalAfterAuto;

        if ($minSpend > 0 && $spendBasis < $minSpend) {
            return $this->failResult(
                VoucherErrorCode::VoucherMinSpendNotMet,
                $normalizedCode,
                sprintf(
                    'Minimal belanja produk eligible untuk voucher %s adalah Rp %s (saat ini Rp %s).',
                    $voucher->code,
                    number_format($minSpend, 0, ',', '.'),
                    number_format($spendBasis, 0, ',', '.')
                )
            );
        }

        // 10. VOUCHER_NO_ELIGIBLE_ITEM
        if ($voucher->type === VoucherType::FreeItem) {
            if ($voucher->free_product_id !== null && $freeItemCandidateLine === null) {
                return $this->failResult(
                    VoucherErrorCode::VoucherNoEligibleItem,
                    $normalizedCode,
                    "Produk gratis untuk voucher {$voucher->code} belum ada di keranjang."
                );
            }

            if ($voucher->free_product_id === null && empty($eligibleLineAmounts)) {
                return $this->failResult(VoucherErrorCode::VoucherNoEligibleItem, $normalizedCode);
            }
        } elseif (empty($eligibleLineAmounts) || array_sum($eligibleLineAmounts) <= 0) {
            return $this->failResult(
                VoucherErrorCode::VoucherNoEligibleItem,
                $normalizedCode,
                "Tidak ada produk yang memenuhi syarat untuk voucher {$voucher->code}."
            );
        }

        // 11. VOUCHER_NOT_STACKABLE
        if (! $voucher->stackable_with_promo && $hasAutoPromo) {
            return $this->failResult(
                VoucherErrorCode::VoucherNotStackable,
                $normalizedCode,
                "Voucher {$voucher->code} tidak dapat digabung dengan promo otomatis atau harga grosir."
            );
        }

        if ($hasOtherVoucher && ! $voucher->stackable_with_voucher) {
            return $this->failResult(
                VoucherErrorCode::VoucherNotStackable,
                $normalizedCode,
                "Voucher {$voucher->code} tidak dapat digabung dengan voucher lain dalam satu transaksi."
            );
        }

        // Hitung nominal diskon voucher (dibatasi sisa nilai baris eligible & total tagihan)
        $eligibleRemainingTotal = array_sum($eligibleLineAmounts);
        $discountAmount = 0;

        if ($voucher->type === VoucherType::FreeItem) {
            if ($freeItemCandidateLine !== null) {
                $freeLineIndex = $freeItemCandidateLine['index'];
                $discountAmount = min(
                    (int) $freeItemCandidateLine['base_unit_price'],
                    (int) $freeItemCandidateLine['line_subtotal']
                );
                $eligibleLineAmounts = [$freeLineIndex => (int) $freeItemCandidateLine['line_subtotal']];
            } else {
                // Fallback jika free_product_id tidak diset: gratiskan 1 unit produk eligible termurah
                $cheapestLine = null;
                foreach ($evaluatedLines as $line) {
                    if (! isset($eligibleLineAmounts[$line['index']])) {
                        continue;
                    }
                    if ($cheapestLine === null || $line['base_unit_price'] < $cheapestLine['base_unit_price']) {
                        $cheapestLine = $line;
                    }
                }
                if ($cheapestLine !== null) {
                    $discountAmount = min((int) $cheapestLine['base_unit_price'], (int) $cheapestLine['line_subtotal']);
                    $eligibleLineAmounts = [$cheapestLine['index'] => (int) $cheapestLine['line_subtotal']];
                }
            }
        } elseif ($voucher->type === VoucherType::Percentage) {
            $maxDiscount = $voucher->max_discount !== null ? PricingMath::toRupiah($voucher->max_discount) : null;
            $discountAmount = PricingMath::percentageDiscount(
                $eligibleRemainingTotal,
                (float) $voucher->value,
                $maxDiscount
            );
        } else {
            // fixed_amount, product_specific, cash_voucher
            $rawValue = PricingMath::toRupiah($voucher->value);
            if ($voucher->max_discount !== null) {
                $rawValue = min($rawValue, PricingMath::toRupiah($voucher->max_discount));
            }
            $discountAmount = min($rawValue, $eligibleRemainingTotal);
        }

        $discountAmount = max(0, $discountAmount);

        return [
            'valid' => true,
            'voucher' => $voucher,
            'normalized_code' => $voucher->code,
            'discount_amount' => $discountAmount,
            'eligible_line_amounts' => $eligibleLineAmounts,
            'eligible_subtotal_after_auto' => $spendBasis,
            'error_code' => null,
            'message' => null,
        ];
    }

    /**
     * Reservasi voucher saat dipasang di keranjang kasir (TTL 15 menit).
     */
    public function reserve(
        Voucher $voucher,
        User $cashier,
        ?int $customerId,
        int $discountAmount,
        ?CarbonInterface $at = null
    ): VoucherRedemption {
        $now = ($at ?? now())->copy();

        return DB::transaction(function () use ($voucher, $cashier, $customerId, $discountAmount, $now): VoucherRedemption {
            // Lepas reservasi kadaluarsa untuk voucher ini terlebih dahulu
            VoucherRedemption::query()
                ->where('voucher_id', $voucher->id)
                ->where('status', VoucherRedemptionStatus::Reserved->value)
                ->where('reserved_until', '<=', $now)
                ->update([
                    'status' => VoucherRedemptionStatus::Released->value,
                    'released_at' => $now,
                ]);

            return VoucherRedemption::create([
                'voucher_id' => $voucher->id,
                'transaction_id' => null,
                'customer_id' => $customerId,
                'cashier_id' => $cashier->id,
                'reservation_token' => Str::random(40),
                'status' => VoucherRedemptionStatus::Reserved,
                'discount_amount' => max(0, $discountAmount),
                'reserved_until' => $now->addMinutes(self::RESERVATION_TTL_MINUTES),
            ]);
        });
    }

    /**
     * Lepas reservasi voucher (saat kasir melepas voucher, keranjang kosong, atau syarat tidak lagi terpenuhi).
     */
    public function release(string $reservationToken, ?CarbonInterface $at = null): bool
    {
        $token = trim($reservationToken);
        if ($token === '') {
            return false;
        }

        $now = ($at ?? now())->copy();

        /** @var VoucherRedemption|null $redemption */
        $redemption = VoucherRedemption::query()
            ->where('reservation_token', $token)
            ->where('status', VoucherRedemptionStatus::Reserved->value)
            ->first();

        if (! $redemption instanceof VoucherRedemption) {
            return false;
        }

        $redemption->update([
            'status' => VoucherRedemptionStatus::Released,
            'released_at' => $now,
        ]);

        return true;
    }

    /**
     * Redeem voucher secara atomik di dalam DB::transaction() checkout.
     * Aman terhadap race condition di PostgreSQL & SQLite via conditional atomic UPDATE.
     */
    public function redeem(
        Voucher $voucher,
        Transaction $transaction,
        User $cashier,
        ?int $customerId,
        int $discountAmount,
        ?string $reservationToken = null,
        ?CarbonInterface $at = null
    ): VoucherRedemption {
        $now = ($at ?? now())->copy();

        // Conditional atomic update agar 2 checkout bersamaan pada voucher kuota 1 hanya 1 yang sukses
        $affected = DB::update(
            'UPDATE vouchers SET used_count = used_count + 1, updated_at = ? WHERE id = ? AND (total_quota IS NULL OR used_count < total_quota)',
            [$now->toDateTimeString(), $voucher->id]
        );

        if ($affected === 0) {
            throw ValidationException::withMessages([
                'voucher_code' => VoucherErrorCode::VoucherQuotaExhausted->defaultMessage(),
            ]);
        }

        /** @var Voucher $freshVoucher */
        $freshVoucher = Voucher::query()->findOrFail($voucher->id);
        if ($freshVoucher->total_quota !== null && $freshVoucher->used_count >= $freshVoucher->total_quota) {
            $freshVoucher->update(['status' => VoucherStatus::Exhausted]);
        }

        $token = $reservationToken !== null ? trim($reservationToken) : '';
        if ($token !== '') {
            /** @var VoucherRedemption|null $existing */
            $existing = VoucherRedemption::query()
                ->where('voucher_id', $voucher->id)
                ->where('reservation_token', $token)
                ->where('status', VoucherRedemptionStatus::Reserved->value)
                ->first();

            if ($existing instanceof VoucherRedemption) {
                $existing->update([
                    'transaction_id' => $transaction->id,
                    'customer_id' => $customerId,
                    'cashier_id' => $cashier->id,
                    'status' => VoucherRedemptionStatus::Redeemed,
                    'discount_amount' => max(0, $discountAmount),
                    'redeemed_at' => $now,
                ]);

                return $existing;
            }
        }

        return VoucherRedemption::create([
            'voucher_id' => $voucher->id,
            'transaction_id' => $transaction->id,
            'customer_id' => $customerId,
            'cashier_id' => $cashier->id,
            'reservation_token' => null,
            'status' => VoucherRedemptionStatus::Redeemed,
            'discount_amount' => max(0, $discountAmount),
            'redeemed_at' => $now,
        ]);
    }

    /**
     * Kembalikan (refund) voucher redemption dan kuota voucher saat transaksi di-void atau diretur penuh.
     */
    public function refundForTransaction(Transaction $transaction, ?CarbonInterface $at = null): void
    {
        $now = ($at ?? now())->copy();

        $redemptions = VoucherRedemption::query()
            ->where('transaction_id', $transaction->id)
            ->where('status', VoucherRedemptionStatus::Redeemed->value)
            ->get();

        foreach ($redemptions as $redemption) {
            $redemption->update([
                'status' => VoucherRedemptionStatus::Refunded,
                'released_at' => $now,
            ]);

            DB::update(
                'UPDATE vouchers SET used_count = CASE WHEN used_count > 0 THEN used_count - 1 ELSE 0 END, updated_at = ? WHERE id = ?',
                [$now->toDateTimeString(), $redemption->voucher_id]
            );

            /** @var Voucher|null $voucher */
            $voucher = Voucher::query()->find($redemption->voucher_id);
            if (
                $voucher instanceof Voucher
                && $voucher->status === VoucherStatus::Exhausted
                && ($voucher->total_quota === null || $voucher->used_count < $voucher->total_quota)
                && $voucher->valid_until->gte($now)
            ) {
                $voucher->update(['status' => VoucherStatus::Active]);
            }
        }
    }

    /**
     * Periksa apakah produk memenuhi kriteria applicable/excluded SKU & kategori voucher.
     */
    public function isProductEligibleForVoucher(Voucher $voucher, Product $product): bool
    {
        $barcode = strtoupper(trim((string) $product->barcode));
        $productIdStr = (string) $product->id;
        $categoryId = $product->category_id !== null ? (int) $product->category_id : null;

        // Excluded SKUs (bisa berupa barcode atau product_id)
        if (is_array($voucher->excluded_skus) && count($voucher->excluded_skus) > 0) {
            $excludedSkus = array_map(fn (string|int $v): string => strtoupper(trim((string) $v)), $voucher->excluded_skus);
            if (in_array($barcode, $excludedSkus, true) || in_array($productIdStr, $excludedSkus, true)) {
                return false;
            }
        }

        // Excluded Categories
        if ($categoryId !== null && is_array($voucher->excluded_categories) && count($voucher->excluded_categories) > 0) {
            $excludedCats = array_map(fn (int|string $v): int => (int) $v, $voucher->excluded_categories);
            if (in_array($categoryId, $excludedCats, true)) {
                return false;
            }
        }

        // Applicable SKUs
        if (is_array($voucher->applicable_skus) && count($voucher->applicable_skus) > 0) {
            $applicableSkus = array_map(fn (string|int $v): string => strtoupper(trim((string) $v)), $voucher->applicable_skus);
            if (! in_array($barcode, $applicableSkus, true) && ! in_array($productIdStr, $applicableSkus, true)) {
                return false;
            }
        }

        // Applicable Categories
        if (is_array($voucher->applicable_categories) && count($voucher->applicable_categories) > 0) {
            $applicableCats = array_map(fn (int|string $v): int => (int) $v, $voucher->applicable_categories);
            if ($categoryId === null || ! in_array($categoryId, $applicableCats, true)) {
                return false;
            }
        }

        return true;
    }

    /**
     * @return array{
     *     valid: false,
     *     voucher: null,
     *     normalized_code: string,
     *     discount_amount: int,
     *     eligible_line_amounts: array<int, int>,
     *     eligible_subtotal_after_auto: int,
     *     error_code: VoucherErrorCode,
     *     message: string
     * }
     */
    private function failResult(VoucherErrorCode $errorCode, string $normalizedCode, ?string $message = null): array
    {
        return [
            'valid' => false,
            'voucher' => null,
            'normalized_code' => $normalizedCode,
            'discount_amount' => 0,
            'eligible_line_amounts' => [],
            'eligible_subtotal_after_auto' => 0,
            'error_code' => $errorCode,
            'message' => $message ?? $errorCode->defaultMessage(),
        ];
    }

    /**
     * @param  array<string, mixed>  $data
     * @return array<string, mixed>
     */
    private function normalizePayload(array $data): array
    {
        $tz = (string) config('pos_promotions.timezone', 'Asia/Jakarta');
        $validFrom = Carbon::parse((string) $data['valid_from'], $tz)->utc();
        $validUntil = Carbon::parse((string) $data['valid_until'], $tz)->utc();

        $type = (string) $data['type'];
        $rawValue = isset($data['value']) && $data['value'] !== '' && $data['value'] !== null
            ? (float) $data['value']
            : 0.0;
        $value = $type === VoucherType::Percentage->value
            ? round(min(100.0, max(0.0, $rawValue)), 2)
            : (float) PricingMath::toRupiah($rawValue);

        $code = isset($data['code']) && trim((string) $data['code']) !== ''
            ? $this->normalizeCode((string) $data['code'])
            : $this->generateSingleCode(8);

        return [
            'code' => $code,
            'name' => trim((string) $data['name']),
            'type' => $type,
            'value' => $value,
            'max_discount' => isset($data['max_discount']) && $data['max_discount'] !== '' && $data['max_discount'] !== null
                ? PricingMath::toRupiah($data['max_discount'])
                : null,
            'min_spend' => PricingMath::toRupiah($data['min_spend'] ?? 0),
            'valid_from' => $validFrom,
            'valid_until' => $validUntil,
            'allowed_days' => isset($data['allowed_days']) && $data['allowed_days'] !== '' ? (int) $data['allowed_days'] : 127,
            'allowed_hours_start' => isset($data['allowed_hours_start']) && trim((string) $data['allowed_hours_start']) !== ''
                ? trim((string) $data['allowed_hours_start'])
                : null,
            'allowed_hours_end' => isset($data['allowed_hours_end']) && trim((string) $data['allowed_hours_end']) !== ''
                ? trim((string) $data['allowed_hours_end'])
                : null,
            'total_quota' => isset($data['total_quota']) && $data['total_quota'] !== '' && $data['total_quota'] !== null
                ? (int) $data['total_quota']
                : null,
            'per_customer_limit' => isset($data['per_customer_limit']) && $data['per_customer_limit'] !== '' && $data['per_customer_limit'] !== null
                ? (int) $data['per_customer_limit']
                : null,
            'per_day_limit' => isset($data['per_day_limit']) && $data['per_day_limit'] !== '' && $data['per_day_limit'] !== null
                ? (int) $data['per_day_limit']
                : null,
            'store_ids' => $this->normalizeIntArray($data['store_ids'] ?? null),
            'channel' => isset($data['channel']) && trim((string) $data['channel']) !== ''
                ? strtolower(trim((string) $data['channel']))
                : 'pos',
            'member_only' => (bool) ($data['member_only'] ?? false),
            'member_tiers' => $this->normalizeStringArray($data['member_tiers'] ?? null),
            'applicable_skus' => $this->normalizeStringArray($data['applicable_skus'] ?? null),
            'applicable_categories' => $this->normalizeIntArray($data['applicable_categories'] ?? null),
            'excluded_skus' => $this->normalizeStringArray($data['excluded_skus'] ?? null),
            'excluded_categories' => $this->normalizeIntArray($data['excluded_categories'] ?? null),
            'free_product_id' => isset($data['free_product_id']) && $data['free_product_id'] !== '' && $data['free_product_id'] !== null
                ? (int) $data['free_product_id']
                : null,
            'stackable_with_promo' => (bool) ($data['stackable_with_promo'] ?? true),
            'stackable_with_voucher' => (bool) ($data['stackable_with_voucher'] ?? false),
            'funding' => ($fundingVal = (string) ($data['funding'] ?? PromotionFunding::Store->value)),
            'supplier_id' => in_array($fundingVal, [PromotionFunding::Supplier->value, PromotionFunding::Shared->value], true)
                && isset($data['supplier_id']) && $data['supplier_id'] !== '' && $data['supplier_id'] !== null
                ? (int) $data['supplier_id']
                : null,
            'store_share_percent' => $fundingVal === PromotionFunding::Supplier->value
                ? 0.0
                : ($fundingVal === PromotionFunding::Shared->value
                    ? ($storeShareVal = round(min(100, max(0, (float) ($data['store_share_percent'] ?? 50))), 2))
                    : 100.0),
            'supplier_share_percent' => $fundingVal === PromotionFunding::Supplier->value
                ? 100.0
                : ($fundingVal === PromotionFunding::Shared->value
                    ? round(100.0 - ($storeShareVal ?? 50.0), 2)
                    : 0.0),
            'status' => (string) ($data['status'] ?? VoucherStatus::Draft->value),
        ];
    }

    /**
     * @return array<int, int>|null
     */
    private function normalizeIntArray(mixed $raw): ?array
    {
        if (! is_array($raw) || empty($raw)) {
            return null;
        }

        $result = array_values(array_unique(array_filter(array_map(
            fn (mixed $v): int => (int) $v,
            $raw
        ), fn (int $v): bool => $v > 0)));

        return empty($result) ? null : $result;
    }

    /**
     * @return array<int, string>|null
     */
    private function normalizeStringArray(mixed $raw): ?array
    {
        if (! is_array($raw) || empty($raw)) {
            return null;
        }

        $result = array_values(array_unique(array_filter(array_map(
            fn (mixed $v): string => strtoupper(trim((string) $v)),
            $raw
        ), fn (string $v): bool => $v !== '')));

        return empty($result) ? null : $result;
    }
}

<?php

namespace App\Support;

use App\Enums\RoundingMode;

class PricingMath
{
    /**
     * Konversi nilai nominal menjadi integer Rupiah bulat (minimal 0).
     */
    public static function toRupiah(int|float|string|null $value): int
    {
        if ($value === null || $value === '') {
            return 0;
        }

        return max(0, (int) round((float) $value));
    }

    /**
     * Pembulatan ke bawah (floor) menjadi integer Rupiah bulat untuk kalkulasi diskon.
     * Menambahkan epsilon sangat kecil untuk mencegah error representasi floating-point (mis. 999.999999999).
     */
    public static function floorRupiah(int|float|string|null $value): int
    {
        if ($value === null || $value === '') {
            return 0;
        }

        $float = (float) $value;
        if ($float <= 0.0) {
            return 0;
        }

        return (int) floor($float + 1e-9);
    }

    /**
     * Hitung diskon persentase (floor ke Rupiah bulat) dengan plafon opsional dan batas nilai dasar.
     */
    public static function percentageDiscount(int $baseAmount, float $percent, ?int $maxDiscount = null): int
    {
        if ($baseAmount <= 0 || $percent <= 0.0) {
            return 0;
        }

        $raw = self::floorRupiah($baseAmount * ($percent / 100.0));

        if ($maxDiscount !== null && $maxDiscount >= 0) {
            $raw = min($raw, $maxDiscount);
        }

        return max(0, min($raw, $baseAmount));
    }

    /**
     * Alokasikan diskon level header/transaksi secara proporsional ke setiap baris eligible:
     * alokasi_i = floor(diskon * nilai_i / total_eligible).
     * Sisa akibat floor diberikan ke baris bernilai terbesar (dijamin sum(alokasi) === totalDiscount).
     *
     * @param  array<int|string, int>  $eligibleLineAmounts
     * @return array<int|string, int>
     */
    public static function allocateProportionally(int $totalDiscount, array $eligibleLineAmounts): array
    {
        $result = [];
        foreach ($eligibleLineAmounts as $key => $_amount) {
            $result[$key] = 0;
        }

        if ($totalDiscount <= 0 || empty($eligibleLineAmounts)) {
            return $result;
        }

        $totalEligible = 0;
        foreach ($eligibleLineAmounts as $amount) {
            $totalEligible += max(0, $amount);
        }

        if ($totalEligible <= 0) {
            return $result;
        }

        $effectiveDiscount = min($totalDiscount, $totalEligible);
        $allocatedSum = 0;

        foreach ($eligibleLineAmounts as $key => $amount) {
            $safeAmount = max(0, $amount);
            if ($safeAmount === 0) {
                $result[$key] = 0;

                continue;
            }

            $share = intdiv($effectiveDiscount * $safeAmount, $totalEligible);
            $result[$key] = min($share, $safeAmount);
            $allocatedSum += $result[$key];
        }

        $remainder = $effectiveDiscount - $allocatedSum;
        if ($remainder > 0) {
            // Urutkan key berdasarkan nilai baris terbesar (tie-breaker: urutan asli)
            $keysByAmountDesc = array_keys($eligibleLineAmounts);
            usort($keysByAmountDesc, function (int|string $a, int|string $b) use ($eligibleLineAmounts): int {
                return $eligibleLineAmounts[$b] <=> $eligibleLineAmounts[$a];
            });

            foreach ($keysByAmountDesc as $key) {
                if ($remainder <= 0) {
                    break;
                }

                $capacity = max(0, $eligibleLineAmounts[$key] - $result[$key]);
                if ($capacity <= 0) {
                    continue;
                }

                $add = min($remainder, $capacity);
                $result[$key] += $add;
                $remainder -= $add;
            }
        }

        return $result;
    }

    /**
     * Pembulatan total tagihan hanya berlaku untuk transaksi dengan komponen pembayaran tunai.
     *
     * @return array{rounded: int, rounding_amount: int}
     */
    public static function applyCashRounding(int $amount, RoundingMode $mode, bool $hasCashPayment = true): array
    {
        $cleanAmount = max(0, $amount);

        if (! $hasCashPayment || $mode === RoundingMode::None) {
            return [
                'rounded' => $cleanAmount,
                'rounding_amount' => 0,
            ];
        }

        $rounded = match ($mode) {
            RoundingMode::Nearest100 => (int) (round($cleanAmount / 100) * 100),
            RoundingMode::Down100 => (int) (floor($cleanAmount / 100) * 100),
            RoundingMode::Up100 => (int) (ceil($cleanAmount / 100) * 100),
            RoundingMode::Nearest500 => (int) (round($cleanAmount / 500) * 500),
        };

        $rounded = max(0, $rounded);

        return [
            'rounded' => $rounded,
            'rounding_amount' => $rounded - $cleanAmount,
        ];
    }
}

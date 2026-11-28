<?php

namespace App\Enums;

enum RoundingMode: string
{
    case None = 'none';
    case Nearest100 = 'nearest_100';
    case Down100 = 'down_100';
    case Up100 = 'up_100';
    case Nearest500 = 'nearest_500';

    public function label(): string
    {
        return match ($this) {
            self::None => 'Tanpa Pembulatan',
            self::Nearest100 => 'Bulatkan ke Rp 100 Terdekat',
            self::Down100 => 'Bulatkan ke Bawah (Rp 100)',
            self::Up100 => 'Bulatkan ke Atas (Rp 100)',
            self::Nearest500 => 'Bulatkan ke Rp 500 Terdekat',
        };
    }

    public function description(): string
    {
        return match ($this) {
            self::None => 'Total belanja dihitung persis tanpa pembulatan.',
            self::Nearest100 => 'Membulatkan total ke kelipatan Rp 100 terdekat (contoh: Rp 12.340 -> Rp 12.300, Rp 12.360 -> Rp 12.400).',
            self::Down100 => 'Membulatkan total ke kelipatan Rp 100 di bawahnya (contoh: Rp 12.390 -> Rp 12.300).',
            self::Up100 => 'Membulatkan total ke kelipatan Rp 100 di atasnya (contoh: Rp 12.310 -> Rp 12.400).',
            self::Nearest500 => 'Membulatkan total ke kelipatan Rp 500 terdekat (contoh: Rp 12.240 -> Rp 12.000, Rp 12.260 -> Rp 12.500).',
        };
    }

    /**
     * Daftar opsi untuk dropdown frontend.
     *
     * @return array<int, array{value: string, label: string, description: string}>
     */
    public static function options(): array
    {
        return array_map(
            fn (self $mode): array => [
                'value' => $mode->value,
                'label' => $mode->label(),
                'description' => $mode->description(),
            ],
            self::cases()
        );
    }
}

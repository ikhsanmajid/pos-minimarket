<?php

namespace App\Services\Reports;

use Carbon\CarbonImmutable;

class ReportPeriodResolver
{
    /**
     * Resolusi rentang tanggal laporan berdasarkan preset atau tanggal kustom.
     *
     * @param  array<string, mixed>  $filters
     * @return array{
     *     preset: string,
     *     start: CarbonImmutable,
     *     end: CarbonImmutable,
     *     start_date: string,
     *     end_date: string,
     *     label: string,
     *     days: int
     * }
     */
    public function resolve(array $filters, string $defaultPreset = 'this_month'): array
    {
        $now = CarbonImmutable::now();
        $hasExplicitDates = ! empty($filters['start_date']) && ! empty($filters['end_date']);
        $preset = isset($filters['preset']) && is_string($filters['preset']) && $filters['preset'] !== ''
            ? $filters['preset']
            : ($hasExplicitDates ? 'custom' : $defaultPreset);

        if ($preset === 'today') {
            $start = $now->startOfDay();
            $end = $now->endOfDay();
            $label = 'Hari Ini';
        } elseif ($preset === '7d') {
            $start = $now->subDays(6)->startOfDay();
            $end = $now->endOfDay();
            $label = '7 Hari Terakhir';
        } elseif ($preset === '30d') {
            $start = $now->subDays(29)->startOfDay();
            $end = $now->endOfDay();
            $label = '30 Hari Terakhir';
        } elseif ($preset === 'last_month') {
            $lastMonth = $now->subMonthNoOverflow();
            $start = $lastMonth->startOfMonth()->startOfDay();
            $end = $lastMonth->endOfMonth()->endOfDay();
            $label = 'Bulan Lalu';
        } elseif ($preset === 'this_year') {
            $start = $now->startOfYear()->startOfDay();
            $end = $now->endOfDay();
            $label = 'Tahun Ini';
        } elseif ($preset === 'custom' && $hasExplicitDates) {
            $start = CarbonImmutable::parse((string) $filters['start_date'])->startOfDay();
            $end = CarbonImmutable::parse((string) $filters['end_date'])->endOfDay();

            if ($end->lessThan($start)) {
                [$start, $end] = [$end->startOfDay(), $start->endOfDay()];
            }

            $label = $start->format('d M Y').' - '.$end->format('d M Y');
        } else {
            $preset = 'this_month';
            $start = $now->startOfMonth()->startOfDay();
            $end = $now->endOfDay();
            $label = 'Bulan Ini';
        }

        $days = max(1, (int) $start->startOfDay()->diffInDays($end->startOfDay()) + 1);

        return [
            'preset' => $preset,
            'start' => $start,
            'end' => $end,
            'start_date' => $start->toDateString(),
            'end_date' => $end->toDateString(),
            'label' => $label,
            'days' => $days,
        ];
    }

    /**
     * Sanitasi sel CSV untuk mencegah CSV Formula Injection (Excel / LibreOffice).
     */
    public function sanitizeCsvCell(mixed $value): string
    {
        if ($value === null) {
            return '';
        }

        if (is_int($value) || is_float($value)) {
            return (string) $value;
        }

        $str = (string) $value;
        if ($str === '') {
            return '';
        }

        $firstChar = $str[0];
        if (in_array($firstChar, ['=', '+', '-', '@', "\t", "\r"], true)) {
            return "'".$str;
        }

        return $str;
    }
}

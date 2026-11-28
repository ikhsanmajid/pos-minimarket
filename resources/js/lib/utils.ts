import type { ClassValue } from 'clsx';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

const rupiahFormatter = new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
});

const numberFormatter = new Intl.NumberFormat('id-ID');

export function formatRupiah(value: number | string | null | undefined): string {
    const numeric = typeof value === 'string' ? Number.parseFloat(value) : Number(value ?? 0);
    if (Number.isNaN(numeric)) {
        return rupiahFormatter.format(0);
    }

    return rupiahFormatter.format(numeric);
}

export function formatNumber(value: number | string | null | undefined): string {
    const numeric = typeof value === 'string' ? Number.parseFloat(value) : Number(value ?? 0);
    if (Number.isNaN(numeric)) {
        return '0';
    }

    return numberFormatter.format(numeric);
}

export function formatPercent(part: number, total: number): string {
    if (total <= 0) {
        return '0%';
    }

    const pct = Math.round((part / total) * 100);
    return `${pct}%`;
}

const shortDayMonthFormatter = new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'short',
});

const shortDateFormatter = new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
});

function parseIsoDate(value?: string | null): Date | null {
    if (!value) {
        return null;
    }

    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
    if (!match) {
        return null;
    }

    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const date = new Date(year, month - 1, day);

    if (Number.isNaN(date.getTime())) {
        return null;
    }

    return date;
}

export function formatDateRangeLabel(
    startDate?: string | null,
    endDate?: string | null,
    fallback = 'Semua Data',
): string {
    const start = parseIsoDate(startDate);
    const end = parseIsoDate(endDate);

    if (!start && !end) {
        return fallback;
    }

    if (start && end) {
        if (startDate === endDate) {
            return shortDateFormatter.format(start);
        }

        if (start.getFullYear() === end.getFullYear() && start.getMonth() === end.getMonth()) {
            const startDay = String(start.getDate()).padStart(2, '0');
            return `${startDay}–${shortDateFormatter.format(end)}`;
        }

        if (start.getFullYear() === end.getFullYear()) {
            return `${shortDayMonthFormatter.format(start)} – ${shortDateFormatter.format(end)}`;
        }

        return `${shortDateFormatter.format(start)} – ${shortDateFormatter.format(end)}`;
    }

    if (start) {
        return `Mulai ${shortDateFormatter.format(start)}`;
    }

    return `s.d. ${shortDateFormatter.format(end!)}`;
}

import { usePage } from '@inertiajs/react';
import type { ActiveShiftSummary, PageProps } from '@/types';

export function useAuth() {
    const props = usePage<PageProps>().props;
    const { auth, flash, activeShift } = props;

    return {
        user: auth?.user,
        check: !!auth?.user,
        activeShift: (activeShift ?? null) as ActiveShiftSummary | null,
        flash: flash ?? { success: null, error: null },
    };
}

import { usePage } from '@inertiajs/react';

export function useAuth() {
    const { auth, flash } = usePage().props as any;
    return {
        user: auth.user,
        check: !!auth.user,
        flash: flash
        // can: (permission: string) => auth.user?.can?.[permission] ?? false,
    };
}
import '@inertiajs/core';
import type { Auth } from '@/types/auth';

declare global {
    var route: typeof routeFn;
}

declare module 'react' {
    interface InputHTMLAttributes<T> {
        passwordrules?: string;
    }
}

declare module '@inertiajs/core' {
    export interface PageProps {
        auth: Auth;
        [key: string]: unknown;
    }

    export interface InertiaConfig {
        sharedPageProps: {
            name: string;
            auth: Auth;
            sidebarOpen: boolean;
            [key: string]: unknown;
        };
    }
}

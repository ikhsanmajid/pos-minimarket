import '@inertiajs/core';
import type { Auth } from '@/types/auth';
import type { StoreSettingsData } from '@/types/store-setting';

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
        storeSettings: StoreSettingsData;
        [key: string]: unknown;
    }

    export interface InertiaConfig {
        sharedPageProps: {
            name: string;
            auth: Auth;
            storeSettings: StoreSettingsData;
            sidebarOpen: boolean;
            [key: string]: unknown;
        };
    }
}

import type { ActiveShiftSummary, Auth } from './auth';
import type { StoreSettingsData } from './store-setting';

export type * from './auth';
export type * from './store-setting';
export type * from './pos';

export type PageProps<T extends Record<string, unknown> = Record<string, unknown>> = T & {
    auth: Auth;
    storeSettings: StoreSettingsData;
    activeShift: ActiveShiftSummary | null;
    flash?: {
        success?: string | null;
        error?: string | null;
    };
    [key: string]: unknown;
};

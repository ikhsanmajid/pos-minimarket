import type { ActiveShiftSummary, Auth } from './auth';

export type * from './auth';

export type PageProps<T extends Record<string, unknown> = Record<string, unknown>> = T & {
    auth: Auth;
    activeShift: ActiveShiftSummary | null;
    flash?: {
        success?: string | null;
        error?: string | null;
    };
    [key: string]: unknown;
};

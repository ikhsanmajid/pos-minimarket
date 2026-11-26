export type User = {
    id: number;
    name: string;
    email: string;
    avatar?: string;
    email_verified_at: string | null;
    created_at: string;
    updated_at: string;
    role: string;
    role_name?: string;
    [key: string]: unknown;
};

export type Auth = {
    user: User;
};

export type ActiveShiftSummary = {
    id: number;
    shift_number: string;
    register_name: string;
    opened_at: string;
    opened_at_human: string;
    starting_cash: number;
};

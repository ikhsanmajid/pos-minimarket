import React, { useState } from 'react';
import { Head, router, useForm } from '@inertiajs/react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Switch } from '@/components/ui/switch';
import {
    AlertCircleIcon,
    Eye,
    EyeOff,
    Loader2,
    Lock,
    ShieldCheck,
    ShoppingCart,
    User,
    UserCheck,
    Warehouse,
} from 'lucide-react';
import { CashierIllustration } from './components/CashierIllustration';

const DEMO_ACCOUNTS = [
    {
        role: 'Admin',
        subtitle: 'Akses Penuh',
        email: 'admin@minimarket.test',
        password: 'password',
        icon: ShieldCheck,
        cardClass:
            'border-blue-200/80 bg-blue-50/70 text-blue-900 hover:bg-blue-100/80 dark:border-blue-800/70 dark:bg-blue-950/35 dark:text-blue-100 dark:hover:bg-blue-950/60',
        iconClass: 'text-blue-600 dark:text-blue-400',
    },
    {
        role: 'Supervisor',
        subtitle: 'Approval & Laporan',
        email: 'supervisor@minimarket.test',
        password: 'password',
        icon: UserCheck,
        cardClass:
            'border-violet-200/80 bg-violet-50/70 text-violet-900 hover:bg-violet-100/80 dark:border-violet-800/70 dark:bg-violet-950/35 dark:text-violet-100 dark:hover:bg-violet-950/60',
        iconClass: 'text-violet-600 dark:text-violet-400',
    },
    {
        role: 'Warehouse',
        subtitle: 'Stok & PO',
        email: 'warehouse@minimarket.test',
        password: 'password',
        icon: Warehouse,
        cardClass:
            'border-amber-200/80 bg-amber-50/70 text-amber-900 hover:bg-amber-100/80 dark:border-amber-800/70 dark:bg-amber-950/35 dark:text-amber-100 dark:hover:bg-amber-950/60',
        iconClass: 'text-amber-600 dark:text-amber-400',
    },
    {
        role: 'Kasir',
        subtitle: 'POS Terminal',
        email: 'kasir@minimarket.test',
        password: 'password',
        icon: ShoppingCart,
        cardClass:
            'border-emerald-200/80 bg-emerald-50/70 text-emerald-900 hover:bg-emerald-100/80 dark:border-emerald-800/70 dark:bg-emerald-950/35 dark:text-emerald-100 dark:hover:bg-emerald-950/60',
        iconClass: 'text-emerald-600 dark:text-emerald-400',
    },
] as const;

export default function Login() {
    const [loginMessageError, setLoginMessageError] = useState<string | null>(null);
    const [showPassword, setShowPassword] = useState(false);
    const [demoLoadingEmail, setDemoLoadingEmail] = useState<string | null>(null);

    const { data, setData, post, processing, errors } = useForm({
        email: '',
        password: '',
        remember: false,
    });

    const isSubmitting = processing || demoLoadingEmail !== null;

    const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setLoginMessageError(null);

        post('/login', {
            onError: (errs) => {
                if (errs.throttle) {
                    setLoginMessageError(errs.throttle);
                } else if (errs.error) {
                    setLoginMessageError(errs.error);
                }
            },
        });
    };

    const handleDemoLogin = (email: string, password: string) => {
        if (isSubmitting) {
            return;
        }

        setLoginMessageError(null);
        setData({
            email,
            password,
            remember: false,
        });

        router.post(
            '/login',
            {
                email,
                password,
                remember: false,
            },
            {
                onStart: () => setDemoLoadingEmail(email),
                onFinish: () => setDemoLoadingEmail(null),
                onError: (errs) => {
                    if (errs.throttle) {
                        setLoginMessageError(errs.throttle);
                    } else if (errs.error) {
                        setLoginMessageError(errs.error);
                    } else if (errs.email) {
                        setLoginMessageError(errs.email);
                    } else if (errs.password) {
                        setLoginMessageError(errs.password);
                    }
                },
            }
        );
    };

    return (
        <>
            <Head title="Login Kasir - POS Minimarket" />

            <div className="relative flex min-h-screen w-full items-center justify-center overflow-hidden bg-white px-6 py-10 text-foreground transition-colors dark:bg-background">
                {/* Cashier illustration flush to the right-bottom edge */}
                <div className="pointer-events-none absolute right-0 bottom-0 z-0 hidden select-none md:block md:w-[440px] lg:w-[560px] xl:w-[660px]">
                    <CashierIllustration className="block h-auto w-full" />
                </div>

                {/* Centered Brand Header + Floating Login Card */}
                <div className="relative z-10 w-full max-w-[390px]">
                    {/* Brand Header */}
                    <header className="mb-8 text-left">
                        <h1 className="text-2xl font-extrabold tracking-tight text-slate-950 sm:text-3xl dark:text-foreground">
                            POS Minimarket
                        </h1>
                        <p className="mt-1 text-sm font-medium text-slate-600 sm:text-[15px] dark:text-muted-foreground">
                            Sistem kasir &amp; manajemen minimarket
                        </p>
                    </header>

                    {/* Floating Login Card */}
                    <main>
                        <div className="rounded-2xl border border-slate-100/90 bg-white/95 p-8 shadow-[0_24px_60px_-15px_rgba(15,23,42,0.12)] backdrop-blur-xs sm:p-9 dark:border-border dark:bg-card/95 dark:shadow-2xl">
                            <h2 className="mb-6 text-2xl font-extrabold tracking-tight text-slate-950 dark:text-foreground">
                                Login
                            </h2>

                            {/* Alert Error */}
                            {loginMessageError && (
                                <Alert variant="destructive" className="mb-5">
                                    <AlertCircleIcon className="h-4 w-4" />
                                    <AlertTitle>Login Gagal!</AlertTitle>
                                    <AlertDescription>{loginMessageError}</AlertDescription>
                                </Alert>
                            )}

                            {/* Form Login */}
                            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                                {/* Input Email */}
                                <div>
                                    <label htmlFor="email" className="sr-only">
                                        Email Kasir
                                    </label>
                                    <div
                                        className={`flex items-center overflow-hidden rounded-lg border bg-white transition-all focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/20 dark:bg-background ${
                                            errors.email
                                                ? 'border-red-500 focus-within:border-red-500 focus-within:ring-red-500/20'
                                                : 'border-slate-200 dark:border-input'
                                        }`}
                                    >
                                        <span className="flex h-12 w-12 shrink-0 items-center justify-center border-r border-slate-100 text-slate-500 dark:border-border dark:text-slate-400">
                                            <User className="h-4.5 w-4.5 fill-slate-500/20 text-slate-600 dark:fill-slate-400/20 dark:text-slate-300" />
                                        </span>
                                        <input
                                            id="email"
                                            type="email"
                                            value={data.email}
                                            onChange={(e) => setData('email', e.target.value)}
                                            placeholder="Email Address"
                                            autoComplete="email"
                                            className="h-12 w-full bg-transparent px-3.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none dark:text-foreground dark:placeholder:text-muted-foreground"
                                            required
                                            autoFocus
                                        />
                                    </div>
                                    {errors.email && (
                                        <p className="mt-1.5 text-xs text-red-500">{errors.email}</p>
                                    )}
                                </div>

                                {/* Input Password */}
                                <div>
                                    <label htmlFor="password" className="sr-only">
                                        Password
                                    </label>
                                    <div
                                        className={`flex items-center overflow-hidden rounded-lg border bg-white transition-all focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/20 dark:bg-background ${
                                            errors.password
                                                ? 'border-red-500 focus-within:border-red-500 focus-within:ring-red-500/20'
                                                : 'border-slate-200 dark:border-input'
                                        }`}
                                    >
                                        <span className="flex h-12 w-12 shrink-0 items-center justify-center border-r border-slate-100 dark:border-border">
                                            <Lock className="h-4.5 w-4.5 fill-amber-500/25 text-amber-600 dark:fill-amber-400/20 dark:text-amber-400" />
                                        </span>
                                        <input
                                            id="password"
                                            type={showPassword ? 'text' : 'password'}
                                            value={data.password}
                                            onChange={(e) => setData('password', e.target.value)}
                                            placeholder="Password"
                                            autoComplete="current-password"
                                            className="h-12 w-full bg-transparent px-3.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none dark:text-foreground dark:placeholder:text-muted-foreground"
                                            required
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowPassword((prev) => !prev)}
                                            aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
                                            className="flex h-12 w-10 shrink-0 cursor-pointer items-center justify-center text-slate-400 transition-colors hover:text-slate-600 dark:hover:text-slate-200"
                                        >
                                            {showPassword ? (
                                                <EyeOff className="h-4 w-4" />
                                            ) : (
                                                <Eye className="h-4 w-4" />
                                            )}
                                        </button>
                                    </div>
                                    {errors.password && (
                                        <p className="mt-1.5 text-xs text-red-500">{errors.password}</p>
                                    )}
                                </div>

                                {/* Remember Me Switch */}
                                <div className="flex items-center gap-3 pt-1">
                                    <label
                                        htmlFor="remember"
                                        className="cursor-pointer select-none text-xs font-medium text-slate-700 dark:text-muted-foreground"
                                    >
                                        Ingat saya
                                    </label>
                                    <Switch
                                        id="remember"
                                        checked={data.remember}
                                        onCheckedChange={(checked) => setData('remember', checked)}
                                        className="cursor-pointer data-checked:bg-emerald-500 dark:data-checked:bg-emerald-500"
                                    />
                                </div>

                                {/* Submit Button */}
                                <button
                                    type="submit"
                                    disabled={isSubmitting}
                                    className="mt-2 h-12 w-full cursor-pointer rounded-lg bg-gradient-to-r from-[#2e7cf6] to-[#1a66f5] text-sm font-semibold text-white shadow-[0_12px_24px_-6px_rgba(37,99,235,0.5)] transition-all duration-150 hover:from-[#2370eb] hover:to-[#135ae0] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                    {processing ? 'Memproses...' : 'Log in'}
                                </button>
                            </form>

                            {/* One-Click Demo Login */}
                            <div className="mt-6 border-t border-slate-100 pt-5 dark:border-border">
                                <div className="mb-3 flex items-center justify-between">
                                    <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-muted-foreground">
                                        Demo Login Cepat
                                    </span>
                                    <span className="text-[11px] text-slate-400 dark:text-muted-foreground">
                                        1-klik masuk
                                    </span>
                                </div>

                                <div className="grid grid-cols-2 gap-2.5">
                                    {DEMO_ACCOUNTS.map((account) => {
                                        const Icon = account.icon;
                                        const isThisLoading = demoLoadingEmail === account.email;

                                        return (
                                            <button
                                                key={account.email}
                                                type="button"
                                                disabled={isSubmitting}
                                                onClick={() => handleDemoLogin(account.email, account.password)}
                                                className={`flex cursor-pointer items-center gap-2.5 rounded-lg border px-3 py-2.5 text-left transition-all active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 ${account.cardClass}`}
                                            >
                                                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-white/80 shadow-xs dark:bg-background/60">
                                                    {isThisLoading ? (
                                                        <Loader2 className={`h-4 w-4 animate-spin ${account.iconClass}`} />
                                                    ) : (
                                                        <Icon className={`h-4 w-4 ${account.iconClass}`} />
                                                    )}
                                                </span>
                                                <span className="min-w-0 flex-1">
                                                    <span className="block truncate text-xs font-bold leading-tight">
                                                        {account.role}
                                                    </span>
                                                    <span className="block truncate text-[11px] opacity-75">
                                                        {account.subtitle}
                                                    </span>
                                                </span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    </main>
                </div>
            </div>
        </>
    );
}

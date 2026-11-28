import React, { useState } from 'react';
import { Head, useForm } from '@inertiajs/react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Switch } from '@/components/ui/switch';
import { AlertCircleIcon, Eye, EyeOff, Lock, User } from 'lucide-react';
import { CashierIllustration } from './components/CashierIllustration';

export default function Login() {
    const [loginMessageError, setLoginMessageError] = useState<string | null>(null);
    const [showPassword, setShowPassword] = useState(false);

    const { data, setData, post, processing, errors } = useForm({
        email: '',
        password: '',
        remember: false,
    });

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
                                    disabled={processing}
                                    className="mt-2 h-12 w-full cursor-pointer rounded-lg bg-gradient-to-r from-[#2e7cf6] to-[#1a66f5] text-sm font-semibold text-white shadow-[0_12px_24px_-6px_rgba(37,99,235,0.5)] transition-all duration-150 hover:from-[#2370eb] hover:to-[#135ae0] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                    {processing ? 'Memproses...' : 'Log in'}
                                </button>
                            </form>
                        </div>
                    </main>
                </div>
            </div>
        </>
    );
}

import React, { useState } from 'react';
import { useForm, Head } from '@inertiajs/react';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircleIcon } from 'lucide-react';

export default function Login() {
    const [loginMessageError, setLoginMessageError] = useState<string | null>(null);

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
            }
        });
    };

    return (
        <>
            <Head title="Login Kasir - POS Minimarket" />

            {/* Container utama: bg-background & text-foreground menyesuaikan Dark/Light mode */}
            <div className="min-h-screen flex items-center justify-center bg-background text-foreground p-4 transition-colors">
                <div className="max-w-md w-full bg-card text-card-foreground rounded-2xl shadow-xl p-8 border border-border">
                    {/* Header Logo */}
                    <div className="text-center mb-8">
                        <div className="w-16 h-16 bg-blue-600 text-white text-2xl font-bold flex items-center justify-center rounded-2xl mx-auto mb-3 shadow-lg shadow-blue-500/20">
                            POS
                        </div>
                        <h2 className="text-2xl font-bold">Selamat Datang Kembali</h2>
                        <p className="text-sm text-muted-foreground mt-1">Masuk ke sistem kasir minimarket</p>
                    </div>

                    {/* Alert Error */}
                    {loginMessageError && (
                        <Alert variant="destructive" className="mb-6">
                            <AlertCircleIcon className="h-4 w-4" />
                            <AlertTitle>Login Gagal!</AlertTitle>
                            <AlertDescription>{loginMessageError}</AlertDescription>
                        </Alert>
                    )}

                    {/* Form Login */}
                    <form onSubmit={handleSubmit} className="space-y-5">
                        {/* Input Email */}
                        <div>
                            <label className="block text-sm font-semibold mb-1">
                                Email Kasir
                            </label>
                            <input
                                type="email"
                                value={data.email}
                                onChange={(e) => setData('email', e.target.value)}
                                placeholder="kasir1@minimarket.com"
                                className={`w-full px-4 py-3 rounded-xl border bg-background text-foreground ${errors.email ? 'border-red-500' : 'border-input'
                                    } focus:ring-2 focus:ring-blue-500 focus:outline-none transition text-sm`}
                                required
                                autoFocus
                            />
                            {errors.email && (
                                <p className="text-red-500 text-xs mt-1">{errors.email}</p>
                            )}
                        </div>

                        {/* Input Password */}
                        <div>
                            <label className="block text-sm font-semibold mb-1">
                                Password
                            </label>
                            <input
                                type="password"
                                value={data.password}
                                onChange={(e) => setData('password', e.target.value)}
                                placeholder="••••••••"
                                className={`w-full px-4 py-3 rounded-xl border bg-background text-foreground ${errors.password ? 'border-red-500' : 'border-input'
                                    } focus:ring-2 focus:ring-blue-500 focus:outline-none transition text-sm`}
                                required
                            />
                            {errors.password && (
                                <p className="text-red-500 text-xs mt-1">{errors.password}</p>
                            )}
                        </div>

                        {/* Checkbox Remember Me */}
                        <div className="flex items-center justify-between text-sm">
                            <label className="flex items-center text-muted-foreground cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={data.remember}
                                    onChange={(e) => setData('remember', e.target.checked)}
                                    className="rounded border-input text-blue-600 focus:ring-blue-500 mr-2 bg-background"
                                />
                                Ingat saya
                            </label>
                        </div>

                        {/* Submit Button */}
                        <button
                            type="submit"
                            disabled={processing}
                            className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl shadow-lg shadow-blue-500/20 transition duration-200 disabled:opacity-50"
                        >
                            {processing ? 'Memproses...' : 'Masuk ke Kasir'}
                        </button>
                    </form>

                    {/* Footer Info */}
                    <div className="mt-8 pt-6 border-t border-border text-center text-xs text-muted-foreground">
                        Sistem Informasi POS Minimarket &copy; {new Date().getFullYear()}
                    </div>
                </div>
            </div>
        </>
    );
}
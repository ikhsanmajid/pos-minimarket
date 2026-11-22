import React, { createContext, useContext, useEffect, useState } from 'react';

export type Theme = 'light' | 'dark' | 'system';

export interface ThemeContextType {
    theme: Theme;
    resolvedTheme: 'light' | 'dark';
    mounted: boolean;
    setTheme: (theme: Theme) => void;
    toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const getSystemTheme = (): 'light' | 'dark' =>
    typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light';

const disableTransitionsTemporarily = () => {
    const style = document.createElement('style');
    style.appendChild(
        document.createTextNode(`*, *::before, *::after { transition: none !important; }`)
    );
    document.head.appendChild(style);
    (() => window.getComputedStyle(document.body))();
    setTimeout(() => {
        document.head.removeChild(style);
    }, 1);
};

export const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
    const [theme, setThemeState] = useState<Theme>('system');
    const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>('light');
    const [mounted, setMounted] = useState(false);

    // Baca localStorage setelah mount agar tidak terjadi hydration mismatch
    useEffect(() => {
        const savedTheme = (localStorage.getItem('theme') ||
            localStorage.getItem('vite-ui-theme')) as Theme | null;

        if (savedTheme === 'light' || savedTheme === 'dark' || savedTheme === 'system') {
            setThemeState(savedTheme);
        }
        localStorage.removeItem('vite-ui-theme');
        setMounted(true);
    }, []);

    // Sinkronkan class <html>, localStorage, dan resolvedTheme
    useEffect(() => {
        if (!mounted) return;

        const nextResolved = theme === 'system' ? getSystemTheme() : theme;
        setResolvedTheme(nextResolved);

        disableTransitionsTemporarily();

        const root = window.document.documentElement;
        root.classList.remove('light', 'dark');
        root.classList.add(nextResolved);

        localStorage.setItem('theme', theme);
    }, [theme, mounted]);

    // Dengarkan perubahan tema OS jika mode 'system' aktif
    useEffect(() => {
        if (!mounted || theme !== 'system') return;

        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        const handleChange = () => {
            const nextResolved = mediaQuery.matches ? 'dark' : 'light';
            setResolvedTheme(nextResolved);
            const root = window.document.documentElement;
            root.classList.remove('light', 'dark');
            root.classList.add(nextResolved);
        };

        mediaQuery.addEventListener('change', handleChange);
        return () => mediaQuery.removeEventListener('change', handleChange);
    }, [theme, mounted]);

    const setTheme = (newTheme: Theme) => setThemeState(newTheme);

    const toggleTheme = () => {
        setThemeState(resolvedTheme === 'light' ? 'dark' : 'light');
    };

    return (
        <ThemeContext.Provider value={{ theme, resolvedTheme, mounted, setTheme, toggleTheme }}>
            {children}
        </ThemeContext.Provider>
    );
};

export const useTheme = () => {
    const context = useContext(ThemeContext);
    if (!context) {
        throw new Error('useTheme must be used within a ThemeProvider');
    }
    return context;
};
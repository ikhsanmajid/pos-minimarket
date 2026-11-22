import { createInertiaApp } from '@inertiajs/react';
import { ThemeProvider } from './context/ThemeContext';
import MainLayout from './layouts/DefaultLayout';


const appName = import.meta.env.VITE_APP_NAME || 'Laravel';

void createInertiaApp({
    title: (title) => (title ? `${title} - ${appName}` : appName),
    withApp(app) {
        return (
            <ThemeProvider>
                <MainLayout>
                    {app}
                </MainLayout>
            </ThemeProvider>
        );
    },
    progress: {
        color: '#4B5563',
    },
});

import { Moon } from 'lucide-react';
import { useTheme } from '@/context/ThemeContext';
import { Label } from './ui/label';
import { Switch } from './ui/switch';

function ThemeToggle() {
    const { resolvedTheme, mounted, setTheme } = useTheme();
    const isDark = resolvedTheme === 'dark';

    return (
        <>
            <Label htmlFor="dark-mode" className="flex items-center gap-2 cursor-pointer">
                <Moon className="h-4 w-4" /> Dark Mode
            </Label>
            {mounted ? (
                <Switch
                    id="dark-mode"
                    checked={isDark}
                    onCheckedChange={(checked) => setTheme(checked ? 'dark' : 'light')}
                />
            ) : (
                <div className="h-[18.4px] w-[32px] rounded-full bg-input" />
            )}
        </>
    );
}

export default ThemeToggle;
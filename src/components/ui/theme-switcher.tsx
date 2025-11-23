'use client';

import * as React from 'react';
import { useTheme } from 'next-themes';
import { FiMonitor, FiMoon, FiSun } from 'react-icons/fi';

import { cn } from '@/lib/utils';

const themeOptions = [
  {
    value: 'light',
    label: 'Light',
    icon: FiSun,
  },
  {
    value: 'system',
    label: 'Auto',
    icon: FiMonitor,
  },
  {
    value: 'dark',
    label: 'Dark',
    icon: FiMoon,
  }
] as const;

export function ThemeSwitcher({ className, }: { className?: string }) {
  const {
    theme,
    setTheme,
    resolvedTheme,
  } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const activeValue = mounted ? theme ?? resolvedTheme ?? 'system' : 'system';

  return (
    <div
      role="group"
      aria-label="Theme"
      className={ cn(
        'inline-flex items-center gap-1 rounded-lg border bg-card/80 px-1.5 py-1 text-sm shadow-sm backdrop-blur supports-[backdrop-filter]:bg-card/60',
        className
      ) }
    >
      { themeOptions.map((option) => {
        const isActive = activeValue === option.value;
        const Icon = option.icon;

        return (
          <button
            key={ option.value }
            type="button"
            onClick={ () => setTheme(option.value) }
            className={ cn(
              'flex items-center gap-1 rounded-md px-2 py-1 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
              isActive
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            ) }
            aria-pressed={ isActive }
          >
            <Icon aria-hidden="true" className="size-4" />
            <span className="hidden sm:inline">{ option.label }</span>
            <span className="sr-only">Switch to { option.label } theme</span>
          </button>
        );
      }) }
    </div>
  );
}

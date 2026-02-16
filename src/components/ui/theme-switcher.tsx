'use client';

import * as React from 'react';
import { useTheme } from 'next-themes';
import { FiMoon, FiSmartphone, FiSun } from 'react-icons/fi';

import { cn } from '@/lib/utils';

type ThemeSwitcherProps = {
  className?: string
  variant?: 'default' | 'compact'
  shadowless?: boolean
};

const themeOptions = [
  {
    value: 'light',
    label: 'Light',
    icon: FiSun,
  },
  {
    value: 'system',
    label: 'Auto',
    icon: FiSmartphone,
  },
  {
    value: 'dark',
    label: 'Dark',
    icon: FiMoon,
  }
] as const;

type ThemeOption = (typeof themeOptions)[number]['value'];

export function ThemeSwitcher({
  className,
  variant = 'default',
  shadowless = false,
}: ThemeSwitcherProps) {
  const {
    theme,
    setTheme,
    resolvedTheme,
  } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const activeValue: ThemeOption = mounted
    ? (theme ?? resolvedTheme ?? 'system') as ThemeOption
    : 'system';
  const activeOption = themeOptions.find((option) => option.value === activeValue) ?? themeOptions[2];

  const cycleTheme = React.useCallback(() => {
    const currentIndex = themeOptions.findIndex((option) => option.value === activeValue);
    const nextIndex = currentIndex === -1 ? 0 : (currentIndex + 1) % themeOptions.length;
    setTheme(themeOptions[nextIndex].value);
  }, [activeValue, setTheme]);

  if (variant === 'compact') {
    const CompactIcon = activeOption.icon;

    return (
      <button
        type="button"
        onClick={ cycleTheme }
        className={ cn(
          'flex size-8 items-center justify-center rounded-full border border-border bg-card/80 text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
          !shadowless && 'shadow-sm',
          className
        ) }
        aria-label={ `Toggle theme (current: ${activeOption.label})` }
      >
        <CompactIcon aria-hidden="true" className="size-4" />
      </button>
    );
  }

  return (
    <div
      role="group"
      aria-label="Theme"
      className={ cn(
        'inline-flex items-center gap-1 rounded-lg border bg-card/80 px-1.5 py-1 text-sm backdrop-blur supports-[backdrop-filter]:bg-card/60',
        !shadowless && 'shadow-sm',
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
                ? cn('bg-primary text-white', !shadowless && 'shadow-sm')
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

'use client';

import * as React from 'react';
import { useTheme } from 'next-themes';
import { FiSun, FiMoon } from 'react-icons/fi';

import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

export function ThemeSwitcher({ className, }: { className?: string }) {
  const {
 theme, setTheme, 
} = useTheme();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return null;
  }

  return (
    <Tabs
      value={ theme }
      onValueChange={ setTheme }
      className={ className }
    >
      <TabsList>
        <TabsTrigger value="light">
          <FiSun className="size-5" />
          <span className="sr-only">Light</span>
        </TabsTrigger>
        <TabsTrigger value="dark" className="dark:data-[state=active]:bg-amber-400 dark:data-[state=active]:text-background">
          <FiMoon className="size-5" />
          <span className="sr-only">Dark</span>
        </TabsTrigger>
      </TabsList>
    </Tabs >
  );
}

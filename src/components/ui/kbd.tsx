'use client';

import * as React from 'react';

import { cn } from '@/lib/utils';

const Kbd = React.forwardRef<HTMLElement, React.HTMLAttributes<HTMLElement>>(
  (
    {
      className,
      ...props
    },
    ref
  ) => (
    <kbd
      ref={ ref }
      className={ cn(
        'bg-muted dark:bg-muted/70 text-[#007c86] dark:text-muted-foreground flex h-7 items-center gap-1 rounded-md border border-border px-2 font-sans text-[11px] font-semibold uppercase tracking-[0.08em] hover:!text-white dark:hover:text-muted-foreground',
        className
      ) }
      { ...props }
    />
  )
);
Kbd.displayName = 'Kbd';

export { Kbd };

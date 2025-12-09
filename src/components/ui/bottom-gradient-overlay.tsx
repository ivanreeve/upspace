'use client';

import React from 'react';

import { useSidebar } from '@/components/ui/sidebar';
import { cn } from '@/lib/utils';

type BottomGradientOverlayProps = {
  heightClassName?: string
  className?: string
};

export function BottomGradientOverlay({
  heightClassName = 'h-[20vh]',
  className,
}: BottomGradientOverlayProps) {
  const {
 state, isMobile, 
} = useSidebar();

  const overlayStyles = React.useMemo<React.CSSProperties>(() => {
    if (isMobile) {
      return {
 left: 0,
right: 0, 
};
    }

    const sidebarOffset = state === 'collapsed'
      ? 'var(--sidebar-width-icon)'
      : 'var(--sidebar-width)';

    return {
      left: sidebarOffset,
      right: 0,
    };
  }, [isMobile, state]);

  return (
    <div
      aria-hidden="true"
      style={ overlayStyles }
      className={ cn(
        'pointer-events-none fixed bottom-0 z-30 bg-gradient-to-t from-background via-background/50 to-background/0',
        heightClassName,
        className
      ) }
    />
  );
}

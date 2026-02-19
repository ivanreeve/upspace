'use client';

import type { CSSProperties } from 'react';
import { useEffect, useState } from 'react';
import { ArrowUp } from 'lucide-react';

import { Button } from '@/components/ui/button';

export default function BackToTopButton() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const toggleVisibility = () => setVisible(window.scrollY > 400);
    window.addEventListener('scroll', toggleVisibility, { passive: true, });
    return () => window.removeEventListener('scroll', toggleVisibility);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    });
  };

  if (!visible) return null;

  const positioningStyles = { bottom: 'calc(var(--back-to-top-offset) + var(--safe-area-bottom))', } as CSSProperties;

  return (
    <Button
      onClick={ scrollToTop }
      style={ positioningStyles }
      className="fixed left-1/2 right-auto z-50 flex w-max -translate-x-1/2 rounded-md px-4 shadow-md
                 bg-foreground/70 backdrop-blur dark:bg-foreground/20 dark:hover:bg-secondary/20
                 hover:bg-foreground transition-all duration-300 [--back-to-top-offset:1.5rem]
                 md:[--back-to-top-offset:1.5rem] md:left-auto md:right-6 md:translate-x-0"
    >
      <ArrowUp className="h-5" /> Back to Top
    </Button>
  );
}

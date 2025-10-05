'use client';

import { useEffect, useState } from 'react';
import { ArrowUp } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function BackToTopButton() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const toggleVisibility = () => setVisible(window.scrollY > 400);
    window.addEventListener('scroll', toggleVisibility);
    return () => window.removeEventListener('scroll', toggleVisibility);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (!visible) return null;

  return (
    <Button
      onClick={scrollToTop}
      className="fixed bottom-6 right-6 rounded-md shadow-md z-50 
                 bg-foreground/70 backdrop-blur dark:bg-foreground/20 dark:hover:bg-secondary/20
                 hover:bg-foreground transition-all duration-300"
    >
      <ArrowUp className="h-5" /> Back to Top
    </Button>
  );
}

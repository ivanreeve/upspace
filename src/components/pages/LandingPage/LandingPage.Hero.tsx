'use client';

import Image from 'next/image';
import { useEffect, useMemo, useState } from 'react';

import SignInCard from '@/components/auth/SignInCard';

const CAROUSEL_INTERVAL_MS = 5000;

export function Hero() {
  const heroImages = useMemo(
    () => [
      {
        src: '/img/hero-featured-dark-1.png',
        alt: 'Floor-to-ceiling windows overlooking the city skyline.',
      },
      {
        src: '/img/hero-featured-dark-2.png',
        alt: 'Minimalist workspace setup with warm lighting.',
      },
      {
        src: '/img/hero-featured-dark-3.png',
        alt: 'Collaborative team meeting in a modern office.',
      },
      {
        src: '/img/hero-featured-dark-4.png',
        alt: 'Quiet lounge area with comfortable seating.',
      }
    ],
    []
  );

  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    if (heroImages.length === 1) {
      return;
    }

    const intervalId = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % heroImages.length);
    }, CAROUSEL_INTERVAL_MS);

    return () => window.clearInterval(intervalId);
  }, [heroImages]);

  return (
    <div id="home" className="flex flex-col lg:flex-row h-auto lg:h-[900px] items-center py-8 lg:py-0">
      { /* Left container */ }
      <div className="flex-1 flex flex-col items-center justify-center px-4 lg:px-0">
        <h1 className="text-[3.25rem] lg:text-[3.5rem] text-center font-instrument-serif leading-tight">
          Find the Perfect Space<br />for Meaningful Work
        </h1>
        <span className="font-serif text-sm sm:text-base">Smarter. Faster. Easier.</span>
        <br />
        <SignInCard className="w-full max-w-sm" />
      </div>

      { /* Right container - Hidden on mobile */ }
      <div className="relative hidden lg:flex flex-1 items-center justify-center bg-background rounded-lg h-[720px] overflow-hidden">
        { heroImages.map(({
 alt, src, 
}, index) => (
          <Image
            key={ src }
            src={ src }
            alt={ alt }
            sizes="(min-width: 1024px) 50vw, 100vw"
            fill
            priority={ index === 0 }
            className={ `object-cover transition-opacity duration-700 ease-in-out ${
              activeIndex === index ? 'opacity-100' : 'opacity-0'
            }` }
          />
        )) }
      </div>
    </div>
  );
}

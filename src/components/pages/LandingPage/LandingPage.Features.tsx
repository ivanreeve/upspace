'use client';

import {
useEffect,
useMemo,
useRef,
useState
} from 'react';
import Image from 'next/image';

type FeatureSlide = {
  title: string;
  description: string;
  lightImage: string;
  darkImage: string;
  layout?: 'stack' | 'split';
};

const SLIDE_INTERVAL_MS = 8000;

export function Features() {
  const slides = useMemo<FeatureSlide[]>(
    () => [
      {
        title: 'Discover and Book Coworking Spaces',
        description:
          'This is a description of the features of the product. It highlights the key functionalities and benefits that users can expect.',
        lightImage: '/img/feature-light-1.svg',
        darkImage: '/img/feature-dark-1.svg',
      },
      {
        title: 'Manage Team Reservations Effortlessly',
        description:
          'Coordinate schedules across teams with shared calendars, smart reminders, and real-time availability across all locations.',
        lightImage: '/img/feature-light-2.svg',
        darkImage: '/img/feature-dark-2.svg',
        layout: 'stack',
      },
      {
        title: 'Track Utilization and Insights',
        description:
          'Get full visibility into bookings, usage trends, and occupancy analytics to optimize your workplace strategy.',
        lightImage: '/img/feature-light-1.svg',
        darkImage: '/img/feature-dark-1.svg',
      }
    ],
    []
  );

  const slidesWithLoop = useMemo(
    () => (slides.length > 0 ? [...slides, slides[0]] : slides),
    [slides]
  );
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(true);
  const transitionResetFrame = useRef<number>();

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentIndex((prev) => prev + 1);
    }, SLIDE_INTERVAL_MS);

    return () => clearInterval(timer);
  }, [slides.length]);

  useEffect(
    () => () => {
      if (transitionResetFrame.current) {
        cancelAnimationFrame(transitionResetFrame.current);
      }
    },
    []
  );

  const handleTransitionEnd = () => {
    if (currentIndex === slides.length) {
      setIsTransitioning(false);
      transitionResetFrame.current = requestAnimationFrame(() => {
        setCurrentIndex(0);
        transitionResetFrame.current = requestAnimationFrame(() => {
          setIsTransitioning(true);
        });
      });
    }
  };

  return (
    <div
      id='features'
      className='w-full min-h-[1024px] flex items-center justify-center py-24 lg:py-32'
    >
      <div className='relative w-full overflow-hidden'>
        <div
          className={ `flex ${
            isTransitioning
              ? 'transition-transform duration-700 ease-in-out'
              : 'transition-none'
          }` }
          style={ { transform: `translateX(-${currentIndex * 100}%)`, } }
          onTransitionEnd={ handleTransitionEnd }
        >
          { slidesWithLoop.map((slide, index) => {
            const isClone = index === slidesWithLoop.length - 1;

            return (
              <div
                key={ isClone ? `${slide.title}-clone` : slide.title }
                className={ `w-full flex ${
                  slide.layout === 'stack'
                    ? 'flex-col items-center justify-start text-center gap-4'
                    : 'flex-col-reverse lg:flex-row items-center lg:items-start justify-start text-center lg:text-left gap-12'
                } px-6 flex-shrink-0` }
              >
                { /* Right container - Hidden on mobile */ }
                <div
                  className={ `relative ${
                    slide.layout === 'stack'
                      ? 'flex w-full max-w-[640px]'
                      : 'hidden lg:flex flex-none w-[640px]'
                  } items-center justify-center bg-background h-[500px] overflow-hidden` }
                >
                  <Image
                    src={ slide.lightImage }
                    alt={ slide.title }
                    sizes='(min-width: 1024px) 50vw, 100vw'
                    fill
                    priority={ index === 0 }
                    className='object-contain dark:hidden'
                  />
                  <Image
                    src={ slide.darkImage }
                    alt={ slide.title }
                    sizes='(min-width: 1024px) 50vw, 100vw'
                    fill
                    className='hidden object-contain dark:block'
                  />
                </div>

                <div
                  className={ `flex-1 flex flex-col gap-5 w-full lg:max-w-3xl ${
                    slide.layout === 'stack'
                      ? 'items-center text-center order-first'
                      : 'items-center lg:items-start text-center lg:text-left'
                  }` }
                >
                  <h1 className='text-[3.25rem] lg:text-[3.5rem] font-instrument-serif leading-tight'>
                    { slide.title }
                  </h1>
                  <p className='text-lg lg:text-xl max-w-2xl'>
                    { slide.description }
                  </p>
                </div>
              </div>
            );
          }) }
        </div>
      </div>
    </div>
  );
}

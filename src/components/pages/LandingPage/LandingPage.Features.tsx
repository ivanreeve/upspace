'use client';

import {
useEffect,
useMemo,
useRef,
useState
} from 'react';
import type { JSX } from 'react';
import Image from 'next/image';

import { SemanticSearchIcon } from './LandingPage.Feature.SemanticSearchIcon';

type FeatureSlide = {
  title: string;
  description: string;
  lightImage?: string;
  darkImage?: string;
  component?: () => JSX.Element;
  layout?: 'stack' | 'split' | 'overlay';
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
        title: 'Semantic Search Insights',
        description:
          'Surface the most relevant spaces instantly with vector-powered results that understand intent, not just keywords.',
        component: SemanticSearchIcon,
        layout: 'overlay',
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
  const transitionResetFrame = useRef<number | null>(null);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentIndex((prev) => prev + 1);
    }, SLIDE_INTERVAL_MS);

    return () => clearInterval(timer);
  }, [slides.length]);

  useEffect(
    () => () => {
      if (transitionResetFrame.current !== null) {
        cancelAnimationFrame(transitionResetFrame.current);
        transitionResetFrame.current = null;
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
          transitionResetFrame.current = null;
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
            const FeatureComponent = slide.component;

            if (slide.layout === 'overlay' && FeatureComponent) {
              return (
                <div
                  key={ isClone ? `${slide.title}-clone` : slide.title }
                  className="w-full px-6 flex-shrink-0"
                >
                  <div className="relative flex h-[500px] w-full items-center justify-center overflow-hidden rounded-3xl bg-background">
                    <div className="absolute top-6 left-6 text-left">
                      <h1 className="text-[2.5rem] sm:text-[3rem] lg:text-[3.5rem] font-instrument-serif leading-tight">
                        { slide.title }
                      </h1>
                    </div>
                    <div className="absolute bottom-6 right-6 max-w-sm text-right">
                      <p className="text-base sm:text-lg lg:text-xl">
                        { slide.description }
                      </p>
                    </div>
                    <div className="flex h-full w-full items-center justify-center">
                      <FeatureComponent />
                    </div>
                  </div>
                </div>
              );
            }

            const isStack = slide.layout === 'stack';
            const {
 lightImage, darkImage, 
} = slide;

            return (
              <div
                key={ isClone ? `${slide.title}-clone` : slide.title }
                className={ `w-full flex ${
                  isStack
                    ? 'flex-col items-center justify-start text-center gap-4'
                    : 'flex-col-reverse lg:flex-row items-center lg:items-start justify-start text-center lg:text-left gap-12'
                } px-6 flex-shrink-0` }
              >
                { /* Right container - Hidden on mobile */ }
                { lightImage && darkImage ? (
                  <div
                    className={ `relative ${
                      isStack
                        ? 'flex w-full max-w-[640px]'
                        : 'hidden lg:flex flex-none w-[640px]'
                    } items-center justify-center bg-background h-[500px] overflow-hidden` }
                  >
                    <Image
                      src={ lightImage }
                      alt={ slide.title }
                      sizes='(min-width: 1024px) 50vw, 100vw'
                      fill
                      priority={ index === 0 }
                      className='object-contain dark:hidden'
                    />
                    <Image
                      src={ darkImage }
                      alt={ slide.title }
                      sizes='(min-width: 1024px) 50vw, 100vw'
                      fill
                      className='hidden object-contain dark:block'
                    />
                  </div>
                ) : null }

                <div
                  className={ `flex-1 flex flex-col gap-5 w-full lg:max-w-3xl ${
                    isStack
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

'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { TbWorldSearch } from 'react-icons/tb';

import { cn } from '@/lib/utils';


interface CallToActionProps {
  title: string;
  description: string;
  buttonText: string;
  buttonHref: string;
  className?: string;
}

function CallToActionBase({
  title,
  description,
  buttonText,
  buttonHref,
  className,
}: CallToActionProps) {
  return (
    <section
      className={ cn(
        'relative overflow-hidden rounded-lg text-left min-h-[24rem] sm:min-h-[28rem] md:min-h-[50vh]',
        'px-6 py-10 sm:px-8 sm:py-12 lg:px-16',
        'flex flex-col items-start justify-start gap-8 md:gap-10 xl:gap-12',
        'text-white',
        className
      ) }
    >
      <Image
        src="/img/cta-bg.png"
        alt=""
        fill
        priority
        sizes="100vw"
        className="object-cover"
      />

      <div
        className={ cn(
          'absolute inset-y-0 left-0 w-full pointer-events-none',
          'bg-[linear-gradient(to_right,rgba(0,0,0,0.94)_0%,rgba(0,0,0,0.8)_55%,rgba(0,0,0,0.4)_90%,rgba(0,0,0,0)_100%)]',
          'lg:bg-[linear-gradient(to_right,rgba(0,0,0,0.95)_0%,rgba(0,0,0,0.8)_50%,rgba(0,0,0,0.5)_88%,rgba(0,0,0,0)_100%)]'
        ) }
        aria-hidden="true"
      />

      <div className="relative z-10 flex flex-col gap-8 md:gap-12 max-w-[48rem]">
        <div>
          <h2 className="text-4xl sm:text-5xl md:text-[4rem] lg:text-[5rem] tracking-tight font-instrument-serif">
            { title }
          </h2>
          <p className="mt-4 max-w-2xl text-base sm:text-lg md:text-xl text-white/90">
            { description }
          </p>
        </div>
        <div className="w-full sm:w-auto">
          <Link
            href={ buttonHref }
            className={ cn(
              'relative inline-flex w-full sm:w-auto items-center justify-center bg-transparent border-2 border-white text-white',
              'px-5 py-3 text-sm sm:px-6 sm:py-3 sm:text-base font-medium transition-colors hover:bg-white active:bg-white active:text-transparent hover:text-black',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring gap-2'
            ) }
          >
            <TbWorldSearch size={ 18 } /> { buttonText }
          </Link>
        </div>
      </div>
    </section>
  );
}

export default function CallToAction() {
  return (
    <div className="py-32">
      <CallToActionBase
        title="Discover Your Ideal Workspace"
        description="Whether you're searching for the perfect desk or offering one, connect with our thriving community of professionals and workspace partners."
        buttonText="Start Exploring"
        buttonHref="/marketplace"
      />
    </div>
  );
}

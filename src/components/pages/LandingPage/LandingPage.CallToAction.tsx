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
        'relative overflow-hidden rounded-lg px-16 py-12 text-left min-h-[50vh]',
        'flex flex-col items-start justify-start gap-6 md:gap-8',
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
          'bg-[linear-gradient(to_right,rgba(0,0,0,0.95)_0%,rgba(0,0,0,0.75)_45%,rgba(0,0,0,0.45)_80%,rgba(0,0,0,0)_100%)]',
          'xl:bg-[linear-gradient(to_right,rgba(0,0,0,0.95)_0%,rgba(0,0,0,0.8)_50%,rgba(0,0,0,0.5)_88%,rgba(0,0,0,0)_100%)]'
        ) }
        aria-hidden="true"
      />

      <div className="relative z-10 flex flex-col gap-12">
        <div>
          <h2 className="text-[5rem] tracking-tight font-instrument-serif">
            { title }
          </h2>
          <p className="max-w-2xl text-base md:text-lg text-white/90">
            { description }
          </p>
        </div>
        <div>
          <Link
            href={ buttonHref }
            className={ cn(
              'relative inline-flex items-center justify-center bg-transparent border-2 border-white text-white',
              'px-6 py-3 font-medium transition-colors hover:bg-white active:bg-white active:text-transparent hover:text-black',
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
        buttonHref="/"
      />
    </div>
  );
}

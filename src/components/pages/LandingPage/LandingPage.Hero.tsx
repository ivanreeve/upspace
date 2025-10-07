import Image from 'next/image';

import SignInCard from '@/components/auth/SignInCard';

export function Hero() {
  return (
    <div className="flex flex-col lg:flex-row h-auto lg:h-[90vh] items-center py-8 lg:py-0">
      { /* Left container */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 lg:px-0">
        <h1 className="text-3xl sm:text-4xl lg:text-[4rem] text-center font-instrument-serif">
          Find the Perfect Space<br />for Work
        </h1>
        <span className="font-serif text-sm sm:text-base">Smarter. Faster. Easier.</span>
        <br />
        <SignInCard />
      </div>

      { /* Right container - Hidden on mobile */}
      <div className="relative hidden lg:flex flex-1 items-center justify-center bg-background rounded-lg h-[720px] overflow-hidden">
        <Image
          src="/img/hero-featured-dark.png"
          alt="Admiring the vast expanse."
          sizes="(min-width: 1024px) 50vw, 100vw"
          fill
          priority
          className='object-cover'
        />
      </div>
    </div>
  );
}

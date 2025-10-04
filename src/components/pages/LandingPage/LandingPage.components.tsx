import Image from 'next/image';

import SignInCard from '@/components/auth/SignInCard';

export function Hero() {
  return (
    <div className="flex h-[90vh] items-center">
      { /* Left container */ }
      <div className="flex-1 flex flex-col items-center justify-center">
        <h1 className="text-[4rem] text-center font-instrument-serif">
          Find the Perfect Space<br />for Work
        </h1>
        <span className="font-serif">Smarter. Faster. Easier.</span>
        <br />
        <SignInCard />
      </div>

      { /* Right container */ }
      <div className="relative flex-1 flex items-center justify-center bg-blue-300 rounded-lg h-[720px] overflow-hidden">
        <Image
          src="/img/hero-featured-dark.png"
          alt="Admiring the vast expanse."
          fill
          sizes="(min-width: 1024px) 50vw, 100vw"
          priority
        />
      </div>
    </div>
  );
}

export function Features() {
  return (
    <div className='max-w-[1200px] h-screen mx-auto flex items-center justify-center'>
      <h1 className="text-[4rem] text-center">Features</h1>
    </div>
  );
}

export function FAQs() {
  return (
    <div className='max-w-[1200px] h-screen mx-auto flex items-center justify-center'>
      <h1 className="text-[4rem] text-center">Frequently Asked Questions</h1>
    </div>
  );
}

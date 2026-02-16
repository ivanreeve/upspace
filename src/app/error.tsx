'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { FiArrowLeft } from 'react-icons/fi';

import { MarketplaceErrorState } from '@/components/pages/Marketplace/Marketplace.ErrorState';
import { Button } from '@/components/ui/button';
import { Footer } from '@/components/ui/footer';

type GlobalErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function GlobalError({
 error, reset, 
}: GlobalErrorProps) {
  useEffect(() => {
    console.error('Global application error', error);
  }, [error]);

  return (
    <div className="bg-background">
      <div className="mx-auto flex min-h-screen max-w-5xl flex-col items-center justify-center space-y-5 px-4 pb-16 pt-12 text-center">
        <MarketplaceErrorState
          onRetry={ reset }
          className="w-full"
          illustrationClassName="max-w-[320px] sm:max-w-[380px]"
        />
        <div className="mt-[-36px] flex justify-center ">
          <Button asChild aria-label="Go back home">
            <Link href="/">
              <FiArrowLeft className="size-4 " aria-hidden="true" />
              Go back home
            </Link>
          </Button>
        </div>
      </div>
      <Footer />
    </div>
  );
}

'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { FiArrowLeft, FiRefreshCw } from 'react-icons/fi';

import { MarketplaceErrorState } from '@/components/pages/Marketplace/Marketplace.ErrorState';
import { SpacesChrome } from '@/components/pages/Spaces/SpacesChrome';
import { Button } from '@/components/ui/button';
import { Footer } from '@/components/ui/footer';

type SpacesErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function SpacesError({
  error,
  reset,
}: SpacesErrorProps) {
  useEffect(() => {
    console.error('Failed to render spaces page', error);
  }, [error]);

  return (
    <SpacesChrome>
      <div className="bg-background">
        <div className="mx-auto flex max-w-6xl flex-col items-center space-y-5 px-4 pb-16 pt-10 text-center">
          <MarketplaceErrorState illustrationClassName="max-w-[140px] sm:max-w-[10px]" />
          <div className="mt-[-32px] sm:mt-[-40px] flex flex-wrap justify-center gap-3">
            <Button onClick={ () => reset() } aria-label="Retry loading spaces">
              <FiRefreshCw className="size-4" aria-hidden="true" />
              Retry
            </Button>
            <Button asChild variant="outline" aria-label="Go back to marketplace">
              <Link href="/marketplace">
                <FiArrowLeft className="size-4" aria-hidden="true" />
                Go back to marketplace
              </Link>
            </Button>
          </div>
        </div>
      </div>
      <Footer />
    </SpacesChrome>
  );
}

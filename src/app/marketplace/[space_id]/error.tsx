'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { FiArrowLeft } from 'react-icons/fi';

import { MarketplaceErrorState } from '@/components/pages/Marketplace/Marketplace.ErrorState';
import { Button } from '@/components/ui/button';
import { Footer } from '@/components/ui/footer';

type SpaceDetailErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function SpaceDetailError({ error, reset: _reset, }: SpaceDetailErrorProps) {
  useEffect(() => {
    console.error('Failed to render marketplace space detail page', error);
  }, [error]);

  return (
    <>
      <main className="bg-background">
        <div className="mx-auto flex max-w-[1100px] flex-col items-center space-y-5 px-4 py-16">
          <MarketplaceErrorState />
          <div className="mt-[-54px] flex justify-center">
            <Button asChild variant="outline" aria-label="Go back to marketplace">
              <Link href="/marketplace">
                <FiArrowLeft className="size-4" aria-hidden="true" />
                Go back to marketplace
              </Link>
            </Button>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}

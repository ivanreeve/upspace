'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { FiArrowLeft } from 'react-icons/fi';

import { MarketplaceErrorState } from '@/components/pages/Marketplace/Marketplace.ErrorState';
import { SpaceDetailShell } from '@/components/pages/Marketplace/SpaceDetail/SpaceDetailShell';
import { Button } from '@/components/ui/button';
import { Footer } from '@/components/ui/footer';

type SpaceDetailErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function SpaceDetailError({
  error,
  reset,
}: SpaceDetailErrorProps) {
  useEffect(() => {
    console.error('Failed to render marketplace space detail page', error);
  }, [error]);

  return (
    <SpaceDetailShell>
      <div className="bg-background">
        <div className="mx-auto flex max-w-[1100px] flex-col items-center space-y-6 px-4 pb-16">
          <MarketplaceErrorState onRetry={ reset } />
          <div className="flex justify-center">
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
    </SpaceDetailShell>
  );
}

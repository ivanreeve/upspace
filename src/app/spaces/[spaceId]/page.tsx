'use client';

import { FiArrowLeft } from 'react-icons/fi';
import Link from 'next/link';
import { useParams } from 'next/navigation';

import { SpaceDetailsPanel } from '@/components/pages/Spaces/SpaceDetailsPanel';
import { MarketplaceChrome } from '@/components/pages/Marketplace/MarketplaceChrome';
import { Button } from '@/components/ui/button';

export default function SpaceDetailRoute() {
  const params = useParams<{ spaceId: string }>();
  const spaceId = params?.spaceId ?? '';

  return (
    <MarketplaceChrome>
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm uppercase tracking-wide text-muted-foreground">Space overview</p>
            <h1 className="text-3xl font-semibold tracking-tight">Manage space</h1>
            <p className="text-base text-muted-foreground">Review the stored attributes below, edit them, or add new areas.</p>
          </div>
          <Button asChild variant="outline">
            <Link href="/spaces" className="inline-flex items-center gap-2">
              <FiArrowLeft className="size-4" aria-hidden="true" />
              Back to spaces
            </Link>
          </Button>
        </div>

        <SpaceDetailsPanel spaceId={ spaceId } className="mt-8" />
      </div>
    </MarketplaceChrome>
  );
}

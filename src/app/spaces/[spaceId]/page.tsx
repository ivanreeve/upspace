'use client';

import { FiArrowLeft } from 'react-icons/fi';
import Link from 'next/link';
import { useParams } from 'next/navigation';

import { SpaceDetailsPanel } from '@/components/pages/Spaces/SpaceDetailsPanel';
import { SpacesChrome } from '@/components/pages/Spaces/SpacesChrome';
import { Button } from '@/components/ui/button';

export default function SpaceDetailRoute() {
  const params = useParams<{ spaceId: string }>();
  const spaceId = params?.spaceId ?? '';

  return (
    <SpacesChrome>
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
          <div className="space-y-1">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground md:text-sm">Space overview</p>
            <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Manage space</h1>
            <p className="text-sm text-muted-foreground md:text-base">Review the stored attributes below, edit them, or add new areas.</p>
          </div>
          <Button asChild variant="outline" size="sm" className="w-full sm:w-auto">
            <Link href="/spaces" className="inline-flex items-center gap-2">
              <FiArrowLeft className="size-4" aria-hidden="true" />
              Back to spaces
            </Link>
          </Button>
        </div>

        <SpaceDetailsPanel spaceId={ spaceId } className="mt-6 md:mt-8" />
      </div>
    </SpacesChrome>
  );
}

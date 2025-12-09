'use client';

import { Skeleton } from '@/components/ui/skeleton';
import { usePartnerSpaceQuery } from '@/hooks/api/usePartnerSpaces';
import { cn } from '@/lib/utils';

type SpaceNameHeadingProps = {
  spaceId: string;
  className?: string;
};

export function SpaceNameHeading({
  spaceId,
  className,
}: SpaceNameHeadingProps) {
  const {
    data: space,
    isLoading,
    isError,
  } = usePartnerSpaceQuery(spaceId);

  return (
    <h1 className={ cn('text-2xl font-semibold tracking-tight md:text-3xl', className) }>
      { isLoading ? (
        <>
          <Skeleton
            className="inline-block h-7 w-48 rounded-md md:h-8"
            aria-hidden="true"
          />
          <span className="sr-only">Loading space name</span>
        </>
      ) : isError ? (
        'Space unavailable'
      ) : (
        space?.name ?? 'Space'
      ) }
    </h1>
  );
}

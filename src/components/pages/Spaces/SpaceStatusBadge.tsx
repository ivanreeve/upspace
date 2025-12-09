'use client';

import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { usePartnerSpaceQuery } from '@/hooks/api/usePartnerSpaces';
import { cn } from '@/lib/utils';
import type { SpaceStatus } from '@/data/spaces';

type SpaceStatusBadgeProps = {
  spaceId: string;
  className?: string;
};

const statusVariant = (status?: SpaceStatus) => {
  if (status === 'Live') return 'success';
  if (status === 'Unpublished') return 'destructive';
  return 'outline';
};

export function SpaceStatusBadge({
  spaceId,
  className,
}: SpaceStatusBadgeProps) {
  const {
    data: space,
    isLoading,
    isError,
  } = usePartnerSpaceQuery(spaceId);

  if (isLoading) {
    return (
      <div className={ cn('flex items-center gap-2', className) }>
        <Skeleton
          className="h-5 w-20 rounded-md"
          aria-hidden="true"
        />
        <span className="sr-only">Loading space status</span>
      </div>
    );
  }

  const statusLabel = space?.status ?? 'Status unavailable';

  return (
    <div className={ cn('flex flex-wrap items-center gap-2', className) }>
      <Badge variant={ statusVariant(space?.status) }>{ statusLabel }</Badge>
      { !isError && space?.pending_unpublish_request ? (
        <span className="text-xs font-medium text-amber-600">
          Unpublish request pending admin review
        </span>
      ) : null }
    </div>
  );
}

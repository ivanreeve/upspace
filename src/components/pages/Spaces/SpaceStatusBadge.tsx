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

const SPACE_STATUS_BADGE_CLASSNAME: Record<SpaceStatus, string> = {
  Live: 'border-emerald-600/40 bg-emerald-50 text-emerald-700 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-400',
  Pending: 'border-amber-600/40 bg-amber-50 text-amber-700 dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-400',
  Draft: 'border-slate-500/40 bg-slate-100 text-slate-700 dark:border-slate-400/20 dark:bg-slate-400/10 dark:text-slate-400',
  Unpublished: 'border-rose-600/40 bg-rose-50 text-rose-700 dark:border-rose-400/20 dark:bg-rose-400/10 dark:text-rose-400',
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
      <Badge
        variant="outline"
        className={ space?.status ? SPACE_STATUS_BADGE_CLASSNAME[space.status] : '' }
      >
        { statusLabel }
      </Badge>
      { !isError && space?.pending_unpublish_request ? (
        <span className="text-xs font-medium text-amber-600 dark:text-amber-500/90">
          Unpublish request pending admin review
        </span>
      ) : null }
    </div>
  );
}

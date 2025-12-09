'use client';

import Link from 'next/link';
import { useMemo, type ComponentProps } from 'react';
import {
  FiBell,
  FiCalendar,
  FiClock,
  FiUser
} from 'react-icons/fi';

import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { usePartnerDashboardFeedQuery } from '@/hooks/api/usePartnerDashboardFeed';
import type { BookingFeedItem, DashboardFeedItem, NotificationFeedItem } from '@/types/dashboard-feed';
import { cn } from '@/lib/utils';
import type { BookingStatus } from '@/lib/bookings/types';

const bookingStatusVariant: Record<BookingStatus, ComponentProps<typeof Badge>['variant']> = {
  confirmed: 'success',
  pending: 'secondary',
  cancelled: 'destructive',
  rejected: 'destructive',
  expired: 'outline',
  checkedin: 'success',
  checkedout: 'secondary',
  completed: 'outline',
  noshow: 'destructive',
};

const currencyFormatter = new Intl.NumberFormat('en-PH', {
  style: 'currency',
  currency: 'PHP',
  maximumFractionDigits: 0,
});

const timestampFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
});

const relativeFormatter = new Intl.RelativeTimeFormat('en', { numeric: 'auto', });

const timeUnits: { unit: Intl.RelativeTimeFormatUnit; ms: number }[] = [
  {
    unit: 'minute',
    ms: 60 * 1000,
  },
  {
    unit: 'hour',
    ms: 60 * 60 * 1000,
  },
  {
    unit: 'day',
    ms: 24 * 60 * 60 * 1000,
  },
  {
    unit: 'week',
    ms: 7 * 24 * 60 * 60 * 1000,
  }
];

const formatRelativeTime = (isoTimestamp: string) => {
  const now = Date.now();
  const value = new Date(isoTimestamp).getTime();
  const deltaMs = value - now;
  const absMs = Math.abs(deltaMs);

  for (const {
    unit,
    ms,
  } of timeUnits) {
    if (absMs < ms * (unit === 'minute' ? 1 : 2)) {
      const amount = Math.round(deltaMs / ms);
      return relativeFormatter.format(amount, unit);
    }
  }

  const weeks = deltaMs / timeUnits[3].ms;
  return relativeFormatter.format(Math.round(weeks), 'week');
};

const FeedSkeleton = () => (
  <div className="space-y-2">
    { Array.from({ length: 4, }).map((_, index) => (
      <div
        key={ `feed-skeleton-${ index }` }
        className="flex items-start gap-3 rounded-md border border-border/60 bg-background/60 p-3"
        aria-hidden="true"
      >
        <Skeleton className="size-9 rounded-md" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-48 rounded-md" />
          <Skeleton className="h-3 w-36 rounded-md" />
          <Skeleton className="h-3 w-24 rounded-md" />
        </div>
      </div>
    )) }
  </div>
);

const BookingFeedRow = ({ item, }: { item: BookingFeedItem }) => {
  const priceLabel = useMemo(() => {
    if (item.price === null) {
      return null;
    }
    return currencyFormatter.format(item.price);
  }, [item.price]);

  return (
    <Link
      href={ item.href }
      className="group flex items-start gap-3 rounded-md border border-border/60 bg-background/70 p-3 transition hover:border-primary/50 hover:bg-primary/5 focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
    >
      <div className="rounded-md bg-primary/10 p-2 text-primary">
        <FiCalendar className="size-4" aria-hidden="true" />
      </div>
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-semibold leading-tight text-foreground">
            { item.title }
          </p>
          <Badge
            variant={ bookingStatusVariant[item.status] }
            className="text-[10px] uppercase tracking-wide"
          >
            { item.status }
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground">
          { item.body }
          { priceLabel ? ` · ${ priceLabel }` : '' }
        </p>
        { item.customerHandle || item.customerName ? (
          <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
            <FiUser className="size-3.5" aria-hidden="true" />
            <span>{ item.customerHandle ? `@${ item.customerHandle }` : item.customerName }</span>
          </div>
        ) : null }
        <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
          <FiClock className="size-3.5" aria-hidden="true" />
          <span>{ formatRelativeTime(item.createdAt) }</span>
          <span aria-hidden="true">·</span>
          <span>{ timestampFormatter.format(new Date(item.createdAt)) }</span>
        </div>
      </div>
    </Link>
  );
};

const NotificationFeedRow = ({ item, }: { item: NotificationFeedItem }) => (
  <Link
    href={ item.href }
    className="group flex items-start gap-3 rounded-md border border-border/60 bg-background/70 p-3 transition hover:border-primary/50 hover:bg-primary/5 focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
  >
    <div className={ cn(
      'rounded-md p-2',
      item.read ? 'bg-muted text-muted-foreground' : 'bg-secondary/20 text-secondary'
    ) }
    >
      <FiBell className="size-4" aria-hidden="true" />
    </div>
    <div className="min-w-0 flex-1 space-y-1">
      <div className="flex items-center gap-2">
        <p className="text-sm font-semibold leading-tight text-foreground">
          { item.title }
        </p>
        { item.read ? null : (
          <Badge variant="secondary" className="text-[10px] uppercase tracking-wide">
            New
          </Badge>
        ) }
      </div>
      <p className="text-xs text-muted-foreground">{ item.body }</p>
      <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
        <FiClock className="size-3.5" aria-hidden="true" />
        <span>{ formatRelativeTime(item.createdAt) }</span>
        <span aria-hidden="true">·</span>
        <span>{ timestampFormatter.format(new Date(item.createdAt)) }</span>
      </div>
    </div>
  </Link>
);

export function PartnerDashboardFeed({ limit = 20, }: { limit?: number }) {
  const {
    data,
    isLoading,
    isError,
    error,
  } = usePartnerDashboardFeedQuery(limit);

  if (isLoading) {
    return <FeedSkeleton />;
  }

  if (isError) {
    return (
      <p className="text-sm text-destructive" role="status">
        { error?.message ?? 'Unable to load dashboard feed.' }
      </p>
    );
  }

  if (!data?.length) {
    return (
      <p className="text-sm text-muted-foreground">
        No recent bookings or notifications yet. They will appear here once activity starts.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      { data.map((item) => {
        if (item.type === 'booking') {
          return <BookingFeedRow key={ `booking-${ item.id }` } item={ item } />;
        }

        return <NotificationFeedRow key={ `notification-${ item.id }` } item={ item } />;
      }) }
    </div>
  );
}

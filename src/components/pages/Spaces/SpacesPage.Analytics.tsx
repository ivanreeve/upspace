'use client';

import { useCallback, useMemo, useState } from 'react';
import { format, subDays } from 'date-fns';
import { FiArrowDown, FiArrowUpRight, FiSearch } from 'react-icons/fi';

import { PartnerDashboardFeed } from './PartnerDashboardFeed';
import { SpacesBreadcrumbs } from './SpacesBreadcrumbs';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { usePartnerBookingsQuery } from '@/hooks/api/useBookings';
import { usePartnerDashboardFeedQuery } from '@/hooks/api/usePartnerDashboardFeed';
import { usePartnerSpacesQuery } from '@/hooks/api/usePartnerSpaces';
import type { BookingStatus } from '@/lib/bookings/types';

type DateRangeKey = 'today' | '7d' | '30d' | 'custom';
type BookingTypeKey = 'all' | 'hourly' | 'daily';
type SortKey =
  | 'bookings'
  | 'revenue'
  | 'cancellationRate'
  | 'lastUpdated';

type NumericSortKey = Exclude<SortKey, 'lastUpdated'>;
const BOOKING_STATUS_ORDER: BookingStatus[] = [
  'pending',
  'confirmed',
  'checkedin',
  'checkedout',
  'completed',
  'cancelled',
  'rejected',
  'expired',
  'noshow'
];

const DATE_RANGE_PRESETS: {
  label: string;
  value: DateRangeKey;
}[] = [
  {
    label: 'Today',
    value: 'today',
  },
  {
    label: 'Last 7 days',
    value: '7d',
  },
  {
    label: 'Last 30 days',
    value: '30d',
  },
  {
    label: 'Custom range',
    value: 'custom',
  }
];

function MiniBarChart({
  values,
  color,
  label,
}: {
  values: number[];
  color: string;
  label: string;
}) {
  const hasData = values.length > 0;
  const maxValue = hasData ? Math.max(...values, 1) : 1;

  if (!hasData) {
    return (
      <div className="w-full rounded-md border border-dashed p-4 text-sm text-muted-foreground">
        No chart data available.
      </div>
    );
  }

  return (
    <div className="w-full space-y-2" aria-label={ `Chart for ${label}` }>
      <div className="grid h-36 grid-cols-7 items-end gap-2 rounded-md border p-3">
        { values.map((value, index) => {
          const heightPercent = Math.max(6, Math.round((value / maxValue) * 100));
          return (
            <div
              key={ `${label}-bar-${index}` }
              className="flex h-full items-end"
            >
              <div
                className="w-full rounded-sm"
                style={ {
                  height: `${heightPercent}%`,
                  backgroundColor: color,
                  opacity: 0.85,
                } }
                aria-hidden="true"
              />
            </div>
          );
        }) }
      </div>
    </div>
  );
}

function ChangeBadge({ delta, }: { delta: number }) {
  const isPositive = delta >= 0;
  const Icon = isPositive ? FiArrowUpRight : FiArrowDown;
  return (
    <Badge
      variant="outline"
      className={ `flex items-center gap-1 text-xs font-semibold ${isPositive ? 'text-emerald-500 border-emerald-500/40' : 'text-destructive border-destructive/40'}` }
    >
      <Icon className="size-3" aria-hidden="true" />
      { isPositive ? `+${delta}%` : `${delta}%` }
    </Badge>
  );
}

function FunnelBar({
  label,
  value,
  percent,
  accent,
}: {
  label: string;
  value: number;
  percent: number;
  accent: string;
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs uppercase tracking-wide text-muted-foreground">
        <span>{ label }</span>
        <span className="text-foreground font-semibold">
          { value.toLocaleString() }
        </span>
      </div>
      <div className="h-2 rounded-full bg-border/60">
        <div
          className={ `h-full rounded-full ${accent}` }
          style={ { width: `${Math.min(100, percent)}%`, } }
        />
      </div>
    </div>
  );
}

const formatStatusLabel = (status: BookingStatus) =>
  status.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());

export function SpacesAnalyticsPanel() {
  const [dateRange, setDateRange] = useState<DateRangeKey>('7d');
  const [listingFilter, setListingFilter] = useState<string>('all');
  const [bookingType, setBookingType] = useState<BookingTypeKey>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('revenue');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  const formatInputDate = (date: Date) => date.toISOString().split('T')[0];
  const [customStart, setCustomStart] = useState(() =>
    formatInputDate(subDays(new Date(), 7))
  );
  const [customEnd, setCustomEnd] = useState(() => formatInputDate(new Date()));

  const {
    data: partnerBookings = [],
    isLoading: bookingsLoading,
    isError: bookingsError,
    error: bookingsErrorObj,
  } = usePartnerBookingsQuery();
  const {
    data: dashboardFeed = [],
    isLoading: feedLoading,
    isError: feedError,
  } = usePartnerDashboardFeedQuery(200);
  const {
    data: partnerSpaces = [],
    isLoading: spacesLoading,
    isError: spacesError,
  } = usePartnerSpacesQuery();
  const resolveStatusVariant = (status: BookingStatus) => {
    switch (status) {
      case 'confirmed':
      case 'checkedin':
        return 'success' as const;
      case 'pending':
      case 'checkedout':
      case 'completed':
        return 'secondary' as const;
      default:
        return 'destructive' as const;
    }
  };

  const liveListingSource = useMemo(() => {
    return partnerSpaces.map((space) => {
      const spaceBookings = partnerBookings.filter(
        (booking) => booking.spaceId === space.id
      );
      const revenue = spaceBookings.reduce(
        (sum, booking) => sum + (booking.price ?? 0),
        0
      );
      const bookings = spaceBookings.length;
      const cancellations = spaceBookings.filter((booking) =>
        ['cancelled', 'rejected', 'expired', 'noshow'].includes(booking.status)
      ).length;
      const lastUpdated =
        spaceBookings[0]?.createdAt ?? space.created_at ?? new Date().toISOString();

      return {
        id: space.id,
        name: space.name,
        status: space.status,
        views: 0,
        saves: 0,
        inquiries: 0,
        bookings,
        revenue,
        rating: 0,
        reviews: 0,
        cancellations,
        lastUpdated,
        bookingTypes: ['hourly', 'daily'],
      };
    });
  }, [partnerBookings, partnerSpaces]);

  const bookingStatusCounts = useMemo(() => {
    const base: Record<BookingStatus, number> = {
      confirmed: 0,
      pending: 0,
      cancelled: 0,
      rejected: 0,
      expired: 0,
      checkedin: 0,
      checkedout: 0,
      completed: 0,
      noshow: 0,
    };
    partnerBookings.forEach((booking) => {
      base[booking.status] += 1;
    });
    return base;
  }, [partnerBookings]);

  const totalBookingStatuses = useMemo(
    () => Object.values(bookingStatusCounts).reduce((sum, value) => sum + value, 0),
    [bookingStatusCounts]
  );

  const bookingStatusRows = useMemo(() => {
    return BOOKING_STATUS_ORDER.map((status) => {
      const count = bookingStatusCounts[status];
      const percent = totalBookingStatuses
        ? Math.round((count / totalBookingStatuses) * 100)
        : 0;

      let barClassName = 'bg-muted-foreground';
      if (['confirmed', 'checkedin', 'checkedout', 'completed'].includes(status)) {
        barClassName = 'bg-emerald-500';
      } else if (status === 'pending') {
        barClassName = 'bg-amber-500';
      } else if (['cancelled', 'rejected', 'expired', 'noshow'].includes(status)) {
        barClassName = 'bg-destructive';
      }

      return {
        status,
        count,
        percent,
        barClassName,
      };
    });
  }, [bookingStatusCounts, totalBookingStatuses]);

  const chartSeries = useMemo(() => {
    const points = 7;
    const now = new Date();

    const [rangeStart, rangeEnd] = (() => {
      if (dateRange === 'today') {
        const start = new Date(now);
        start.setHours(0, 0, 0, 0);
        return [start, now] as const;
      }
      if (dateRange === '7d') {
        const start = subDays(now, 6);
        start.setHours(0, 0, 0, 0);
        return [start, now] as const;
      }
      if (dateRange === '30d') {
        const start = subDays(now, 29);
        start.setHours(0, 0, 0, 0);
        return [start, now] as const;
      }
      const start = customStart ? new Date(customStart) : subDays(now, 6);
      const end = customEnd ? new Date(customEnd) : now;
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
      return [start, end] as const;
    })();

    const startMs = rangeStart.getTime();
    const endMs = rangeEnd.getTime();
    const duration = Math.max(endMs - startMs, 1);

    const bookingsBuckets = Array.from({ length: points, }, () => 0);
    const revenueBuckets = Array.from({ length: points, }, () => 0);
    const activityBuckets = Array.from({ length: points, }, () => 0);
    const messageBuckets = Array.from({ length: points, }, () => 0);

    const resolveBucketIndex = (timestamp: number) => {
      const progress = (timestamp - startMs) / duration;
      const rawIndex = Math.floor(progress * points);
      return Math.min(points - 1, Math.max(0, rawIndex));
    };

    partnerBookings.forEach((booking) => {
      const created = new Date(booking.createdAt).getTime();
      if (created < startMs || created > endMs) {
        return;
      }
      const index = resolveBucketIndex(created);
      bookingsBuckets[index] += 1;
      revenueBuckets[index] += booking.price ?? 0;
    });

    dashboardFeed.forEach((item) => {
      const created = new Date(item.createdAt).getTime();
      if (created < startMs || created > endMs) {
        return;
      }
      const index = resolveBucketIndex(created);
      activityBuckets[index] += 1;
      if (item.type === 'notification' && item.notificationType === 'message') {
        messageBuckets[index] += 1;
      }
    });

    const tickDuration = duration / Math.max(points - 1, 1);
    const ticks = Array.from({ length: points, }, (_, index) => {
      const value = startMs + tickDuration * index;
      const date = new Date(value);
      return dateRange === 'today'
        ? format(date, 'ha')
        : format(date, 'MMM d');
    });

    return {
      bookings: bookingsBuckets,
      revenue: revenueBuckets,
      views: activityBuckets,
      saves: messageBuckets,
      ticks,
    };
  }, [
    dashboardFeed,
    customEnd,
    customStart,
    dateRange,
    partnerBookings
  ]);

  const funnelSteps = useMemo(() => {
    const messageCount = dashboardFeed.filter(
      (item) => item.type === 'notification' && item.notificationType === 'message'
    ).length;
    const completedCount = partnerBookings.filter((booking) =>
      ['completed', 'checkedout'].includes(booking.status)
    ).length;
    const base = Math.max(
      dashboardFeed.length,
      messageCount,
      partnerBookings.length,
      completedCount,
      1
    );

    return [
      {
        label: 'Activity items',
        value: dashboardFeed.length,
        accent: 'bg-cyan-500',
        percent: (dashboardFeed.length / base) * 100,
      },
      {
        label: 'Messages',
        value: messageCount,
        accent: 'bg-amber-500',
        percent: (messageCount / base) * 100,
      },
      {
        label: 'Bookings',
        value: partnerBookings.length,
        accent: 'bg-sky-500',
        percent: (partnerBookings.length / base) * 100,
      },
      {
        label: 'Completed',
        value: completedCount,
        accent: 'bg-emerald-500',
        percent: (completedCount / base) * 100,
      }
    ];
  }, [dashboardFeed, partnerBookings]);

  const recentBookings = useMemo(() => {
    return [...partnerBookings]
      .filter((booking) =>
        ['confirmed', 'pending', 'checkedin'].includes(booking.status)
      )
      .sort(
        (first, second) =>
          new Date(second.createdAt).getTime() - new Date(first.createdAt).getTime()
      )
      .slice(0, 3);
  }, [partnerBookings]);

  const openBookingsCount = useMemo(
    () =>
      bookingStatusCounts.pending +
      bookingStatusCounts.confirmed +
      bookingStatusCounts.checkedin,
    [bookingStatusCounts]
  );

  const peakDemand = useMemo(() => {
    if (!partnerBookings.length) {
      return {
 dayLabel: '—',
hourLabel: '—', 
};
    }

    const dayCounts = Array.from({ length: 7, }, () => 0);
    const hourCounts = Array.from({ length: 24, }, () => 0);

    partnerBookings.forEach((booking) => {
      const date = new Date(booking.createdAt);
      dayCounts[date.getDay()] += 1;
      hourCounts[date.getHours()] += 1;
    });

    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const peakDayIndex = dayCounts.reduce(
      (bestIndex, value, index) => (value > dayCounts[bestIndex] ? index : bestIndex),
      0
    );
    const peakHourIndex = hourCounts.reduce(
      (bestIndex, value, index) =>
        value > hourCounts[bestIndex] ? index : bestIndex,
      0
    );

    const formatHourLabel = (hour: number) => {
      const toLabel = (value: number) =>
        new Date(Date.UTC(2024, 0, 1, value, 0)).toLocaleTimeString([], { hour: 'numeric', });
      const endHour = (hour + 1) % 24;
      return `${toLabel(hour)}–${toLabel(endHour)}`;
    };

    return {
      dayLabel: dayNames[peakDayIndex] ?? '—',
      hourLabel: formatHourLabel(peakHourIndex),
    };
  }, [partnerBookings]);

  const filteredListings = useMemo(() => {
    return liveListingSource.filter((listing) => {
      if (
        bookingType !== 'all' &&
        !listing.bookingTypes.includes(bookingType)
      ) {
        return false;
      }
      if (listingFilter !== 'all' && listing.id !== listingFilter) {
        return false;
      }
      if (!searchTerm) {
        return true;
      }
      return listing.name.toLowerCase().includes(searchTerm.toLowerCase());
    });
  }, [bookingType, listingFilter, liveListingSource, searchTerm]);

  const sortedListings = useMemo(() => {
    const rows = filteredListings.map((listing) => {
      const computedViews = listing.views ?? 0;
      const computedBookings = listing.bookings;
      const computedRevenue = listing.revenue;
      const conversion = computedViews
        ? (computedBookings / computedViews) * 100
        : 0;
      const cancellations = Math.min(listing.cancellations, Math.max(computedBookings, 1));
      const cancellationRate = computedBookings
        ? (cancellations / computedBookings) * 100
        : 0;
      return {
        ...listing,
        views: computedViews,
        bookings: computedBookings,
        revenue: computedRevenue,
        conversion,
        cancellationRate,
      };
    });

    const comparator = (a: (typeof rows)[number], b: (typeof rows)[number]) => {
      const direction = sortDirection === 'asc' ? 1 : -1;

      if (sortKey === 'lastUpdated') {
        const valueA = Date.parse(a.lastUpdated ?? '') || 0;
        const valueB = Date.parse(b.lastUpdated ?? '') || 0;
        return (valueA - valueB) * direction;
      }

      const numericSortKey = sortKey as NumericSortKey;
      const valueA = (a[numericSortKey] ?? 0) as number;
      const valueB = (b[numericSortKey] ?? 0) as number;
      return (valueA - valueB) * direction;
    };

    return [...rows].sort(comparator);
  }, [filteredListings, sortDirection, sortKey]);

  const exportCsv = useCallback(() => {
    const headers = [
      'Listing',
      'Status',
      'Bookings',
      'Revenue',
      'Rating',
      'Reviews',
      'Cancellation %',
      'Last updated'
    ];
    const rows = sortedListings.map((listing) => [
      listing.name,
      listing.status,
      listing.bookings.toString(),
      listing.revenue.toString(),
      listing.rating.toString(),
      listing.reviews.toString(),
      listing.cancellationRate.toFixed(1),
      listing.lastUpdated
    ]);

    const csvContent = [headers, ...rows]
      .map((row) => row.join(','))
      .join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv', });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `listing-metrics-${dateRange}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }, [dateRange, sortedListings]);

  const cycleSort = useCallback(
    (key: SortKey) => {
      if (sortKey === key) {
        setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
        return;
      }
      setSortKey(key);
      setSortDirection('desc');
    },
    [sortKey]
  );

  const summaryMetrics = [
    {
      label: 'Total revenue (₱)',
      value: `₱${partnerBookings
        .reduce((sum, booking) => sum + (booking.price ?? 0), 0)
        .toLocaleString('en-US')}`,
      helper: 'All partner bookings',
      change: 0,
    },
    {
      label: 'Bookings',
      value: partnerBookings.length.toString(),
      helper: 'All partner bookings',
      change: 0,
    },
    {
      label: 'Messages',
      value: dashboardFeed.filter(
        (item) => item.type === 'notification' && item.notificationType === 'message'
      ).length.toString(),
      helper: 'Recent partner messages',
      change: 0,
    },
    {
      label: 'Active listings',
      value: partnerSpaces.length.toString(),
      helper: 'Your spaces in UpSpace',
      change: 0,
    }
  ];

  const topFilterRowClass = dateRange === 'custom'
    ? 'grid gap-2 md:grid-cols-[180px_220px_160px_148px_148px_minmax(240px,1fr)_auto]'
    : 'grid gap-2 md:grid-cols-[180px_220px_160px_minmax(240px,1fr)_auto]';

  return (
    <div className="mt-8 space-y-6">
      <SpacesBreadcrumbs currentPage="Dashboard" />

      <div className="space-y-1">
        <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">
          Partner dashboard
        </h2>
        <p className="text-sm text-muted-foreground md:text-base">
          Track your bookings, listing performance, and activity across UpSpace.
        </p>
      </div>

      <Card className="rounded-md">
        <CardHeader className="pb-3">
          <CardTitle>Filters</CardTitle>
          <CardDescription>
            Slice the dashboard by date range, listing, or booking type.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 pt-0">
          <div className={ topFilterRowClass }>
            <div className="space-y-1.5">
              <Label htmlFor="date-range" className="text-xs text-muted-foreground">Date range</Label>
              <Select
                value={ dateRange }
                onValueChange={ (value) => setDateRange(value as DateRangeKey) }
              >
                <SelectTrigger
                  id="date-range"
                  aria-label="Select date range"
                  className="h-8"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  { DATE_RANGE_PRESETS.map((preset) => (
                    <SelectItem key={ preset.value } value={ preset.value }>
                      { preset.label }
                    </SelectItem>
                  )) }
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="listing-filter" className="text-xs text-muted-foreground">Listing</Label>
              <Select
                value={ listingFilter }
                onValueChange={ (value) => setListingFilter(value) }
              >
                <SelectTrigger
                  id="listing-filter"
                  aria-label="Filter by listing"
                  className="h-8"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All listings</SelectItem>
                  { liveListingSource.map((listing) => (
                    <SelectItem key={ listing.id } value={ listing.id }>
                      { listing.name }
                    </SelectItem>
                  )) }
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="booking-type" className="text-xs text-muted-foreground">Booking type</Label>
              <Select
                value={ bookingType }
                onValueChange={ (value) =>
                  setBookingType(value as BookingTypeKey)
                }
              >
                <SelectTrigger
                  id="booking-type"
                  aria-label="Filter by booking type"
                  className="h-8"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="hourly">Hourly</SelectItem>
                  <SelectItem value="daily">Daily</SelectItem>
                </SelectContent>
              </Select>
            </div>
            { dateRange === 'custom' && (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="custom-start" className="text-xs text-muted-foreground">From</Label>
                  <Input
                    id="custom-start"
                    type="date"
                    aria-label="Custom start date"
                    value={ customStart }
                    onChange={ (event) => setCustomStart(event.target.value) }
                    className="h-8"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="custom-end" className="text-xs text-muted-foreground">To</Label>
                  <Input
                    id="custom-end"
                    type="date"
                    aria-label="Custom end date"
                    value={ customEnd }
                    min={ customStart }
                    onChange={ (event) => setCustomEnd(event.target.value) }
                    className="h-8"
                  />
                </div>
              </>
            ) }
            <div className="space-y-1.5">
              <Label htmlFor="listing-search" className="text-xs text-muted-foreground">Search</Label>
              <div className="relative">
                <FiSearch
                  className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                  aria-hidden="true"
                />
                <Input
                  id="listing-search"
                  placeholder="Search listing name..."
                  aria-label="Search listings"
                  value={ searchTerm }
                  onChange={ (event) => setSearchTerm(event.target.value) }
                  className="h-8 bg-white pl-9 dark:bg-background"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Export</Label>
              <Button size="sm" onClick={ exportCsv } className="h-8">
                Export CSV
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        { summaryMetrics.map((metric) => (
          <Card key={ metric.label } className="rounded-md">
            <CardContent className="space-y-2 pt-6">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  { metric.label }
                </p>
                <ChangeBadge delta={ metric.change } />
              </div>
              <p className="text-3xl font-semibold">{ metric.value }</p>
              <p className="text-xs text-muted-foreground">{ metric.helper }</p>
            </CardContent>
          </Card>
        )) }
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="rounded-md xl:col-span-2">
          <CardHeader className="flex items-center justify-between">
            <div>
              <CardTitle>Bookings and revenue trend</CardTitle>
              <CardDescription>Tracks the same range as your filters.</CardDescription>
            </div>
            <Badge variant="outline">Trend</Badge>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              { chartSeries.ticks.map((tick, index) => (
                <span key={ `${tick}-${index}` }>{ tick }</span>
              )) }
            </div>
            <MiniBarChart
              values={ chartSeries.bookings }
              color="#0ea5e9"
              label="Bookings"
            />
            <MiniBarChart
              values={ chartSeries.revenue }
              color="#f97316"
              label="Revenue"
            />
          </CardContent>
        </Card>
        <Card className="rounded-md">
          <CardHeader>
            <CardTitle>Views and saves</CardTitle>
            <CardDescription>
              Activity and message trend while direct view/save telemetry is pending.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <MiniBarChart
              values={ chartSeries.views }
              color="#22c55e"
              label="Views"
            />
            <MiniBarChart
              values={ chartSeries.saves }
              color="#a855f7"
              label="Saves"
            />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="rounded-md xl:col-span-2">
          <CardHeader>
            <CardTitle>Listing performance</CardTitle>
            <CardDescription>Sortable and exportable per-listing metrics.</CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  { [
                    {
                      label: 'Listing',
                      key: 'name',
                    },
                    {
                      label: 'Bookings',
                      key: 'bookings',
                    },
                    {
                      label: 'Cancellation %',
                      key: 'cancellationRate',
                    },
                    {
                      label: 'Revenue',
                      key: 'revenue',
                    },
                    {
                      label: 'Last activity',
                      key: 'lastUpdated',
                    }
                  ].map((column) => (
                    <TableHead key={ column.label }>
                      <button
                        type="button"
                        aria-label={
                          column.key === 'name'
                            ? undefined
                            : `Sort by ${column.label}`
                        }
                        className="text-xs font-medium uppercase tracking-wide text-muted-foreground"
                        onClick={ () =>
                          column.key !== 'name'
                            ? cycleSort(column.key as SortKey)
                            : undefined
                        }
                      >
                        { column.label }
                      </button>
                    </TableHead>
                  )) }
                </TableRow>
              </TableHeader>
              <TableBody>
                { sortedListings.map((listing) => (
                  <TableRow key={ listing.id }>
                    <TableCell className="space-y-1">
                      <p className="text-sm font-semibold">{ listing.name }</p>
                      <p className="text-xs text-muted-foreground">
                        { listing.status }
                      </p>
                    </TableCell>
                    <TableCell>{ listing.bookings.toLocaleString() }</TableCell>
                    <TableCell>{ listing.cancellationRate.toFixed(1) }%</TableCell>
                    <TableCell>₱{ listing.revenue.toLocaleString('en-US') }</TableCell>
                    <TableCell>
                      { format(new Date(listing.lastUpdated), 'MMM dd') }
                    </TableCell>
                  </TableRow>
                )) }
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card className="rounded-md">
          <CardHeader>
            <CardTitle>Activity feed</CardTitle>
            <CardDescription>Latest bookings and messages in your workspace.</CardDescription>
          </CardHeader>
          <CardContent>
            <PartnerDashboardFeed limit={ 20 } />
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-md">
        <CardHeader>
          <CardTitle>Funnel and engagement</CardTitle>
          <CardDescription>
            Live activity from bookings and partner messages.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          { (bookingsLoading && feedLoading) ? (
            <div className="grid gap-4 md:grid-cols-2">
              { Array.from({ length: 4, }).map((_, index) => (
                <div
                  key={ `funnel-skeleton-${index}` }
                  className="space-y-2 rounded-md border p-4"
                >
                  <Skeleton className="h-4 w-24 rounded-md" />
                  <Skeleton className="h-3 w-20 rounded-md" />
                  <Skeleton className="h-2 w-full rounded-md" />
                </div>
              )) }
            </div>
          ) : feedError || bookingsError ? (
            <p className="text-sm text-destructive">Unable to load engagement data.</p>
          ) : (
            <>
              <div className="grid gap-4 md:grid-cols-2">
                { funnelSteps.map((step) => (
                  <FunnelBar
                    key={ step.label }
                    label={ step.label }
                    value={ step.value }
                    percent={ step.percent }
                    accent={ step.accent }
                  />
                )) }
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-1 rounded-md border p-3">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    Total bookings
                  </p>
                  <p className="text-2xl font-semibold">{ partnerBookings.length }</p>
                </div>
                <div className="space-y-1 rounded-md border p-3">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    Messages (last feed)
                  </p>
                  <p className="text-2xl font-semibold">
                    { dashboardFeed.filter(
                      (item) =>
                        item.type === 'notification' &&
                        item.notificationType === 'message'
                    ).length }
                  </p>
                </div>
              </div>
            </>
          ) }
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="rounded-md">
          <CardHeader>
            <CardTitle>Booking status</CardTitle>
            <CardDescription>Track lifecycle health.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-md border p-3">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  Total statuses tracked
                </p>
                <p className="text-2xl font-semibold">{ totalBookingStatuses }</p>
              </div>
              <div className="rounded-md border p-3">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  Success ratio
                </p>
                <p className="text-2xl font-semibold">
                  { totalBookingStatuses
                    ? Math.round(
                      ((bookingStatusCounts.confirmed +
                        bookingStatusCounts.checkedin +
                        bookingStatusCounts.checkedout +
                        bookingStatusCounts.completed) /
                        totalBookingStatuses) *
                      100
                    )
                    : 0 }%
                </p>
              </div>
            </div>

            <div className="space-y-3">
              { bookingStatusRows.map((row) => (
                <div key={ row.status } className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <span>{ formatStatusLabel(row.status) }</span>
                      <Badge variant="outline">{ row.percent }%</Badge>
                    </div>
                    <span className="font-semibold">{ row.count }</span>
                  </div>
                  <div className="h-2 rounded-md bg-muted">
                    <div
                      className={ `h-2 rounded-md ${row.barClassName}` }
                      style={ { width: `${Math.max(row.percent, row.count > 0 ? 6 : 0)}%`, } }
                      aria-hidden="true"
                    />
                  </div>
                </div>
              )) }
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-md">
          <CardHeader className="flex flex-row items-start justify-between">
            <div>
              <CardTitle>Operational insights</CardTitle>
              <CardDescription>Upcoming bookings and peak demand.</CardDescription>
            </div>
            <Badge variant="outline">Live</Badge>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-md border p-3">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  Open bookings
                </p>
                { bookingsLoading ? (
                  <Skeleton className="mt-2 h-7 w-16 rounded-md" />
                ) : (
                  <p className="mt-1 text-2xl font-semibold">{ openBookingsCount }</p>
                ) }
              </div>
              <div className="rounded-md border p-3">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  Peak window
                </p>
                { bookingsLoading ? (
                  <Skeleton className="mt-2 h-7 w-36 rounded-md" />
                ) : bookingsError ? (
                  <p className="mt-1 text-sm text-destructive">
                    { bookingsErrorObj instanceof Error
                      ? bookingsErrorObj.message
                      : 'Unable to load peak times.' }
                  </p>
                ) : (
                  <p className="mt-1 text-sm font-semibold">
                    { peakDemand.dayLabel } · { peakDemand.hourLabel }
                  </p>
                ) }
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  Recent bookings
                </p>
                <Badge variant="secondary">{ recentBookings.length } shown</Badge>
              </div>
              { bookingsLoading ? (
                <div className="space-y-2">
                  { Array.from({ length: 3, }).map((_, index) => (
                    <div
                      key={ `upcoming-skeleton-${index}` }
                      className="flex items-center justify-between rounded-md border px-4 py-3"
                    >
                      <div className="space-y-2">
                        <Skeleton className="h-4 w-40 rounded-md" />
                        <Skeleton className="h-3 w-28 rounded-md" />
                      </div>
                      <Skeleton className="h-6 w-16 rounded-md" />
                    </div>
                  )) }
                </div>
              ) : bookingsError ? (
                <p className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                  { bookingsErrorObj instanceof Error
                    ? bookingsErrorObj.message
                    : 'Unable to load bookings.' }
                </p>
              ) : recentBookings.length === 0 ? (
                <div className="rounded-md border p-4">
                  <p className="text-sm text-muted-foreground">
                    No recent partner bookings yet.
                  </p>
                </div>
              ) : (
                recentBookings.map((booking) => (
                  <div
                    key={ booking.id }
                    className="flex items-center justify-between rounded-md border px-4 py-3"
                  >
                    <div>
                      <p className="text-sm font-semibold">{ booking.spaceName }</p>
                      <p className="text-xs text-muted-foreground">
                        { format(new Date(booking.createdAt), 'MMM d · h:mm a') } ·{ ' ' }
                        { booking.areaName }
                      </p>
                    </div>
                    <Badge variant={ resolveStatusVariant(booking.status) }>
                      { booking.status }
                    </Badge>
                  </div>
                ))
              ) }
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

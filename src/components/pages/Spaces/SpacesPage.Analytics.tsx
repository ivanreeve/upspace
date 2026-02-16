'use client';

import { useCallback, useMemo, useState } from 'react';
import { format, subDays } from 'date-fns';
import { FiArrowDown, FiArrowUpRight } from 'react-icons/fi';

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

const DATE_RANGE_PRESETS: {
  label: string;
  value: DateRangeKey;
  description: string;
}[] = [
  {
    label: 'Today',
    value: 'today',
    description: 'Closed deals posted today',
  },
  {
    label: 'Last 7 days',
    value: '7d',
    description: 'Weekly momentum',
  },
  {
    label: 'Last 30 days',
    value: '30d',
    description: 'Monthly performance',
  },
  {
    label: 'Custom range',
    value: 'custom',
    description: 'Choose your own window',
  }
];

const DATE_TICKS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function MiniLineChart({
  values,
  color,
  label,
}: {
  values: number[];
  color: string;
  label: string;
}) {
  const maxValue = Math.max(...values, 1);
  const step = values.length > 1 ? 100 / (values.length - 1) : 0;
  const points = values.map((value, index) => {
    const x = index * step;
    const y = 100 - (value / maxValue) * 100;
    return `${x},${y}`;
  });
  const linePath = points.join(' ');
  const areaPath = `${linePath} 100,100 0,100`;
  const normalizedId = label.toLowerCase().replace(/[^a-z0-9]+/g, '-');

  return (
    <div className="w-full" aria-label={ `Chart for ${label}` }>
      <svg viewBox="0 0 100 100" className="h-28 w-full">
        <defs>
          <linearGradient
            id={ `${normalizedId}-gradient` }
            x1="0"
            x2="0"
            y1="0"
            y2="1"
          >
            <stop offset="0%" stopColor={ color } stopOpacity="0.4" />
            <stop offset="100%" stopColor={ color } stopOpacity="0" />
          </linearGradient>
        </defs>
        <g className="text-muted-foreground/40">
          { Array.from({ length: 4, }).map((_, rowIndex) => (
            <line
              key={ `grid-${rowIndex}-${normalizedId}` }
              x1="0"
              x2="100"
              y1={ (rowIndex * 25).toString() }
              y2={ (rowIndex * 25).toString() }
              stroke="currentColor"
              strokeWidth="0.3"
              opacity="0.4"
            />
          )) }
        </g>
        <polygon points={ areaPath } fill={ `url(#${normalizedId}-gradient)` } />
        <polyline
          points={ linePath }
          fill="none"
          stroke={ color }
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        { points.map((point, index) => {
          const [x, y] = point.split(',').map(Number);
          return (
            <circle
              key={ `${normalizedId}-dot-${index}` }
              cx={ x }
              cy={ y }
              r="1.5"
              fill={ color }
            />
          );
        }) }
      </svg>
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

    const bucketDuration =
      (rangeEnd.getTime() - rangeStart.getTime()) / points || 1;

    const bookingsBuckets = Array.from({ length: points, }, () => 0);
    const revenueBuckets = Array.from({ length: points, }, () => 0);

    partnerBookings.forEach((booking) => {
      const created = new Date(booking.createdAt).getTime();
      if (created < rangeStart.getTime() || created > rangeEnd.getTime()) {
        return;
      }
      const index = Math.min(
        points - 1,
        Math.floor((created - rangeStart.getTime()) / bucketDuration)
      );
      bookingsBuckets[index] += 1;
      revenueBuckets[index] += booking.price ?? 0;
    });

    return {
      bookings: bookingsBuckets,
      revenue: revenueBuckets,
      views: Array.from({ length: points, }, () => 0),
      saves: Array.from({ length: points, }, () => 0),
    };
  }, [
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

  const rangeLabel =
    DATE_RANGE_PRESETS.find((range) => range.value === dateRange)?.label ??
    'Last 7 days';

  return (
    <div className="space-y-8 mt-8">
      <SpacesBreadcrumbs currentPage="Dashboard" className="mb-4" />
      <Card className="rounded-3xl border border-primary/20 bg-gradient-to-br from-primary/10 to-primary/5 shadow-[0_4px_20px_rgba(0,0,0,0.05)]">
        <CardHeader className="items-start gap-4">
          <div>
            <CardTitle className="text-lg font-semibold">
              Partner dashboard
            </CardTitle>
            <CardDescription>
              Space performance for the selected timeframe. Use the filters to
              slice and export the data you rely on most.
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Badge
              variant="outline"
              className="text-[11px] uppercase tracking-wide"
            >
              { rangeLabel }
            </Badge>
            <Badge className="text-[11px] uppercase tracking-wide">
              Live data
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="px-0 pb-6">
          <div className="px-4 sm:px-6">
            <PartnerDashboardFeed limit={ 20 } />
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-3xl border border-[#FFFFFF] shadow-[0_4px_20px_rgba(0,0,0,0.05)]">
        <CardHeader className="flex flex-col gap-2 md:flex-row md:items-center">
          <div>
            <CardTitle>Filters & controls</CardTitle>
            <CardDescription>
              Slice the dashboard by date range, listing, or booking type.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 pt-0">
          <div className="flex flex-wrap gap-4">
            <div className="flex flex-col">
              <Label
                htmlFor="date-range"
                className="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
              >
                Date range
              </Label>
              <Select
                value={ dateRange }
                onValueChange={ (value) => setDateRange(value as DateRangeKey) }
              >
                <SelectTrigger id="date-range" className="w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  { DATE_RANGE_PRESETS.map((preset) => (
                    <SelectItem key={ preset.value } value={ preset.value } className="hover:!text-white">
                      { preset.label }
                    </SelectItem>
                  )) }
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col">
              <Label
                htmlFor="listing-filter"
                className="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
              >
                Listing
              </Label>
              <Select
                value={ listingFilter }
                onValueChange={ (value) => setListingFilter(value) }
              >
                <SelectTrigger id="listing-filter" className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" className="hover:!text-white">All listings</SelectItem>
                  { liveListingSource.map((listing) => (
                    <SelectItem key={ listing.id } value={ listing.id } className="hover:!text-white">
                      { listing.name }
                    </SelectItem>
                  )) }
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col">
              <Label
                htmlFor="booking-type"
                className="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
              >
                Booking type
              </Label>
              <Select
                value={ bookingType }
                onValueChange={ (value) =>
                  setBookingType(value as BookingTypeKey)
                }
              >
                <SelectTrigger id="booking-type" className="w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" className="hover:!text-white">All</SelectItem>
                  <SelectItem value="hourly"className="hover:!text-white">Hourly</SelectItem>
                  <SelectItem value="daily"className="hover:!text-white">Daily</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Input
              placeholder="Search listing name..."
              value={ searchTerm }
              onChange={ (event) => setSearchTerm(event.target.value) }
              className="min-w-[200px]"
            />
            <Button variant="outline" onClick={ exportCsv } className="hover:!text-white">
              Export CSV
            </Button>
          </div>
          { dateRange === 'custom' && (
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex flex-col">
                <Label
                  htmlFor="custom-start"
                  className="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                >
                  From
                </Label>
                <Input
                  id="custom-start"
                  type="date"
                  value={ customStart }
                  onChange={ (event) => setCustomStart(event.target.value) }
                  className="min-w-[160px]"
                />
              </div>
              <div className="flex flex-col">
                <Label
                  htmlFor="custom-end"
                  className="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                >
                  To
                </Label>
                <Input
                  id="custom-end"
                  type="date"
                  value={ customEnd }
                  min={ customStart }
                  onChange={ (event) => setCustomEnd(event.target.value) }
                  className="min-w-[160px]"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                { customStart && customEnd
                  ? `${format(new Date(customStart), 'MMM dd')} – ${format(new Date(customEnd), 'MMM dd')}`
                  : 'Choose a date span' }
              </p>
            </div>
          ) }
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        { summaryMetrics.map((metric) => (
          <Card
            key={ metric.label }
            className="rounded-3xl border border-[#FFFFFF]  shadow-[0_4px_20px_rgba(0,0,0,0.05)] dark:from-foreground/10 dark:to-transparent"
          >
            <CardContent className="space-y-2 px-4 py-5">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  { metric.label }
                </p>
                <ChangeBadge delta={ metric.change } />
              </div>
              <p className="text-3xl font-semibold text-foreground">
                { metric.value }
              </p>
              <p className="text-xs text-muted-foreground">{ metric.helper }</p>
              <div
                className={ `h-1 rounded-full ${metric.accent} mt-2` }
                aria-hidden="true"
              />
            </CardContent>
          </Card>
        )) }
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="rounded-3xl border xl:col-span-2 border-[#FFFFFF]  shadow-[0_4px_20px_rgba(0,0,0,0.05)]">
          <CardHeader className="flex items-center justify-between gap-2">
            <div>
              <CardTitle>Bookings & revenue over time</CardTitle>
              <CardDescription>
                Tracks the same range as your filters.
              </CardDescription>
            </div>
            <Badge
              variant="outline"
              className="text-xs uppercase tracking-wide"
            >
              Trend
            </Badge>
          </CardHeader>
          <CardContent className="space-y-5 px-0">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              { DATE_TICKS.map((tick) => (
                <span key={ tick }>{ tick }</span>
              )) }
            </div>
            <MiniLineChart
              values={ chartSeries.bookings }
              color="#0ea5e9"
              label="Bookings"
            />
            <MiniLineChart
              values={ chartSeries.revenue }
              color="#fb923c"
              label="Revenue"
            />
          </CardContent>
        </Card>
        <Card className="rounded-3xl border border-[#FFFFFF]  shadow-[0_4px_20px_rgba(0,0,0,0.05)]">
          <CardHeader>
            <div>
              <CardTitle>Views vs bookings</CardTitle>
              <CardDescription>Live bookings; views/saves not yet tracked.</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-5 px-0">
            <MiniLineChart
              values={ chartSeries.views }
              color="#22c55e"
              label="Views"
            />
            <MiniLineChart
              values={ chartSeries.saves }
              color="#a855f7"
              label="Saves"
            />
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-3xl border border-[#FFFFFF] shadow-[0_4px_20px_rgba(0,0,0,0.05)]">
        <CardHeader className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle>Funnel & engagement</CardTitle>
            <CardDescription>
              Live activity from bookings and partner messages.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-6 px-0">
          { (bookingsLoading && feedLoading) ? (
            <div className="grid gap-4 md:grid-cols-2">
              { Array.from({ length: 4, }).map((_, index) => (
                <div
                  key={ `funnel-skeleton-${index}` }
                  className="space-y-2 rounded-2xl border border-border/60 p-4"
                >
                  <Skeleton className="h-4 w-24 rounded-md" />
                  <Skeleton className="h-3 w-20 rounded-md" />
                  <Skeleton className="h-2 w-full rounded-md" />
                </div>
              )) }
            </div>
          ) : feedError || bookingsError ? (
            <p className="text-sm text-destructive px-4">
              Unable to load engagement data.
            </p>
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
                <div className="space-y-1 rounded-2xl border border-border/60 p-3">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    Total bookings
                  </p>
                  <p className="text-2xl font-semibold">
                    { partnerBookings.length }
                  </p>
                </div>
                <div className="space-y-1 rounded-2xl border border-border/60 p-3">
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

      <Card className="rounded-3xl border border-[#FFFFFF] shadow-[0_4px_20px_rgba(0,0,0,0.05)]">
        <CardHeader className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle>Listing performance</CardTitle>
            <CardDescription>
              Sortable & exportable per listing metrics.
            </CardDescription>
          </div>
          <Badge variant="outline" className="text-xs uppercase tracking-wide">
            { sortedListings.length } listings
          </Badge>
        </CardHeader>
        <CardContent className="px-0 pb-0">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
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
                      className="flex items-center gap-1 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground"
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
                    <p className="text-sm font-semibold text-foreground">
                      { listing.name }
                    </p>
                    <p className="text-xs text-muted-foreground">
                      { listing.status }
                    </p>
                  </TableCell>
                  <TableCell>{ listing.bookings.toLocaleString() }</TableCell>
                  <TableCell>
                    ₱{ listing.revenue.toLocaleString('en-US') }
                  </TableCell>
                  <TableCell>{ listing.cancellationRate.toFixed(1) }%</TableCell>
                  <TableCell>
                    { format(new Date(listing.lastUpdated), 'MMM dd') }
                  </TableCell>
                </TableRow>
              )) }
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="rounded-3xl border border-[#FFFFFF] shadow-[0_4px_20px_rgba(0,0,0,0.05)]">
          <CardHeader>
            <div>
              <CardTitle>Booking status</CardTitle>
              <CardDescription>Track lifecycle health</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            { Object.entries(bookingStatusCounts).map(([status, value]) => {
              const total = Object.values(bookingStatusCounts).reduce(
                (sum, current) => sum + current,
                0
              );
              const percent = total ? Math.round((value / total) * 100) : 0;
              return (
                <div
                  key={ status }
                  className="flex items-center justify-between text-sm"
                >
                  <div className="flex items-center gap-2">
                    <span className="capitalize">{ status }</span>
                    <Badge
                      variant="outline"
                      className="text-[10px] uppercase tracking-wide"
                    >
                      { percent }%
                    </Badge>
                  </div>
                  <span className="font-semibold">{ value }</span>
                </div>
              );
            }) }
          </CardContent>
        </Card>
        <Card className="rounded-3xl border border-[#FFFFFF] shadow-[0_4px_20px_rgba(0,0,0,0.05)]">
          <CardHeader>
            <div>
              <CardTitle>Operational insights</CardTitle>
              <CardDescription>Upcoming bookings & peak demand</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Recent bookings
              </p>
              { bookingsLoading ? (
                <div className="space-y-2">
                  { Array.from({ length: 3, }).map((_, index) => (
                    <div
                      key={ `upcoming-skeleton-${index}` }
                      className="flex items-center justify-between rounded-2xl border border-border/60 px-4 py-3"
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
                <p className="text-sm text-destructive">
                  { bookingsErrorObj instanceof Error
                    ? bookingsErrorObj.message
                    : 'Unable to load bookings.' }
                </p>
              ) : recentBookings.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No recent partner bookings yet.
                </p>
              ) : (
                recentBookings.map((booking) => (
                  <div
                    key={ booking.id }
                    className="flex items-center justify-between rounded-2xl border border-border/60 px-4 py-3"
                  >
                    <div>
                      <p className="font-semibold">{ booking.spaceName }</p>
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
            <div className="space-y-1 rounded-2xl border border-border/60 px-4 py-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Peak performance
              </p>
              { bookingsLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-4 w-28 rounded-md" />
                  <Skeleton className="h-4 w-32 rounded-md" />
                </div>
              ) : bookingsError ? (
                <p className="text-sm text-destructive">
                  { bookingsErrorObj instanceof Error
                    ? bookingsErrorObj.message
                    : 'Unable to load peak times.' }
                </p>
              ) : (
                <>
                  <p className="text-sm font-semibold">Top day: { peakDemand.dayLabel }</p>
                  <p className="text-sm font-semibold">
                    Top hour: { peakDemand.hourLabel }
                  </p>
                </>
              ) }
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

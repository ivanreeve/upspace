'use client';

import {
useCallback,
useMemo,
useReducer,
type Dispatch
} from 'react';
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

const BOOKING_HOURS_DAILY_THRESHOLD = 24;

type ListingMetrics = {
  id: string;
  name: string;
  status: string;
  bookings: number;
  revenue: number;
  cancellations: number;
  lastUpdated: string;
};

type ListingPerformanceRow = ListingMetrics & {
  cancellationRate: number;
};

type SummaryMetric = {
  label: string;
  value: string;
  helper: string;
  change: number;
};

type BookingStatusRow = {
  status: BookingStatus;
  count: number;
  percent: number;
  barClassName: string;
};

type ChartSeries = {
  bookings: number[];
  revenue: number[];
  views: number[];
  saves: number[];
  ticks: string[];
};

type FunnelStep = {
  label: string;
  value: number;
  percent: number;
  accent: string;
};

type PartnerBookingRecord = NonNullable<
  ReturnType<typeof usePartnerBookingsQuery>['data']
>[number];

type PartnerDashboardFeedItem = NonNullable<
  ReturnType<typeof usePartnerDashboardFeedQuery>['data']
>[number];

type PeakDemand = {
  dayLabel: string;
  hourLabel: string;
};

type RecentBooking = Pick<
  PartnerBookingRecord,
  'id' | 'spaceName' | 'createdAt' | 'areaName' | 'status'
>;

type AnalyticsFilterState = {
  dateRange: DateRangeKey;
  listingFilter: string;
  bookingType: BookingTypeKey;
  searchTerm: string;
  sortKey: SortKey;
  sortDirection: 'asc' | 'desc';
  customStart: string;
  customEnd: string;
};

type AnalyticsFilterAction =
  | {
      type: 'setDateRange';
      value: DateRangeKey;
    }
  | {
      type: 'setListingFilter';
      value: string;
    }
  | {
      type: 'setBookingType';
      value: BookingTypeKey;
    }
  | {
      type: 'setSearchTerm';
      value: string;
    }
  | {
      type: 'setCustomStart';
      value: string;
    }
  | {
      type: 'setCustomEnd';
      value: string;
    }
  | {
      type: 'cycleSort';
      key: SortKey;
    };

const formatInputDate = (date: Date) => date.toISOString().split('T')[0];

const createInitialAnalyticsFilterState = (): AnalyticsFilterState => ({
  dateRange: '7d',
  listingFilter: 'all',
  bookingType: 'all',
  searchTerm: '',
  sortKey: 'revenue',
  sortDirection: 'desc',
  customStart: formatInputDate(subDays(new Date(), 7)),
  customEnd: formatInputDate(new Date()),
});

const analyticsFilterReducer = (
  state: AnalyticsFilterState,
  action: AnalyticsFilterAction
): AnalyticsFilterState => {
  switch (action.type) {
    case 'setDateRange':
      return {
        ...state,
        dateRange: action.value,
      };
    case 'setListingFilter':
      return {
        ...state,
        listingFilter: action.value,
      };
    case 'setBookingType':
      return {
        ...state,
        bookingType: action.value,
      };
    case 'setSearchTerm':
      return {
        ...state,
        searchTerm: action.value,
      };
    case 'setCustomStart':
      return {
        ...state,
        customStart: action.value,
      };
    case 'setCustomEnd':
      return {
        ...state,
        customEnd: action.value,
      };
    case 'cycleSort':
      if (state.sortKey === action.key) {
        return {
          ...state,
          sortDirection: state.sortDirection === 'asc' ? 'desc' : 'asc',
        };
      }
      return {
        ...state,
        sortKey: action.key,
        sortDirection: 'desc',
      };
    default:
      return state;
  }
};

const resolveDateRangeBounds = (
  dateRange: DateRangeKey,
  customStart: string,
  customEnd: string
) => {
  const now = new Date();

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
};

const resolveBookingType = (bookingHours: number): BookingTypeKey =>
  bookingHours >= BOOKING_HOURS_DAILY_THRESHOLD ? 'daily' : 'hourly';

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
  const barItems = useMemo(() => {
    const seen = new Map<number, number>();
    return values.map((value) => {
      const occurrence = seen.get(value) ?? 0;
      seen.set(value, occurrence + 1);
      return {
        id: `${label}-bar-${value}-${occurrence}`,
        value,
      };
    });
  }, [label, values]);

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
        { barItems.map((barItem) => {
          const { value, } = barItem;
          const heightPercent = Math.max(6, Math.round((value / maxValue) * 100));
          return (
            <div
              key={ barItem.id }
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

type AnalyticsFiltersCardProps = {
  filters: AnalyticsFilterState;
  liveListingSource: ListingMetrics[];
  dispatchFilters: Dispatch<AnalyticsFilterAction>;
  onExportCsv: () => void;
  dashboardCardClassName: string;
};

function AnalyticsFiltersCard({
  filters,
  liveListingSource,
  dispatchFilters,
  onExportCsv,
  dashboardCardClassName,
}: AnalyticsFiltersCardProps) {
  const topFilterRowClass =
    filters.dateRange === 'custom'
      ? 'grid gap-2 md:grid-cols-[180px_220px_160px_148px_148px_minmax(240px,1fr)_auto]'
      : 'grid gap-2 md:grid-cols-[180px_220px_160px_minmax(240px,1fr)_auto]';

  return (
    <Card className={ dashboardCardClassName }>
      <CardHeader className="pb-3">
        <CardTitle>Filters</CardTitle>
        <CardDescription>
          Slice the dashboard by date range, listing, or booking type.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 pt-0">
        <div className={ topFilterRowClass }>
          <div className="space-y-1.5">
            <Label htmlFor="date-range" className="text-xs text-muted-foreground">
              Date range
            </Label>
            <Select
              value={ filters.dateRange }
              onValueChange={ (value) =>
                dispatchFilters({
                  type: 'setDateRange',
                  value: value as DateRangeKey,
                })
              }
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
            <Label htmlFor="listing-filter" className="text-xs text-muted-foreground">
              Listing
            </Label>
            <Select
              value={ filters.listingFilter }
              onValueChange={ (value) =>
                dispatchFilters({
                  type: 'setListingFilter',
                  value,
                })
              }
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
            <Label htmlFor="booking-type" className="text-xs text-muted-foreground">
              Booking type
            </Label>
            <Select
              value={ filters.bookingType }
              onValueChange={ (value) =>
                dispatchFilters({
                  type: 'setBookingType',
                  value: value as BookingTypeKey,
                })
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
          { filters.dateRange === 'custom' ? (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="custom-start" className="text-xs text-muted-foreground">
                  From
                </Label>
                <Input
                  id="custom-start"
                  type="date"
                  aria-label="Custom start date"
                  value={ filters.customStart }
                  onChange={ (event) =>
                    dispatchFilters({
                      type: 'setCustomStart',
                      value: event.target.value,
                    })
                  }
                  className="h-8"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="custom-end" className="text-xs text-muted-foreground">
                  To
                </Label>
                <Input
                  id="custom-end"
                  type="date"
                  aria-label="Custom end date"
                  value={ filters.customEnd }
                  min={ filters.customStart }
                  onChange={ (event) =>
                    dispatchFilters({
                      type: 'setCustomEnd',
                      value: event.target.value,
                    })
                  }
                  className="h-8"
                />
              </div>
            </>
          ) : null }
          <div className="space-y-1.5">
            <Label htmlFor="listing-search" className="text-xs text-muted-foreground">
              Search
            </Label>
            <div className="relative">
              <FiSearch
                className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <Input
                id="listing-search"
                placeholder="Search listing name..."
                aria-label="Search listings"
                value={ filters.searchTerm }
                onChange={ (event) =>
                  dispatchFilters({
                    type: 'setSearchTerm',
                    value: event.target.value,
                  })
                }
                className="h-8 bg-white pl-9 dark:bg-background"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Export</Label>
            <Button size="sm" onClick={ onExportCsv } className="h-8">
              Export CSV
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

type AnalyticsSummaryGridProps = {
  summaryMetrics: SummaryMetric[];
  dashboardCardClassName: string;
};

function AnalyticsSummaryGrid({
  summaryMetrics,
  dashboardCardClassName,
}: AnalyticsSummaryGridProps) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      { summaryMetrics.map((metric) => (
        <Card key={ metric.label } className={ dashboardCardClassName }>
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
  );
}

type AnalyticsTrendSectionProps = {
  chartSeries: ChartSeries;
  dashboardCardClassName: string;
};

function AnalyticsTrendSection({
  chartSeries,
  dashboardCardClassName,
}: AnalyticsTrendSectionProps) {
  return (
    <div className="grid gap-4 xl:grid-cols-3">
      <Card className={ `${dashboardCardClassName} xl:col-span-2` }>
        <CardHeader className="flex items-center justify-between">
          <div className="space-y-2">
            <CardTitle>Bookings and revenue trend</CardTitle>
            <CardDescription>Tracks the same range as your filters.</CardDescription>
          </div>
          <Badge variant="outline">Trend</Badge>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            { chartSeries.ticks.map((tick) => (
              <span key={ tick }>{ tick }</span>
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
      <Card className={ dashboardCardClassName }>
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
  );
}

type AnalyticsListingsSectionProps = {
  dashboardCardClassName: string;
  sortedListings: ListingPerformanceRow[];
  onCycleSort: (key: SortKey) => void;
};

function AnalyticsListingsSection({
  dashboardCardClassName,
  sortedListings,
  onCycleSort,
}: AnalyticsListingsSectionProps) {
  return (
    <div className="grid gap-4 xl:grid-cols-3">
      <Card className={ `${dashboardCardClassName} xl:col-span-2` }>
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
                          ? onCycleSort(column.key as SortKey)
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

      <Card className={ dashboardCardClassName }>
        <CardHeader>
          <CardTitle>Activity feed</CardTitle>
          <CardDescription>Latest bookings and messages in your workspace.</CardDescription>
        </CardHeader>
        <CardContent>
          <PartnerDashboardFeed limit={ 20 } />
        </CardContent>
      </Card>
    </div>
  );
}

type AnalyticsFunnelSectionProps = {
  dashboardCardClassName: string;
  bookingsLoading: boolean;
  feedLoading: boolean;
  feedError: boolean;
  bookingsError: boolean;
  filteredBookings: PartnerBookingRecord[];
  filteredDashboardFeed: PartnerDashboardFeedItem[];
  funnelSteps: FunnelStep[];
};

function AnalyticsFunnelSection({
  dashboardCardClassName,
  bookingsLoading,
  feedLoading,
  feedError,
  bookingsError,
  filteredBookings,
  filteredDashboardFeed,
  funnelSteps,
}: AnalyticsFunnelSectionProps) {
  return (
    <Card className={ dashboardCardClassName }>
      <CardHeader>
        <CardTitle>Funnel and engagement</CardTitle>
        <CardDescription>
          Live activity from bookings and partner messages.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        { (bookingsLoading && feedLoading) ? (
          <div className="grid gap-4 md:grid-cols-2">
            { ['funnel-skeleton-1', 'funnel-skeleton-2', 'funnel-skeleton-3', 'funnel-skeleton-4'].map((skeletonId) => (
              <div
                key={ skeletonId }
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
                <p className="text-2xl font-semibold">{ filteredBookings.length }</p>
              </div>
              <div className="space-y-1 rounded-md border p-3">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  Messages (last feed)
                </p>
                <p className="text-2xl font-semibold">
                  { filteredDashboardFeed.filter(
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
  );
}

type AnalyticsStatusSectionProps = {
  dashboardCardClassName: string;
  totalBookingStatuses: number;
  bookingStatusCounts: Record<BookingStatus, number>;
  bookingStatusRows: BookingStatusRow[];
  bookingsLoading: boolean;
  bookingsError: boolean;
  bookingsErrorObj: unknown;
  openBookingsCount: number;
  peakDemand: PeakDemand;
  recentBookings: RecentBooking[];
};

function AnalyticsStatusSection({
  dashboardCardClassName,
  totalBookingStatuses,
  bookingStatusCounts,
  bookingStatusRows,
  bookingsLoading,
  bookingsError,
  bookingsErrorObj,
  openBookingsCount,
  peakDemand,
  recentBookings,
}: AnalyticsStatusSectionProps) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card className={ dashboardCardClassName }>
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

      <Card className={ dashboardCardClassName }>
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
                { ['upcoming-skeleton-1', 'upcoming-skeleton-2', 'upcoming-skeleton-3'].map((skeletonId) => (
                  <div
                    key={ skeletonId }
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
  );
}

function useBookingStatusMetrics(filteredBookings: PartnerBookingRecord[]) {
  const bookingStatusCounts = useMemo<Record<BookingStatus, number>>(() => {
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
    filteredBookings.forEach((booking) => {
      base[booking.status] += 1;
    });
    return base;
  }, [filteredBookings]);

  const totalBookingStatuses = useMemo(
    () => Object.values(bookingStatusCounts).reduce((sum, value) => sum + value, 0),
    [bookingStatusCounts]
  );

  const bookingStatusRows = useMemo<BookingStatusRow[]>(() => {
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

  return {
    bookingStatusCounts,
    totalBookingStatuses,
    bookingStatusRows,
  };
}

function useFunnelSteps(
  filteredBookings: PartnerBookingRecord[],
  filteredDashboardFeed: PartnerDashboardFeedItem[]
) {
  return useMemo<FunnelStep[]>(() => {
    const messageCount = filteredDashboardFeed.filter(
      (item) => item.type === 'notification' && item.notificationType === 'message'
    ).length;
    const completedCount = filteredBookings.filter((booking) =>
      ['completed', 'checkedout'].includes(booking.status)
    ).length;
    const base = Math.max(
      filteredDashboardFeed.length,
      messageCount,
      filteredBookings.length,
      completedCount,
      1
    );

    return [
      {
        label: 'Activity items',
        value: filteredDashboardFeed.length,
        accent: 'bg-cyan-500',
        percent: (filteredDashboardFeed.length / base) * 100,
      },
      {
        label: 'Messages',
        value: messageCount,
        accent: 'bg-amber-500',
        percent: (messageCount / base) * 100,
      },
      {
        label: 'Bookings',
        value: filteredBookings.length,
        accent: 'bg-sky-500',
        percent: (filteredBookings.length / base) * 100,
      },
      {
        label: 'Completed',
        value: completedCount,
        accent: 'bg-emerald-500',
        percent: (completedCount / base) * 100,
      }
    ];
  }, [filteredBookings, filteredDashboardFeed]);
}

function useOperationalInsights(filteredBookings: PartnerBookingRecord[]) {
  const recentBookings = useMemo<RecentBooking[]>(() => {
    return [...filteredBookings]
      .filter((booking) =>
        ['confirmed', 'pending', 'checkedin'].includes(booking.status)
      )
      .sort(
        (first, second) =>
          new Date(second.createdAt).getTime() - new Date(first.createdAt).getTime()
      )
      .slice(0, 3);
  }, [filteredBookings]);

  const openBookingsCount =
    filteredBookings.filter((booking) => booking.status === 'pending').length +
    filteredBookings.filter((booking) => booking.status === 'confirmed').length +
    filteredBookings.filter((booking) => booking.status === 'checkedin').length;

  const peakDemand = useMemo<PeakDemand>(() => {
    if (!filteredBookings.length) {
      return {
        dayLabel: '—',
        hourLabel: '—',
      };
    }

    const dayCounts = Array.from({ length: 7, }, () => 0);
    const hourCounts = Array.from({ length: 24, }, () => 0);

    filteredBookings.forEach((booking) => {
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
  }, [filteredBookings]);

  return {
    recentBookings,
    openBookingsCount,
    peakDemand,
  };
}

function useSpacesAnalyticsController() {
  const [filters, dispatchFilters] = useReducer(
    analyticsFilterReducer,
    undefined,
    createInitialAnalyticsFilterState
  );

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
  const { data: partnerSpaces = [], } = usePartnerSpacesQuery();

  const [rangeStart, rangeEnd] = useMemo(
    () =>
      resolveDateRangeBounds(
        filters.dateRange,
        filters.customStart,
        filters.customEnd
      ),
    [filters.customEnd, filters.customStart, filters.dateRange]
  );

  const filteredBookings = useMemo(() => {
    const startMs = rangeStart.getTime();
    const endMs = rangeEnd.getTime();

    return partnerBookings.filter((booking) => {
      const createdAtMs = new Date(booking.createdAt).getTime();
      if (createdAtMs < startMs || createdAtMs > endMs) {
        return false;
      }

      if (
        filters.listingFilter !== 'all' &&
        booking.spaceId !== filters.listingFilter
      ) {
        return false;
      }

      if (
        filters.bookingType !== 'all' &&
        resolveBookingType(booking.bookingHours) !== filters.bookingType
      ) {
        return false;
      }

      return true;
    });
  }, [
    filters.bookingType,
    filters.listingFilter,
    partnerBookings,
    rangeEnd,
    rangeStart
  ]);

  const filteredDashboardFeed = useMemo(() => {
    const startMs = rangeStart.getTime();
    const endMs = rangeEnd.getTime();

    return dashboardFeed.filter((item) => {
      const createdAtMs = new Date(item.createdAt).getTime();
      if (createdAtMs < startMs || createdAtMs > endMs) {
        return false;
      }

      if (filters.listingFilter === 'all') {
        return true;
      }

      if (item.type === 'booking') {
        return item.spaceId === filters.listingFilter;
      }

      return item.spaceId === filters.listingFilter;
    });
  }, [dashboardFeed, filters.listingFilter, rangeEnd, rangeStart]);

  const liveListingSource = useMemo(() => {
    const normalizedSearch = filters.searchTerm.trim().toLowerCase();

    return partnerSpaces.map((space) => {
      const spaceBookings = filteredBookings.filter(
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
        bookings,
        revenue,
        cancellations,
        lastUpdated,
      } as ListingMetrics;
    }).filter((listing) => {
      if (
        filters.listingFilter !== 'all' &&
        listing.id !== filters.listingFilter
      ) {
        return false;
      }

      if (!normalizedSearch) {
        return true;
      }

      return listing.name.toLowerCase().includes(normalizedSearch);
    });
  }, [
    filteredBookings,
    filters.listingFilter,
    filters.searchTerm,
    partnerSpaces
  ]);

  const {
    bookingStatusCounts,
    totalBookingStatuses,
    bookingStatusRows,
  } = useBookingStatusMetrics(filteredBookings);

  const chartSeries = useMemo(() => {
    const points = 7;

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

    filteredBookings.forEach((booking) => {
      const created = new Date(booking.createdAt).getTime();
      if (created < startMs || created > endMs) {
        return;
      }
      const index = resolveBucketIndex(created);
      bookingsBuckets[index] += 1;
      revenueBuckets[index] += booking.price ?? 0;
    });

    filteredDashboardFeed.forEach((item) => {
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
      return filters.dateRange === 'today'
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
    filters.dateRange,
    filteredBookings,
    filteredDashboardFeed,
    rangeEnd,
    rangeStart
  ]);

  const funnelSteps = useFunnelSteps(filteredBookings, filteredDashboardFeed);
  const {
 recentBookings, openBookingsCount, peakDemand, 
} =
    useOperationalInsights(filteredBookings);

  const sortedListings = useMemo<ListingPerformanceRow[]>(() => {
    const rows = liveListingSource.map((listing) => {
      const cancellations = Math.min(listing.cancellations, Math.max(listing.bookings, 1));
      const cancellationRate = listing.bookings
        ? (cancellations / listing.bookings) * 100
        : 0;
      return {
        ...listing,
        cancellationRate,
      };
    });

    const comparator = (a: (typeof rows)[number], b: (typeof rows)[number]) => {
      const direction = filters.sortDirection === 'asc' ? 1 : -1;

      if (filters.sortKey === 'lastUpdated') {
        const valueA = Date.parse(a.lastUpdated ?? '') || 0;
        const valueB = Date.parse(b.lastUpdated ?? '') || 0;
        return (valueA - valueB) * direction;
      }

      const numericSortKey = filters.sortKey as NumericSortKey;
      const valueA = (a[numericSortKey] ?? 0) as number;
      const valueB = (b[numericSortKey] ?? 0) as number;
      return (valueA - valueB) * direction;
    };

    return [...rows].sort(comparator);
  }, [filters.sortDirection, filters.sortKey, liveListingSource]);

  const exportCsv = useCallback(() => {
    const headers = [
      'Listing',
      'Status',
      'Bookings',
      'Revenue',
      'Cancellation %',
      'Last updated'
    ];
    const rows = sortedListings.map((listing) => [
      listing.name,
      listing.status,
      listing.bookings.toString(),
      listing.revenue.toString(),
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
    anchor.download = `listing-metrics-${filters.dateRange}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }, [filters.dateRange, sortedListings]);

  const cycleSort = useCallback((key: SortKey) => {
    dispatchFilters({
      type: 'cycleSort',
      key,
    });
  }, []);

  const summaryMetrics: SummaryMetric[] = [
    {
      label: 'Total revenue (₱)',
      value: `₱${filteredBookings
        .reduce((sum, booking) => sum + (booking.price ?? 0), 0)
        .toLocaleString('en-US')}`,
      helper: 'Current filter selection',
      change: 0,
    },
    {
      label: 'Bookings',
      value: filteredBookings.length.toString(),
      helper: 'Current filter selection',
      change: 0,
    },
    {
      label: 'Messages',
      value: filteredDashboardFeed.filter(
        (item) => item.type === 'notification' && item.notificationType === 'message'
      ).length.toString(),
      helper: 'Current filter selection',
      change: 0,
    },
    {
      label: 'Active listings',
      value: liveListingSource.filter((listing) => listing.bookings > 0).length.toString(),
      helper: 'Listings with bookings in range',
      change: 0,
    }
  ];
  const dashboardCardClassName = 'rounded-md bg-sidebar dark:bg-card';

  return {
    filters,
    dispatchFilters,
    liveListingSource,
    exportCsv,
    summaryMetrics,
    chartSeries,
    sortedListings,
    cycleSort,
    bookingsLoading,
    feedLoading,
    feedError,
    bookingsError,
    filteredBookings,
    filteredDashboardFeed,
    funnelSteps,
    totalBookingStatuses,
    bookingStatusCounts,
    bookingStatusRows,
    bookingsErrorObj,
    openBookingsCount,
    peakDemand,
    recentBookings,
    dashboardCardClassName,
  };
}

export function SpacesAnalyticsPanel() {
  const controller = useSpacesAnalyticsController();

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

      <AnalyticsFiltersCard
        filters={ controller.filters }
        liveListingSource={ controller.liveListingSource }
        dispatchFilters={ controller.dispatchFilters }
        onExportCsv={ controller.exportCsv }
        dashboardCardClassName={ controller.dashboardCardClassName }
      />

      <AnalyticsSummaryGrid
        summaryMetrics={ controller.summaryMetrics }
        dashboardCardClassName={ controller.dashboardCardClassName }
      />

      <AnalyticsTrendSection
        chartSeries={ controller.chartSeries }
        dashboardCardClassName={ controller.dashboardCardClassName }
      />

      <AnalyticsListingsSection
        dashboardCardClassName={ controller.dashboardCardClassName }
        sortedListings={ controller.sortedListings }
        onCycleSort={ controller.cycleSort }
      />

      <AnalyticsFunnelSection
        dashboardCardClassName={ controller.dashboardCardClassName }
        bookingsLoading={ controller.bookingsLoading }
        feedLoading={ controller.feedLoading }
        feedError={ controller.feedError }
        bookingsError={ controller.bookingsError }
        filteredBookings={ controller.filteredBookings }
        filteredDashboardFeed={ controller.filteredDashboardFeed }
        funnelSteps={ controller.funnelSteps }
      />

      <AnalyticsStatusSection
        dashboardCardClassName={ controller.dashboardCardClassName }
        totalBookingStatuses={ controller.totalBookingStatuses }
        bookingStatusCounts={ controller.bookingStatusCounts }
        bookingStatusRows={ controller.bookingStatusRows }
        bookingsLoading={ controller.bookingsLoading }
        bookingsError={ controller.bookingsError }
        bookingsErrorObj={ controller.bookingsErrorObj }
        openBookingsCount={ controller.openBookingsCount }
        peakDemand={ controller.peakDemand }
        recentBookings={ controller.recentBookings }
      />
    </div>
  );
}

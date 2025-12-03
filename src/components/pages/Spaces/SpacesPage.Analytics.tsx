'use client';

import { useCallback, useMemo, useState } from 'react';
import { format, subDays } from 'date-fns';
import { FiArrowDown, FiArrowUpRight } from 'react-icons/fi';

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

type DateRangeKey = 'today' | '7d' | '30d' | 'custom';
type BookingTypeKey = 'all' | 'hourly' | 'daily';
type SortKey =
  | 'views'
  | 'saves'
  | 'inquiries'
  | 'bookings'
  | 'revenue'
  | 'conversion'
  | 'cancellation';

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

const SUMMARY_DATA: Record<
  DateRangeKey,
  {
    revenue: number;
    revenueChange: number;
    bookings: number;
    bookingsChange: number;
    conversion: number;
    conversionChange: number;
    views: number;
    saves: number;
    inquiries: number;
    rating: number;
    reviews: number;
  }
> = {
  today: {
    revenue: 145_600,
    revenueChange: 5,
    bookings: 18,
    bookingsChange: 12,
    conversion: 3.6,
    conversionChange: 0.4,
    views: 520,
    saves: 38,
    inquiries: 26,
    rating: 4.7,
    reviews: 9,
  },
  '7d': {
    revenue: 512_400,
    revenueChange: 8,
    bookings: 72,
    bookingsChange: 5,
    conversion: 4.1,
    conversionChange: 0.8,
    views: 3_480,
    saves: 240,
    inquiries: 112,
    rating: 4.6,
    reviews: 32,
  },
  '30d': {
    revenue: 1_820_000,
    revenueChange: 14,
    bookings: 310,
    bookingsChange: 9,
    conversion: 4.9,
    conversionChange: 0.6,
    views: 13_000,
    saves: 920,
    inquiries: 405,
    rating: 4.6,
    reviews: 86,
  },
  custom: {
    revenue: 920_000,
    revenueChange: 12,
    bookings: 160,
    bookingsChange: 6,
    conversion: 4.4,
    conversionChange: 0.5,
    views: 7_200,
    saves: 520,
    inquiries: 210,
    rating: 4.6,
    reviews: 48,
  },
};

const TIME_SERIES_DATA: Record<
  DateRangeKey,
  { bookings: number[]; revenue: number[]; views: number[]; saves: number[] }
> = {
  today: {
    bookings: [2, 3, 1, 4, 3, 3, 2],
    revenue: [28, 32, 24, 45, 40, 35, 31],
    views: [60, 55, 68, 72, 70, 65, 60],
    saves: [3, 4, 5, 6, 8, 6, 6],
  },
  '7d': {
    bookings: [8, 10, 9, 7, 11, 12, 15],
    revenue: [90, 120, 110, 95, 135, 150, 170],
    views: [400, 420, 380, 390, 420, 450, 490],
    saves: [28, 30, 27, 34, 38, 40, 43],
  },
  '30d': {
    bookings: [12, 16, 14, 18, 20, 25, 30],
    revenue: [160, 200, 180, 215, 230, 270, 310],
    views: [900, 940, 910, 950, 980, 1_050, 1_120],
    saves: [60, 64, 58, 70, 76, 82, 89],
  },
  custom: {
    bookings: [9, 11, 12, 15, 14, 12, 16],
    revenue: [110, 140, 135, 170, 165, 150, 190],
    views: [600, 650, 640, 680, 690, 710, 735],
    saves: [42, 45, 47, 52, 55, 54, 60],
  },
};

const FUNNEL_DATA: Record<
  DateRangeKey,
  {
    views: number;
    saves: number;
    inquiries: number;
    bookings: number;
    responseRate: number;
    medianResponseMinutes: number;
  }
> = {
  today: {
    views: 520,
    saves: 38,
    inquiries: 26,
    bookings: 18,
    responseRate: 92,
    medianResponseMinutes: 18,
  },
  '7d': {
    views: 3_480,
    saves: 240,
    inquiries: 112,
    bookings: 72,
    responseRate: 89,
    medianResponseMinutes: 26,
  },
  '30d': {
    views: 13_000,
    saves: 920,
    inquiries: 405,
    bookings: 310,
    responseRate: 91,
    medianResponseMinutes: 28,
  },
  custom: {
    views: 7_200,
    saves: 520,
    inquiries: 210,
    bookings: 160,
    responseRate: 90,
    medianResponseMinutes: 24,
  },
};

const BOOKING_STATUS_BREAKDOWN: Record<
  DateRangeKey,
  { pending: number; confirmed: number; completed: number; cancelled: number }
> = {
  today: {
 pending: 5,
confirmed: 9,
completed: 12,
cancelled: 2, 
},
  '7d': {
 pending: 17,
confirmed: 28,
completed: 41,
cancelled: 6, 
},
  '30d': {
 pending: 48,
confirmed: 82,
completed: 118,
cancelled: 12, 
},
  custom: {
 pending: 30,
confirmed: 52,
completed: 70,
cancelled: 8, 
},
};

const PEAK_TIMES = {
  days: 'Tue–Thu',
  hours: '9 AM–1 PM',
};

const UPCOMING_BOOKINGS = [
  {
 listing: 'Atlas Loft',
date: 'Apr 11 · 10:00',
type: 'Boardroom',
status: 'Confirmed', 
},
  {
    listing: 'Beacon Collective',
    date: 'Apr 12 · 15:00',
    type: 'Maker Lab',
    status: 'Pending approval',
  },
  {
 listing: 'Harbor Commons',
date: 'Apr 15 · 09:00',
type: 'Studio',
status: 'Confirmed', 
}
];

const BASE_LISTINGS = [
  {
    id: 'atlas-loft',
    name: 'Atlas Loft',
    created: '2025-01-10',
    status: 'Published',
    views: 1_400,
    saves: 130,
    inquiries: 52,
    bookings: 21,
    revenue: 420_000,
    rating: 4.8,
    reviews: 18,
    cancellations: 3,
    lastUpdated: '2025-04-01',
    bookingTypes: ['hourly', 'daily'],
  },
  {
    id: 'beacon-collective',
    name: 'Beacon Collective',
    created: '2025-02-14',
    status: 'Published',
    views: 980,
    saves: 90,
    inquiries: 34,
    bookings: 14,
    revenue: 260_000,
    rating: 4.5,
    reviews: 12,
    cancellations: 1,
    lastUpdated: '2025-03-28',
    bookingTypes: ['hourly'],
  },
  {
    id: 'harbor-commons',
    name: 'Harbor Commons',
    created: '2025-03-05',
    status: 'Draft',
    views: 520,
    saves: 40,
    inquiries: 18,
    bookings: 6,
    revenue: 60_000,
    rating: 4.2,
    reviews: 6,
    cancellations: 0,
    lastUpdated: '2025-03-30',
    bookingTypes: ['daily'],
  }
];

const RANGE_MULTIPLIERS: Record<DateRangeKey, number> = {
  today: 0.15,
  '7d': 1,
  '30d': 3.5,
  custom: 2,
};

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
  const areaPath = `${ linePath } 100,100 0,100`;
  const normalizedId = label.toLowerCase().replace(/[^a-z0-9]+/g, '-');

  return (
    <div className="w-full" aria-label={ `Chart for ${ label }` }>
      <svg viewBox="0 0 100 100" className="h-28 w-full">
        <defs>
          <linearGradient id={ `${ normalizedId }-gradient` } x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={ color } stopOpacity="0.4" />
            <stop offset="100%" stopColor={ color } stopOpacity="0" />
          </linearGradient>
        </defs>
        <g className="text-muted-foreground/40">
          { Array.from({ length: 4, }).map((_, rowIndex) => (
            <line
              key={ `grid-${ rowIndex }-${ normalizedId }` }
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
        <polygon points={ areaPath } fill={ `url(#${ normalizedId }-gradient)` } />
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
            <circle key={ `${ normalizedId }-dot-${ index }` } cx={ x } cy={ y } r="1.5" fill={ color } />
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
      className={ `flex items-center gap-1 text-xs font-semibold ${ isPositive ? 'text-emerald-500 border-emerald-500/40' : 'text-destructive border-destructive/40' }` }
    >
      <Icon className="size-3" aria-hidden="true" />
      { isPositive ? `+${ delta }%` : `${ delta }%` }
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
        <span className="text-foreground font-semibold">{ value.toLocaleString() }</span>
      </div>
      <div className="h-2 rounded-full bg-border/60">
        <div
          className={ `h-full rounded-full ${ accent }` }
          style={ { width: `${ Math.min(100, percent) }%`, } }
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
  const [customStart, setCustomStart] = useState(() => formatInputDate(subDays(new Date(), 7)));
  const [customEnd, setCustomEnd] = useState(() => formatInputDate(new Date()));

  const summary = SUMMARY_DATA[dateRange];
  const chartData = TIME_SERIES_DATA[dateRange];
  const funnel = FUNNEL_DATA[dateRange];
  const bookingStatus = BOOKING_STATUS_BREAKDOWN[dateRange];
  const multiplier = RANGE_MULTIPLIERS[dateRange];

  const filteredListings = useMemo(() => {
    return BASE_LISTINGS.filter((listing) => {
      if (bookingType !== 'all' && !listing.bookingTypes.includes(bookingType)) {
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
  }, [bookingType, listingFilter, searchTerm]);

  const sortedListings = useMemo(() => {
    const rows = filteredListings.map((listing) => {
      const computedViews = Math.round(listing.views * multiplier);
      const computedBookings = Math.max(1, Math.round(listing.bookings * multiplier));
      const computedRevenue = Math.round(listing.revenue * multiplier);
      const conversion = computedViews ? (computedBookings / computedViews) * 100 : 0;
      const cancellations = Math.min(listing.cancellations, computedBookings);
      const cancellationRate = (cancellations / computedBookings) * 100;
      return {
        ...listing,
        views: computedViews,
        bookings: computedBookings,
        revenue: computedRevenue,
        conversion,
        cancellationRate,
      };
    });

    const comparator = (a: typeof rows[number], b: typeof rows[number]) => {
      const direction = sortDirection === 'asc' ? 1 : -1;
      const valueA = a[sortKey] ?? 0;
      const valueB = b[sortKey] ?? 0;
      return (valueA - valueB) * direction;
    };

    return [...rows].sort(comparator);
  }, [filteredListings, multiplier, sortDirection, sortKey]);

  const exportCsv = useCallback(() => {
    const headers = [
      'Listing',
      'Status',
      'Views',
      'Saves',
      'Inquiries',
      'Bookings',
      'Conversion %',
      'Revenue',
      'Rating',
      'Reviews',
      'Cancellation %',
      'Last updated'
    ];
    const rows = sortedListings.map((listing) => [
      listing.name,
      listing.status,
      listing.views.toString(),
      listing.saves.toString(),
      listing.inquiries.toString(),
      listing.bookings.toString(),
      listing.conversion.toFixed(1),
      listing.revenue.toString(),
      listing.rating.toString(),
      listing.reviews.toString(),
      listing.cancellationRate.toFixed(1),
      listing.lastUpdated
    ]);

    const csvContent = [headers, ...rows].map((row) => row.join(',')).join('\n');
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
      value: `₱${ summary.revenue.toLocaleString('en-US') }`,
      helper: 'Bookings + add-ons',
      change: summary.revenueChange,
      accent: 'from-emerald-500/60 via-emerald-500/10 to-transparent',
    },
    {
      label: 'Bookings',
      value: summary.bookings.toString(),
      helper: 'Confirmed + completed',
      change: summary.bookingsChange,
      accent: 'from-sky-500/60 via-sky-500/10 to-transparent',
    },
    {
      label: 'Conversion rate',
      value: `${ summary.conversion.toFixed(1) }%`,
      helper: 'Bookings ÷ listing views',
      change: summary.conversionChange,
      accent: 'from-indigo-500/60 via-indigo-500/10 to-transparent',
    },
    {
      label: 'Listing views',
      value: summary.views.toLocaleString('en-US'),
      helper: `${ summary.saves } saves · ${ summary.inquiries } inquiries`,
      change: Math.round((summary.views / 1_000) * 100) / 100,
      accent: 'from-amber-500/60 via-amber-500/10 to-transparent',
    }
  ];

  const funnelSteps = useMemo(() => {
    const steps = [
      {
 label: 'Views',
value: funnel.views,
accent: 'bg-cyan-500', 
},
      {
 label: 'Saves',
value: funnel.saves,
accent: 'bg-amber-500', 
},
      {
 label: 'Inquiries',
value: funnel.inquiries,
accent: 'bg-sky-500', 
},
      {
 label: 'Bookings',
value: funnel.bookings,
accent: 'bg-emerald-500', 
}
    ];
    const base = funnel.views || 1;
    return steps.map((step) => ({
      ...step,
      percent: (step.value / base) * 100,
    }));
  }, [funnel]);

  const rangeLabel = DATE_RANGE_PRESETS.find((range) => range.value === dateRange)?.label ?? 'Last 7 days';

  return (
    <div className="space-y-8">
      <Card className="rounded-3xl border bg-gradient-to-br from-primary/20 to-primary/5">
        <CardHeader className="items-start gap-4">
          <div>
            <CardTitle className="text-lg font-semibold">Partner dashboard</CardTitle>
            <CardDescription>
              Space performance for the selected timeframe. Use the filters to slice and export
              the data you rely on most.
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-[11px] uppercase tracking-wide">
              { rangeLabel }
            </Badge>
            <Badge className="text-[11px] uppercase tracking-wide">Live data</Badge>
          </div>
        </CardHeader>
      </Card>

      <Card className="rounded-3xl border">
        <CardHeader className="flex flex-col gap-2 md:flex-row md:items-center">
          <div>
            <CardTitle>Filters & controls</CardTitle>
            <CardDescription>Slice the dashboard by date range, listing, or booking type.</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 pt-0">
          <div className="flex flex-wrap gap-4">
            <div className="flex flex-col">
              <Label htmlFor="date-range" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Date range
              </Label>
              <Select value={ dateRange } onValueChange={ (value) => setDateRange(value as DateRangeKey) }>
                <SelectTrigger id="date-range" className="w-44">
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
            <div className="flex flex-col">
              <Label htmlFor="listing-filter" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Listing
              </Label>
              <Select value={ listingFilter } onValueChange={ (value) => setListingFilter(value) }>
                <SelectTrigger id="listing-filter" className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All listings</SelectItem>
                  { BASE_LISTINGS.map((listing) => (
                    <SelectItem key={ listing.id } value={ listing.id }>
                      { listing.name }
                    </SelectItem>
                  )) }
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col">
              <Label htmlFor="booking-type" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Booking type
              </Label>
              <Select value={ bookingType } onValueChange={ (value) => setBookingType(value as BookingTypeKey) }>
                <SelectTrigger id="booking-type" className="w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="hourly">Hourly</SelectItem>
                  <SelectItem value="daily">Daily</SelectItem>
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
            <Button variant="outline" onClick={ exportCsv }>
              Export CSV
            </Button>
            <Badge variant="secondary" className="text-xs uppercase tracking-wide">
              Listing conversion = bookings ÷ views
            </Badge>
          </div>
          { dateRange === 'custom' && (
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex flex-col">
                <Label htmlFor="custom-start" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
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
                <Label htmlFor="custom-end" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
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
                  ? `${ format(new Date(customStart), 'MMM dd')} – ${ format(new Date(customEnd), 'MMM dd')}`
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
            className="rounded-3xl border bg-gradient-to-br from-white/70 to-white/10 shadow-[0_20px_60px_rgba(15,23,42,0.16)] dark:from-foreground/10 dark:to-transparent"
          >
            <CardContent className="space-y-2 px-4 py-5">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  { metric.label }
                </p>
                <ChangeBadge delta={ metric.change } />
              </div>
              <p className="text-3xl font-semibold text-foreground">{ metric.value }</p>
              <p className="text-xs text-muted-foreground">{ metric.helper }</p>
              <div
                className={ `h-1 rounded-full ${ metric.accent } mt-2` }
                aria-hidden="true"
              />
            </CardContent>
          </Card>
        )) }
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="rounded-3xl border xl:col-span-2">
          <CardHeader className="flex items-center justify-between gap-2">
            <div>
              <CardTitle>Bookings & revenue over time</CardTitle>
              <CardDescription>Tracks the same range as your filters.</CardDescription>
            </div>
            <Badge variant="outline" className="text-xs uppercase tracking-wide">
              Trend
            </Badge>
          </CardHeader>
          <CardContent className="space-y-5 px-0">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              { DATE_TICKS.map((tick) => (
                <span key={ tick }>{ tick }</span>
              )) }
            </div>
            <MiniLineChart values={ chartData.bookings } color="#0ea5e9" label="Bookings" />
            <MiniLineChart values={ chartData.revenue } color="#fb923c" label="Revenue" />
          </CardContent>
        </Card>
        <Card className="rounded-3xl border">
          <CardHeader>
            <div>
              <CardTitle>Views vs bookings</CardTitle>
              <CardDescription>Funnel health indicator.</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-5 px-0">
            <MiniLineChart values={ chartData.views } color="#22c55e" label="Views" />
            <MiniLineChart values={ chartData.saves } color="#a855f7" label="Saves" />
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-3xl border">
        <CardHeader className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle>Funnel & engagement</CardTitle>
            <CardDescription>Track every step from views to bookings.</CardDescription>
          </div>
          <Badge variant="secondary" className="text-xs uppercase tracking-wide">
            Inquiry response { funnel.responseRate }%
          </Badge>
        </CardHeader>
        <CardContent className="space-y-6 px-0">
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
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Median first response</p>
              <p className="text-2xl font-semibold">{ funnel.medianResponseMinutes } min</p>
            </div>
            <div className="space-y-1 rounded-2xl border border-border/60 p-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Average rating</p>
              <p className="text-2xl font-semibold">{ summary.rating.toFixed(1) }★</p>
              <p className="text-xs text-muted-foreground">{ summary.reviews } reviews</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-3xl border">
        <CardHeader className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle>Listing performance</CardTitle>
            <CardDescription>Sortable & exportable per listing metrics.</CardDescription>
          </div>
          <Badge variant="outline" className="text-xs uppercase tracking-wide">
            { sortedListings.length } listings
          </Badge>
        </CardHeader>
        <CardContent className="px-0 pb-0">
          <Table>
            <TableHeader>
              <TableRow>
                { [
                  {
 label: 'Listing',
key: 'name', 
},
                  {
 label: 'Views',
key: 'views', 
},
                  {
 label: 'Saves',
key: 'saves', 
},
                  {
 label: 'Inquiries',
key: 'inquiries', 
},
                  {
 label: 'Bookings',
key: 'bookings', 
},
                  {
 label: 'Conversion %',
key: 'conversion', 
},
                  {
 label: 'Revenue',
key: 'revenue', 
},
                  {
 label: 'Cancellation %',
key: 'cancellation', 
},
                  {
 label: 'Last updated',
key: 'lastUpdated', 
}
                ].map((column) => (
                  <TableHead key={ column.label }>
                    <button
                      type="button"
                      aria-label={ column.key === 'name' ? undefined : `Sort by ${ column.label }` }
                      className="flex items-center gap-1 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                      onClick={ () => (column.key !== 'name' ? cycleSort(column.key as SortKey) : undefined) }
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
                    <p className="text-sm font-semibold text-foreground">{ listing.name }</p>
                    <p className="text-xs text-muted-foreground">{ listing.status }</p>
                  </TableCell>
                  <TableCell>{ listing.views.toLocaleString() }</TableCell>
                  <TableCell>{ listing.saves.toLocaleString() }</TableCell>
                  <TableCell>{ listing.inquiries.toLocaleString() }</TableCell>
                  <TableCell>{ listing.bookings.toLocaleString() }</TableCell>
                  <TableCell>{ listing.conversion.toFixed(1) }%</TableCell>
                  <TableCell>₱{ listing.revenue.toLocaleString('en-US') }</TableCell>
                  <TableCell>{ listing.cancellationRate.toFixed(1) }%</TableCell>
                  <TableCell>{ format(new Date(listing.lastUpdated), 'MMM dd') }</TableCell>
                </TableRow>
              )) }
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="rounded-3xl border">
          <CardHeader>
            <div>
              <CardTitle>Booking status</CardTitle>
              <CardDescription>Track lifecycle health</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            { Object.entries(bookingStatus).map(([status, value]) => {
              const total = Object.values(bookingStatus).reduce((sum, current) => sum + current, 0);
              const percent = total ? Math.round((value / total) * 100) : 0;
              return (
                <div key={ status } className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <span className="capitalize">{ status }</span>
                    <Badge variant="outline" className="text-[10px] uppercase tracking-wide">
                      { percent }%
                    </Badge>
                  </div>
                  <span className="font-semibold">{ value }</span>
                </div>
              );
            }) }
          </CardContent>
        </Card>
        <Card className="rounded-3xl border">
          <CardHeader>
            <div>
              <CardTitle>Operational insights</CardTitle>
              <CardDescription>Upcoming bookings & peak demand</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Upcoming bookings</p>
              { UPCOMING_BOOKINGS.map((booking) => (
                <div
                  key={ `${ booking.listing }${ booking.date }` }
                  className="flex items-center justify-between rounded-2xl border border-border/60 px-4 py-3"
                >
                  <div>
                    <p className="font-semibold">{ booking.listing }</p>
                    <p className="text-xs text-muted-foreground">
                      { booking.date } · { booking.type }
                    </p>
                  </div>
                  <Badge variant="secondary">{ booking.status }</Badge>
                </div>
              )) }
            </div>
            <div className="space-y-1 rounded-2xl border border-border/60 px-4 py-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Peak performance</p>
              <p className="text-sm font-semibold">Days: { PEAK_TIMES.days }</p>
              <p className="text-sm font-semibold">Hours: { PEAK_TIMES.hours }</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

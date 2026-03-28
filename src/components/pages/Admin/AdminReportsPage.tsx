'use client';

import React, {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef
} from 'react';
import Link from 'next/link';
import {
  FiArrowDownRight,
  FiArrowUpRight,
  FiChevronRight,
  FiDownload,
  FiExternalLink,
  FiFilter,
  FiRefreshCw,
  FiSearch,
  FiFileText,
  FiTrendingUp
} from 'react-icons/fi';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  XAxis,
  YAxis
} from 'recharts';
import { toast } from 'sonner';

import { exportPdf, type PdfSection } from '@/lib/export-pdf';
import {
  type AdminReportDailyBooking,
  type AdminReportDailyRevenue,
  type AdminReportPayload,
  type AdminReportQueueHealth,
  type AdminReportRiskSpace,
  useAdminReportsQuery
} from '@/hooks/api/useAdminReports';
import {
  type ChartConfig,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent
} from '@/components/ui/chart';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import { SystemErrorIllustration } from '@/components/pages/Marketplace/Marketplace.ErrorState';
import { formatCurrencyMinor } from '@/lib/wallet';
import { cn } from '@/lib/utils';

const RANGE_OPTIONS = [
  {
 label: 'Last 7 days',
value: 7, 
},
  {
 label: 'Last 30 days',
value: 30, 
},
  {
 label: 'Last 90 days',
value: 90, 
}
] as const;

const numberFormatter = new Intl.NumberFormat('en-US');
const dateFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
});
const dateTimeFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
});

const formatRate = (value?: number | null) =>
  value === null || value === undefined
    ? '-'
    : `${(value * 100).toFixed(1)}%`;

const formatCount = (value?: number | null) =>
  value === null || value === undefined
    ? '-'
    : numberFormatter.format(value);

const formatMinor = (value?: string | null) =>
  value ? formatCurrencyMinor(value, 'PHP') : '-';

const formatChangeLabel = (value?: number | null) => {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return 'No prior data';
  }
  if (value === 0) {
    return 'No change';
  }
  return `${Math.abs(value).toFixed(1)}% ${value > 0 ? 'increase' : 'decrease'}`;
};

const calculateRiskScore = (cancellationRate: number, totalBookings: number) =>
  Math.round(
    Math.min(100, cancellationRate * 100 + Math.min(totalBookings, 50))
  );

const getRiskTier = (cancellationRate: number) => {
  if (cancellationRate >= RISK_ALERT_THRESHOLD) {
    return 'High';
  }
  if (cancellationRate >= 0.15) {
    return 'Moderate';
  }
  return 'Watch';
};

const ensurePdfTableRows = (
  rows: string[][],
  columnCount: number,
  emptyLabel = 'No data available'
) => (
  rows.length
    ? rows
    : [[emptyLabel, ...Array.from({ length: columnCount - 1, }, () => '—')]]
);

const formatRangeLabel = (range?: AdminReportPayload['range']) => {
  if (!range) return '-';
  const start = dateFormatter.format(new Date(range.start));
  const end = dateFormatter.format(new Date(range.end));
  const previousStart = dateFormatter.format(new Date(range.previousStart));
  const previousEnd = dateFormatter.format(new Date(range.previousEnd));
  return `${start} - ${end} (vs ${previousStart} - ${previousEnd})`;
};

const formatDateTimeLabel = (value?: string) => {
  if (!value) return '-';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '-';
  return dateTimeFormatter.format(parsed);
};

const QUEUE_ROUTE_MAP: Record<AdminReportPayload['queueHealth'][number]['key'], string> = {
  verifications: '/admin/verification-queue',
  unpublish_requests: '/admin/unpublish-requests',
  deactivation_requests: '/admin/deactivation-requests',
  chat_reports: '/admin/chat-reports',
  payout_requests: '/admin/payout-requests',
};

const QUEUE_LABEL_HELP: Record<AdminReportPayload['queueHealth'][number]['key'], string> = {
  verifications: 'Partner verification submissions awaiting review.',
  unpublish_requests: 'Partner requests to unpublish a space.',
  deactivation_requests: 'Account deactivation approvals.',
  chat_reports: 'Reports raised from chat conversations.',
  payout_requests: 'Partner payout requests awaiting review.',
};

const RISK_ALERT_THRESHOLD = 0.3;

type ActiveMetric = {
  key: string;
  title: string;
  description: string;
  summary: string;
  previousLabel: string;
  changePct: number | null;
  highlights: string[];
};

type ReportUiState = {
  rangeDays: typeof RANGE_OPTIONS[number]['value'];
  activeMetric: ActiveMetric | null;
  queuePendingOnly: boolean;
  riskHighOnly: boolean;
  riskSearch: string;
};

type ReportUiAction =
  | { type: 'set-range'; value: typeof RANGE_OPTIONS[number]['value'] }
  | { type: 'set-active-metric'; value: ActiveMetric | null }
  | { type: 'set-queue-pending-only'; value: boolean }
  | { type: 'set-risk-high-only'; value: boolean }
  | { type: 'set-risk-search'; value: string };

const initialReportUiState: ReportUiState = {
  rangeDays: RANGE_OPTIONS[1].value,
  activeMetric: null,
  queuePendingOnly: false,
  riskHighOnly: false,
  riskSearch: '',
};

function reportUiReducer(state: ReportUiState, action: ReportUiAction): ReportUiState {
  switch (action.type) {
    case 'set-range':
      return {
 ...state,
rangeDays: action.value, 
};
    case 'set-active-metric':
      return {
 ...state,
activeMetric: action.value, 
};
    case 'set-queue-pending-only':
      return {
 ...state,
queuePendingOnly: action.value, 
};
    case 'set-risk-high-only':
      return {
 ...state,
riskHighOnly: action.value, 
};
    case 'set-risk-search':
      return {
 ...state,
riskSearch: action.value, 
};
    default:
      return state;
  }
}

type MetricCardProps = {
  title: string;
  description: string;
  value: string;
  previousLabel: string;
  changePct: number | null;
  footnote?: string;
  isLoading: boolean;
  onClick?: () => void;
};

const MetricCard = ({
  title,
  description,
  value,
  previousLabel,
  changePct,
  footnote,
  isLoading,
  onClick,
}: MetricCardProps) => {
  const changeBadge = useMemo(() => {
    if (changePct === null || Number.isNaN(changePct)) {
      return (
        <span className="text-xs text-muted-foreground">
          No prior data
        </span>
      );
    }

    const isPositive = changePct >= 0;
    const Icon = isPositive ? FiArrowUpRight : FiArrowDownRight;

    return (
      <Badge
        variant={ isPositive ? 'success' : 'destructive' }
        className="gap-1 text-[11px]"
      >
        <Icon className="size-3.5" aria-hidden="true" />
        { Math.abs(changePct).toFixed(1) }%
      </Badge>
    );
  }, [changePct]);

  return (
    <Card className="rounded-md border border-border/70 bg-muted/20 shadow-none">
      <CardHeader className="space-y-1">
        <CardTitle className="text-base font-semibold">{ title }</CardTitle>
        <CardDescription className="text-xs text-muted-foreground">
          { description }
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2 pt-1 pb-4">
        { isLoading ? (
          <Skeleton className="h-8 w-28" />
        ) : (
          <p className="text-2xl font-semibold tracking-tight">{ value }</p>
        ) }
        { isLoading ? (
          <div className="flex gap-2">
            <Skeleton className="h-5 w-16" />
            <Skeleton className="h-5 w-24" />
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            { changeBadge }
            <span className="text-xs text-muted-foreground">
              { previousLabel }
            </span>
          </div>
        ) }
        { footnote && (
          <p className="text-xs text-muted-foreground">{ footnote }</p>
        ) }
        { onClick && !isLoading && (
          <Button
            type="button"
            variant="ghost"
            className="h-8 w-full justify-between px-2 text-xs"
            onClick={ onClick }
          >
            <span>View details</span>
            <FiChevronRight className="size-3.5" aria-hidden="true" />
          </Button>
        ) }
      </CardContent>
    </Card>
  );
};

const TableSkeletonRows = ({
 rows, columns, 
}: { rows: number; columns: number }) => (
  <>
    { Array.from({ length: rows, }).map((_, index) => (
      <TableRow key={ `skeleton-${index}` }>
        { Array.from({ length: columns, }).map((__, cellIndex) => (
          <TableCell key={ `skeleton-${index}-${cellIndex}` }>
            <Skeleton className="h-4 w-full" />
          </TableCell>
        )) }
      </TableRow>
    )) }
  </>
);

type ReportHeaderProps = {
  rangeLabel: string;
  lastUpdatedLabel: string;
  rangeDays: number;
  isFetching: boolean;
  onRefresh: () => void;
  onRangeChange: (value: string) => void;
};

function ReportHeader({
  rangeLabel,
  lastUpdatedLabel,
  rangeDays,
  isFetching,
  onRefresh,
  onRangeChange,
}: ReportHeaderProps) {
  return (
    <div className="rounded-md border border-border/60 bg-gradient-to-br from-background via-background to-muted/40 p-6 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
            Admin Reports
          </h1>
          <p className="text-sm text-muted-foreground md:text-base">
            Trends, queue health, and risk signals across the marketplace.
          </p>
          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-background/80 px-3 py-1">
              <FiTrendingUp className="size-4" aria-hidden="true" />
              { rangeLabel }
            </span>
            <span className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-background/80 px-3 py-1">
              Last updated: { lastUpdatedLabel }
            </span>
            { isFetching && <span className="text-xs">Updating...</span> }
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={ onRefresh }
            className="gap-2"
          >
            <FiRefreshCw className="size-4" aria-hidden="true" />
            Refresh
          </Button>
          <Label htmlFor="admin-report-range" className="sr-only">Report range</Label>
          <Select
            value={ String(rangeDays) }
            onValueChange={ onRangeChange }
          >
            <SelectTrigger
              id="admin-report-range"
              className="h-9 w-[160px] rounded-md"
              aria-label="Select report range"
            >
              <SelectValue placeholder="Range" />
            </SelectTrigger>
            <SelectContent>
              { RANGE_OPTIONS.map((option) => (
                <SelectItem key={ option.value } value={ String(option.value) }>
                  { option.label }
                </SelectItem>
              )) }
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}

type SummarySectionProps = {
  cards: MetricCardProps[];
  onSelectMetric: (metric: ActiveMetric) => void;
  trends: AdminReportPayload['trends'] | undefined;
};

function SummarySection({
 cards, onSelectMetric, trends, 
}: SummarySectionProps) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      { cards.map((card) => (
        <MetricCard
          key={ card.title }
          { ...card }
          onClick={ () => {
            if (!trends || card.isLoading) return;
            const metricKey = card.title;
            const details = (() => {
              switch (metricKey) {
                case 'Bookings Volume':
                  return {
                    key: 'bookings',
                    title: 'Bookings Volume',
                    description: 'Bookings created in the selected period.',
                    summary: `${formatCount(trends.bookings.current)} bookings created`,
                    previousLabel: `Previous: ${formatCount(trends.bookings.previous)}`,
                    changePct: trends.bookings.changePct,
                    highlights: [
                      'Counts include all booking statuses created in the range.',
                      'Use this to track demand volume.'
                    ],
                  };
                case 'Gross Revenue':
                  return {
                    key: 'gross_revenue',
                    title: 'Gross Revenue',
                    description: 'Succeeded payments recorded in the period.',
                    summary: `${formatMinor(trends.grossRevenue.currentMinor)} collected`,
                    previousLabel: `Previous: ${formatMinor(trends.grossRevenue.previousMinor)}`,
                    changePct: trends.grossRevenue.changePct,
                    highlights: [
                      'Based on succeeded payment transactions.',
                      'Refunds are tracked separately below.'
                    ],
                  };
                case 'Cancellation Rate':
                  return {
                    key: 'cancellation_rate',
                    title: 'Cancellation Rate',
                    description: 'Cancelled and no-show bookings relative to total bookings.',
                    summary: `${formatRate(trends.cancellationRate.current)} cancellation rate`,
                    previousLabel: `Previous: ${formatRate(trends.cancellationRate.previous)}`,
                    changePct: trends.cancellationRate.changePct,
                    highlights: [
                      'Focus on this when identifying at-risk spaces.',
                      'Combine with risk table insights.'
                    ],
                  };
                case 'Refund Rate':
                  return {
                    key: 'refund_rate',
                    title: 'Refund Rate',
                    description: 'Refunded bookings relative to successful payments.',
                    summary: `${formatRate(trends.refunds.rate.current)} refund rate`,
                    previousLabel: `Previous: ${formatRate(trends.refunds.rate.previous)}`,
                    changePct: trends.refunds.rate.changePct,
                    highlights: [
                      `Refunded amount: ${formatMinor(trends.refunds.amountMinor.currentMinor)}`,
                      'Track payout impact and dispute volume.'
                    ],
                  };
                default:
                  return {
                    key: 'average_rating',
                    title: 'Average Rating',
                    description: 'Average review rating recorded in the period.',
                    summary: trends.averageRating.current === null
                      ? 'No reviews in this range.'
                      : `${trends.averageRating.current.toFixed(2)} average rating`,
                    previousLabel: trends.averageRating.previous === null
                      ? 'Previous: -'
                      : `Previous: ${trends.averageRating.previous.toFixed(2)}`,
                    changePct: trends.averageRating.changePct,
                    highlights: [
                      'Based on submitted reviews only.',
                      'Use alongside cancellations to monitor quality.'
                    ],
                  };
              }
            })();
            onSelectMetric(details);
          } }
        />
      )) }
    </div>
  );
}

type QueueSectionProps = {
  isLoading: boolean;
  queues: AdminReportPayload['queueHealth'];
  pendingOnly: boolean;
  onTogglePendingOnly: (value: boolean) => void;
  onExport: () => void;
};

function QueueSection({
  isLoading,
  queues,
  pendingOnly,
  onTogglePendingOnly,
  onExport,
}: QueueSectionProps) {
  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h3 className="text-lg font-semibold tracking-tight">
          Queue Health
        </h3>
        <p className="text-sm text-muted-foreground">
          Pending volume and resolution speed for admin queues.
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-3 rounded-md border border-border/60 bg-background/80 p-3">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <FiFilter className="size-4" aria-hidden="true" />
          Queue filters
        </div>
        <div className="flex items-center gap-2">
          <Switch
            id="queue-pending-only"
            checked={ pendingOnly }
            onCheckedChange={ onTogglePendingOnly }
          />
          <Label htmlFor="queue-pending-only" className="text-xs">
            Pending only
          </Label>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="ml-auto gap-2"
          onClick={ onExport }
        >
          <FiDownload className="size-4" aria-hidden="true" />
          Export CSV
        </Button>
      </div>
      <div className="rounded-md border border-border/70 bg-muted/20">
        <div className="overflow-x-auto">
          <Table className="min-w-[720px]">
            <TableHeader>
              <TableRow>
                <TableHead>Queue</TableHead>
                <TableHead>Pending</TableHead>
                <TableHead>Oldest (days)</TableHead>
                <TableHead>Avg resolution (days)</TableHead>
                <TableHead>Resolved</TableHead>
                <TableHead>Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              { isLoading ? (
                <TableSkeletonRows rows={ 5 } columns={ 6 } />
              ) : queues.length ? (
                queues.map((queue) => (
                  <TableRow key={ queue.key }>
                    <TableCell className="font-medium">
                      <div className="space-y-0.5">
                        <p>{ queue.label }</p>
                        <p className="text-xs text-muted-foreground">
                          { QUEUE_LABEL_HELP[queue.key] }
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>{ formatCount(queue.pendingCount) }</TableCell>
                    <TableCell>
                      { queue.oldestPendingDays === null
                        ? '-'
                        : queue.oldestPendingDays }
                    </TableCell>
                    <TableCell>
                      { queue.averageResolutionDays === null
                        ? '-'
                        : queue.averageResolutionDays.toFixed(1) }
                    </TableCell>
                    <TableCell>
                      { formatCount(queue.resolvedCount) }
                    </TableCell>
                    <TableCell>
                      <Button asChild size="sm" variant="outline" className="gap-2">
                        <Link href={ QUEUE_ROUTE_MAP[queue.key] }>
                          Open queue
                          <FiExternalLink className="size-3.5" aria-hidden="true" />
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={ 6 } className="py-10 text-center text-sm text-muted-foreground">
                    No queue activity in this range.
                  </TableCell>
                </TableRow>
              ) }
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}

type RiskSectionProps = {
  isLoading: boolean;
  spaces: AdminReportPayload['risk']['topCancellationSpaces'];
  summary: string;
  searchValue: string;
  highOnly: boolean;
  onSearchChange: (value: string) => void;
  onToggleHighOnly: (value: boolean) => void;
  onExport: () => void;
};

function RiskSection({
  isLoading,
  spaces,
  summary,
  searchValue,
  highOnly,
  onSearchChange,
  onToggleHighOnly,
  onExport,
}: RiskSectionProps) {
  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h3 className="text-lg font-semibold tracking-tight">
          Cancellation Risk
        </h3>
        <p className="text-sm text-muted-foreground">
          Spaces with the highest cancellation rates in the period.
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-3 rounded-md border border-border/60 bg-background/80 p-3">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <FiSearch className="size-4" aria-hidden="true" />
          Filter spaces
        </div>
        <Input
          value={ searchValue }
          onChange={ (event) => onSearchChange(event.target.value) }
          placeholder="Search space, city, or region"
          aria-label="Search cancellation risk spaces"
          className="h-8 w-full max-w-[240px]"
        />
        <div className="flex items-center gap-2">
          <Switch
            id="risk-high-only"
            checked={ highOnly }
            onCheckedChange={ onToggleHighOnly }
          />
          <Label htmlFor="risk-high-only" className="text-xs">
            High risk only
          </Label>
        </div>
        <Badge variant="secondary" className="ml-auto text-xs">
          { summary }
        </Badge>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-2"
          onClick={ onExport }
        >
          <FiDownload className="size-4" aria-hidden="true" />
          Export CSV
        </Button>
      </div>
      <div className="rounded-md border border-border/70 bg-muted/20">
        <div className="overflow-x-auto">
          <Table className="min-w-[720px]">
            <TableHeader>
              <TableRow>
                <TableHead>Space</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Bookings</TableHead>
                <TableHead>Cancelled</TableHead>
                <TableHead>Rate</TableHead>
                <TableHead>Signal</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              { isLoading ? (
                <TableSkeletonRows rows={ 4 } columns={ 6 } />
              ) : spaces.length ? (
                spaces.map((space) => {
                  const isHighRisk = space.cancellationRate >= RISK_ALERT_THRESHOLD;
                  const score = calculateRiskScore(
                    space.cancellationRate,
                    space.totalBookings
                  );
                  return (
                    <TableRow key={ space.space_id }>
                      <TableCell className="font-medium">
                        <div className="space-y-0.5">
                          <p>{ space.space_name }</p>
                          <p className="text-xs text-muted-foreground">
                            { space.totalBookings } bookings in range
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        { space.city }, { space.region }
                      </TableCell>
                      <TableCell>{ formatCount(space.totalBookings) }</TableCell>
                      <TableCell>{ formatCount(space.cancelledBookings) }</TableCell>
                      <TableCell>
                        <span
                          className={ cn(
                            'text-xs font-semibold',
                            isHighRisk
                              ? 'text-destructive'
                              : 'text-muted-foreground'
                          ) }
                        >
                          { formatRate(space.cancellationRate) }
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge variant={ isHighRisk ? 'destructive' : 'secondary' } className="text-xs">
                          Risk { score }
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })
              ) : (
                <TableRow>
                  <TableCell colSpan={ 6 } className="py-10 text-center text-sm text-muted-foreground">
                    No high-cancellation spaces in this range.
                  </TableCell>
                </TableRow>
              ) }
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}

const chartPrimaryTheme = {
  light: 'var(--primary)',
  dark: 'var(--secondary)',
} as const;

const chartPrimaryMutedTheme = {
  light: 'color-mix(in oklch, var(--primary) 45%, var(--background))',
  dark: 'color-mix(in oklch, var(--secondary) 45%, var(--background))',
} as const;

const bookingsChartConfig = {
  bookings: {
    label: 'Bookings',
    theme: chartPrimaryTheme,
  },
  cancellations: {
    label: 'Cancellations',
    theme: chartPrimaryMutedTheme,
  },
} satisfies ChartConfig;

const revenueChartConfig = {
  revenue: {
    label: 'Revenue',
    theme: chartPrimaryTheme,
  },
} satisfies ChartConfig;

const queueChartConfig = {
  pendingCount: {
    label: 'Pending',
    theme: chartPrimaryMutedTheme,
  },
  resolvedCount: {
    label: 'Resolved',
    theme: chartPrimaryTheme,
  },
} satisfies ChartConfig;

const riskChartConfig = {
  cancellationRate: {
    label: 'Cancellation Rate',
    theme: chartPrimaryTheme,
  },
} satisfies ChartConfig;

const shortDateFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
});

const formatShortDate = (value: string) => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return shortDateFormatter.format(parsed);
};

const CHART_EXPORT_STYLE_PROPERTIES = [
  'fill',
  'fill-opacity',
  'stroke',
  'stroke-opacity',
  'stroke-width',
  'stroke-dasharray',
  'stroke-linecap',
  'stroke-linejoin',
  'opacity',
  'font-size',
  'font-family',
  'font-weight',
  'letter-spacing',
  'text-anchor',
  'dominant-baseline',
  'color',
  'display',
  'visibility'
] as const;

const waitForChartPaint = async () => {
  await new Promise<void>((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => resolve());
    });
  });
};

const cloneSvgForExport = (svg: SVGSVGElement) => {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  const sourceElements = [svg, ...Array.from(svg.querySelectorAll('*'))];
  const cloneElements = [clone, ...Array.from(clone.querySelectorAll('*'))];

  sourceElements.forEach((sourceElement, index) => {
    const cloneElement = cloneElements[index];
    if (!cloneElement) {
      return;
    }

    const computedStyle = window.getComputedStyle(sourceElement);
    const inlineStyle = CHART_EXPORT_STYLE_PROPERTIES.map((property) => {
      const value = computedStyle.getPropertyValue(property);
      return value ? `${property}:${value};` : '';
    }).join('');

    const existingStyle = cloneElement.getAttribute('style') ?? '';
    if (inlineStyle) {
      cloneElement.setAttribute('style', `${existingStyle}${inlineStyle}`);
    }
  });

  return clone;
};

const captureChartImage = async (
  container: HTMLDivElement | null
): Promise<string | null> => {
  if (!container) {
    return null;
  }

  await waitForChartPaint();

  const svg = container.querySelector('svg');
  if (!(svg instanceof SVGSVGElement)) {
    return null;
  }

  const bounds = svg.getBoundingClientRect();
  const width = Math.max(
    Math.round(bounds.width),
    svg.viewBox.baseVal.width || Number(svg.getAttribute('width')) || 0
  );
  const height = Math.max(
    Math.round(bounds.height),
    svg.viewBox.baseVal.height || Number(svg.getAttribute('height')) || 0
  );

  if (width <= 0 || height <= 0) {
    return null;
  }

  const exportedSvg = cloneSvgForExport(svg);
  exportedSvg.setAttribute('width', String(width));
  exportedSvg.setAttribute('height', String(height));
  if (!exportedSvg.getAttribute('viewBox')) {
    exportedSvg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  }

  const serializedSvg = new XMLSerializer().serializeToString(exportedSvg);
  const svgBlob = new Blob([serializedSvg], { type: 'image/svg+xml;charset=utf-8', });
  const objectUrl = URL.createObjectURL(svgBlob);

  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const nextImage = new Image();
      nextImage.onload = () => resolve(nextImage);
      nextImage.onerror = () => reject(new Error('Unable to load chart image.'));
      nextImage.src = objectUrl;
    });

    const scale = 2;
    const canvas = document.createElement('canvas');
    canvas.width = width * scale;
    canvas.height = height * scale;

    const context = canvas.getContext('2d');
    if (!context) {
      return null;
    }

    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.scale(scale, scale);
    context.drawImage(image, 0, 0, width, height);
    return canvas.toDataURL('image/png');
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
};

type BookingsChartProps = {
  data: AdminReportDailyBooking[];
  isLoading: boolean;
  captureRef?: React.RefObject<HTMLDivElement | null>;
};

function BookingsChart({
 data, isLoading, captureRef,
}: BookingsChartProps) {
  return (
    <Card className="rounded-md border border-border/70 bg-muted/20 shadow-none">
      <CardHeader>
        <CardTitle className="text-base">Bookings Trend</CardTitle>
        <CardDescription className="text-xs text-muted-foreground">
          Daily bookings and cancellations over the selected period.
        </CardDescription>
      </CardHeader>
      <CardContent>
        { isLoading ? (
          <Skeleton className="h-[260px] w-full" />
        ) : data.length === 0 ? (
          <p className="py-12 text-center text-sm text-muted-foreground">
            No booking data in this range.
          </p>
        ) : (
          <div ref={ captureRef }>
            <ChartContainer config={ bookingsChartConfig } className="aspect-auto h-[260px] w-full">
              <BarChart data={ data } accessibilityLayer>
                <CartesianGrid vertical={ false } />
                <XAxis
                  dataKey="date"
                  tickLine={ false }
                  axisLine={ false }
                  tickMargin={ 8 }
                  tickFormatter={ formatShortDate }
                />
                <YAxis tickLine={ false } axisLine={ false } allowDecimals={ false } width={ 40 } />
                <ChartTooltip
                  content={
                    <ChartTooltipContent
                      labelFormatter={ (value) => formatShortDate(String(value)) }
                    />
                  }
                />
                <ChartLegend content={ <ChartLegendContent /> } />
                <Bar dataKey="bookings" fill="var(--color-bookings)" radius={ [4, 4, 0, 0] } />
                <Bar dataKey="cancellations" fill="var(--color-cancellations)" radius={ [4, 4, 0, 0] } />
              </BarChart>
            </ChartContainer>
          </div>
        ) }
      </CardContent>
    </Card>
  );
}

type RevenueChartProps = {
  data: AdminReportDailyRevenue[];
  isLoading: boolean;
  captureRef?: React.RefObject<HTMLDivElement | null>;
};

function RevenueChart({
 data, isLoading, captureRef,
}: RevenueChartProps) {
  const chartData = useMemo(
    () => data.map((entry) => ({
      date: entry.date,
      revenue: Number(entry.revenueMinor) / 100,
    })),
    [data]
  );

  return (
    <Card className="rounded-md border border-border/70 bg-muted/20 shadow-none">
      <CardHeader>
        <CardTitle className="text-base">Revenue Trend</CardTitle>
        <CardDescription className="text-xs text-muted-foreground">
          Daily gross revenue (PHP) over the selected period.
        </CardDescription>
      </CardHeader>
      <CardContent>
        { isLoading ? (
          <Skeleton className="h-[260px] w-full" />
        ) : chartData.length === 0 ? (
          <p className="py-12 text-center text-sm text-muted-foreground">
            No revenue data in this range.
          </p>
        ) : (
          <div ref={ captureRef }>
            <ChartContainer config={ revenueChartConfig } className="aspect-auto h-[260px] w-full">
              <AreaChart data={ chartData } accessibilityLayer>
                <defs>
                  <linearGradient id="fillRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--color-revenue)" stopOpacity={ 0.8 } />
                    <stop offset="95%" stopColor="var(--color-revenue)" stopOpacity={ 0.1 } />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={ false } />
                <XAxis
                  dataKey="date"
                  tickLine={ false }
                  axisLine={ false }
                  tickMargin={ 8 }
                  tickFormatter={ formatShortDate }
                />
                <YAxis
                  tickLine={ false }
                  axisLine={ false }
                  width={ 60 }
                  tickFormatter={ (value: number) => `${numberFormatter.format(value)}` }
                />
                <ChartTooltip
                  content={
                    <ChartTooltipContent
                      labelFormatter={ (value) => formatShortDate(String(value)) }
                      formatter={ (value) => [`PHP ${numberFormatter.format(Number(value))}`, 'Revenue'] }
                    />
                  }
                />
                <Area
                  dataKey="revenue"
                  type="monotone"
                  fill="url(#fillRevenue)"
                  stroke="var(--color-revenue)"
                  strokeWidth={ 2 }
                />
              </AreaChart>
            </ChartContainer>
          </div>
        ) }
      </CardContent>
    </Card>
  );
}

type QueueChartProps = {
  data: AdminReportQueueHealth[];
  isLoading: boolean;
  captureRef?: React.RefObject<HTMLDivElement | null>;
};

function QueueChart({
 data, isLoading, captureRef,
}: QueueChartProps) {
  return (
    <Card className="rounded-md border border-border/70 bg-muted/20 shadow-none">
      <CardHeader>
        <CardTitle className="text-base">Queue Overview</CardTitle>
        <CardDescription className="text-xs text-muted-foreground">
          Pending vs resolved items per admin queue.
        </CardDescription>
      </CardHeader>
      <CardContent>
        { isLoading ? (
          <Skeleton className="h-[220px] w-full" />
        ) : data.length === 0 ? (
          <p className="py-12 text-center text-sm text-muted-foreground">
            No queue data available.
          </p>
        ) : (
          <div ref={ captureRef }>
            <ChartContainer config={ queueChartConfig } className="aspect-auto h-[220px] w-full">
              <BarChart data={ data } layout="vertical" accessibilityLayer>
                <CartesianGrid horizontal={ false } />
                <YAxis
                  dataKey="label"
                  type="category"
                  tickLine={ false }
                  axisLine={ false }
                  width={ 120 }
                  className="text-xs"
                />
                <XAxis type="number" tickLine={ false } axisLine={ false } allowDecimals={ false } />
                <ChartTooltip content={ <ChartTooltipContent /> } />
                <ChartLegend content={ <ChartLegendContent /> } />
                <Bar dataKey="pendingCount" fill="var(--color-pendingCount)" radius={ [0, 4, 4, 0] } />
                <Bar dataKey="resolvedCount" fill="var(--color-resolvedCount)" radius={ [0, 4, 4, 0] } />
              </BarChart>
            </ChartContainer>
          </div>
        ) }
      </CardContent>
    </Card>
  );
}

type RiskChartProps = {
  data: AdminReportRiskSpace[];
  isLoading: boolean;
  captureRef?: React.RefObject<HTMLDivElement | null>;
};

function RiskChart({
 data, isLoading, captureRef,
}: RiskChartProps) {
  const chartData = useMemo(
    () => data.map((space) => ({
      name: space.space_name.length > 20
        ? `${space.space_name.slice(0, 18)}...`
        : space.space_name,
      cancellationRate: Math.round(space.cancellationRate * 100),
    })),
    [data]
  );

  return (
    <Card className="rounded-md border border-border/70 bg-muted/20 shadow-none">
      <CardHeader>
        <CardTitle className="text-base">Cancellation Risk</CardTitle>
        <CardDescription className="text-xs text-muted-foreground">
          Top spaces by cancellation rate (%).
        </CardDescription>
      </CardHeader>
      <CardContent>
        { isLoading ? (
          <Skeleton className="h-[220px] w-full" />
        ) : chartData.length === 0 ? (
          <p className="py-12 text-center text-sm text-muted-foreground">
            No high-risk spaces in this range.
          </p>
        ) : (
          <div ref={ captureRef }>
            <ChartContainer config={ riskChartConfig } className="aspect-auto h-[220px] w-full">
              <BarChart data={ chartData } layout="vertical" accessibilityLayer>
                <CartesianGrid horizontal={ false } />
                <YAxis
                  dataKey="name"
                  type="category"
                  tickLine={ false }
                  axisLine={ false }
                  width={ 130 }
                  className="text-xs"
                />
                <XAxis
                  type="number"
                  tickLine={ false }
                  axisLine={ false }
                  tickFormatter={ (value: number) => `${value}%` }
                />
                <ChartTooltip
                  content={
                    <ChartTooltipContent
                      formatter={ (value) => [`${value}%`, 'Cancellation Rate'] }
                    />
                  }
                />
                <Bar dataKey="cancellationRate" fill="var(--color-cancellationRate)" radius={ [0, 4, 4, 0] } />
              </BarChart>
            </ChartContainer>
          </div>
        ) }
      </CardContent>
    </Card>
  );
}

type ActionsSectionProps = {
  queues: AdminReportPayload['queueHealth'];
  onPdfExport: () => void;
  onQueueExport: () => void;
  onRiskExport: () => void;
};

function ActionsSection({
 queues, onPdfExport, onQueueExport, onRiskExport,
}: ActionsSectionProps) {
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Card className="rounded-md border border-border/70 bg-muted/20 shadow-none lg:col-span-2">
        <CardHeader>
          <CardTitle className="text-base">Operational Focus</CardTitle>
          <CardDescription className="text-xs text-muted-foreground">
            Quick actions to resolve bottlenecks and reduce churn.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          { queues.map((queue) => (
            <Button
              key={ queue.key }
              asChild
              variant="outline"
              className="h-auto justify-between px-3 py-2 text-left"
            >
              <Link href={ QUEUE_ROUTE_MAP[queue.key] }>
                <span className="text-sm font-medium">{ queue.label }</span>
                <span className="text-xs text-muted-foreground">
                  { queue.pendingCount } pending
                </span>
              </Link>
            </Button>
          )) }
        </CardContent>
      </Card>
      <Card className="rounded-md border border-border/70 bg-muted/20 shadow-none">
        <CardHeader>
          <CardTitle className="text-base">Report Actions</CardTitle>
          <CardDescription className="text-xs text-muted-foreground">
            Share snapshots or follow up with teams.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <Button
            type="button"
            variant="outline"
            className="w-full justify-between"
            onClick={ onPdfExport }
          >
            Export full report (PDF)
            <FiFileText className="size-4" aria-hidden="true" />
          </Button>
          <Button
            type="button"
            variant="outline"
            className="w-full justify-between"
            onClick={ onQueueExport }
          >
            Export queue health
            <FiDownload className="size-4" aria-hidden="true" />
          </Button>
          <Button
            type="button"
            variant="outline"
            className="w-full justify-between"
            onClick={ onRiskExport }
          >
            Export cancellation risk
            <FiDownload className="size-4" aria-hidden="true" />
          </Button>
          <Button asChild variant="outline" className="w-full justify-between">
            <Link href="/admin/dashboard">
              Back to dashboard
              <FiExternalLink className="size-4" aria-hidden="true" />
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

type MetricDialogProps = {
  metric: ActiveMetric | null;
  onClose: () => void;
};

function MetricDialog({
 metric, onClose, 
}: MetricDialogProps) {
  return (
    <Dialog open={ Boolean(metric) } onOpenChange={ (open) => !open && onClose() }>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{ metric?.title ?? 'Metric details' }</DialogTitle>
          <DialogDescription>{ metric?.description }</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="rounded-md border border-border/70 bg-muted/20 p-4">
            <p className="text-sm font-semibold text-foreground">{ metric?.summary }</p>
            <p className="text-xs text-muted-foreground">{ metric?.previousLabel }</p>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <FiTrendingUp className="size-4" aria-hidden="true" />
            { metric?.changePct === null || metric?.changePct === undefined
              ? 'No prior data for comparison.'
              : `${Math.abs(metric.changePct).toFixed(1)}% ${metric.changePct >= 0 ? 'increase' : 'decrease'} vs previous range.` }
          </div>
          <div className="space-y-2">
            { (metric?.highlights ?? []).map((item) => (
              <div key={ item } className="rounded-md border border-border/60 bg-background/80 px-3 py-2 text-xs text-muted-foreground">
                { item }
              </div>
            )) }
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={ onClose }>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function AdminReportsPage() {
  const [state, dispatch] = useReducer(reportUiReducer, initialReportUiState);
  const bookingsChartExportRef = useRef<HTMLDivElement | null>(null);
  const revenueChartExportRef = useRef<HTMLDivElement | null>(null);
  const queueChartExportRef = useRef<HTMLDivElement | null>(null);
  const riskChartExportRef = useRef<HTMLDivElement | null>(null);

  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
    isFetching,
  } = useAdminReportsQuery({ days: state.rangeDays, });
  const hasToastedRef = useRef(false);

  useEffect(() => {
    if (isError && error && !hasToastedRef.current) {
      const message = error instanceof Error ? error.message : 'Unable to load admin report.';
      toast.error(message);
      hasToastedRef.current = true;
    }
    if (!isError) {
      hasToastedRef.current = false;
    }
  }, [error, isError]);

  const errorMessage = error instanceof Error
    ? error.message
    : 'Unable to load admin report.';

  const trends = data?.trends;
  const showErrorState = isError && !data;
  const isLoadingData = isLoading && !data;

  const summaryCards = useMemo<MetricCardProps[]>(() => {
    const averageRatingCurrent = trends?.averageRating?.current ?? null;
    const averageRatingPrevious = trends?.averageRating?.previous ?? null;

    return [
      {
        title: 'Bookings Volume',
        description: 'New bookings created in the period.',
        value: formatCount(trends?.bookings?.current),
        previousLabel: `Prev: ${formatCount(trends?.bookings?.previous)}`,
        changePct: trends?.bookings?.changePct ?? null,
        isLoading: isLoadingData,
      },
      {
        title: 'Gross Revenue',
        description: 'Succeeded payments recorded.',
        value: formatMinor(trends?.grossRevenue?.currentMinor),
        previousLabel: `Prev: ${formatMinor(trends?.grossRevenue?.previousMinor)}`,
        changePct: trends?.grossRevenue?.changePct ?? null,
        isLoading: isLoadingData,
      },
      {
        title: 'Cancellation Rate',
        description: 'Cancelled and no-show bookings created in the period.',
        value: formatRate(trends?.cancellationRate?.current),
        previousLabel: `Prev: ${formatRate(trends?.cancellationRate?.previous)}`,
        changePct: trends?.cancellationRate?.changePct ?? null,
        isLoading: isLoadingData,
      },
      {
        title: 'Refund Rate',
        description: 'Refunds relative to successful payments.',
        value: formatRate(trends?.refunds?.rate?.current),
        previousLabel: `Prev: ${formatRate(trends?.refunds?.rate?.previous)}`,
        changePct: trends?.refunds?.rate?.changePct ?? null,
        footnote: `Refunded: ${formatMinor(trends?.refunds?.amountMinor?.currentMinor)}`,
        isLoading: isLoadingData,
      },
      {
        title: 'Average Rating',
        description: 'Review sentiment for listed spaces.',
        value: averageRatingCurrent === null
          ? '-'
          : averageRatingCurrent.toFixed(2),
        previousLabel: averageRatingPrevious === null
          ? 'Prev: -'
          : `Prev: ${averageRatingPrevious.toFixed(2)}`,
        changePct: trends?.averageRating?.changePct ?? null,
        isLoading: isLoadingData,
      }
    ];
  }, [isLoadingData, trends]);

  const handleRangeChange = (value: string) => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return;
    const option = RANGE_OPTIONS.find(
      (entry): entry is typeof RANGE_OPTIONS[number] => entry.value === parsed
    );
    if (!option) return;
    if (parsed === state.rangeDays) return;
    dispatch({
 type: 'set-range',
value: option.value, 
});
  };

  const providerHealth = data?.providerHealth;
  const queueHealth = useMemo(() => data?.queueHealth ?? [], [data?.queueHealth]);
  const topCancellationSpaces = useMemo(
    () => data?.risk.topCancellationSpaces ?? [],
    [data?.risk.topCancellationSpaces]
  );
  const lastUpdated = data?.range?.end;
  const dailyBookings = useMemo(() => data?.timeSeries.dailyBookings ?? [], [data?.timeSeries.dailyBookings]);
  const dailyRevenue = useMemo(() => data?.timeSeries.dailyRevenue ?? [], [data?.timeSeries.dailyRevenue]);

  const filteredQueues = useMemo(() => {
    if (!state.queuePendingOnly) return queueHealth;
    return queueHealth.filter((queue) => queue.pendingCount > 0);
  }, [queueHealth, state.queuePendingOnly]);

  const filteredRiskSpaces = useMemo(() => {
    const normalizedSearch = state.riskSearch.trim().toLowerCase();
    return topCancellationSpaces.filter((space) => {
      const matchesSearch = normalizedSearch.length === 0
        || space.space_name.toLowerCase().includes(normalizedSearch)
        || space.city.toLowerCase().includes(normalizedSearch)
        || space.region.toLowerCase().includes(normalizedSearch);
      const matchesRisk = !state.riskHighOnly || space.cancellationRate >= RISK_ALERT_THRESHOLD;
      return matchesSearch && matchesRisk;
    });
  }, [state.riskHighOnly, state.riskSearch, topCancellationSpaces]);

  const riskSummary = useMemo(() => {
    if (!topCancellationSpaces.length) {
      return 'No high-risk spaces recorded in this range.';
    }
    const highRiskCount = topCancellationSpaces.filter(
      (space) => space.cancellationRate >= RISK_ALERT_THRESHOLD
    ).length;
    return `${highRiskCount} spaces at or above ${Math.round(RISK_ALERT_THRESHOLD * 100)}% cancellation rate.`;
  }, [topCancellationSpaces]);

  const handleExportCsv = (rows: string[][], filename: string) => {
    if (!rows.length) {
      toast.error('No data available to export.');
      return;
    }

    const csv = rows
      .map((row) =>
        row
          .map((value) => {
            const escaped = value.replace(/\"/g, '\"\"');
            return `"${escaped}"`;
          })
          .join(',')
      )
      .join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;', });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const handleQueueExport = () => {
    const rows = [
      ['Queue', 'Pending', 'Oldest (days)', 'Avg resolution (days)', 'Resolved'],
      ...filteredQueues.map((queue) => [
        queue.label,
        String(queue.pendingCount),
        queue.oldestPendingDays === null ? '-' : String(queue.oldestPendingDays),
        queue.averageResolutionDays === null ? '-' : queue.averageResolutionDays.toFixed(1),
        String(queue.resolvedCount)
      ])
    ];
    handleExportCsv(rows, `admin-queue-health-${state.rangeDays}d.csv`);
  };

  const handleRiskExport = () => {
    const rows = [
      ['Space', 'City', 'Region', 'Bookings', 'Cancelled', 'Rate'],
      ...filteredRiskSpaces.map((space) => [
        space.space_name,
        space.city,
        space.region,
        String(space.totalBookings),
        String(space.cancelledBookings),
        formatRate(space.cancellationRate)
      ])
    ];
    handleExportCsv(rows, `admin-cancellation-risk-${state.rangeDays}d.csv`);
  };

  const handleExportPdf = useCallback(async () => {
    if (!data) {
      toast.error('No data available to export.');
      return;
    }

    try {
      const [
        bookingsChartImage,
        revenueChartImage,
        queueChartImage,
        riskChartImage
      ] = await Promise.all([
        captureChartImage(bookingsChartExportRef.current),
        captureChartImage(revenueChartExportRef.current),
        captureChartImage(queueChartExportRef.current),
        captureChartImage(riskChartExportRef.current)
      ]);

      const reportScopeEntries = [
        {
          label: 'Report Range',
          value: formatRangeLabel(data.range),
        },
        {
          label: 'Window Size',
          value: `${state.rangeDays} days`,
        },
        {
          label: 'Queue Filter',
          value: state.queuePendingOnly ? 'Pending queues only' : 'All queues',
        },
        {
          label: 'Risk Filter',
          value: state.riskHighOnly
            ? `High risk only (>= ${Math.round(RISK_ALERT_THRESHOLD * 100)}%)`
            : 'All flagged spaces',
        },
        {
          label: 'Risk Search',
          value: state.riskSearch.trim() || 'No search filter applied',
        },
        {
          label: 'Risk Summary',
          value: riskSummary,
        }
      ];

      const trendRows = ensurePdfTableRows([
        [
          'Bookings Volume',
          formatCount(trends?.bookings?.current),
          formatCount(trends?.bookings?.previous),
          formatChangeLabel(trends?.bookings?.changePct),
          'New bookings created in the selected period.'
        ],
        [
          'Gross Revenue',
          formatMinor(trends?.grossRevenue?.currentMinor),
          formatMinor(trends?.grossRevenue?.previousMinor),
          formatChangeLabel(trends?.grossRevenue?.changePct),
          'Succeeded payment volume.'
        ],
        [
          'Cancellation Rate',
          formatRate(trends?.cancellationRate?.current),
          formatRate(trends?.cancellationRate?.previous),
          formatChangeLabel(trends?.cancellationRate?.changePct),
          'Cancelled and no-show bookings as a share of bookings created.'
        ],
        [
          'Refund Rate',
          formatRate(trends?.refunds?.rate?.current),
          formatRate(trends?.refunds?.rate?.previous),
          formatChangeLabel(trends?.refunds?.rate?.changePct),
          'Refund count relative to succeeded payments.'
        ],
        [
          'Refund Count',
          formatCount(trends?.refunds?.count?.current),
          formatCount(trends?.refunds?.count?.previous),
          formatChangeLabel(trends?.refunds?.count?.changePct),
          'Number of refund transactions recorded.'
        ],
        [
          'Refund Amount',
          formatMinor(trends?.refunds?.amountMinor?.currentMinor),
          formatMinor(trends?.refunds?.amountMinor?.previousMinor),
          formatChangeLabel(trends?.refunds?.amountMinor?.changePct),
          'Total refunded amount in PHP.'
        ],
        [
          'Average Rating',
          trends?.averageRating?.current?.toFixed(2) ?? '-',
          trends?.averageRating?.previous?.toFixed(2) ?? '-',
          formatChangeLabel(trends?.averageRating?.changePct),
          'Average star rating from submitted reviews.'
        ]
      ], 5);

      const queueRows = ensurePdfTableRows(
        filteredQueues.map((queue) => [
          queue.label,
          String(queue.pendingCount),
          queue.oldestPendingDays === null ? '-' : String(queue.oldestPendingDays),
          queue.averageResolutionDays === null ? '-' : queue.averageResolutionDays.toFixed(1),
          String(queue.resolvedCount),
          QUEUE_LABEL_HELP[queue.key]
        ]),
        6,
        'No queue activity in this range'
      );

      const providerCoverage =
        providerHealth && providerHealth.configuredAccounts > 0
          ? `${((providerHealth.liveAccounts / providerHealth.configuredAccounts) * 100).toFixed(1)}% live`
          : 'No configured accounts';
      const staleCoverage =
        providerHealth && providerHealth.configuredAccounts > 0
          ? `${((providerHealth.staleAccounts / providerHealth.configuredAccounts) * 100).toFixed(1)}% stale`
          : 'No configured accounts';

      const bookingTrendRows = ensurePdfTableRows(
        dailyBookings.map((entry) => [
          formatShortDate(entry.date),
          String(entry.bookings),
          String(entry.cancellations),
          entry.bookings > 0
            ? formatRate(entry.cancellations / entry.bookings)
            : '0.0%'
        ]),
        4,
        'No booking trend data in this range'
      );

      const revenueTrendRows = ensurePdfTableRows(
        dailyRevenue.map((entry) => [
          formatShortDate(entry.date),
          formatMinor(entry.revenueMinor)
        ]),
        2,
        'No revenue trend data in this range'
      );

      const riskRows = ensurePdfTableRows(
        filteredRiskSpaces.map((space) => [
          space.space_name,
          space.city,
          space.region,
          String(space.totalBookings),
          String(space.cancelledBookings),
          formatRate(space.cancellationRate),
          String(calculateRiskScore(space.cancellationRate, space.totalBookings)),
          getRiskTier(space.cancellationRate)
        ]),
        8,
        'No cancellation-risk spaces in this range'
      );

      const sections: PdfSection[] = [
        {
          kind: 'key-value',
          title: 'Report Scope',
          entries: reportScopeEntries,
        },
        {
          kind: 'table',
          title: 'Trend Metrics',
          headers: ['Metric', 'Current', 'Previous', 'Change', 'Notes'],
          rows: trendRows,
        },
        ...(bookingsChartImage
          ? [{
              kind: 'image' as const,
              title: 'Bookings Trend Chart',
              imageDataUrl: bookingsChartImage,
              caption: 'Daily bookings and cancellations over the selected period.',
              maxHeightMm: 85,
            }]
          : []),
        ...(revenueChartImage
          ? [{
              kind: 'image' as const,
              title: 'Revenue Trend Chart',
              imageDataUrl: revenueChartImage,
              caption: 'Daily gross revenue in PHP over the selected period.',
              maxHeightMm: 85,
            }]
          : []),
        ...(queueChartImage
          ? [{
              kind: 'image' as const,
              title: 'Queue Overview Chart',
              imageDataUrl: queueChartImage,
              caption: 'Pending versus resolved items across admin queues.',
              maxHeightMm: 80,
            }]
          : []),
        ...(riskChartImage
          ? [{
              kind: 'image' as const,
              title: 'Cancellation Risk Chart',
              imageDataUrl: riskChartImage,
              caption: 'Top spaces by cancellation rate percentage.',
              maxHeightMm: 80,
            }]
          : []),
        {
          kind: 'table',
          title: 'Queue Health',
          headers: ['Queue', 'Pending', 'Oldest (days)', 'Avg Resolution (days)', 'Resolved', 'Context'],
          rows: queueRows,
        },
        {
          kind: 'table',
          title: 'Cancellation Risk',
          headers: ['Space', 'City', 'Region', 'Bookings', 'Cancelled', 'Rate', 'Risk Score', 'Tier'],
          rows: riskRows,
        },
        {
          kind: 'key-value',
          title: 'Provider Health',
          entries: [
            {
 label: 'Configured Accounts',
value: formatCount(providerHealth?.configuredAccounts), 
},
            {
 label: 'Live Accounts',
value: formatCount(providerHealth?.liveAccounts), 
},
            {
 label: 'Live Coverage',
value: providerCoverage, 
},
            {
 label: 'Stale Accounts',
value: formatCount(providerHealth?.staleAccounts), 
},
            {
 label: 'Stale Coverage',
value: staleCoverage, 
},
            {
 label: 'Failed Snapshots',
value: formatCount(providerHealth?.failedSnapshotCount), 
},
            {
 label: 'Pending Payouts',
value: formatCount(providerHealth?.pendingProviderPayouts), 
},
            {
 label: 'Pending Refunds',
value: formatCount(providerHealth?.pendingRefunds), 
}
          ],
        },
        {
          kind: 'table',
          title: 'Daily Booking Trend',
          headers: ['Date', 'Bookings', 'Cancellations', 'Cancellation Rate'],
          rows: bookingTrendRows,
        },
        {
          kind: 'table',
          title: 'Daily Revenue Trend',
          headers: ['Date', 'Revenue'],
          rows: revenueTrendRows,
        }
      ];

      await exportPdf({
        title: 'UpSpace Admin Report',
        subtitle: formatRangeLabel(data.range),
        filename: `admin-report-${state.rangeDays}d.pdf`,
        orientation: 'landscape',
        sections,
      });

      toast.success('PDF exported.');
    } catch {
      toast.error('Failed to generate PDF.');
    }
  }, [
    data,
    dailyBookings,
    dailyRevenue,
    filteredQueues,
    filteredRiskSpaces,
    providerHealth,
    riskSummary,
    state.queuePendingOnly,
    state.rangeDays,
    state.riskHighOnly,
    state.riskSearch,
    trends
  ]);

  return (
    <div className="w-full px-4 pb-8 sm:px-6 lg:px-8">
      <section className="space-y-6 py-8 md:space-y-8 md:py-12">
        <ReportHeader
          rangeLabel={ formatRangeLabel(data?.range) }
          lastUpdatedLabel={ formatDateTimeLabel(lastUpdated) }
          rangeDays={ state.rangeDays }
          isFetching={ isFetching }
          onRefresh={ () => void refetch() }
          onRangeChange={ handleRangeChange }
        />

        { showErrorState ? (
          <div className="rounded-md border border-border/70 bg-background/80 px-6 py-12 text-center">
            <SystemErrorIllustration />
            <p className="mt-4 text-sm text-muted-foreground">
              { errorMessage }
            </p>
            <div className="mt-4 flex justify-center">
              <Button
                variant="outline"
                size="sm"
                onClick={ () => {
                  void refetch();
                } }
              >
                Retry
              </Button>
            </div>
          </div>
        ) : (
          <>
            <SummarySection
              cards={ summaryCards }
              trends={ trends }
              onSelectMetric={ (metric) => dispatch({
 type: 'set-active-metric',
value: metric,
}) }
            />

            <Separator />

            <div className="grid gap-6 lg:grid-cols-2">
              <BookingsChart
                data={ dailyBookings }
                isLoading={ isLoadingData }
                captureRef={ bookingsChartExportRef }
              />
              <RevenueChart
                data={ dailyRevenue }
                isLoading={ isLoadingData }
                captureRef={ revenueChartExportRef }
              />
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              <QueueChart
                data={ queueHealth }
                isLoading={ isLoadingData }
                captureRef={ queueChartExportRef }
              />
              <RiskChart
                data={ topCancellationSpaces }
                isLoading={ isLoadingData }
                captureRef={ riskChartExportRef }
              />
            </div>

            <Separator />

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <MetricCard
                title="Provider Accounts"
                description="Connected Xendit partner accounts and live readiness."
                value={
                  isLoadingData
                    ? '-'
                    : `${formatCount(providerHealth?.liveAccounts ?? 0)} / ${formatCount(providerHealth?.configuredAccounts ?? 0)} live`
                }
                previousLabel={ `Stale: ${formatCount(providerHealth?.staleAccounts ?? 0)}` }
                changePct={ null }
                footnote={ `Failed snapshots: ${formatCount(providerHealth?.failedSnapshotCount ?? 0)}` }
                isLoading={ isLoadingData }
              />
              <MetricCard
                title="Provider Payout Sync"
                description="Payouts submitted to Xendit that still need final settlement locally."
                value={ formatCount(providerHealth?.pendingProviderPayouts ?? 0) }
                previousLabel="Webhook-backed status tracking"
                changePct={ null }
                footnote="Use the reconciliation view for account-level drift."
                isLoading={ isLoadingData }
              />
              <MetricCard
                title="Pending Refunds"
                description="Refunds still waiting on final provider status."
                value={ formatCount(providerHealth?.pendingRefunds ?? 0) }
                previousLabel="Open refund workload"
                changePct={ null }
                footnote="Pending refunds will remain until a terminal provider outcome arrives."
                isLoading={ isLoadingData }
              />
            </div>

            <Separator />

            <div className="grid gap-8 lg:grid-cols-2">
              <QueueSection
                isLoading={ isLoadingData }
                queues={ filteredQueues }
                pendingOnly={ state.queuePendingOnly }
                onTogglePendingOnly={ (value) => dispatch({
 type: 'set-queue-pending-only',
value, 
}) }
                onExport={ handleQueueExport }
              />
              <RiskSection
                isLoading={ isLoadingData }
                spaces={ filteredRiskSpaces }
                summary={ riskSummary }
                searchValue={ state.riskSearch }
                highOnly={ state.riskHighOnly }
                onSearchChange={ (value) => dispatch({
 type: 'set-risk-search',
value, 
}) }
                onToggleHighOnly={ (value) => dispatch({
 type: 'set-risk-high-only',
value, 
}) }
                onExport={ handleRiskExport }
              />
            </div>

            <Separator />

            <ActionsSection
              queues={ queueHealth }
              onPdfExport={ () => void handleExportPdf() }
              onQueueExport={ handleQueueExport }
              onRiskExport={ handleRiskExport }
            />
          </>
        ) }
      </section>

      <MetricDialog
        metric={ state.activeMetric }
        onClose={ () => dispatch({
 type: 'set-active-metric',
value: null, 
}) }
      />
    </div>
  );
}

'use client';

import { useEffect, useMemo, useState } from 'react';
import { FiArrowDownRight, FiArrowUpRight, FiTrendingUp } from 'react-icons/fi';
import { toast } from 'sonner';

import { type AdminReportPayload, useAdminReportsQuery } from '@/hooks/api/useAdminReports';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
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

const formatRangeLabel = (range?: AdminReportPayload['range']) => {
  if (!range) return '-';
  const start = dateFormatter.format(new Date(range.start));
  const end = dateFormatter.format(new Date(range.end));
  const previousStart = dateFormatter.format(new Date(range.previousStart));
  const previousEnd = dateFormatter.format(new Date(range.previousEnd));
  return `${start} - ${end} (vs ${previousStart} - ${previousEnd})`;
};

type MetricCardProps = {
  title: string;
  description: string;
  value: string;
  previousLabel: string;
  changePct: number | null;
  footnote?: string;
  isLoading: boolean;
};

const MetricCard = ({
  title,
  description,
  value,
  previousLabel,
  changePct,
  footnote,
  isLoading,
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
    <Card className="rounded-md border border-border/70 bg-background/80 shadow-sm">
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

export function AdminReportsPage() {
  const [rangeDays, setRangeDays] = useState<typeof RANGE_OPTIONS[number]['value']>(
    RANGE_OPTIONS[1].value
  );

  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
    isFetching,
  } = useAdminReportsQuery({ days: rangeDays, });

  const errorMessage = error instanceof Error
    ? error.message
    : 'Unable to load admin report.';

  useEffect(() => {
    if (isError) {
      toast.error(errorMessage);
    }
  }, [isError, errorMessage]);

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
    if (parsed === rangeDays) return;
    setRangeDays(option.value);
  };

  const queueHealth = data?.queueHealth ?? [];
  const topCancellationSpaces = data?.risk.topCancellationSpaces ?? [];

  return (
    <div className="w-full px-4 pb-8 sm:px-6 lg:px-8">
      <section className="space-y-6 py-8 md:space-y-8 md:py-12">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
              Admin Report
            </h1>
            <p className="text-sm text-muted-foreground md:text-base">
              Trends, queue health, and risk signals across the marketplace.
            </p>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <FiTrendingUp className="size-4" aria-hidden="true" />
              <span>{ formatRangeLabel(data?.range) }</span>
              { isFetching && <span className="text-xs">Updating...</span> }
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Label htmlFor="admin-report-range">Report range</Label>
            <Select
              value={ String(rangeDays) }
              onValueChange={ handleRangeChange }
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
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              { summaryCards.map((card) => (
                <MetricCard key={ card.title } { ...card } />
              )) }
            </div>

            <Separator />

            <div className="grid gap-6 lg:grid-cols-2">
              <Card className="rounded-md border border-border/70 bg-background/80 shadow-sm">
                <CardHeader className="space-y-1">
                  <CardTitle className="text-base font-semibold">
                    Queue Health
                  </CardTitle>
                  <CardDescription className="text-xs text-muted-foreground">
                    Pending volume and resolution speed for admin queues.
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="overflow-hidden rounded-md border border-border/70">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Queue</TableHead>
                          <TableHead>Pending</TableHead>
                          <TableHead>Oldest (days)</TableHead>
                          <TableHead>Avg resolution (days)</TableHead>
                          <TableHead>Resolved</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        { isLoadingData ? (
                          <TableSkeletonRows rows={ 4 } columns={ 5 } />
                        ) : queueHealth.length ? (
                          queueHealth.map((queue) => (
                            <TableRow key={ queue.key }>
                              <TableCell className="font-medium">
                                { queue.label }
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
                            </TableRow>
                          ))
                        ) : (
                          <TableRow>
                            <TableCell colSpan={ 5 } className="py-10 text-center text-sm text-muted-foreground">
                              No queue activity in this range.
                            </TableCell>
                          </TableRow>
                        ) }
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>

              <Card className="rounded-md border border-border/70 bg-background/80 shadow-sm">
                <CardHeader className="space-y-1">
                  <CardTitle className="text-base font-semibold">
                    Cancellation Risk
                  </CardTitle>
                  <CardDescription className="text-xs text-muted-foreground">
                    Spaces with the highest cancellation rates in the period.
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="overflow-hidden rounded-md border border-border/70">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Space</TableHead>
                          <TableHead>Location</TableHead>
                          <TableHead>Bookings</TableHead>
                          <TableHead>Cancelled</TableHead>
                          <TableHead>Rate</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        { isLoadingData ? (
                          <TableSkeletonRows rows={ 4 } columns={ 5 } />
                        ) : topCancellationSpaces.length ? (
                          topCancellationSpaces.map((space) => (
                            <TableRow key={ space.space_id }>
                              <TableCell className="font-medium">
                                { space.space_name }
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
                                    space.cancellationRate >= 0.3
                                      ? 'text-destructive'
                                      : 'text-muted-foreground'
                                  ) }
                                >
                                  { formatRate(space.cancellationRate) }
                                </span>
                              </TableCell>
                            </TableRow>
                          ))
                        ) : (
                          <TableRow>
                            <TableCell colSpan={ 5 } className="py-10 text-center text-sm text-muted-foreground">
                              No high-cancellation spaces in this range.
                            </TableCell>
                          </TableRow>
                        ) }
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </div>
          </>
        ) }
      </section>
    </div>
  );
}

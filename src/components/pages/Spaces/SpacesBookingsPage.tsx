'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { FiAlertCircle, FiArrowUpRight } from 'react-icons/fi';

import { usePartnerBookingsQuery } from '@/hooks/api/useBookings';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import { cn } from '@/lib/utils';

const bookingDateFormatter = new Intl.DateTimeFormat('en-PH', {
  dateStyle: 'medium',
  timeStyle: 'short',
});

const bookingPriceFormatter = new Intl.NumberFormat('en-PH', {
  style: 'currency',
  currency: 'PHP',
  maximumFractionDigits: 0,
});

export function SpacesBookingsPage() {
  const {
    data: bookings = [],
    isLoading,
    isError,
    error,
  } = usePartnerBookingsQuery();

  const areaBookingCounts = useMemo(() => {
    const counts = new Map<string, number>();
    bookings.forEach((booking) => {
      counts.set(booking.areaId, (counts.get(booking.areaId) ?? 0) + 1);
    });
    return counts;
  }, [bookings]);

  const confirmedCount = useMemo(
    () => bookings.filter((booking) => booking.status === 'confirmed').length,
    [bookings]
  );

  const renderCapacity = (booking: (typeof bookings)[number]) => {
    const used = areaBookingCounts.get(booking.areaId) ?? 0;
    const maxCap = booking.areaMaxCapacity ?? null;
    const remaining = typeof maxCap === 'number' ? Math.max(maxCap - used, 0) : null;
    const status =
      maxCap === null ? 'unbounded' : remaining === 0 ? 'full' : 'available';

    return {
      used,
      maxCap,
      remaining,
      status,
      label: maxCap === null ? `${used} booking${used === 1 ? '' : 's'}` : `${used}/${maxCap}`,
      helper:
        maxCap === null
          ? 'No capacity set'
          : remaining === 0
            ? 'At capacity'
            : `${remaining} slot${remaining === 1 ? '' : 's'} remaining`,
    };
  };

  const renderBody = () => {
    if (isLoading) {
      return (
        <TableBody>
          { Array.from({ length: 4, }).map((_, index) => (
            <TableRow key={ `skeleton-${index}` }>
              <TableCell className="w-1/4">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="mt-2 h-3 w-24" />
              </TableCell>
              <TableCell className="w-24">
                <Skeleton className="h-5 w-16" />
              </TableCell>
              <TableCell className="w-24">
                <Skeleton className="h-4 w-14" />
              </TableCell>
              <TableCell className="w-28">
                <Skeleton className="h-4 w-16" />
              </TableCell>
              <TableCell className="w-40">
                <Skeleton className="h-4 w-28" />
              </TableCell>
              <TableCell className="w-32">
                <Skeleton className="h-4 w-24" />
              </TableCell>
            </TableRow>
          )) }
        </TableBody>
      );
    }

    if (isError) {
      return (
        <TableBody>
          <TableRow>
            <TableCell colSpan={ 6 } className="text-sm text-destructive">
              { error instanceof Error ? error.message : 'Unable to load bookings.' }
            </TableCell>
          </TableRow>
        </TableBody>
      );
    }

    if (!bookings.length) {
      return (
        <TableBody>
          <TableRow>
            <TableCell colSpan={ 6 }>
              <div className="flex flex-col items-center gap-2 py-6 text-center text-sm text-muted-foreground">
                <FiAlertCircle className="size-5" aria-hidden="true" />
                <p>No bookings yet. Once guests book an area, you will see them here.</p>
              </div>
            </TableCell>
          </TableRow>
        </TableBody>
      );
    }

    const sorted = [...bookings].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    return (
      <TableBody>
        { sorted.map((booking) => {
          const capacity = renderCapacity(booking);
          const priceLabel =
            typeof booking.price === 'number'
              ? bookingPriceFormatter.format(booking.price)
              : '—';
          return (
            <TableRow key={ booking.id }>
              <TableCell>
                <div className="flex flex-col gap-1">
                  <Link
                    href={ `/marketplace/${booking.spaceId}` }
                    className="inline-flex items-center gap-1 text-sm font-semibold text-foreground hover:text-primary"
                  >
                    { booking.spaceName }
                    <FiArrowUpRight className="size-4" aria-hidden="true" />
                  </Link>
                  <p className="text-xs text-muted-foreground">{ booking.areaName }</p>
                </div>
              </TableCell>
              <TableCell>
                <Badge variant={ booking.status === 'confirmed' ? 'default' : 'secondary' }>
                  { booking.status }
                </Badge>
              </TableCell>
              <TableCell>{ booking.bookingHours } hr{ booking.bookingHours === 1 ? '' : 's' }</TableCell>
              <TableCell>{ priceLabel }</TableCell>
              <TableCell>
                <div className="flex flex-col">
                  <span className="text-sm font-semibold">{ capacity.label }</span>
                  <span
                    className={ cn(
                      'text-xs',
                      capacity.status === 'full'
                        ? 'text-destructive'
                        : 'text-muted-foreground'
                    ) }
                  >
                    { capacity.helper }
                  </span>
                </div>
              </TableCell>
              <TableCell>
                <span className="text-sm text-foreground">
                  { bookingDateFormatter.format(new Date(booking.createdAt)) }
                </span>
              </TableCell>
            </TableRow>
          );
        }) }
      </TableBody>
    );
  };

  return (
    <div className="space-y-6 px-4 pb-10 sm:px-6 lg:px-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold text-foreground">Bookings</h1>
          <p className="text-sm text-muted-foreground">
            Monitor confirmed bookings and track how each area is filling up.
          </p>
        </div>
        <Badge variant="secondary" className="text-xs">
          { confirmedCount } confirmed
        </Badge>
      </div>

      <Card className="rounded-3xl border">
        <CardHeader className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle>Area capacity overview</CardTitle>
            <CardDescription>Live bookings with per-area capacity signals.</CardDescription>
          </div>
          <Button
            type="button"
            asChild
            variant="outline"
            size="sm"
            className="gap-2"
          >
            <Link href="/spaces/dashboard">
              View analytics
              <FiArrowUpRight className="size-4" aria-hidden="true" />
            </Link>
          </Button>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Space / Area</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead>Price</TableHead>
                <TableHead>Capacity</TableHead>
                <TableHead>Booked at</TableHead>
              </TableRow>
            </TableHeader>
            { renderBody() }
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

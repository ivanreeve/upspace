'use client';

import { formatDistanceToNow } from 'date-fns';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { CANCELLABLE_BOOKING_STATUSES } from '@/lib/bookings/constants';
import type { BookingStatus } from '@/lib/bookings/types';
import { useCustomerBookingsQuery } from '@/hooks/api/useCustomerBookings';
import { useCustomerCancelBookingMutation } from '@/hooks/api/useCustomerCancelBooking';

const STATUS_CATEGORY_MAP: Record<BookingStatus, 'successful' | 'pending' | 'cancelled'> = {
  confirmed: 'successful',
  completed: 'successful',
  checkedin: 'successful',
  checkedout: 'successful',
  pending: 'pending',
  cancelled: 'cancelled',
  rejected: 'cancelled',
  expired: 'cancelled',
  noshow: 'cancelled',
};

const CATEGORY_LABELS: Record<'successful' | 'pending' | 'cancelled', string> = {
  successful: 'Successful',
  pending: 'Pending',
  cancelled: 'Cancelled',
};

const CATEGORY_VARIANTS: Record<'successful' | 'pending' | 'cancelled', 'success' | 'secondary' | 'destructive'> = {
  successful: 'success',
  pending: 'secondary',
  cancelled: 'destructive',
};

const BOOKING_STATUS_LABELS: Record<BookingStatus, string> = {
  pending: 'Pending',
  confirmed: 'Confirmed',
  completed: 'Completed',
  checkedin: 'Checked in',
  checkedout: 'Checked out',
  rejected: 'Rejected',
  expired: 'Expired',
  cancelled: 'Cancelled',
  noshow: 'No show',
};

const BOOKING_STATUS_VARIANTS: Record<BookingStatus, 'success' | 'secondary' | 'destructive'> = {
  pending: 'secondary',
  confirmed: 'success',
  completed: 'success',
  checkedin: 'success',
  checkedout: 'success',
  rejected: 'destructive',
  expired: 'destructive',
  cancelled: 'destructive',
  noshow: 'destructive',
};

const formatBookingDate = (value: string) =>
  new Date(value).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });

const LoadingList = () => (
  <div className="space-y-3">
    <Skeleton className="h-4 w-32" />
    <div className="space-y-3">
      <Skeleton className="h-16 w-full rounded-xl" />
      <Skeleton className="h-16 w-full rounded-xl" />
    </div>
  </div>
);

export function CustomerBookingsPanel() {
  const {
 data: bookings, isLoading, isError, 
} = useCustomerBookingsQuery();
  const cancelMutation = useCustomerCancelBookingMutation();
  const bookingRecords = bookings ?? [];
  const sortedBookings = bookingRecords.slice().sort((left, right) =>
    right.createdAt.localeCompare(left.createdAt)
  );

  const summaryCounts = bookingRecords.reduce<
    Record<'successful' | 'pending' | 'cancelled', number>
  >(
    (acc, booking) => {
      const category = STATUS_CATEGORY_MAP[booking.status];
      acc[category] += 1;
      return acc;
    },
    {
      successful: 0,
      pending: 0,
      cancelled: 0,
    }
  );

  return (
    <div className="space-y-5 px-4 py-4 sm:px-6">
      <Card className="rounded-2xl border border-border/70 bg-background shadow-sm">
        <CardHeader>
          <CardTitle>Bookings overview</CardTitle>
          <CardDescription>
            Track the status of every reservation you’ve made and see when the next one
            becomes active.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          { isError && (
            <div className="rounded-2xl border border-destructive/70 bg-destructive/5 px-4 py-3 text-sm text-destructive">
              Unable to load your bookings right now.
            </div>
          ) }
          { isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-6 w-[180px]" />
              <div className="flex flex-wrap gap-2">
                <Skeleton className="h-10 w-24" />
                <Skeleton className="h-10 w-24" />
                <Skeleton className="h-10 w-24" />
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap gap-3">
              { Object.entries(CATEGORY_LABELS).map(([category, label]) => (
                <Badge
                  key={ category }
                  variant={ CATEGORY_VARIANTS[category as keyof typeof CATEGORY_VARIANTS] }
                  className="flex items-center gap-3"
                >
                  <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                    { label }
                  </span>
                  <span className="text-sm font-semibold text-foreground">
                    { summaryCounts[category as keyof typeof summaryCounts].toLocaleString() }
                  </span>
                </Badge>
              )) }
            </div>
          ) }
        </CardContent>
      </Card>

      <Card className="rounded-2xl border border-border/70 bg-background shadow-sm">
        <CardHeader>
          <CardTitle>Recent bookings</CardTitle>
          <CardDescription>
            Latest reservations sorted by when you made the booking request.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          { isLoading ? (
            <LoadingList />
          ) : bookingRecords.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border/70 bg-muted/50 px-4 py-6 text-sm text-muted-foreground">
              You don’t have any bookings yet. Every reservation you place will appear here.
            </div>
          ) : (
            <ScrollArea className="max-h-[480px] rounded-2xl border border-border/70 bg-muted/10">
              <div className="space-y-4 p-4">
                { sortedBookings.map((booking) => {
                  const isCancelable = CANCELLABLE_BOOKING_STATUSES.includes(booking.status);

                  return (
                    <article
                      key={ booking.id }
                      className="rounded-2xl border border-border/60 bg-background/80 p-4 shadow-sm"
                    >
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="space-y-1">
                          <p className="text-sm font-semibold text-foreground">
                            { booking.spaceName } · { booking.areaName }
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Booked{ ' ' }
                            { formatDistanceToNow(new Date(booking.createdAt), { addSuffix: true, }) }
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant={ BOOKING_STATUS_VARIANTS[booking.status] }>
                            { BOOKING_STATUS_LABELS[booking.status] }
                          </Badge>
                          { isCancelable && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 px-3 text-[13px] font-semibold leading-none border-border/60 bg-background transition hover:border-destructive hover:bg-destructive/10 focus-visible:border-destructive focus-visible:ring-2 focus-visible:ring-destructive/50"
                              disabled={ cancelMutation.isPending }
                              onClick={ () => cancelMutation.mutate({ bookingId: booking.id, }) }
                            >
                              Cancel
                            </Button>
                          ) }
                        </div>
                      </div>
                      <div className="mt-3 flex flex-wrap items-center gap-3 text-[13px] text-muted-foreground">
                        <span>{ formatBookingDate(booking.createdAt) }</span>
                        <span>
                          { booking.bookingHours } hour{ booking.bookingHours === 1 ? '' : 's' }
                        </span>
                      </div>
                    </article>
                  );
                }) }
              </div>
            </ScrollArea>
          ) }
        </CardContent>
      </Card>
    </div>
  );
}

'use client';

import { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import Link from 'next/link';
import {
  FiAlertCircle,
  FiCheckCircle,
  FiClock,
  FiExternalLink,
  FiMoreHorizontal,
  FiXCircle
} from 'react-icons/fi';
import type { IconType } from 'react-icons';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator
} from '@/components/ui/breadcrumb';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import { CANCELLABLE_BOOKING_STATUSES } from '@/lib/bookings/constants';
import type { BookingRecord, BookingStatus } from '@/lib/bookings/types';
import { useUserBookingsQuery } from '@/hooks/api/useBookings';
import { useCustomerCancelBookingMutation } from '@/hooks/api/useCustomerCancelBooking';
import { BookingCancelDialog } from '@/components/pages/Customer/BookingCancelDialog';
import { ComplaintDialog } from '@/components/pages/Customer/ComplaintDialog';
import type { BookingRefundState } from '@/lib/bookings/refund-summary';

const COMPLAINTABLE_BOOKING_STATUSES: BookingStatus[] = ['confirmed', 'completed', 'checkedin', 'checkedout'];

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

const CATEGORY_META: Record<
  'successful' | 'pending' | 'cancelled',
  {
    icon: IconType;
    containerClassName: string;
    iconClassName: string;
    labelClassName: string;
    countClassName: string;
  }
> = {
  successful: {
    icon: FiCheckCircle,
    containerClassName: 'border-emerald-200/80 bg-emerald-50/70',
    iconClassName: 'text-emerald-700',
    labelClassName: 'text-emerald-800',
    countClassName: 'text-emerald-900',
  },
  pending: {
    icon: FiClock,
    containerClassName: 'border-amber-200/80 bg-amber-50/70',
    iconClassName: 'text-amber-700',
    labelClassName: 'text-amber-800',
    countClassName: 'text-amber-900',
  },
  cancelled: {
    icon: FiAlertCircle,
    containerClassName: 'border-rose-200/80 bg-rose-50/70',
    iconClassName: 'text-rose-700',
    labelClassName: 'text-rose-800',
    countClassName: 'text-rose-900',
  },
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

const REFUND_STATUS_VARIANTS: Record<
  BookingRefundState,
  'success' | 'secondary' | 'destructive'
> = {
  pending: 'secondary',
  succeeded: 'success',
  failed: 'destructive',
  attention: 'destructive',
};

const formatBookingDate = (value: string) =>
  new Date(value).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });

const BOOKING_PRICE_FORMATTER = new Intl.NumberFormat('en-PH', {
  style: 'currency',
  currency: 'PHP',
});

const formatBookingPrice = (price: number | null) =>
  typeof price === 'number' && Number.isFinite(price)
    ? BOOKING_PRICE_FORMATTER.format(price)
    : '—';

type BookingRowActionsProps = {
  booking: BookingRecord;
  isCancelable: boolean;
  isComplaintable: boolean;
  isMutating: boolean;
  onRequestCancel: (booking: BookingRecord) => void;
};

function BookingRowActions({
  booking,
  isCancelable,
  isComplaintable,
  isMutating,
  onRequestCancel,
}: BookingRowActionsProps) {
  const [isComplaintDialogOpen, setIsComplaintDialogOpen] = useState(false);
  const bookingHref = `/customer/bookings/${booking.id}`;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="size-8 rounded-md border-border/70 bg-background shadow-none"
            aria-label={ `Open actions for booking ${booking.id.slice(0, 8)}` }
          >
            <FiMoreHorizontal className="size-4" aria-hidden="true" />
            <span className="sr-only">Open booking actions</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          sideOffset={ 6 }
          className="min-w-[190px] rounded-md bg-popover px-1 py-1 shadow-lg"
        >
          <DropdownMenuItem asChild>
            <Link href={ bookingHref }>
              <FiExternalLink className="size-4" aria-hidden="true" />
              View booking
            </Link>
          </DropdownMenuItem>
          { (isComplaintable || isCancelable) && <DropdownMenuSeparator /> }
          { isComplaintable && (
            <DropdownMenuItem onSelect={ () => setIsComplaintDialogOpen(true) }>
              <FiAlertCircle className="size-4" aria-hidden="true" />
              File complaint
            </DropdownMenuItem>
          ) }
          { isCancelable && (
            <DropdownMenuItem
              disabled={ isMutating }
              onSelect={ () => onRequestCancel(booking) }
              className="text-destructive focus-visible:bg-destructive/10 focus-visible:text-destructive focus-visible:[&_svg]:text-destructive data-[highlighted]:bg-destructive/10 data-[highlighted]:text-destructive data-[highlighted]:[&_svg]:text-destructive"
            >
              <FiXCircle className="size-4 text-destructive" aria-hidden="true" />
              Cancel booking
            </DropdownMenuItem>
          ) }
        </DropdownMenuContent>
      </DropdownMenu>

      { isComplaintable && (
        <ComplaintDialog
          bookingId={ booking.id }
          open={ isComplaintDialogOpen }
          onOpenChange={ setIsComplaintDialogOpen }
          hideTrigger
        />
      ) }
    </>
  );
}

export function CustomerBookingsPanel({ initialBookings, }: { initialBookings?: BookingRecord[] } = {}) {
  const {
 data: bookings, isLoading, isError,
} = useUserBookingsQuery(initialBookings ? { initialData: initialBookings, } : undefined);
  const cancelMutation = useCustomerCancelBookingMutation();
  const [bookingToCancel, setBookingToCancel] = useState<BookingRecord | null>(null);
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
      <Breadcrumb className="px-6">
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link href="/marketplace">Marketplace</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage className="text-sm font-medium">Bookings</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <Card className="rounded-2xl border-0 bg-background">
        <CardHeader>
          <CardTitle className="text-2xl font-semibold">Recent bookings</CardTitle>
          <CardDescription>
            Latest reservations sorted by when you made the booking request.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <section className="space-y-4 rounded-md border border-border/70 bg-muted/10 p-4">
            <div>
              <h3 className="text-base font-semibold text-foreground">Bookings overview</h3>
              <p className="text-sm text-muted-foreground">
                Track the status of every reservation you’ve made and see when the next one
                becomes active.
              </p>
            </div>
            { isError && (
              <div className="rounded-md border border-destructive/70 bg-destructive/5 px-4 py-3 text-sm text-destructive">
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
              <div className="grid gap-3 sm:grid-cols-3">
                { Object.entries(CATEGORY_LABELS).map(([category, label]) => {
                  const summaryCategory = category as keyof typeof CATEGORY_META;
                  const meta = CATEGORY_META[summaryCategory];
                  const Icon = meta.icon;

                  return (
                    <div
                      key={ category }
                      className={ `rounded-md border px-4 py-3 ${meta.containerClassName}` }
                    >
                      <div className="flex items-center gap-2">
                        <Icon className={ `size-4 ${meta.iconClassName}` } aria-hidden="true" />
                        <span
                          className={ `text-[11px] font-semibold uppercase tracking-[0.16em] ${meta.labelClassName}` }
                        >
                          { label }
                        </span>
                      </div>
                      <span
                        className={ `mt-2 block text-2xl font-bold leading-none tabular-nums ${meta.countClassName}` }
                      >
                        { summaryCounts[summaryCategory].toLocaleString() }
                      </span>
                    </div>
                  );
                }) }
              </div>
            ) }
          </section>

          { isLoading ? (
            <div className="space-y-3 rounded-md border border-border/70 bg-background p-4">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-11 w-full rounded-md" />
              <Skeleton className="h-11 w-full rounded-md" />
              <Skeleton className="h-11 w-full rounded-md" />
            </div>
          ) : bookingRecords.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border/70 bg-muted/50 px-4 py-6 text-sm text-muted-foreground">
              You don’t have any bookings yet. Every reservation you place will appear here.
            </div>
          ) : (
            <ScrollArea className="max-h-[560px] rounded-md border border-border/70 bg-muted/10">
              <Table aria-label="Recent bookings details">
                <TableHeader className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm">
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Booking</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Start</TableHead>
                    <TableHead>Duration</TableHead>
                    <TableHead>Guests</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>Requested</TableHead>
                    <TableHead className="w-[84px] text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  { sortedBookings.map((booking) => {
                    const isCancelable = CANCELLABLE_BOOKING_STATUSES.includes(booking.status);
                    const isComplaintable = COMPLAINTABLE_BOOKING_STATUSES.includes(booking.status);
                    const guestCount = booking.guestCount ?? 1;
                    const refundSummary = booking.refundSummary ?? null;

                    return (
                      <TableRow key={ booking.id }>
                        <TableCell className="min-w-[240px]">
                          <div className="space-y-1">
                            <Link
                              href={ `/customer/bookings/${booking.id}` }
                              className="block text-sm font-semibold text-foreground hover:underline"
                            >
                              { booking.spaceName } · { booking.areaName }
                            </Link>
                            <p className="font-mono text-xs text-muted-foreground">
                              { booking.id.slice(0, 8) }
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <Badge variant={ BOOKING_STATUS_VARIANTS[booking.status] }>
                              { BOOKING_STATUS_LABELS[booking.status] }
                            </Badge>
                            { refundSummary ? (
                              <>
                                <Badge variant={ REFUND_STATUS_VARIANTS[refundSummary.state] }>
                                  { refundSummary.label }
                                </Badge>
                                <p className="max-w-[220px] text-xs text-muted-foreground">
                                  { refundSummary.detail }
                                </p>
                              </>
                            ) : null }
                          </div>
                        </TableCell>
                        <TableCell className="min-w-[180px]">
                          <div className="space-y-1">
                            <p className="text-sm text-foreground">{ formatBookingDate(booking.startAt) }</p>
                            <p className="text-xs text-muted-foreground">
                              { formatDistanceToNow(new Date(booking.startAt), { addSuffix: true, }) }
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>
                          { booking.bookingHours } hour{ booking.bookingHours === 1 ? '' : 's' }
                        </TableCell>
                        <TableCell>
                          { guestCount } guest{ guestCount === 1 ? '' : 's' }
                        </TableCell>
                        <TableCell className="font-semibold text-foreground">
                          { formatBookingPrice(booking.price) }
                        </TableCell>
                        <TableCell className="min-w-[180px]">
                          <div className="space-y-1">
                            <p className="text-sm text-foreground">{ formatBookingDate(booking.createdAt) }</p>
                            <p className="text-xs text-muted-foreground">
                              { formatDistanceToNow(new Date(booking.createdAt), { addSuffix: true, }) }
                            </p>
                          </div>
                        </TableCell>
                        <TableCell className="w-[84px] text-right">
                          <div className="flex items-center justify-end">
                            <BookingRowActions
                              booking={ booking }
                              isCancelable={ isCancelable }
                              isComplaintable={ isComplaintable }
                              isMutating={ cancelMutation.isPending }
                              onRequestCancel={ setBookingToCancel }
                            />
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  }) }
                </TableBody>
              </Table>
            </ScrollArea>
          ) }
        </CardContent>
      </Card>

      <BookingCancelDialog
        booking={ bookingToCancel }
        open={ Boolean(bookingToCancel) }
        isPending={ cancelMutation.isPending }
        onOpenChange={ (open) => {
          if (!open && !cancelMutation.isPending) {
            setBookingToCancel(null);
          }
        } }
        onConfirm={ () => {
          if (!bookingToCancel) {
            return;
          }

          cancelMutation.mutate(
            { bookingId: bookingToCancel.id, },
            {
              onSuccess: () => {
                setBookingToCancel(null);
              },
            }
          );
        } }
      />
    </div>
  );
}

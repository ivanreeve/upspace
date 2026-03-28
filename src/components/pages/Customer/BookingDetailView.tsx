'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import {
  FiArrowLeft,
  FiClock,
  FiCreditCard,
  FiDownload,
  FiLoader,
  FiUsers
} from 'react-icons/fi';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { BookingCancelDialog } from '@/components/pages/Customer/BookingCancelDialog';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import { CANCELLABLE_BOOKING_STATUSES } from '@/lib/bookings/constants';
import type { BookingRefundState } from '@/lib/bookings/refund-summary';
import type { BookingStatus } from '@/lib/bookings/types';
import { formatCurrencyMinor } from '@/lib/wallet';
import { useCustomerCancelBookingMutation } from '@/hooks/api/useCustomerCancelBooking';
import { useAuthenticatedFetch } from '@/hooks/useAuthenticatedFetch';
import type { BookingDetailRecord, TimelineEvent } from '@/types/booking-detail';

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

const PAYMENT_METHOD_LABELS: Record<string, string> = { xendit: 'Xendit', };

const LOCALE_OPTIONS = {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
} as const;

const formatDateTime = (value: string) =>
  new Date(value).toLocaleString('en-PH', LOCALE_OPTIONS);

const STATUS_INDICATOR_CLASSES: Record<string, string> = {
  succeeded: 'bg-green-500',
  pending: 'bg-yellow-500',
  failed: 'bg-red-500',
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

type BookingDetailViewProps = {
  record: BookingDetailRecord;
};

const FINANCIAL_EVENT_KINDS = new Set(['payment', 'refund']);

function TimelineItem({ event, }: { event: TimelineEvent }) {
  const indicatorClass = STATUS_INDICATOR_CLASSES[event.status] ?? 'bg-muted-foreground';
  const showAmount = FINANCIAL_EVENT_KINDS.has(event.kind);

  return (
    <li className="relative mb-6 ml-6 last:mb-0">
      <span
        className={ `absolute -left-[30px] flex size-3 items-center justify-center rounded-full ring-4 ring-background ${indicatorClass}` }
      />
      <div className="space-y-0.5">
        <p className="text-sm font-semibold text-foreground">{ event.label }</p>
        { showAmount && (
          <p className="text-xs text-muted-foreground">
            { formatCurrencyMinor(event.amountMinor, event.currency) }
          </p>
        ) }
        <p className="text-xs text-muted-foreground">
          { formatDateTime(event.timestamp) }
        </p>
      </div>
    </li>
  );
}

export function BookingDetailView({ record, }: BookingDetailViewProps) {
  const router = useRouter();
  const cancelMutation = useCustomerCancelBookingMutation();
  const authFetch = useAuthenticatedFetch();
  const [isDownloadingReceipt, setIsDownloadingReceipt] = useState(false);
  const [isCancelDialogOpen, setIsCancelDialogOpen] = useState(false);
  const isCancellable = CANCELLABLE_BOOKING_STATUSES.includes(record.status);
  const hasReceipt = ['confirmed', 'checkedin', 'checkedout', 'completed'].includes(record.status);
  const priceLabel = record.priceMinor
    ? formatCurrencyMinor(record.priceMinor, record.currency)
    : null;
  const paymentLabel = record.paymentMethod
    ? (PAYMENT_METHOD_LABELS[record.paymentMethod] ?? record.paymentMethod)
    : null;

  const handleCancel = () => {
    cancelMutation.mutate(
      { bookingId: record.id, },
      {
        onSuccess: () => {
          setIsCancelDialogOpen(false);
          router.refresh();
        },
      }
    );
  };

  const handleDownloadReceipt = async () => {
    setIsDownloadingReceipt(true);
    try {
      const response = await authFetch(`/api/v1/bookings/${record.id}/receipt`);
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(typeof body?.error === 'string' ? body.error : 'Unable to download receipt.');
      }
      const payload = await response.json();
      const blob = new Blob([JSON.stringify(payload.data, null, 2)], { type: 'application/json', });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `receipt-${record.id}.json`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (downloadError) {
      toast.error(
        downloadError instanceof Error ? downloadError.message : 'Unable to download receipt.'
      );
    } finally {
      setIsDownloadingReceipt(false);
    }
  };

  return (
    <section className="mx-auto flex w-full max-w-[900px] flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
      <div>
        <Link
          href="/customer/bookings"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition hover:text-foreground"
        >
          <FiArrowLeft className="size-4" aria-hidden="true" />
          Back to bookings
        </Link>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold text-foreground">
            { record.spaceName } &middot; { record.areaName }
          </h1>
          <p className="text-xs text-muted-foreground">
            Booking ID { record.id }
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={ BOOKING_STATUS_VARIANTS[record.status] }>
            { BOOKING_STATUS_LABELS[record.status] }
          </Badge>
          { record.refundSummary ? (
            <Badge variant={ REFUND_STATUS_VARIANTS[record.refundSummary.state] }>
              { record.refundSummary.label }
            </Badge>
          ) : null }
          { record.isLive === false && (
            <Badge variant="secondary">Test</Badge>
          ) }
        </div>
      </div>

      <Card className="border border-border bg-card/70">
        <CardHeader className="space-y-1 p-5">
          <CardTitle className="text-base font-semibold text-foreground">
            Booking details
          </CardTitle>
          <CardDescription className="text-xs text-muted-foreground">
            Summary of your reservation
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 p-5 pt-0 sm:grid-cols-2">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <FiClock className="size-4 shrink-0" aria-hidden="true" />
            <span>
              { record.bookingHours } hour{ record.bookingHours === 1 ? '' : 's' }
              { ' ' }&middot;{ ' ' }
              { formatDateTime(record.startAt) }
            </span>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <FiUsers className="size-4 shrink-0" aria-hidden="true" />
            <span>
              { record.guestCount } guest{ record.guestCount === 1 ? '' : 's' }
            </span>
          </div>
          { priceLabel && (
            <div className="flex items-center gap-2 text-sm text-foreground font-semibold">
              <FiCreditCard className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              <span>{ priceLabel }</span>
            </div>
          ) }
          { paymentLabel && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>Paid via { paymentLabel }</span>
            </div>
          ) }
        </CardContent>
      </Card>

      { record.refundSummary || (isCancellable && record.paymentCaptured) ? (
        <Card className="border border-border bg-card/70">
          <CardHeader className="space-y-1 p-5">
            <CardTitle className="text-base font-semibold text-foreground">
              Refund status
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              Separate from booking status so it is clear whether the money is still moving.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 p-5 pt-0 sm:grid-cols-2">
            <div className="space-y-1 rounded-md border border-border/70 bg-background p-4">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Current state
              </p>
              { record.refundSummary ? (
                <>
                  <Badge variant={ REFUND_STATUS_VARIANTS[record.refundSummary.state] }>
                    { record.refundSummary.label }
                  </Badge>
                  <p className="text-sm text-muted-foreground">
                    { record.refundSummary.detail }
                  </p>
                </>
              ) : (
                <>
                  <Badge variant="secondary">No refund in progress</Badge>
                  <p className="text-sm text-muted-foreground">
                    If you cancel this booking now, refund processing starts automatically after the booking is cancelled.
                  </p>
                </>
              ) }
            </div>
            <div className="space-y-1 rounded-md border border-border/70 bg-background p-4">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Amount
              </p>
              <p className="text-sm font-semibold text-foreground">
                { record.refundSummary?.amountMinor
                  ? formatCurrencyMinor(record.refundSummary.amountMinor, record.refundSummary.currency)
                  : record.paymentCaptured && record.priceMinor
                    ? formatCurrencyMinor(record.priceMinor, record.currency)
                    : '₱0.00' }
              </p>
              <p className="text-sm text-muted-foreground">
                { record.refundSummary?.resolvedAt
                  ? `Resolved ${formatDateTime(record.refundSummary.resolvedAt)}`
                  : record.refundSummary?.requestedAt
                    ? `Started ${formatDateTime(record.refundSummary.requestedAt)}`
                    : record.paymentCaptured
                      ? `Returns to ${paymentLabel ?? 'your original payment method'} once the provider confirms the refund.`
                      : 'No settled payment was captured for this booking.' }
              </p>
            </div>
          </CardContent>
        </Card>
      ) : null }

      <Card className="border border-border bg-card/70">
        <CardHeader className="space-y-1 p-5">
          <CardTitle className="text-base font-semibold text-foreground">
            Booking timeline
          </CardTitle>
          <CardDescription className="text-xs text-muted-foreground">
            Track the lifecycle of your booking, payments, and refunds
          </CardDescription>
        </CardHeader>
        <CardContent className="p-5 pt-0">
          { record.timeline.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No payment recorded for this booking.
            </p>
          ) : (
            <ol className="relative ml-3 border-l border-border">
              { record.timeline.map((event) => (
                <TimelineItem key={ event.id } event={ event } />
              )) }
            </ol>
          ) }
        </CardContent>
      </Card>

      { (isCancellable || hasReceipt) && (
        <div className="flex justify-end gap-2">
          { hasReceipt && (
            <Button
              variant="outline"
              onClick={ handleDownloadReceipt }
              disabled={ isDownloadingReceipt }
            >
              { isDownloadingReceipt ? (
                <FiLoader className="mr-2 size-4 animate-spin" aria-hidden="true" />
              ) : (
                <FiDownload className="mr-2 size-4" aria-hidden="true" />
              ) }
              Download receipt
            </Button>
          ) }
          { isCancellable && (
            <Button
              variant="outline"
              className="border-destructive/60 text-destructive hover:border-destructive hover:bg-destructive/10 hover:!text-destructive focus-visible:border-destructive focus-visible:!text-destructive"
              disabled={ cancelMutation.isPending }
              onClick={ () => setIsCancelDialogOpen(true) }
            >
              { cancelMutation.isPending ? 'Cancelling…' : 'Cancel booking' }
            </Button>
          ) }
        </div>
      ) }

      <BookingCancelDialog
        booking={ {
          id: record.id,
          spaceName: record.spaceName,
          areaName: record.areaName,
          price: record.priceMinor ? Number(record.priceMinor) / 100 : null,
          currency: record.currency,
          paymentCaptured: record.paymentCaptured,
          paymentMethod: record.paymentMethod,
          refundSummary: record.refundSummary,
        } }
        open={ isCancelDialogOpen }
        isPending={ cancelMutation.isPending }
        onOpenChange={ (open) => {
          if (!cancelMutation.isPending) {
            setIsCancelDialogOpen(open);
          }
        } }
        onConfirm={ handleCancel }
      />
    </section>
  );
}

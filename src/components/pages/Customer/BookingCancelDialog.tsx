'use client';

import { FiAlertCircle } from 'react-icons/fi';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import type { BookingRefundSummary } from '@/lib/bookings/refund-summary';
import { formatCurrencyMinor } from '@/lib/wallet';

type CancelDialogBooking = {
  id: string;
  spaceName: string;
  areaName: string;
  price: number | null;
  currency?: string;
  paymentCaptured?: boolean;
  paymentMethod?: string | null;
  refundSummary?: BookingRefundSummary | null;
};

type BookingCancelDialogProps = {
  booking: CancelDialogBooking | null;
  open: boolean;
  isPending: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
};

const PAYMENT_METHOD_LABELS: Record<string, string> = { xendit: 'Xendit', };

function formatExpectedRefundLabel(booking: CancelDialogBooking) {
  if (typeof booking.price !== 'number' || !Number.isFinite(booking.price)) {
    return 'Matches your settled booking amount';
  }

  return formatCurrencyMinor(
    String(Math.round(booking.price * 100)),
    booking.currency ?? 'PHP'
  );
}

export function BookingCancelDialog({
  booking,
  open,
  isPending,
  onOpenChange,
  onConfirm,
}: BookingCancelDialogProps) {
  const expectedRefundLabel = booking
    ? formatExpectedRefundLabel(booking)
    : null;
  const paymentMethodLabel = booking?.paymentMethod
    ? (PAYMENT_METHOD_LABELS[booking.paymentMethod] ?? booking.paymentMethod)
    : null;

  return (
    <Dialog open={ open } onOpenChange={ onOpenChange }>
      <DialogContent dismissible={ !isPending }>
        <DialogHeader>
          <DialogTitle>Cancel booking</DialogTitle>
          <DialogDescription>
            { booking
              ? `Review what happens when you cancel ${booking.areaName} at ${booking.spaceName}.`
              : 'Review what happens before you cancel this booking.' }
          </DialogDescription>
        </DialogHeader>

        { booking ? (
          <div className="space-y-4">
            <div className="rounded-md border border-border/70 bg-muted/20 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    { booking.spaceName }
                  </p>
                  <p className="text-xs text-muted-foreground">
                    { booking.areaName }
                  </p>
                </div>
                <Badge variant="destructive">Will be cancelled</Badge>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-md border border-border/70 bg-background p-4">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Refund outcome
                </p>
                <p className="mt-1 text-sm font-semibold text-foreground">
                  { booking.paymentCaptured
                    ? 'Refund processing starts automatically'
                    : 'No refund needed' }
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  { booking.paymentCaptured
                    ? 'The money returns to the original payment method after provider confirmation.'
                    : 'No settled payment was captured for this booking.' }
                </p>
              </div>

              <div className="rounded-md border border-border/70 bg-background p-4">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Expected amount
                </p>
                <p className="mt-1 text-sm font-semibold text-foreground">
                  { booking.paymentCaptured
                    ? expectedRefundLabel
                    : '₱0.00' }
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  { paymentMethodLabel
                    ? `Original payment method: ${paymentMethodLabel}`
                    : 'Original payment method will be reused if a refund is required.' }
                </p>
              </div>
            </div>

            <div className="flex items-start gap-2 rounded-md border border-amber-300/50 bg-amber-50/80 px-3 py-3 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/20 dark:text-amber-100">
              <FiAlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              <p>
                Cancelling updates the booking immediately. If payment was captured,
                the refund may still take time to settle and will continue to appear
                in your booking history until it completes.
              </p>
            </div>
          </div>
        ) : null }

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={ () => onOpenChange(false) }
            disabled={ isPending }
          >
            Keep booking
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={ onConfirm }
            disabled={ isPending || !booking }
            loading={ isPending }
            loadingText="Cancelling…"
          >
            Cancel booking
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

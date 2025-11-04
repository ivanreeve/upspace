import { format } from 'date-fns';

import type { BookingArea, ReviewSummary } from '../booking-utils';
import { formatCurrency, formatTimeDisplay } from '../booking-utils';

import { SummaryRow } from './SummaryRow';

import { Button } from '@/components/ui/button';

type PaymentStepProps = {
  spaceName: string;
  paymentGatewayLabel: string;
  selectedArea: BookingArea;
  reviewData: ReviewSummary;
  onBack: () => void;
  onCancel: () => void;
  onConfirm: () => void;
  isProcessing: boolean;
};

export function PaymentStep({
  spaceName,
  paymentGatewayLabel,
  selectedArea,
  reviewData,
  onBack,
  onCancel,
  onConfirm,
  isProcessing,
}: PaymentStepProps) {
  const rateLabel = reviewData.rateLabel ?? 'Selected rate';
  const perGuestRate = reviewData.perGuestRate;
  const guestLabel = `${reviewData.guests} ${reviewData.guests === 1 ? 'guest' : 'guests'}`;
  const durationLabel = `${reviewData.stayHours} ${reviewData.stayHours === 1 ? 'hour' : 'hours'}`;
  const multiplierLabel = reviewData.usesHourlyMultiplier
    ? `${guestLabel} × ${durationLabel}`
    : guestLabel;
  const arrivalLabel = reviewData.arrivalTime
    ? formatTimeDisplay(reviewData.arrivalTime)
    : '—';

  return (
    <>
      <div className="grid gap-4 rounded-2xl border bg-background p-4 shadow-sm md:grid-cols-[1.5fr,1fr]">
        <div className="space-y-3">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Reservation Summary
          </h3>
          <SummaryRow label="Space">{ spaceName }</SummaryRow>
          <SummaryRow label="Area">
            { selectedArea.name } · Capacity { selectedArea.capacity }
          </SummaryRow>
          <SummaryRow label="Date">
            { format(reviewData.reservationDate, 'MMMM d, yyyy') }
          </SummaryRow>
          <SummaryRow label="Arrival">{ arrivalLabel }</SummaryRow>
          <SummaryRow label="Guests">{ reviewData.guests }</SummaryRow>
          <SummaryRow label="Duration">{ durationLabel }</SummaryRow>
          <SummaryRow label="Selected rate">{ rateLabel }</SummaryRow>
        </div>

        <div className="space-y-4 rounded-2xl border bg-muted/20 p-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Payment Gateway</p>
            <p className="text-lg font-semibold">{ paymentGatewayLabel }</p>
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">{ rateLabel }</span>
              <span className="font-medium text-foreground">
                { formatCurrency(reviewData.totalAmount) }
              </span>
            </div>
            <div className="flex items-center justify-between text-muted-foreground">
              <span>Discount</span>
              <span>—</span>
            </div>
          </div>
          <div className="flex items-center justify-between border-t pt-3 text-sm font-semibold">
            <span>Total</span>
            <span>{ formatCurrency(reviewData.totalAmount) }</span>
          </div>
          <div className="space-y-1 rounded-lg bg-muted/40 p-3 text-xs text-muted-foreground">
            <span>
              { perGuestRate != null
                ? `Pricing basis: ${formatCurrency(perGuestRate)} per guest${reviewData.usesHourlyMultiplier ? ' / hour' : ''}.`
                : 'Total reflects the selected rate details.' }
            </span>
            <span>{ multiplierLabel }</span>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button type="button" variant="ghost" onClick={ onCancel }>
          Cancel
        </Button>
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={ onBack } disabled={ isProcessing }>
            Modify details
          </Button>
          <Button type="button" onClick={ onConfirm } disabled={ isProcessing }>
            { isProcessing ? 'Confirming…' : 'Confirm payment' }
          </Button>
        </div>
      </div>
    </>
  );
}

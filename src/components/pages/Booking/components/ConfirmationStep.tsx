import Link from 'next/link';
import { format } from 'date-fns';


import type { ReviewSummary } from '../booking-utils';
import { formatCurrency, formatReservationDisplay } from '../booking-utils';

import { SummaryRow } from './SummaryRow';
import { StatusBadge } from './StatusBadge';

import { Button } from '@/components/ui/button';

type ConfirmationStepProps = {
  result: {
    booking: {
      area: { name: string };
      arrival_time: string | null;
      reservation_date: string;
      from: string | null;
      to: string | null;
      duration_hours: number;
      guest_count: string;
      total_amount: string;
      user: { name: string; email: string };
      pricing: {
        label: string | null;
        perGuest: string | null;
        usesHourlyMultiplier: boolean;
      };
    };
    summary: {
      invoiceNumber: string;
      idempotencyKey: string;
      totalAmount: string;
      paymentMethod: string;
      status: string;
      pricingLabel: string | null;
      perGuestAmount: string | null;
    };
  };
  spaceLocation: string;
  review: ReviewSummary | null;
  spaceHref: string;
};

export function ConfirmationStep({
  result,
  spaceLocation,
  review,
  spaceHref,
}: ConfirmationStepProps) {
  const stayHoursRaw =
    review?.stayHours ??
    (Number.isFinite(result.booking.duration_hours)
      ? result.booking.duration_hours
      : Number.parseInt(String(result.booking.duration_hours ?? 0), 10));
  const guestsRaw =
    review?.guests ?? Number.parseInt(result.booking.guest_count ?? '0', 10);
  const stayHours = Number.isFinite(stayHoursRaw) ? stayHoursRaw : 0;
  const guests = Number.isFinite(guestsRaw) ? guestsRaw : 0;
  const totalAmount = Number.parseFloat(result.summary.totalAmount);
  const serverPerGuest =
    result.summary.perGuestAmount ??
    result.booking.pricing?.perGuest ??
    null;
  const perGuestRateCandidate =
    review?.perGuestRate ??
    (serverPerGuest != null ? Number.parseFloat(serverPerGuest) : null);
  const perGuestRate =
    perGuestRateCandidate != null && Number.isFinite(perGuestRateCandidate)
      ? perGuestRateCandidate
      : null;
  const rateLabel =
    review?.rateLabel ??
    result.summary.pricingLabel ??
    result.booking.pricing?.label ??
    'See host confirmation for pricing breakdown';
  const arrivalTimeValue =
    result.booking.arrival_time ?? result.booking.from ?? '';
  const reservationLabel = arrivalTimeValue
    ? formatReservationDisplay(result.booking.reservation_date, arrivalTimeValue)
    : format(new Date(result.booking.reservation_date), 'MMMM d, yyyy');
  const usesHourlyMultiplier =
    review?.usesHourlyMultiplier ??
    result.booking.pricing?.usesHourlyMultiplier ??
    false;

  return (
    <>
      <div className="grid gap-4 rounded-2xl border bg-background p-4 shadow-sm md:grid-cols-[1.5fr,1fr]">
        <div className="space-y-3">
          <StatusBadge status={ result.summary.status } />
          <SummaryRow label="Invoice">{ result.summary.invoiceNumber }</SummaryRow>
          <SummaryRow label="Reservation">{ reservationLabel }</SummaryRow>
          <SummaryRow label="Guests">{ guests }</SummaryRow>
          <SummaryRow label="Area">{ result.booking.area.name }</SummaryRow>
          <SummaryRow label="Location">{ spaceLocation }</SummaryRow>
          <SummaryRow label="Selected rate">{ rateLabel }</SummaryRow>
        </div>

        <div className="space-y-4 rounded-2xl border bg-muted/20 p-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Payment Summary
            </p>
            <p className="text-sm text-muted-foreground">
              Method · { result.summary.paymentMethod }
            </p>
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Subtotal</span>
              <span className="font-medium text-foreground">
                { formatCurrency(totalAmount) }
              </span>
            </div>
            <div className="flex items-center justify-between text-muted-foreground">
              <span>Discount</span>
              <span>—</span>
            </div>
          </div>
          <div className="flex items-center justify-between border-t pt-3 text-sm font-semibold">
            <span>Total</span>
            <span>{ formatCurrency(totalAmount) }</span>
          </div>
          { perGuestRate != null && (
            <div className="space-y-1 rounded-lg bg-muted/40 p-3 text-xs text-muted-foreground">
              <span>
                Pricing basis: { formatCurrency(perGuestRate) } per guest
                { usesHourlyMultiplier ? ' / hour' : '' }.
              </span>
              <span>
                { stayHours } { stayHours === 1 ? 'hour' : 'hours' } · { guests }{ ' ' }
                { guests === 1 ? 'guest' : 'guests' }
              </span>
            </div>
          ) }
        </div>
      </div>

      <div className="rounded-2xl border bg-muted/10 p-4 text-sm">
        <p className="font-semibold text-foreground">Guest contact</p>
        <p className="text-muted-foreground">
          { result.booking.user.name } · { result.booking.user.email }
        </p>
      </div>

      <div className="flex justify-end">
        <Button variant="outline" asChild>
          <Link href={ spaceHref }>Back to space</Link>
        </Button>
      </div>
    </>
  );
}

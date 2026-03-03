import type { TimelineEvent, TimelineEventStatus } from '@/types/booking-detail';

type BookingForTimeline = {
  id: string;
  status: string;
  created_at: Date;
  start_at?: Date;
  price_minor: bigint | null;
  currency: string;
};

type PaymentTxForTimeline = {
  id: string;
  amount_minor: bigint | null;
  currency_iso3: string;
  created_at: Date;
} | null;

type RefundTxForTimeline = {
  id: string;
  status: string;
  amount_minor: bigint;
  currency: string;
  created_at: Date;
};

type StatusChangeEvent = {
  type: string;
  title: string;
  created_at: Date;
};

const TITLE_TO_EVENT: Record<string, { kind: TimelineEvent['kind']; label: string }> = {
  'Booking confirmed': {
 kind: 'confirmed',
label: 'Booking confirmed', 
},
  'Booking rescheduled': {
 kind: 'confirmed',
label: 'Booking rescheduled', 
},
};

export function buildTimeline(
  booking: BookingForTimeline,
  paymentTx: PaymentTxForTimeline,
  refundTxs: RefundTxForTimeline[],
  statusNotifications?: StatusChangeEvent[]
): TimelineEvent[] {
  const events: TimelineEvent[] = [];

  events.push({
    id: `created-${booking.id}`,
    kind: 'created',
    label: 'Booking created',
    status: 'succeeded',
    amountMinor: '0',
    currency: booking.currency,
    timestamp: booking.created_at.toISOString(),
  });

  if (statusNotifications) {
    for (const notification of statusNotifications) {
      const mapping = notification.type === 'booking_confirmed'
        ? {
 kind: 'confirmed' as const,
label: 'Booking confirmed', 
}
        : TITLE_TO_EVENT[notification.title] ?? null;

      if (mapping) {
        events.push({
          id: `${mapping.kind}-${notification.created_at.getTime()}`,
          kind: mapping.kind,
          label: mapping.label,
          status: 'succeeded',
          amountMinor: '0',
          currency: booking.currency,
          timestamp: notification.created_at.toISOString(),
        });
      }
    }
  }

  if (paymentTx) {
    const amount = paymentTx.amount_minor ?? booking.price_minor ?? BigInt(0);
    events.push({
      id: `payment-${paymentTx.id}`,
      kind: 'payment',
      label: 'Payment captured',
      status: 'succeeded',
      amountMinor: amount.toString(),
      currency: paymentTx.currency_iso3,
      timestamp: paymentTx.created_at.toISOString(),
    });
  }

  if (booking.status === 'cancelled') {
    const cancelTimestamp =
      refundTxs.length > 0
        ? refundTxs[0].created_at
        : booking.created_at;
    events.push({
      id: `cancellation-${booking.id}`,
      kind: 'cancellation',
      label: 'Booking cancelled',
      status: 'succeeded',
      amountMinor: '0',
      currency: booking.currency,
      timestamp: cancelTimestamp.toISOString(),
    });
  }

  for (const refund of refundTxs) {
    const refundStatus = refund.status as TimelineEventStatus;
    const label =
      refundStatus === 'succeeded'
        ? 'Refund completed'
        : refundStatus === 'pending'
          ? 'Refund processing'
          : 'Refund failed';
    events.push({
      id: refund.id,
      kind: 'refund',
      label,
      status: refundStatus,
      amountMinor: refund.amount_minor.toString(),
      currency: refund.currency,
      timestamp: refund.created_at.toISOString(),
    });
  }

  events.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  return events;
}

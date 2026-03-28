import type { BookingStatus } from './types';

export type BookingRefundState =
  | 'pending'
  | 'succeeded'
  | 'failed'
  | 'attention';

export type BookingRefundSummary = {
  state: BookingRefundState;
  label: string;
  detail: string;
  amountMinor: string | null;
  currency: string;
  requestedAt: string | null;
  resolvedAt: string | null;
};

export type PaymentTxForRefundSummary = {
  status: 'pending' | 'succeeded' | 'failed' | 'refunded' | 'cancelled';
  amount_minor: bigint | number | null;
  currency_iso3: string;
  provider: string | null;
};

export type RefundTxForRefundSummary = {
  status: 'pending' | 'succeeded' | 'failed';
  amount_minor: bigint | number;
  currency: string;
  created_at: Date;
  updated_at: Date | null;
  processed_at: Date | null;
};

const REFUND_RELEVANT_BOOKING_STATUSES: BookingStatus[] = [
  'cancelled',
  'rejected',
  'expired'
];

function toFiniteNumber(value: bigint | number | null | undefined): number | null {
  if (value === null || typeof value === 'undefined') {
    return null;
  }

  const resolved = typeof value === 'bigint' ? Number(value) : value;
  return Number.isFinite(resolved) ? resolved : null;
}

function resolveRefundTerminalTimestamp(refund: RefundTxForRefundSummary) {
  return refund.processed_at ?? refund.updated_at ?? refund.created_at;
}

export function hasCapturedPayment(
  paymentTx: PaymentTxForRefundSummary | null | undefined
) {
  return paymentTx?.status === 'succeeded' || paymentTx?.status === 'refunded';
}

export function buildBookingRefundSummary(input: {
  bookingStatus: BookingStatus;
  paymentTx?: PaymentTxForRefundSummary | null;
  refundTxs?: RefundTxForRefundSummary[];
  bookingCurrency?: string | null;
}): BookingRefundSummary | null {
  const latestRefund = input.refundTxs?.[0] ?? null;
  const paymentCaptured = hasCapturedPayment(input.paymentTx);
  const fallbackAmountMinor = toFiniteNumber(input.paymentTx?.amount_minor);
  const fallbackCurrency = input.paymentTx?.currency_iso3 ?? input.bookingCurrency ?? 'PHP';

  if (latestRefund) {
    const resolvedAmountMinor = toFiniteNumber(latestRefund.amount_minor);

    if (latestRefund.status === 'pending') {
      return {
        state: 'pending',
        label: 'Refund processing',
        detail: 'Your refund has been started and is waiting for final provider confirmation.',
        amountMinor: resolvedAmountMinor === null ? null : String(resolvedAmountMinor),
        currency: latestRefund.currency || fallbackCurrency,
        requestedAt: latestRefund.created_at.toISOString(),
        resolvedAt: null,
      };
    }

    if (latestRefund.status === 'succeeded') {
      return {
        state: 'succeeded',
        label: 'Refund completed',
        detail: 'Your refund was completed and sent back to the original payment method.',
        amountMinor: resolvedAmountMinor === null ? null : String(resolvedAmountMinor),
        currency: latestRefund.currency || fallbackCurrency,
        requestedAt: latestRefund.created_at.toISOString(),
        resolvedAt: resolveRefundTerminalTimestamp(latestRefund).toISOString(),
      };
    }

    return {
      state: 'failed',
      label: 'Refund failed',
      detail: 'The automatic refund did not complete. Our team may need to review this booking manually.',
      amountMinor: resolvedAmountMinor === null ? null : String(resolvedAmountMinor),
      currency: latestRefund.currency || fallbackCurrency,
      requestedAt: latestRefund.created_at.toISOString(),
      resolvedAt: resolveRefundTerminalTimestamp(latestRefund).toISOString(),
    };
  }

  if (
    paymentCaptured &&
    REFUND_RELEVANT_BOOKING_STATUSES.includes(input.bookingStatus)
  ) {
    return {
      state: 'attention',
      label: 'Refund needs attention',
      detail: 'This booking was closed after payment was captured, but the refund is not yet processing.',
      amountMinor: fallbackAmountMinor === null ? null : String(fallbackAmountMinor),
      currency: fallbackCurrency,
      requestedAt: null,
      resolvedAt: null,
    };
  }

  return null;
}

export function buildCancelSuccessMessage(input: {
  paymentCaptured: boolean;
  refundSummary: BookingRefundSummary | null;
}) {
  if (!input.paymentCaptured) {
    return 'Booking cancelled. No payment was captured, so no refund was needed.';
  }

  switch (input.refundSummary?.state) {
    case 'pending':
      return 'Booking cancelled. Refund processing has started.';
    case 'succeeded':
      return 'Booking cancelled. Refund completed.';
    case 'failed':
      return 'Booking cancelled. Refund could not be completed automatically.';
    case 'attention':
      return 'Booking cancelled. Refund needs review.';
    default:
      return 'Booking cancelled. Refund review is pending.';
  }
}

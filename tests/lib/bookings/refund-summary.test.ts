import { describe, expect, it } from 'vitest';

import { buildBookingRefundSummary, buildCancelSuccessMessage } from '@/lib/bookings/refund-summary';

describe('booking refund summary', () => {
  it('returns a pending refund summary when a refund intent exists', () => {
    const summary = buildBookingRefundSummary({
      bookingStatus: 'cancelled',
      paymentTx: {
        status: 'succeeded',
        amount_minor: 150000n,
        currency_iso3: 'PHP',
        provider: 'xendit',
      },
      refundTxs: [{
        status: 'pending',
        amount_minor: 150000n,
        currency: 'PHP',
        created_at: new Date('2026-03-20T09:00:00.000Z'),
        updated_at: new Date('2026-03-20T09:00:00.000Z'),
        processed_at: null,
      }],
    });

    expect(summary).toEqual({
      state: 'pending',
      label: 'Refund processing',
      detail: 'Your refund has been started and is waiting for final provider confirmation.',
      amountMinor: '150000',
      currency: 'PHP',
      requestedAt: '2026-03-20T09:00:00.000Z',
      resolvedAt: null,
    });
  });

  it('flags cancelled paid bookings without a refund record for review', () => {
    const summary = buildBookingRefundSummary({
      bookingStatus: 'cancelled',
      paymentTx: {
        status: 'succeeded',
        amount_minor: 125000n,
        currency_iso3: 'PHP',
        provider: 'xendit',
      },
      refundTxs: [],
    });

    expect(summary?.state).toBe('attention');
    expect(buildCancelSuccessMessage({
      paymentCaptured: true,
      refundSummary: summary,
    })).toBe('Booking cancelled. Refund needs review.');
  });
});

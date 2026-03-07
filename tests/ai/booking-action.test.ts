import { describe, expect, it } from 'vitest';

import { applyBookingActionStatus, type BookingActionRecord } from '@/lib/ai/booking-action';

const baseAction: BookingActionRecord = {
  action: 'checkout',
  areaId: '22222222-2222-4222-8222-222222222222',
  areaName: 'Ocean Desk',
  bookingHours: 3,
  bookingId: '33333333-3333-4333-8333-333333333333',
  checkoutUrl: 'https://pay.example/checkout',
  guestCount: 2,
  price: 750,
  priceCurrency: 'PHP',
  spaceId: '11111111-1111-4111-8111-111111111111',
  spaceName: 'North Tower',
  startAt: '2026-03-10T09:00:00.000Z',
};

describe('AI booking action status reconciliation', () => {
  it('marks success returns as payment processing until the booking is updated', () => {
    const result = applyBookingActionStatus(baseAction, {
      bookingStatus: 'pending',
      checkoutUrl: baseAction.checkoutUrl,
      paymentCaptured: false,
      paymentOutcome: 'success',
      requiresHostApproval: false,
      reviewState: null,
    });

    expect(result.flowState).toBe('payment_processing');
    expect(result.statusTitle).toBe('Payment received');
    expect(result.checkoutUrl).toBeUndefined();
  });

  it('surfaces host approval when payment is captured but booking stays pending', () => {
    const result = applyBookingActionStatus(baseAction, {
      bookingStatus: 'pending',
      checkoutUrl: baseAction.checkoutUrl,
      paymentCaptured: true,
      requiresHostApproval: true,
      reviewState: 'host_approval',
    });

    expect(result.flowState).toBe('awaiting_host_approval');
    expect(result.statusTitle).toBe('Awaiting host approval');
    expect(result.checkoutUrl).toBeUndefined();
  });

  it('keeps checkout retryable after payment cancellation', () => {
    const result = applyBookingActionStatus(baseAction, {
      bookingStatus: 'pending',
      checkoutUrl: baseAction.checkoutUrl,
      paymentCaptured: false,
      paymentOutcome: 'cancel',
      requiresHostApproval: false,
      reviewState: null,
    });

    expect(result.flowState).toBe('payment_cancelled');
    expect(result.statusTitle).toBe('Payment cancelled');
    expect(result.checkoutUrl).toBe(baseAction.checkoutUrl);
  });
});

import {
  afterEach,
  describe,
  expect,
  it,
  vi
} from 'vitest';

import * as checkoutSession from '@/lib/bookings/checkout-session';
import { createBookingCheckout } from '@/lib/ai/booking-tools';

describe('AI booking checkout tool', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns a live checkout action when the booking service succeeds', async () => {
    vi.spyOn(checkoutSession, 'createBookingCheckoutSession').mockResolvedValue({
      areaId: '22222222-2222-4222-8222-222222222222',
      areaName: 'Ocean Desk',
      bookingHours: 3,
      bookingId: '33333333-3333-4333-8333-333333333333',
      checkoutUrl: 'https://pay.example/checkout',
      guestCount: 2,
      price: 750,
      priceCurrency: 'PHP',
      requiresHostApproval: false,
      spaceId: '11111111-1111-4111-8111-111111111111',
      spaceName: 'North Tower',
      startAt: '2026-03-10T09:00:00.000Z',
      testingMode: false,
    });

    const result = await createBookingCheckout(
      {
        space_id: '11111111-1111-4111-8111-111111111111',
        area_id: '22222222-2222-4222-8222-222222222222',
        booking_hours: 3,
        start_at: '2026-03-10T09:00:00.000Z',
        guest_count: 2,
      },
      {
        auth_user_id: 'customer-auth-id',
        user_id: 1n,
      }
    );

    expect(result).toMatchObject({
      action: 'checkout',
      areaId: '22222222-2222-4222-8222-222222222222',
      areaName: 'Ocean Desk',
      bookingHours: 3,
      bookingId: '33333333-3333-4333-8333-333333333333',
      bookingStatus: 'pending',
      checkoutUrl: 'https://pay.example/checkout',
      flowState: 'checkout_ready',
      guestCount: 2,
      paymentCaptured: false,
      price: 750,
      priceCurrency: 'PHP',
      requiresHostApproval: false,
      spaceId: '11111111-1111-4111-8111-111111111111',
      spaceName: 'North Tower',
      startAt: '2026-03-10T09:00:00.000Z',
      statusDetail: 'Complete payment to lock in this booking.',
      statusTitle: 'Checkout ready',
      testingMode: false,
    });
    expect(result).toHaveProperty('lastSyncedAt');
  });

  it('rejects booking checkout for non-customer sessions', async () => {
    const result = await createBookingCheckout(
      {
        space_id: '11111111-1111-4111-8111-111111111111',
        area_id: '22222222-2222-4222-8222-222222222222',
        booking_hours: 2,
        start_at: '2026-03-10T09:00:00.000Z',
      },
      null
    );

    expect(result).toEqual({ error: 'Only signed-in customers can create booking checkouts.', });
  });
});

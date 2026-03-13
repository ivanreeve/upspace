import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { MAX_BOOKING_HOURS, MIN_BOOKING_HOURS } from '@/lib/bookings/constants';
import { BookingCheckoutError, createBookingCheckoutSession } from '@/lib/bookings/checkout-session';
import { FinancialProviderError } from '@/lib/providers/errors';
import { enforceRateLimit, RateLimitExceededError } from '@/lib/rate-limit';
import { resolveAuthenticatedUserForWallet } from '@/lib/wallet-server';

const checkoutPayloadSchema = z.object({
  spaceId: z.string().uuid(),
  areaId: z.string().uuid(),
  bookingHours: z.number().int().min(MIN_BOOKING_HOURS).max(MAX_BOOKING_HOURS),
  startAt: z.string().datetime().optional(),
  guestCount: z.number().int().min(1).max(999).optional(),
  successUrl: z.string().url().optional(),
  cancelUrl: z.string().url().optional(),
});

const unauthorizedResponse = NextResponse.json(
  { error: 'Authentication required.', },
  { status: 401, }
);

const invalidPayloadResponse = NextResponse.json(
  { error: 'Invalid booking payload.', },
  { status: 400, }
);

const notFoundResponse = NextResponse.json(
  { error: 'Area not found for this space.', },
  { status: 404, }
);

export async function handleCreateBookingCheckout(req: NextRequest) {
  try {
    const parsed = checkoutPayloadSchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return invalidPayloadResponse;
    }

    const auth = await resolveAuthenticatedUserForWallet();
    if (auth.response) {
      return auth.response;
    }

    if (auth.dbUser?.role !== 'customer') {
      return unauthorizedResponse;
    }

    try {
      await enforceRateLimit({
        scope: 'booking-checkout',
        request: req,
        identity: auth.dbUser.auth_user_id,
      });
    } catch (error) {
      if (error instanceof RateLimitExceededError) {
        return NextResponse.json(
          { error: error.message, },
          {
            status: 429,
            headers: { 'Retry-After': error.retryAfter.toString(), },
          }
        );
      }
      console.error('Rate limit check failed for booking checkout', error);
    }

    if (!parsed.data.startAt) {
      return NextResponse.json(
        { error: 'Please choose a booking start date.', },
        { status: 400, }
      );
    }

    const checkout = await createBookingCheckoutSession({
      areaId: parsed.data.areaId,
      bookingHours: parsed.data.bookingHours,
      cancelUrl: parsed.data.cancelUrl,
      customer: {
        auth_user_id: auth.dbUser.auth_user_id,
        user_id: auth.dbUser.user_id,
      },
      guestCount: parsed.data.guestCount ?? 1,
      spaceId: parsed.data.spaceId,
      startAt: new Date(parsed.data.startAt),
      successUrl: parsed.data.successUrl,
    });

    return NextResponse.json(
      {
        bookingId: checkout.bookingId,
        checkoutUrl: checkout.checkoutUrl,
        testingMode: checkout.testingMode,
      },
      { status: 201, }
    );
  } catch (error) {
    if (error instanceof BookingCheckoutError) {
      if (error.status === 404) {
        return notFoundResponse;
      }

      return NextResponse.json(
        { error: error.message, },
        { status: error.status, }
      );
    }

    if (error instanceof FinancialProviderError) {
      return NextResponse.json(
        { error: error.message, },
        { status: error.status, }
      );
    }

    console.error('Failed to create booking checkout session', error);
    return NextResponse.json(
      { error: 'Unable to start checkout session.', },
      { status: 500, }
    );
  }
}

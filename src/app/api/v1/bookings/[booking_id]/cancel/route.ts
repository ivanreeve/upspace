import { NextRequest, NextResponse } from 'next/server';

import { CANCELLABLE_BOOKING_STATUSES } from '@/lib/bookings/constants';
import { BOOKING_PRICE_MINOR_FACTOR, mapBookingsWithProfiles, normalizeNumeric } from '@/lib/bookings/serializer';
import { sendBookingCancellationEmail } from '@/lib/email';
import { notifyBookingEvent } from '@/lib/notifications/booking';
import { createPaymongoRefund } from '@/lib/paymongo';
import { prisma } from '@/lib/prisma';
import { enforceRateLimit, RateLimitExceededError } from '@/lib/rate-limit';
import { createSupabaseServerClient } from '@/lib/supabase/server';

const unauthorizedResponse = NextResponse.json(
  { error: 'Authentication required.', },
  { status: 401, }
);

const forbiddenResponse = NextResponse.json(
  { error: 'Insufficient permissions.', },
  { status: 403, }
);

const notFoundResponse = NextResponse.json(
  { error: 'Booking not found.', },
  { status: 404, }
);

const invalidStatusResponse = (message: string) =>
  NextResponse.json({ error: message, }, { status: 400, });

export async function POST(
  _req: NextRequest,
  context: { params: Promise<{ booking_id: string }> }
) {
  const params = await context.params;
  const supabase = await createSupabaseServerClient();
  const {
 data: authData, error: authError,
} = await supabase.auth.getUser();

  if (authError || !authData?.user) {
    return unauthorizedResponse;
  }

  const user = await prisma.user.findFirst({
    where: { auth_user_id: authData.user.id, },
    select: { role: true, },
  });

  if (!user || user.role !== 'customer') {
    return forbiddenResponse;
  }

  try {
    await enforceRateLimit({
 scope: 'booking-cancel',
request: _req,
identity: authData.user.id, 
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
    console.error('Rate limit check failed for booking cancellation', error);
  }

  const { booking_id, } = params;
  if (!booking_id) {
    return notFoundResponse;
  }

  const booking = await prisma.booking.findUnique({
    where: { id: booking_id, },
    select: {
      id: true,
      space_id: true,
      space_name: true,
      area_id: true,
      area_name: true,
      booking_hours: true,
      price_minor: true,
      currency: true,
      status: true,
      created_at: true,
      user_auth_id: true,
      partner_auth_id: true,
      area_max_capacity: true,
    },
  });

  if (!booking || booking.user_auth_id !== authData.user.id) {
    return notFoundResponse;
  }

  if (!CANCELLABLE_BOOKING_STATUSES.includes(booking.status)) {
    return invalidStatusResponse('This booking cannot be cancelled at this time.');
  }

  // Atomically mark as cancelled to prevent double-cancel race conditions.
  // updateMany with a status filter ensures only one concurrent request succeeds.
  const cancelResult = await prisma.booking.updateMany({
    where: {
      id: booking.id,
      status: { in: CANCELLABLE_BOOKING_STATUSES, },
    },
    data: { status: 'cancelled', },
  });

  if (cancelResult.count === 0) {
    return invalidStatusResponse('This booking was already cancelled or is no longer cancellable.');
  }

  // Notify customer and partner about the cancellation
  try {
    await notifyBookingEvent(
      {
        bookingId: booking.id,
        spaceId: booking.space_id,
        areaId: booking.area_id,
        spaceName: booking.space_name,
        areaName: booking.area_name,
        customerAuthId: booking.user_auth_id,
        partnerAuthId: booking.partner_auth_id,
      },
      {
 title: 'Booking cancelled',
body: `Your booking at ${booking.area_name} · ${booking.space_name} has been cancelled.`, 
},
      {
 title: 'Booking cancelled',
body: `${booking.area_name} in ${booking.space_name} was cancelled by the customer.`, 
}
    );
  } catch (notifError) {
    console.error('Failed to create cancellation notifications', {
 bookingId: booking.id,
error: notifError, 
});
  }

  // Send cancellation email to partner
  if (booking.partner_auth_id) {
    try {
      const supabaseAdmin = await createSupabaseServerClient();
      const { data: partnerData, } = await supabaseAdmin.auth.admin.getUserById(booking.partner_auth_id);
      const partnerEmail = partnerData?.user?.email;
      if (partnerEmail) {
        await sendBookingCancellationEmail({
          to: partnerEmail,
          spaceName: booking.space_name,
          areaName: booking.area_name,
          bookingHours: normalizeNumeric(booking.booking_hours) ?? 0,
          price: normalizeNumeric(booking.price_minor) !== null
            ? Number(booking.price_minor) / BOOKING_PRICE_MINOR_FACTOR
            : null,
          link: `${process.env.NEXT_PUBLIC_APP_URL ?? ''}/marketplace/${booking.space_id}`,
        });
      }
    } catch (emailError) {
      console.error('Failed to send cancellation email', {
 bookingId: booking.id,
error: emailError, 
});
    }
  }

  // Find the original charge for this booking to issue a refund.
  const charge = await prisma.wallet_transaction.findFirst({
    where: {
      booking_id: booking.id,
      type: 'charge',
      status: 'succeeded',
    },
    orderBy: { created_at: 'desc', },
    select: {
      wallet_id: true,
      external_reference: true,
      currency: true,
      amount_minor: true,
    },
  });

  if (charge?.external_reference) {
    const refundAmountMinor = Number(booking.price_minor ?? charge.amount_minor ?? 0);

    try {
      const refundPayload = await createPaymongoRefund({
        paymentId: charge.external_reference,
        amountMinor: refundAmountMinor,
        reason: 'requested_by_customer',
        metadata: {
          booking_id: booking.id,
          user_auth_id: booking.user_auth_id,
        },
      });

      // Record the refund transaction locally so the partner wallet reflects it
      // immediately, rather than waiting for the PayMongo webhook.
      const refundAttributes = refundPayload.data.attributes;
      try {
        await prisma.$transaction(async (tx) => {
          await tx.wallet_transaction.create({
            data: {
              wallet_id: charge.wallet_id,
              type: 'refund',
              status: refundAttributes.status,
              amount_minor: BigInt(refundAmountMinor),
              net_amount_minor: BigInt(refundAmountMinor),
              currency: charge.currency,
              description: `Cancellation refund · ${booking.area_name} · ${booking.space_name}`,
              booking_id: booking.id,
              external_reference: refundPayload.data.id,
              metadata: {
                paymongo_refund_id: refundPayload.data.id,
                payment_id: charge.external_reference,
                booking_id: booking.id,
                user_auth_id: booking.user_auth_id,
              },
            },
          });

          if (refundAttributes.status === 'succeeded') {
            await tx.wallet.update({
              where: { id: charge.wallet_id, },
              data: {
                balance_minor: { decrement: BigInt(refundAmountMinor), },
                updated_at: new Date(),
              },
            });
          }
        });
      } catch (walletError) {
        // Non-fatal: the webhook will reconcile. Log for monitoring.
        console.error('Failed to record cancellation refund in wallet', {
          bookingId: booking.id,
          refundId: refundPayload.data.id,
          error: walletError,
        });
      }
    } catch (error) {
      // Refund failed but booking is already cancelled.
      // Log for manual reconciliation — don't block the cancellation response.
      console.error('Failed to create PayMongo refund for cancelled booking', {
        bookingId: booking.id,
        error,
      });
    }
  }

  const updatedRows = await prisma.booking.findMany({ where: { id: booking.id, }, });
  const [record] = await mapBookingsWithProfiles(updatedRows);

  if (!record) {
    return notFoundResponse;
  }

  return NextResponse.json({ data: record, });
}

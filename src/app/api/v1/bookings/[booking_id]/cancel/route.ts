import { NextRequest, NextResponse } from 'next/server';

import { CANCELLABLE_BOOKING_STATUSES } from '@/lib/bookings/constants';
import { mapBookingsWithProfiles } from '@/lib/bookings/serializer';
import { createPaymongoRefund } from '@/lib/paymongo';
import { prisma } from '@/lib/prisma';
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

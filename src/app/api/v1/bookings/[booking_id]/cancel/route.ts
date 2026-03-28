import { NextRequest, NextResponse } from 'next/server';

import { CANCELLABLE_BOOKING_STATUSES } from '@/lib/bookings/constants';
import { buildCancelSuccessMessage } from '@/lib/bookings/refund-summary';
import { BOOKING_PRICE_MINOR_FACTOR, mapBookingsWithProfiles, normalizeNumeric } from '@/lib/bookings/serializer';
import { sendBookingCancellationEmail } from '@/lib/email';
import { submitXenditRefund } from '@/lib/financial/xendit-refunds';
import { notifyBookingEvent, notifyCustomerRefundUpdate } from '@/lib/notifications/booking';
import { prisma } from '@/lib/prisma';
import { enforceRateLimit, RateLimitExceededError } from '@/lib/rate-limit';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { ensureWalletRow } from '@/lib/wallet-server';

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

  const settledPayment = await prisma.payment_transaction.findFirst({
    where: {
      booking_id: booking.id,
      status: 'succeeded',
    },
    orderBy: { created_at: 'desc', },
    select: {
      id: true,
      provider: true,
      provider_object_id: true,
      amount_minor: true,
      currency_iso3: true,
      raw_gateway_json: true,
    },
  });

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

  if (booking.partner_auth_id) {
    const partnerUser = await prisma.user.findFirst({
      where: { auth_user_id: booking.partner_auth_id, },
      select: { user_id: true, },
    });

    if (partnerUser?.user_id && settledPayment) {
      const walletRow = await ensureWalletRow(partnerUser.user_id);
      const paymentId = settledPayment.provider_object_id || null;

      if (!paymentId) {
        console.warn('Unable to resolve payment id for cancelled booking refund', { bookingId: booking.id, });
      } else if (settledPayment.provider !== 'xendit') {
        console.error('Cancelled booking is linked to an unsupported legacy payment provider', {
          bookingId: booking.id,
          provider: settledPayment.provider,
          paymentTransactionId: settledPayment.id,
        });
      } else {
        const existingRefund = await prisma.wallet_transaction.findFirst({
          where: {
            wallet_id: walletRow.id,
            booking_id: booking.id,
            type: 'refund',
            status: { in: ['pending', 'succeeded'], },
            OR: [
              {
                metadata: {
                  path: ['payment_transaction_id'],
                  equals: settledPayment.id,
                },
              },
              {
                metadata: {
                  path: ['payment_id'],
                  equals: paymentId,
                },
              }
            ],
          },
          select: { id: true, },
        });

        if (!existingRefund) {
          const refundAmountMinor = Number(
            settledPayment.amount_minor ?? booking.price_minor ?? 0
          );

          let refundRecord: { id: string } | null = null;
          try {
            refundRecord = await prisma.wallet_transaction.create({
              data: {
                wallet_id: walletRow.id,
                type: 'refund',
                status: 'pending',
                amount_minor: BigInt(refundAmountMinor),
                net_amount_minor: BigInt(refundAmountMinor),
                currency: settledPayment.currency_iso3 ?? booking.currency,
                description: `Cancellation refund · ${booking.area_name} · ${booking.space_name}`,
                booking_id: booking.id,
                metadata: {
                  payment_id: paymentId,
                  payment_transaction_id: settledPayment.id,
                  payment_provider_object_id: settledPayment.provider_object_id,
                  booking_id: booking.id,
                  user_auth_id: booking.user_auth_id,
                },
              },
              select: { id: true, },
            });
          } catch (recordError) {
            console.error('Failed to record refund intent', {
              bookingId: booking.id,
              error: recordError,
            });
          }

          if (refundRecord) {
            const refundRecordId = refundRecord.id;
            try {
              await submitXenditRefund({
                walletTransactionId: refundRecordId,
                partnerUserId: partnerUser.user_id,
                bookingId: booking.id,
                paymentTransaction: {
                  id: settledPayment.id,
                  provider_object_id: settledPayment.provider_object_id,
                  amount_minor: settledPayment.amount_minor,
                  currency_iso3: settledPayment.currency_iso3,
                  raw_gateway_json: settledPayment.raw_gateway_json,
                },
                amountMinor: BigInt(refundAmountMinor),
                reason: 'cancellation',
                requestedByAuthUserId: booking.user_auth_id,
                metadata: {
                  booking_id: booking.id,
                  user_auth_id: booking.user_auth_id,
                },
                providedPaymentReference: paymentId,
              });
            } catch (refundError) {
              console.error(
                'Failed to create Xendit refund for cancelled booking',
                {
                  bookingId: booking.id,
                  refundRecordId,
                  error: refundError,
                }
              );
            }
          }
        }
      }
    }
  }

  const updatedRows = await prisma.booking.findMany({ where: { id: booking.id, }, });
  const [record] = await mapBookingsWithProfiles(updatedRows);

  if (!record) {
    return notFoundResponse;
  }

  if (record.refundSummary) {
    const refundNotificationState = record.refundSummary.state === 'pending'
      ? 'processing'
      : record.refundSummary.state === 'succeeded'
        ? 'completed'
        : record.refundSummary.state === 'failed'
          ? 'failed'
          : 'review';

    try {
      await notifyCustomerRefundUpdate(
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
          state: refundNotificationState,
          amountMinor: record.refundSummary.amountMinor,
          currency: record.refundSummary.currency,
        }
      );
    } catch (refundNotifError) {
      console.error('Failed to create refund status notification', {
        bookingId: booking.id,
        error: refundNotifError,
      });
    }
  }

  return NextResponse.json({
    data: record,
    message: buildCancelSuccessMessage({
      paymentCaptured: Boolean(record.paymentCaptured),
      refundSummary: record.refundSummary ?? null,
    }),
  });
}

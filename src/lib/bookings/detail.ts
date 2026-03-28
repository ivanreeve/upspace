import { normalizeNumeric } from '@/lib/bookings/serializer';
import { buildBookingRefundSummary, hasCapturedPayment } from '@/lib/bookings/refund-summary';
import { buildTimeline } from '@/lib/bookings/timeline';
import { prisma } from '@/lib/prisma';
import type { BookingDetailRecord } from '@/types/booking-detail';

export type BookingReviewState = 'host_approval' | 'capacity_review' | null;

const REVIEW_TITLE_MAP: Record<string, BookingReviewState> = {
  'Booking pending approval': 'host_approval',
  'Booking needs approval': 'host_approval',
  'Booking awaiting review': 'capacity_review',
  'Review booking capacity': 'capacity_review',
};

export async function getCustomerBookingDetailRecord(
  bookingId: string,
  customerAuthId: string
): Promise<BookingDetailRecord | null> {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId, },
    select: {
      id: true,
      space_id: true,
      space_name: true,
      area_id: true,
      area_name: true,
      booking_hours: true,
      start_at: true,
      guest_count: true,
      price_minor: true,
      currency: true,
      status: true,
      created_at: true,
      user_auth_id: true,
      expires_at: true,
    },
  });

  if (!booking || booking.user_auth_id !== customerAuthId) {
    return null;
  }

  const [paymentTx, refundTxs, statusNotifications] = await Promise.all([
    prisma.payment_transaction.findFirst({
      where: {
        booking_id: booking.id,
        status: { in: ['succeeded', 'refunded'], },
      },
      orderBy: { created_at: 'desc', },
      select: {
        id: true,
        status: true,
        amount_minor: true,
        fee_minor: true,
        currency_iso3: true,
        provider: true,
        is_live: true,
        created_at: true,
      },
    }),
    prisma.wallet_transaction.findMany({
      where: {
        booking_id: booking.id,
        type: 'refund',
      },
      orderBy: { created_at: 'asc', },
      select: {
        id: true,
        status: true,
        amount_minor: true,
        currency: true,
        created_at: true,
        updated_at: true,
        processed_at: true,
      },
    }),
    prisma.app_notification.findMany({
      where: {
        booking_id: booking.id,
        user_auth_id: customerAuthId,
        type: { in: ['booking_confirmed', 'system'], },
      },
      orderBy: { created_at: 'asc', },
      select: {
        type: true,
        title: true,
        created_at: true,
      },
    })
  ]);

  const reviewState = [...statusNotifications]
    .reverse()
    .map((notification) => REVIEW_TITLE_MAP[notification.title] ?? null)
    .find((candidate) => candidate !== null) ?? null;

  const paymentSummary = paymentTx
    ? {
        status: paymentTx.status,
        amount_minor: paymentTx.amount_minor,
        currency_iso3: paymentTx.currency_iso3,
        provider: paymentTx.provider,
      }
    : null;
  const timeline = buildTimeline(booking, paymentTx, refundTxs, statusNotifications);
  const refundSummary = buildBookingRefundSummary({
    bookingStatus: booking.status,
    paymentTx: paymentSummary,
    refundTxs,
    bookingCurrency: booking.currency,
  });

  return {
    id: booking.id,
    spaceId: booking.space_id,
    spaceName: booking.space_name,
    areaId: booking.area_id,
    areaName: booking.area_name,
    bookingHours: normalizeNumeric(booking.booking_hours) ?? 0,
    startAt: booking.start_at.toISOString(),
    guestCount: booking.guest_count,
    priceMinor: booking.price_minor?.toString() ?? null,
    currency: booking.currency,
    status: booking.status,
    createdAt: booking.created_at.toISOString(),
    paymentCaptured: hasCapturedPayment(paymentSummary),
    paymentMethod: paymentTx?.provider ?? null,
    refundSummary,
    reviewState,
    latestStatusTitle: statusNotifications.at(-1)?.title ?? null,
    isLive: paymentTx?.is_live ?? null,
    timeline,
  };
}

import { NextResponse } from 'next/server';

import { countActiveBookingsOverlap } from '@/lib/bookings/occupancy';
import { mapBookingRowToRecord } from '@/lib/bookings/serializer';
import { hasValidCronSecret } from '@/lib/cron-auth';
import { notifyBookingEvent } from '@/lib/notifications/booking';
import { prisma } from '@/lib/prisma';

const CRON_SECRET = process.env.CRON_SECRET;
const TEN_MINUTES_MS = 10 * 60 * 1000;
const THIRTY_MINUTES_MS = 30 * 60 * 1000;
const START_WINDOW_MS = 15 * 60 * 1000;

const unauthorizedResponse = NextResponse.json(
  { message: 'Unauthorized', },
  { status: 401, }
);

async function createConfirmationNotifications(bookingId: string) {
  const bookingRow = await prisma.booking.findUnique({ where: { id: bookingId, }, });
  if (!bookingRow) return;

  const booking = mapBookingRowToRecord(bookingRow);
  const bookingHref = `/marketplace/${booking.spaceId}`;

  const existingConfirmation = await prisma.app_notification.findFirst({
    where: {
      booking_id: booking.id,
      type: 'booking_confirmed',
    },
    select: { id: true, },
  });

  if (!existingConfirmation) {
    await prisma.app_notification.create({
      data: {
        user_auth_id: booking.customerAuthId,
        title: 'Booking confirmed',
        body: `${booking.areaName} at ${booking.spaceName} is confirmed.`,
        href: bookingHref,
        type: 'booking_confirmed',
        booking_id: booking.id,
        space_id: booking.spaceId,
        area_id: booking.areaId,
      },
    });

    if (booking.partnerAuthId) {
      await prisma.app_notification.create({
        data: {
          user_auth_id: booking.partnerAuthId,
          title: 'New booking received',
          body: `${booking.areaName} in ${booking.spaceName} was just booked.`,
          href: bookingHref,
          type: 'booking_received',
          booking_id: booking.id,
          space_id: booking.spaceId,
          area_id: booking.areaId,
        },
      });
    }
  }
}

export async function GET(request: Request) {
  if (!hasValidCronSecret(request, CRON_SECRET)) {
    return unauthorizedResponse;
  }

  const now = Date.now();
  const stalePaidCutoff = new Date(now - TEN_MINUTES_MS);
  const staleUnpaidCutoff = new Date(now - THIRTY_MINUTES_MS);
  const nearStart = new Date(now + START_WINDOW_MS);

  let autoConfirmed = 0;
  let expired = 0;
  let capacityWarnings = 0;

  // Auto-confirm paid bookings that are still pending.
  // Skip bookings that were flagged for host approval — those have a
  // "Booking needs approval" notification and should remain pending.
  const paidPending = await prisma.booking.findMany({
    where: {
      status: 'pending',
      created_at: { lt: stalePaidCutoff, },
      payment_transaction: { some: {}, },
    },
  });

  for (const row of paidPending) {
    // Respect requiresHostApproval: if the webhook flagged this booking
    // for manual review, a "Booking needs approval" notification exists.
    const hostApprovalNotice = await prisma.app_notification.findFirst({
      where: {
        booking_id: row.id,
        title: 'Booking needs approval',
      },
      select: { id: true, },
    });

    if (hostApprovalNotice) {
      continue; // requires manual partner approval, don't auto-confirm
    }

    const areaMaxCap = row.area_max_capacity === null ? null : Number(row.area_max_capacity);
    if (areaMaxCap !== null && !Number.isFinite(areaMaxCap)) {
      continue;
    }

    const activeCount = await countActiveBookingsOverlap(
      prisma,
      row.area_id,
      row.start_at,
      row.expires_at,
      row.id
    );

    const projected = activeCount + row.guest_count;
    if (areaMaxCap !== null && projected > areaMaxCap) {
      continue; // leave pending for manual review
    }

    await prisma.booking.update({
      where: { id: row.id, },
      data: { status: 'confirmed', },
    });
    await createConfirmationNotifications(row.id);
    autoConfirmed += 1;
  }

  // Warn about capacity conflicts close to start time
  const nearStartPending = await prisma.booking.findMany({
    where: {
      status: 'pending',
      start_at: {
        lte: nearStart,
        gte: new Date(now),
      },
      payment_transaction: { some: {}, },
    },
  });

  for (const row of nearStartPending) {
    const maxCap = row.area_max_capacity === null ? null : Number(row.area_max_capacity);
    if (maxCap === null || !Number.isFinite(maxCap)) continue;

    const activeCount = await countActiveBookingsOverlap(
      prisma,
      row.area_id,
      row.start_at,
      row.expires_at,
      row.id
    );
    const projected = activeCount + row.guest_count;
    if (projected <= maxCap) continue;

    const booking = mapBookingRowToRecord(row);
    const bookingHref = `/marketplace/${booking.spaceId}`;

    const existing = await prisma.app_notification.findFirst({
      where: {
        booking_id: booking.id,
        type: 'system',
        title: 'Booking capacity warning',
      },
      select: { id: true, },
    });

    if (!existing) {
      await prisma.app_notification.create({
        data: {
          user_auth_id: booking.customerAuthId,
          title: 'Booking capacity warning',
          body: `${booking.areaName} at ${booking.spaceName} may be over capacity. Please contact the host.`,
          href: bookingHref,
          type: 'system',
          booking_id: booking.id,
          space_id: booking.spaceId,
          area_id: booking.areaId,
        },
      });

      if (booking.partnerAuthId) {
        await prisma.app_notification.create({
          data: {
            user_auth_id: booking.partnerAuthId,
            title: 'Capacity conflict to review',
            body: `${booking.areaName} in ${booking.spaceName} exceeds capacity within 15 minutes. Approve, adjust, or refund.`,
            href: bookingHref,
            type: 'system',
            booking_id: booking.id,
            space_id: booking.spaceId,
            area_id: booking.areaId,
          },
        });
      }

      capacityWarnings += 1;
    }
  }

  // Expire stale unpaid or past-start pending bookings
  const expireFilter = {
    status: 'pending' as const,
    OR: [
      { start_at: { lt: new Date(), }, },
      {
        created_at: { lt: staleUnpaidCutoff, },
        payment_transaction: { none: {}, },
      }
    ],
  };

  const bookingsToExpire = await prisma.booking.findMany({ where: expireFilter, });

  const expireResult = await prisma.booking.updateMany({
    where: expireFilter,
    data: { status: 'expired', },
  });

  expired += expireResult.count;

  for (const row of bookingsToExpire) {
    const booking = mapBookingRowToRecord(row);
    try {
      await notifyBookingEvent(
        {
          bookingId: booking.id,
          spaceId: booking.spaceId,
          areaId: booking.areaId,
          spaceName: booking.spaceName,
          areaName: booking.areaName,
          customerAuthId: booking.customerAuthId,
          partnerAuthId: booking.partnerAuthId,
        },
        {
 title: 'Booking expired',
body: `Your booking at ${booking.areaName} · ${booking.spaceName} has expired.`, 
},
        null
      );
    } catch (notifError) {
      console.error('Failed to create expiration notification', {
 bookingId: booking.id,
error: notifError, 
});
    }
  }

  return NextResponse.json({
    data: {
      autoConfirmed,
      expired,
      capacityWarnings,
      checked: { paidPending: paidPending.length, },
    },
  });
}

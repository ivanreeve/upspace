import { NextResponse } from 'next/server';

import { countActiveBookingsOverlap } from '@/lib/bookings/occupancy';
import { mapBookingRowToRecord } from '@/lib/bookings/serializer';
import { prisma } from '@/lib/prisma';

const CRON_SECRET = process.env.CRON_SECRET;
const TEN_MINUTES_MS = 10 * 60 * 1000;
const THIRTY_MINUTES_MS = 30 * 60 * 1000;

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
  if (CRON_SECRET) {
    const provided = request.headers.get('x-cron-secret');
    if (provided !== CRON_SECRET) {
      return unauthorizedResponse;
    }
  }

  const now = Date.now();
  const stalePaidCutoff = new Date(now - TEN_MINUTES_MS);
  const staleUnpaidCutoff = new Date(now - THIRTY_MINUTES_MS);

  let autoConfirmed = 0;
  let expired = 0;

  // Auto-confirm paid bookings that are still pending
  const paidPending = await prisma.booking.findMany({
    where: {
      status: 'pending',
      created_at: { lt: stalePaidCutoff, },
      transaction: { some: {}, },
    },
  });

  for (const row of paidPending) {
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

  // Expire stale unpaid or past-start pending bookings
  const expireResult = await prisma.booking.updateMany({
    where: {
      status: 'pending',
      OR: [
        { start_at: { lt: new Date(), }, },
        {
          created_at: { lt: staleUnpaidCutoff, },
          transaction: { none: {}, },
        }
      ],
    },
    data: { status: 'expired', },
  });

  expired += expireResult.count;

  return NextResponse.json({
    data: {
      autoConfirmed,
      expired,
      checked: { paidPending: paidPending.length, },
    },
  });
}

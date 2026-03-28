import { countActiveBookingsOverlap } from '@/lib/bookings/occupancy';
import { mapBookingRowToRecord } from '@/lib/bookings/serializer';
import { notifyBookingEvent } from '@/lib/notifications/booking';
import { prisma } from '@/lib/prisma';

const THIRTY_MINUTES_MS = 30 * 60 * 1000;
const START_WINDOW_MS = 15 * 60 * 1000;

/**
 * Expire stale pending bookings on-demand.
 *
 * Targets two categories:
 * 1. Unpaid bookings older than 30 minutes
 * 2. Pending bookings whose start time has already passed
 *
 * This replaces the cron-based expiration with a lazy check that runs
 * when bookings are queried for display.
 */
export async function expireStaleBookings() {
  const now = new Date();
  const staleUnpaidCutoff = new Date(now.getTime() - THIRTY_MINUTES_MS);

  const expireFilter = {
    status: 'pending' as const,
    OR: [
      { start_at: { lt: now, }, },
      {
        created_at: { lt: staleUnpaidCutoff, },
        payment_transaction: { none: {}, },
      }
    ],
  };

  const bookingsToExpire = await prisma.booking.findMany({ where: expireFilter, });

  if (bookingsToExpire.length === 0) {
    return;
  }

  await prisma.booking.updateMany({
    where: expireFilter,
    data: { status: 'expired', },
  });

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
}

/**
 * Warn about capacity conflicts for paid pending bookings near their start time.
 *
 * Checks bookings starting within 15 minutes that are still pending and have
 * payments, then creates notifications if capacity would be exceeded.
 */
export async function warnCapacityConflicts() {
  const now = Date.now();
  const nearStart = new Date(now + START_WINDOW_MS);

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
          title: 'Booking capacity warning',
          body: `${booking.areaName} at ${booking.spaceName} may be over capacity. Please contact the host.`,
        },
        {
          title: 'Capacity conflict to review',
          body: `${booking.areaName} in ${booking.spaceName} exceeds capacity within 15 minutes. Approve, adjust, or refund.`,
        }
      );
    } catch (notifError) {
      console.error('Failed to create capacity warning notification', {
        bookingId: booking.id,
        error: notifError,
      });
    }
  }
}

/**
 * Run all lazy booking lifecycle checks.
 *
 * Call this before returning booking list results to ensure stale bookings
 * are expired and capacity warnings are issued.
 */
export async function runBookingLifecycleChecks() {
  const results = await Promise.allSettled([
    expireStaleBookings(),
    warnCapacityConflicts()
  ]);

  results.forEach((result, index) => {
    if (result.status === 'fulfilled') {
      return;
    }

    const step = index === 0 ? 'expireStaleBookings' : 'warnCapacityConflicts';
    console.error('Booking lifecycle check failed', {
      step,
      error: result.reason,
    });
  });
}

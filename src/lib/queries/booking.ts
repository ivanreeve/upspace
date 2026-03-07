import { mapBookingsWithProfiles, type BookingRow } from '@/lib/bookings/serializer';
import type { BookingRecord } from '@/lib/bookings/types';
import { prisma } from '@/lib/prisma';

const DEFAULT_LIMIT = 50;
const TEN_MINUTES_MS = 10 * 60 * 1000;

export async function getCustomerBookings(
  authUserId: string
): Promise<BookingRecord[]> {
  const rows = await prisma.booking.findMany({
    where: { user_auth_id: authUserId, },
    orderBy: { created_at: 'desc', },
    take: DEFAULT_LIMIT,
  });

  return mapBookingsWithProfiles(rows as BookingRow[]);
}

export async function getPartnerBookings(
  authUserId: string
): Promise<BookingRecord[]> {
  const rows = await prisma.booking.findMany({
    where: { partner_auth_id: authUserId, },
    orderBy: { created_at: 'desc', },
    take: DEFAULT_LIMIT,
  });

  return mapBookingsWithProfiles(rows as BookingRow[]);
}

export type StuckBookingsSummary = {
  pendingPaid: number;
};

export async function getPartnerStuckBookingsSummary(
  authUserId: string
): Promise<StuckBookingsSummary> {
  const cutoff = new Date(Date.now() - TEN_MINUTES_MS);

  const count = await prisma.booking.count({
    where: {
      partner_auth_id: authUserId,
      status: 'pending',
      created_at: { lt: cutoff, },
      payment_transaction: { some: {}, },
    },
  });

  return { pendingPaid: count, };
}

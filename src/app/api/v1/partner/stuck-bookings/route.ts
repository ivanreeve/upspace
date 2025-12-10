import { NextResponse } from 'next/server';

import { mapBookingsWithProfiles, type BookingRow } from '@/lib/bookings/serializer';
import { PartnerSessionError, requirePartnerSession } from '@/lib/auth/require-partner-session';
import { prisma } from '@/lib/prisma';

const TEN_MINUTES_MS = 10 * 60 * 1000;

export async function GET() {
  try {
    const { authUserId, } = await requirePartnerSession();
    const cutoff = new Date(Date.now() - TEN_MINUTES_MS);

    const rows = await prisma.booking.findMany({
      where: {
        partner_auth_id: authUserId,
        status: 'pending',
        created_at: { lt: cutoff, },
        transaction: { some: {}, },
      },
      orderBy: { created_at: 'desc', },
      take: 25,
    });

    const bookings = await mapBookingsWithProfiles(rows as BookingRow[]);

    return NextResponse.json({ data: { pendingPaid: bookings.length, }, });
  } catch (error) {
    if (error instanceof PartnerSessionError) {
      return NextResponse.json({ error: error.message, }, { status: error.status, });
    }

    return NextResponse.json({ error: 'Unable to load stuck bookings.', }, { status: 500, });
  }
}

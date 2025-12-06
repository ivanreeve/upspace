import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { mapBookingsWithProfiles, type BookingRow } from '@/lib/bookings/serializer';
import { PartnerSessionError, requirePartnerSession } from '@/lib/auth/require-partner-session';
import { prisma } from '@/lib/prisma';
import type { DashboardFeedItem } from '@/types/dashboard-feed';

const querySchema = z.object({ limit: z.coerce.number().min(5).max(50).default(25), });

export async function GET(req: NextRequest) {
  try {
    const { authUserId, } = await requirePartnerSession();
    const searchParams = Object.fromEntries(new URL(req.url).searchParams.entries());
    const { limit, } = querySchema.parse(searchParams);

    const notificationTake = Math.max(Math.ceil(limit / 2), 10);

    const [bookingRows, notificationRows] = await Promise.all([
      prisma.booking.findMany({
        where: { partner_auth_id: authUserId, },
        orderBy: { created_at: 'desc', },
        take: limit,
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
      }),
      prisma.app_notification.findMany({
        where: { user_auth_id: authUserId, },
        orderBy: { created_at: 'desc', },
        take: notificationTake,
        select: {
          id: true,
          user_auth_id: true,
          title: true,
          body: true,
          href: true,
          type: true,
          created_at: true,
          read_at: true,
          booking_id: true,
          space_id: true,
          area_id: true,
        },
      })
    ]);

    const bookings = await mapBookingsWithProfiles(bookingRows as BookingRow[]);

    const bookingFeed: DashboardFeedItem[] = bookings.map((booking) => ({
      id: booking.id,
      type: 'booking',
      createdAt: booking.createdAt,
      title: booking.customerName
        ? `${ booking.customerName } booked ${ booking.areaName }`
        : `New booking for ${ booking.areaName }`,
      body: `${ booking.spaceName } · ${ booking.bookingHours }h`,
      href: '/spaces/bookings',
      status: booking.status,
      spaceId: booking.spaceId,
      spaceName: booking.spaceName,
      areaId: booking.areaId,
      areaName: booking.areaName,
      price: booking.price,
      bookingHours: booking.bookingHours,
      customerName: booking.customerName,
      customerHandle: booking.customerHandle,
    }));

    const notificationFeed: DashboardFeedItem[] = notificationRows.map((row) => ({
      id: row.id,
      type: 'notification',
      createdAt: row.created_at.toISOString(),
      title: row.title,
      body: row.body,
      href: row.href,
      notificationType: row.type,
      read: Boolean(row.read_at),
      bookingId: row.booking_id,
      spaceId: row.space_id,
      areaId: row.area_id,
    }));

    const mergedFeed = [...bookingFeed, ...notificationFeed]
      .sort(
        (first, second) =>
          new Date(second.createdAt).getTime() - new Date(first.createdAt).getTime()
      )
      .slice(0, limit);

    return NextResponse.json({ data: mergedFeed, });
  } catch (error) {
    if (error instanceof PartnerSessionError) {
      return NextResponse.json({ error: error.message, }, { status: error.status, });
    }

    console.error('Failed to build partner dashboard feed', error);
    return NextResponse.json(
      { error: 'Unable to load dashboard feed.', },
      { status: 500, }
    );
  }
}

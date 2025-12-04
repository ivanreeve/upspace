import { randomUUID } from 'crypto';

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { sendBookingNotificationEmail } from '@/lib/email';
import type { BookingRecord } from '@/lib/bookings/types';
import { prisma } from '@/lib/prisma';
import { createSupabaseServerClient } from '@/lib/supabase/server';

const createBookingSchema = z.object({
  spaceId: z.string().uuid(),
  areaId: z.string().uuid(),
  bookingHours: z.number().int().min(1).max(24),
  price: z.number().nonnegative().nullable().optional(),
});

const unauthorizedResponse = NextResponse.json(
  { error: 'Authentication required.', },
  { status: 401, }
);

const forbiddenResponse = NextResponse.json(
  { error: 'Insufficient permissions.', },
  { status: 403, }
);

const invalidPayloadResponse = NextResponse.json(
  { error: 'Invalid request payload.', },
  { status: 400, }
);

const notFoundResponse = NextResponse.json(
  { error: 'Area not found for this space.', },
  { status: 404, }
);

function normalizeCapacity(value: bigint | number | null | undefined): number | null {
  if (value === null || typeof value === 'undefined') {
    return null;
  }
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

const BOOKING_PRICE_MINOR_FACTOR = 100;

const mapBookingRecord = (row: {
  id: string;
  space_id: string;
  space_name: string;
  area_id: string;
  area_name: string;
  booking_hours: number;
  price_minor: number | null;
  currency: string;
  status: BookingRecord['status'];
  created_at: Date;
  user_auth_id: string;
  partner_auth_id: string | null;
  area_min_capacity: number;
  area_max_capacity: number | null;
}): BookingRecord => ({
  id: row.id,
  spaceId: row.space_id,
  spaceName: row.space_name,
  areaId: row.area_id,
  areaName: row.area_name,
  bookingHours: row.booking_hours,
  price: typeof row.price_minor === 'number' ? row.price_minor / BOOKING_PRICE_MINOR_FACTOR : null,
  status: row.status,
  createdAt: row.created_at.toISOString(),
  customerAuthId: row.user_auth_id,
  partnerAuthId: row.partner_auth_id,
  areaMaxCapacity: row.area_max_capacity,
  areaMinCapacity: row.area_min_capacity,
});

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const {
    data: authData,
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !authData?.user) {
    return unauthorizedResponse;
  }

  const dbUser = await prisma.user.findFirst({
    where: { auth_user_id: authData.user.id, },
    select: {
      role: true,
      auth_user_id: true,
    },
  });

  if (!dbUser) {
    return forbiddenResponse;
  }

  const filters = (() => {
    if (dbUser.role === 'partner') {
      return { partner_auth_id: authData.user.id, } as const;
    }
    if (dbUser.role === 'admin') {
      return {} as const;
    }
    return { user_auth_id: authData.user.id, } as const;
  })();

  const rows = await prisma.booking.findMany({
    where: filters,
    orderBy: { created_at: 'desc', },
  });

  const bookings = rows.map(mapBookingRecord);
  return NextResponse.json({ data: bookings, });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = createBookingSchema.safeParse(body ?? {});

  if (!parsed.success) {
    return invalidPayloadResponse;
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: authData,
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !authData?.user) {
    return unauthorizedResponse;
  }

  const dbUser = await prisma.user.findFirst({
    where: { auth_user_id: authData.user.id, },
    select: {
      role: true,
      handle: true,
      first_name: true,
      last_name: true,
    },
  });

  if (!dbUser) {
    return forbiddenResponse;
  }

  if (dbUser.role !== 'customer') {
    return NextResponse.json(
      { error: 'Only customers can create bookings.', },
      { status: 403, }
    );
  }

  const area = await prisma.area.findUnique({
    where: { id: parsed.data.areaId, },
    select: {
      id: true,
      name: true,
      min_capacity: true,
      max_capacity: true,
      space_id: true,
      space: {
        select: {
          id: true,
          name: true,
          user: {
            select: {
              auth_user_id: true,
              first_name: true,
              last_name: true,
              handle: true,
            },
          },
        },
      },
    },
  });

  if (!area || area.space_id !== parsed.data.spaceId || !area.space) {
    return notFoundResponse;
  }

  const partnerAuthId = area.space.user?.auth_user_id ?? null;
  const areaMaxCapacity = normalizeCapacity(area.max_capacity);
  const areaMinCapacity = normalizeCapacity(area.min_capacity) ?? 1;
  const priceMinor =
    typeof parsed.data.price === 'number'
      ? Math.round(parsed.data.price * BOOKING_PRICE_MINOR_FACTOR)
      : null;

  const bookingRow = await prisma.booking.create({
    data: {
      id: randomUUID(),
      space_id: parsed.data.spaceId,
      space_name: area.space.name,
      area_id: area.id,
      area_name: area.name,
      booking_hours: parsed.data.bookingHours,
      price_minor: priceMinor,
      currency: 'PHP',
      status: 'confirmed',
      user_auth_id: authData.user.id,
      partner_auth_id: partnerAuthId,
      area_max_capacity: areaMaxCapacity,
      area_min_capacity: areaMinCapacity,
    },
  });

  const booking = mapBookingRecord(bookingRow);
  const bookingHref = `/marketplace/${booking.spaceId}`;

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

  if (authData.user.email) {
    try {
      await sendBookingNotificationEmail({
        to: authData.user.email,
        spaceName: booking.spaceName,
        areaName: booking.areaName,
        bookingHours: booking.bookingHours,
        price: booking.price,
        link: `${process.env.NEXT_PUBLIC_APP_URL ?? ''}${bookingHref}`,
      });
    } catch (error) {
      console.error('Failed to send booking email notification', error);
    }
  }

  return NextResponse.json({ data: booking, }, { status: 201, });
}

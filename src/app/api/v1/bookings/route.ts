import { randomUUID } from 'crypto';

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { sendBookingNotificationEmail } from '@/lib/email';
import type { BookingRecord, BookingStatus } from '@/lib/bookings/types';
import { prisma } from '@/lib/prisma';
import { createSupabaseServerClient } from '@/lib/supabase/server';

const createBookingSchema = z.object({
  spaceId: z.string().uuid(),
  areaId: z.string().uuid(),
  bookingHours: z.number().int().min(1).max(24),
  price: z.number().nonnegative().nullable().optional(),
});

const bulkUpdateSchema = z.object({
  ids: z.array(z.string().uuid()).min(1),
  status: z.enum([
    'confirmed',
    'pending',
    'cancelled',
    'rejected',
    'expired',
    'checkedin',
    'checkedout',
    'completed',
    'noshow',
  ] satisfies readonly BookingStatus[]),
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

function normalizeNumeric(value: bigint | number | null | undefined): number | null {
  if (value === null || typeof value === 'undefined') {
    return null;
  }
  const numeric = typeof value === 'bigint' ? Number(value) : value;
  return Number.isFinite(numeric) ? numeric : null;
}

const BOOKING_PRICE_MINOR_FACTOR = 100;

const mapBookingRecord = (row: {
  id: string;
  space_id: string;
  space_name: string;
  area_id: string;
  area_name: string;
  booking_hours: bigint | number;
  price_minor: bigint | number | null;
  currency: string;
  status: BookingRecord['status'];
  created_at: Date;
  user_auth_id: string;
  partner_auth_id: string | null;
  area_max_capacity: bigint | number | null;
}): BookingRecord => ({
  id: row.id,
  spaceId: row.space_id,
  spaceName: row.space_name,
  areaId: row.area_id,
  areaName: row.area_name,
  bookingHours: normalizeNumeric(row.booking_hours) ?? 0,
  price: (() => {
    const priceMinor = normalizeNumeric(row.price_minor);
    return typeof priceMinor === 'number' ? priceMinor / BOOKING_PRICE_MINOR_FACTOR : null;
  })(),
  status: row.status,
  createdAt: row.created_at.toISOString(),
  customerAuthId: row.user_auth_id,
  partnerAuthId: row.partner_auth_id,
  areaMaxCapacity: normalizeNumeric(row.area_max_capacity),
});

type BookingRow = Parameters<typeof mapBookingRecord>[0];

const formatFullName = (values: { first_name: string | null; last_name: string | null } | undefined) => {
  const name = [values?.first_name, values?.last_name].filter(Boolean).join(' ').trim();
  return name.length > 0 ? name : null;
};

async function mapBookingsWithProfiles(rows: BookingRow[]): Promise<BookingRecord[]> {
  if (rows.length === 0) {
    return [];
  }

  const baseBookings = rows.map(mapBookingRecord);
  const customerAuthIds = Array.from(new Set(rows.map((row) => row.user_auth_id)));

  const customers = customerAuthIds.length
    ? await prisma.user.findMany({
        where: { auth_user_id: { in: customerAuthIds }, },
        select: {
          auth_user_id: true,
          first_name: true,
          last_name: true,
          handle: true,
        },
      })
    : [];

  const customerLookup = new Map(
    customers.map((customer) => [customer.auth_user_id, customer])
  );

  return baseBookings.map((booking) => {
    const profile = customerLookup.get(booking.customerAuthId);
    return {
      ...booking,
      customerHandle: profile?.handle ?? null,
      customerName: formatFullName(profile),
    };
  });
}

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

  const bookings = await mapBookingsWithProfiles(rows);
  return NextResponse.json({ data: bookings, });
}

export async function PATCH(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = bulkUpdateSchema.safeParse(body ?? {});

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
    },
  });

  if (!dbUser || (dbUser.role !== 'partner' && dbUser.role !== 'admin')) {
    return forbiddenResponse;
  }

  const partnerFilter =
    dbUser.role === 'partner'
      ? { partner_auth_id: authData.user.id, }
      : {};

  const rows = await prisma.booking.findMany({
    where: {
      id: { in: parsed.data.ids, },
      ...partnerFilter,
    },
  });

  if (!rows.length) {
    return NextResponse.json(
      { error: 'No bookings found to update.', },
      { status: 404, }
    );
  }

  const targetIds = rows.map((row) => row.id);

  await prisma.booking.updateMany({
    where: {
      id: { in: targetIds, },
      ...partnerFilter,
    },
    data: { status: parsed.data.status, },
  });

  const updatedRows = await prisma.booking.findMany({
    where: {
      id: { in: targetIds, },
      ...partnerFilter,
    },
    orderBy: { created_at: 'desc', },
  });

  const bookings = await mapBookingsWithProfiles(updatedRows);
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
  const areaMaxCapacity = normalizeNumeric(area.max_capacity);
  const priceMinor =
    typeof parsed.data.price === 'number'
      ? Math.round(parsed.data.price * BOOKING_PRICE_MINOR_FACTOR)
      : null;

  const bookingExpiresAt = new Date(
    Date.now() + parsed.data.bookingHours * 60 * 60 * 1000
  );

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
      expires_at: bookingExpiresAt,
    },
  });

  const booking = {
    ...mapBookingRecord(bookingRow),
    customerHandle: dbUser.handle ?? null,
    customerName: formatFullName({
      first_name: dbUser.first_name ?? null,
      last_name: dbUser.last_name ?? null,
    }),
  };
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

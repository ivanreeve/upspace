import { createHash, randomUUID } from 'crypto';

import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import type { user as PrismaUser } from '@prisma/client';
import { z } from 'zod';

import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';
import type { BookingArea } from '@/components/pages/Booking/booking-utils';
import { resolveRatePricing } from '@/components/pages/Booking/booking-utils';

const payloadSchema = z.object({
  areaId: z.string().regex(/^\d+$/),
  reservationDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  stayHours: z.coerce.number().int().min(1).max(24),
  guests: z.coerce.number().int().min(1).max(200),
  arrivalTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  paymentMethod: z.enum(['paymongo']),
  amount: z.coerce.number().min(0).optional(),
});

const AUTH_REQUIRED = 'BOOKING_AUTH_REQUIRED';
const PROFILE_REQUIRED = 'BOOKING_PROFILE_REQUIRED';
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type ResolvedCustomer = {
  record: PrismaUser;
  email: string;
  displayName: string;
};

export async function POST(
  req: NextRequest,
  { params, }: { params: { space_id: string } }
) {
  if (!/^\d+$/.test(params.space_id)) {
    return NextResponse.json({ error: 'Invalid space id', }, { status: 400, });
  }

  let body: z.infer<typeof payloadSchema>;
  try {
    const json = await req.json();
    const parsed = payloadSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten(), },
        { status: 400, }
      );
    }
    body = parsed.data;
  } catch (error) {
    return NextResponse.json(
      {
        error: 'Invalid JSON payload',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 400, }
    );
  }

  try {
    const spaceId = BigInt(params.space_id);
    const areaId = BigInt(body.areaId);
    const reservationDate = new Date(`${body.reservationDate}T00:00:00.000Z`);

    const area = await prisma.area.findFirst({
      where: {
        area_id: areaId,
        space_id: spaceId,
      },
      include: {
        price_rate: true,
        space: true,
      },
    });

    if (!area) {
      return NextResponse.json(
        { error: `Area ${body.areaId} not found for space ${params.space_id}`, },
        { status: 404, }
      );
    }

    const minCapacity =
      area.min_capacity != null ? Math.max(1, Number(area.min_capacity)) : 1;
    const maxCapacity =
      area.max_capacity != null
        ? Math.max(minCapacity, Number(area.max_capacity))
        : null;

    if (body.guests < minCapacity || (maxCapacity != null && body.guests > maxCapacity)) {
      const message =
        maxCapacity != null
          ? `Guest count must be between ${minCapacity} and ${maxCapacity}.`
          : `Guest count must be at least ${minCapacity}.`;
      return NextResponse.json({ error: message, }, { status: 422, });
    }

    const areaForPricing: BookingArea = {
      id: area.area_id.toString(),
      name: area.name,
      capacity: Number(
        area.capacity ??
          area.max_capacity ??
          area.min_capacity ??
          0
      ),
      minCapacity: area.min_capacity != null ? Number(area.min_capacity) : null,
      maxCapacity: area.max_capacity != null ? Number(area.max_capacity) : null,
      rates: area.price_rate.map((rate) => ({
        id: rate.rate_id.toString(),
        timeUnit: rate.time_unit,
        price: decimalToString(rate.price),
      })),
    };

    const pricing = resolveRatePricing(areaForPricing, body.stayHours, body.guests);
    if (!Number.isFinite(pricing.total) || pricing.total <= 0) {
      return NextResponse.json(
        { error: 'Unable to determine pricing for the selected area. Please verify the rates and try again.', },
        { status: 422, }
      );
    }
    const totalAmount = new Prisma.Decimal(pricing.total.toFixed(2));
    const perGuestAmount =
      typeof pricing.perGuestRate === 'number'
        ? new Prisma.Decimal(pricing.perGuestRate.toFixed(2))
        : null;

    const clientAmount = typeof body.amount === 'number' ? body.amount : null;
    if (clientAmount != null && Math.abs(clientAmount - pricing.total) > 0.01) {
      console.warn('[BOOKING_AMOUNT_MISMATCH]', {
        clientAmount,
        computedTotal: pricing.total,
        spaceId: params.space_id,
        areaId: body.areaId,
      });
    }

    const customer = await resolveCustomer();

    const [hours, minutes] = body.arrivalTime
      .split(':')
      .map((value) => Number.parseInt(value, 10));
    const arrivalDate = new Date(reservationDate);
    arrivalDate.setUTCHours(hours, minutes, 0, 0);
    const stayHoursMs = body.stayHours * 60 * 60 * 1000;
    const checkoutDate = new Date(arrivalDate.getTime() + stayHoursMs);

    const now = new Date();
    const expires = new Date(now.getTime() + 30 * 60 * 1000);

    const booking = await prisma.booking.create({
      data: {
        user_id: customer.record.user_id,
        space_id: spaceId,
        area_id: areaId,
        expires_at: expires,
        arrival_time: arrivalDate,
        from: arrivalDate,
        to: checkoutDate,
        guest_count: BigInt(body.guests),
        booking_type: 'request',
        status_code: 'pending',
      },
    });

    const reservationDateIso = reservationDate.toISOString();

    const response = {
      booking: {
        booking_id: booking.booking_id.toString(),
        user_id: booking.user_id.toString(),
        space_id: booking.space_id.toString(),
        area_id: booking.area_id.toString(),
        expires_at: booking.expires_at.toISOString(),
        arrival_time: booking.arrival_time?.toISOString() ?? null,
        from: booking.from?.toISOString() ?? null,
        to: booking.to?.toISOString() ?? null,
        guest_count: booking.guest_count.toString(),
        booking_type: booking.booking_type,
        status_code: booking.status_code,
        created_at: booking.created_at.toISOString(),
        updated_at: booking.updated_at?.toISOString() ?? null,
        idempotency_key: booking.idempotency_key.toString(),
        reservation_date: reservationDateIso,
        total_amount: totalAmount.toString(),
        payment_method: body.paymentMethod,
        duration_hours: body.stayHours,
        pricing: {
          total: totalAmount.toString(),
          perGuest: perGuestAmount?.toString() ?? null,
          label: pricing.label ?? null,
          usesHourlyMultiplier: pricing.usesHourlyMultiplier,
        },
        area: {
          name: area.name,
          rate: area.price_rate.map((rate) => ({
            rate_id: rate.rate_id.toString(),
            time_unit: rate.time_unit,
            price: decimalToString(rate.price),
          })),
        },
        space: {
          name: area.space.name,
          city: area.space.city,
          region: area.space.region,
          country: area.space.country,
        },
        user: {
          name: customer.displayName || customer.email || '',
          email: customer.email,
          handle: customer.record.handle,
        },
      },
      summary: {
        invoiceNumber: `BOOK-${booking.booking_id.toString()}`,
        idempotencyKey: booking.idempotency_key.toString(),
        totalAmount: totalAmount.toString(),
        paymentMethod: body.paymentMethod,
        status: booking.status_code,
        pricingLabel: pricing.label ?? null,
        perGuestAmount: perGuestAmount?.toString() ?? null,
      },
    };

    return NextResponse.json(response, { status: 201, });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === AUTH_REQUIRED) {
        return NextResponse.json(
          { error: 'Please sign in before placing a booking.', },
          { status: 401, }
        );
      }
      if (error.message === PROFILE_REQUIRED) {
        return NextResponse.json(
          { error: 'Only verified accounts can place bookings.', },
          { status: 403, }
        );
      }
    }
    console.error('[BOOKING_POST_ERROR]', error);
    return NextResponse.json(
      {
        error: 'Failed to create booking',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500, }
    );
  }
}

function decimalToString(value: unknown): string {
  if (value == null) return '0';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'bigint') {
    return value.toString();
  }
  if (Prisma.Decimal.isDecimal?.(value)) {
    return (value as Prisma.Decimal).toString();
  }
  if (typeof (value as { toString?: () => string }).toString === 'function') {
    return (value as { toString: () => string }).toString();
  }
  return '0';
}

async function resolveCustomer(): Promise<ResolvedCustomer> {
  const session = await auth();
  const fallbackEmail =
    process.env.BOOKING_TEST_USER_EMAIL ?? 'partner@upspace.app';
  const allowDevFallback = process.env.NODE_ENV !== 'production';

  const candidateEmail =
    session?.user?.email?.trim() ??
    (allowDevFallback ? fallbackEmail : undefined);

  if (!candidateEmail) {
    throw new Error(AUTH_REQUIRED);
  }

  const normalizedEmail = candidateEmail.toLowerCase();
  const displayName = session?.user?.name?.trim() ?? normalizedEmail;

  const rawAuthIdentifier =
    session?.user?.id ??
    session?.user?.sub ??
    normalizedEmail;

  const authUserId =
    rawAuthIdentifier && isUuid(rawAuthIdentifier)
      ? rawAuthIdentifier
      : deterministicAuthId(rawAuthIdentifier ?? normalizedEmail);

  const emailHandleBase = normalizeHandle(
    normalizedEmail.replace(/[^a-z0-9]+/g, '-')
  );
  const nameHandleBase = session?.user?.name?.trim()
    ? normalizeHandle(session.user.name)
    : null;
  const handleCandidates = [emailHandleBase, nameHandleBase].filter((value): value is string => Boolean(value));

  const whereClauses: Prisma.userWhereInput[] = [{ auth_user_id: authUserId, }];
  for (const handle of handleCandidates) {
    whereClauses.push({ handle, });
  }

  let customerRecord: PrismaUser | null = null;
  customerRecord = await prisma.user.findFirst({ where: { OR: whereClauses, }, });

  if (!customerRecord) {
    const preferredHandle = emailHandleBase ?? nameHandleBase ?? 'guest';
    const uniqueHandle = await ensureUniqueHandle(preferredHandle);
    const {
      firstName,
      lastName,
    } = splitName(displayName);

    customerRecord = await prisma.user.create({
      data: {
        handle: uniqueHandle,
        auth_user_id: authUserId,
        first_name: firstName,
        last_name: lastName,
        is_onboard: true,
      },
    });
  }

  return {
    record: customerRecord,
    email: normalizedEmail,
    displayName,
  };
}

function normalizeHandle(raw: string) {
  const base = raw
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return base || 'guest';
}

async function ensureUniqueHandle(base: string) {
  const normalized = normalizeHandle(base);
  let candidate = normalized;
  let suffix = 1;

  while (suffix < 20) {
    const exists = await prisma.user.findUnique({
      where: { handle: candidate, },
      select: { user_id: true, },
    });
    if (!exists) return candidate;
    suffix += 1;
    candidate = `${normalized}-${suffix}`;
  }

  return `${normalized}-${randomUUID().slice(0, 8)}`;
}

function splitName(fullName: string | null | undefined) {
  if (!fullName) {
    return {
      firstName: null,
      lastName: null,
    };
  }
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 0) {
    return {
      firstName: null,
      lastName: null,
    };
  }
  const [first, ...rest] = parts;
  return {
    firstName: first || null,
    lastName: rest.length > 0 ? rest.join(' ') : null,
  };
}

function isUuid(value: string | null | undefined): value is string {
  if (!value) return false;
  return UUID_REGEX.test(value);
}

function deterministicAuthId(email: string) {
  const hash = createHash('sha256')
    .update(email.trim().toLowerCase())
    .digest('hex');
  const timeLow = hash.slice(0, 8);
  const timeMid = hash.slice(8, 12);
  let timeHighAndVersion = hash.slice(12, 16);
  let clockSeq = hash.slice(16, 20);
  const node = hash.slice(20, 32).padEnd(12, '0');

  // enforce UUID v4 format
  timeHighAndVersion = `4${timeHighAndVersion.slice(1)}`;
  const clockSeqVariant = (parseInt(clockSeq[0], 16) & 0x3) | 0x8;
  clockSeq = `${clockSeqVariant.toString(16)}${clockSeq.slice(1)}`;

  return `${timeLow}-${timeMid}-${timeHighAndVersion}-${clockSeq}-${node}`;
}

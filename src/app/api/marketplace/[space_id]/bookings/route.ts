import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
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
        rate: true,
        space: true,
      },
    });

    if (!area) {
      return NextResponse.json(
        { error: `Area ${body.areaId} not found for space ${params.space_id}`, },
        { status: 404, }
      );
    }

    const areaForPricing: BookingArea = {
      id: area.area_id.toString(),
      name: area.name,
      capacity: Number(area.capacity ?? 0),
      rates: area.rate.map((rate) => ({
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

    const now = new Date();
    const expires = new Date(now.getTime() + 30 * 60 * 1000);

    const stayHoursBigInt = BigInt(body.stayHours);

    const booking = await prisma.booking.create({
      data: {
        user_id: customer.user_id,
        space_id: spaceId,
        area_id: areaId,
        expires_at: expires,
        arrival_time: arrivalDate,
        stay_hours: stayHoursBigInt,
        num_guests: BigInt(body.guests),
        booked_at: now,
        booking_type: 'customer_reservation',
        status_code: 'pending',
        id_invoice: generateNumericIdentifier(now),
        created_at: now,
        updated_at: now,
        idempotency_key: generateNumericIdentifier(now, 6),
      },
    });

    const response = {
      booking: {
        booking_id: booking.booking_id.toString(),
        user_id: booking.user_id.toString(),
        space_id: booking.space_id.toString(),
        expires_at: booking.expires_at.toISOString(),
        arrival_time: booking.arrival_time.toISOString(),
        stay_hours: booking.stay_hours.toString(),
        num_guests: body.guests.toString(),
        booked_at: booking.booked_at.toISOString(),
        booking_type: booking.booking_type,
        status_code: booking.status_code,
        id_invoice: booking.id_invoice.toString(),
        created_at: booking.created_at.toISOString(),
        updated_at: booking.updated_at.toISOString(),
        idempotency_key: booking.idempotency_key.toString(),
        reservation_date: reservationDate.toISOString(),
        total_amount: totalAmount.toString(),
        payment_method: body.paymentMethod,
        pricing: {
          total: totalAmount.toString(),
          perGuest: perGuestAmount?.toString() ?? null,
          label: pricing.label ?? null,
          usesHourlyMultiplier: pricing.usesHourlyMultiplier,
        },
        area: {
          name: area.name,
          rate: area.rate.map((rate) => ({
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
          name: customer.name || customer.email || '',
          email: customer.email ?? '',
        },
      },
      summary: {
        invoiceNumber: `INV-${booking.id_invoice.toString()}`,
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

async function resolveCustomer() {
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

  const existing = await prisma.user.findFirst({
    where: {
      email: candidateEmail,
      provider: { not: 'guest', },
    },
  });

  if (existing) return existing;

  if (allowDevFallback && candidateEmail === fallbackEmail) {
    return prisma.user.create({
      data: {
        name: 'UpSpace Test Booker',
        email: candidateEmail,
        provider: 'email',
        provider_id: candidateEmail,
        birthday: new Date('1990-01-01'),
        role: 'customer',
      },
    });
  }

  throw new Error(PROFILE_REQUIRED);
}

function generateNumericIdentifier(baseDate: Date, extraOffset = 0) {
  const timestamp = baseDate.getTime();
  const random = Math.floor(Math.random() * 1000);
  const combined = timestamp * 1000 + random + extraOffset;
  return BigInt(combined);
}

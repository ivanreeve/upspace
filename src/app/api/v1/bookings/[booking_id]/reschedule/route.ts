import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { MAX_BOOKING_HOURS, MIN_BOOKING_HOURS } from '@/lib/bookings/constants';
import { countActiveBookingsOverlap } from '@/lib/bookings/occupancy';
import { normalizeNumeric, BOOKING_PRICE_MINOR_FACTOR } from '@/lib/bookings/serializer';
import { notifyBookingEvent } from '@/lib/notifications/booking';
import { prisma } from '@/lib/prisma';
import { evaluatePriceRule } from '@/lib/pricing-rules-evaluator';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import type { PriceRuleRecord } from '@/lib/pricing-rules';

const rescheduleSchema = z.object({
  startAt: z.string().datetime(),
  bookingHours: z.number().int().min(MIN_BOOKING_HOURS).max(MAX_BOOKING_HOURS),
});

const RESCHEDULABLE_STATUSES = ['confirmed', 'pending'];

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ booking_id: string }> }
) {
  try {
    const { booking_id, } = await context.params;
    const supabase = await createSupabaseServerClient();
    const {
      data: authData, error: authError,
    } = await supabase.auth.getUser();

    if (authError || !authData?.user) {
      return NextResponse.json({ error: 'Authentication required.', }, { status: 401, });
    }

    const user = await prisma.user.findFirst({
      where: { auth_user_id: authData.user.id, },
      select: { role: true, },
    });

    if (!user || user.role !== 'customer') {
      return NextResponse.json({ error: 'Insufficient permissions.', }, { status: 403, });
    }

    const body = await req.json().catch(() => null);
    const parsed = rescheduleSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid reschedule payload.', }, { status: 400, });
    }

    const newStartAt = new Date(parsed.data.startAt);
    if (!Number.isFinite(newStartAt.getTime()) || newStartAt.getTime() < Date.now()) {
      return NextResponse.json({ error: 'Start time must be in the future.', }, { status: 400, });
    }

    const booking = await prisma.booking.findUnique({
      where: { id: booking_id, },
      select: {
        id: true,
        space_id: true,
        space_name: true,
        area_id: true,
        area_name: true,
        booking_hours: true,
        start_at: true,
        guest_count: true,
        price_minor: true,
        currency: true,
        status: true,
        user_auth_id: true,
        partner_auth_id: true,
        area_max_capacity: true,
        price_rule_id: true,
        price_rule_snapshot: true,
        price_rule_overrides: true,
      },
    });

    if (!booking || booking.user_auth_id !== authData.user.id) {
      return NextResponse.json({ error: 'Booking not found.', }, { status: 404, });
    }

    if (!RESCHEDULABLE_STATUSES.includes(booking.status)) {
      return NextResponse.json(
        { error: 'Only confirmed or pending bookings can be rescheduled.', },
        { status: 400, }
      );
    }

    const newExpiresAt = new Date(newStartAt.getTime() + parsed.data.bookingHours * 60 * 60 * 1000);

    let newPriceMinor = booking.price_minor;

    if (booking.price_rule_snapshot) {
      const ruleDefinition = booking.price_rule_snapshot as PriceRuleRecord['definition'];
      try {
        const storedOverrides = (
          booking.price_rule_overrides !== null
          && typeof booking.price_rule_overrides === 'object'
          && !Array.isArray(booking.price_rule_overrides)
        ) ? booking.price_rule_overrides as Record<string, string | number> : {};

        const priceEvaluation = evaluatePriceRule(ruleDefinition, {
          bookingHours: parsed.data.bookingHours,
          now: newStartAt,
          variableOverrides: {
            ...storedOverrides,
            guest_count: booking.guest_count,
            ...(booking.area_max_capacity !== null ? { area_max_capacity: Number(booking.area_max_capacity), } : {}),
          },
        });

        if (priceEvaluation.price !== null) {
          const formulaAlreadyHandlesGuests = priceEvaluation.usedVariables.includes('guest_count');
          const guestMultiplier = formulaAlreadyHandlesGuests ? 1 : booking.guest_count;
          const calculated = Math.round(priceEvaluation.price * guestMultiplier * BOOKING_PRICE_MINOR_FACTOR);
          if (Number.isFinite(calculated) && calculated > 0) {
            newPriceMinor = BigInt(calculated);
          }
        }
      } catch {
        // Keep original price if evaluation fails
      }
    }

    class CapacityReachedError extends Error {}

    // Use Serializable isolation to prevent concurrent reschedules from
    // exceeding capacity — matching the pattern used in booking creation.
    const updated = await prisma
      .$transaction(
        async (tx) => {
          const activeCount = await countActiveBookingsOverlap(
            tx,
            booking.area_id,
            newStartAt,
            newExpiresAt,
            booking.id
          );

          const maxCapacity = normalizeNumeric(booking.area_max_capacity);
          if (maxCapacity !== null && activeCount + booking.guest_count > maxCapacity) {
            throw new CapacityReachedError();
          }

          return tx.booking.update({
            where: { id: booking.id, },
            data: {
              start_at: newStartAt,
              expires_at: newExpiresAt,
              booking_hours: parsed.data.bookingHours,
              price_minor: newPriceMinor,
            },
          });
        },
        { isolationLevel: 'Serializable', }
      )
      .catch((error) => {
        if (error instanceof CapacityReachedError) {
          return null;
        }
        throw error;
      });

    if (!updated) {
      return NextResponse.json(
        { error: 'The area is at capacity for the requested time window.', },
        { status: 409, }
      );
    }

    const formatDt = (d: Date) =>
      d.toLocaleString('en-PH', {
 month: 'short',
day: 'numeric',
hour: 'numeric',
minute: '2-digit', 
});

    await notifyBookingEvent(
      {
        bookingId: booking.id,
        spaceId: booking.space_id,
        areaId: booking.area_id,
        spaceName: booking.space_name,
        areaName: booking.area_name,
        customerAuthId: booking.user_auth_id,
        partnerAuthId: booking.partner_auth_id,
      },
      {
        title: 'Booking rescheduled',
        body: `Your booking at ${booking.area_name} has been moved to ${formatDt(newStartAt)}.`,
      },
      {
        title: 'Booking rescheduled',
        body: `A booking for ${booking.area_name} was rescheduled to ${formatDt(newStartAt)}.`,
      }
    );

    return NextResponse.json({
      data: {
        id: updated.id,
        startAt: updated.start_at.toISOString(),
        expiresAt: updated.expires_at?.toISOString() ?? null,
        bookingHours: normalizeNumeric(updated.booking_hours) ?? 0,
        priceMinor: updated.price_minor?.toString() ?? null,
      },
    });
  } catch (error) {
    console.error('Failed to reschedule booking', error);
    return NextResponse.json(
      { error: 'Unable to reschedule booking.', },
      { status: 500, }
    );
  }
}

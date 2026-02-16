import { z } from 'zod';

import { prisma } from '@/lib/prisma';
import { evaluatePriceRule } from '@/lib/pricing-rules-evaluator';
import type { PriceRuleDefinition } from '@/lib/pricing-rules';
import { countActiveBookingsOverlap, resolveBookingDecision } from '@/lib/bookings/occupancy';
import { normalizeNumeric } from '@/lib/bookings/serializer';
import { MIN_BOOKING_HOURS, MAX_BOOKING_HOURS } from '@/lib/bookings/constants';

const bookingAvailabilityInputSchema = z.object({
  space_id: z.string().uuid(),
  start_date: z.coerce.date(),
  end_date: z.coerce.date(),
});

const bookingPricingInputSchema = z.object({
  space_id: z.string().uuid(),
  area_id: z.string().uuid(),
  start_date: z.coerce.date(),
  end_date: z.coerce.date(),
});

export type BookingAvailabilityInput = z.infer<typeof bookingAvailabilityInputSchema>;
export type BookingPricingInput = z.infer<typeof bookingPricingInputSchema>;

/**
 * Check availability for a space on specific dates.
 * Returns available areas and their booking status.
 */
export async function getBookingAvailability(input: unknown) {
  const validated = bookingAvailabilityInputSchema.parse(input);
  const {
 space_id, start_date, end_date,
} = validated;

  // Fetch space with all areas
  const space = await prisma.space.findUnique({
    where: { id: space_id, },
    include: { area: { include: { price_rule: { select: { definition: true, }, }, }, }, },
  });

  if (!space) {
    return { error: 'Space not found', };
  }

  // Check for booking conflicts using a single groupBy query instead of N queries
  const areaIds = space.area.map((area) => area.id);

  const conflictCounts = await prisma.booking.groupBy({
    by: ['area_id'],
    where: {
      area_id: { in: areaIds, },
      status: { in: ['confirmed', 'pending'], },
      OR: [
        {
          // Booking starts during requested period
          start_at: {
            gte: start_date,
            lt: end_date,
          },
        },
        {
          // Booking ends during requested period
          expires_at: {
            gt: start_date,
            lte: end_date,
          },
        },
        {
          // Booking spans entire requested period
          start_at: { lte: start_date, },
          expires_at: { gte: end_date, },
        }
      ],
    },
    _count: { id: true, },
  });

  const conflictMap = new Map(
    conflictCounts.map((row) => [row.area_id, row._count.id])
  );

  const availabilityResults = space.area.map((area: {
    id: string;
    name: string;
    max_capacity: bigint | null;
    automatic_booking_enabled: boolean;
  }) => {
    const conflicts = conflictMap.get(area.id) ?? 0;
    const isAvailable = conflicts === 0;

    return {
      area_id: area.id,
      area_name: area.name,
      max_capacity: area.max_capacity ? Number(area.max_capacity) : null,
      available: isAvailable,
      automatic_booking_enabled: area.automatic_booking_enabled,
    };
  });

  return {
    space_id: space.id,
    space_name: space.name,
    start_date: start_date.toISOString(),
    end_date: end_date.toISOString(),
    areas: availabilityResults,
  };
}

/**
 * Get pricing information for a specific area booking.
 */
export async function getBookingPricing(input: unknown) {
  const validated = bookingPricingInputSchema.parse(input);
  const {
 space_id, area_id, start_date, end_date,
} = validated;

  // Fetch area with pricing rule
  const area = await prisma.area.findFirst({
    where: {
      id: area_id,
      space_id,
    },
    include: {
      price_rule: { select: { definition: true, }, },
      space: { select: { name: true, }, },
    },
  });

  if (!area) {
    return { error: 'Area not found', };
  }

  if (!area.price_rule?.definition) {
    return { error: 'Pricing information not available for this area', };
  }

  // Calculate booking duration in hours
  const durationMs = end_date.getTime() - start_date.getTime();
  const bookingHours = Math.ceil(durationMs / (1000 * 60 * 60));

  if (bookingHours <= 0) {
    return { error: 'End date must be after start date', };
  }

  try {
    const priceResult = evaluatePriceRule(area.price_rule.definition as PriceRuleDefinition, { bookingHours, });

    if (priceResult.price === null) {
      return { error: 'Could not calculate price for this booking duration', };
    }

    const totalPrice = Number(priceResult.price);

    return {
      space_id,
      space_name: area.space.name,
      area_id,
      area_name: area.name,
      start_date: start_date.toISOString(),
      end_date: end_date.toISOString(),
      duration_hours: bookingHours,
      price: totalPrice,
      currency: 'PHP',
      breakdown: {
        base_price: totalPrice,
        booking_hours: bookingHours,
      },
    };
  } catch (error) {
    console.error('Pricing calculation error:', error);
    return { error: 'Failed to calculate pricing', };
  }
}

/**
 * Validate booking parameters without creating a booking.
 * Useful for pre-validation before guiding user through booking flow.
 */
export async function validateBookingRequest(input: unknown) {
  const validated = bookingPricingInputSchema.parse(input);
  const {
 space_id, area_id, start_date, end_date,
} = validated;

  // Check availability
  const availabilityResult = await getBookingAvailability({
    space_id,
    start_date,
    end_date,
  });

  if ('error' in availabilityResult) {
    return availabilityResult;
  }

  // Find the specific area in availability results
  const areaAvailability = availabilityResult.areas.find(
    (a: { area_id: string }) => a.area_id === area_id
  );

  if (!areaAvailability) {
    return { error: 'Area not found in this space', };
  }

  if (!areaAvailability.available) {
    return {
      error: 'This area is not available for the requested time period',
      area_name: areaAvailability.area_name,
    };
  }

  // Get pricing
  const pricingResult = await getBookingPricing(input);

  if ('error' in pricingResult) {
    return pricingResult;
  }

  return {
    valid: true,
    availability: areaAvailability,
    pricing: pricingResult,
    message: 'Booking request is valid. User can proceed to complete the booking.',
  };
}

const createBookingCheckoutInputSchema = z.object({
  space_id: z.string().uuid(),
  area_id: z.string().uuid(),
  booking_hours: z.coerce.number().int().min(MIN_BOOKING_HOURS).max(MAX_BOOKING_HOURS),
  start_at: z.coerce.date(),
  guest_count: z.coerce.number().int().min(1).max(999).optional().default(1),
});

/**
 * Validate availability, pricing, and capacity for a booking, then return
 * checkout-ready parameters the frontend can use to initiate payment.
 */
export async function createBookingCheckout(input: unknown): Promise<Record<string, unknown>> {
  const validated = createBookingCheckoutInputSchema.parse(input);
  const {
 space_id, area_id, booking_hours, start_at, guest_count,
} = validated;

  const now = new Date();
  if (start_at.getTime() < now.getTime()) {
    return { error: 'Start time must be in the future.', };
  }

  const area = await prisma.area.findUnique({
    where: { id: area_id, },
    select: {
      id: true,
      name: true,
      max_capacity: true,
      automatic_booking_enabled: true,
      request_approval_at_capacity: true,
      space_id: true,
      advance_booking_enabled: true,
      advance_booking_value: true,
      advance_booking_unit: true,
      price_rule: {
        select: {
          id: true,
          name: true,
          definition: true,
          is_active: true,
        },
      },
      space: {
        select: {
          id: true,
          name: true,
          is_published: true,
        },
      },
    },
  });

  if (!area || area.space_id !== space_id || !area.space) {
    return { error: 'Area not found for this space.', };
  }

  if (!area.space.is_published) {
    return { error: 'This space is no longer available for booking.', };
  }

  const areaMaxCapacity = normalizeNumeric(area.max_capacity);
  if (areaMaxCapacity !== null && guest_count > areaMaxCapacity) {
    return { error: `This area allows up to ${areaMaxCapacity} guests.`, };
  }

  if (area.advance_booking_enabled && area.advance_booking_value && area.advance_booking_unit) {
    const leadMs = (() => {
      const unit = area.advance_booking_unit;
      const value = area.advance_booking_value;
      switch (unit) {
        case 'days':
          return value * 24 * 60 * 60 * 1000;
        case 'weeks':
          return value * 7 * 24 * 60 * 60 * 1000;
        case 'months':
          return value * 30 * 24 * 60 * 60 * 1000;
        default:
          return 0;
      }
    })();
    const minStart = new Date(now.getTime() + leadMs);
    if (start_at.getTime() < minStart.getTime()) {
      return { error: 'Please book further in advance for this area.', };
    }
  }

  const priceRule = area.price_rule;
  if (!priceRule) {
    return { error: 'Pricing is unavailable for this area.', };
  }

  if (!priceRule.is_active) {
    return { error: 'The pricing rule for this area is currently inactive.', };
  }

  const bookingStartAt = start_at;
  const expiresAt = new Date(bookingStartAt.getTime() + booking_hours * 60 * 60 * 1000);

  const priceEvaluation = (() => {
    try {
      return evaluatePriceRule(priceRule.definition as PriceRuleDefinition, {
        bookingHours: booking_hours,
        now: bookingStartAt,
        variableOverrides: { guest_count, },
      });
    } catch {
      return {
 price: null,
usedVariables: [] as string[], 
};
    }
  })();

  if (priceEvaluation.price === null) {
    return { error: 'Unable to compute a price for this booking.', };
  }

  const formulaAlreadyHandlesGuests = priceEvaluation.usedVariables.includes('guest_count');
  const guestMultiplier = formulaAlreadyHandlesGuests ? 1 : guest_count;
  const totalPrice = Number(priceEvaluation.price) * guestMultiplier;

  const activeCount = await countActiveBookingsOverlap(
    prisma,
    area.id,
    bookingStartAt,
    expiresAt
  );

  const decision = resolveBookingDecision({
    automaticBookingEnabled: Boolean(area.automatic_booking_enabled),
    requestApprovalAtCapacity: Boolean(area.request_approval_at_capacity),
    maxCapacity: areaMaxCapacity,
    activeCount,
    requestedGuestCount: guest_count,
  });

  if (decision.status === 'reject_full') {
    return { error: 'This area is fully booked for the requested time window.', };
  }

  return {
    action: 'checkout',
    spaceId: space_id,
    areaId: area.id,
    bookingHours: booking_hours,
    price: totalPrice,
    startAt: bookingStartAt.toISOString(),
    guestCount: guest_count,
    spaceName: area.space.name,
    areaName: area.name,
    priceCurrency: 'PHP',
    requiresHostApproval: decision.status === 'pending',
  };
}

import { z } from 'zod';

import { applyBookingActionStatus, type BookingActionRecord } from '@/lib/ai/booking-action';
import { BookingCheckoutError, createBookingCheckoutSession, type BookingCheckoutCustomer } from '@/lib/bookings/checkout-session';
import { MAX_BOOKING_HOURS, MIN_BOOKING_HOURS } from '@/lib/bookings/constants';
import { prisma } from '@/lib/prisma';
import { evaluatePriceRule } from '@/lib/pricing-rules-evaluator';
import type { PriceRuleDefinition } from '@/lib/pricing-rules';
import { normalizeNumeric } from '@/lib/bookings/serializer';

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
    const areaMaxCapacity = area.max_capacity ? Number(area.max_capacity) : null;
    const priceResult = evaluatePriceRule(area.price_rule.definition as PriceRuleDefinition, {
      bookingHours,
      now: start_date,
      variableOverrides: {
        guest_count: 1,
        ...(areaMaxCapacity !== null ? { area_max_capacity: areaMaxCapacity, } : {}),
      },
    });

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

export const createBookingCheckoutInputSchema = z.object({
  space_id: z.string().uuid(),
  area_id: z.string().uuid(),
  booking_hours: z.coerce.number().int().min(MIN_BOOKING_HOURS).max(MAX_BOOKING_HOURS),
  start_at: z.coerce.date(),
  guest_count: z.coerce.number().int().min(1).max(999).optional().default(1),
});

type CreateBookingCheckoutOptions = {
  cancelUrl?: string;
  requestKey?: string;
  successUrl?: string;
};

/**
 * Create a live booking checkout session for the authenticated customer.
 */
export async function createBookingCheckout(
  input: unknown,
  customer: BookingCheckoutCustomer | null,
  options: CreateBookingCheckoutOptions = {}
): Promise<Record<string, unknown>> {
  if (!customer) {
    return { error: 'Only signed-in customers can create booking checkouts.', };
  }

  const validated = createBookingCheckoutInputSchema.parse(input);
  const {
 space_id, area_id, booking_hours, start_at, guest_count,
} = validated;

  try {
    const checkout = await createBookingCheckoutSession({
      areaId: area_id,
      bookingHours: booking_hours,
      cancelUrl: options.cancelUrl,
      customer,
      guestCount: guest_count,
      spaceId: space_id,
      startAt: start_at,
      successUrl: options.successUrl,
    });

    const baseAction: BookingActionRecord = {
      action: 'checkout',
      areaId: checkout.areaId,
      areaName: checkout.areaName,
      bookingHours: checkout.bookingHours,
      bookingId: checkout.bookingId,
      checkoutUrl: checkout.checkoutUrl,
      guestCount: checkout.guestCount,
      price: checkout.price,
      priceCurrency: checkout.priceCurrency,
      requestKey: options.requestKey,
      requiresHostApproval: checkout.requiresHostApproval,
      spaceId: checkout.spaceId,
      spaceName: checkout.spaceName,
      startAt: checkout.startAt,
      testingMode: checkout.testingMode,
    };

    return applyBookingActionStatus(baseAction, {
      bookingStatus: checkout.testingMode ? 'confirmed' : 'pending',
      checkoutUrl: checkout.checkoutUrl,
      paymentCaptured: checkout.testingMode,
      requiresHostApproval: checkout.requiresHostApproval,
      testingMode: checkout.testingMode,
    });
  } catch (error) {
    if (error instanceof BookingCheckoutError) {
      return { error: error.message, };
    }

    throw error;
  }
}

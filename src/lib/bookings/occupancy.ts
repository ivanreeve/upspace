import type { Prisma, PrismaClient } from '@prisma/client';

import { ACTIVE_OCCUPANCY_BOOKING_STATUSES } from './constants';
import type { BookingStatus } from './types';

type BookingQueryable = PrismaClient | Prisma.TransactionClient;

export type BookingDecision =
  | {
    status: BookingStatus;
    decision: 'auto_confirmed' | 'pending_review';
  }
  | { status: 'reject_full'; decision: 'reject_full' };

export async function countActiveBookingsOverlap(
  tx: BookingQueryable,
  areaId: string,
  windowStart: Date,
  windowEnd: Date
) {
  const aggregates = await tx.booking.aggregate({
    _sum: { guest_count: true, },
    where: {
      area_id: areaId,
      status: { in: ACTIVE_OCCUPANCY_BOOKING_STATUSES, },
      NOT: [
        { expires_at: { lte: windowStart, }, },
        { start_at: { gte: windowEnd, }, }
      ],
    },
  });

  const totalGuests = aggregates._sum.guest_count;
  return typeof totalGuests === 'number' && Number.isFinite(totalGuests) ? totalGuests : 0;
}

export function resolveBookingDecision(
  options: {
    automaticBookingEnabled: boolean;
    requestApprovalAtCapacity: boolean;
    maxCapacity: number | null;
    activeCount: number;
    requestedGuestCount: number;
  }
): BookingDecision {
  const {
    automaticBookingEnabled,
    requestApprovalAtCapacity,
    maxCapacity,
    activeCount,
    requestedGuestCount,
  } = options;

  if (!automaticBookingEnabled) {
    return {
      status: 'pending',
      decision: 'pending_review',
    };
  }

  const hasFiniteCapacity = typeof maxCapacity === 'number' && Number.isFinite(maxCapacity);
  const requestedGuests = Number.isFinite(requestedGuestCount) && requestedGuestCount > 0
    ? requestedGuestCount
    : 1;
  const projectedGuests = activeCount + requestedGuests;
  const atOrOverCapacity = hasFiniteCapacity ? projectedGuests > maxCapacity : false;

  if (!atOrOverCapacity) {
    return {
      status: 'confirmed',
      decision: 'auto_confirmed',
    };
  }

  if (requestApprovalAtCapacity) {
    return {
      status: 'pending',
      decision: 'pending_review',
    };
  }

  return {
    status: 'reject_full',
    decision: 'reject_full',
  };
}

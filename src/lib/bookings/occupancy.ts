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
  return tx.booking.count({
    where: {
      area_id: areaId,
      status: { in: ACTIVE_OCCUPANCY_BOOKING_STATUSES, },
      NOT: [
        { expires_at: { lte: windowStart, }, },
        { created_at: { gte: windowEnd, }, }
      ],
    },
  });
}

export function resolveBookingDecision(
  options: {
    automaticBookingEnabled: boolean;
    requestApprovalAtCapacity: boolean;
    maxCapacity: number | null;
    activeCount: number;
  }
): BookingDecision {
  const {
    automaticBookingEnabled,
    requestApprovalAtCapacity,
    maxCapacity,
    activeCount,
  } = options;

  if (!automaticBookingEnabled) {
    return {
      status: 'pending',
      decision: 'pending_review',
    };
  }

  const hasFiniteCapacity = typeof maxCapacity === 'number' && Number.isFinite(maxCapacity);
  const atOrOverCapacity = hasFiniteCapacity ? activeCount >= maxCapacity : false;

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

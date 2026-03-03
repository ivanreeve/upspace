import type { BookingStatus } from './types';

export const MIN_BOOKING_HOURS = 1;
export const MAX_BOOKING_HOURS = 24; // limit hourly bookings to 24 hours

export const CANCELLABLE_BOOKING_STATUSES: BookingStatus[] = [
  'pending',
  'confirmed'
];

export const ACTIVE_OCCUPANCY_BOOKING_STATUSES: BookingStatus[] = [
  'pending',
  'confirmed',
  'checkedin'
];

/**
 * Defines which status transitions are allowed.
 * Key = current status, Value = set of statuses it can transition to.
 */
export const ALLOWED_STATUS_TRANSITIONS: Record<BookingStatus, readonly BookingStatus[]> = {
  pending:    ['confirmed', 'cancelled', 'rejected', 'expired', 'noshow'],
  confirmed:  ['cancelled', 'checkedin', 'checkedout', 'noshow'],
  checkedin:  ['checkedout', 'completed'],
  checkedout: ['completed'],
  // Terminal states — no further transitions allowed
  completed:  [],
  cancelled:  [],
  rejected:   [],
  expired:    [],
  noshow:     [],
} as const;

/**
 * Returns true if transitioning from `current` to `next` is valid.
 */
export function isValidStatusTransition(current: BookingStatus, next: BookingStatus): boolean {
  return ALLOWED_STATUS_TRANSITIONS[current].includes(next);
}

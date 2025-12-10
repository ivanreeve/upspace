import type { BookingStatus } from './types';

export const MIN_BOOKING_HOURS = 1;
export const MAX_BOOKING_HOURS = 24 * 30; // allow bookings up to 30 days / 720 hours

export const CANCELLABLE_BOOKING_STATUSES: BookingStatus[] = [
  'pending',
  'confirmed'
];

export const ACTIVE_OCCUPANCY_BOOKING_STATUSES: BookingStatus[] = [
  'pending',
  'confirmed',
  'checkedin'
];
export const MAX_BOOKING_HOURS = 24; // only hourly bookings up to 24 hours

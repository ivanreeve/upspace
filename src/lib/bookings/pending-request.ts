export const PENDING_BOOKING_AREA_CONFLICT_MESSAGE =
  'You already have a pending booking request for this area. Please wait for the host to review it before booking this area again.';

export class PendingAreaBookingConflictError extends Error {
  constructor(message = PENDING_BOOKING_AREA_CONFLICT_MESSAGE) {
    super(message);
    this.name = 'PendingAreaBookingConflictError';
  }
}

type PendingBookingRequestComparable = {
  booking_hours: bigint | number;
  guest_count: number;
  start_at: Date;
  expires_at: Date;
};

export function matchesPendingBookingRequest(
  booking: PendingBookingRequestComparable,
  request: {
    bookingHours: number;
    guestCount: number;
    startAt: Date;
    expiresAt: Date;
  }
) {
  return (
    Number(booking.booking_hours) === request.bookingHours &&
    booking.guest_count === request.guestCount &&
    booking.start_at.getTime() === request.startAt.getTime() &&
    booking.expires_at.getTime() === request.expiresAt.getTime()
  );
}

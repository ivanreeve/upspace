export const CUSTOMER_BOOKING_STATUSES = [
  'pending',
  'confirmed',
  'rejected',
  'expired',
  'cancelled',
  'checkedin',
  'checkedout',
  'completed',
  'noshow'
] as const;

export type CustomerTransactionBookingStatus =
  (typeof CUSTOMER_BOOKING_STATUSES)[number];

export type CustomerTransactionRecord = {
  id: string;
  bookingId: string;
  bookingStatus: CustomerTransactionBookingStatus;
  bookingCreatedAt: string;
  bookingHours: number;
  spaceName: string;
  areaName: string;
  currency: string;
  amountMinor: string;
  feeMinor: string | null;
  paymentMethod: string;
  isLive: boolean;
  transactionCreatedAt: string;
};

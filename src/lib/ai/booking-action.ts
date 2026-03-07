import type { BookingStatus } from '@/lib/bookings/types';

export type BookingReviewState = 'host_approval' | 'capacity_review' | null;

export type BookingFlowState =
  | 'checkout_ready'
  | 'payment_processing'
  | 'payment_cancelled'
  | 'awaiting_host_approval'
  | 'awaiting_capacity_review'
  | 'confirmed'
  | 'expired'
  | 'cancelled'
  | 'rejected';

export type BookingActionRecord = {
  action: 'checkout';
  areaId: string;
  areaName: string;
  bookingHours: number;
  bookingId?: string;
  bookingStatus?: BookingStatus;
  checkoutUrl?: string;
  flowState?: BookingFlowState;
  guestCount: number;
  lastSyncedAt?: string;
  paymentCaptured?: boolean;
  price: number;
  priceCurrency: string;
  requestKey?: string;
  requiresHostApproval?: boolean;
  reviewState?: BookingReviewState;
  spaceId: string;
  spaceName: string;
  startAt: string;
  statusDetail?: string;
  statusTitle?: string;
  testingMode?: boolean;
};

type BookingActionStatusInput = {
  bookingStatus: BookingStatus;
  checkoutUrl?: string;
  paymentCaptured: boolean;
  paymentOutcome?: 'success' | 'cancel' | null;
  requiresHostApproval?: boolean;
  reviewState?: BookingReviewState;
  testingMode?: boolean;
};

type BookingActionStatusCopy = {
  checkoutUrl?: string;
  flowState: BookingFlowState;
  paymentCaptured: boolean;
  reviewState: BookingReviewState;
  statusDetail: string;
  statusTitle: string;
};

const REUSABLE_FLOW_STATES = new Set<BookingFlowState>([
  'checkout_ready',
  'payment_processing',
  'payment_cancelled',
  'awaiting_host_approval',
  'awaiting_capacity_review',
  'confirmed'
]);

function resolveBookingActionCopy(input: BookingActionStatusInput): BookingActionStatusCopy {
  const reviewState = input.reviewState ?? null;

  if (input.testingMode || input.bookingStatus === 'confirmed') {
    return {
      checkoutUrl: input.checkoutUrl,
      flowState: 'confirmed',
      paymentCaptured: true,
      reviewState,
      statusDetail: 'Your reservation is confirmed and ready on the booking timeline.',
      statusTitle: 'Booking confirmed',
    };
  }

  if (input.bookingStatus === 'expired') {
    return {
      checkoutUrl: undefined,
      flowState: 'expired',
      paymentCaptured: input.paymentCaptured,
      reviewState,
      statusDetail: 'The checkout window expired before this reservation was completed.',
      statusTitle: 'Checkout expired',
    };
  }

  if (input.bookingStatus === 'cancelled') {
    return {
      checkoutUrl: undefined,
      flowState: 'cancelled',
      paymentCaptured: input.paymentCaptured,
      reviewState,
      statusDetail: input.paymentCaptured
        ? 'This booking was cancelled after payment activity was recorded.'
        : 'This booking was cancelled before payment completed.',
      statusTitle: 'Booking cancelled',
    };
  }

  if (input.bookingStatus === 'rejected') {
    return {
      checkoutUrl: undefined,
      flowState: 'rejected',
      paymentCaptured: input.paymentCaptured,
      reviewState,
      statusDetail: 'The host declined this booking request.',
      statusTitle: 'Booking rejected',
    };
  }

  if (input.bookingStatus === 'pending' && input.paymentCaptured && reviewState === 'host_approval') {
    return {
      checkoutUrl: undefined,
      flowState: 'awaiting_host_approval',
      paymentCaptured: true,
      reviewState,
      statusDetail: 'Payment was received. The host still needs to approve this booking.',
      statusTitle: 'Awaiting host approval',
    };
  }

  if (input.bookingStatus === 'pending' && input.paymentCaptured && reviewState === 'capacity_review') {
    return {
      checkoutUrl: undefined,
      flowState: 'awaiting_capacity_review',
      paymentCaptured: true,
      reviewState,
      statusDetail: 'Payment was received and the booking is being reviewed for capacity.',
      statusTitle: 'Awaiting review',
    };
  }

  if (input.bookingStatus === 'pending' && input.paymentCaptured) {
    return {
      checkoutUrl: undefined,
      flowState: 'payment_processing',
      paymentCaptured: true,
      reviewState,
      statusDetail: 'Payment was received and the booking is being finalized.',
      statusTitle: 'Payment received',
    };
  }

  if (input.paymentOutcome === 'cancel') {
    return {
      checkoutUrl: input.checkoutUrl,
      flowState: 'payment_cancelled',
      paymentCaptured: false,
      reviewState,
      statusDetail: 'Payment was cancelled. You can reopen checkout when you are ready.',
      statusTitle: 'Payment cancelled',
    };
  }

  if (input.paymentOutcome === 'success') {
    return {
      checkoutUrl: undefined,
      flowState: 'payment_processing',
      paymentCaptured: true,
      reviewState,
      statusDetail: 'Payment was received. Waiting for the booking status to refresh.',
      statusTitle: 'Payment received',
    };
  }

  return {
    checkoutUrl: input.checkoutUrl,
    flowState: 'checkout_ready',
    paymentCaptured: false,
    reviewState,
    statusDetail: 'Complete payment to lock in this booking.',
    statusTitle: input.requiresHostApproval
      ? 'Checkout ready for approval flow'
      : 'Checkout ready',
  };
}

export function applyBookingActionStatus(
  action: BookingActionRecord,
  input: BookingActionStatusInput
): BookingActionRecord {
  const copy = resolveBookingActionCopy(input);

  return {
    ...action,
    bookingStatus: input.bookingStatus,
    checkoutUrl: copy.checkoutUrl,
    flowState: copy.flowState,
    lastSyncedAt: new Date().toISOString(),
    paymentCaptured: copy.paymentCaptured,
    reviewState: copy.reviewState,
    requiresHostApproval: input.requiresHostApproval ?? action.requiresHostApproval,
    statusDetail: copy.statusDetail,
    statusTitle: copy.statusTitle,
    testingMode: input.testingMode ?? action.testingMode,
  };
}

export function isReusableBookingAction(action: BookingActionRecord) {
  return action.flowState ? REUSABLE_FLOW_STATES.has(action.flowState) : true;
}

export function parseBookingAction(value: unknown): BookingActionRecord | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const candidate = value as Partial<BookingActionRecord>;
  if (candidate.action !== 'checkout') {
    return null;
  }

  if (
    typeof candidate.spaceId !== 'string'
    || typeof candidate.areaId !== 'string'
    || typeof candidate.bookingHours !== 'number'
    || typeof candidate.guestCount !== 'number'
    || typeof candidate.price !== 'number'
    || typeof candidate.startAt !== 'string'
    || typeof candidate.spaceName !== 'string'
    || typeof candidate.areaName !== 'string'
    || typeof candidate.priceCurrency !== 'string'
  ) {
    return null;
  }

  return candidate as BookingActionRecord;
}

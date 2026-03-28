import type { BookingStatus } from '@/lib/bookings/types';
import type { BookingRefundSummary } from '@/lib/bookings/refund-summary';

export type TimelineEventKind = 'created' | 'confirmed' | 'checkedin' | 'checkedout' | 'completed' | 'noshow' | 'payment' | 'cancellation' | 'refund';

export type TimelineEventStatus = 'succeeded' | 'pending' | 'failed';

export type TimelineEvent = {
  id: string;
  kind: TimelineEventKind;
  label: string;
  status: TimelineEventStatus;
  amountMinor: string;
  currency: string;
  timestamp: string;
};

export type BookingDetailRecord = {
  id: string;
  spaceId: string;
  spaceName: string;
  areaId: string;
  areaName: string;
  bookingHours: number;
  startAt: string;
  guestCount: number;
  priceMinor: string | null;
  currency: string;
  status: BookingStatus;
  createdAt: string;
  paymentCaptured: boolean;
  paymentMethod: string | null;
  refundSummary: BookingRefundSummary | null;
  reviewState: 'host_approval' | 'capacity_review' | null;
  latestStatusTitle: string | null;
  isLive: boolean | null;
  timeline: TimelineEvent[];
};

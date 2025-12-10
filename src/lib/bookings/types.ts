export type BookingStatus =
  | 'confirmed'
  | 'pending'
  | 'cancelled'
  | 'rejected'
  | 'expired'
  | 'checkedin'
  | 'checkedout'
  | 'completed'
  | 'noshow';

export type BookingRecord = {
  id: string;
  spaceId: string;
  spaceName: string;
  areaId: string;
  areaName: string;
  bookingHours: number;
  startAt: string;
  guestCount: number | null;
  price: number | null;
  status: BookingStatus;
  createdAt: string;
  customerAuthId: string;
  partnerAuthId: string | null;
  areaMaxCapacity: number | null;
  customerHandle: string | null;
  customerName: string | null;
};

export type CancellableStatus = Extract<BookingStatus, 'pending' | 'confirmed'>;

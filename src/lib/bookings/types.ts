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
  price: number | null;
  status: BookingStatus;
  createdAt: string;
  customerAuthId: string;
  partnerAuthId: string | null;
  areaMaxCapacity: number | null;
  areaMinCapacity: number;
};

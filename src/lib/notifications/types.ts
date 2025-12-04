export type NotificationType =
  | 'booking_confirmed'
  | 'booking_received'
  | 'message'
  | 'system';

export type NotificationRecord = {
  id: string;
  userAuthId: string;
  title: string;
  body: string;
  href: string;
  type: NotificationType;
  createdAt: string;
  read: boolean;
  readAt?: string | null;
  bookingId?: string | null;
  spaceId?: string | null;
  areaId?: string | null;
};

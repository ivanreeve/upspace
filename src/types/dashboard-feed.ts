import type { BookingStatus } from '@/lib/bookings/types';
import type { NotificationType } from '@/lib/notifications/types';

export type BookingFeedItem = {
  id: string;
  type: 'booking';
  createdAt: string;
  title: string;
  body: string;
  href: string;
  status: BookingStatus;
  spaceId: string;
  spaceName: string;
  areaId: string;
  areaName: string;
  price: number | null;
  bookingHours: number;
  customerName: string | null;
  customerHandle: string | null;
};

export type NotificationFeedItem = {
  id: string;
  type: 'notification';
  createdAt: string;
  title: string;
  body: string;
  href: string;
  notificationType: NotificationType;
  read: boolean;
  bookingId?: string | null;
  spaceId?: string | null;
  areaId?: string | null;
};

export type DashboardFeedItem = BookingFeedItem | NotificationFeedItem;

import type { NotificationRecord } from './types';

export const mapNotification = (row: {
  id: string;
  user_auth_id: string;
  title: string;
  body: string;
  href: string;
  type: 'booking_confirmed' | 'booking_received' | 'message' | 'system';
  created_at: Date;
  read_at: Date | null;
  booking_id: string | null;
  space_id: string | null;
  area_id: string | null;
}): NotificationRecord => ({
  id: row.id,
  userAuthId: row.user_auth_id,
  title: row.title,
  body: row.body,
  href: row.href,
  type: row.type,
  createdAt: row.created_at.toISOString(),
  read: Boolean(row.read_at),
  readAt: row.read_at ? row.read_at.toISOString() : null,
  bookingId: row.booking_id,
  spaceId: row.space_id,
  areaId: row.area_id,
});

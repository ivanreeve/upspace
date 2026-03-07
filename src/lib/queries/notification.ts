import { mapNotification } from '@/lib/notifications/serializer';
import type { NotificationRecord } from '@/lib/notifications/types';
import { prisma } from '@/lib/prisma';

export type NotificationsPage = {
  data: NotificationRecord[];
  pagination: { hasMore: boolean; nextCursor: string | undefined };
};

const DEFAULT_LIMIT = 25;

export async function getNotificationsFirstPage(
  authUserId: string,
  limit: number = DEFAULT_LIMIT
): Promise<NotificationsPage> {
  const notifications = await prisma.app_notification.findMany({
    where: { user_auth_id: authUserId, },
    orderBy: { created_at: 'desc', },
    take: limit + 1,
  });

  const hasMore = notifications.length > limit;
  if (hasMore) notifications.pop();

  const nextCursor = hasMore
    ? notifications[notifications.length - 1]?.id
    : undefined;

  return {
    data: notifications.map(mapNotification),
    pagination: {
 hasMore,
nextCursor, 
},
  };
}

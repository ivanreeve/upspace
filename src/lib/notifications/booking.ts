import { prisma } from '@/lib/prisma';

type BookingNotificationContext = {
  bookingId: string;
  spaceId: string;
  areaId: string;
  spaceName: string;
  areaName: string;
  customerAuthId: string;
  partnerAuthId: string | null;
};

type NotificationPayload = {
  title: string;
  body: string;
};

/**
 * Create deduplicated in-app notifications for a booking event.
 *
 * Deduplicates by `booking_id` + customer notification title to prevent
 * duplicate notifications when the same event is processed multiple times.
 */
export async function notifyBookingEvent(
  context: BookingNotificationContext,
  customerNotification: NotificationPayload | null,
  partnerNotification: NotificationPayload | null
) {
  const href = `/marketplace/${context.spaceId}`;
  const deduplicationTitle = customerNotification?.title ?? partnerNotification?.title;

  if (deduplicationTitle) {
    const existing = await prisma.app_notification.findFirst({
      where: {
        booking_id: context.bookingId,
        title: deduplicationTitle,
      },
      select: { id: true, },
    });

    if (existing) return;
  }

  if (customerNotification) {
    await prisma.app_notification.create({
      data: {
        user_auth_id: context.customerAuthId,
        title: customerNotification.title,
        body: customerNotification.body,
        href,
        type: 'system',
        booking_id: context.bookingId,
        space_id: context.spaceId,
        area_id: context.areaId,
      },
    });
  }

  if (partnerNotification && context.partnerAuthId) {
    await prisma.app_notification.create({
      data: {
        user_auth_id: context.partnerAuthId,
        title: partnerNotification.title,
        body: partnerNotification.body,
        href,
        type: 'system',
        booking_id: context.bookingId,
        space_id: context.spaceId,
        area_id: context.areaId,
      },
    });
  }
}

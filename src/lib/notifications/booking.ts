import { prisma } from '@/lib/prisma';
import { formatCurrencyMinor } from '@/lib/wallet';

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

type RefundNotificationState =
  | 'processing'
  | 'review'
  | 'completed'
  | 'failed';

function formatRefundAmountLabel(
  amountMinor: string | null | undefined,
  currency: string | null | undefined
) {
  if (!amountMinor) {
    return 'Your refund';
  }

  return `${formatCurrencyMinor(amountMinor, currency ?? 'PHP')} refund`;
}

function buildCustomerRefundNotification(
  context: BookingNotificationContext,
  input: {
    state: RefundNotificationState;
    amountMinor?: string | null;
    currency?: string | null;
  }
): NotificationPayload {
  const amountLabel = formatRefundAmountLabel(input.amountMinor, input.currency);
  const bookingLabel = `${context.areaName} · ${context.spaceName}`;

  switch (input.state) {
    case 'processing':
      return {
        title: 'Refund processing',
        body: `${amountLabel} for ${bookingLabel} is now processing and will return to your original payment method after provider confirmation.`,
      };
    case 'completed':
      return {
        title: 'Refund completed',
        body: `${amountLabel} for ${bookingLabel} has been completed and sent back to your original payment method.`,
      };
    case 'failed':
      return {
        title: 'Refund failed',
        body: `${amountLabel} for ${bookingLabel} could not be completed automatically. Please contact support if you need help.`,
      };
    case 'review':
    default:
      return {
        title: 'Refund needs attention',
        body: `${amountLabel} for ${bookingLabel} needs manual review before it can continue. Our team has been notified.`,
      };
  }
}

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

export async function notifyCustomerRefundUpdate(
  context: BookingNotificationContext,
  input: {
    state: RefundNotificationState;
    amountMinor?: string | null;
    currency?: string | null;
  }
) {
  await notifyBookingEvent(
    context,
    buildCustomerRefundNotification(context, input),
    null
  );
}

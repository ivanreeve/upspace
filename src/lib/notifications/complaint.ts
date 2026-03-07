import { notifyBookingEvent } from '@/lib/notifications/booking';

type ComplaintNotificationContext = {
  bookingId: string;
  spaceId: string;
  areaId: string;
  spaceName: string;
  areaName: string;
  customerAuthId: string;
  partnerAuthId: string | null;
};

export async function notifyComplaintFiled(context: ComplaintNotificationContext) {
  await notifyBookingEvent(
    context,
    null,
    {
      title: 'New complaint received',
      body: `A customer filed a complaint for their booking at ${context.spaceName} — ${context.areaName}.`,
    }
  );
}

export async function notifyComplaintResolvedByPartner(context: ComplaintNotificationContext) {
  await notifyBookingEvent(
    context,
    {
      title: 'Your complaint has been resolved',
      body: `Your complaint for the booking at ${context.spaceName} — ${context.areaName} has been resolved by the space partner.`,
    },
    null
  );
}

export async function notifyComplaintEscalated(context: ComplaintNotificationContext) {
  await notifyBookingEvent(
    context,
    {
      title: 'Your complaint has been escalated for review',
      body: `Your complaint for the booking at ${context.spaceName} — ${context.areaName} has been escalated to the UpSpace team for review.`,
    },
    null
  );
}

export async function notifyComplaintResolvedByAdmin(context: ComplaintNotificationContext) {
  await notifyBookingEvent(
    context,
    {
      title: 'Your escalated complaint has been resolved',
      body: `Your escalated complaint for the booking at ${context.spaceName} — ${context.areaName} has been resolved by the UpSpace team.`,
    },
    {
      title: 'Escalated complaint resolved by admin',
      body: `An escalated complaint for the booking at ${context.spaceName} — ${context.areaName} has been resolved by the UpSpace team.`,
    }
  );
}

export async function notifyComplaintDismissedByAdmin(context: ComplaintNotificationContext) {
  await notifyBookingEvent(
    context,
    {
      title: 'Your escalated complaint has been dismissed',
      body: `Your escalated complaint for the booking at ${context.spaceName} — ${context.areaName} has been dismissed by the UpSpace team.`,
    },
    {
      title: 'Escalated complaint dismissed by admin',
      body: `An escalated complaint for the booking at ${context.spaceName} — ${context.areaName} has been dismissed by the UpSpace team.`,
    }
  );
}

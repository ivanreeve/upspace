import type { BookingRow } from '@/lib/bookings/serializer';
import { countActiveBookingsOverlap } from '@/lib/bookings/occupancy';
import { mapBookingRowToRecord } from '@/lib/bookings/serializer';
import { sendBookingNotificationEmail } from '@/lib/email';
import { prisma } from '@/lib/prisma';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? '';

export type SuccessfulBookingPaymentRow = BookingRow & {
  expires_at: Date;
};

export async function finalizeSuccessfulBookingPayment(input: {
  bookingRow: SuccessfulBookingPaymentRow;
  requiresHostApproval: boolean;
}) {
  const {
    bookingRow,
    requiresHostApproval,
  } = input;
  const bookingId = bookingRow.id;

  if (requiresHostApproval) {
    const booking = mapBookingRowToRecord(bookingRow);
    const bookingHref = `/marketplace/${booking.spaceId}`;

    const existingPendingNotice = await prisma.app_notification.findFirst({
      where: {
        booking_id: booking.id,
        type: 'system',
      },
      select: { id: true, },
    });

    if (!existingPendingNotice) {
      await prisma.app_notification.create({
        data: {
          user_auth_id: booking.customerAuthId,
          title: 'Booking pending approval',
          body: `${booking.areaName} at ${booking.spaceName} is awaiting host approval.`,
          href: bookingHref,
          type: 'system',
          booking_id: booking.id,
          space_id: booking.spaceId,
          area_id: booking.areaId,
        },
      });

      if (booking.partnerAuthId) {
        await prisma.app_notification.create({
          data: {
            user_auth_id: booking.partnerAuthId,
            title: 'Booking needs approval',
            body: `${booking.areaName} in ${booking.spaceName} is pending your review.`,
            href: bookingHref,
            type: 'system',
            booking_id: booking.id,
            space_id: booking.spaceId,
            area_id: booking.areaId,
          },
        });
      }
    }

    return;
  }

  if (bookingRow.area_max_capacity !== null) {
    const areaMaxCap = Number(bookingRow.area_max_capacity);
    const activeCount = await countActiveBookingsOverlap(
      prisma,
      bookingRow.area_id,
      bookingRow.start_at,
      bookingRow.expires_at,
      bookingRow.id
    );
    const projected = activeCount + bookingRow.guest_count;
    if (Number.isFinite(areaMaxCap) && projected > areaMaxCap) {
      const booking = mapBookingRowToRecord(bookingRow);
      const bookingHref = `/marketplace/${booking.spaceId}`;

      const existingPendingNotice = await prisma.app_notification.findFirst({
        where: {
          booking_id: booking.id,
          type: 'system',
        },
        select: { id: true, },
      });

      if (!existingPendingNotice) {
        await prisma.app_notification.create({
          data: {
            user_auth_id: booking.customerAuthId,
            title: 'Booking awaiting review',
            body: `${booking.areaName} at ${booking.spaceName} needs host review due to capacity.`,
            href: bookingHref,
            type: 'system',
            booking_id: booking.id,
            space_id: booking.spaceId,
            area_id: booking.areaId,
          },
        });

        if (booking.partnerAuthId) {
          await prisma.app_notification.create({
            data: {
              user_auth_id: booking.partnerAuthId,
              title: 'Review booking capacity',
              body: `${booking.areaName} in ${booking.spaceName} was paid but exceeds capacity. Approve or refund.`,
              href: bookingHref,
              type: 'system',
              booking_id: booking.id,
              space_id: booking.spaceId,
              area_id: booking.areaId,
            },
          });
        }
      }

      return;
    }
  }

  const updatedBooking = await prisma.booking.update({
    where: { id: bookingId, },
    data: { status: 'confirmed', },
  });

  const booking = mapBookingRowToRecord(updatedBooking);
  const bookingHref = `/marketplace/${booking.spaceId}`;

  const existingConfirmationNotice = await prisma.app_notification.findFirst({
    where: {
      booking_id: booking.id,
      type: 'booking_confirmed',
    },
    select: { id: true, },
  });

  if (!existingConfirmationNotice) {
    await prisma.app_notification.create({
      data: {
        user_auth_id: booking.customerAuthId,
        title: 'Booking confirmed',
        body: `${booking.areaName} at ${booking.spaceName} is confirmed.`,
        href: bookingHref,
        type: 'booking_confirmed',
        booking_id: booking.id,
        space_id: booking.spaceId,
        area_id: booking.areaId,
      },
    });

    if (booking.partnerAuthId) {
      await prisma.app_notification.create({
        data: {
          user_auth_id: booking.partnerAuthId,
          title: 'New booking received',
          body: `${booking.areaName} in ${booking.spaceName} was just booked.`,
          href: bookingHref,
          type: 'booking_received',
          booking_id: booking.id,
          space_id: booking.spaceId,
          area_id: booking.areaId,
        },
      });
    }
  }

  try {
    const adminClient = getSupabaseAdminClient();
    const {
      data: userData,
      error: userError,
    } = await adminClient.auth.admin.getUserById(
      booking.customerAuthId
    );

    if (userError) {
      console.warn('Unable to read customer email for booking notification', userError);
    }

    if (userData?.user?.email) {
      await sendBookingNotificationEmail({
        to: userData.user.email,
        spaceName: booking.spaceName,
        areaName: booking.areaName,
        bookingHours: booking.bookingHours,
        price: booking.price,
        link: `${APP_URL}${bookingHref}`,
      });
    }
  } catch (error) {
    console.error('Failed to send booking notification email', error);
  }
}

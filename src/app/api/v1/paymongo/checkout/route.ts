import { randomUUID } from 'crypto';

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { BOOKING_PRICE_MINOR_FACTOR, mapBookingRowToRecord, normalizeNumeric } from '@/lib/bookings/serializer';
import { MAX_BOOKING_HOURS, MIN_BOOKING_HOURS } from '@/lib/bookings/constants';
import { sendBookingNotificationEmail } from '@/lib/email';
import { createPaymongoCheckoutSession } from '@/lib/paymongo';
import { prisma } from '@/lib/prisma';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';
import { isTestingModeEnabled } from '@/lib/testing-mode';
import { resolveAuthenticatedUserForWallet } from '@/lib/wallet-server';

const checkoutPayloadSchema = z.object({
  spaceId: z.string().uuid(),
  areaId: z.string().uuid(),
  bookingHours: z.number().int().min(MIN_BOOKING_HOURS).max(MAX_BOOKING_HOURS),
  price: z.number().positive(),
  successUrl: z.string().url().optional(),
  cancelUrl: z.string().url().optional(),
});

const unauthorizedResponse = NextResponse.json(
  { error: 'Authentication required.', },
  { status: 401, }
);

const invalidPayloadResponse = NextResponse.json(
  { error: 'Invalid booking payload.', },
  { status: 400, }
);

const notFoundResponse = NextResponse.json(
  { error: 'Area not found for this space.', },
  { status: 404, }
);

const unavailableSpaceResponse = NextResponse.json(
  { error: 'This space is no longer available for booking.', },
  { status: 410, }
);

const APP_URL = (process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000').replace(/\/+$/, '');

export async function POST(req: NextRequest) {
  try {
    const parsed = checkoutPayloadSchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return invalidPayloadResponse;
    }

    const auth = await resolveAuthenticatedUserForWallet();
    if (auth.response) {
      return auth.response;
    }

    const area = await prisma.area.findUnique({
      where: { id: parsed.data.areaId, },
      select: {
        id: true,
        name: true,
        max_capacity: true,
        space_id: true,
        space: {
          select: {
            id: true,
            name: true,
            is_published: true,
            user: { select: { auth_user_id: true, }, },
          },
        },
      },
    });

    if (!area || area.space_id !== parsed.data.spaceId || !area.space) {
      return notFoundResponse;
    }

    if (!area.space.is_published) {
      return unavailableSpaceResponse;
    }

    const partnerAuthId = area.space.user?.auth_user_id ?? null;
    const priceMinor = Math.round(parsed.data.price * BOOKING_PRICE_MINOR_FACTOR);
    const expiresAt = new Date(Date.now() + parsed.data.bookingHours * 60 * 60 * 1000);

    const bookingRow = await prisma.booking.create({
      data: {
        id: randomUUID(),
        space_id: parsed.data.spaceId,
        space_name: area.space.name,
        area_id: area.id,
        area_name: area.name,
        booking_hours: parsed.data.bookingHours,
        price_minor: priceMinor,
        currency: 'PHP',
        status: 'pending',
        user_auth_id: auth.dbUser!.auth_user_id,
        partner_auth_id: partnerAuthId,
        area_max_capacity: normalizeNumeric(area.max_capacity),
        expires_at: expiresAt,
      },
    });

    const successUrl = parsed.data.successUrl ??
      `${APP_URL}/marketplace/${area.space.id}?booking_id=${bookingRow.id}&payment=success`;
    const cancelUrl = parsed.data.cancelUrl ??
      `${APP_URL}/marketplace/${area.space.id}?booking_id=${bookingRow.id}&payment=cancel`;

    const metadata = {
      booking_id: bookingRow.id,
      space_id: bookingRow.space_id,
      area_id: bookingRow.area_id,
      internal_user_id: auth.dbUser!.user_id.toString(),
    } satisfies Record<string, string>;

    if (isTestingModeEnabled()) {
      const confirmedBooking = await prisma.booking.update({
        where: { id: bookingRow.id, },
        data: { status: 'confirmed', },
      });

      const booking = mapBookingRowToRecord(confirmedBooking);
      const bookingHref = `/marketplace/${booking.spaceId}`;

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

      try {
        const adminClient = getSupabaseAdminClient();
        const {
 data: userData, error: userError, 
} = await adminClient.auth.admin.getUserById(
          booking.customerAuthId
        );

        if (userError) {
          console.warn('Unable to read customer email for booking notification', userError);
        }

        const userEmail = userData?.user?.email;
        if (userEmail) {
          await sendBookingNotificationEmail({
            to: userEmail,
            spaceName: booking.spaceName,
            areaName: booking.areaName,
            bookingHours: booking.bookingHours,
            price: booking.price,
            link: `${APP_URL}${bookingHref}`,
          });
        }
      } catch (notifyError) {
        console.error('Failed to send booking notification email', notifyError);
      }

      return NextResponse.json(
        {
          bookingId: booking.id,
          checkoutUrl: successUrl,
          testingMode: true,
        },
        { status: 201, }
      );
    }

    const checkoutSession = await createPaymongoCheckoutSession({
      amountMinor: priceMinor,
      currency: bookingRow.currency,
      description: `${area.space.name} · ${area.name}`,
      successUrl,
      cancelUrl,
      metadata,
      lineItems: [
        {
          quantity: 1,
          price_data: {
            currency: bookingRow.currency,
            unit_amount: priceMinor,
            product_data: { name: `${area.space.name} · ${area.name}`, },
          },
        }
      ],
    });

    return NextResponse.json(
      {
        bookingId: bookingRow.id,
        checkoutUrl: checkoutSession.data.attributes.checkout_url,
      },
      { status: 201, }
    );
  } catch (error) {
    console.error('Failed to create PayMongo checkout session', error);
    return NextResponse.json(
      { error: 'Unable to start checkout session.', },
      { status: 500, }
    );
  }
}

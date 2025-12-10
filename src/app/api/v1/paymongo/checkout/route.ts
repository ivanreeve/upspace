import { randomUUID } from 'crypto';

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { BOOKING_PRICE_MINOR_FACTOR, mapBookingRowToRecord, normalizeNumeric } from '@/lib/bookings/serializer';
import { MAX_BOOKING_HOURS, MIN_BOOKING_HOURS } from '@/lib/bookings/constants';
import { countActiveBookingsOverlap, resolveBookingDecision } from '@/lib/bookings/occupancy';
import { sendBookingNotificationEmail } from '@/lib/email';
import { createPaymongoCheckoutSession } from '@/lib/paymongo';
import { prisma } from '@/lib/prisma';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';
import { isTestingModeEnabled } from '@/lib/testing-mode';
import { recordTestModeBookingWalletCharge, resolveAuthenticatedUserForWallet } from '@/lib/wallet-server';
import { evaluatePriceRule } from '@/lib/pricing-rules-evaluator';
import type { PriceRuleRecord } from '@/lib/pricing-rules';

const checkoutPayloadSchema = z.object({
  spaceId: z.string().uuid(),
  areaId: z.string().uuid(),
  bookingHours: z.number().int().min(MIN_BOOKING_HOURS).max(MAX_BOOKING_HOURS),
  price: z.number().positive(),
  startAt: z.string().datetime().optional(),
  guestCount: z.number().int().min(1).max(999).optional(),
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

const DEFAULT_APP_URL = 'http://localhost:3000';
const APP_URL = (process.env.NEXT_PUBLIC_APP_URL && process.env.NEXT_PUBLIC_APP_URL.trim().length > 0
  ? process.env.NEXT_PUBLIC_APP_URL
  : DEFAULT_APP_URL).replace(/\/+$/, '');

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

    if (auth.dbUser?.role !== 'customer') {
      return unauthorizedResponse;
    }

    const startAt = parsed.data.startAt ? new Date(parsed.data.startAt) : null;
    const startAtDate = startAt && Number.isFinite(startAt.getTime()) ? startAt : null;
    if (!startAtDate) {
      return NextResponse.json(
        { error: 'Please choose a booking start date.', },
        { status: 400, }
      );
    }

    const now = new Date();
    if (startAtDate.getTime() < now.getTime()) {
      return NextResponse.json(
        { error: 'Start time must be in the future.', },
        { status: 400, }
      );
    }

    const area = await prisma.area.findUnique({
      where: { id: parsed.data.areaId, },
      select: {
        id: true,
        name: true,
        max_capacity: true,
        automatic_booking_enabled: true,
        request_approval_at_capacity: true,
        space_id: true,
        advance_booking_enabled: true,
        advance_booking_value: true,
        advance_booking_unit: true,
        price_rule: {
          select: {
            id: true,
            name: true,
            definition: true,
          },
        },
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

    const guestCount = parsed.data.guestCount ?? 1;
    const areaMaxCapacity = normalizeNumeric(area.max_capacity);
    if (areaMaxCapacity !== null && guestCount > areaMaxCapacity) {
      return NextResponse.json(
        { error: `This area allows up to ${areaMaxCapacity} guests.`, },
        { status: 400, }
      );
    }

    if (area.advance_booking_enabled && area.advance_booking_value && area.advance_booking_unit) {
      const leadMs = (() => {
        const unit = area.advance_booking_unit;
        const value = area.advance_booking_value;
        switch (unit) {
          case 'days':
            return value * 24 * 60 * 60 * 1000;
          case 'weeks':
            return value * 7 * 24 * 60 * 60 * 1000;
          case 'months':
            return value * 30 * 24 * 60 * 60 * 1000;
          default:
            return 0;
        }
      })();
      const minStart = new Date(now.getTime() + leadMs);
      if (startAtDate.getTime() < minStart.getTime()) {
        return NextResponse.json(
          { error: 'Please book further in advance for this area.', },
          { status: 400, }
        );
      }
    }

    const partnerAuthId = area.space.user?.auth_user_id ?? null;
    const bookingStartAt = startAtDate;
    const expiresAt = new Date(bookingStartAt.getTime() + parsed.data.bookingHours * 60 * 60 * 1000);

    class CapacityReachedError extends Error {}

    const priceRule = area.price_rule as PriceRuleRecord | null;
    if (!priceRule) {
      return NextResponse.json(
        { error: 'Pricing is unavailable for this area.', },
        { status: 400, }
      );
    }

    const priceEvaluation = (() => {
      try {
        return evaluatePriceRule(priceRule.definition, {
          bookingHours: parsed.data.bookingHours,
          now: bookingStartAt,
          variableOverrides: { guest_count: guestCount, },
        });
      } catch (error) {
        console.error('Invalid price rule definition', {
          areaId: area.id,
          error,
        });
        return { price: null, };
      }
    })();

    if (priceEvaluation.price === null) {
      return NextResponse.json(
        { error: 'Unable to compute a price for this booking.', },
        { status: 400, }
      );
    }

    const priceMinor = Math.round(priceEvaluation.price * guestCount * BOOKING_PRICE_MINOR_FACTOR);

    const bookingResult = await prisma
      .$transaction(
        async (tx) => {
          const activeCount = await countActiveBookingsOverlap(
            tx,
            area.id,
            bookingStartAt,
            expiresAt
          );

          const approval = resolveBookingDecision({
            automaticBookingEnabled: Boolean(area.automatic_booking_enabled),
            requestApprovalAtCapacity: Boolean(area.request_approval_at_capacity),
            maxCapacity: areaMaxCapacity,
            activeCount,
            requestedGuestCount: guestCount,
          });
          const requiresHostApproval = approval.status === 'pending';

          if (approval.status === 'reject_full') {
            throw new CapacityReachedError('This area is fully booked for this time window.');
          }

          const created = await tx.booking.create({
            data: {
              id: randomUUID(),
              space_id: parsed.data.spaceId,
              space_name: area.space.name,
              area_id: area.id,
              area_name: area.name,
              booking_hours: parsed.data.bookingHours,
              start_at: bookingStartAt,
              price_minor: priceMinor,
              currency: 'PHP',
              status: approval.status === 'confirmed' ? 'pending' : approval.status,
              user_auth_id: auth.dbUser!.auth_user_id,
              partner_auth_id: partnerAuthId,
              area_max_capacity: areaMaxCapacity,
              guest_count: guestCount,
              expires_at: expiresAt,
            },
          });

          return {
            bookingRow: created,
            requiresHostApproval,
          };
        },
        { isolationLevel: 'Serializable', }
      )
      .catch((error) => {
        if (error instanceof CapacityReachedError) {
          return null;
        }
        throw error;
      });

    if (!bookingResult) {
      return NextResponse.json(
        { error: 'This area is fully booked for the requested time window.', },
        { status: 409, }
      );
    }

    const {
      bookingRow,
      requiresHostApproval,
    } = bookingResult;

    const successUrl = parsed.data.successUrl ??
      `${APP_URL}/marketplace/${area.space.id}?booking_id=${bookingRow.id}&payment=success`;
    const cancelUrl = parsed.data.cancelUrl ??
      `${APP_URL}/marketplace/${area.space.id}?booking_id=${bookingRow.id}&payment=cancel`;

    const partnerWalletOwner = partnerAuthId
      ? await prisma.user.findUnique({
          where: { auth_user_id: partnerAuthId, },
          select: { user_id: true, },
        })
      : null;
    const partnerInternalUserId = partnerWalletOwner?.user_id?.toString() ?? null;

    const metadata = {
      booking_id: bookingRow.id,
      space_id: bookingRow.space_id,
      area_id: bookingRow.area_id,
      internal_user_id: auth.dbUser!.user_id.toString(),
      customer_internal_user_id: auth.dbUser!.user_id.toString(),
      requires_host_approval: requiresHostApproval ? 'true' : 'false',
      ...(partnerInternalUserId
        ? { partner_internal_user_id: partnerInternalUserId, }
        : {}),
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

      if (partnerWalletOwner?.user_id) {
        const walletMetadata: Record<string, unknown> = { customer_internal_user_id: auth.dbUser!.user_id.toString(), };

        if (partnerInternalUserId) {
          walletMetadata.partner_internal_user_id = partnerInternalUserId;
        }

        if (partnerAuthId) {
          walletMetadata.partner_auth_id = partnerAuthId;
        }

        try {
          await recordTestModeBookingWalletCharge({
            walletOwnerUserId: partnerWalletOwner.user_id,
            bookingId: booking.id,
            amountMinor: priceMinor,
            currency: confirmedBooking.currency,
            description: `${booking.areaName} · ${booking.spaceName}`,
            metadata: walletMetadata,
          });
        } catch (walletError) {
          console.error('Failed to record wallet activity in testing mode', {
            bookingId: booking.id,
            error: walletError,
          });
        }
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
      lineItemName: area.name,
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

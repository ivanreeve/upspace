import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { prisma } from '@/lib/prisma';
import { mapBookingRowToRecord } from '@/lib/bookings/serializer';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';
import { sendBookingNotificationEmail } from '@/lib/email';
import { isPaymongoSignatureFresh, parsePaymongoSignatureHeader, verifyPaymongoSignature } from '@/lib/paymongo';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? '';

const walletEventSchema = z.object({
  data: z.object({
    attributes: z.object({
      type: z.string(),
      livemode: z.boolean(),
      data: z.object({
        object: z.object({
          id: z.string(),
          wallet_id: z.string().nullable(),
          type: z.string(),
          status: z.enum(['pending', 'succeeded', 'failed']),
          amount_minor: z.number(),
          net_amount_minor: z.number().nullable(),
          currency: z.string(),
          description: z.string().nullable(),
          external_reference: z.string().nullable(),
          metadata: z.record(z.string(), z.any()).nullable(),
          booking_id: z.string().uuid().nullable(),
          created_at: z.union([z.number(), z.string()]),
        }),
      }),
    }),
  }),
});

type WalletEvent = z.infer<typeof walletEventSchema>['data']['attributes'];

const checkoutEventSchema = z.object({
  data: z.object({
    attributes: z.object({
      type: z.string(),
      livemode: z.boolean(),
      data: z.object({
        object: z.object({
          id: z.string(),
          amount: z.number(),
          currency: z.string(),
          metadata: z.record(z.string(), z.string()).nullable(),
          status: z.string(),
        }),
      }),
    }),
  }),
});

type CheckoutEvent = z.infer<typeof checkoutEventSchema>['data']['attributes'];

function resolveTransactionType(eventType: string) {
  const match = eventType.match(/^wallet\.transaction\.(cash_in|charge|refund|payout)/);
  return match ? (match[1] as 'cash_in' | 'charge' | 'refund' | 'payout') : null;
}

function normalizeTimestamp(value: number | string) {
  const parsed = typeof value === 'string' ? Number(value) : value;
  if (!Number.isFinite(parsed)) {
    return new Date();
  }

  return parsed > 1e12 ? new Date(parsed) : new Date(parsed * 1000);
}

function getInternalUserId(metadata: Record<string, unknown> | null) {
  if (!metadata) return null;

  const candidate = metadata.internal_user_id ?? metadata.user_id;
  if (candidate == null) return null;

  if (typeof candidate === 'string') {
    const numeric = Number(candidate);
    return Number.isFinite(numeric) ? BigInt(Math.trunc(numeric)) : null;
  }

  if (typeof candidate === 'number') {
    return BigInt(Math.trunc(candidate));
  }

  if (typeof candidate === 'bigint') {
    return candidate;
  }

  return null;
}

const RECEIVED_RESPONSE = NextResponse.json({ received: true, }, { status: 200, });

async function handleWalletEvent(event: WalletEvent) {
  const walletObject = event.data.object;
  const transactionType = resolveTransactionType(event.type);
  if (!transactionType) {
    return RECEIVED_RESPONSE;
  }

  const internalUserId = getInternalUserId(walletObject.metadata);
  if (!internalUserId) {
    console.warn('PayMongo wallet webhook missing internal_user_id metadata');
    return RECEIVED_RESPONSE;
  }

  const walletRow = await prisma.wallet.findUnique({ where: { user_id: internalUserId, }, });

  if (!walletRow) {
    console.warn('Wallet webhook could not find internal wallet', internalUserId.toString());
    return RECEIVED_RESPONSE;
  }

  const alreadyProcessed = await prisma.wallet_transaction.findFirst({ where: { external_reference: walletObject.id, }, });

  if (alreadyProcessed) {
    return RECEIVED_RESPONSE;
  }

  const amountMinor = BigInt(Math.round(walletObject.amount_minor));
  const netAmount = walletObject.net_amount_minor
    ? BigInt(Math.round(walletObject.net_amount_minor))
    : null;
  const recordedAt = normalizeTimestamp(walletObject.created_at);
  const status = walletObject.status as 'pending' | 'succeeded' | 'failed';

  const balanceDelta =
    status === 'succeeded'
      ? (transactionType === 'cash_in' || transactionType === 'refund'
        ? amountMinor
        : amountMinor * -1n)
      : 0n;

  await prisma.$transaction(async (tx) => {
    await tx.wallet_transaction.create({
      data: {
        wallet_id: walletRow.id,
        type: transactionType,
        status,
        amount_minor: amountMinor,
        net_amount_minor: netAmount,
        currency: walletObject.currency || walletRow.currency,
        description: walletObject.description ?? null,
        external_reference: walletObject.id,
        metadata: (walletObject.metadata as any) ?? null,
        booking_id: walletObject.booking_id ?? null,
        created_at: recordedAt,
        updated_at: recordedAt,
      },
    });

    if (balanceDelta !== 0n) {
      await tx.wallet.update({
        where: { id: walletRow.id, },
        data: {
          balance_minor: { increment: balanceDelta as bigint, },
          updated_at: new Date(),
        },
      });
    }
  });

  return RECEIVED_RESPONSE;
}

async function handleCheckoutEvent(event: CheckoutEvent) {
  if (!event.type.includes('paid')) {
    return RECEIVED_RESPONSE;
  }

  const checkoutObject = event.data.object;
  const metadata = checkoutObject.metadata ?? {};
  const bookingId = metadata.booking_id ?? metadata.bookingId ?? null;
  if (!bookingId) {
    console.warn('PayMongo checkout webhook missing booking metadata');
    return RECEIVED_RESPONSE;
  }

  const bookingRow = await prisma.booking.findUnique({ where: { id: bookingId, }, });

  if (!bookingRow) {
    console.warn('Checkout webhook could not find booking', bookingId);
    return RECEIVED_RESPONSE;
  }

  if (bookingRow.status === 'confirmed') {
    return RECEIVED_RESPONSE;
  }

  const updatedBooking = await prisma.booking.update({
    where: { id: bookingId, },
    data: { status: 'confirmed', },
  });

  const booking = mapBookingRowToRecord(updatedBooking);
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

  return RECEIVED_RESPONSE;
}

export async function POST(req: NextRequest) {
  const signatureHeader = req.headers.get('Paymongo-Signature');
  const signature = parsePaymongoSignatureHeader(signatureHeader);
  if (!signature) {
    return NextResponse.json(
      { message: 'Missing or malformed signature header.', },
      { status: 400, }
    );
  }

  const buffer = await req.arrayBuffer();
  const payloadText = new TextDecoder().decode(buffer);
  let parsedPayload: Record<string, unknown> | null = null;

  try {
    parsedPayload = JSON.parse(payloadText);
  } catch (error) {
    console.error('Failed to parse PayMongo webhook payload', error);
    return NextResponse.json(
      { message: 'Invalid webhook payload.', },
      { status: 400, }
    );
  }

  const attributes = (parsedPayload?.data as Record<string, unknown> | undefined)
    ?.attributes as Record<string, unknown> | undefined;
  const isLive = attributes?.livemode === true;

  if (!verifyPaymongoSignature({
    payload: payloadText,
    signature,
    useLiveSignature: isLive,
  })) {
    return NextResponse.json(
      { message: 'Invalid PayMongo signature.', },
      { status: 401, }
    );
  }

  if (!(await isPaymongoSignatureFresh(signature))) {
    return NextResponse.json(
      { message: 'Stale PayMongo signature.', },
      { status: 400, }
    );
  }

  const eventType = attributes?.type;
  if (!eventType || typeof eventType !== 'string') {
    return RECEIVED_RESPONSE;
  }

  if (eventType.startsWith('wallet.transaction')) {
    const validation = walletEventSchema.safeParse(parsedPayload);
    if (!validation.success) {
      return NextResponse.json(
        { message: 'Unexpected wallet webhook payload schema.', },
        { status: 400, }
      );
    }

    return handleWalletEvent(validation.data.data.attributes);
  }

  if (eventType.includes('checkout')) {
    const validation = checkoutEventSchema.safeParse(parsedPayload);
    if (!validation.success) {
      console.warn('Unexpected checkout webhook payload');
      return RECEIVED_RESPONSE;
    }

    return handleCheckoutEvent(validation.data.data.attributes);
  }

  return RECEIVED_RESPONSE;
}

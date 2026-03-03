import { Prisma } from '@prisma/client';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { countActiveBookingsOverlap } from '@/lib/bookings/occupancy';
import { mapBookingRowToRecord } from '@/lib/bookings/serializer';
import { sendBookingNotificationEmail, sendRefundNotificationEmail } from '@/lib/email';
import { notifyBookingEvent } from '@/lib/notifications/booking';
import { resolveBookingIdFromPaymongoMetadata } from '@/lib/paymongo-payment-events';
import { prisma } from '@/lib/prisma';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';
import { formatCurrencyMinor } from '@/lib/wallet';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? '';

export const walletEventSchema = z.object({
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

export type WalletEvent = z.infer<typeof walletEventSchema>['data']['attributes'];

export const checkoutEventSchema = z.object({
  data: z.object({
    attributes: z.object({
      type: z.string(),
      livemode: z.boolean(),
      created_at: z.union([z.number(), z.string()]).optional(),
      data: z.object({
        id: z.string().optional(),
        object: z.object({
          id: z.string(),
          amount: z.number(),
          currency: z.string(),
          metadata: z.record(z.string(), z.unknown()).nullable(),
          status: z.string(),
        }),
      }),
    }),
  }),
});

export type CheckoutEvent = z.infer<typeof checkoutEventSchema>['data']['attributes'];

export const paymentEventSchema = z.object({
  data: z.object({
    attributes: z.object({
      type: z.string(),
      livemode: z.boolean(),
      created_at: z.union([z.number(), z.string()]).optional(),
      data: z.object({
        id: z.string().optional(),
        object: z.object({
          id: z.string(),
          amount: z.number().optional(),
          currency: z.string().optional(),
          metadata: z.record(z.string(), z.unknown()).nullable(),
          status: z.string(),
        }),
      }),
    }),
  }),
});

export type PaymentEvent = z.infer<typeof paymentEventSchema>['data']['attributes'];

const RECEIVED_RESPONSE = NextResponse.json({ received: true, }, { status: 200, });

const normalizeCurrencyCode = (value: string | null | undefined) =>
  (value ?? '').trim().toUpperCase();

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

  const candidate =
    metadata.partner_internal_user_id ??
    metadata.partner_user_id ??
    metadata.internal_user_id ??
    metadata.user_id;
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

type CheckoutPaymentEventRecord = {
  id: string | null;
  duplicate: boolean;
};

type CheckoutPaymentEventStatus = 'processed' | 'ignored' | 'failed';
type BookingWebhookRow = Exclude<Awaited<ReturnType<typeof prisma.booking.findUnique>>, null>;

type PaymongoPaymentLikeEvent = {
  type: string;
  livemode: boolean;
  created_at?: number | string;
  data: {
    id?: string;
    object: {
      id: string;
      status: string;
    };
  };
};

function resolveProviderEventId(event: PaymongoPaymentLikeEvent) {
  const explicitId = event.data.id?.trim();
  if (explicitId) {
    return explicitId;
  }

  const mode = event.livemode ? 'live' : 'test';
  return `${event.type}:${event.data.object.id}:${mode}`;
}

function resolvePaymentTransactionStatus(event: PaymongoPaymentLikeEvent) {
  const normalizedType = event.type.toLowerCase();
  const normalizedStatus = event.data.object.status.toLowerCase();

  if (normalizedType.includes('refunded') || normalizedStatus === 'refunded') {
    return 'refunded' as const;
  }

  if (normalizedType.includes('failed') || normalizedStatus === 'failed') {
    return 'failed' as const;
  }

  if (normalizedType.includes('cancel') || normalizedType.includes('expire') || normalizedStatus === 'expired') {
    return 'cancelled' as const;
  }

  if (normalizedType.includes('paid') || normalizedStatus === 'paid') {
    return 'succeeded' as const;
  }

  return 'pending' as const;
}

function resolveEventOccurredAt(event: PaymongoPaymentLikeEvent) {
  if (event.created_at == null) {
    return new Date();
  }

  return normalizeTimestamp(event.created_at);
}

async function recordCheckoutPaymentEvent(event: PaymongoPaymentLikeEvent): Promise<CheckoutPaymentEventRecord> {
  const providerEventId = resolveProviderEventId(event);
  const checkoutObject = event.data.object;

  try {
    const created = await prisma.payment_event.create({
      data: {
        provider: 'paymongo',
        provider_event_id: providerEventId,
        event_type: event.type,
        provider_object_id: checkoutObject.id,
        livemode: event.livemode,
        payload_json: event as unknown as Prisma.InputJsonValue,
      },
      select: { id: true, },
    });

    return {
      id: created.id,
      duplicate: false,
    };
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      return {
        id: null,
        duplicate: true,
      };
    }

    console.error('Failed to record PayMongo payment event', {
      providerEventId,
      error,
    });
    throw error;
  }
}

async function finalizeCheckoutPaymentEvent(opts: {
  paymentEventId: string | null;
  status: CheckoutPaymentEventStatus;
  errorMessage?: string;
}) {
  const {
    paymentEventId,
    status,
    errorMessage,
  } = opts;
  if (!paymentEventId) {
    return;
  }

  try {
    await prisma.payment_event.update({
      where: { id: paymentEventId, },
      data: {
        processing_status: status,
        processed_at: new Date(),
        error_message: errorMessage ?? null,
      },
    });
  } catch (error) {
    console.error('Failed to update payment event processing status', {
      paymentEventId,
      status,
      error,
    });
  }
}

async function recordNormalizedCheckoutTransaction(opts: {
  bookingId: string;
  event: CheckoutEvent;
  paymentEventId: string | null;
}) {
  const {
    bookingId,
    event,
    paymentEventId,
  } = opts;
  const checkoutObject = event.data.object;
  const amountMinor = Math.round(checkoutObject.amount ?? 0);
  const currency = checkoutObject.currency ?? 'PHP';

  await prisma.payment_transaction.upsert({
    where: {
      provider_provider_object_id: {
        provider: 'paymongo',
        provider_object_id: checkoutObject.id,
      },
    },
    create: {
      booking_id: bookingId,
      provider: 'paymongo',
      provider_object_id: checkoutObject.id,
      payment_event_id: paymentEventId,
      status: resolvePaymentTransactionStatus(event),
      amount_minor: BigInt(Number.isFinite(amountMinor) ? amountMinor : 0),
      currency_iso3: currency,
      is_live: event.livemode,
      occurred_at: resolveEventOccurredAt(event),
      raw_gateway_json: checkoutObject as unknown as Prisma.InputJsonValue,
    },
    update: {
      booking_id: bookingId,
      payment_event_id: paymentEventId,
      status: resolvePaymentTransactionStatus(event),
      amount_minor: BigInt(Number.isFinite(amountMinor) ? amountMinor : 0),
      currency_iso3: currency,
      is_live: event.livemode,
      occurred_at: resolveEventOccurredAt(event),
      raw_gateway_json: checkoutObject as unknown as Prisma.InputJsonValue,
      updated_at: new Date(),
    },
  });
}

async function recordCheckoutTransaction(opts: {
  bookingId: string;
  event: CheckoutEvent;
  paymentEventId: string | null;
}) {
  const {
    bookingId,
    event,
    paymentEventId,
  } = opts;

  try {
    await recordNormalizedCheckoutTransaction({
      bookingId,
      event,
      paymentEventId,
    });
  } catch (error) {
    console.error('Failed to record checkout transaction', {
      bookingId,
      checkoutObjectId: event.data.object.id,
      error,
    });
  }
}

async function recordPaymentTransactionFromPaymentEvent(opts: {
  bookingId: string;
  event: PaymentEvent;
  paymentEventId: string | null;
  fallbackAmountMinor: number;
  fallbackCurrency: string;
}) {
  const {
    bookingId,
    event,
    paymentEventId,
    fallbackAmountMinor,
    fallbackCurrency,
  } = opts;

  const paymentObject = event.data.object;
  const amountMinor = Math.round(paymentObject.amount ?? fallbackAmountMinor);
  const currency = paymentObject.currency ?? fallbackCurrency;
  const resolvedStatus = resolvePaymentTransactionStatus(event);
  const occurredAt = resolveEventOccurredAt(event);

  const existingByBooking = await prisma.payment_transaction.findFirst({
    where: {
      booking_id: bookingId,
      provider: 'paymongo',
    },
    orderBy: { created_at: 'desc', },
    select: { id: true, },
  });

  if (existingByBooking) {
    await prisma.payment_transaction.update({
      where: { id: existingByBooking.id, },
      data: {
        payment_event_id: paymentEventId,
        status: resolvedStatus,
        amount_minor: BigInt(Number.isFinite(amountMinor) ? amountMinor : 0),
        currency_iso3: currency,
        is_live: event.livemode,
        occurred_at: occurredAt,
        raw_gateway_json: paymentObject as unknown as Prisma.InputJsonValue,
        updated_at: new Date(),
      },
    });
    return;
  }

  await prisma.payment_transaction.upsert({
    where: {
      provider_provider_object_id: {
        provider: 'paymongo',
        provider_object_id: paymentObject.id,
      },
    },
    create: {
      booking_id: bookingId,
      provider: 'paymongo',
      provider_object_id: paymentObject.id,
      payment_event_id: paymentEventId,
      status: resolvedStatus,
      amount_minor: BigInt(Number.isFinite(amountMinor) ? amountMinor : 0),
      currency_iso3: currency,
      is_live: event.livemode,
      occurred_at: occurredAt,
      raw_gateway_json: paymentObject as unknown as Prisma.InputJsonValue,
    },
    update: {
      booking_id: bookingId,
      payment_event_id: paymentEventId,
      status: resolvedStatus,
      amount_minor: BigInt(Number.isFinite(amountMinor) ? amountMinor : 0),
      currency_iso3: currency,
      is_live: event.livemode,
      occurred_at: occurredAt,
      raw_gateway_json: paymentObject as unknown as Prisma.InputJsonValue,
      updated_at: new Date(),
    },
  });
}

export async function handleWalletEvent(event: WalletEvent) {
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

  const alreadyProcessed = await prisma.wallet_transaction.findFirst({
    where: { external_reference: walletObject.id, },
    select: {
      id: true,
      status: true,
      wallet_id: true,
    },
  });

  const amountMinor = BigInt(Math.round(walletObject.amount_minor));
  const netAmount = walletObject.net_amount_minor
    ? BigInt(Math.round(walletObject.net_amount_minor))
    : null;
  const recordedAt = normalizeTimestamp(walletObject.created_at);
  const status = walletObject.status as 'pending' | 'succeeded' | 'failed';

  const balanceDelta =
    status === 'succeeded'
      ? (transactionType === 'cash_in' || transactionType === 'charge'
        ? amountMinor
        : amountMinor * -1n)
      : 0n;

  let shouldSkipMutation = false;
  if (alreadyProcessed) {
    if (alreadyProcessed.status === 'succeeded' && status !== 'succeeded') {
      return RECEIVED_RESPONSE;
    }

    if (alreadyProcessed.status === status) {
      shouldSkipMutation = true;
    } else {
      await prisma.$transaction(async (tx) => {
        await tx.wallet_transaction.update({
          where: { id: alreadyProcessed.id, },
          data: {
            status,
            amount_minor: amountMinor,
            net_amount_minor: netAmount,
            currency: walletObject.currency || walletRow.currency,
            description: walletObject.description ?? null,
            metadata: (walletObject.metadata as Prisma.InputJsonValue) ?? null,
            booking_id: walletObject.booking_id ?? null,
            updated_at: recordedAt,
          },
        });

        if (status === 'succeeded' && balanceDelta !== 0n) {
          await tx.wallet.update({
            where: { id: alreadyProcessed.wallet_id, },
            data: {
              balance_minor: { increment: balanceDelta as bigint, },
              updated_at: new Date(),
            },
          });
        }
      });
    }
  }

  if (!alreadyProcessed && !shouldSkipMutation) {
    try {
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
            metadata: (walletObject.metadata as Prisma.InputJsonValue) ?? null,
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
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        return RECEIVED_RESPONSE;
      }
      throw error;
    }
  }

  // Notify customer about refund completion or failure
  if (
    transactionType === 'refund' &&
    walletObject.booking_id &&
    (status === 'succeeded' || status === 'failed')
  ) {
    try {
      const bookingRow = await prisma.booking.findUnique({
        where: { id: walletObject.booking_id, },
        select: {
          id: true,
          space_id: true,
          space_name: true,
          area_id: true,
          area_name: true,
          user_auth_id: true,
          partner_auth_id: true,
        },
      });

      if (bookingRow) {
        const refundLabel = status === 'succeeded' ? 'Refund completed' : 'Refund failed';
        const refundBody = status === 'succeeded'
          ? `Your refund of ${formatCurrencyMinor(amountMinor, walletObject.currency)} for ${bookingRow.area_name} · ${bookingRow.space_name} has been completed.`
          : `Your refund for ${bookingRow.area_name} · ${bookingRow.space_name} could not be processed. Please contact support.`;

        await notifyBookingEvent(
          {
            bookingId: bookingRow.id,
            spaceId: bookingRow.space_id,
            areaId: bookingRow.area_id,
            spaceName: bookingRow.space_name,
            areaName: bookingRow.area_name,
            customerAuthId: bookingRow.user_auth_id,
            partnerAuthId: bookingRow.partner_auth_id,
          },
          {
 title: refundLabel,
body: refundBody, 
},
          null
        );

        try {
          const adminClient = getSupabaseAdminClient();
          const { data: userData, } = await adminClient.auth.admin.getUserById(bookingRow.user_auth_id);
          if (userData?.user?.email) {
            await sendRefundNotificationEmail({
              to: userData.user.email,
              spaceName: bookingRow.space_name,
              areaName: bookingRow.area_name,
              amount: formatCurrencyMinor(amountMinor, walletObject.currency),
              status,
              link: `${APP_URL}/marketplace/${bookingRow.space_id}`,
            });
          }
        } catch (emailError) {
          console.error('Failed to send refund notification email', {
 bookingId: bookingRow.id,
error: emailError, 
});
        }
      }
    } catch (notifError) {
      console.error('Failed to create refund notification', {
 bookingId: walletObject.booking_id,
error: notifError, 
});
    }
  }

  return RECEIVED_RESPONSE;
}

async function finalizePaidBooking(opts: {
  bookingRow: BookingWebhookRow;
  paymentEventId: string | null;
  requiresHostApproval: boolean;
}) {
  const {
    bookingRow,
    paymentEventId,
    requiresHostApproval,
  } = opts;

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

    await finalizeCheckoutPaymentEvent({
      paymentEventId,
      status: 'processed',
    });
    return RECEIVED_RESPONSE;
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

      await finalizeCheckoutPaymentEvent({
        paymentEventId,
        status: 'processed',
      });
      return RECEIVED_RESPONSE;
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

  await finalizeCheckoutPaymentEvent({
    paymentEventId,
    status: 'processed',
  });
  return RECEIVED_RESPONSE;
}

export async function handleCheckoutEvent(event: CheckoutEvent) {
  if (!event.type.includes('paid')) {
    return RECEIVED_RESPONSE;
  }

  const paymentEvent = await recordCheckoutPaymentEvent(event);
  if (paymentEvent.duplicate) {
    return RECEIVED_RESPONSE;
  }

  const checkoutObject = event.data.object;
  const metadata = checkoutObject.metadata ?? null;
  const bookingId = resolveBookingIdFromPaymongoMetadata(metadata);
  const requiresHostApproval = metadata?.requires_host_approval === 'true';
  if (!bookingId) {
    console.warn('PayMongo checkout webhook missing booking metadata');
    await finalizeCheckoutPaymentEvent({
      paymentEventId: paymentEvent.id,
      status: 'ignored',
      errorMessage: 'Missing booking metadata.',
    });
    return RECEIVED_RESPONSE;
  }

  const bookingRow = await prisma.booking.findUnique({ where: { id: bookingId, }, });

  if (!bookingRow) {
    console.warn('Checkout webhook could not find booking', bookingId);
    await finalizeCheckoutPaymentEvent({
      paymentEventId: paymentEvent.id,
      status: 'ignored',
      errorMessage: 'Booking not found.',
    });
    return RECEIVED_RESPONSE;
  }

  if (bookingRow.status === 'confirmed') {
    await finalizeCheckoutPaymentEvent({
      paymentEventId: paymentEvent.id,
      status: 'ignored',
      errorMessage: 'Booking already confirmed.',
    });
    return RECEIVED_RESPONSE;
  }

  if (bookingRow.status !== 'pending') {
    console.warn('Checkout webhook received non-pending booking', {
      bookingId,
      status: bookingRow.status,
    });
    await finalizeCheckoutPaymentEvent({
      paymentEventId: paymentEvent.id,
      status: 'ignored',
      errorMessage: `Booking status is ${bookingRow.status}.`,
    });
    return RECEIVED_RESPONSE;
  }

  const expectedAmountMinor =
    bookingRow.price_minor === null
      ? null
      : Number(bookingRow.price_minor);
  const paidAmountMinor = Math.round(checkoutObject.amount ?? 0);

  const amountMatches =
    expectedAmountMinor !== null &&
    Number.isFinite(expectedAmountMinor) &&
    expectedAmountMinor === paidAmountMinor;
  const currencyMatches =
    normalizeCurrencyCode(bookingRow.currency) === normalizeCurrencyCode(checkoutObject.currency);

  if (!amountMatches || !currencyMatches) {
    console.error('Checkout webhook amount/currency mismatch', {
      bookingId,
      bookingStatus: bookingRow.status,
      expectedAmountMinor,
      paidAmountMinor,
      expectedCurrency: bookingRow.currency,
      paidCurrency: checkoutObject.currency,
    });
    await finalizeCheckoutPaymentEvent({
      paymentEventId: paymentEvent.id,
      status: 'ignored',
      errorMessage: 'Amount or currency mismatch.',
    });
    return RECEIVED_RESPONSE;
  }

  await recordCheckoutTransaction({
    bookingId,
    event,
    paymentEventId: paymentEvent.id,
  });

  return finalizePaidBooking({
    bookingRow,
    paymentEventId: paymentEvent.id,
    requiresHostApproval,
  });
}

export async function handlePaymentEvent(event: PaymentEvent) {
  const paymentEvent = await recordCheckoutPaymentEvent(event);
  if (paymentEvent.duplicate) {
    return RECEIVED_RESPONSE;
  }

  const paymentObject = event.data.object;
  const metadata = paymentObject.metadata ?? null;
  const bookingId = resolveBookingIdFromPaymongoMetadata(metadata);

  if (!bookingId) {
    console.warn('PayMongo payment webhook missing booking metadata');
    await finalizeCheckoutPaymentEvent({
      paymentEventId: paymentEvent.id,
      status: 'ignored',
      errorMessage: 'Missing booking metadata.',
    });
    return RECEIVED_RESPONSE;
  }

  const bookingRow = await prisma.booking.findUnique({ where: { id: bookingId, }, });
  if (!bookingRow) {
    console.warn('Payment webhook could not find booking', bookingId);
    await finalizeCheckoutPaymentEvent({
      paymentEventId: paymentEvent.id,
      status: 'ignored',
      errorMessage: 'Booking not found.',
    });
    return RECEIVED_RESPONSE;
  }

  await recordPaymentTransactionFromPaymentEvent({
    bookingId,
    event,
    paymentEventId: paymentEvent.id,
    fallbackAmountMinor: bookingRow.price_minor === null ? 0 : Number(bookingRow.price_minor),
    fallbackCurrency: bookingRow.currency,
  });

  const resolvedStatus = resolvePaymentTransactionStatus(event);
  if (resolvedStatus === 'failed' || resolvedStatus === 'cancelled') {
    if (bookingRow.status === 'pending') {
      await prisma.booking.update({
        where: { id: bookingRow.id, },
        data: { status: 'cancelled', },
      });
    }

    await finalizeCheckoutPaymentEvent({
      paymentEventId: paymentEvent.id,
      status: 'processed',
    });
    return RECEIVED_RESPONSE;
  }

  if (resolvedStatus !== 'succeeded') {
    await finalizeCheckoutPaymentEvent({
      paymentEventId: paymentEvent.id,
      status: 'processed',
    });
    return RECEIVED_RESPONSE;
  }

  const amountProvided =
    typeof paymentObject.amount === 'number' &&
    Number.isFinite(paymentObject.amount);
  const expectedAmountMinor =
    bookingRow.price_minor === null ? null : Number(bookingRow.price_minor);
  const paidAmountMinor = amountProvided
    ? Math.round(paymentObject.amount ?? 0)
    : expectedAmountMinor;

  const amountMatches =
    expectedAmountMinor !== null &&
    Number.isFinite(expectedAmountMinor) &&
    paidAmountMinor !== null &&
    expectedAmountMinor === paidAmountMinor;

  const currencyMatches = paymentObject.currency
    ? normalizeCurrencyCode(bookingRow.currency) === normalizeCurrencyCode(paymentObject.currency)
    : true;

  if (!amountMatches || !currencyMatches) {
    console.error('Payment webhook amount/currency mismatch', {
      bookingId,
      bookingStatus: bookingRow.status,
      expectedAmountMinor,
      paidAmountMinor,
      expectedCurrency: bookingRow.currency,
      paidCurrency: paymentObject.currency,
    });
    await finalizeCheckoutPaymentEvent({
      paymentEventId: paymentEvent.id,
      status: 'ignored',
      errorMessage: 'Amount or currency mismatch.',
    });
    return RECEIVED_RESPONSE;
  }

  if (bookingRow.status === 'confirmed') {
    await finalizeCheckoutPaymentEvent({
      paymentEventId: paymentEvent.id,
      status: 'ignored',
      errorMessage: 'Booking already confirmed.',
    });
    return RECEIVED_RESPONSE;
  }

  if (bookingRow.status !== 'pending') {
    console.warn('Payment webhook received non-pending booking', {
      bookingId,
      status: bookingRow.status,
    });
    await finalizeCheckoutPaymentEvent({
      paymentEventId: paymentEvent.id,
      status: 'ignored',
      errorMessage: `Booking status is ${bookingRow.status}.`,
    });
    return RECEIVED_RESPONSE;
  }

  const requiresHostApproval = metadata?.requires_host_approval === 'true';

  return finalizePaidBooking({
    bookingRow,
    paymentEventId: paymentEvent.id,
    requiresHostApproval,
  });
}

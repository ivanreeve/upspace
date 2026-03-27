import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';

import { finalizeSuccessfulBookingPayment } from '@/lib/bookings/payment-finalization';
import { sendRefundNotificationEmail } from '@/lib/email';
import { applyXenditPayoutStatus, syncPartnerWalletFromRemoteAccountId } from '@/lib/financial/xendit-payouts';
import { notifyBookingEvent } from '@/lib/notifications/booking';
import { getFinancialProvider } from '@/lib/providers/provider-registry';
import { parseXenditInvoicePayload, parseXenditPayoutPayload, parseXenditRefundWebhookPayload } from '@/lib/providers/xendit/schemas';
import { prisma } from '@/lib/prisma';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';
import { ensureWalletRow } from '@/lib/wallet-server';
import { formatCurrencyMinor } from '@/lib/wallet';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? '';

function isJsonObject(value: Prisma.JsonValue | null | unknown): value is Prisma.JsonObject {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function buildRefundWebhookMetadata(
  metadata: Prisma.JsonValue | null,
  details: {
    providerStatus: string;
    failureReason: string | null;
    providerRefund: Prisma.InputJsonObject;
  }
): Prisma.InputJsonValue {
  const base = isJsonObject(metadata) ? metadata : {};
  const previousProvider =
    base.provider_refund && typeof base.provider_refund === 'object' && !Array.isArray(base.provider_refund)
      ? (base.provider_refund as Prisma.JsonObject)
      : {};

  return {
    ...base,
    provider_refund: {
      ...previousProvider,
      ...details.providerRefund,
      status: details.providerStatus,
      failure_reason: details.failureReason,
      updated_at: new Date().toISOString(),
    },
    failure_reason: details.failureReason,
  };
}

function mapInvoicePaymentStatus(rawStatus: string) {
  const normalized = rawStatus.trim().toUpperCase();
  if (normalized === 'PAID' || normalized === 'SETTLED') {
    return 'succeeded' as const;
  }

  if (normalized === 'EXPIRED') {
    return 'cancelled' as const;
  }

  if (normalized === 'FAILED') {
    return 'failed' as const;
  }

  return 'pending' as const;
}

function resolveInvoiceEventId(payload: ReturnType<typeof parseXenditInvoicePayload>) {
  const anchor =
    payload.paid_at ??
    payload.expiry_date ??
    payload.external_id;

  return `${payload.id}:${payload.status}:${anchor}`;
}

function resolveXenditWebhookToken() {
  return (
    process.env.XENDIT_WEBHOOK_VERIFICATION_TOKEN?.trim() ||
    process.env.XENDIT_CALLBACK_TOKEN?.trim() ||
    null
  );
}

function resolveBookingIdFromInvoicePayload(payload: ReturnType<typeof parseXenditInvoicePayload>) {
  const metadata = payload.metadata;
  if (metadata && typeof metadata.booking_id === 'string' && metadata.booking_id.length > 0) {
    return metadata.booking_id;
  }

  return payload.external_id;
}

function resolvePartnerProviderAccountId(
  rawGatewayJson: Prisma.JsonValue | null,
  metadata: Record<string, string> | null | undefined
) {
  if (metadata?.partner_provider_account_id) {
    return metadata.partner_provider_account_id;
  }

  if (!isJsonObject(rawGatewayJson)) {
    return null;
  }

  const rawValue = rawGatewayJson.partner_provider_account_id;
  return typeof rawValue === 'string' && rawValue.length > 0 ? rawValue : null;
}

async function resolvePartnerProviderAccountRecord(input: {
  providerAccountRecordId: string | null;
  partnerUserId: bigint | null;
}) {
  if (input.providerAccountRecordId) {
    const byId = await prisma.partner_provider_account.findUnique({
      where: { id: input.providerAccountRecordId, },
      select: {
        id: true,
        partner_user_id: true,
        provider_account_id: true,
      },
    });

    if (byId) {
      return byId;
    }
  }

  if (input.partnerUserId === null) {
    return null;
  }

  return prisma.partner_provider_account.findFirst({
    where: {
      partner_user_id: input.partnerUserId,
      provider: 'xendit',
    },
    select: {
      id: true,
      partner_user_id: true,
      provider_account_id: true,
    },
  });
}

function readMetadataString(metadata: Prisma.JsonValue | null, key: string) {
  if (!isJsonObject(metadata)) {
    return null;
  }

  const value = metadata[key];
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function toInputJsonValue(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

async function finalizePaymentEvent(opts: {
  paymentEventId: string | null;
  status: 'processed' | 'ignored' | 'failed';
  errorMessage?: string;
}) {
  if (!opts.paymentEventId) {
    return;
  }

  try {
    await prisma.payment_event.update({
      where: { id: opts.paymentEventId, },
      data: {
        processing_status: opts.status,
        processed_at: new Date(),
        error_message: opts.errorMessage ?? null,
      },
    });
  } catch (error) {
    console.error('Failed to update Xendit payment event status', {
      paymentEventId: opts.paymentEventId,
      error,
    });
  }
}

async function recordXenditInvoiceEvent(
  invoice: ReturnType<typeof parseXenditInvoicePayload>
) {
  const providerEventId = resolveInvoiceEventId(invoice);

  try {
    const created = await prisma.payment_event.create({
      data: {
        provider: 'xendit',
        provider_event_id: providerEventId,
        event_type: `xendit.invoice.${invoice.status.toLowerCase()}`,
        provider_object_id: invoice.id,
        livemode: false,
        payload_json: invoice as unknown as Prisma.InputJsonValue,
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

    throw error;
  }
}

async function recordXenditRefundEvent(input: {
  eventType: 'refund.succeeded' | 'refund.failed';
  refund: ReturnType<typeof parseXenditRefundWebhookPayload>['refund'];
}) {
  const providerEventId = `${input.refund.id}:${input.eventType}:${input.refund.status}`;

  try {
    const created = await prisma.payment_event.create({
      data: {
        provider: 'xendit',
        provider_event_id: providerEventId,
        event_type: `xendit.${input.eventType}`,
        provider_object_id: input.refund.id,
        livemode: false,
        payload_json: input.refund as unknown as Prisma.InputJsonValue,
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

    throw error;
  }
}

async function recordProviderBackedBookingCharge(input: {
  partnerUserId: bigint;
  bookingId: string;
  providerObjectId: string;
  amountMinor: bigint;
  currency: string;
  description: string;
  metadata: Prisma.InputJsonValue;
}) {
  const walletRow = await ensureWalletRow(input.partnerUserId);
  const externalReference = `xendit-booking:${input.providerObjectId}`;

  try {
    await prisma.wallet_transaction.create({
      data: {
        wallet_id: walletRow.id,
        type: 'charge',
        status: 'succeeded',
        amount_minor: input.amountMinor,
        net_amount_minor: input.amountMinor,
        currency: input.currency,
        description: input.description,
        external_reference: externalReference,
        booking_id: input.bookingId,
        metadata: input.metadata,
      },
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      return;
    }

    throw error;
  }
}

async function notifyRefundOutcome(input: {
  bookingId: string | null;
  amountMinor: bigint;
  currency: string;
  status: 'succeeded' | 'failed';
}) {
  if (!input.bookingId) {
    return;
  }

  try {
    const booking = await prisma.booking.findUnique({
      where: { id: input.bookingId, },
      select: {
        id: true,
        area_id: true,
        area_name: true,
        space_id: true,
        space_name: true,
        user_auth_id: true,
        partner_auth_id: true,
      },
    });

    if (!booking) {
      return;
    }

    const refundLabel = input.status === 'succeeded' ? 'Refund completed' : 'Refund failed';
    const refundBody = input.status === 'succeeded'
      ? `Your refund of ${formatCurrencyMinor(input.amountMinor.toString(), input.currency)} for ${booking.area_name} · ${booking.space_name} has been completed.`
      : `Your refund for ${booking.area_name} · ${booking.space_name} could not be processed. Please contact support.`;

    await notifyBookingEvent(
      {
        bookingId: booking.id,
        spaceId: booking.space_id,
        areaId: booking.area_id,
        spaceName: booking.space_name,
        areaName: booking.area_name,
        customerAuthId: booking.user_auth_id,
        partnerAuthId: booking.partner_auth_id,
      },
      {
        title: refundLabel,
        body: refundBody,
      },
      null
    );

    try {
      const adminClient = getSupabaseAdminClient();
      const { data: userData, } = await adminClient.auth.admin.getUserById(booking.user_auth_id);
      if (userData?.user?.email) {
        await sendRefundNotificationEmail({
          to: userData.user.email,
          spaceName: booking.space_name,
          areaName: booking.area_name,
          amount: formatCurrencyMinor(input.amountMinor.toString(), input.currency),
          status: input.status,
          link: `${APP_URL}/marketplace/${booking.space_id}`,
        });
      }
    } catch (emailError) {
      console.error('Failed to send Xendit refund notification email', {
        bookingId: booking.id,
        emailError,
      });
    }
  } catch (error) {
    console.error('Failed to notify refund outcome for Xendit refund', {
      bookingId: input.bookingId,
      error,
    });
  }
}

async function handleXenditPayoutWebhook(
  payout: ReturnType<typeof parseXenditPayoutPayload>
) {
  const result = await applyXenditPayoutStatus({
    payoutId: payout.id,
    referenceId: payout.reference_id,
    status: payout.status,
    estimatedArrivalTime: payout.estimated_arrival_time ?? null,
    failureCode: payout.failure_code ?? null,
  });

  if (result?.providerAccountIdToSync) {
    try {
      await syncPartnerWalletFromRemoteAccountId(result.providerAccountIdToSync);
    } catch (error) {
      console.error('Failed to sync partner wallet after payout webhook', {
        payoutId: payout.id,
        providerAccountId: result.providerAccountIdToSync,
        error,
      });
    }
  }
}

async function handleXenditRefundWebhook(
  payload: ReturnType<typeof parseXenditRefundWebhookPayload>
) {
  const paymentEvent = await recordXenditRefundEvent(payload);
  if (paymentEvent.duplicate) {
    return;
  }

  let providerAccountIdToSync: string | null = null;
  let bookingIdToNotify: string | null = null;

  try {
    await prisma.$transaction(async (tx) => {
      const walletTransaction = await tx.wallet_transaction.findUnique({
        where: { id: payload.refund.reference_id, },
        select: {
          id: true,
          type: true,
          status: true,
          amount_minor: true,
          currency: true,
          booking_id: true,
          metadata: true,
        },
      });

      if (!walletTransaction || walletTransaction.type !== 'refund') {
        return;
      }

      providerAccountIdToSync =
        readMetadataString(walletTransaction.metadata, 'remote_partner_provider_account_id');
      bookingIdToNotify = walletTransaction.booking_id;

      const nextStatus =
        payload.eventType === 'refund.succeeded' ? 'succeeded' : 'failed';

      if (walletTransaction.status === nextStatus) {
        return;
      }

      await tx.wallet_transaction.update({
        where: { id: walletTransaction.id, },
        data: {
          status: nextStatus,
          external_reference: payload.refund.id,
          amount_minor:
            payload.refund.amount != null && payload.refund.currency
              ? BigInt(Math.round(Number(payload.refund.amount) * 100))
              : walletTransaction.amount_minor,
          net_amount_minor:
            payload.refund.amount != null && payload.refund.currency
              ? BigInt(Math.round(Number(payload.refund.amount) * 100))
              : walletTransaction.amount_minor,
          currency: payload.refund.currency ?? walletTransaction.currency,
          metadata: buildRefundWebhookMetadata(walletTransaction.metadata, {
            providerStatus: payload.refund.status,
            failureReason: payload.refund.failure_reason ?? null,
            providerRefund: payload.refund as unknown as Prisma.InputJsonObject,
          }),
          updated_at: new Date(),
        },
      });

      const paymentTransactionId = readMetadataString(
        walletTransaction.metadata,
        'payment_transaction_id'
      );

      if (paymentTransactionId && nextStatus === 'succeeded') {
        const paymentTransaction = await tx.payment_transaction.findUnique({
          where: { id: paymentTransactionId, },
          select: {
            id: true,
            amount_minor: true,
            raw_gateway_json: true,
          },
        });

        if (
          paymentTransaction &&
          walletTransaction.amount_minor >= paymentTransaction.amount_minor
        ) {
          await tx.payment_transaction.update({
            where: { id: paymentTransaction.id, },
            data: {
              status: 'refunded',
              raw_gateway_json: {
                ...(isJsonObject(paymentTransaction.raw_gateway_json)
                  ? paymentTransaction.raw_gateway_json
                  : {}),
                latest_refund_id: payload.refund.id,
                latest_refund_status: payload.refund.status,
              },
              updated_at: new Date(),
            },
          });
        }
      }
    }, { isolationLevel: 'Serializable', });

    if (providerAccountIdToSync) {
      try {
        await syncPartnerWalletFromRemoteAccountId(providerAccountIdToSync);
      } catch (error) {
        console.error('Failed to sync partner wallet after refund webhook', {
          refundId: payload.refund.id,
          providerAccountId: providerAccountIdToSync,
          error,
        });
      }
    }

    await notifyRefundOutcome({
      bookingId: bookingIdToNotify,
      amountMinor:
        payload.refund.amount != null && payload.refund.currency
          ? BigInt(Math.round(Number(payload.refund.amount) * 100))
          : 0n,
      currency: payload.refund.currency ?? 'PHP',
      status: payload.eventType === 'refund.succeeded' ? 'succeeded' : 'failed',
    });

    await finalizePaymentEvent({
      paymentEventId: paymentEvent.id,
      status: 'processed',
    });
  } catch (error) {
    await finalizePaymentEvent({
      paymentEventId: paymentEvent.id,
      status: 'failed',
      errorMessage: error instanceof Error ? error.message : 'Xendit refund webhook failed.',
    });
    throw error;
  }
}

async function handleXenditInvoiceWebhook(
  invoice: ReturnType<typeof parseXenditInvoicePayload>
) {
  const paymentEvent = await recordXenditInvoiceEvent(invoice);
  if (paymentEvent.duplicate) {
    return;
  }

  const bookingId = resolveBookingIdFromInvoicePayload(invoice);
  if (!bookingId) {
    await finalizePaymentEvent({
      paymentEventId: paymentEvent.id,
      status: 'ignored',
      errorMessage: 'Missing booking reference.',
    });
    return;
  }

  const bookingRow = await prisma.booking.findUnique({ where: { id: bookingId, }, });

  if (!bookingRow) {
    await finalizePaymentEvent({
      paymentEventId: paymentEvent.id,
      status: 'ignored',
      errorMessage: 'Booking not found.',
    });
    return;
  }

  const existingPayment = await prisma.payment_transaction.findFirst({
    where: {
      provider: 'xendit',
      provider_object_id: invoice.id,
    },
    select: {
      id: true,
      raw_gateway_json: true,
    },
  });

  const mergedRawGatewayJson = toInputJsonValue({
    ...(isJsonObject(existingPayment?.raw_gateway_json) ? existingPayment.raw_gateway_json : {}),
    ...invoice,
  });

  await prisma.payment_transaction.upsert({
    where: {
      provider_provider_object_id: {
        provider: 'xendit',
        provider_object_id: invoice.id,
      },
    },
    create: {
      booking_id: bookingId,
      provider: 'xendit',
      provider_object_id: invoice.id,
      payment_event_id: paymentEvent.id,
      status: mapInvoicePaymentStatus(invoice.status),
      amount_minor: BigInt(Math.round(Number(invoice.amount) * 100)),
      currency_iso3: invoice.currency,
      payment_method_type: invoice.payment_method ?? 'xendit_invoice',
      is_live: false,
      occurred_at: invoice.paid_at ? new Date(invoice.paid_at) : new Date(),
      raw_gateway_json: mergedRawGatewayJson,
    },
    update: {
      booking_id: bookingId,
      payment_event_id: paymentEvent.id,
      status: mapInvoicePaymentStatus(invoice.status),
      amount_minor: BigInt(Math.round(Number(invoice.amount) * 100)),
      currency_iso3: invoice.currency,
      payment_method_type: invoice.payment_method ?? 'xendit_invoice',
      raw_gateway_json: mergedRawGatewayJson,
      occurred_at: invoice.paid_at ? new Date(invoice.paid_at) : new Date(),
      updated_at: new Date(),
    },
  });

  const resolvedPaymentStatus = mapInvoicePaymentStatus(invoice.status);
  if (resolvedPaymentStatus === 'failed' || resolvedPaymentStatus === 'cancelled') {
    if (bookingRow.status === 'pending') {
      await prisma.booking.update({
        where: { id: bookingRow.id, },
        data: { status: 'cancelled', },
      });
    }

    await finalizePaymentEvent({
      paymentEventId: paymentEvent.id,
      status: 'processed',
    });
    return;
  }

  if (resolvedPaymentStatus !== 'succeeded') {
    await finalizePaymentEvent({
      paymentEventId: paymentEvent.id,
      status: 'processed',
    });
    return;
  }

  const expectedAmountMinor =
    bookingRow.price_minor === null
      ? null
      : Number(bookingRow.price_minor);
  const paidAmountMinor = Math.round(Number(invoice.amount) * 100);
  const amountMatches =
    expectedAmountMinor !== null &&
    Number.isFinite(expectedAmountMinor) &&
    expectedAmountMinor === paidAmountMinor;
  const currencyMatches =
    bookingRow.currency.trim().toUpperCase() === invoice.currency.trim().toUpperCase();

  if (!amountMatches || !currencyMatches) {
    await finalizePaymentEvent({
      paymentEventId: paymentEvent.id,
      status: 'ignored',
      errorMessage: 'Amount or currency mismatch.',
    });
    return;
  }

  if (bookingRow.status === 'confirmed') {
    await finalizePaymentEvent({
      paymentEventId: paymentEvent.id,
      status: 'ignored',
      errorMessage: 'Booking already confirmed.',
    });
    return;
  }

  if (bookingRow.status !== 'pending') {
    await finalizePaymentEvent({
      paymentEventId: paymentEvent.id,
      status: 'ignored',
      errorMessage: `Booking status is ${bookingRow.status}.`,
    });
    return;
  }

  const requiresHostApproval = invoice.metadata?.requires_host_approval === 'true';
  let partnerInternalUserId =
    invoice.metadata?.partner_internal_user_id && /^\d+$/.test(invoice.metadata.partner_internal_user_id)
      ? BigInt(invoice.metadata.partner_internal_user_id)
      : null;
  let providerAccountRecordId = resolvePartnerProviderAccountId(
    existingPayment?.raw_gateway_json ?? null,
    invoice.metadata
  );

  if (partnerInternalUserId === null && bookingRow.partner_auth_id) {
    const partnerUser = await prisma.user.findUnique({
      where: { auth_user_id: bookingRow.partner_auth_id, },
      select: { user_id: true, },
    });
    partnerInternalUserId = partnerUser?.user_id ?? null;
  }

  const providerAccountRecord = await resolvePartnerProviderAccountRecord({
    providerAccountRecordId,
    partnerUserId: partnerInternalUserId,
  });

  if (providerAccountRecord) {
    providerAccountRecordId = providerAccountRecord.id;
    if (partnerInternalUserId === null) {
      partnerInternalUserId = providerAccountRecord.partner_user_id;
    }
  }

  if (partnerInternalUserId !== null) {
    await recordProviderBackedBookingCharge({
      partnerUserId: partnerInternalUserId,
      bookingId,
      providerObjectId: invoice.id,
      amountMinor: BigInt(paidAmountMinor),
      currency: invoice.currency,
      description: `${bookingRow.area_name} · ${bookingRow.space_name}`,
      metadata: {
        payment_provider: 'xendit',
        partner_provider_account_id: providerAccountRecordId,
        provider_payment_id: invoice.id,
        provider_reference_id: invoice.external_id,
      },
    });
  }

  await finalizeSuccessfulBookingPayment({
    bookingRow,
    requiresHostApproval,
  });

  await finalizePaymentEvent({
    paymentEventId: paymentEvent.id,
    status: 'processed',
  });

  const remoteProviderAccountId = providerAccountRecord?.provider_account_id ?? null;

  if (remoteProviderAccountId) {
    try {
      await syncPartnerWalletFromRemoteAccountId(remoteProviderAccountId);
    } catch (error) {
      console.error('Failed to sync partner wallet after invoice webhook', {
        invoiceId: invoice.id,
        providerAccountId: remoteProviderAccountId,
        error,
      });
    }
  }
}

export async function POST(req: NextRequest) {
  const xenditWebhookVerificationToken = resolveXenditWebhookToken();

  if (!xenditWebhookVerificationToken) {
    return NextResponse.json(
      { message: 'Xendit webhook verification is not configured.', },
      { status: 503, }
    );
  }

  const callbackToken = req.headers.get('x-callback-token');
  if (callbackToken !== xenditWebhookVerificationToken) {
    return NextResponse.json(
      { message: 'Invalid Xendit callback token.', },
      { status: 401, }
    );
  }

  const payload = await req.json().catch(() => null);
  if (!payload) {
    return NextResponse.json(
      { message: 'Invalid webhook payload.', },
      { status: 400, }
    );
  }

  try {
    if (
      typeof payload === 'object' &&
      payload !== null &&
      ('refundSucceeded' in payload || 'refundFailed' in payload)
    ) {
      await handleXenditRefundWebhook(parseXenditRefundWebhookPayload(payload));
      return NextResponse.json({ received: true, }, { status: 200, });
    }

    if (
      typeof payload === 'object' &&
      payload !== null &&
      'reference_id' in payload &&
      'channel_code' in payload
    ) {
      await handleXenditPayoutWebhook(parseXenditPayoutPayload(payload));
      return NextResponse.json({ received: true, }, { status: 200, });
    }

    if (
      typeof payload === 'object' &&
      payload !== null &&
      'external_id' in payload &&
      'status' in payload &&
      'amount' in payload &&
      'currency' in payload
    ) {
      await handleXenditInvoiceWebhook(parseXenditInvoicePayload(payload));
      return NextResponse.json({ received: true, }, { status: 200, });
    }

    return NextResponse.json(
      { message: 'Unexpected Xendit webhook payload.', },
      { status: 400, }
    );
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2034'
    ) {
      return NextResponse.json(
        { message: 'A conflict occurred. Please retry the webhook delivery.', },
        { status: 409, }
      );
    }

    console.error('Failed to process Xendit webhook', error);
    return NextResponse.json(
      { message: 'Unable to process the webhook.', },
      { status: 500, }
    );
  }
}
